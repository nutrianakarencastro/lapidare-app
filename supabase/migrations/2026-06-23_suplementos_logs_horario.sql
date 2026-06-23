-- =============================================================
-- Migration: 2026-06-23_suplementos_logs_horario.sql
-- Adiciona suporte a múltiplas doses por horário em suplementos_logs.
--
-- O que muda:
--   1. Remove UNIQUE (suplemento_id, data) — impede múltiplos horários
--   2. Adiciona coluna horario TEXT nullable
--      Registros antigos ficam com horario = NULL (sem quebra de dados)
--   3. Índice parcial WHERE horario IS NULL:
--      garante 1 log por (suplemento_id, data) para suplementos sem horário
--   4. Índice parcial WHERE horario IS NOT NULL:
--      garante 1 log por (suplemento_id, data, horario) por dose específica
--
-- Idempotente.
-- =============================================================

-- 1. Remove constraint de unicidade atual
ALTER TABLE public.suplementos_logs
  DROP CONSTRAINT IF EXISTS suplementos_logs_suplemento_id_data_key;

-- 2. Adiciona coluna horario nullable (registros antigos = NULL)
ALTER TABLE public.suplementos_logs
  ADD COLUMN IF NOT EXISTS horario TEXT DEFAULT NULL;

-- 3a. Suplementos SEM horário: 1 log por (suplemento_id, data)
CREATE UNIQUE INDEX IF NOT EXISTS suplementos_logs_sem_horario
  ON public.suplementos_logs (suplemento_id, data)
  WHERE horario IS NULL;

-- 3b. Suplementos COM horário: 1 log por (suplemento_id, data, horario)
CREATE UNIQUE INDEX IF NOT EXISTS suplementos_logs_com_horario
  ON public.suplementos_logs (suplemento_id, data, horario)
  WHERE horario IS NOT NULL;
