-- =============================================================
-- Sprint 23.1 — Estratégias Terapêuticas
-- =============================================================
-- Experimentos clínicos temporários propostos pela nutri,
-- acompanhados pela paciente com registro diário.
-- Princípio: registrar para compreender, não para controlar.
-- =============================================================

-- ── 1. Tabela principal ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.estrategias (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nutri_id          uuid        NOT NULL REFERENCES public.nutris(id)    ON DELETE CASCADE,
  paciente_id       uuid        NOT NULL REFERENCES public.pacientes(id) ON DELETE CASCADE,

  titulo            text        NOT NULL,
  objetivo          text,
  categoria         text        CHECK (categoria IN (
                                  'Alimentação', 'Sono', 'Suplementação', 'Movimento',
                                  'Intestino', 'Bem-estar emocional', 'Autocuidado'
                                )),

  frequencia_tipo   text        CHECK (frequencia_tipo IN ('diaria', 'dias_uteis', 'semanal', 'personalizada')),
  frequencia_valor  text,       -- ex: "3" para semanal, "seg, qua e sex" para personalizada

  data_inicio       date        NOT NULL DEFAULT CURRENT_DATE,
  data_fim          date,       -- null = sem prazo; encerramento manual via status

  mensagem_paciente text,       -- visível à paciente no app
  observacoes_nutri text,       -- interno — nunca exposto à paciente
  aprendizados      text,       -- preenchido pela nutri ao encerrar (conclusão clínica)

  status            text        NOT NULL DEFAULT 'ativa'
                                CHECK (status IN ('ativa', 'encerrada')),
  encerrada_em      timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estrategias_paciente
  ON public.estrategias(paciente_id, status);
CREATE INDEX IF NOT EXISTS idx_estrategias_nutri
  ON public.estrategias(nutri_id, paciente_id);

-- ── 2. Logs diários da paciente ───────────────────────────────

CREATE TABLE IF NOT EXISTS public.estrategia_logs (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  estrategia_id  uuid        NOT NULL REFERENCES public.estrategias(id) ON DELETE CASCADE,
  paciente_id    uuid        NOT NULL REFERENCES public.pacientes(id)   ON DELETE CASCADE,

  data           date        NOT NULL DEFAULT CURRENT_DATE,
  aconteceu      text        NOT NULL CHECK (aconteceu IN ('sim', 'parcialmente', 'nao')),
  dificuldade    text        CHECK (dificuldade IN ('facil', 'desafiador', 'muito_dificil')),
  observacoes    text,

  created_at     timestamptz NOT NULL DEFAULT now(),

  UNIQUE (estrategia_id, data)
);

CREATE INDEX IF NOT EXISTS idx_estrategia_logs_paciente
  ON public.estrategia_logs(paciente_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_estrategia_logs_estrategia
  ON public.estrategia_logs(estrategia_id, data DESC);

-- ── 3. RLS ────────────────────────────────────────────────────

ALTER TABLE public.estrategias     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estrategia_logs ENABLE ROW LEVEL SECURITY;

-- Nutri: acesso total às estratégias das suas pacientes
DROP POLICY IF EXISTS estrategias_nutri ON public.estrategias;
CREATE POLICY estrategias_nutri ON public.estrategias
  FOR ALL USING (nutri_id = auth.uid()) WITH CHECK (nutri_id = auth.uid());

-- Paciente: somente leitura das próprias estratégias
DROP POLICY IF EXISTS estrategias_paciente_select ON public.estrategias;
CREATE POLICY estrategias_paciente_select ON public.estrategias
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- Nutri: acesso total aos logs das suas pacientes (via join com estrategia)
DROP POLICY IF EXISTS estrategia_logs_nutri ON public.estrategia_logs;
CREATE POLICY estrategia_logs_nutri ON public.estrategia_logs
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.estrategias e
      WHERE e.id = estrategia_id
        AND e.nutri_id = auth.uid()
    )
  );

-- Paciente: somente leitura dos próprios logs
DROP POLICY IF EXISTS estrategia_logs_paciente_select ON public.estrategia_logs;
CREATE POLICY estrategia_logs_paciente_select ON public.estrategia_logs
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- ── 4. RPC: registro diário pela paciente ─────────────────────
-- Valida que a estratégia pertence à paciente e está ativa.
-- ON CONFLICT permite editar o registro do mesmo dia.

CREATE OR REPLACE FUNCTION public.paciente_registrar_estrategia(
  p_estrategia_id uuid,
  p_aconteceu     text,
  p_dificuldade   text DEFAULT NULL,
  p_observacoes   text DEFAULT NULL,
  p_data          date DEFAULT CURRENT_DATE
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.estrategias
    WHERE id          = p_estrategia_id
      AND paciente_id = meu_paciente_id()
      AND status      = 'ativa'
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.estrategia_logs
    (estrategia_id, paciente_id, data, aconteceu, dificuldade, observacoes)
  VALUES
    (p_estrategia_id, meu_paciente_id(), p_data, p_aconteceu, p_dificuldade, p_observacoes)
  ON CONFLICT (estrategia_id, data) DO UPDATE
    SET aconteceu   = EXCLUDED.aconteceu,
        dificuldade = EXCLUDED.dificuldade,
        observacoes = EXCLUDED.observacoes;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.paciente_registrar_estrategia(uuid, text, text, text, date) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_registrar_estrategia(uuid, text, text, text, date) TO authenticated;
