-- =============================================================
-- Migration: 2026-06-13_sprint31_0b3_rls_storage_complementares.sql
-- Sprint 31.0B.3 — Correção RLS: peso, fotos, feed, documentos
--
-- Corrige policies de tabelas e storage que ainda usavam
-- paciente_id = auth.uid() ou split_part(name,'/') = auth.uid(),
-- padrão incompatível com a arquitetura pós Sprint B.1 onde:
--   pacientes.id    ≠ auth.uid()  (para novas pacientes)
--   pacientes.auth_user_id = auth.uid()
--
-- Padrão correto: meu_paciente_id() (SECURITY DEFINER, B.2).
--
-- Módulos corrigidos:
--   1. peso_registros         — SELECT
--   2. Storage avaliacoes     — SELECT
--   3. fotos_evolucao         — SELECT + INSERT + DELETE
--   4. Storage fotos_evolucao — SELECT + INSERT + DELETE
--   5. feed_pratos            — SELECT + INSERT + UPDATE + DELETE
--   6. Storage fotos_pratos   — SELECT + INSERT + DELETE
--   7. documentos             — SELECT
--   8. Storage documentos     — SELECT
--
-- Sem alteração de schema. Sem backfill.
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.
-- Policies de nutri: mantidas sem alteração.
-- =============================================================


-- =============================================================
-- 1. peso_registros — SELECT da paciente
-- =============================================================

DROP POLICY IF EXISTS peso_select_paciente ON public.peso_registros;
CREATE POLICY peso_select_paciente ON public.peso_registros
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- peso_all_nutri: mantida (usa EXISTS com nutri_id = auth.uid())


-- =============================================================
-- 2. Storage: avaliacoes — SELECT da paciente
--
-- Path: {paciente_id}/{registro_id}.pdf
-- folder[1] = paciente_id → trocar auth.uid() por meu_paciente_id()
-- =============================================================

DROP POLICY IF EXISTS "avaliacoes_paciente_select" ON storage.objects;
CREATE POLICY "avaliacoes_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'avaliacoes'
    AND (storage.foldername(name))[1] = meu_paciente_id()::text
  );

-- avaliacoes_nutri_insert / delete: mantidas (usam nutri_id = auth.uid())


-- =============================================================
-- 3. fotos_evolucao (tabela) — SELECT + INSERT + DELETE
-- =============================================================

-- SELECT: paciente vê as próprias + nutri vê das suas pacientes
DROP POLICY IF EXISTS fotos_evolucao_select ON public.fotos_evolucao;
CREATE POLICY fotos_evolucao_select ON public.fotos_evolucao
  FOR SELECT USING (
    paciente_id = meu_paciente_id()
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = fotos_evolucao.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );

-- INSERT paciente
DROP POLICY IF EXISTS fotos_evolucao_insert_paciente ON public.fotos_evolucao;
CREATE POLICY fotos_evolucao_insert_paciente ON public.fotos_evolucao
  FOR INSERT WITH CHECK (paciente_id = meu_paciente_id());

-- DELETE: paciente remove as próprias + nutri remove das suas pacientes
DROP POLICY IF EXISTS fotos_evolucao_delete ON public.fotos_evolucao;
CREATE POLICY fotos_evolucao_delete ON public.fotos_evolucao
  FOR DELETE USING (
    paciente_id = meu_paciente_id()
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = fotos_evolucao.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );

-- fotos_evolucao_insert_nutri: mantida (usa EXISTS com nutri_id = auth.uid())


-- =============================================================
-- 4. Storage: fotos_evolucao — SELECT + INSERT + DELETE
--
-- Path: {paciente_id}/{filename}
-- folder[1] = paciente_id → trocar auth.uid() por meu_paciente_id()
-- =============================================================

-- SELECT: paciente lê a própria pasta + nutri lê das suas pacientes
DROP POLICY IF EXISTS fotos_evolucao_storage_select ON storage.objects;
CREATE POLICY fotos_evolucao_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos_evolucao'
    AND (
      split_part(name, '/', 1) = meu_paciente_id()::text
      OR split_part(name, '/', 1) IN (
        SELECT id::text FROM public.pacientes WHERE nutri_id = auth.uid()
      )
    )
  );

-- INSERT paciente
DROP POLICY IF EXISTS fotos_evolucao_storage_insert_paciente ON storage.objects;
CREATE POLICY fotos_evolucao_storage_insert_paciente ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos_evolucao'
    AND split_part(name, '/', 1) = meu_paciente_id()::text
  );

