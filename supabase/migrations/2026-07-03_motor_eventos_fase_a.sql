-- =============================================================
-- Migration: 2026-07-03_motor_eventos_fase_a.sql
-- Motor de Eventos do Útera — Fase A (núcleo)
--
-- Cria a infraestrutura base do Motor de Eventos:
--   tabela eventos, índices, RLS e as três RPCs fundacionais.
--
-- O que NÃO está aqui (V2):
--   grupo, prioridade, fecha_ao_ler, cancelado_em, reabertura,
--   lógica diferenciada por tipo, Central de Eventos, badges.
--
-- Fase B (primeira integração com feedback) é etapa separada.
-- Idempotente.
-- =============================================================


-- ── 1. Tabela ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.eventos (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Contexto clínico (sempre presente)
  paciente_id       UUID        NOT NULL
    REFERENCES public.pacientes(id) ON DELETE CASCADE,

  -- Classificação do evento
  categoria         TEXT        NOT NULL,
  tipo              TEXT        NOT NULL,
  origem            TEXT        NOT NULL,

  -- Referência ao objeto original (permite navegação via event resolver)
  referencia_tipo   TEXT,
  referencia_id     UUID,

  -- Autoria
  autor_tipo        TEXT        NOT NULL
    CHECK (autor_tipo IN ('nutri', 'paciente', 'sistema', 'ia')),
  autor_id          UUID,

  -- Destinatário
  destinatario_tipo TEXT        NOT NULL
    CHECK (destinatario_tipo IN ('nutri', 'paciente')),
  destinatario_id   UUID,

  -- Conteúdo
  titulo            TEXT        NOT NULL,
  descricao         TEXT,
  metadata          JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Ciclo de vida
  status            TEXT        NOT NULL DEFAULT 'ativo'
    CHECK (status IN ('ativo', 'lido', 'encerrado', 'cancelado')),
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  lido_em           TIMESTAMPTZ,
  encerrado_em      TIMESTAMPTZ,

  -- Deduplicação (sem UNIQUE — lógica de dedup fica exclusivamente na RPC)
  dedup_key         TEXT
);


-- ── 2. Índices ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_eventos_paciente_status
  ON public.eventos (paciente_id, status);

CREATE INDEX IF NOT EXISTS idx_eventos_destinatario
  ON public.eventos (destinatario_tipo, destinatario_id);

CREATE INDEX IF NOT EXISTS idx_eventos_tipo
  ON public.eventos (tipo);

CREATE INDEX IF NOT EXISTS idx_eventos_criado_em
  ON public.eventos (criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_eventos_referencia
  ON public.eventos (referencia_tipo, referencia_id);

CREATE INDEX IF NOT EXISTS idx_eventos_dedup_key
  ON public.eventos (dedup_key)
  WHERE dedup_key IS NOT NULL;


-- ── 3. RLS ────────────────────────────────────────────────────

ALTER TABLE public.eventos ENABLE ROW LEVEL SECURITY;

-- Paciente vê seus próprios eventos
DROP POLICY IF EXISTS "paciente_ve_seus_eventos" ON public.eventos;
CREATE POLICY "paciente_ve_seus_eventos"
  ON public.eventos FOR SELECT TO authenticated
  USING (
    destinatario_tipo = 'paciente'
    AND destinatario_id = meu_paciente_id()
  );

-- Nutri vê todos os eventos de suas pacientes
-- (inclui eventos destinados à paciente — permite visão clínica completa)
DROP POLICY IF EXISTS "nutri_ve_eventos_suas_pacientes" ON public.eventos;
CREATE POLICY "nutri_ve_eventos_suas_pacientes"
  ON public.eventos FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id        = eventos.paciente_id
        AND p.nutri_id  = auth.uid()
    )
  );

-- Nutri vê eventos destinados a ela diretamente
DROP POLICY IF EXISTS "nutri_ve_seus_eventos" ON public.eventos;
CREATE POLICY "nutri_ve_seus_eventos"
  ON public.eventos FOR SELECT TO authenticated
  USING (
    destinatario_tipo = 'nutri'
    AND (destinatario_id = auth.uid() OR destinatario_id IS NULL)
  );

-- INSERT bloqueado diretamente — apenas via criar_evento() (SECURITY DEFINER)
DROP POLICY IF EXISTS "eventos_sem_insert_direto" ON public.eventos;
CREATE POLICY "eventos_sem_insert_direto"
  ON public.eventos FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE bloqueado diretamente — apenas via RPCs (SECURITY DEFINER)
