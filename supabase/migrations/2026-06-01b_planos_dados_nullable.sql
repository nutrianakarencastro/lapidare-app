-- =============================================================
-- Migration: 2026-06-01b_planos_dados_nullable.sql
-- Torna a coluna dados nullable em planos e listas_compras,
-- permitindo registros criados apenas com PDF (sem JSON).
-- =============================================================

ALTER TABLE public.planos
  ALTER COLUMN dados DROP NOT NULL;

ALTER TABLE public.listas_compras
  ALTER COLUMN dados DROP NOT NULL;