-- DELETE: paciente apaga da própria pasta + nutri apaga das suas pacientes
DROP POLICY IF EXISTS fotos_evolucao_storage_delete ON storage.objects;
CREATE POLICY fotos_evolucao_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos_evolucao'
    AND (
      split_part(name, '/', 1) = meu_paciente_id()::text
      OR split_part(name, '/', 1) IN (
        SELECT id::text FROM public.pacientes WHERE nutri_id = auth.uid()
      )
    )
  );

-- fotos_evolucao_storage_insert_nutri: mantida (usa SELECT IN pacientes)


-- =============================================================
-- 5. feed_pratos (tabela) — SELECT + INSERT + UPDATE + DELETE
--
-- SELECT e UPDATE têm duas cláusulas: paciente (corrigida) +
-- nutri (mantida via IN subquery).
-- =============================================================

-- SELECT
DROP POLICY IF EXISTS feed_select ON public.feed_pratos;
CREATE POLICY feed_select ON public.feed_pratos
  FOR SELECT USING (
    paciente_id = meu_paciente_id()
    OR paciente_id IN (
      SELECT id FROM public.pacientes WHERE nutri_id = auth.uid()
    )
  );

-- INSERT paciente
DROP POLICY IF EXISTS feed_insert_paciente ON public.feed_pratos;
CREATE POLICY feed_insert_paciente ON public.feed_pratos
  FOR INSERT WITH CHECK (paciente_id = meu_paciente_id());

-- UPDATE: paciente edita o próprio post + nutri comenta nas suas pacientes
DROP POLICY IF EXISTS feed_update ON public.feed_pratos;
CREATE POLICY feed_update ON public.feed_pratos
  FOR UPDATE USING (
    paciente_id = meu_paciente_id()
    OR paciente_id IN (
      SELECT id FROM public.pacientes WHERE nutri_id = auth.uid()
    )
  );

-- DELETE paciente
DROP POLICY IF EXISTS feed_delete_paciente ON public.feed_pratos;
CREATE POLICY feed_delete_paciente ON public.feed_pratos
  FOR DELETE USING (paciente_id = meu_paciente_id());


-- =============================================================
-- 6. Storage: fotos_pratos — SELECT + INSERT + DELETE
--
-- Path: {paciente_id}/{filename}
-- folder[1] = paciente_id → trocar auth.uid() por meu_paciente_id()
-- =============================================================

-- SELECT: paciente lê a própria pasta + nutri lê das suas pacientes
DROP POLICY IF EXISTS fotos_pratos_storage_select ON storage.objects;
CREATE POLICY fotos_pratos_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'fotos_pratos'
    AND (
      split_part(name, '/', 1) = meu_paciente_id()::text
      OR split_part(name, '/', 1) IN (
        SELECT id::text FROM public.pacientes WHERE nutri_id = auth.uid()
      )
    )
  );

-- INSERT paciente
DROP POLICY IF EXISTS fotos_pratos_storage_insert_paciente ON storage.objects;
CREATE POLICY fotos_pratos_storage_insert_paciente ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'fotos_pratos'
    AND split_part(name, '/', 1) = meu_paciente_id()::text
  );

-- DELETE paciente
DROP POLICY IF EXISTS fotos_pratos_storage_delete_paciente ON storage.objects;
CREATE POLICY fotos_pratos_storage_delete_paciente ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'fotos_pratos'
    AND split_part(name, '/', 1) = meu_paciente_id()::text
  );


-- =============================================================
-- 7. documentos (tabela) — SELECT da paciente
-- =============================================================

DROP POLICY IF EXISTS "paciente_select_documentos" ON public.documentos;
CREATE POLICY "paciente_select_documentos" ON public.documentos
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- nutri_all_documentos: mantida (usa nutri_id = auth.uid())


-- =============================================================
-- 8. Storage: documentos — SELECT da paciente
--
-- Path: {nutri_id}/{paciente_id}/{timestamp}.pdf
-- A subquery verifica pdf_path = name com meu_paciente_id().
-- Policies de nutri (INSERT/UPDATE/DELETE via folder[1] = nutri_id)
-- não são alteradas — já funcionam corretamente.
-- =============================================================

DROP POLICY IF EXISTS "documentos_paciente_select" ON storage.objects;
CREATE POLICY "documentos_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'documentos'
    AND EXISTS (
      SELECT 1 FROM public.documentos
      WHERE pdf_path    = name
        AND paciente_id = meu_paciente_id()
    )
  );
