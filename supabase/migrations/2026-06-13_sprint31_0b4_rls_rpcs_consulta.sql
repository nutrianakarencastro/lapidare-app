-- =============================================================
-- Migration: 2026-06-13_sprint31_0b4_rls_rpcs_consulta.sql
-- Sprint 31.0B.4 — Correção RPCs de confirmação de consulta
--
-- Problema: 2026-06-09_consultas_confirmacao.sql (alfabeticamente
-- posterior a b5_1) sobrescreveu as correções de B.5.1, voltando
-- ao padrão auth.uid() em ambas as RPCs.
--
-- Ordem de execução que causou o problema (mesmo dia, ordem alfa):
--   b5_1_rls_criticas.sql      → corrigiu com meu_paciente_id()
--   consultas_confirmacao.sql  → sobrescreveu com auth.uid()
--
-- Esta migration reaplica o padrão correto pós-B.1:
--   auth.uid() → meu_paciente_id()   (SECURITY DEFINER, B.2)
--
-- Funções corrigidas:
--   paciente_visualizar_consulta()  — 1 ponto com auth.uid()
--   paciente_confirmar_consulta()   — 2 pontos com auth.uid()
--
-- Validações de negócio mantidas integralmente:
--   - status NOT IN ('cancelada','realizada')
--   - remarcação: janela de 24h antes da consulta
--   - remarcação: data sugerida entre amanhã e +7 dias
--
-- Sem alteração de schema. Sem backfill.
-- =============================================================


-- =============================================================
-- 1. paciente_visualizar_consulta()
-- =============================================================

CREATE OR REPLACE FUNCTION public.paciente_visualizar_consulta(p_consulta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.consultas
  SET    visualizado_em = now()
  WHERE  id             = p_consulta_id
    AND  paciente_id    = meu_paciente_id()
    AND  visualizado_em IS NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.paciente_visualizar_consulta(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_visualizar_consulta(uuid) TO authenticated;


-- =============================================================
-- 2. paciente_confirmar_consulta()
-- =============================================================

CREATE OR REPLACE FUNCTION public.paciente_confirmar_consulta(
  p_consulta_id              uuid,
  p_resposta                 text,
  p_obs_remarcacao           text  DEFAULT NULL,
  p_sugestao_remarcacao_data date  DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_data_hora timestamptz;
BEGIN
  -- Valida o valor da resposta
  IF p_resposta NOT IN ('confirmada', 'remarcacao_solicitada') THEN
    RAISE EXCEPTION 'Valor inválido: %', p_resposta;
  END IF;

  -- Verifica posse da consulta e estado válido
  SELECT data_hora INTO v_data_hora
  FROM   public.consultas
  WHERE  id          = p_consulta_id
    AND  paciente_id = meu_paciente_id()
    AND  status NOT IN ('cancelada', 'realizada');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta não encontrada ou não disponível para alteração.';
  END IF;

  -- Regra das 24h para remarcação
  IF p_resposta = 'remarcacao_solicitada'
     AND v_data_hora - now() < interval '24 hours' THEN
    RAISE EXCEPTION 'Remarcações pelo app ficam disponíveis até 24h antes da consulta.';
  END IF;

  -- Validações da data sugerida
  IF p_resposta = 'remarcacao_solicitada' THEN
    IF p_sugestao_remarcacao_data IS NULL THEN
      RAISE EXCEPTION 'Informe uma data sugerida para a remarcação.';
    END IF;
    IF p_sugestao_remarcacao_data < (now() + interval '1 day')::date THEN
      RAISE EXCEPTION 'A data sugerida deve ser a partir de amanhã.';
    END IF;
    IF p_sugestao_remarcacao_data > (v_data_hora + interval '7 days')::date THEN
      RAISE EXCEPTION 'A data sugerida deve ser até 7 dias após a consulta original.';
    END IF;
  END IF;

  -- Registra a resposta
  UPDATE public.consultas
  SET
    resposta_paciente        = p_resposta,
    respondido_em            = now(),
    obs_remarcacao           = CASE
                                 WHEN p_resposta = 'remarcacao_solicitada'
                                 THEN p_obs_remarcacao
                                 ELSE NULL
                               END,
    sugestao_remarcacao_data = CASE
                                 WHEN p_resposta = 'remarcacao_solicitada'
                                 THEN p_sugestao_remarcacao_data
                                 ELSE NULL
                               END
  WHERE  id          = p_consulta_id
    AND  paciente_id = meu_paciente_id();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.paciente_confirmar_consulta(uuid, text, text, date) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_confirmar_consulta(uuid, text, text, date) TO authenticated;
