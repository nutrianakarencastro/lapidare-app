-- =============================================================
-- B.5.1 — Correções críticas de RLS e RPCs (go-live)
-- =============================================================
-- Premissa arquitetural aprovada em B.4:
--   PACIENTE = entidade clínica  (pacientes.id)
--   APP      = ferramenta de acesso (pacientes.auth_user_id = auth.uid())
--
-- Todas as referências clínicas usam meu_paciente_id()
-- (função SECURITY DEFINER de B.2) em vez de auth.uid().
--
-- Compatibilidade total com pacientes antigas:
--   auth_user_id = id (backfill de B.1)
--   → meu_paciente_id() retorna o mesmo id = auth.uid()
-- =============================================================


-- =============================================================
-- BLOCO 1 — Policies em public.pacientes
-- =============================================================

-- ── 1.1 pacientes_select ─────────────────────────────────────
-- Adiciona auth_user_id = auth.uid() para permitir que a paciente
-- nova enxergue sua própria linha (id ≠ auth.uid() nas novas).
-- Sem isso: session.jsx retorna role=null e login é impossível.

DROP POLICY IF EXISTS pacientes_select ON public.pacientes;
CREATE POLICY pacientes_select ON public.pacientes
  FOR SELECT USING (
    id             = auth.uid()    -- paciente antiga (retro-compatibilidade)
    OR auth_user_id = auth.uid()   -- paciente nova
    OR nutri_id    = auth.uid()    -- nutri dona
  );

-- ── 1.2 pacientes_update_self ─────────────────────────────────
-- Troca id = auth.uid() por auth_user_id = auth.uid().
-- Necessária para aceite do termo LGPD via TermoConsentimento.jsx
-- (que já usa profile.id no frontend após B.4).

DROP POLICY IF EXISTS pacientes_update_self ON public.pacientes;
CREATE POLICY pacientes_update_self ON public.pacientes
  FOR UPDATE
  USING    (auth_user_id = auth.uid())
  WITH CHECK (auth_user_id = auth.uid());


-- =============================================================
-- BLOCO 2 — RPCs: auth.uid() → meu_paciente_id()
-- =============================================================

-- ── 2.1 get_orientacoes_da_paciente() ────────────────────────

CREATE OR REPLACE FUNCTION public.get_orientacoes_da_paciente()
RETURNS TABLE (
  atribuicao_id          uuid,
  status                 text,
  visto_pela_paciente_em timestamptz,
  atribuido_em           timestamptz,
  orientacao_id          uuid,
  titulo                 text,
  descricao              text,
  categoria              text,
  subcategoria           text,
  tags                   text[],
  thumbnail_path         text,
  thumbnail_nome         text,
  pdf_path               text,
  pdf_nome               text,
  video_url              text,
  audio_path             text,
  audio_nome             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    op.id                    AS atribuicao_id,
    op.status,
    op.visto_pela_paciente_em,
    op.atribuido_em,
    op.orientacao_id,
    o.titulo,
    o.descricao,
    o.categoria,
    o.subcategoria,
    o.tags,
    o.thumbnail_path,
    o.thumbnail_nome,
    o.pdf_path,
    o.pdf_nome,
    o.video_url,
    o.audio_path,
    o.audio_nome
  FROM public.orientacoes_pacientes op
  JOIN public.orientacoes o ON o.id = op.orientacao_id
  WHERE op.paciente_id = meu_paciente_id()
  ORDER BY op.atribuido_em DESC;
END;
$$;


-- ── 2.2 marcar_orientacao_vista() ────────────────────────────

CREATE OR REPLACE FUNCTION public.marcar_orientacao_vista(p_atribuicao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orientacoes_pacientes
  SET status                 = 'visualizada',
      visto_pela_paciente_em = COALESCE(visto_pela_paciente_em, now())
  WHERE id          = p_atribuicao_id
    AND paciente_id = meu_paciente_id()
    AND status      = 'nao_visualizada';
END;
$$;


-- ── 2.3 marcar_orientacao_concluida() ────────────────────────

CREATE OR REPLACE FUNCTION public.marcar_orientacao_concluida(
  p_atribuicao_id uuid,
  p_concluida     boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orientacoes_pacientes
  SET status = CASE WHEN p_concluida THEN 'concluida' ELSE 'visualizada' END
  WHERE id          = p_atribuicao_id
    AND paciente_id = meu_paciente_id();
END;
$$;


-- ── 2.4 marcar_exame_visto() ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.marcar_exame_visto(p_avaliacao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.exames_avaliacoes
  SET visto_pela_paciente_em = now()
  WHERE id          = p_avaliacao_id
    AND paciente_id = meu_paciente_id();
END;
$$;


-- ── 2.5 paciente_marcar_meta() ───────────────────────────────

CREATE OR REPLACE FUNCTION public.paciente_marcar_meta(p_metas jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jornadas
  SET    metas_semana = p_metas,
         updated_at   = now()
  WHERE  paciente_id = meu_paciente_id();
END;
$$;


-- ── 2.6 paciente_visualizar_consulta() ───────────────────────

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
    AND paciente_id = meu_paciente_id()
    AND visualizado_em IS NULL;
END;
$$;


-- ── 2.7 paciente_confirmar_consulta() ────────────────────────

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
  IF p_resposta NOT IN ('confirmada','remarcacao_solicitada') THEN
    RAISE EXCEPTION 'Valor inválido: %', p_resposta;
  END IF;

  SELECT data_hora INTO v_data_hora
  FROM public.consultas
  WHERE id          = p_consulta_id
    AND paciente_id = meu_paciente_id()
    AND status NOT IN ('cancelada','realizada');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta não encontrada ou não disponível para alteração.';
  END IF;

  IF p_resposta = 'remarcacao_solicitada'
     AND v_data_hora - now() < interval '24 hours' THEN
    RAISE EXCEPTION 'Remarcações pelo app ficam disponíveis até 24h antes da consulta.';
  END IF;

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
    AND paciente_id = meu_paciente_id();
END;
$$;

-- Reaplica grants (idempotente — funções existentes já têm, novas precisam)
REVOKE EXECUTE ON FUNCTION public.paciente_confirmar_consulta(uuid, text, text, date) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_confirmar_consulta(uuid, text, text, date) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.paciente_visualizar_consulta(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_visualizar_consulta(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.paciente_marcar_meta(jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_marcar_meta(jsonb) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.marcar_exame_visto(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.marcar_exame_visto(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.marcar_orientacao_concluida(uuid, boolean) FROM public;
GRANT  EXECUTE ON FUNCTION public.marcar_orientacao_concluida(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.marcar_orientacao_vista(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.marcar_orientacao_vista(uuid) TO authenticated;

GRANT  EXECUTE ON FUNCTION public.get_orientacoes_da_paciente() TO authenticated;
