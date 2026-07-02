-- =============================================================
-- Migration: 2026-07-02_orientacoes_storage_fix.sql
-- Corrige o acesso ao Storage do bucket orientacoes.
--
-- Problemas resolvidos:
--   1. createSignedUrl falhava para a paciente: a policy
--      orientacoes_paciente_select fazia JOIN em public.orientacoes
--      com RLS ativa, causando ambiguidade no `id` e bloqueio
--      silencioso. Solução: SECURITY DEFINER function.
--   2. Nutri não tinha SELECT no próprio bucket: impedia
--      createSignedUrls de thumbnails e upsert de re-uploads.
--   3. Bucket rejeitava audio/x-m4a (MIME type do macOS/iOS
--      para arquivos .m4a). Adicionado à lista permitida.
--
-- Idempotente: pode ser reexecutada sem erro.
-- =============================================================


-- ── 1. Função SECURITY DEFINER ────────────────────────────────
-- Verifica se a paciente autenticada tem acesso ao objeto de
-- storage em storage.foldername formato: {nutri_id}/{orientacao_id}/arquivo
-- Bypass de RLS via SECURITY DEFINER elimina a ambiguidade do
-- `id` que bloqueava o SELECT indiretamente na policy anterior.

CREATE OR REPLACE FUNCTION public.paciente_pode_acessar_orientacao_storage(p_name text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orientacoes_pacientes op
    JOIN public.orientacoes o ON o.id = op.orientacao_id
    WHERE op.paciente_id   = meu_paciente_id()
      AND o.nutri_id::text = (storage.foldername(p_name))[1]
      AND o.id::text       = (storage.foldername(p_name))[2]
  );
$$;


-- ── 2. Grant ──────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.paciente_pode_acessar_orientacao_storage(text) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_pode_acessar_orientacao_storage(text) TO authenticated;


-- ── 3. Policy SELECT paciente ─────────────────────────────────
-- Substitui a versão anterior que fazia JOIN direto em
-- public.orientacoes com RLS, causando bloqueio silencioso.

DROP POLICY IF EXISTS "orientacoes_paciente_select" ON storage.objects;

CREATE POLICY "orientacoes_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'orientacoes'
    AND public.paciente_pode_acessar_orientacao_storage(name)
  );


-- ── 4. Policy SELECT nutri ────────────────────────────────────
-- Nutri precisa de SELECT para: createSignedUrls de thumbnails
-- e para que upsert detecte arquivos existentes corretamente.

DROP POLICY IF EXISTS "orientacoes_nutri_select" ON storage.objects;

CREATE POLICY "orientacoes_nutri_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'orientacoes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── 5. Bucket: adicionar audio/x-m4a sem duplicar ────────────
-- macOS e iOS reportam .m4a como audio/x-m4a em vez de
-- audio/mp4, fazendo o upload ser rejeitado pelo bucket.

UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'audio/x-m4a')
WHERE id = 'orientacoes'
  AND NOT ('audio/x-m4a' = ANY(allowed_mime_types));
