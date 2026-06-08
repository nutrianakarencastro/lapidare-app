-- =============================================================
-- Migration: 2026-06-08d_checkin_agendamentos_unico.sql
-- Adiciona frequência 'unico' e permite paciente ver seus agendamentos.
-- =============================================================

-- 1. Adicionar 'unico' ao CHECK constraint de frequencia
ALTER TABLE public.checkin_agendamentos
  DROP CONSTRAINT IF EXISTS checkin_agendamentos_frequencia_check;

ALTER TABLE public.checkin_agendamentos
  ADD CONSTRAINT checkin_agendamentos_frequencia_check
  CHECK (frequencia IN ('unico', 'semanal', 'quinzenal', 'mensal'));

-- 2. Paciente pode ver seus próprios agendamentos (para lembrete visual)
DROP POLICY IF EXISTS checkin_agendamentos_paciente_select ON public.checkin_agendamentos;
CREATE POLICY checkin_agendamentos_paciente_select
  ON public.checkin_agendamentos
  FOR SELECT
  USING (paciente_id = auth.uid());
