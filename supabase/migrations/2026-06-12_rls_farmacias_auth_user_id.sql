-- =============================================================
-- Migration: 2026-06-12_rls_farmacias_auth_user_id.sql
-- Corretiva RLS — farmacias e farmacias_paciente
--
-- Contexto: Sprint B.1 (2026-06-09) separou pacientes.id de
-- auth.users.id. As policies anteriores usavam
-- paciente_id = auth.uid(), que deixou de funcionar para
-- pacientes criadas após B.1.
-- Idempotente: DROP IF EXISTS + CREATE.
-- =============================================================

-- ── 1. farmacias_paciente — SELECT da paciente ─────────────────────────────

DROP POLICY IF EXISTS farmacias_paciente_select_paciente ON public.farmacias_paciente;

CREATE POLICY farmacias_paciente_select_paciente ON public.farmacias_paciente
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id           = paciente_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- ── 2. farmacias — SELECT da paciente (via vínculo) ────────────────────────

DROP POLICY IF EXISTS farmacias_select_paciente ON public.farmacias;

CREATE POLICY farmacias_select_paciente ON public.farmacias
  FOR SELECT USING (
    EXISTS (
      SELECT 1
      FROM   public.farmacias_paciente fp
      JOIN   public.pacientes          p  ON p.id = fp.paciente_id
      WHERE  fp.farmacia_id = farmacias.id
        AND  p.auth_user_id = auth.uid()
    )
  );
