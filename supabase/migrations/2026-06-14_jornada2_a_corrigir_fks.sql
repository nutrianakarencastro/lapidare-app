-- =============================================================
-- Sprint Jornada 2.A — Corrigir FKs de metas_terapeuticas e condutas
-- =============================================================
-- metas_terapeuticas e condutas foram criadas referenciando
-- auth.users(id) para paciente_id e nutri_id.
-- Após Sprint B.1, pacientes.id ≠ auth.uid() para pacientes novas.
-- Esta migration alinha as FKs ao padrão arquitetural do projeto.
--
-- Pré-requisito: Step 0 validado (zero linhas inconsistentes).
-- Idempotente: pode ser reexecutada sem erro.
-- =============================================================

BEGIN;

-- ── metas_terapeuticas: paciente_id → pacientes.id ───────────

-- Migrar registros onde paciente_id = auth_user_id (pós-B.1)
UPDATE public.metas_terapeuticas mt
SET    paciente_id = p.id
FROM   public.pacientes p
WHERE  p.auth_user_id = mt.paciente_id
  AND  p.id          <> mt.paciente_id;

-- Recriar FK para pacientes(id)
ALTER TABLE public.metas_terapeuticas
  DROP CONSTRAINT IF EXISTS metas_terapeuticas_paciente_id_fkey;
ALTER TABLE public.metas_terapeuticas
  ADD CONSTRAINT metas_terapeuticas_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- Recriar FK para nutris(id)
ALTER TABLE public.metas_terapeuticas
  DROP CONSTRAINT IF EXISTS metas_terapeuticas_nutri_id_fkey;
ALTER TABLE public.metas_terapeuticas
  ADD CONSTRAINT metas_terapeuticas_nutri_id_fkey
  FOREIGN KEY (nutri_id) REFERENCES public.nutris(id) ON DELETE CASCADE;

-- ── condutas: paciente_id → pacientes.id ─────────────────────

-- Migrar registros onde paciente_id = auth_user_id (pós-B.1)
UPDATE public.condutas c
SET    paciente_id = p.id
FROM   public.pacientes p
WHERE  p.auth_user_id = c.paciente_id
  AND  p.id          <> c.paciente_id;

-- Recriar FK para pacientes(id)
ALTER TABLE public.condutas
  DROP CONSTRAINT IF EXISTS condutas_paciente_id_fkey;
ALTER TABLE public.condutas
  ADD CONSTRAINT condutas_paciente_id_fkey
  FOREIGN KEY (paciente_id) REFERENCES public.pacientes(id) ON DELETE CASCADE;

-- Recriar FK para nutris(id)
ALTER TABLE public.condutas
  DROP CONSTRAINT IF EXISTS condutas_nutri_id_fkey;
ALTER TABLE public.condutas
  ADD CONSTRAINT condutas_nutri_id_fkey
  FOREIGN KEY (nutri_id) REFERENCES public.nutris(id) ON DELETE CASCADE;

COMMIT;
