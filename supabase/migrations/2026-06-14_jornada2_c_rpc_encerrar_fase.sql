-- =============================================================
-- Sprint Jornada 2.C — RPC nutri_encerrar_fase
-- =============================================================
-- Substitui as 3 operações sequenciais do frontend por uma única
-- transação atômica no banco, eliminando risco de estado inconsistente.
--
-- Versão corretiva: sem %ROWTYPE.
-- Variáveis escalares explícitas eliminam o risco de plano de tipo
-- composto desatualizado em ambientes com connection pooling (PgBouncer).
--
-- Fluxo interno:
--   1. SELECT coluna a coluna — sem %ROWTYPE — com FOR UPDATE
--   2. INSERT em jornada_historico com v_fase_uuid explícito
--   3a. Se p_iniciar_nova = true:  UPDATE em jornadas com novo UUID
--   3b. Se p_iniciar_nova = false: DELETE em jornadas
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
  v_paciente_id  uuid;
  v_nutri_id     uuid;
  v_fase         integer;
  v_nome_fase    text;
  v_obj_fase     text;
  v_data_inicio  date;
  v_consulta_nr  integer;
  v_metas        jsonb;
  v_evolucao     text;
  v_obs          text;
  v_fase_uuid    uuid;
  v_hoje         date := current_date;
  v_semanas      integer;
  v_novo_uuid    uuid := gen_random_uuid();
BEGIN
  -- Buscar e bloquear a linha: SELECT coluna a coluna, sem %ROWTYPE
  SELECT paciente_id,   nutri_id,      fase,          nome_fase,
         objetivo_fase, data_inicio_fase, consulta_numero, metas_semana,
         evolucao_resumida, observacoes, fase_uuid
  INTO   v_paciente_id, v_nutri_id,   v_fase,        v_nome_fase,
         v_obj_fase,    v_data_inicio, v_consulta_nr, v_metas,
         v_evolucao,    v_obs,         v_fase_uuid
  FROM   public.jornadas
  WHERE  id       = p_jornada_id
    AND  nutri_id = auth.uid()
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada não encontrada ou sem permissão.';
  END IF;

  -- Calcular semanas cumpridas (mínimo 1)
  v_semanas := GREATEST(1, CEIL(
    (v_hoje - v_data_inicio)::numeric / 7
  ));

  -- Arquivar fase atual no histórico
  INSERT INTO public.jornada_historico (
    paciente_id,       nutri_id,
    fase,              nome_fase,         objetivo_fase,
    data_inicio_fase,  data_fim_fase,     semanas_cumpridas,
    consulta_numero,   metas_semana,
    evolucao_resumida, observacoes,
    fase_uuid,         arquivado_em
  ) VALUES (
    v_paciente_id,     v_nutri_id,
    v_fase,            v_nome_fase,       COALESCE(p_objetivo_fase,     v_obj_fase),
    v_data_inicio,     v_hoje,            v_semanas,
    v_consulta_nr,     COALESCE(p_metas_semana,      v_metas),
    COALESCE(p_evolucao_resumida, v_evolucao),
    COALESCE(p_observacoes,       v_obs),
    v_fase_uuid,       now()
  );

  IF p_iniciar_nova THEN
    UPDATE public.jornadas SET
      fase_uuid                = v_novo_uuid,
      fase                     = v_fase + 1,
      nome_fase                = 'Fase ' || (v_fase + 1),
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
      'fase_uuid_encerrada', v_fase_uuid,
      'nova_fase_uuid',      v_novo_uuid
    );
  ELSE
    DELETE FROM public.jornadas WHERE id = p_jornada_id;

    RETURN jsonb_build_object(
      'fase_uuid_encerrada', v_fase_uuid
    );
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.nutri_encerrar_fase(uuid, boolean, text, text, text, jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.nutri_encerrar_fase(uuid, boolean, text, text, text, jsonb) TO authenticated;
