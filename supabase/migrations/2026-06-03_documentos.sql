-- =============================================================
-- Migration: 2026-06-03_documentos.sql
-- Cria tabela documentos, bucket e policies.
-- Idempotente: pode ser rodada novamente sem erro.
-- =============================================================

-- ── 1. Tabela documentos ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.documentos (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  nutri_id       uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  paciente_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo         text        NOT NULL,
  tipo           text        NOT NULL
    CHECK (tipo IN (
      'contrato','recibo','declaracao','termo',
      'encaminhamento','relatorio_clinico','laudo','outro'
    )),
  descricao      text,
  pdf_path       text,
  pdf_nome       text,
  link_externo   text,
  status         text        NOT NULL DEFAULT 'enviado'
    CHECK (status IN ('enviado','assinado','arquivado')),
  data_documento date,
  created_at     timestamptz NOT NULL DEFAULT now(),
  atualizado_em  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documentos_paciente
  ON public.documentos(paciente_id, data_documento DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_documentos_nutri
  ON public.documentos(nutri_id, paciente_id, data_documento DESC NULLS LAST);

-- ── 2. Trigger atualizado_em ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_atualizado_em_documentos()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_documentos_atualizado_em ON public.documentos;
CREATE TRIGGER trg_documentos_atualizado_em
  BEFORE UPDATE ON public.documentos
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_documentos();

-- ── 3. RLS — documentos ───────────────────────────────────────

ALTER TABLE public.documentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_documentos"       ON public.documentos;
DROP POLICY IF EXISTS "paciente_select_documentos" ON public.documentos;

-- Nutri: acesso total aos documentos que criou
CREATE POLICY "nutri_all_documentos" ON public.documentos
  FOR ALL USING (nutri_id = auth.uid()) WITH CHECK (nutri_id = auth.uid());

-- Paciente: somente leitura dos seus documentos (verificação direta, sem subquery)
CREATE POLICY "paciente_select_documentos" ON public.documentos
  FOR SELECT USING (paciente_id = auth.uid());

-- ── 4. Storage ────────────────────────────────────────────────
-- Path: {nutri_id}/{paciente_id}/{timestamp}.pdf
--   foldername(name)[1] = nutri_id

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documentos', 'documentos', false, 20971520,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "documentos_nutri_insert"    ON storage.objects;
DROP POLICY IF EXISTS "documentos_nutri_update"    ON storage.objects;
DROP POLICY IF EXISTS "documentos_nutri_delete"    ON storage.objects;
DROP POLICY IF EXISTS "documentos_paciente_select" ON storage.objects;

CREATE POLICY "documentos_nutri_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "documentos_nutri_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "documentos_nutri_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'documentos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Paciente acessa apenas PDFs dos seus documentos
CREATE POLICY "documentos_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1 FROM public.documentos
      WHERE pdf_path = name AND paciente_id = auth.uid()
    )
  );
