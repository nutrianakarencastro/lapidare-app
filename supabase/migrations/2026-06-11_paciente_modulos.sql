-- Sprint A — Módulos Especiais Liberáveis por Paciente
-- Sem UNIQUE em (paciente_id, modulo): preserva histórico completo de ativações/desativações.
-- A ativação atual é determinada pela linha mais recente (ORDER BY ativado_em DESC).

CREATE TABLE IF NOT EXISTS public.paciente_modulos (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     uuid        NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nutri_id        uuid        NOT NULL,
  modulo          text        NOT NULL,
  -- Exemplos: 'diario_glicemico_dmg', 'diario_intestinal', 'fertilidade', 'pos_parto'
  config          jsonb       NOT NULL DEFAULT '{}',
  -- DMG:       {"protocolo": "1h" | "2h"}
  -- Intestino: {"periodicidade": "diario" | "semanal" | "quinzenal" | "sob_demanda"}
  ativo           boolean     NOT NULL DEFAULT true,
  ativado_em      timestamptz NOT NULL DEFAULT now(),
  desativado_em   timestamptz
);

-- Índice para consulta eficiente do estado atual por módulo
CREATE INDEX IF NOT EXISTS paciente_modulos_paciente_modulo_idx
  ON public.paciente_modulos (paciente_id, modulo, ativado_em DESC);

ALTER TABLE public.paciente_modulos ENABLE ROW LEVEL SECURITY;

-- Nutri gerencia módulos das suas pacientes
CREATE POLICY "nutri_paciente_modulos_all" ON public.paciente_modulos
  FOR ALL USING (
    nutri_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE pacientes.id = paciente_modulos.paciente_id
        AND pacientes.nutri_id = auth.uid()
    )
  );

-- Paciente lê seus próprios módulos (para o app saber o que exibir)
CREATE POLICY "paciente_modulos_read" ON public.paciente_modulos
  FOR SELECT USING (paciente_id = auth.uid());

COMMENT ON TABLE public.paciente_modulos IS
  'Histórico de ativações/desativações de módulos especiais por paciente.
   Para o estado atual de um módulo: ORDER BY ativado_em DESC LIMIT 1.';