DROP POLICY IF EXISTS "eventos_sem_update_direto" ON public.eventos;
CREATE POLICY "eventos_sem_update_direto"
  ON public.eventos FOR UPDATE TO authenticated
  USING (false);


-- ── 4. RPC criar_evento() ─────────────────────────────────────
--
-- Camada única de criação de eventos.
-- Todos os módulos devem usar esta função — nunca INSERT direto.
--
-- Deduplicação:
--   Se dedup_key for fornecida e já existir um evento ativo ou lido
--   com essa chave, retorna o id existente sem criar duplicata.

DROP FUNCTION IF EXISTS public.criar_evento(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT,
  TEXT, UUID, UUID, TEXT, UUID, JSONB, TEXT
);

CREATE OR REPLACE FUNCTION public.criar_evento(
  p_paciente_id         UUID,
  p_categoria           TEXT,
  p_tipo                TEXT,
  p_origem              TEXT,
  p_titulo              TEXT,
  p_autor_tipo          TEXT,
  p_destinatario_tipo   TEXT,
  p_descricao           TEXT    DEFAULT NULL,
  p_autor_id            UUID    DEFAULT NULL,
  p_destinatario_id     UUID    DEFAULT NULL,
  p_referencia_tipo     TEXT    DEFAULT NULL,
  p_referencia_id       UUID    DEFAULT NULL,
  p_metadata            JSONB   DEFAULT '{}',
  p_dedup_key           TEXT    DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_evento_id  UUID;
  v_status     TEXT;
BEGIN
  -- Deduplicação: evento ativo ou lido com a mesma chave → retorna existente
  IF p_dedup_key IS NOT NULL THEN
    SELECT id, status INTO v_evento_id, v_status
    FROM public.eventos
    WHERE dedup_key = p_dedup_key
    LIMIT 1;

    IF FOUND AND v_status IN ('ativo', 'lido') THEN
      RETURN v_evento_id;
    END IF;
  END IF;

  INSERT INTO public.eventos (
    paciente_id,
    categoria,
    tipo,
    origem,
    titulo,
    descricao,
    metadata,
    autor_tipo,
    autor_id,
    destinatario_tipo,
    destinatario_id,
    referencia_tipo,
    referencia_id,
    dedup_key
  ) VALUES (
    p_paciente_id,
    p_categoria,
    p_tipo,
    p_origem,
    p_titulo,
    p_descricao,
    p_metadata,
    p_autor_tipo,
    p_autor_id,
    p_destinatario_tipo,
    p_destinatario_id,
    p_referencia_tipo,
    p_referencia_id,
    p_dedup_key
  )
  RETURNING id INTO v_evento_id;

  RETURN v_evento_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.criar_evento FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.criar_evento TO authenticated;


-- ── 5. RPC marcar_evento_lido() ──────────────────────────────
--
-- Autorização interna:
--   Paciente só marca eventos destinados a ela.
--   Nutri pode marcar eventos de suas pacientes.

DROP FUNCTION IF EXISTS public.marcar_evento_lido(UUID);

CREATE OR REPLACE FUNCTION public.marcar_evento_lido(
  p_evento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.eventos e
  SET
    lido_em = NOW(),
    status  = 'lido'
  WHERE e.id       = p_evento_id
    AND e.lido_em  IS NULL
    AND e.status   = 'ativo'
    AND (
      -- Paciente marcando seu próprio evento
      (e.destinatario_tipo = 'paciente' AND e.destinatario_id = meu_paciente_id())
      OR
      -- Nutri marcando evento de sua paciente
      EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE p.id       = e.paciente_id
          AND p.nutri_id = auth.uid()
      )
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.marcar_evento_lido FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.marcar_evento_lido TO authenticated;


-- ── 6. RPC encerrar_evento() ─────────────────────────────────
--
-- Autorização interna:
--   Apenas a nutri responsável pela paciente pode encerrar.
--   Encerrar implica marcar lido_em se ainda não tiver.

DROP FUNCTION IF EXISTS public.encerrar_evento(UUID);

CREATE OR REPLACE FUNCTION public.encerrar_evento(
  p_evento_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.eventos e
  SET
    status       = 'encerrado',
    encerrado_em = NOW(),
    lido_em      = COALESCE(e.lido_em, NOW())
  WHERE e.id     = p_evento_id
    AND e.status NOT IN ('encerrado', 'cancelado')
    AND EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id       = e.paciente_id
        AND p.nutri_id = auth.uid()
    );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.encerrar_evento FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.encerrar_evento TO authenticated;
