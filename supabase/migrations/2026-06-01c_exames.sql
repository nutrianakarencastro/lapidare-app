-- =============================================================
-- Migration: 2026-06-01c_exames.sql
-- Cria exames_avaliacoes, exames_arquivos, bucket e policies.
-- Idempotente: pode ser rodada novamente sem erro.
-- =============================================================

-- ── 1. Tabela de avaliações ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.exames_avaliacoes (
  id                     uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nutri_id               uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo                 text,
  data_avaliacao         date NOT NULL DEFAULT CURRENT_DATE,
  data_coleta            date,
  avaliacao_funcional    text,
  evolucao_resumida      text,
  conquistas             text,
  pontos_atencao         text,
  proximos_passos        text,
  impacto_nos_sintomas   text,
  visto_pela_paciente_em timestamptz,
  -- Auditoria
  created_by             uuid REFERENCES auth.users(id),
  updated_by             uuid REFERENCES auth.users(id),
  created_at             timestamptz NOT NULL DEFAULT now(),
  atualizado_em          timestamptz NOT NULL DEFAULT now()
);

-- ── 2. Tabela de arquivos ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.exames_arquivos (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  avaliacao_id     uuid NOT NULL
    REFERENCES public.exames_avaliacoes(id) ON DELETE CASCADE,
  paciente_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nutri_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo             text NOT NULL CHECK (tipo IN ('pedido','resultado')),
  categoria        text NOT NULL DEFAULT 'outro'
    CHECK (categoria IN (
      'sangue','urina','saliva','fezes','intestinal',
      'genetico','hormonal','microbiota','toxicidade','imagem','outro'
    )),
  titulo           text,
  status           text NOT NULL DEFAULT 'solicitado'
    CHECK (status IN ('solicitado','aguardando_resultado','recebido','avaliado')),
  data_recebimento date,
  storage_path     text NOT NULL,
  nome_arquivo     text NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ── 3. Índices ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_exames_avaliacoes_paciente
  ON public.exames_avaliacoes(paciente_id, data_avaliacao DESC);
CREATE INDEX IF NOT EXISTS idx_exames_avaliacoes_nutri
  ON public.exames_avaliacoes(nutri_id, data_avaliacao DESC);
CREATE INDEX IF NOT EXISTS idx_exames_arquivos_avaliacao
  ON public.exames_arquivos(avaliacao_id, tipo, created_at);

-- ── 4. Trigger de auditoria (INSERT e UPDATE) ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_audit_exames()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by = auth.uid();
    NEW.updated_by = auth.uid();
  ELSIF TG_OP = 'UPDATE' THEN
    NEW.atualizado_em = now();
    NEW.updated_by    = auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exames_avaliacoes_audit ON public.exames_avaliacoes;
CREATE TRIGGER trg_exames_avaliacoes_audit
  BEFORE INSERT OR UPDATE ON public.exames_avaliacoes
  FOR EACH ROW EXECUTE FUNCTION public.set_audit_exames();

-- ── 5. RLS — exames_avaliacoes ────────────────────────────────────────────────

ALTER TABLE public.exames_avaliacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_exames_avaliacoes"      ON public.exames_avaliacoes;
DROP POLICY IF EXISTS "paciente_select_exames_avaliacoes" ON public.exames_avaliacoes;

CREATE POLICY "nutri_all_exames_avaliacoes" ON public.exames_avaliacoes
  FOR ALL USING (nutri_id = auth.uid()) WITH CHECK (nutri_id = auth.uid());

CREATE POLICY "paciente_select_exames_avaliacoes" ON public.exames_avaliacoes
  FOR SELECT USING (paciente_id = auth.uid());

-- ── 6. RLS — exames_arquivos ──────────────────────────────────────────────────

ALTER TABLE public.exames_arquivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_exames_arquivos"      ON public.exames_arquivos;
DROP POLICY IF EXISTS "paciente_select_exames_arquivos" ON public.exames_arquivos;

CREATE POLICY "nutri_all_exames_arquivos" ON public.exames_arquivos
  FOR ALL USING (nutri_id = auth.uid()) WITH CHECK (nutri_id = auth.uid());

CREATE POLICY "paciente_select_exames_arquivos" ON public.exames_arquivos
  FOR SELECT USING (paciente_id = auth.uid());

-- ── 7. RPC: paciente marca análise como vista ─────────────────────────────────
-- SECURITY DEFINER: paciente só tem SELECT na tabela; a função valida
-- que a avaliação pertence à paciente autenticada antes de executar o UPDATE.

CREATE OR REPLACE FUNCTION public.marcar_exame_visto(p_avaliacao_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.exames_avaliacoes
  SET visto_pela_paciente_em = now()
  WHERE id = p_avaliacao_id
    AND paciente_id = auth.uid();
END;
$$;

-- ── 8. Storage: bucket privado ────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('exames', 'exames', false, 10485760, ARRAY['application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- ── 9. Storage policies ───────────────────────────────────────────────────────
-- Path format: {paciente_id}/{avaliacao_id}/{timestamp}-{tipo}.pdf
--   foldername(name)[1] = paciente_id
--   foldername(name)[2] = avaliacao_id

DROP POLICY IF EXISTS "exames_paciente_select" ON storage.objects;
DROP POLICY IF EXISTS "exames_nutri_insert"    ON storage.objects;
DROP POLICY IF EXISTS "exames_nutri_delete"    ON storage.objects;

-- SELECT — paciente lê apenas a própria pasta (para createSignedUrl)
CREATE POLICY "exames_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exames'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- INSERT — nutri só faz upload para path cujo avaliacao_id (segmento 2)
-- pertence a ela no banco, e cujo paciente_id (segmento 1) coincide.
CREATE POLICY "exames_nutri_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exames'
    AND EXISTS (
      SELECT 1 FROM public.exames_avaliacoes
      WHERE id::text          = (storage.foldername(name))[2]
        AND nutri_id          = auth.uid()
        AND paciente_id::text = (storage.foldername(name))[1]
    )
  );

-- DELETE — nutri remove arquivos que lhe pertencem.
-- Caso 1 — deleção normal: arquivo tem row em exames_arquivos com nutri_id = auth.uid()
-- Caso 2 — rollback de upload: INSERT no banco falhou, row ainda não existe,
--           mas a avaliação pertence à nutri (evita orphan no storage).
CREATE POLICY "exames_nutri_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'exames'
    AND (
      EXISTS (
        SELECT 1 FROM public.exames_arquivos
        WHERE nutri_id     = auth.uid()
          AND storage_path = name
      )
      OR EXISTS (
        SELECT 1 FROM public.exames_avaliacoes
        WHERE nutri_id          = auth.uid()
          AND paciente_id::text = (storage.foldername(name))[1]
          AND id::text          = (storage.foldername(name))[2]
      )
    )
  );
