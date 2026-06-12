-- =============================================================
-- Migration: 2026-06-12_ciclo_perfil_nao_hormonal.sql
-- Adiciona suporte a contracepção não hormonal em ciclo_perfil.
-- Idempotente (ADD COLUMN IF NOT EXISTS).
-- =============================================================

ALTER TABLE public.ciclo_perfil
  ADD COLUMN IF NOT EXISTS usa_contracepcao_nao_hormonal boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS contracepcao_nao_hormonal_tipo text
    CHECK (contracepcao_nao_hormonal_tipo IN (
      'nenhum',
      'diu_cobre',
      'preservativo',
      'diafragma',
      'tabelinha',
      'coito_interrompido',
      'laqueadura',
      'outro'
    )),
  ADD COLUMN IF NOT EXISTS contracepcao_nao_hormonal_obs text;
