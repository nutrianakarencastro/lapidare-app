-- =============================================================
-- Sprint Jornada 2.B — Identificador estável de fase
-- =============================================================
-- fase_uuid em jornadas: nasce quando a fase começa, nunca muda
--   enquanto a fase está ativa, é copiado para o histórico ao encerrar.
--
-- fase_uuid em jornada_historico: preserva a identidade da fase
--   encerrada. NULL em registros anteriores a esta sprint (esperado).
--
-- fase_uuid_origem em metas_terapeuticas: ancoragem narrativa da
--   meta à fase em que nasceu. Não é FK formal — o UUID migra entre
--   jornadas → jornada_historico ao encerrar, e SQL relacional não
--   permite FK para duas tabelas simultaneamente.
--
-- Idempotente: pode ser reexecutada sem erro.
-- =============================================================

-- ── jornadas: identificador estável da fase ativa ────────────
ALTER TABLE public.jornadas
  ADD COLUMN IF NOT EXISTS fase_uuid uuid NOT NULL DEFAULT gen_random_uuid();

-- ── jornada_historico: preserva o UUID ao encerrar ───────────
-- Registros anteriores a esta sprint permanecem com NULL (correto).
-- Registros novos sempre receberão o valor via RPC nutri_encerrar_fase.
ALTER TABLE public.jornada_historico
  ADD COLUMN IF NOT EXISTS fase_uuid uuid;

-- ── metas_terapeuticas: fase de origem narrativa ─────────────
ALTER TABLE public.metas_terapeuticas
  ADD COLUMN IF NOT EXISTS fase_uuid_origem uuid NULL;

CREATE INDEX IF NOT EXISTS idx_metas_fase_uuid_origem
  ON public.metas_terapeuticas(fase_uuid_origem)
  WHERE fase_uuid_origem IS NOT NULL;
