-- =============================================================
-- Sprint 25 — Controle de Acesso por Modelo de Acompanhamento
-- =============================================================
-- Dois campos independentes em pacientes:
--   modelo_acompanhamento — referência clínica (nullable, sem default)
--   acesso_utera          — controla a experiência do app (default 'completo')
-- =============================================================

-- Modelo clínico — referência de acompanhamento, sem efeito no app
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS modelo_acompanhamento text
    CHECK (modelo_acompanhamento IN (
      'consulta', 'acompanhamento', 'manutencao', 'reviva', 'longevidade'
    ));

-- Experiência Útera — controla o que a paciente vê no app
ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS acesso_utera text
    NOT NULL DEFAULT 'completo'
    CHECK (acesso_utera IN ('essencial', 'expandido', 'completo'));
