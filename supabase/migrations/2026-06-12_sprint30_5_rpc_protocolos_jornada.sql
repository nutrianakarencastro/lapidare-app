-- =============================================================
-- Migration: 2026-06-12_sprint30_5_rpc_protocolos_jornada.sql
-- Sprint 30.5 — Jornada + Protocolos Integrados
--
-- RPC de leitura segura para a paciente conhecer seus protocolos
-- ativos sem expor conteúdo clínico ou observações da nutri.
--
-- Padrão correto pós-Sprint B.1: busca via pacientes.auth_user_id.
-- Idempotente.
-- =============================================================

CREATE OR REPLACE FUNCTION public.paciente_protocolos_ativos_resumo()
RETURNS TABLE(protocolo_id text, aplicado_em date)
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pp.protocolo_id,
         pp.aplicado_em
  FROM   public.paciente_protocolos pp
  JOIN   public.pacientes           p  ON p.id = pp.paciente_id
  WHERE  p.auth_user_id = auth.uid()
    AND  pp.status      = 'ativo'
  ORDER BY pp.aplicado_em ASC;
$$;

REVOKE EXECUTE ON FUNCTION public.paciente_protocolos_ativos_resumo() FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_protocolos_ativos_resumo() TO authenticated;
