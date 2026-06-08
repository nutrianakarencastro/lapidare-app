-- =============================================================
-- Migration: 2026-06-08_exames_pedidos.sql
-- Separa pedidos de exame das avaliações clínicas.
-- Pedidos → exames_pedidos (nova entidade independente)
-- Resultados → exames_arquivos (permanecem vinculados às avaliações)
-- =============================================================

-- ── 1. Nova tabela: exames_pedidos ────────────────────────────

CREATE TABLE IF NOT EXISTS public.exames_pedidos (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id             uuid NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nutri_id                uuid NOT NULL REFERENCES public.nutris(id)    ON DELETE CASCADE,

  titulo                  text NOT NULL,
  descricao               text,
  categoria               text NOT NULL DEFAULT 'outro'
    CHECK (categoria IN (
      'sangue','urina','saliva','fezes','intestinal',
      'genetico','hormonal','microbiota','toxicidade','imagem','outro'
    )),

  data_pedido             date NOT NULL DEFAULT CURRENT_DATE,
  data_resultado_recebido date,

  status                  text NOT NULL DEFAULT 'solicitado'
    CHECK (status IN ('solicitado','recebido','avaliado')),

  storage_path            text,
  nome_arquivo            text,

  avaliacao_id            uuid REFERENCES public.exames_avaliacoes(id) ON DELETE SET NULL,

  created_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exames_pedidos_paciente
  ON public.exames_pedidos(paciente_id, data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_exames_pedidos_nutri
  ON public.exames_pedidos(nutri_id, data_pedido DESC);
CREATE INDEX IF NOT EXISTS idx_exames_pedidos_avaliacao
  ON public.exames_pedidos(avaliacao_id) WHERE avaliacao_id IS NOT NULL;

-- ── 2. RLS ────────────────────────────────────────────────────

ALTER TABLE public.exames_pedidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_exames_pedidos"       ON public.exames_pedidos;
DROP POLICY IF EXISTS "paciente_select_exames_pedidos" ON public.exames_pedidos;

CREATE POLICY "nutri_all_exames_pedidos" ON public.exames_pedidos
  FOR ALL USING (nutri_id = auth.uid()) WITH CHECK (nutri_id = auth.uid());

CREATE POLICY "paciente_select_exames_pedidos" ON public.exames_pedidos
  FOR SELECT USING (paciente_id = auth.uid());

-- ── 3. Storage: SELECT para nutri (ausente na migration original) ──

DROP POLICY IF EXISTS "exames_nutri_select" ON storage.objects;
CREATE POLICY "exames_nutri_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exames'
    AND EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE id::text = (storage.foldername(name))[1]
        AND nutri_id = auth.uid()
    )
  );

-- ── 4. Storage: INSERT para path {paciente_id}/pedidos/{filename} ──

DROP POLICY IF EXISTS "exames_pedidos_nutri_insert" ON storage.objects;
CREATE POLICY "exames_pedidos_nutri_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'exames'
    AND (storage.foldername(name))[2] = 'pedidos'
    AND EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE id::text = (storage.foldername(name))[1]
        AND nutri_id = auth.uid()
    )
  );

-- ── 5. Storage: DELETE atualizado para cobrir exames_pedidos ──

DROP POLICY IF EXISTS "exames_nutri_delete" ON storage.objects;
CREATE POLICY "exames_nutri_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'exames'
    AND (
      EXISTS (
        SELECT 1 FROM public.exames_arquivos
        WHERE nutri_id = auth.uid() AND storage_path = name
      )
      OR EXISTS (
        SELECT 1 FROM public.exames_pedidos
        WHERE nutri_id = auth.uid() AND storage_path = name
      )
      OR EXISTS (
        SELECT 1 FROM public.exames_avaliacoes
        WHERE nutri_id          = auth.uid()
          AND paciente_id::text = (storage.foldername(name))[1]
          AND id::text          = (storage.foldername(name))[2]
      )
    )
  );

-- ── 6. Migração: exames_arquivos tipo='pedido' → exames_pedidos ──

INSERT INTO public.exames_pedidos
  (id, paciente_id, nutri_id, titulo, descricao, categoria, data_pedido,
   data_resultado_recebido, status, storage_path, nome_arquivo, avaliacao_id, created_at)
SELECT
  gen_random_uuid(),
  ea.paciente_id,
  ea.nutri_id,
  COALESCE(NULLIF(TRIM(ea.titulo), ''), ea.nome_arquivo, 'Pedido de exame'),
  NULL,
  COALESCE(ea.categoria, 'outro'),
  COALESCE(av.data_avaliacao, CURRENT_DATE),
  CASE WHEN ea.status IN ('recebido', 'avaliado') THEN ea.data_recebimento ELSE NULL END,
  CASE
    WHEN ea.status = 'avaliado' THEN 'avaliado'
    WHEN ea.status = 'recebido' THEN 'recebido'
    ELSE                             'solicitado'
  END,
  ea.storage_path,
  ea.nome_arquivo,
  ea.avaliacao_id,
  ea.created_at
FROM public.exames_arquivos  ea
JOIN public.exames_avaliacoes av ON av.id = ea.avaliacao_id
WHERE ea.tipo = 'pedido';

DELETE FROM public.exames_arquivos WHERE tipo = 'pedido';

-- ── 7. Restringir exames_arquivos a tipo='resultado' apenas ──

ALTER TABLE public.exames_arquivos
  DROP CONSTRAINT IF EXISTS exames_arquivos_tipo_check;
ALTER TABLE public.exames_arquivos
  ADD CONSTRAINT exames_arquivos_tipo_check
  CHECK (tipo IN ('resultado'));
