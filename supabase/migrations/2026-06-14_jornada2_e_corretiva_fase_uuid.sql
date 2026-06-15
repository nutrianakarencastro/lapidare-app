-- =============================================================
-- Sprint Jornada 2.E — Corretiva: fase_uuid em jornada_historico
-- =============================================================
-- Contexto:
-- A RPC nutri_encerrar_fase foi inicialmente publicada com
-- jornadas%ROWTYPE. Em ambientes com connection pooling (PgBouncer),
-- o plano do tipo composto pode ser compilado antes da Migration B
-- adicionar a coluna fase_uuid, resultando em v_jornada.fase_uuid = NULL.
--
-- Efeito observado:
--   - jornada_historico.fase_uuid = NULL para a fase recém-encerrada
--   - jornadas.fase_uuid inalterado após encerramento
--
-- Escopo desta correção:
--   APENAS a fase imediatamente anterior à fase ativa de cada paciente
--   (h.fase = jornadas.fase - 1) com fase_uuid IS NULL.
--
--   Fases históricas mais antigas com fase_uuid IS NULL NÃO são alteradas.
--   Elas são anteriores à Sprint Jornada 2 e fase_uuid NULL é o estado
--   correto para elas.
--
-- Esta migration registra o data fix já aplicado manualmente.
-- Idempotente: reexecutar não altera dados já corrigidos
--   (fase_uuid IS NULL filtra apenas os afetados).
-- =============================================================

-- ── Passo 1: Propagar fase_uuid para a fase recém-encerrada ──────────────────
-- Condição de segurança: h.fase = j.fase - 1
-- Garante que apenas a última fase encerrada (afetada pelo bug) recebe o UUID.
-- Todas as outras fases históricas com fase_uuid NULL permanecem intactas.

UPDATE public.jornada_historico h
SET    fase_uuid = j.fase_uuid
FROM   public.jornadas j
WHERE  j.paciente_id = h.paciente_id
  AND  h.fase_uuid   IS NULL
  AND  h.fase        = j.fase - 1;

-- ── Passo 2: Gerar novo fase_uuid para a fase ativa ──────────────────────────
-- Condição de segurança: apenas jornadas cujo fase_uuid aparece no histórico.
-- Em operação normal, jornadas.fase_uuid nunca coincide com jornada_historico.fase_uuid.
-- Coincidência indica que o UPDATE da RPC não gerou UUID novo (bug confirmado).

UPDATE public.jornadas j
SET    fase_uuid = gen_random_uuid()
WHERE  EXISTS (
  SELECT 1
  FROM   public.jornada_historico h
  WHERE  h.paciente_id = j.paciente_id
    AND  h.fase_uuid   = j.fase_uuid
);
