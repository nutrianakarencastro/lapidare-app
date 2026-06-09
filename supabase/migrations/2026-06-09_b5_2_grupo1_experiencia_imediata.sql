-- =============================================================
-- B.5.2 Grupo 1 — Experiência imediata da paciente nova
-- =============================================================
-- Substitui paciente_id = auth.uid() por paciente_id = meu_paciente_id()
-- em todas as policies das telas de uso imediato:
--   consultas · check-ins · orientações · metas/jornada · exames
--
-- meu_paciente_id() = SECURITY DEFINER, retorna pacientes.id
-- via auth_user_id = auth.uid(). Backward-compat total:
-- paciente antiga → meu_paciente_id() = auth.uid() = pacientes.id
-- =============================================================


-- =============================================================
-- 1. CONSULTAS
-- =============================================================

DROP POLICY IF EXISTS consultas_select ON public.consultas;
CREATE POLICY consultas_select ON public.consultas
  FOR SELECT USING (
    paciente_id = meu_paciente_id()
    OR nutri_id = auth.uid()
  );


-- =============================================================
-- 2. CHECK-INS
-- =============================================================

-- 2.1 Templates: paciente vê os específicos seus ou os genéricos da nutri
DROP POLICY IF EXISTS checkin_templates_select_paciente ON public.checkin_templates;
CREATE POLICY checkin_templates_select_paciente ON public.checkin_templates
  FOR SELECT USING (
    paciente_id = meu_paciente_id()
    OR (
      paciente_id IS NULL
      AND nutri_id IN (
        SELECT nutri_id FROM public.pacientes
        WHERE auth_user_id = auth.uid()   -- resolve via auth_user_id, não id
      )
    )
  );

-- 2.2 Envios: paciente vê e responde os próprios
DROP POLICY IF EXISTS checkin_envios_select ON public.checkin_envios;
CREATE POLICY checkin_envios_select ON public.checkin_envios
  FOR SELECT USING (
    paciente_id = meu_paciente_id()
    OR nutri_id = auth.uid()
  );

DROP POLICY IF EXISTS checkin_envios_update ON public.checkin_envios;
CREATE POLICY checkin_envios_update ON public.checkin_envios
  FOR UPDATE
  USING    (paciente_id = meu_paciente_id() OR nutri_id = auth.uid())
  WITH CHECK (paciente_id = meu_paciente_id() OR nutri_id = auth.uid());

-- 2.3 Agendamentos: paciente vê os próprios (visibilidade de lembretes)
DROP POLICY IF EXISTS checkin_agendamentos_paciente_select ON public.checkin_agendamentos;
CREATE POLICY checkin_agendamentos_paciente_select ON public.checkin_agendamentos
  FOR SELECT USING (
    paciente_id = meu_paciente_id()
  );


-- =============================================================
-- 3. ORIENTAÇÕES (tabelas + storage)
-- =============================================================

-- 3.1 orientacoes_pacientes: SELECT da paciente
DROP POLICY IF EXISTS "paciente_select_op" ON public.orientacoes_pacientes;
CREATE POLICY "paciente_select_op" ON public.orientacoes_pacientes
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- 3.2 orientacoes: SELECT indireto via atribuição
DROP POLICY IF EXISTS "paciente_select_orientacoes" ON public.orientacoes;
CREATE POLICY "paciente_select_orientacoes" ON public.orientacoes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orientacoes_pacientes
      WHERE orientacao_id = id
        AND paciente_id   = meu_paciente_id()
    )
  );

-- 3.3 Storage orientacoes: paciente acessa arquivos das próprias orientações
DROP POLICY IF EXISTS "orientacoes_paciente_select" ON storage.objects;
CREATE POLICY "orientacoes_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'orientacoes'
    AND EXISTS (
      SELECT 1
      FROM public.orientacoes_pacientes op
      JOIN public.orientacoes o ON o.id = op.orientacao_id
      WHERE op.paciente_id   = meu_paciente_id()
        AND o.nutri_id::text = (storage.foldername(name))[1]
        AND o.id::text       = (storage.foldername(name))[2]
    )
  );


-- =============================================================
-- 4. METAS / JORNADA
-- =============================================================

DROP POLICY IF EXISTS jornadas_paciente_select ON public.jornadas;
CREATE POLICY jornadas_paciente_select ON public.jornadas
  FOR SELECT USING (paciente_id = meu_paciente_id());

DROP POLICY IF EXISTS jornada_historico_paciente_select ON public.jornada_historico;
CREATE POLICY jornada_historico_paciente_select ON public.jornada_historico
  FOR SELECT USING (paciente_id = meu_paciente_id());


-- =============================================================
-- 5. EXAMES (tabelas + storage)
-- =============================================================

-- 5.1 exames_avaliacoes
DROP POLICY IF EXISTS "paciente_select_exames_avaliacoes" ON public.exames_avaliacoes;
CREATE POLICY "paciente_select_exames_avaliacoes" ON public.exames_avaliacoes
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- 5.2 exames_arquivos
DROP POLICY IF EXISTS "paciente_select_exames_arquivos" ON public.exames_arquivos;
CREATE POLICY "paciente_select_exames_arquivos" ON public.exames_arquivos
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- 5.3 exames_pedidos
DROP POLICY IF EXISTS "paciente_select_exames_pedidos" ON public.exames_pedidos;
CREATE POLICY "paciente_select_exames_pedidos" ON public.exames_pedidos
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- 5.4 Storage exames: paciente lê apenas a própria pasta (para createSignedUrl)
--     Path format: {paciente_id}/{avaliacao_id}/{timestamp}-{tipo}.pdf
DROP POLICY IF EXISTS "exames_paciente_select" ON storage.objects;
CREATE POLICY "exames_paciente_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'exames'
    AND (storage.foldername(name))[1] = meu_paciente_id()::text
  );
