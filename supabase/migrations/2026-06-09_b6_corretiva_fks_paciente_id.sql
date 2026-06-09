-- =============================================================
-- B.6 Corretiva — redirecionar FKs de paciente_id
--                 de auth.users(id) para public.pacientes(id)
-- =============================================================
-- Contexto: 7 tabelas foram criadas antes de B.1, quando
-- pacientes.id == auth.users.id. Após B.6, pacientes criadas
-- diretamente em public.pacientes têm id gerado por
-- gen_random_uuid(), ausente em auth.users — quebrando as FKs.
--
-- Corrige: condutas, metas_terapeuticas, exames_avaliacoes,
--          exames_arquivos, orientacoes_pacientes,
--          documentos, mapa_marcos.
--
-- Não altera dados, RLS ou frontend.
-- ON DELETE CASCADE mantido em todas (padrão original).
-- Idempotente: DROP IF EXISTS não falha se a constraint
-- já foi removida em execução anterior.
-- =============================================================

-- =============================================================
-- VALIDAÇÃO DE ÓRFÃOS
-- Rodar as queries abaixo ANTES de aplicar este script.
-- Se qualquer uma retornar linhas, NÃO aplicar.
--
-- SELECT 'condutas' AS tabela, id, paciente_id
-- FROM public.condutas
-- WHERE paciente_id NOT IN (SELECT id FROM public.pacientes);
--
-- SELECT 'metas_terapeuticas' AS tabela, id, paciente_id
-- FROM public.metas_terapeuticas
-- WHERE paciente_id NOT IN (SELECT id FROM public.pacientes);
--
-- SELECT 'exames_avaliacoes' AS tabela, id, paciente_id
-- FROM public.exames_avaliacoes
-- WHERE paciente_id NOT IN (SELECT id FROM public.pacientes);
--
-- SELECT 'exames_arquivos' AS tabela, id, paciente_id
-- FROM public.exames_arquivos
-- WHERE paciente_id NOT IN (SELECT id FROM public.pacientes);
--
-- SELECT 'orientacoes_pacientes' AS tabela, id, paciente_id
-- FROM public.orientacoes_pacientes
-- WHERE paciente_id NOT IN (SELECT id FROM public.pacientes);
--
-- SELECT 'documentos' AS tabela, id, paciente_id
-- FROM public.documentos
-- WHERE paciente_id NOT IN (SELECT id FROM public.pacientes);
--
-- SELECT 'mapa_marcos' AS tabela, id, paciente_id
-- FROM public.mapa_marcos
-- WHERE paciente_id NOT IN (SELECT id FROM public.pacientes);
-- =============================================================


-- ── 1. condutas ──────────────────────────────────────────────

ALTER TABLE public.condutas
  DROP CONSTRAINT IF EXISTS condutas_paciente_id_fkey;

ALTER TABLE public.condutas
  ADD CONSTRAINT condutas_paciente_id_fkey
  FOREIGN KEY (paciente_id)
  REFERENCES public.pacientes(id)
  ON DELETE CASCADE;


-- ── 2. metas_terapeuticas ─────────────────────────────────────

ALTER TABLE public.metas_terapeuticas
  DROP CONSTRAINT IF EXISTS metas_terapeuticas_paciente_id_fkey;

ALTER TABLE public.metas_terapeuticas
  ADD CONSTRAINT metas_terapeuticas_paciente_id_fkey
  FOREIGN KEY (paciente_id)
  REFERENCES public.pacientes(id)
  ON DELETE CASCADE;


-- ── 3. exames_avaliacoes ──────────────────────────────────────

ALTER TABLE public.exames_avaliacoes
  DROP CONSTRAINT IF EXISTS exames_avaliacoes_paciente_id_fkey;

ALTER TABLE public.exames_avaliacoes
  ADD CONSTRAINT exames_avaliacoes_paciente_id_fkey
  FOREIGN KEY (paciente_id)
  REFERENCES public.pacientes(id)
  ON DELETE CASCADE;


-- ── 4. exames_arquivos ────────────────────────────────────────

ALTER TABLE public.exames_arquivos
  DROP CONSTRAINT IF EXISTS exames_arquivos_paciente_id_fkey;

ALTER TABLE public.exames_arquivos
  ADD CONSTRAINT exames_arquivos_paciente_id_fkey
  FOREIGN KEY (paciente_id)
  REFERENCES public.pacientes(id)
  ON DELETE CASCADE;


-- ── 5. orientacoes_pacientes ──────────────────────────────────

ALTER TABLE public.orientacoes_pacientes
  DROP CONSTRAINT IF EXISTS orientacoes_pacientes_paciente_id_fkey;

ALTER TABLE public.orientacoes_pacientes
  ADD CONSTRAINT orientacoes_pacientes_paciente_id_fkey
  FOREIGN KEY (paciente_id)
  REFERENCES public.pacientes(id)
  ON DELETE CASCADE;


-- ── 6. documentos ─────────────────────────────────────────────

ALTER TABLE public.documentos
  DROP CONSTRAINT IF EXISTS documentos_paciente_id_fkey;

ALTER TABLE public.documentos
  ADD CONSTRAINT documentos_paciente_id_fkey
  FOREIGN KEY (paciente_id)
  REFERENCES public.pacientes(id)
  ON DELETE CASCADE;


-- ── 7. mapa_marcos ────────────────────────────────────────────

ALTER TABLE public.mapa_marcos
  DROP CONSTRAINT IF EXISTS mapa_marcos_paciente_id_fkey;

ALTER TABLE public.mapa_marcos
  ADD CONSTRAINT mapa_marcos_paciente_id_fkey
  FOREIGN KEY (paciente_id)
  REFERENCES public.pacientes(id)
  ON DELETE CASCADE;
