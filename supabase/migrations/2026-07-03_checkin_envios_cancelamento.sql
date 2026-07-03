-- =============================================================
-- Migration: 2026-07-03_checkin_envios_cancelamento.sql
-- Adiciona suporte a cancelamento de check-ins pela nutri.
--
-- Problema resolvido:
--   check-ins pendentes antigos (respondido_em IS NULL) ficavam
--   visíveis indefinidamente para a paciente e invisíveis para
--   a nutri, sem nenhuma forma de encerrar a pendência.
--
-- Solução:
--   cancelado_em  — quando o check-in foi cancelado
--   cancelado_por — quem cancelou (nutri, via auth.users.id)
--
-- Impacto nas queries:
--   Toda query com .is('respondido_em', null) que representa
--   "pendências ativas" deve também filtrar .is('cancelado_em', null).
--
-- Idempotente.
-- =============================================================

ALTER TABLE public.checkin_envios
  ADD COLUMN IF NOT EXISTS cancelado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice parcial: check-ins ativos (nem respondidos nem cancelados)
-- Substitui o índice checkin_envios_pendentes_idx que só filtrava respondido_em
CREATE INDEX IF NOT EXISTS checkin_envios_ativos_idx
  ON public.checkin_envios (paciente_id, enviado_em DESC)
  WHERE respondido_em IS NULL AND cancelado_em IS NULL;
