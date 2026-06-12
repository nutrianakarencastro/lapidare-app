-- =============================================================
-- Migration: 2026-06-12_rls_suplementos_auth_user_id.sql
-- Corretiva RLS — Suplementos e Suplementos Logs
--
-- Contexto: Sprint B.1 (2026-06-09) separou pacientes.id de
-- auth.users.id. Pacientes criadas após B.1 têm:
--   pacientes.id         = UUID da tabela (PK)
--   pacientes.auth_user_id = auth.users.id (identidade real)
-- As policies anteriores usavam paciente_id = auth.uid(), o que
-- deixou de funcionar para novas pacientes.
-- Idempotente: DROP IF EXISTS + CREATE.
-- =============================================================

-- ── 1. suplementos — SELECT ────────────────────────────────────────────────

DROP POLICY IF EXISTS suplementos_select ON public.suplementos;

CREATE POLICY suplementos_select ON public.suplementos
  FOR SELECT USING (
    -- Nutri acessa os suplementos das suas pacientes
    nutri_id = auth.uid()
    OR
    -- Paciente acessa os próprios (via auth_user_id após Sprint B.1)
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id            = paciente_id
        AND p.auth_user_id  = auth.uid()
    )
  );

-- ── 2. suplementos_logs — SELECT ───────────────────────────────────────────

DROP POLICY IF EXISTS suplementos_logs_select ON public.suplementos_logs;

CREATE POLICY suplementos_logs_select ON public.suplementos_logs
  FOR SELECT USING (
    -- Nutri lê para acompanhar aderência
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id       = paciente_id
        AND p.nutri_id = auth.uid()
    )
    OR
    -- Paciente lê os próprios logs
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id           = paciente_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- ── 3. suplementos_logs — escrita da paciente (toggle "tomei") ─────────────

DROP POLICY IF EXISTS suplementos_logs_write_paciente ON public.suplementos_logs;

CREATE POLICY suplementos_logs_write_paciente ON public.suplementos_logs
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id           = paciente_id
        AND p.auth_user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id           = paciente_id
        AND p.auth_user_id = auth.uid()
    )
  );
