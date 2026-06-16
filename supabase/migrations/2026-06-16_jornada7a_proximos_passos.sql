-- =============================================================
-- Sprint Jornada 7A — Sugestões Automáticas de Próximos Passos
--
-- Responde: "O que fazer a seguir?"
--
-- Arquitetura:
--   • motor de regras clínicas auditável (STABLE)
--   • zero IA generativa
--   • proximos_passos_sugeridos jsonb NULL em jornada_historico
--   • gerado atomicamente dentro de nutri_encerrar_fase()
--   • sem interface nesta sprint (Jornada 7B)
--   • snapshot_clinico, fase_metricas e narrativa intocados
--   • assinatura de nutri_encerrar_fase() inalterada
--
-- Estrutura do array retornado:
--   [{ "codigo": text, "titulo": text, "prioridade": text }, ...]
--   prioridade: 'alta' | 'moderada' | 'baixa'
--   ordenação: alta → moderada → baixa
--
-- Mudanças nesta migration:
--   1. jornada_historico: ADD COLUMN proximos_passos_sugeridos jsonb NULL
--   2. nutri_gerar_proximos_passos(): motor de regras (STABLE)
--   3. nutri_encerrar_fase(): +v_proximos_passos, chamada ao motor,
--      INSERT expandido com proximos_passos_sugeridos
-- =============================================================


-- ── 1. Coluna em jornada_historico ───────────────────────────

ALTER TABLE public.jornada_historico
  ADD COLUMN IF NOT EXISTS proximos_passos_sugeridos jsonb NULL;


-- ── 2. Motor de sugestões: nutri_gerar_proximos_passos() ─────
--
-- STABLE: consistente na transação; permite evolução futura
-- para leitura de configurações no banco sem mudar a volatility.
--
-- Parâmetros:
--   p_aderencia_pct   — null quando não há logs de estratégia
--   p_peso_delta_kg   — null quando não há peso registrado
--   p_checkins_taxa   — null quando nenhum check-in foi enviado
--   p_checkins_env    — 0 quando nenhum enviado
--   p_tinha_conduta   — true se havia conduta com data <= data_inicio_fase
--   p_n_protocolos    — total de protocolos ativos no encerramento
--   p_estr_ativas     — estratégias com status='ativa' e fase_uuid_origem
--   p_estr_encerradas — estratégias com status='encerrada' e fase_uuid_origem
--
-- Retorna jsonb array ordenado por prioridade (alta → moderada → baixa).
-- Array vazio ([]) quando nenhuma regra dispara.
-- =============================================================

