-- =============================================================
-- B.5.0 — Recuperação de schema órfão: feedback em checkin_envios
-- =============================================================
-- Reconstitui colunas e função que existem no banco de produção
-- mas nunca foram versionadas em nenhum arquivo de migration.
-- Idempotente via ADD COLUMN IF NOT EXISTS + CREATE OR REPLACE.
-- =============================================================

-- ── 1. Colunas de feedback ────────────────────────────────────
-- Adicionadas diretamente no Dashboard sem migration registrada.

ALTER TABLE public.checkin_envios
  ADD COLUMN IF NOT EXISTS feedback               text,
  ADD COLUMN IF NOT EXISTS feedback_em            timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_atualizado_em timestamptz,
  ADD COLUMN IF NOT EXISTS feedback_lido_em       timestamptz;

-- ── 2. Função marcar_feedback_lido ───────────────────────────
-- Reconstitui a função órfã a partir do comportamento observado
-- no frontend (Checkin.jsx: fire-and-forget ao abrir o feedback).
--
-- Usa meu_paciente_id() (B.2) para resolver o ID clínico via
-- auth_user_id — compatível com pacientes antigas e novas.
--
-- SECURITY DEFINER: paciente tem apenas SELECT em checkin_envios;
-- a função eleva privilégio apenas para UPDATE no próprio envio.

CREATE OR REPLACE FUNCTION public.marcar_feedback_lido(p_envio_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.checkin_envios
  SET    feedback_lido_em = now()
  WHERE  id          = p_envio_id
    AND  paciente_id = meu_paciente_id();
  -- Sem FOUND check: fail-safe silencioso (fire-and-forget pelo cliente)
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_feedback_lido(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.marcar_feedback_lido(uuid) TO authenticated;
