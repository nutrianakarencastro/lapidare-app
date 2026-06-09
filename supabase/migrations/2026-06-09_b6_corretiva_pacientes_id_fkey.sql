-- =============================================================
-- B.6 Corretiva — desacoplar pacientes.id de auth.users
-- =============================================================
-- pacientes.id passa a ser identidade clínica autônoma.
-- pacientes.auth_user_id mantém a FK para auth.users.
-- Não altera dados existentes.
-- =============================================================

ALTER TABLE public.pacientes
  DROP CONSTRAINT IF EXISTS pacientes_id_fkey;

ALTER TABLE public.pacientes
  ALTER COLUMN id SET DEFAULT gen_random_uuid();
