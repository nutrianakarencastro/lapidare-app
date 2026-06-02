-- =============================================================
-- Migration: 2026-06-01d_peso_registros_pdf.sql
-- Adiciona suporte a PDF de avaliação 3D/Body3D em peso_registros.
-- Idempotente: pode ser rodada novamente sem erro.
--
-- CAMPOS FUTUROS PLANEJADOS (Body3D — não implementar agora):
--   ALTER TABLE public.peso_registros
--     ADD COLUMN IF NOT EXISTS score_body3d     numeric(6,2),
--     ADD COLUMN IF NOT EXISTS img              numeric(5,2),  -- índice de massa gorda
--     ADD COLUMN IF NOT EXISTS imm              numeric(5,2),  -- índice de massa magra
--     ADD COLUMN IF NOT EXISTS rcq              numeric(4,3),  -- relação cintura-quadril
--     ADD COLUMN IF NOT EXISTS rca              numeric(4,3),  -- relação cintura-altura
--     ADD COLUMN IF NOT EXISTS indice_conicidade numeric(5,3);
-- Nota: rcq e rca já são computáveis de cintura_cm/quadril_cm e cintura_cm/altura_cm,
-- mas armazenar os valores reportados pelo Body3D preserva precisão do laudo.
-- =============================================================

-- ── 1. Colunas de PDF em peso_registros ──────────────────────────────────────

ALTER TABLE public.peso_registros
  ADD COLUMN IF NOT EXISTS pdf_path          text,
  ADD COLUMN IF NOT EXISTS pdf_nome          text,
  ADD COLUMN IF NOT EXISTS pdf_atualizado_em timestamptz;

-- ── 2. Bucket privado para relatórios de avaliação corporal ──────────────────
-- Reutilizado por: Body3D, InBody, bioimpedância, laudos antropométricos.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('avaliacoes', 'avaliacoes', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ── 3. Storage policies ───────────────────────────────────────────────────────
-- Path format: {paciente_id}/{registro_id}.pdf
--   foldername(name)[1] = paciente_id

DROP POLICY IF EXISTS "avaliacoes_paciente_select" ON storage.objects;
CREATE POLICY "avaliacoes_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avaliacoes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "avaliacoes_nutri_insert" ON storage.objects;
CREATE POLICY "avaliacoes_nutri_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avaliacoes'
    AND EXISTS (
      SELECT 1 FROM public.peso_registros
      WHERE nutri_id          = auth.uid()
        AND paciente_id::text = (storage.foldername(name))[1]
      LIMIT 1
    )
  );

DROP POLICY IF EXISTS "avaliacoes_nutri_delete" ON storage.objects;
CREATE POLICY "avaliacoes_nutri_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avaliacoes'
    AND EXISTS (
      SELECT 1 FROM public.peso_registros
      WHERE nutri_id = auth.uid()
        AND pdf_path = name
    )
  );
