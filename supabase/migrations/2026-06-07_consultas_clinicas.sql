-- =============================================================
-- Migration: 2026-06-07_consultas_clinicas.sql
-- Adiciona campos clínicos à tabela consultas existente.
-- Expande status para incluir 'em_andamento'.
-- Idempotente: pode ser rodada novamente sem erro.
-- =============================================================

-- ── 1. Campos clínicos ────────────────────────────────────────

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS resumo               text,
  ADD COLUMN IF NOT EXISTS queixas_achados      text,
  ADD COLUMN IF NOT EXISTS objetivos_discutidos text,
  ADD COLUMN IF NOT EXISTS proximos_passos      text,
  ADD COLUMN IF NOT EXISTS observacoes_internas text;

-- ── 2. Expandir status para incluir 'em_andamento' ───────────
-- Remove o constraint de status existente (nome pode variar)
-- e recria com o valor novo.

DO $$
DECLARE
  v_constraint text;
BEGIN
  SELECT conname INTO v_constraint
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  WHERE n.nspname = 'public'
    AND t.relname = 'consultas'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%';

  IF v_constraint IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.consultas DROP CONSTRAINT %I', v_constraint);
    RAISE NOTICE 'Constraint de status removido: %', v_constraint;
  ELSE
    RAISE NOTICE 'Nenhum constraint de status encontrado — seguindo.';
  END IF;
END;
$$;

ALTER TABLE public.consultas
  ADD CONSTRAINT consultas_status_check
  CHECK (status IN ('agendada','em_andamento','realizada','cancelada'));
