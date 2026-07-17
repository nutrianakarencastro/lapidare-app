-- =============================================================
-- Migration: 2026-07-16_v2_2_hardening_service_role_rpcs.sql
-- Arquitetura da Atenção V2 — Sprint V2.2 (hardening)
--
-- Reforça a autorização das três RPCs destinadas ao Adapter push
-- (revogar_subscription, marcar_entrega_enviada, marcar_entrega_falhou)
-- com guard interno auth.role() = 'service_role'.
--
-- Motivação: o Supabase concede EXECUTE default para anon e
-- authenticated em funções no schema public, mesmo após REVOKE FROM
-- PUBLIC + GRANT explícito. Sem esse guard, um paciente authenticated
-- que conhecesse um endpoint ou entrega_id conseguia:
--   - revogar subscription de outra paciente (revogar_subscription);
--   - marcar entrega alheia como enviada/falhou, poluindo metadata
--     e adiantando status irreversivelmente (marcar_entrega_*).
--
-- Comprovado empiricamente na bateria da Fase A antes desta correção.
-- Depois desta migration: chamadas de authenticated e anon viram
-- silent no-op. Service role (Adapter) continua operando normalmente.
--
-- Não altera assinatura, contrato ou ACL — apenas o corpo. RPCs
-- redefinidas via CREATE OR REPLACE.
--
-- Idempotente.
-- =============================================================


CREATE OR REPLACE FUNCTION public.revogar_subscription(
  p_endpoint TEXT,
  p_motivo   TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RETURN;
  END IF;

  IF p_endpoint IS NULL OR p_endpoint = ''
     OR p_motivo NOT IN ('endpoint_invalido', 'opt_out', 'usuario_desinstalou') THEN
    RETURN;
  END IF;

  UPDATE public.push_subscriptions
     SET revogado_em     = NOW(),
         revogado_motivo = p_motivo
   WHERE endpoint        = p_endpoint
     AND revogado_em IS NULL;
END $$;


CREATE OR REPLACE FUNCTION public.marcar_entrega_enviada(
  p_entrega_id UUID,
  p_metadata   JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RETURN;
  END IF;

  IF p_entrega_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.evento_entregas
     SET status      = 'enviado',
         tentado_em  = COALESCE(tentado_em, NOW()),
         entregue_em = NOW(),
         metadata    = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
   WHERE id          = p_entrega_id
     AND status      = 'pendente';
END $$;


CREATE OR REPLACE FUNCTION public.marcar_entrega_falhou(
  p_entrega_id UUID,
  p_erro       JSONB,
  p_metadata   JSONB DEFAULT '{}'::jsonb
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() <> 'service_role' THEN
    RETURN;
  END IF;

  IF p_entrega_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.evento_entregas
     SET status     = 'falhou',
         tentado_em = COALESCE(tentado_em, NOW()),
         erro       = COALESCE(p_erro, '{}'::jsonb),
         metadata   = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
   WHERE id         = p_entrega_id
     AND status     = 'pendente';
END $$;
