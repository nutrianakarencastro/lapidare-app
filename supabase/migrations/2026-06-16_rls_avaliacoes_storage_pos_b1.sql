-- =============================================================
-- Migration: 2026-06-16_rls_avaliacoes_storage_pos_b1.sql
-- Corrige policies INSERT e DELETE do bucket avaliacoes pós B.1.
--
-- Problema (diagnosticado em 2026-06-16):
--   avaliacoes_nutri_insert e avaliacoes_nutri_delete dependiam de
--   peso_registros.nutri_id = auth.uid() como fonte de autorização.
--   Após Sprint B.1, nutri_id em peso_registros é nullable
--   (ON DELETE SET NULL) e pode estar NULL ou inconsistente,
--   causando "new row violates row-level security policy".
--
-- Correção:
--   Autorização via JOIN com pacientes:
--     p.id       = pr.paciente_id   (a paciente dona do registro)
--     p.nutri_id = auth.uid()       (pertence à nutri autenticada)
--   Elimina dependência de peso_registros.nutri_id.
--
-- Path format: {paciente_id}/{registro_id}.pdf
--   (storage.foldername(name))[1]  = paciente_id  (UUID em pacientes)
--   split_part(name, '/', 2)       = {registro_id}.pdf
--
-- Sem alteração de schema. Sem backfill.
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.
-- avaliacoes_paciente_select: não alterada (já corrigida em sprint31_0b3).
-- =============================================================


-- ── INSERT ────────────────────────────────────────────────────
--
-- Autoriza upload quando todos os critérios forem satisfeitos:
--   1. bucket_id = 'avaliacoes'
--   2. foldername[1] do path = pr.paciente_id  (segmento 1)
--   3. filename do path      = pr.id || '.pdf'  (segmento 2)
--   4. a paciente do registro pertence à nutri: p.nutri_id = auth.uid()

DROP POLICY IF EXISTS "avaliacoes_nutri_insert" ON storage.objects;

CREATE POLICY "avaliacoes_nutri_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avaliacoes'
    AND EXISTS (
      SELECT 1
      FROM public.peso_registros pr
      JOIN public.pacientes      p  ON p.id = pr.paciente_id
      WHERE pr.paciente_id::text  = (storage.foldername(name))[1]
        AND pr.id::text || '.pdf' = split_part(name, '/', 2)
        AND p.nutri_id            = auth.uid()
    )
  );


-- ── DELETE ────────────────────────────────────────────────────
--
-- Autoriza deleção quando o pdf_path do registro pertence
-- a uma paciente da nutri autenticada.
-- Não requer nutri_id preenchido em peso_registros.

DROP POLICY IF EXISTS "avaliacoes_nutri_delete" ON storage.objects;

CREATE POLICY "avaliacoes_nutri_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avaliacoes'
    AND EXISTS (
      SELECT 1
      FROM public.peso_registros pr
      JOIN public.pacientes      p  ON p.id = pr.paciente_id
      WHERE pr.pdf_path = name
        AND p.nutri_id  = auth.uid()
    )
  );
