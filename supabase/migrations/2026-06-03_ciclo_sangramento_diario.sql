-- =============================================================
-- Migration: 2026-06-03_ciclo_sangramento_diario.sql
-- Adiciona rastreamento diário de sangramento em ciclo_sintomas_diarios.
-- absorventes_dia já existe — apenas as 5 novas colunas abaixo.
-- Retrocompatível (nullable / DEFAULT).
-- =============================================================

ALTER TABLE public.ciclo_sintomas_diarios
  ADD COLUMN IF NOT EXISTS sangramento_dia       text
    CHECK (sangramento_dia IN ('nao','escape','menstruacao')),
  ADD COLUMN IF NOT EXISTS cor_sangue_dia        text
    CHECK (cor_sangue_dia IN (
      'rosado','vermelho_vivo','vermelho_escuro','marrom','preto'
    )),
  ADD COLUMN IF NOT EXISTS intensidade_fluxo_dia text
    CHECK (intensidade_fluxo_dia IN (
      'leve','moderado','intenso','muito_intenso'
    )),
  ADD COLUMN IF NOT EXISTS coagulos_dia          text DEFAULT 'nao'
    CHECK (coagulos_dia IN ('nao','pequenos','moderados','grandes')),
  ADD COLUMN IF NOT EXISTS notas_sangramento_dia text;