CREATE OR REPLACE FUNCTION public.nutri_gerar_proximos_passos(
  p_aderencia_pct   numeric,
  p_peso_delta_kg   numeric,
  p_checkins_taxa   numeric,
  p_checkins_env    integer,
  p_tinha_conduta   boolean,
  p_n_protocolos    integer,
  p_estr_ativas     integer,
  p_estr_encerradas integer
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  -- Três buckets por prioridade — garantem ordenação sem sort posterior
  v_alta     jsonb := '[]'::jsonb;
  v_moderada jsonb := '[]'::jsonb;
  v_baixa    jsonb := '[]'::jsonb;
BEGIN

  -- ── ADERÊNCIA: baixa (< 40%) ─────────────────────────────────
  IF p_aderencia_pct IS NOT NULL AND p_aderencia_pct < 40 THEN
    v_alta := v_alta || jsonb_build_array(jsonb_build_object(
      'codigo',    'REVISAR_ESTRATEGIAS',
      'titulo',    'Revisar e simplificar estratégias da próxima fase',
      'prioridade','alta'
    ));
    v_alta := v_alta || jsonb_build_array(jsonb_build_object(
      'codigo',    'INVESTIGAR_BARREIRAS',
      'titulo',    'Investigar barreiras à adesão antes de definir novas metas',
      'prioridade','alta'
    ));

  -- ── ADERÊNCIA: moderada (40–69%) ─────────────────────────────
  ELSIF p_aderencia_pct IS NOT NULL AND p_aderencia_pct < 70 THEN
    v_moderada := v_moderada || jsonb_build_array(jsonb_build_object(
      'codigo',    'REFORCAR_ESTRATEGIAS',
      'titulo',    'Reforçar estratégias de maior impacto e reduzir volume',
      'prioridade','moderada'
    ));
  END IF;

  -- ── PESO: aumento com aderência alta ─────────────────────────
  IF  p_peso_delta_kg IS NOT NULL AND p_peso_delta_kg > 0.5
  AND p_aderencia_pct IS NOT NULL AND p_aderencia_pct >= 70 THEN
    v_alta := v_alta || jsonb_build_array(jsonb_build_object(
      'codigo',    'INVESTIGAR_METABOLICO',
      'titulo',    'Investigar fatores metabólicos, hormonais ou de composição corporal',
      'prioridade','alta'
    ));

  -- ── PESO: aumento com aderência moderada ─────────────────────
  ELSIF p_peso_delta_kg IS NOT NULL AND p_peso_delta_kg > 0.5
    AND p_aderencia_pct IS NOT NULL
    AND p_aderencia_pct >= 40 AND p_aderencia_pct < 70 THEN
    v_alta := v_alta || jsonb_build_array(jsonb_build_object(
      'codigo',    'AJUSTAR_CONDUTA_NUTRICIONAL',
      'titulo',    'Ajustar conduta nutricional — adesão parcial com ganho de peso',
      'prioridade','alta'
    ));
  END IF;

  -- ── RESULTADO ALINHADO (alta aderência + perda de peso) ──────
  IF  p_aderencia_pct IS NOT NULL AND p_aderencia_pct >= 70
  AND p_peso_delta_kg IS NOT NULL AND p_peso_delta_kg <= -0.5 THEN
    v_baixa := v_baixa || jsonb_build_array(jsonb_build_object(
      'codigo',    'MANTER_CONSISTENCIA',
      'titulo',    'Manter consistência — resultado alinhado com adesão',
      'prioridade','baixa'
    ));
  END IF;

  -- ── ENGAJAMENTO: sem check-ins enviados ──────────────────────
  IF COALESCE(p_checkins_env, 0) = 0 THEN
    v_moderada := v_moderada || jsonb_build_array(jsonb_build_object(
      'codigo',    'IMPLEMENTAR_CHECKINS',
      'titulo',    'Implementar check-ins na próxima fase para monitoramento contínuo',
      'prioridade','moderada'
    ));

  -- ── ENGAJAMENTO: check-ins com baixa resposta (< 50%) ────────
  ELSIF p_checkins_taxa IS NOT NULL AND p_checkins_taxa < 50 THEN
    v_moderada := v_moderada || jsonb_build_array(jsonb_build_object(
      'codigo',    'AUMENTAR_ENGAJAMENTO',
      'titulo',    'Estimular registro periódico — revisar frequência de check-ins',
      'prioridade','moderada'
    ));
  END IF;

  -- ── SEM CONDUTA registrada ────────────────────────────────────
  IF NOT COALESCE(p_tinha_conduta, false) THEN
    v_moderada := v_moderada || jsonb_build_array(jsonb_build_object(
      'codigo',    'REGISTRAR_CONDUTA',
      'titulo',    'Registrar conduta clínica formal para a próxima fase',
      'prioridade','moderada'
    ));
  END IF;

  -- ── ESTRATÉGIAS: acúmulo (≥ 3 ativas) ────────────────────────
  IF COALESCE(p_estr_ativas, 0) >= 3 THEN
    v_baixa := v_baixa || jsonb_build_array(jsonb_build_object(
      'codigo',    'CONSOLIDAR_ESTRATEGIAS',
      'titulo',    'Consolidar ou encerrar estratégias ativas antes de criar novas',
      'prioridade','baixa'
    ));
  END IF;

  -- ── ESTRATÉGIAS: nenhuma vinculada à fase ────────────────────
  IF COALESCE(p_estr_ativas, 0) = 0 AND COALESCE(p_estr_encerradas, 0) = 0 THEN
    v_baixa := v_baixa || jsonb_build_array(jsonb_build_object(
      'codigo',    'DEFINIR_ESTRATEGIA',
      'titulo',    'Definir ao menos uma estratégia para a próxima fase',
      'prioridade','baixa'
    ));
  END IF;

  -- ── Resultado: alta → moderada → baixa ───────────────────────
  RETURN v_alta || v_moderada || v_baixa;

END;
$$;

GRANT EXECUTE ON FUNCTION public.nutri_gerar_proximos_passos(
  numeric, numeric, numeric, integer, boolean, integer, integer, integer
) TO authenticated;


-- ── 3. RPC nutri_encerrar_fase — CREATE OR REPLACE ───────────
--
-- Assinatura inalterada.
-- Mudanças internas (Jornada 7A):
--   + DECLARE v_proximos_passos jsonb
--   + chamada a nutri_gerar_proximos_passos() após v_narrativa
--   + INSERT em jornada_historico expandido com proximos_passos_sugeridos
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
  -- existentes — Jornada 2 (sem alteração)
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

  -- existentes — Jornada 4 (sem alteração)
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

  -- existentes — Jornada 5 (sem alteração)
  v_hist_id                uuid;

  -- existentes — Jornada 6A (sem alteração)
  v_narrativa              text;

  -- novo — Jornada 7A
  v_proximos_passos        jsonb;
BEGIN
  -- ── Buscar e bloquear: sem %ROWTYPE (PgBouncer-safe) ─────────
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

  -- ── Temporalidade ─────────────────────────────────────────────
  v_semanas   := GREATEST(1, CEIL((v_hoje - v_data_inicio)::numeric / 7));
  v_dias_fase := (v_hoje - v_data_inicio);

  -- ── Coleta de dados para snapshot (Jornada 4) ────────────────

  SELECT kg, data
  INTO   v_peso_inicio_kg, v_peso_inicio_data
  FROM   public.peso_registros
  WHERE  paciente_id = v_paciente_id
    AND  data        <= v_data_inicio
  ORDER  BY data DESC LIMIT 1;

  SELECT kg, data
  INTO   v_peso_fim_kg, v_peso_fim_data
  FROM   public.peso_registros
  WHERE  paciente_id = v_paciente_id
    AND  data        <= v_hoje
  ORDER  BY data DESC LIMIT 1;

  SELECT titulo, objetivo_principal, data
  INTO   v_conduta_titulo, v_conduta_objetivo, v_conduta_data
  FROM   public.condutas
  WHERE  paciente_id = v_paciente_id
    AND  nutri_id    = v_nutri_id
    AND  data        <= v_data_inicio
  ORDER  BY data DESC LIMIT 1;

  SELECT jsonb_agg(jsonb_build_object('id', protocolo_id))
  INTO   v_protocolos_json
  FROM   public.paciente_protocolos
  WHERE  paciente_id = v_paciente_id
    AND  status      = 'ativo';

  SELECT
    COUNT(*) FILTER (WHERE status = 'ativa'),
    COUNT(*) FILTER (WHERE status = 'encerrada')
  INTO v_estr_ativas, v_estr_encerradas
  FROM public.estrategias
  WHERE paciente_id      = v_paciente_id
    AND nutri_id         = v_nutri_id
    AND fase_uuid_origem = v_fase_uuid;

  SELECT
    CASE
      WHEN COUNT(*) = 0 THEN NULL
      ELSE ROUND(100.0 * COUNT(*) FILTER (WHERE el.aconteceu = 'sim') / COUNT(*))
    END
  INTO v_aderencia_pct
  FROM public.estrategia_logs el
  JOIN public.estrategias     e  ON e.id = el.estrategia_id
  WHERE e.paciente_id      = v_paciente_id
    AND e.nutri_id         = v_nutri_id
    AND e.fase_uuid_origem = v_fase_uuid
    AND el.data BETWEEN v_data_inicio AND v_hoje;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE respondido_em IS NOT NULL)
  INTO v_checkins_enviados, v_checkins_respondidos
  FROM public.checkin_envios
  WHERE paciente_id  = v_paciente_id
    AND enviado_em  >= v_data_inicio::timestamptz
    AND enviado_em  <  (v_hoje + 1)::timestamptz;

  -- ── Montagem do snapshot (Jornada 4) ─────────────────────────
  v_snapshot := jsonb_build_object(
    'dias_da_fase', v_dias_fase,
    'protocolos',   COALESCE(v_protocolos_json, '[]'::jsonb),
    'estrategias',  jsonb_build_object(
      'ativas',              COALESCE(v_estr_ativas,     0),
      'encerradas',          COALESCE(v_estr_encerradas, 0),
      'aderencia_media_pct', v_aderencia_pct
    ),
    'checkins', jsonb_build_object(
      'enviados',    COALESCE(v_checkins_enviados,    0),
      'respondidos', COALESCE(v_checkins_respondidos, 0)
    )
  );

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

  IF v_conduta_titulo IS NOT NULL THEN
    v_snapshot := v_snapshot || jsonb_build_object(
      'conduta', jsonb_build_object(
        'titulo',             v_conduta_titulo,
        'objetivo_principal', v_conduta_objetivo,
        'data',               v_conduta_data
      )
    );
  END IF;

  -- ── Narrativa automática (Jornada 6A) ────────────────────────
  v_narrativa := nutri_gerar_narrativa_fase(
    v_aderencia_pct,
    CASE WHEN v_peso_inicio_kg IS NOT NULL AND v_peso_fim_kg IS NOT NULL
         THEN ROUND((v_peso_fim_kg - v_peso_inicio_kg)::numeric, 1)
         END,
    v_peso_inicio_kg,
    v_peso_fim_kg,
    CASE WHEN COALESCE(v_checkins_enviados, 0) > 0
         THEN ROUND(100.0 * COALESCE(v_checkins_respondidos, 0) / v_checkins_enviados)
         END,
    COALESCE(v_checkins_enviados, 0),
    COALESCE(v_estr_ativas, 0) + COALESCE(v_estr_encerradas, 0),
    v_dias_fase,
    v_semanas
  );

  -- ── Próximos passos sugeridos (Jornada 7A) ───────────────────
  --    Chamada ao motor com variáveis já no escopo.
  --    Zero novos SELECTs.
  v_proximos_passos := nutri_gerar_proximos_passos(
    v_aderencia_pct,
    CASE WHEN v_peso_inicio_kg IS NOT NULL AND v_peso_fim_kg IS NOT NULL
         THEN ROUND((v_peso_fim_kg - v_peso_inicio_kg)::numeric, 1)
         END,
    CASE WHEN COALESCE(v_checkins_enviados, 0) > 0
         THEN ROUND(100.0 * COALESCE(v_checkins_respondidos, 0) / v_checkins_enviados)
         END,
    COALESCE(v_checkins_enviados, 0),
    (v_conduta_titulo IS NOT NULL),
    jsonb_array_length(COALESCE(v_protocolos_json, '[]'::jsonb)),
    COALESCE(v_estr_ativas,     0),
    COALESCE(v_estr_encerradas, 0)
  );

  -- ── Arquivar no histórico ─────────────────────────────────────
  INSERT INTO public.jornada_historico (
    paciente_id,       nutri_id,
    fase,              nome_fase,         objetivo_fase,
    data_inicio_fase,  data_fim_fase,     semanas_cumpridas,
    consulta_numero,   metas_semana,
    evolucao_resumida, observacoes,
    fase_uuid,         arquivado_em,
    snapshot_clinico,
    narrativa_automatica,
    proximos_passos_sugeridos
  ) VALUES (
    v_paciente_id,     v_nutri_id,
    v_fase,            v_nome_fase,       COALESCE(p_objetivo_fase,     v_obj_fase),
    v_data_inicio,     v_hoje,            v_semanas,
    v_consulta_nr,     COALESCE(p_metas_semana,      v_metas),
    COALESCE(p_evolucao_resumida, v_evolucao),
    COALESCE(p_observacoes,       v_obs),
    v_fase_uuid,       now(),
    v_snapshot,
    v_narrativa,
    v_proximos_passos
  )
  RETURNING id INTO v_hist_id;

  -- ── Projetar métricas na camada analítica (Jornada 5) ────────
  INSERT INTO public.fase_metricas (
    jornada_historico_id,
    paciente_id,        nutri_id,
    fase_uuid,          fase,
    data_inicio_fase,   data_fim_fase,
    dias_da_fase,       semanas_cumpridas,
    fase_status,
    peso_inicio_kg,     peso_fim_kg,        peso_delta_kg,
    estrategias_ativas, estrategias_encerradas, aderencia_media_pct,
    checkins_enviados,  checkins_respondidos,   checkins_taxa_pct,
    tinha_conduta,      n_protocolos
  ) VALUES (
    v_hist_id,
    v_paciente_id,      v_nutri_id,
    v_fase_uuid,        v_fase,
    v_data_inicio,      v_hoje,
    v_dias_fase,        v_semanas,
    'concluida',
    v_peso_inicio_kg,   v_peso_fim_kg,
    CASE WHEN v_peso_inicio_kg IS NOT NULL AND v_peso_fim_kg IS NOT NULL
         THEN ROUND((v_peso_fim_kg - v_peso_inicio_kg)::numeric, 1)
         END,
    COALESCE(v_estr_ativas,     0),
    COALESCE(v_estr_encerradas, 0),
    v_aderencia_pct,
    COALESCE(v_checkins_enviados,    0),
    COALESCE(v_checkins_respondidos, 0),
    CASE WHEN COALESCE(v_checkins_enviados, 0) > 0
         THEN ROUND(100.0 * COALESCE(v_checkins_respondidos, 0) / v_checkins_enviados)
         END,
    v_conduta_titulo IS NOT NULL,
    jsonb_array_length(COALESCE(v_protocolos_json, '[]'::jsonb))
  );

  -- ── Iniciar nova fase ou encerrar acompanhamento ──────────────
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
