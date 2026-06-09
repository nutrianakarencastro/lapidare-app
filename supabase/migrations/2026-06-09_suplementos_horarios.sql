-- =============================================================
-- Migration: 2026-06-09_suplementos_horarios.sql
-- Adiciona campo horarios TIME[] à tabela suplementos.
-- Permite múltiplos horários de lembrete por suplemento.
-- O campo horario (text) existente é preservado.
-- Idempotente.
-- =============================================================

ALTER TABLE public.suplementos
  ADD COLUMN IF NOT EXISTS horarios TIME[] DEFAULT '{}';
