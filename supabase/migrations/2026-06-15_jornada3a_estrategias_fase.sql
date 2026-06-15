-- Sprint Jornada 3A: vincula estratégias à fase de origem
-- Padrão idêntico ao de metas_terapeuticas (jornada2_b_fase_uuid.sql)
-- Não é FK formal — o UUID migra de jornadas → jornada_historico ao encerrar

ALTER TABLE public.estrategias
  ADD COLUMN IF NOT EXISTS fase_uuid_origem uuid NULL;

-- Índice parcial: só estratégias com fase vinculada (mesma convenção de metas)
CREATE INDEX IF NOT EXISTS idx_estrategias_fase_uuid_origem
  ON public.estrategias(fase_uuid_origem)
  WHERE fase_uuid_origem IS NOT NULL;
