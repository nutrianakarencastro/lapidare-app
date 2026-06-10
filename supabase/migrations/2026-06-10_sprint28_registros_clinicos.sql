-- =============================================================
-- Sprint 28 — Registros Clínicos
-- =============================================================
-- Tabela para armazenar documentos-fonte do atendimento:
-- transcrições, notas livres, registros sem consulta formal.
-- consulta_id é opcional — registros podem existir de forma
-- independente de uma consulta cadastrada.
-- A paciente não tem acesso (documento clínico interno).
-- =============================================================

CREATE TABLE IF NOT EXISTS public.registros_clinicos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id  uuid        NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nutri_id     uuid        NOT NULL REFERENCES public.nutris(id)    ON DELETE CASCADE,
  consulta_id  uuid        REFERENCES public.consultas(id)          ON DELETE SET NULL,

  texto_bruto  text        NOT NULL,

  fonte        text        NOT NULL DEFAULT 'manual'
                           CHECK (fonte IN ('tactiq', 'manual', 'api', 'outro')),

  visibilidade text        NOT NULL DEFAULT 'privado'
                           CHECK (visibilidade IN ('privado', 'compartilhado')),

  -- Ganchos para automação futura (preenchidos por IA — Sprint 28.3+)
  processado_em  timestamptz,
  versao_modelo  text,

  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_registros_clinicos_paciente
  ON public.registros_clinicos(paciente_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_registros_clinicos_nutri
  ON public.registros_clinicos(nutri_id, paciente_id);

CREATE INDEX IF NOT EXISTS idx_registros_clinicos_consulta
  ON public.registros_clinicos(consulta_id)
  WHERE consulta_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────
ALTER TABLE public.registros_clinicos ENABLE ROW LEVEL SECURITY;

-- Nutri: acesso total aos registros das suas pacientes
DROP POLICY IF EXISTS registros_clinicos_nutri ON public.registros_clinicos;
CREATE POLICY registros_clinicos_nutri ON public.registros_clinicos
  FOR ALL USING (nutri_id = auth.uid()) WITH CHECK (nutri_id = auth.uid());

-- Paciente: sem acesso nesta sprint (documento clínico interno).
-- Quando visibilidade = 'compartilhado' for implementado, adicionar:
-- CREATE POLICY registros_clinicos_paciente_select ON public.registros_clinicos
--   FOR SELECT USING (paciente_id = meu_paciente_id() AND visibilidade = 'compartilhado');
