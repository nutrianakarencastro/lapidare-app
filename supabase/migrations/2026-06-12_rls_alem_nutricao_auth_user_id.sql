-- =============================================================
-- Migration: 2026-06-12_rls_alem_nutricao_auth_user_id.sql
-- Corretiva RLS — alem_nutricao_itens
--
-- Contexto: Sprint B.1 (2026-06-09) separou pacientes.id de
-- auth.users.id. A policy original usava pacientes.id = auth.uid(),
-- que deixou de funcionar para pacientes criadas após B.1.
-- Idempotente: DROP IF EXISTS + CREATE.
-- =============================================================

DROP POLICY IF EXISTS "paciente_alem_nutricao_read" ON public.alem_nutricao_itens;

CREATE POLICY "paciente_alem_nutricao_read" ON public.alem_nutricao_itens
  FOR SELECT USING (
    ativo = true
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.auth_user_id = auth.uid()
        AND p.nutri_id     = alem_nutricao_itens.nutri_id
    )
  );
