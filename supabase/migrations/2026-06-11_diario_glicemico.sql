-- Sprint C — Diário Glicêmico DMG
-- Policies separadas: paciente pode SELECT/INSERT/UPDATE, não DELETE.
-- Nutri pode apenas SELECT dos registros das suas pacientes.

CREATE TABLE public.diario_glicemico (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id    uuid         NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  data           date         NOT NULL,
  tipo_refeicao  text         NOT NULL
    CHECK (tipo_refeicao IN ('jejum','cafe_manha','almoco','jantar','extra')),
  seq_extra      smallint     DEFAULT NULL,
  -- NULL para refeições fixas; 1,2,3… para extras do mesmo dia
  valor_mg_dl    smallint     NOT NULL
    CHECK (valor_mg_dl >= 40 AND valor_mg_dl <= 500),
  protocolo      text         NOT NULL CHECK (protocolo IN ('1h','2h')),
  -- Snapshot do protocolo ativo no momento do registro
  registrado_em  timestamptz  NOT NULL DEFAULT now()
);

-- Uma entrada por refeição fixa/dia/paciente
CREATE UNIQUE INDEX diario_glicemico_unico_fixo
  ON public.diario_glicemico (paciente_id, data, tipo_refeicao)
  WHERE tipo_refeicao != 'extra';

-- Extras únicos por sequência/dia/paciente
CREATE UNIQUE INDEX diario_glicemico_unico_extra
  ON public.diario_glicemico (paciente_id, data, seq_extra)
  WHERE tipo_refeicao = 'extra';

-- Índice para consulta eficiente no dashboard da nutri
CREATE INDEX diario_glicemico_paciente_data_idx
  ON public.diario_glicemico (paciente_id, data DESC);

ALTER TABLE public.diario_glicemico ENABLE ROW LEVEL SECURITY;

-- Paciente: SELECT (histórico)
CREATE POLICY "paciente_diario_select" ON public.diario_glicemico
  FOR SELECT USING (paciente_id = auth.uid());

-- Paciente: INSERT (novo registro)
CREATE POLICY "paciente_diario_insert" ON public.diario_glicemico
  FOR INSERT WITH CHECK (paciente_id = auth.uid());

-- Paciente: UPDATE (corrigir valor)
CREATE POLICY "paciente_diario_update" ON public.diario_glicemico
  FOR UPDATE
  USING (paciente_id = auth.uid())
  WITH CHECK (paciente_id = auth.uid());

-- Nutri: lê registros das suas pacientes (sem escrita)
CREATE POLICY "nutri_diario_glicemico_read" ON public.diario_glicemico
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE pacientes.id = diario_glicemico.paciente_id
        AND pacientes.nutri_id = auth.uid()
    )
  );

COMMENT ON TABLE public.diario_glicemico IS
  'Registros do diário glicêmico para pacientes com módulo diario_glicemico_dmg ativo.
   protocolo é snapshot do momento do registro — não retroage ao alterar o módulo.
   Paciente pode inserir e corrigir, mas não excluir.';
