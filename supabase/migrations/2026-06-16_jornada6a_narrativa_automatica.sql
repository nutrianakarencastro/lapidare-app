-- =============================================================
-- Sprint Jornada 6A — Camada Narrativa Automática
--
-- Responde: "O que isso significou para a paciente?"
--
-- Arquitetura:
--   • narrativa gerada por motor de regras clínicas auditável
--   • sem IA generativa livre
--   • regras determinísticas versionadas nesta migration
--   • narrativa_automatica em jornada_historico (campo novo, nullable)
--   • snapshot_clinico e fase_metricas intocados
--   • sem alteração na assinatura de nutri_encerrar_fase()
--   • sem alteração no frontend (Jornada 6B)
--
-- Tom obrigatório:
--   • reconhecer esforço
--   • contextualizar resultados (não apenas numerar)
--   • evitar linguagem celebratória excessiva
--   • evitar linguagem infantilizada
--   • acolhedor, humano, realista, sem romantização
--
-- Mudanças nesta migration:
--   1. jornada_historico: ADD COLUMN narrativa_automatica text NULL
--   2. nutri_gerar_narrativa_fase(): motor de regras (STABLE)
--   3. nutri_encerrar_fase(): +v_narrativa, chamada ao motor,
--      INSERT expandido com narrativa_automatica
-- =============================================================


-- ── 1. Coluna em jornada_historico ───────────────────────────

ALTER TABLE public.jornada_historico
  ADD COLUMN IF NOT EXISTS narrativa_automatica text NULL;


-- ── 2. Motor de narrativa: nutri_gerar_narrativa_fase() ──────
--
-- STABLE: consistente na transação; permite evolução futura
-- para leitura de configurações no banco sem mudar a volatility.
--
-- Parâmetros:
--   p_aderencia_pct   — null quando não há logs de estratégia
--   p_peso_delta_kg   — null quando não há peso registrado (fim - início)
--   p_peso_inicio_kg  — null quando não há registro antes do início
--   p_peso_fim_kg     — null quando não há registro na fase
--   p_checkins_taxa   — null quando nenhum check-in foi enviado
--   p_checkins_env    — 0 quando nenhum enviado
--   p_estr_total      — soma ativas + encerradas com fase_uuid_origem
--   p_dias_da_fase    — inteiro ≥ 0
--   p_semanas         — inteiro ≥ 1
-- =============================================================

CREATE OR REPLACE FUNCTION public.nutri_gerar_narrativa_fase(
  p_aderencia_pct   numeric,
  p_peso_delta_kg   numeric,
  p_peso_inicio_kg  numeric,
  p_peso_fim_kg     numeric,
  p_checkins_taxa   numeric,
  p_checkins_env    integer,
  p_estr_total      integer,
  p_dias_da_fase    integer,
  p_semanas         integer
)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_ader_classe   text;   -- 'alta' | 'moderada' | 'baixa' | 'sem_dados'
  v_peso_classe   text;   -- 'reducao_importante' | 'reducao_leve' | 'manutencao' | 'aumento' | 'sem_peso'
  v_eng_classe    text;   -- 'alto' | 'moderado' | 'baixo' | 'sem_checkins'
  v_duracao       text;   -- ex: "4 semanas" | "1 semana"
  v_peso_delta_abs numeric;
  v_corpo         text;
  v_modificador   text;
