-- =============================================================
-- Migration: 2026-06-02_orientacoes.sql
-- Cria orientacoes e orientacoes_pacientes, bucket e policies.
-- Idempotente: pode ser rodada novamente sem erro.
-- =============================================================

-- ── 1. Tabela orientacoes ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.orientacoes (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nutri_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo                 text NOT NULL,
  descricao              text,
  categoria              text,
  subcategoria           text,
  tags                   text[]  NOT NULL DEFAULT '{}',
  favorita               boolean NOT NULL DEFAULT false,
  thumbnail_path         text,
  thumbnail_nome         text,
  pdf_path               text,
  pdf_nome               text,
  video_url              text,
  audio_path             text,
  audio_nome             text,
  objetivos_relacionados text[]  NOT NULL DEFAULT '{}',
  sintomas_relacionados  text[]  NOT NULL DEFAULT '{}',
  ativo                  boolean NOT NULL DEFAULT true,
  arquivado_em           timestamptz,
  created_at             timestamptz NOT NULL DEFAULT now(),
  atualizado_em          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orientacoes_nutri_ativo
  ON public.orientacoes(nutri_id, ativo, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orientacoes_favorita
  ON public.orientacoes(nutri_id, favorita)
  WHERE favorita = true;
CREATE INDEX IF NOT EXISTS idx_orientacoes_categoria
  ON public.orientacoes(nutri_id, categoria, subcategoria);

-- ── 2. Tabela orientacoes_pacientes ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.orientacoes_pacientes (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  orientacao_id    uuid NOT NULL
    REFERENCES public.orientacoes(id) ON DELETE CASCADE,
  paciente_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nutri_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ordem            integer,
  status           text NOT NULL DEFAULT 'nao_visualizada'
    CHECK (status IN ('nao_visualizada','visualizada','concluida')),
  visto_pela_paciente_em timestamptz,
  atribuido_em     timestamptz NOT NULL DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (orientacao_id, paciente_id)
);

CREATE INDEX IF NOT EXISTS idx_op_paciente
  ON public.orientacoes_pacientes(paciente_id, atribuido_em DESC);
CREATE INDEX IF NOT EXISTS idx_op_nutri
  ON public.orientacoes_pacientes(nutri_id);
CREATE INDEX IF NOT EXISTS idx_op_ordem
  ON public.orientacoes_pacientes(paciente_id, ordem ASC NULLS LAST, atribuido_em ASC);

-- ── 3. Trigger atualizado_em ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_atualizado_em_orientacoes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orientacoes_atualizado_em ON public.orientacoes;
CREATE TRIGGER trg_orientacoes_atualizado_em
  BEFORE UPDATE ON public.orientacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_atualizado_em_orientacoes();

-- ── 4. RLS — orientacoes ──────────────────────────────────────────────────────

ALTER TABLE public.orientacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_orientacoes"       ON public.orientacoes;
DROP POLICY IF EXISTS "paciente_select_orientacoes" ON public.orientacoes;

CREATE POLICY "nutri_all_orientacoes" ON public.orientacoes
  FOR ALL USING (nutri_id = auth.uid()) WITH CHECK (nutri_id = auth.uid());

-- Paciente vê orientações atribuídas (incluindo arquivadas — assignment persiste)
CREATE POLICY "paciente_select_orientacoes" ON public.orientacoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orientacoes_pacientes
      WHERE orientacao_id = id AND paciente_id = auth.uid()
    )
  );

-- ── 5. RLS — orientacoes_pacientes ───────────────────────────────────────────

ALTER TABLE public.orientacoes_pacientes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_op"       ON public.orientacoes_pacientes;
DROP POLICY IF EXISTS "paciente_select_op" ON public.orientacoes_pacientes;

CREATE POLICY "nutri_all_op" ON public.orientacoes_pacientes
  FOR ALL USING (nutri_id = auth.uid()) WITH CHECK (nutri_id = auth.uid());

CREATE POLICY "paciente_select_op" ON public.orientacoes_pacientes
  FOR SELECT USING (paciente_id = auth.uid());

-- ── 6. RPCs (SECURITY DEFINER) ───────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.marcar_orientacao_vista(p_atribuicao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.orientacoes_pacientes
  SET status                 = 'visualizada',
      visto_pela_paciente_em = COALESCE(visto_pela_paciente_em, now())
  WHERE id          = p_atribuicao_id
    AND paciente_id = auth.uid()
    AND status      = 'nao_visualizada';
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_orientacao_concluida(
  p_atribuicao_id uuid,
  p_concluida     boolean
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.orientacoes_pacientes
  SET status = CASE WHEN p_concluida THEN 'concluida' ELSE 'visualizada' END
  WHERE id          = p_atribuicao_id
    AND paciente_id = auth.uid();
END;
$$;

-- ── 7. Storage ────────────────────────────────────────────────────────────────
-- Path: {nutri_id}/{orientacao_id}/{tipo}.ext
--   foldername(name)[1] = nutri_id
--   foldername(name)[2] = orientacao_id

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'orientacoes', 'orientacoes', false, 52428800,
  ARRAY[
    'application/pdf',
    'image/jpeg','image/png','image/webp',
    'audio/mpeg','audio/mp4','audio/wav','audio/ogg'
  ]
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "orientacoes_nutri_insert"   ON storage.objects;
DROP POLICY IF EXISTS "orientacoes_nutri_update"   ON storage.objects;
DROP POLICY IF EXISTS "orientacoes_nutri_delete"   ON storage.objects;
DROP POLICY IF EXISTS "orientacoes_paciente_select" ON storage.objects;

CREATE POLICY "orientacoes_nutri_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'orientacoes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "orientacoes_nutri_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'orientacoes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "orientacoes_nutri_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'orientacoes'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Paciente cria signed URL apenas para orientações atribuídas a ela
CREATE POLICY "orientacoes_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'orientacoes'
    AND EXISTS (
      SELECT 1 FROM public.orientacoes_pacientes op
      JOIN public.orientacoes o ON o.id = op.orientacao_id
      WHERE op.paciente_id   = auth.uid()
        AND o.nutri_id::text = (storage.foldername(name))[1]
        AND o.id::text       = (storage.foldername(name))[2]
    )
  );
