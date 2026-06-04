-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint Intestino
-- Tabela de registros diários e rastreios aprofundados
-- Tabela de solicitações de rastreio pela nutri
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intestino_logs (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id             uuid NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  data                    date NOT NULL,
  tipo                    text NOT NULL DEFAULT 'diario' CHECK (tipo IN ('diario', 'rastreio')),

  -- Registro diário rápido
  evacuou                 boolean,
  frequencia_dia          smallint,
  bristol                 smallint CHECK (bristol BETWEEN 1 AND 7),
  gases                   smallint CHECK (gases BETWEEN 0 AND 3),
  estufamento             smallint CHECK (estufamento BETWEEN 0 AND 3),
  dor_abdominal           smallint CHECK (dor_abdominal BETWEEN 0 AND 3),
  esforco                 boolean,
  urgencia                boolean,
  esvaziamento_incompleto boolean,
  muco                    boolean,
  gatilhos                text[],

  -- Rastreio aprofundado (preenchido pela paciente quando solicitado pela nutri)
  cor_fezes               text,
  cheiro_fezes            text,
  momento_estufamento     text,
  localizacao_dor         text,
  sensacao_apos_evacuar   text,
  relacao_refeicoes       text,
  relacao_ciclo           text,
  observacoes             text,

  criado_em               timestamptz DEFAULT now(),

  UNIQUE (paciente_id, data, tipo)
);

ALTER TABLE intestino_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "paciente_intestino_all" ON intestino_logs
  FOR ALL USING (paciente_id = auth.uid());

CREATE POLICY "nutri_intestino_read" ON intestino_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = intestino_logs.paciente_id
        AND pacientes.nutri_id = auth.uid()
    )
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- Solicitações de rastreio intestinal aprofundado (iniciadas pela nutri)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS intestino_rastreio_solicitacoes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id     uuid NOT NULL REFERENCES pacientes(id) ON DELETE CASCADE,
  nutri_id        uuid NOT NULL,
  solicitado_em   timestamptz DEFAULT now(),
  respondido_em   timestamptz
);

ALTER TABLE intestino_rastreio_solicitacoes ENABLE ROW LEVEL SECURITY;

-- Paciente lê suas próprias solicitações e marca como respondida
CREATE POLICY "paciente_rastreio_read" ON intestino_rastreio_solicitacoes
  FOR SELECT USING (paciente_id = auth.uid());

CREATE POLICY "paciente_rastreio_update" ON intestino_rastreio_solicitacoes
  FOR UPDATE USING (paciente_id = auth.uid());

-- Nutri gerencia todas as solicitações das suas pacientes
CREATE POLICY "nutri_rastreio_all" ON intestino_rastreio_solicitacoes
  FOR ALL USING (
    nutri_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = intestino_rastreio_solicitacoes.paciente_id
        AND pacientes.nutri_id = auth.uid()
    )
  );
