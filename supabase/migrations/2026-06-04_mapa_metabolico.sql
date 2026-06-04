-- =============================================================
-- Migration: 2026-06-04_mapa_metabolico.sql
-- Adiciona campos tireoidiano em ciclo_sintomas_diarios e
-- cria tabela mapa_marcos para marcos clínicos.
-- Idempotente.
-- =============================================================

-- ── 1. Campos tireoidiano em ciclo_sintomas_diarios ──────────

ALTER TABLE public.ciclo_sintomas_diarios
  ADD COLUMN IF NOT EXISTS lentidao           boolean,
  ADD COLUMN IF NOT EXISTS frio_excessivo     boolean,
  ADD COLUMN IF NOT EXISTS pele_seca          boolean,
  ADD COLUMN IF NOT EXISTS queda_sobrancelhas boolean;

-- ── 2. Tabela mapa_marcos ─────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.mapa_marcos (
  id            uuid         DEFAULT gen_random_uuid() PRIMARY KEY,
  paciente_id   uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nutri_id      uuid         NOT NULL REFERENCES auth.users(id),
  nome          text         NOT NULL,
  scores        jsonb        NOT NULL,
  obs           text,
  criado_em     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mapa_marcos_paciente
  ON public.mapa_marcos(paciente_id, criado_em DESC);

-- ── 3. RLS — mapa_marcos ─────────────────────────────────────

ALTER TABLE public.mapa_marcos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nutri_all_mapa_marcos"       ON public.mapa_marcos;
DROP POLICY IF EXISTS "paciente_select_mapa_marcos" ON public.mapa_marcos;

-- Nutri: acesso total aos marcos que criou
CREATE POLICY "nutri_all_mapa_marcos" ON public.mapa_marcos
  FOR ALL USING (nutri_id = auth.uid()) WITH CHECK (nutri_id = auth.uid());

-- Paciente: somente leitura dos seus marcos
CREATE POLICY "paciente_select_mapa_marcos" ON public.mapa_marcos
  FOR SELECT USING (paciente_id = auth.uid());
