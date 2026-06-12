-- =============================================================
-- Migration: 2026-06-12_rls_prescricoes_auth_user_id.sql
-- Corretiva RLS — tabela prescricoes + bucket Storage prescricoes
--
-- Contexto: Sprint B.1 (2026-06-09) separou pacientes.id de
-- auth.users.id. As policies originais usavam
-- paciente_id = auth.uid() e split_part(name,'/',1) = auth.uid(),
-- que deixaram de funcionar para pacientes criadas após B.1.
-- Idempotente: DROP IF EXISTS + CREATE.
-- =============================================================

-- ── 1. Tabela prescricoes — SELECT ─────────────────────────────────────────

DROP POLICY IF EXISTS prescricoes_select ON public.prescricoes;

CREATE POLICY prescricoes_select ON public.prescricoes
  FOR SELECT USING (
    -- Nutri acessa as prescrições das suas pacientes
    nutri_id = auth.uid()
    OR
    -- Paciente acessa as próprias (via auth_user_id após Sprint B.1)
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id           = paciente_id
        AND p.auth_user_id = auth.uid()
    )
  );

-- ── 2. Storage bucket prescricoes — SELECT ─────────────────────────────────

DROP POLICY IF EXISTS prescricoes_storage_select ON storage.objects;

CREATE POLICY prescricoes_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'prescricoes'
    AND (
      -- Nutri acessa pastas das suas pacientes
      split_part(name, '/', 1) IN (
        SELECT id::text FROM public.pacientes
        WHERE nutri_id = auth.uid()
      )
      OR
      -- Paciente acessa a própria pasta via auth_user_id (pós-B.1)
      EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id::text     = split_part(name, '/', 1)
          AND p.auth_user_id = auth.uid()
      )
    )
  );
