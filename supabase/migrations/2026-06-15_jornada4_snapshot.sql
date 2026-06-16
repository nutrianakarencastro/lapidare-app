-- =============================================================
-- Sprint Jornada 4 — Snapshot da Fase
--
-- Responde: "O que aconteceu?"
-- Dados factuais capturados atomicamente no encerramento da fase.
-- Imutáveis após inserção em jornada_historico.
--
-- Mudanças:
--   1. jornada_historico: coluna snapshot_clinico jsonb NULL
--   2. nutri_encerrar_fase(): coleta de dados + montagem do snapshot
--
-- O que NÃO muda:
--   • schema das demais tabelas
--   • assinatura da RPC (nenhum parâmetro novo)
--   • RLS
--   • modal de encerramento no frontend
--   • fases históricas (snapshot_clinico = NULL — sem backfill)
-- =============================================================


-- ── 1. Coluna em jornada_historico ───────────────────────────

ALTER TABLE public.jornada_historico
  ADD COLUMN IF NOT EXISTS snapshot_clinico jsonb NULL;


-- ── 2. RPC nutri_encerrar_fase — CREATE OR REPLACE ───────────
--
-- Assinatura inalterada.
-- Expansão interna: 7 SELECTs de coleta + montagem jsonb
-- + INSERT expandido com snapshot_clinico.
-- Todas as queries de coleta ocorrem dentro da transação
-- que já possui FOR UPDATE em jornadas.
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
  -- existentes (sem alteração)
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

  -- novas (Jornada 4)
  v_dias_fase              integer;
  v_peso_inicio_kg         numeric;
  v_peso_inicio_data       date;
  v_peso_fim_kg            numeric;
  v_peso_fim_data          date;
  v_conduta_titulo         text;
  v_conduta_objetivo       text;
  v_conduta_data           date;
  v_protocolos_json        jsonb;
  v_estr_ativas            integer;
  v_estr_encerradas        integer;
  v_aderencia_pct          numeric;
  v_checkins_enviados      integer;
  v_checkins_respondidos   integer;
  v_snapshot               jsonb;
