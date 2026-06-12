-- =============================================================
-- Migration: 2026-06-12_paciente_protocolos.sql
-- Sprint 30.4 — Protocolos Aplicados
-- Registra decisões clínicas de aplicação de protocolo a paciente.
-- protocolo_id é texto estático (sem FK) — protocolos vivem em código.
-- Idempotente.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.paciente_protocolos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  paciente_id         uuid        NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,
  nutri_id            uuid        NOT NULL REFERENCES auth.users(id)       ON DELETE CASCADE,
  protocolo_id        text        NOT NULL,
  status              text        NOT NULL DEFAULT 'ativo'
                        CHECK (status IN ('ativo', 'concluido')),
  aplicado_em         date        NOT NULL DEFAULT CURRENT_DATE,
  concluido_em        date,
  revisar_em          date,
  observacoes         text,
  motivo_conclusao    text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Impede dois registros ativos do mesmo protocolo para a mesma paciente.
-- Permite ciclos: aplicar → concluir → reaplicar.
CREATE UNIQUE INDEX IF NOT EXISTS paciente_protocolos_unico_ativo
  ON public.paciente_protocolos(paciente_id, protocolo_id)
  WHERE status = 'ativo';

CREATE INDEX IF NOT EXISTS paciente_protocolos_paciente_idx
  ON public.paciente_protocolos(paciente_id, status, aplicado_em DESC);

-- ── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.paciente_protocolos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutri_all_paciente_protocolos" ON public.paciente_protocolos
  FOR ALL
  USING   (nutri_id = auth.uid())
  WITH CHECK (nutri_id = auth.uid());

-- Paciente sem acesso — decisão clínica interna.
