-- =============================================================
-- Migration: 2026-06-15_rls_planos_auth_user_id.sql
--
-- Corrige policies de acesso à tabela public.planos e ao bucket
-- de storage 'planos' para pacientes cuja pacientes.id difere
-- de auth.uid() (arquitetura pós-Sprint B.1).
--
-- Causa raiz: policies antigas usavam paciente_id = auth.uid()
-- diretamente. Após B.1, public.pacientes.id é uma UUID estável
-- distinta de auth.uid() (que fica em pacientes.auth_user_id).
--
-- O que muda:
--   1. planos_select: paciente resolve identidade via join
--   2. planos_paciente_select (storage): prefixo do path
--      resolvido via pacientes.auth_user_id = auth.uid()
--
-- O que NÃO muda:
--   • schema da tabela planos (sem ALTER TABLE)
--   • acesso da nutri (nutri_id = auth.uid() mantido)
--   • política de escrita da nutri (planos_write_nutri intocada)
--   • política de storage da nutri (planos_nutri_all intocada)
--   • nenhum backfill de dados
-- =============================================================


-- ── 1. Tabela public.planos ───────────────────────────────────

DROP POLICY IF EXISTS planos_select ON public.planos;

CREATE POLICY planos_select ON public.planos
  FOR SELECT
  USING (
    nutri_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id           = planos.paciente_id
        AND p.auth_user_id = auth.uid()
    )
  );


-- ── 2. Storage bucket 'planos' — acesso da paciente ──────────

DROP POLICY IF EXISTS "planos_paciente_select" ON storage.objects;

CREATE POLICY "planos_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'planos'
    AND split_part(name, '/', 1) IN (
      SELECT p.id::text
      FROM public.pacientes p
      WHERE p.auth_user_id = auth.uid()
    )
  );