BEGIN

  -- ── Dados insuficientes (retorno antecipado) ──────────────────
  IF COALESCE(p_estr_total, 0) = 0
     AND COALESCE(p_checkins_env, 0) < 3
     AND p_peso_fim_kg IS NULL
  THEN
    RETURN
      'Essa fase teve pouco registro disponível para leitura clínica. '
      'Os dados são insuficientes para uma narrativa do período. '
      'Isso não compromete o acompanhamento — '
      'é um ponto de atenção para os próximos ciclos.';
  END IF;

  -- ── Classificação de aderência ────────────────────────────────
  v_ader_classe := CASE
    WHEN p_aderencia_pct IS NULL     THEN 'sem_dados'
    WHEN p_aderencia_pct >= 70       THEN 'alta'
    WHEN p_aderencia_pct >= 40       THEN 'moderada'
    ELSE                                  'baixa'
  END;

  -- ── Classificação de peso ─────────────────────────────────────
  v_peso_delta_abs := ABS(ROUND(COALESCE(p_peso_delta_kg, 0), 1));
  v_peso_classe := CASE
    WHEN p_peso_delta_kg IS NULL         THEN 'sem_peso'
    WHEN p_peso_delta_kg <= -2.0         THEN 'reducao_importante'
    WHEN p_peso_delta_kg <  -0.5         THEN 'reducao_leve'
    WHEN p_peso_delta_kg <=  0.5         THEN 'manutencao'
    ELSE                                      'aumento'
  END;

  -- ── Classificação de engajamento ──────────────────────────────
  v_eng_classe := CASE
    WHEN COALESCE(p_checkins_env, 0) = 0 THEN 'sem_checkins'
    WHEN p_checkins_taxa >= 75            THEN 'alto'
    WHEN p_checkins_taxa >= 50            THEN 'moderado'
    ELSE                                       'baixo'
  END;

  -- ── Contexto de duração ───────────────────────────────────────
  v_duracao := p_semanas::text
    || ' semana'
    || CASE WHEN p_semanas = 1 THEN '' ELSE 's' END;

  -- ── Corpo principal: matriz aderência × peso ──────────────────

  v_corpo := CASE

    -- ── ALTA aderência ─────────────────────────────────────────

    WHEN v_ader_classe = 'alta' AND v_peso_classe = 'reducao_importante' THEN
      'A adesão às estratégias nessa fase foi de '
      || ROUND(p_aderencia_pct)::text || '% ao longo de ' || v_duracao || '. '
      || 'Esse nível de consistência tem peso clínico — na maior parte dos dias, '
      || 'houve esforço ativo para seguir o que foi combinado. '
      || 'O peso foi de ' || p_peso_inicio_kg::text || ' kg para '
      || p_peso_fim_kg::text || ' kg, uma redução de ' || v_peso_delta_abs::text || ' kg. '
      || 'Esse resultado é consequência direta da continuidade ao longo do tempo.'

    WHEN v_ader_classe = 'alta' AND v_peso_classe = 'reducao_leve' THEN
      'A adesão nessa fase foi de ' || ROUND(p_aderencia_pct)::text
      || '% em ' || v_duracao || '. '
      || 'O peso reduziu ' || v_peso_delta_abs::text || ' kg no período — '
      || 'um movimento gradual, que é fisiologicamente mais sustentável do que mudanças rápidas. '
      || 'O esforço desta fase está refletido nos dados.'

    WHEN v_ader_classe = 'alta' AND v_peso_classe = 'manutencao' THEN
      'A adesão às estratégias foi de ' || ROUND(p_aderencia_pct)::text
      || '% em ' || v_duracao || '. '
      || 'O peso se manteve estável nesse período. '
      || 'Fases de manutenção fazem parte do processo — '
      || 'o organismo integra mudanças antes de responder com alteração de peso. '
      || 'O esforço desta fase não foi em vão.'

    WHEN v_ader_classe = 'alta' AND v_peso_classe = 'aumento' THEN
      'A adesão às estratégias foi de ' || ROUND(p_aderencia_pct)::text
      || '% em ' || v_duracao || '. '
      || 'Houve aumento de ' || v_peso_delta_abs::text || ' kg no período. '
      || 'Alta adesão com aumento de peso indica que outros fatores merecem atenção clínica — '
      || 'retenção hídrica, composição corporal, ciclo hormonal ou contexto metabólico. '
      || 'O próximo ciclo parte com mais informação disponível.'

    WHEN v_ader_classe = 'alta' AND v_peso_classe = 'sem_peso' THEN
      'A adesão às estratégias foi de ' || ROUND(p_aderencia_pct)::text
      || '% em ' || v_duracao || '. '
      || 'Não há registros de peso nesse período para comparação. '
      || 'Consistência no processo é, por si só, um dado clínico relevante — '
      || 'o que foi praticado aqui constrói base para os próximos ciclos.'

    -- ── MODERADA aderência ─────────────────────────────────────

    WHEN v_ader_classe = 'moderada' AND v_peso_classe = 'reducao_importante' THEN
      'Essa fase de ' || v_duracao || ' teve adesão de '
      || ROUND(p_aderencia_pct)::text || '% — '
      || 'nem sempre foi possível manter tudo o que foi planejado. '
      || 'Ainda assim, o peso foi de ' || p_peso_inicio_kg::text || ' kg para '
      || p_peso_fim_kg::text || ' kg, redução de ' || v_peso_delta_abs::text || ' kg. '
      || 'Parcial como foi, o esforço produziu resultado mensurável.'

    WHEN v_ader_classe = 'moderada' AND v_peso_classe = 'reducao_leve' THEN
      'A adesão nessa fase ficou em ' || ROUND(p_aderencia_pct)::text
      || '% ao longo de ' || v_duracao || '. '
      || 'O peso reduziu ' || v_peso_delta_abs::text || ' kg. '
      || 'Aderência parcial também produz movimento — '
      || 'o resultado reflete o esforço feito dentro das possibilidades do período.'

    WHEN v_ader_classe = 'moderada' AND v_peso_classe = 'manutencao' THEN
      'A adesão nessa fase ficou em ' || ROUND(p_aderencia_pct)::text
      || '% em ' || v_duracao || '. '
      || 'O peso se manteve. '
      || 'Há espaço para avançar na consistência — '
      || 'e o que esta fase revelou serve de base para ajustar o que vem a seguir.'

    WHEN v_ader_classe = 'moderada' AND v_peso_classe = 'aumento' THEN
      'Essa fase de ' || v_duracao || ' teve adesão de '
      || ROUND(p_aderencia_pct)::text || '% e aumento de '
      || v_peso_delta_abs::text || ' kg. '
      || 'Quando a adesão é parcial e o peso aumenta, '
      || 'é importante entender quais fatores estiveram presentes — '
      || 'para que o próximo ciclo parta de um ajuste mais preciso.'

    WHEN v_ader_classe = 'moderada' AND v_peso_classe = 'sem_peso' THEN
      'A adesão nessa fase foi de ' || ROUND(p_aderencia_pct)::text
      || '% em ' || v_duracao || '. '
      || 'Não há registros de peso para referência nesse período. '
      || 'O que foi praticado aqui serve de ponto de partida para o próximo ciclo.'

    -- ── BAIXA aderência ────────────────────────────────────────

    WHEN v_ader_classe = 'baixa' AND v_peso_classe = 'reducao_importante' THEN
      'A adesão às estratégias nessa fase foi de '
      || ROUND(p_aderencia_pct)::text || '% em ' || v_duracao || '. '
      || 'Ainda assim, o peso foi de ' || p_peso_inicio_kg::text || ' kg para '
      || p_peso_fim_kg::text || ' kg — redução de ' || v_peso_delta_abs::text || ' kg. '
      || 'Esse dado merece atenção clínica: o que gerou essa mudança com baixa adesão monitorada?'

    WHEN v_ader_classe = 'baixa'
         AND v_peso_classe IN ('reducao_leve', 'manutencao') THEN
      'Essa foi uma fase mais desafiadora em termos de adesão: '
      || ROUND(p_aderencia_pct)::text || '% em ' || v_duracao || '. '
      || CASE
           WHEN v_peso_classe = 'reducao_leve' THEN
             'O peso reduziu ' || v_peso_delta_abs::text || ' kg no período. '
           ELSE
             'O peso se manteve estável. '
         END
      || 'O próximo ciclo começa com o que essa fase revelou — com ajuste, não com julgamento.'

    WHEN v_ader_classe = 'baixa' AND v_peso_classe = 'aumento' THEN
      'A adesão nessa fase ficou em ' || ROUND(p_aderencia_pct)::text
      || '% em ' || v_duracao || ', com aumento de ' || v_peso_delta_abs::text || ' kg. '
      || 'Esse cenário indica que algo precisou ser revisto. '
      || 'É exatamente para isso que o acompanhamento existe: '
      || 'identificar o que não funcionou e construir um ajuste a partir daqui.'

    WHEN v_ader_classe = 'baixa' AND v_peso_classe = 'sem_peso' THEN
      'A adesão nessa fase ficou em ' || ROUND(p_aderencia_pct)::text
      || '% em ' || v_duracao || '. '
      || 'Foi uma fase difícil — e isso faz parte do processo. '
      || 'Reconhecer onde foi mais difícil é o que permite ajustar o próximo ciclo.'

    -- ── SEM DADOS de aderência (estratégias sem fase_uuid, mas outros dados presentes)

    WHEN v_ader_classe = 'sem_dados'
         AND v_peso_classe = 'reducao_importante' THEN
      'Não há registro de adesão a estratégias nessa fase de ' || v_duracao || '. '
      || 'O peso foi de ' || p_peso_inicio_kg::text || ' kg para '
      || p_peso_fim_kg::text || ' kg — redução de ' || v_peso_delta_abs::text || ' kg. '
      || 'O resultado está documentado mesmo sem adesão monitorada.'

    WHEN v_ader_classe = 'sem_dados'
         AND v_peso_classe = 'reducao_leve' THEN
      'Não há registro de adesão a estratégias nessa fase de ' || v_duracao || '. '
      || 'O peso reduziu ' || v_peso_delta_abs::text || ' kg no período.'

    WHEN v_ader_classe = 'sem_dados'
         AND v_peso_classe = 'manutencao' THEN
      'Não há registro de adesão a estratégias nessa fase de ' || v_duracao || '. '
      || 'O peso se manteve estável.'

    WHEN v_ader_classe = 'sem_dados'
         AND v_peso_classe = 'aumento' THEN
      'Não há registro de adesão a estratégias nessa fase de ' || v_duracao || '. '
      || 'O peso aumentou ' || v_peso_delta_abs::text || ' kg no período.'

    -- ── Fallback (sem aderência e sem peso, mas com algum dado)
    ELSE
      'Fase de ' || v_duracao || ' com dados parciais para leitura clínica. '
      || 'O que foi registrado nesse período está preservado para referência futura.'

  END;

  -- ── Modificador de engajamento (check-ins) ────────────────────
  -- Aplicado quando acrescenta informação não coberta pelo corpo principal
  v_modificador := CASE
    WHEN v_eng_classe = 'alto'
         AND v_ader_classe NOT IN ('alta') THEN
      ' O engajamento nos check-ins foi de ' || ROUND(p_checkins_taxa)::text || '% — '
      || 'presença constante no processo é o que permite ajustes ao longo do caminho.'

    WHEN v_eng_classe = 'baixo'
         AND COALESCE(p_checkins_env, 0) > 0 THEN
      ' Os check-ins tiveram ' || ROUND(p_checkins_taxa)::text || '% de resposta nesse período. '
      || 'Mais registros na próxima fase ampliam a leitura clínica disponível.'

    WHEN v_eng_classe = 'sem_checkins' THEN
      ' Não houve check-ins nessa fase.'

    ELSE NULL
  END;

  -- ── Resultado final ───────────────────────────────────────────
  RETURN TRIM(
    v_corpo || COALESCE(v_modificador, '')
  );

