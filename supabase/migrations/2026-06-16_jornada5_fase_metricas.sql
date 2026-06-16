-- =============================================================
-- Sprint Jornada 5 — Camada Analítica Longitudinal
--
-- Cria a tabela fase_metricas: projeção relacional derivada do
-- snapshot_clinico, com tipos nativos, indexada para consultas
-- longitudinais, dashboards e motores de inteligência clínica.
--
-- Princípios:
--   • snapshot_clinico permanece intocado como prontuário histórico
--   • fase_metricas é derivada, nunca fonte primária
--   • gerada dentro da transação de nutri_encerrar_fase()
--   • sem backfill de fases anteriores
--   • sem alteração na assinatura da RPC
--   • sem alteração no frontend
--
-- Mudanças nesta migration:
--   1. CREATE TABLE public.fase_metricas
--   2. 4 índices (1 único, 3 simples/compostos)
--   3. RLS: nutri SELECT only
--   4. nutri_encerrar_fase(): +v_hist_id, RETURNING, INSERT metricas
-- =============================================================


-- ── 1. Tabela fase_metricas ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.fase_metricas (

  -- Identidade e rastreabilidade
  id                     uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_historico_id   uuid        NOT NULL
    REFERENCES public.jornada_historico(id) ON DELETE CASCADE,
  paciente_id            uuid        NOT NULL
    REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nutri_id               uuid        NOT NULL
    REFERENCES public.nutris(id) ON DELETE CASCADE,
  fase_uuid              uuid        NOT NULL,    -- espelho de jornada_historico.fase_uuid
  fase                   integer     NOT NULL,    -- número ordinal da fase (1, 2, 3…)

  -- Temporalidade
  data_inicio_fase       date        NOT NULL,
  data_fim_fase          date        NOT NULL,
  dias_da_fase           integer     NOT NULL,
  semanas_cumpridas      integer     NOT NULL,

  -- Status do encerramento
  fase_status            text        NOT NULL DEFAULT 'concluida'
    CHECK (fase_status IN ('concluida', 'interrompida', 'encerrada_precocemente')),

  -- Peso
  peso_inicio_kg         numeric,               -- null = sem registro antes do início
  peso_fim_kg            numeric,               -- null = sem registro na fase
  peso_delta_kg          numeric,               -- null = qualquer um dos dois ausente

  -- Estratégias vinculadas à fase
  estrategias_ativas     integer     NOT NULL DEFAULT 0,
  estrategias_encerradas integer     NOT NULL DEFAULT 0,
  aderencia_media_pct    numeric,               -- null = sem logs de estratégia no período

  -- Engajamento via check-ins
  checkins_enviados      integer     NOT NULL DEFAULT 0,
  checkins_respondidos   integer     NOT NULL DEFAULT 0,
  checkins_taxa_pct      numeric,               -- null = nenhum enviado

  -- Contexto clínico (flags — detalhe permanece no snapshot_clinico)
  tinha_conduta          boolean     NOT NULL DEFAULT false,
  n_protocolos           integer     NOT NULL DEFAULT 0,

  -- Metadados
  criado_em              timestamptz NOT NULL DEFAULT now()
);


-- ── 2. Índices ────────────────────────────────────────────────

-- Trajetória longitudinal de uma paciente em ordem cronológica
CREATE INDEX IF NOT EXISTS idx_fase_metricas_paciente
  ON public.fase_metricas(paciente_id, data_inicio_fase ASC);

-- Visão da nutri sobre todas as fases de suas pacientes
CREATE INDEX IF NOT EXISTS idx_fase_metricas_nutri
  ON public.fase_metricas(nutri_id, data_inicio_fase ASC);

-- Lookup 1:1 com jornada_historico — garante unicidade e join rápido
CREATE UNIQUE INDEX IF NOT EXISTS idx_fase_metricas_historico
  ON public.fase_metricas(jornada_historico_id);

-- Join com estrategias, metas e snapshot via fase_uuid (sem UNIQUE —
-- preserva flexibilidade para múltiplos registros por fase no futuro)
CREATE INDEX IF NOT EXISTS idx_fase_metricas_fase_uuid
  ON public.fase_metricas(fase_uuid);


-- ── 3. Row Level Security ─────────────────────────────────────

ALTER TABLE public.fase_metricas ENABLE ROW LEVEL SECURITY;

-- Nutri: leitura de todas as fases das suas pacientes
DROP POLICY IF EXISTS fase_metricas_nutri ON public.fase_metricas;
CREATE POLICY fase_metricas_nutri ON public.fase_metricas
  FOR SELECT USING (nutri_id = auth.uid());

-- Sem acesso da paciente — camada analítica interna
-- Sem escrita direta — alimentada exclusivamente pela RPC abaixo


-- ── 4. RPC nutri_encerrar_fase — CREATE OR REPLACE ───────────
--
-- Assinatura inalterada.
-- Mudanças internas (Jornada 5):
--   + DECLARE v_hist_id uuid
--   + INSERT jornada_historico ganha RETURNING id INTO v_hist_id
--   + INSERT fase_metricas com variáveis já disponíveis no escopo
--
-- Zero novos SELECTs — todos os dados já estão nas variáveis
-- computadas para o snapshot_clinico na Jornada 4.
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

  -- novo — Jornada 5
  v_hist_id                uuid;
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

  -- 4.2 peso início da fase
  SELECT kg, data
  INTO   v_peso_inicio_kg, v_peso_inicio_data
  FROM   public.peso_registros
  WHERE  paciente_id = v_paciente_id
    AND  data        <= v_data_inicio
  ORDER  BY data DESC LIMIT 1;

  -- 4.3 peso fim da fase
  SELECT kg, data
  INTO   v_peso_fim_kg, v_peso_fim_data
  FROM   public.peso_registros
  WHERE  paciente_id = v_paciente_id
    AND  data        <= v_hoje
  ORDER  BY data DESC LIMIT 1;

  -- 4.4 conduta vigente na abertura da fase
  SELECT titulo, objetivo_principal, data
  INTO   v_conduta_titulo, v_conduta_objetivo, v_conduta_data
  FROM   public.condutas
  WHERE  paciente_id = v_paciente_id
    AND  nutri_id    = v_nutri_id
    AND  data        <= v_data_inicio
  ORDER  BY data DESC LIMIT 1;

  -- 4.5 protocolos ativos no encerramento
  SELECT jsonb_agg(jsonb_build_object('id', protocolo_id))
  INTO   v_protocolos_json
  FROM   public.paciente_protocolos
  WHERE  paciente_id = v_paciente_id
    AND  status      = 'ativo';

  -- 4.6 estratégias: contagem por status
  SELECT
    COUNT(*) FILTER (WHERE status = 'ativa'),
    COUNT(*) FILTER (WHERE status = 'encerrada')
  INTO v_estr_ativas, v_estr_encerradas
  FROM public.estrategias
  WHERE paciente_id      = v_paciente_id
    AND nutri_id         = v_nutri_id
    AND fase_uuid_origem = v_fase_uuid;

  -- 4.6b aderência média das estratégias da fase
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

  -- 4.7 check-ins no período
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

  -- ── Arquivar no histórico + capturar id (Jornada 5) ──────────
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
  )
  RETURNING id INTO v_hist_id;   -- ← Jornada 5: captura o id gerado

  -- ── Projetar métricas na camada analítica (Jornada 5) ────────
  --    Zero novos SELECTs — todos os dados já estão no escopo.
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
