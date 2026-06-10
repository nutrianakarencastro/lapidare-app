-- =============================================================
-- Sprint 24.2 — Curadoria da Memória Clínica Viva
-- =============================================================
-- Adiciona metadado de curadoria ao aprendizado da estratégia.
-- A nutricionista decide o que permanece em evidência.
-- =============================================================

ALTER TABLE public.estrategias
  ADD COLUMN IF NOT EXISTS aprendizado_essencial boolean NOT NULL DEFAULT false;

-- Índice parcial para leituras da Memória Clínica Viva
CREATE INDEX IF NOT EXISTS idx_estrategias_essencial_paciente
  ON public.estrategias (paciente_id, aprendizado_essencial)
  WHERE aprendizado_essencial = true AND status = 'encerrada';
