-- =============================================================
-- Migration: 2026-07-09_v2_infraestrutura_emissao.sql
-- Arquitetura da Atenção V2 — Sprint V2.1 (infraestrutura de emissão)
--
-- Cria a tabela evento_entregas, índices, RLS e a RPC
-- registrar_emissoes, que permite gravar a intenção de emissão
-- para superfícies emissivas (push, e-mail, whatsapp).
--
-- O que NÃO está aqui (deliberado):
--   - Preferências de Atenção (próxima sprint, junto com opt-in).
--   - RPCs de atualização de status da entrega
--     (marcar_entrega_enviada, marcar_entrega_falhou) — só entram
--     quando existir Adapter real.
--   - Nenhuma integração com provedor externo.
--
-- Especificado em:
--   - ARQUITETURA_DA_ATENCAO_V2.md §§ 8, 13
--
-- Idempotente.
-- =============================================================


-- ── 1. Tabela ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.evento_entregas (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Vínculo com o evento canônico (fonte de verdade)
  evento_id    UUID        NOT NULL
    REFERENCES public.eventos(id) ON DELETE CASCADE,

  -- Superfície emissiva alvo
  superficie   TEXT        NOT NULL
    CHECK (superficie IN ('push', 'email', 'whatsapp')),

  -- Estado de execução
  status       TEXT        NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviado', 'falhou')),

  -- Payload congelado — resolvido pela Camada de Emissão no momento
  -- da criação. Não muda se o Catálogo for atualizado depois.
  payload      JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Metadata extensível — reservada para provider, device, retries,
  -- correlação de logs. Vazio no MVP; preserva evolução futura sem
  -- alteração estrutural.
  metadata     JSONB       NOT NULL DEFAULT '{}'::jsonb,

  -- Timestamps do ciclo de vida
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tentado_em   TIMESTAMPTZ,
  entregue_em  TIMESTAMPTZ,

  -- Erro estruturado (quando status = 'falhou')
  erro         JSONB,

  -- Chave lógica de idempotência (Arquitetura V2 §8)
  UNIQUE (evento_id, superficie)
);


-- ── 2. Índices ────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_evento_entregas_evento
  ON public.evento_entregas (evento_id);

CREATE INDEX IF NOT EXISTS idx_evento_entregas_superficie_status
  ON public.evento_entregas (superficie, status);

-- Índice parcial: só cresce enquanto há trabalho pendente. Zero custo
-- quando tudo está 'enviado' ou 'falhou'. Serve ao Adapter futuro.
CREATE INDEX IF NOT EXISTS idx_evento_entregas_pendentes
  ON public.evento_entregas (status, criado_em)
  WHERE status = 'pendente';


-- ── 3. RLS ────────────────────────────────────────────────────

ALTER TABLE public.evento_entregas ENABLE ROW LEVEL SECURITY;

-- Nutri vê entregas de eventos de suas pacientes.
-- Paciente NÃO vê evento_entregas no MVP (§7 do plano V2.1):
--   é estado interno da arquitetura, sem UI que consuma.
DROP POLICY IF EXISTS "nutri_ve_entregas_suas_pacientes" ON public.evento_entregas;
CREATE POLICY "nutri_ve_entregas_suas_pacientes"
  ON public.evento_entregas FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.eventos e
      JOIN public.pacientes p ON p.id = e.paciente_id
      WHERE e.id = evento_entregas.evento_id
        AND p.nutri_id = auth.uid()
    )
  );

-- INSERT direto bloqueado — apenas via registrar_emissoes() (SECURITY DEFINER)
DROP POLICY IF EXISTS "evento_entregas_sem_insert_direto" ON public.evento_entregas;
CREATE POLICY "evento_entregas_sem_insert_direto"
  ON public.evento_entregas FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE direto bloqueado — reservado para RPCs futuras do Adapter
DROP POLICY IF EXISTS "evento_entregas_sem_update_direto" ON public.evento_entregas;
CREATE POLICY "evento_entregas_sem_update_direto"
  ON public.evento_entregas FOR UPDATE TO authenticated
  USING (false);

-- DELETE bloqueado — histórico é imutável (simetria com eventos)
DROP POLICY IF EXISTS "evento_entregas_sem_delete_direto" ON public.evento_entregas;
CREATE POLICY "evento_entregas_sem_delete_direto"
  ON public.evento_entregas FOR DELETE TO authenticated
  USING (false);


-- ── 4. RPC registrar_emissoes ─────────────────────────────────

DROP FUNCTION IF EXISTS public.registrar_emissoes(UUID, JSONB);

CREATE OR REPLACE FUNCTION public.registrar_emissoes(
  p_evento_id UUID,
  p_emissoes  JSONB
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_autorizado BOOLEAN;
  v_inseridos  INT := 0;
  v_item       JSONB;
BEGIN
  -- Autorização interna: apenas nutri responsável pelo paciente do evento
  -- pode registrar emissões. Silent no-op se não autorizada, coerente com
  -- o padrão best-effort do Motor de Eventos (marcar_evento_lido).
  SELECT EXISTS (
    SELECT 1
    FROM public.eventos e
    JOIN public.pacientes p ON p.id = e.paciente_id
    WHERE e.id = p_evento_id
      AND p.nutri_id = auth.uid()
  ) INTO v_autorizado;

  IF NOT v_autorizado THEN
    RETURN 0;
  END IF;

  -- p_emissoes é um array JSON de objetos:
  --   [{ "superficie": "push", "payload": {...}, "metadata": {...} }, ...]
  -- payload e metadata são opcionais — default para '{}'.
  FOR v_item IN SELECT jsonb_array_elements(p_emissoes) LOOP
    INSERT INTO public.evento_entregas (evento_id, superficie, payload, metadata)
    VALUES (
      p_evento_id,
      v_item->>'superficie',
      COALESCE(v_item->'payload',  '{}'::jsonb),
      COALESCE(v_item->'metadata', '{}'::jsonb)
    )
    ON CONFLICT (evento_id, superficie) DO NOTHING;

    IF FOUND THEN
      v_inseridos := v_inseridos + 1;
    END IF;
  END LOOP;

  RETURN v_inseridos;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.registrar_emissoes FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.registrar_emissoes TO authenticated;


-- ── 5. Comentários explícitos na tabela ───────────────────────

COMMENT ON TABLE public.evento_entregas IS
  'Estado de execução das superfícies emissivas (Arquitetura da Atenção V2 §8). '
  'Uma linha por (evento × superfície). Não é política — apenas registro de intenção e resultado.';

COMMENT ON COLUMN public.evento_entregas.payload IS
  'Payload congelado no momento da resolução pela Camada de Emissão. '
  'Não muda se o Catálogo for atualizado depois — preserva auditoria.';

COMMENT ON COLUMN public.evento_entregas.metadata IS
  'Metadata extensível — reservada para provider, device, retries, correlação de logs. '
  'Vazio no MVP; preserva evolução futura sem alteração estrutural.';
