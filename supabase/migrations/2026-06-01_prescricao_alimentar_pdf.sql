-- =============================================================
-- Migration: 2026-06-01_prescricao_alimentar_pdf.sql
-- PDFs complementares para planos e listas de compras.
-- Ajustes aprovados: pdf_nome + pdf_atualizado_em para rastrear
-- nome original do arquivo e data da última atualização.
-- =============================================================

-- 1. Colunas em planos ─────────────────────────────────────────

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS pdf_path          text,
  ADD COLUMN IF NOT EXISTS pdf_nome          text,
  ADD COLUMN IF NOT EXISTS pdf_atualizado_em timestamptz;


-- 2. Colunas em listas_compras ─────────────────────────────────

ALTER TABLE public.listas_compras
  ADD COLUMN IF NOT EXISTS pdf_path          text,
  ADD COLUMN IF NOT EXISTS pdf_nome          text,
  ADD COLUMN IF NOT EXISTS pdf_atualizado_em timestamptz;


-- 3. Bucket ────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('planos', 'planos', false)
ON CONFLICT (id) DO NOTHING;


-- 4. Políticas de storage ─────────────────────────────────────

-- Nutri: acesso total nos folders das próprias pacientes
DROP POLICY IF EXISTS "planos_nutri_all" ON storage.objects;
CREATE POLICY "planos_nutri_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'planos'
    AND EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE id::text = split_part(storage.objects.name, '/', 1)
        AND nutri_id = auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'planos'
    AND EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE id::text = split_part(storage.objects.name, '/', 1)
        AND nutri_id = auth.uid()
    )
  );

-- Paciente: leitura do próprio folder
DROP POLICY IF EXISTS "planos_paciente_select" ON storage.objects;
CREATE POLICY "planos_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'planos'
    AND split_part(name, '/', 1) = auth.uid()::text
  );
