-- =============================================================
-- Migration: 2026-06-09_consultas_confirmacao.sql
-- Confirmação de consulta pelo app da paciente.
-- =============================================================

-- ── 1. Novos campos ──────────────────────────────────────────

ALTER TABLE public.consultas
  ADD COLUMN IF NOT EXISTS resposta_paciente      text NOT NULL DEFAULT 'pendente'
    CHECK (resposta_paciente IN ('pendente','confirmada','remarcacao_solicitada')),
  ADD COLUMN IF NOT EXISTS respondido_em           timestamptz,
  ADD COLUMN IF NOT EXISTS obs_remarcacao          text,
  ADD COLUMN IF NOT EXISTS sugestao_remarcacao_data date,
  ADD COLUMN IF NOT EXISTS visualizado_em          timestamptz;

-- ── 2. RPC: paciente registra primeira visualização do card ──

CREATE OR REPLACE FUNCTION public.paciente_visualizar_consulta(p_consulta_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.consultas
  SET visualizado_em = now()
  WHERE id          = p_consulta_id
    AND paciente_id = auth.uid()
    AND visualizado_em IS NULL;   -- idempotente: só na primeira visualização
END;
$$;

REVOKE EXECUTE ON FUNCTION public.paciente_visualizar_consulta(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_visualizar_consulta(uuid) TO authenticated;

-- ── 3. RPC: paciente confirma presença ou solicita remarcação ─

CREATE OR REPLACE FUNCTION public.paciente_confirmar_consulta(
  p_consulta_id              uuid,
  p_resposta                 text,     -- 'confirmada' | 'remarcacao_solicitada'
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
  -- Valida o valor da resposta (paciente não pode voltar para 'pendente')
  IF p_resposta NOT IN ('confirmada','remarcacao_solicitada') THEN
    RAISE EXCEPTION 'Valor inválido: %', p_resposta;
  END IF;

  -- Busca a consulta verificando posse e estado
  SELECT data_hora INTO v_data_hora
  FROM public.consultas
  WHERE id          = p_consulta_id
    AND paciente_id = auth.uid()
    AND status NOT IN ('cancelada','realizada');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta não encontrada ou não disponível para alteração.';
  END IF;

  -- Regra contratual das 24h (aplica em qualquer remarcação)
  IF p_resposta = 'remarcacao_solicitada'
     AND v_data_hora - now() < interval '24 hours' THEN
    RAISE EXCEPTION 'Remarcações pelo app ficam disponíveis até 24h antes da consulta.';
  END IF;

  -- Validação da janela de 7 dias
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

  UPDATE public.consultas
  SET
    resposta_paciente        = p_resposta,
    respondido_em            = now(),
    obs_remarcacao           = CASE
                                 WHEN p_resposta = 'remarcacao_solicitada' THEN p_obs_remarcacao
                                 ELSE NULL
                               END,
    sugestao_remarcacao_data = CASE
                                 WHEN p_resposta = 'remarcacao_solicitada' THEN p_sugestao_remarcacao_data
                                 ELSE NULL
                               END
  WHERE id          = p_consulta_id
    AND paciente_id = auth.uid();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.paciente_confirmar_consulta(uuid, text, text, date) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_confirmar_consulta(uuid, text, text, date) TO authenticated;
