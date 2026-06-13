-- =============================================================
-- Migration: 2026-06-13_sprint31_0b2_rls_ciclo.sql
-- Sprint 31.0B.2 — Correção RLS: módulo Ciclo
--
-- Problema: todas as policies paciente do módulo Ciclo usavam
-- paciente_id = auth.uid(), quebrado pós Sprint B.1 onde
-- pacientes.id ≠ auth.uid() para novas pacientes.
--
-- Padrão correto: meu_paciente_id() — SECURITY DEFINER em B.2.
--
-- Tabelas corrigidas:
--   1. ciclo_perfil    — policy RLS + FK (auth.users → pacientes)
--   2. ciclo_sintomas_diarios — todas as policies (nomes desconhecidos)
--   3. ciclo_periodos  — todas as policies (nomes desconhecidos)
--
-- ciclo_sintomas_diarios e ciclo_periodos foram criadas diretamente
-- no Supabase, sem arquivo SQL rastreado. Por isso, a migration
-- remove TODAS as policies existentes nessas tabelas via DO dinâmico
-- antes de recriar as corretas — idempotente independente de nomes.
--
-- RPCs: nenhuma existe para o módulo Ciclo.
-- Backfill: não necessário (sem dados fantasma nestas tabelas).
-- Nutri: policies da nutri em ciclo_perfil estão corretas — mantidas.
-- =============================================================


-- =============================================================
-- BLOCO 1 — ciclo_perfil: corrigir policy da paciente
-- =============================================================

DROP POLICY IF EXISTS "paciente_all_ciclo_perfil" ON public.ciclo_perfil;

CREATE POLICY "paciente_all_ciclo_perfil" ON public.ciclo_perfil
  FOR ALL
  USING    (paciente_id = meu_paciente_id())
  WITH CHECK (paciente_id = meu_paciente_id());


-- =============================================================
-- BLOCO 2 — ciclo_perfil: FK auth.users → public.pacientes
--
-- Após B.1, pacientes.id ≠ auth.uid() para novas pacientes,
-- fazendo o INSERT falhar com FK violation antes do RLS.
--
-- Segurança: pacientes antigas têm pacientes.id = auth.uid()
-- (backfill B.1) — os valores armazenados existem em
-- public.pacientes. Sem órfãos.
-- =============================================================

ALTER TABLE public.ciclo_perfil
  DROP CONSTRAINT IF EXISTS ciclo_perfil_paciente_id_fkey;

ALTER TABLE public.ciclo_perfil
  ADD CONSTRAINT ciclo_perfil_paciente_id_fkey
  FOREIGN KEY (paciente_id)
  REFERENCES public.pacientes(id)
  ON DELETE CASCADE;


-- =============================================================
-- BLOCO 3 — ciclo_sintomas_diarios: remover todas as policies
--           e recriar com meu_paciente_id()
--
-- Tabela criada diretamente no Supabase — nomes de policy
-- desconhecidos pelo repositório. Bloco DO remove tudo antes
-- de recriar. Idempotente.
--
-- Estrutura conhecida (de migrations de ALTER TABLE):
--   - paciente_id: referência à paciente
--   - data: date
--   - UNIQUE (paciente_id, data) — usado no upsert do frontend
-- =============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ciclo_sintomas_diarios'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.ciclo_sintomas_diarios',
      r.policyname
    );
  END LOOP;
END;
$$;

-- Garantir RLS habilitado (idempotente)
ALTER TABLE public.ciclo_sintomas_diarios ENABLE ROW LEVEL SECURITY;

-- Paciente: acesso total aos próprios registros
CREATE POLICY "paciente_ciclo_sintomas_all" ON public.ciclo_sintomas_diarios
  FOR ALL
  USING    (paciente_id = meu_paciente_id())
  WITH CHECK (paciente_id = meu_paciente_id());

-- Nutri: leitura dos registros das suas pacientes
CREATE POLICY "nutri_ciclo_sintomas_select" ON public.ciclo_sintomas_diarios
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id       = ciclo_sintomas_diarios.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );


-- =============================================================
-- BLOCO 4 — ciclo_periodos: remover todas as policies
--           e recriar com meu_paciente_id()
--
-- Mesma situação: tabela criada diretamente no Supabase.
-- Estrutura conhecida (de migrations de ALTER TABLE):
--   - id: uuid PK
--   - paciente_id: referência à paciente
--   - inicio: date
--   - fim: date (nullable)
-- =============================================================

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'ciclo_periodos'
  LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.ciclo_periodos',
      r.policyname
    );
  END LOOP;
END;
$$;

-- Garantir RLS habilitado (idempotente)
ALTER TABLE public.ciclo_periodos ENABLE ROW LEVEL SECURITY;

-- Paciente: acesso total aos próprios períodos
CREATE POLICY "paciente_ciclo_periodos_all" ON public.ciclo_periodos
  FOR ALL
  USING    (paciente_id = meu_paciente_id())
  WITH CHECK (paciente_id = meu_paciente_id());

-- Nutri: leitura dos períodos das suas pacientes
CREATE POLICY "nutri_ciclo_periodos_select" ON public.ciclo_periodos
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id       = ciclo_periodos.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );
