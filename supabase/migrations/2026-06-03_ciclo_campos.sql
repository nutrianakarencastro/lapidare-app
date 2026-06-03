-- =============================================================
-- Migration: 2026-06-03_ciclo_campos.sql
-- Adiciona campos de detalhe em ciclo_periodos e novos sintomas
-- em ciclo_sintomas_diarios. Retrocompatível (colunas nullable).
-- =============================================================

-- ── ciclo_periodos — detalhes do sangramento ─────────────────

ALTER TABLE public.ciclo_periodos
  ADD COLUMN IF NOT EXISTS cor_sangue        text
    CHECK (cor_sangue IN (
      'rosado','vermelho_vivo','vermelho_escuro','marrom','preto'
    )),
  ADD COLUMN IF NOT EXISTS intensidade_fluxo text
    CHECK (intensidade_fluxo IN (
      'leve','moderado','intenso','muito_intenso'
    )),
  ADD COLUMN IF NOT EXISTS coagulos          text NOT NULL DEFAULT 'nao'
    CHECK (coagulos IN ('nao','pequenos','moderados','grandes')),
  ADD COLUMN IF NOT EXISTS escape_pre        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notas_periodo     text;

-- ── ciclo_sintomas_diarios — novos sintomas ──────────────────

ALTER TABLE public.ciclo_sintomas_diarios
  ADD COLUMN IF NOT EXISTS secura_vaginal    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS palpitacoes       boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS queda_cabelo      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS insonia           boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acorda_madrugada  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS absorventes_dia   smallint;