END;
$$;

GRANT EXECUTE ON FUNCTION public.nutri_gerar_narrativa_fase(
  numeric, numeric, numeric, numeric, numeric, integer, integer, integer, integer
) TO authenticated;


-- ── 3. RPC nutri_encerrar_fase — CREATE OR REPLACE ───────────
--
-- Assinatura inalterada.
-- Mudanças internas (Jornada 6A):
--   + DECLARE v_narrativa text
--   + chamada a nutri_gerar_narrativa_fase() antes do INSERT
--   + INSERT em jornada_historico expandido com narrativa_automatica
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

  -- novo — Jornada 6A
  v_narrativa              text;
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

  -- ── Geração da narrativa (Jornada 6A) ────────────────────────
  --    Chamada ao motor após todas as variáveis estarem computadas.
  --    Zero SELECTs adicionais — reutiliza o escopo existente.
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

  -- ── Arquivar no histórico (Jornada 5: RETURNING; Jornada 6A: narrativa)
  INSERT INTO public.jornada_historico (
    paciente_id,       nutri_id,
    fase,              nome_fase,         objetivo_fase,
    data_inicio_fase,  data_fim_fase,     semanas_cumpridas,
    consulta_numero,   metas_semana,
    evolucao_resumida, observacoes,
    fase_uuid,         arquivado_em,
    snapshot_clinico,
    narrativa_automatica
  ) VALUES (
    v_paciente_id,     v_nutri_id,
    v_fase,            v_nome_fase,       COALESCE(p_objetivo_fase,     v_obj_fase),
    v_data_inicio,     v_hoje,            v_semanas,
    v_consulta_nr,     COALESCE(p_metas_semana,      v_metas),
    COALESCE(p_evolucao_resumida, v_evolucao),
    COALESCE(p_observacoes,       v_obs),
    v_fase_uuid,       now(),
    v_snapshot,
    v_narrativa
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
