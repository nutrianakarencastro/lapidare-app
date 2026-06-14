-- =============================================================
-- Sprint Jornada 2.C — RPC nutri_encerrar_fase
-- =============================================================
-- Substitui as 3 operações sequenciais do frontend por uma única
-- transação atômica no banco, eliminando risco de estado inconsistente.
--
-- Fluxo interno:
--   1. Busca e bloqueia a linha em jornadas (FOR UPDATE)
--   2. Insere snapshot em jornada_historico com o fase_uuid atual
--   3a. Se p_iniciar_nova = true:  UPDATE em jornadas com novo fase_uuid
--   3b. Se p_iniciar_nova = false: DELETE em jornadas (encerra acompanhamento)
--
-- Retorna jsonb:
--   { fase_uuid_encerrada, nova_fase_uuid? }
--
-- Idempotente: CREATE OR REPLACE.
-- =============================================================

CREATE OR REPLACE FUNCTION public.nutri_encerrar_fase(
  p_jornada_id          uuid,
  p_iniciar_nova        boolean,
  p_objetivo_fase       text    DEFAULT NULL,
  p_evolucao_resumida   text    DEFAULT NULL,
  p_observacoes         text    DEFAULT NULL,
  p_metas_semana        jsonb   DEFAULT '[]'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jornada        jornadas%ROWTYPE;
  v_hoje           date := current_date;
  v_semanas        integer;
  v_novo_fase_uuid uuid := gen_random_uuid();
BEGIN
  -- Buscar e bloquear a linha durante a transação
  SELECT * INTO v_jornada
  FROM   public.jornadas
  WHERE  id       = p_jornada_id
    AND  nutri_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada não encontrada ou sem permissão.';
  END IF;

  -- Calcular semanas cumpridas (mínimo 1)
  v_semanas := GREATEST(1, CEIL(
    (v_hoje - v_jornada.data_inicio_fase)::numeric / 7
  ));

  -- Arquivar fase atual no histórico (preserva fase_uuid da fase que encerra)
  INSERT INTO public.jornada_historico (
    paciente_id,
    nutri_id,
    fase,
    nome_fase,
    objetivo_fase,
    data_inicio_fase,
    data_fim_fase,
    semanas_cumpridas,
    consulta_numero,
    metas_semana,
    evolucao_resumida,
    observacoes,
    fase_uuid,
    arquivado_em
  ) VALUES (
    v_jornada.paciente_id,
    v_jornada.nutri_id,
    v_jornada.fase,
    v_jornada.nome_fase,
    COALESCE(p_objetivo_fase,     v_jornada.objetivo_fase),
    v_jornada.data_inicio_fase,
    v_hoje,
    v_semanas,
    v_jornada.consulta_numero,
    COALESCE(p_metas_semana,      v_jornada.metas_semana),
    COALESCE(p_evolucao_resumida, v_jornada.evolucao_resumida),
    COALESCE(p_observacoes,       v_jornada.observacoes),
    v_jornada.fase_uuid,
    now()
  );

  IF p_iniciar_nova THEN
    -- Avançar para nova fase com UUID novo
    UPDATE public.jornadas SET
      fase_uuid                = v_novo_fase_uuid,
      fase                     = v_jornada.fase + 1,
      nome_fase                = 'Fase ' || (v_jornada.fase + 1),
      objetivo_fase            = NULL,
      consulta_numero          = NULL,
      data_inicio_fase         = v_hoje,
      duracao_semanas_prevista = 4,
      metas_semana             = '[]',
      proximo_marco            = NULL,
      data_proximo_marco       = NULL,
      evolucao_resumida        = NULL,
      observacoes              = NULL,
      updated_at               = now()
    WHERE id = p_jornada_id;

    RETURN jsonb_build_object(
      'fase_uuid_encerrada', v_jornada.fase_uuid,
      'nova_fase_uuid',      v_novo_fase_uuid
    );
  ELSE
    -- Encerrar acompanhamento: remove a fase ativa
    DELETE FROM public.jornadas WHERE id = p_jornada_id;

    RETURN jsonb_build_object(
      'fase_uuid_encerrada', v_jornada.fase_uuid
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nutri_encerrar_fase(uuid, boolean, text, text, text, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.nutri_encerrar_fase(uuid, boolean, text, text, text, jsonb) TO authenticated;
