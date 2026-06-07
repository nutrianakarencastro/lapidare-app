-- =============================================================
-- Migration: 2026-06-07_condutas.sql
-- Cria tabela condutas (Central de Condutas).
-- Idempotente: pode ser rodada novamente sem erro.
-- =============================================================

-- ── 1. Tabela condutas ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.condutas (
  id                    uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nutri_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  data                  date        NOT NULL DEFAULT CURRENT_DATE,
  titulo                text        NOT NULL,
  objetivo_principal    text,
  objetivos_secundarios jsonb       NOT NULL DEFAULT '[]'::jsonb,
  condutas              jsonb       NOT NULL DEFAULT '[]'::jsonb,
  observacoes           text,
  is_atual              boolean     NOT NULL DEFAULT false,
  origem                text        CHECK (origem IS NULL OR origem IN ('consulta','check-in','revisao')),
  created_at            timestamptz NOT NULL DEFAULT now(),
  atualizado_em         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_condutas_paciente
  ON public.condutas(paciente_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_condutas_nutri
  ON public.condutas(nutri_id, paciente_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_condutas_atual
  ON public.condutas(paciente_id, is_atual)
  WHERE is_atual = true;

-- ── 2. Trigger atualizado_em ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_atualizado_em_condutas()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_condutas_atualizado_em ON public.condutas;
CREATE TRIGGER trg_condutas_atualizado_em
  BEFORE UPDATE ON public.condutas
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_condutas();

-- ── 3. RLS — condutas ─────────────────────────────────────────

ALTER TABLE public.condutas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_condutas" ON public.condutas;

-- Nutri: acesso total às condutas de suas pacientes
CREATE POLICY "nutri_all_condutas" ON public.condutas
  FOR ALL
  USING   (nutri_id = auth.uid())
  WITH CHECK (nutri_id = auth.uid());

-- V1: paciente NÃO visualiza condutas.
-- V2 (futuro): adicionar policy SELECT para paciente_id = auth.uid()
--   com projeção limitada (sem observacoes clínicas internas).