BEGIN
  -- Buscar e bloquear a linha: SELECT coluna a coluna, sem %ROWTYPE
  SELECT paciente_id,    nutri_id,       fase,           nome_fase,
         objetivo_fase,  data_inicio_fase, consulta_numero, metas_semana,
         evolucao_resumida, observacoes,  fase_uuid
  INTO   v_paciente_id, v_nutri_id,     v_fase,         v_nome_fase,
         v_obj_fase,    v_data_inicio,   v_consulta_nr,  v_metas,
         v_evolucao,    v_obs,           v_fase_uuid
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

  -- ── Coleta de dados para snapshot ────────────────────────────────────────

  -- 4.1 dias da fase
  v_dias_fase := (v_hoje - v_data_inicio);

  -- 4.2 peso no início da fase
  --     registro mais recente anterior ou igual ao início da fase
  SELECT kg, data
  INTO   v_peso_inicio_kg, v_peso_inicio_data
  FROM   public.peso_registros
  WHERE  paciente_id = v_paciente_id
    AND  data        <= v_data_inicio
  ORDER  BY data DESC
  LIMIT  1;

  -- 4.3 peso no fim da fase
  --     registro mais recente até o dia do encerramento
  SELECT kg, data
  INTO   v_peso_fim_kg, v_peso_fim_data
  FROM   public.peso_registros
  WHERE  paciente_id = v_paciente_id
    AND  data        <= v_hoje
  ORDER  BY data DESC
  LIMIT  1;

  -- 4.4 conduta vigente na abertura da fase
  --     conduta mais recente com data <= inicio da fase
  SELECT titulo, objetivo_principal, data
  INTO   v_conduta_titulo, v_conduta_objetivo, v_conduta_data
  FROM   public.condutas
  WHERE  paciente_id = v_paciente_id
    AND  nutri_id    = v_nutri_id
    AND  data        <= v_data_inicio
  ORDER  BY data DESC
  LIMIT  1;

  -- 4.5 protocolos ativos no encerramento
  SELECT jsonb_agg(jsonb_build_object('id', protocolo_id))
  INTO   v_protocolos_json
  FROM   public.paciente_protocolos
  WHERE  paciente_id = v_paciente_id
    AND  status      = 'ativo';

  -- 4.6 estratégias: contagem por status (vinculadas a esta fase)
  SELECT
    COUNT(*) FILTER (WHERE status = 'ativa')     AS n_ativas,
    COUNT(*) FILTER (WHERE status = 'encerrada') AS n_encerradas
  INTO v_estr_ativas, v_estr_encerradas
  FROM public.estrategias
  WHERE paciente_id      = v_paciente_id
    AND nutri_id         = v_nutri_id
    AND fase_uuid_origem = v_fase_uuid;

  -- 4.6b aderência média das estratégias da fase
  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN NULL
      ELSE ROUND(
        100.0 * COUNT(*) FILTER (WHERE el.aconteceu = 'sim') / COUNT(*)
      )
    END
  INTO v_aderencia_pct
  FROM public.estrategia_logs el
  JOIN public.estrategias     e  ON e.id = el.estrategia_id
  WHERE e.paciente_id      = v_paciente_id
    AND e.nutri_id         = v_nutri_id
    AND e.fase_uuid_origem = v_fase_uuid
    AND el.data BETWEEN v_data_inicio AND v_hoje;

  -- 4.7 check-ins no período da fase
  SELECT
    COUNT(*)                                          AS enviados,
    COUNT(*) FILTER (WHERE respondido_em IS NOT NULL) AS respondidos
  INTO v_checkins_enviados, v_checkins_respondidos
  FROM public.checkin_envios
  WHERE paciente_id  = v_paciente_id
    AND enviado_em  >= v_data_inicio::timestamptz
    AND enviado_em  <  (v_hoje + 1)::timestamptz;

  -- ── Montagem do snapshot ─────────────────────────────────────────────────

  -- base sempre presente
  v_snapshot := jsonb_build_object(
    'dias_da_fase', v_dias_fase,
    'protocolos',   COALESCE(v_protocolos_json, '[]'::jsonb),
    'estrategias',  jsonb_build_object(
      'ativas',              COALESCE(v_estr_ativas,    0),
      'encerradas',          COALESCE(v_estr_encerradas, 0),
      'aderencia_media_pct', v_aderencia_pct
    ),
    'checkins', jsonb_build_object(
      'enviados',    COALESCE(v_checkins_enviados,    0),
      'respondidos', COALESCE(v_checkins_respondidos, 0)
    )
  );

  -- peso: incluído somente se ao menos o registro de fim existe
  IF v_peso_fim_kg IS NOT NULL THEN
    v_snapshot := v_snapshot || jsonb_build_object(
      'peso', jsonb_build_object(
        'inicio_kg',   v_peso_inicio_kg,
        'inicio_data', v_peso_inicio_data,
        'fim_kg',      v_peso_fim_kg,
        'fim_data',    v_peso_fim_data
      )
    );
  END IF;

  -- conduta: incluída somente se encontrada
  IF v_conduta_titulo IS NOT NULL THEN
    v_snapshot := v_snapshot || jsonb_build_object(
      'conduta', jsonb_build_object(
        'titulo',             v_conduta_titulo,
        'objetivo_principal', v_conduta_objetivo,
        'data',               v_conduta_data
      )
    );
  END IF;

  -- ── Arquivar fase atual no histórico ─────────────────────────────────────

  INSERT INTO public.jornada_historico (
    paciente_id,       nutri_id,
    fase,              nome_fase,         objetivo_fase,
    data_inicio_fase,  data_fim_fase,     semanas_cumpridas,
    consulta_numero,   metas_semana,
    evolucao_resumida, observacoes,
    fase_uuid,         arquivado_em,
    snapshot_clinico
  ) VALUES (
    v_paciente_id,     v_nutri_id,
    v_fase,            v_nome_fase,       COALESCE(p_objetivo_fase,     v_obj_fase),
    v_data_inicio,     v_hoje,            v_semanas,
    v_consulta_nr,     COALESCE(p_metas_semana,      v_metas),
    COALESCE(p_evolucao_resumida, v_evolucao),
    COALESCE(p_observacoes,       v_obs),
    v_fase_uuid,       now(),
    v_snapshot
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
