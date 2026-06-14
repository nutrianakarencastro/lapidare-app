-- =============================================================
-- Sprint Jornada 2.D — Revalidar RLS pós-correção de FK
-- =============================================================
-- As policies são recriadas para garantir coerência após a
-- mudança de referência de auth.users para pacientes/nutris.
-- O comportamento de acesso não muda — apenas formaliza o padrão.
--
-- metas_terapeuticas: somente a nutri acessa.
--   Paciente sem policy SELECT até Sprint Jornada 4.
--
-- condutas: somente a nutri acessa.
--   Paciente sem policy SELECT até Sprint Jornada 4.
--
-- Idempotente: pode ser reexecutada sem erro.
-- =============================================================

-- ── metas_terapeuticas ───────────────────────────────────────

ALTER TABLE public.metas_terapeuticas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_metas" ON public.metas_terapeuticas;
CREATE POLICY "nutri_all_metas" ON public.metas_terapeuticas
  FOR ALL
  USING   (nutri_id = auth.uid())
  WITH CHECK (nutri_id = auth.uid());

-- ── condutas ─────────────────────────────────────────────────

ALTER TABLE public.condutas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_condutas" ON public.condutas;
CREATE POLICY "nutri_all_condutas" ON public.condutas
  FOR ALL
  USING   (nutri_id = auth.uid())
  WITH CHECK (nutri_id = auth.uid());
