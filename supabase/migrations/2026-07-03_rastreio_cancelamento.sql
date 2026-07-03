-- =============================================================
-- Migration: 2026-07-03_rastreio_cancelamento.sql
-- Adiciona suporte a cancelamento de solicitações de rastreio
-- intestinal pela nutri.
--
-- Problema resolvido:
--   solicitações pendentes antigas (respondido_em IS NULL)
--   bloqueavam o botão "Solicitar rastreio" indefinidamente
--   e não tinham nenhuma forma de encerramento pela nutri.
--
-- Solução:
--   cancelado_em  — quando a solicitação foi encerrada
--   cancelado_por — quem encerrou (nutri, via auth.users.id)
--
-- Impacto nas queries:
--   Toda query com .is('respondido_em', null) que representa
--   "pendência ativa" deve também filtrar .is('cancelado_em', null).
--
-- Idempotente.
-- =============================================================

ALTER TABLE public.intestino_rastreio_solicitacoes
  ADD COLUMN IF NOT EXISTS cancelado_em  timestamptz,
  ADD COLUMN IF NOT EXISTS cancelado_por uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Índice parcial: solicitações ativas (nem respondidas nem canceladas)
CREATE INDEX IF NOT EXISTS rastreio_solicitacoes_ativos_idx
  ON public.intestino_rastreio_solicitacoes (paciente_id, solicitado_em DESC)
  WHERE respondido_em IS NULL AND cancelado_em IS NULL;
