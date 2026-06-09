-- =============================================================
-- B.1 — Paciente como entidade única: schema + backfill
-- =============================================================
-- Adiciona auth_user_id (nullable), status_app e token à tabela
-- pacientes. Faz backfill das pacientes já ativas.
-- Idempotente. Não toca em lógica de RLS nem em código frontend.
-- =============================================================

-- ── 1. Novos campos ───────────────────────────────────────────────────────────

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS status_app   TEXT NOT NULL DEFAULT 'nao_convidada'
    CHECK (status_app IN ('nao_convidada', 'convite_enviado', 'ativa', 'arquivada')),
  ADD COLUMN IF NOT EXISTS token        UUID,
  ADD COLUMN IF NOT EXISTS obs          TEXT;

-- Token: gera para todas as linhas sem token, depois define como default
UPDATE public.pacientes SET token = gen_random_uuid() WHERE token IS NULL;
ALTER TABLE public.pacientes ALTER COLUMN token SET DEFAULT gen_random_uuid();

-- ── 2. Unique constraint em token ────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_token_unique
  ON public.pacientes(token);

-- ── 3. Unique constraint (nutri_id, email) — necessária para nova modelagem ──
-- Verificação de segurança antes de criar o constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT nutri_id, email
    FROM public.pacientes
    GROUP BY nutri_id, email
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION
      'Duplicatas encontradas em (nutri_id, email) na tabela pacientes. '
      'Resolver manualmente antes de prosseguir com a migração B.1.';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'pacientes_nutri_email_unique'
      AND conrelid = 'public.pacientes'::regclass
  ) THEN
    ALTER TABLE public.pacientes
      ADD CONSTRAINT pacientes_nutri_email_unique UNIQUE (nutri_id, email);
  END IF;
END $$;

-- ── 4. Index de busca por auth_user_id ───────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS idx_pacientes_auth_user_id_unique
  ON public.pacientes(auth_user_id)
  WHERE auth_user_id IS NOT NULL;

-- ── 5. Backfill das pacientes existentes (já ativas) ─────────────────────────
-- Todas as linhas atuais têm id = auth.users.id.
-- Vincula auth_user_id ao id existente e marca como ativa.
UPDATE public.pacientes
  SET auth_user_id = id,
      status_app   = 'ativa'
  WHERE auth_user_id IS NULL;

-- ── Verificação final ─────────────────────────────────────────────────────────
DO $$
DECLARE
  n_sem_auth int;
  n_sem_token int;
BEGIN
  SELECT count(*) INTO n_sem_auth  FROM public.pacientes WHERE auth_user_id IS NULL AND status_app = 'nao_convidada';
  SELECT count(*) INTO n_sem_token FROM public.pacientes WHERE token IS NULL;

  RAISE NOTICE 'B.1 concluído. Pacientes sem auth_user_id (nao_convidada): %. Sem token: %.', n_sem_auth, n_sem_token;
END $$;
