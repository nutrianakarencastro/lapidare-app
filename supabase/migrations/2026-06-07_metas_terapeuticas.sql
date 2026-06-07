-- =============================================================
-- Migration: 2026-06-07_metas_terapeuticas.sql
-- Cria tabela metas_terapeuticas (sprint Metas Terapêuticas).
-- Idempotente: pode ser rodada novamente sem erro.
-- =============================================================

-- ── 1. Tabela ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.metas_terapeuticas (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nutri_id      uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  titulo        text        NOT NULL,
  eixo          text,
  descricao     text,
  criterio      text,

  status        text        NOT NULL DEFAULT 'ativa'
                CHECK (status IN ('ativa','em_evolucao','concluida','pausada')),

  prioridade    text        NOT NULL DEFAULT 'media'
                CHECK (prioridade IN ('alta','media','baixa')),

  criado_em     date        NOT NULL DEFAULT CURRENT_DATE,
  concluido_em  date,
  pausado_em    date,

  observacoes   text,

  created_at    timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_metas_paciente
  ON public.metas_terapeuticas(paciente_id, status);
CREATE INDEX IF NOT EXISTS idx_metas_nutri
  ON public.metas_terapeuticas(nutri_id, paciente_id);
CREATE INDEX IF NOT EXISTS idx_metas_ativas
  ON public.metas_terapeuticas(paciente_id, prioridade)
  WHERE status IN ('ativa','em_evolucao');

-- ── 2. Trigger atualizado_em ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_atualizado_em_metas()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_metas_atualizado_em ON public.metas_terapeuticas;
CREATE TRIGGER trg_metas_atualizado_em
  BEFORE UPDATE ON public.metas_terapeuticas
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_metas();

-- ── 3. RLS ────────────────────────────────────────────────────

ALTER TABLE public.metas_terapeuticas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_metas" ON public.metas_terapeuticas;

CREATE POLICY "nutri_all_metas" ON public.metas_terapeuticas
  FOR ALL
  USING   (nutri_id = auth.uid())
  WITH CHECK (nutri_id = auth.uid());

-- V1: paciente NÃO acessa metas.
-- V2 (futuro): adicionar policy SELECT para paciente_id = auth.uid()
--   sem observacoes (linguagem clínica interna).
