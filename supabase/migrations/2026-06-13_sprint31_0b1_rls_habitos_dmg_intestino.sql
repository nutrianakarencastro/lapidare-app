-- =============================================================
-- Migration: 2026-06-13_sprint31_0b1_rls_habitos_dmg_intestino.sql
-- Sprint 31.0B.1 — Correção RLS: hábitos, DMG, módulos, intestino
--
-- Corrige policies e RPC que ainda usam paciente_id = auth.uid()
-- em conflito com a arquitetura pós Sprint B.1, onde:
--   pacientes.id    ≠ auth.uid()   (para pacientes novas)
--   pacientes.auth_user_id = auth.uid()
--
-- Padrão correto: meu_paciente_id() — SECURITY DEFINER definida
-- em 2026-06-09_b2_paciente_rpcs.sql.
--
-- Tabelas corrigidas nesta sprint:
--   1. habitos              — SELECT
--   2. habitos_logs         — SELECT + ALL (write)
--   3. paciente_marcar_habito_e_meta() — RPC reescrita
--   4. diario_glicemico    — SELECT + INSERT + UPDATE
--   5. paciente_modulos    — SELECT
--   6. intestino_logs      — ALL
--   7. intestino_rastreio_solicitacoes — SELECT + UPDATE
--
-- Idempotente: DROP POLICY IF EXISTS antes de cada CREATE.
-- Não altera dados, índices ou schema de colunas.
-- =============================================================


-- =============================================================
-- 1. habitos — SELECT
-- =============================================================

DROP POLICY IF EXISTS habitos_select ON public.habitos;
CREATE POLICY habitos_select ON public.habitos
  FOR SELECT USING (
    paciente_id = meu_paciente_id()
    OR nutri_id = auth.uid()
  );


-- =============================================================
-- 2. habitos_logs — SELECT + ALL
-- =============================================================

DROP POLICY IF EXISTS habitos_logs_select ON public.habitos_logs;
CREATE POLICY habitos_logs_select ON public.habitos_logs
  FOR SELECT USING (
    paciente_id = meu_paciente_id()
    OR EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.id = habitos_logs.paciente_id
        AND p.nutri_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS habitos_logs_write_paciente ON public.habitos_logs;
CREATE POLICY habitos_logs_write_paciente ON public.habitos_logs
  FOR ALL
  USING    (paciente_id = meu_paciente_id())
  WITH CHECK (paciente_id = meu_paciente_id());


-- =============================================================
-- 3. paciente_marcar_habito_e_meta() — RPC reescrita
--
-- Problema original: usava auth.uid() em três pontos:
--   (a) validação do hábito → fail silencioso para paciente nova
--   (b) INSERT em habitos_logs → paciente_id errado (ID fantasma)
--   (c) UPDATE em jornadas → não encontrava a linha
--
-- Correção: resolve meu_paciente_id() uma única vez no início
-- e usa v_paciente_id em todos os pontos subsequentes.
-- =============================================================

CREATE OR REPLACE FUNCTION public.paciente_marcar_habito_e_meta(
  p_habito_id uuid,
  p_valor     numeric,
  p_data      date DEFAULT current_date
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id uuid := meu_paciente_id();
BEGIN
  -- Guarda nula → encerra sem efeito (paciente não identificada)
  IF v_paciente_id IS NULL THEN
    RETURN;
  END IF;

  -- Valida que o hábito pertence a esta paciente e está ativo.
  IF NOT EXISTS (
    SELECT 1 FROM public.habitos
    WHERE id         = p_habito_id
      AND paciente_id = v_paciente_id
      AND ativo       = true
  ) THEN
    RETURN;
  END IF;

  -- 1. Registrar ou remover o log do hábito.
  IF p_valor > 0 THEN
    INSERT INTO public.habitos_logs (habito_id, paciente_id, data, valor)
    VALUES (p_habito_id, v_paciente_id, p_data, p_valor)
    ON CONFLICT (habito_id, data) DO UPDATE SET valor = EXCLUDED.valor;
  ELSE
    DELETE FROM public.habitos_logs
    WHERE habito_id   = p_habito_id
      AND paciente_id = v_paciente_id
      AND data        = p_data;
  END IF;

  -- 2. Sincronizar meta vinculada na jornada ativa (hábito → meta).
  --    Se não houver jornada ativa ou meta vinculada, UPDATE afeta 0 linhas.
  UPDATE public.jornadas
  SET
    metas_semana = (
      SELECT COALESCE(
        jsonb_agg(
          CASE
            WHEN (m ->> 'habito_id') = p_habito_id::text
            THEN jsonb_set(m, '{concluida}', to_jsonb(p_valor > 0))
            ELSE m
          END
        ),
        '[]'::jsonb
      )
      FROM jsonb_array_elements(metas_semana) m
    ),
    updated_at = now()
  WHERE paciente_id = v_paciente_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.paciente_marcar_habito_e_meta(uuid, numeric, date) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_marcar_habito_e_meta(uuid, numeric, date) TO authenticated;


-- =============================================================
-- 4. diario_glicemico — SELECT + INSERT + UPDATE
-- =============================================================

DROP POLICY IF EXISTS "paciente_diario_select" ON public.diario_glicemico;
DROP POLICY IF EXISTS "paciente_diario_insert" ON public.diario_glicemico;
DROP POLICY IF EXISTS "paciente_diario_update" ON public.diario_glicemico;

CREATE POLICY "paciente_diario_select" ON public.diario_glicemico
  FOR SELECT USING (paciente_id = meu_paciente_id());

CREATE POLICY "paciente_diario_insert" ON public.diario_glicemico
  FOR INSERT WITH CHECK (paciente_id = meu_paciente_id());

CREATE POLICY "paciente_diario_update" ON public.diario_glicemico
  FOR UPDATE
  USING    (paciente_id = meu_paciente_id())
  WITH CHECK (paciente_id = meu_paciente_id());

-- nutri_diario_glicemico_read: não alterada (já usa EXISTS + nutri_id = auth.uid())


-- =============================================================
-- 5. paciente_modulos — SELECT
-- =============================================================

DROP POLICY IF EXISTS "paciente_modulos_read" ON public.paciente_modulos;
CREATE POLICY "paciente_modulos_read" ON public.paciente_modulos
  FOR SELECT USING (paciente_id = meu_paciente_id());


-- =============================================================
-- 6. intestino_logs — ALL
-- =============================================================

DROP POLICY IF EXISTS "paciente_intestino_all" ON public.intestino_logs;
CREATE POLICY "paciente_intestino_all" ON public.intestino_logs
  FOR ALL
  USING    (paciente_id = meu_paciente_id())
  WITH CHECK (paciente_id = meu_paciente_id());

-- nutri_intestino_read: não alterada (já usa EXISTS + nutri_id = auth.uid())


-- =============================================================
-- 7. intestino_rastreio_solicitacoes — SELECT + UPDATE
-- =============================================================

DROP POLICY IF EXISTS "paciente_rastreio_read"   ON public.intestino_rastreio_solicitacoes;
DROP POLICY IF EXISTS "paciente_rastreio_update" ON public.intestino_rastreio_solicitacoes;

CREATE POLICY "paciente_rastreio_read" ON public.intestino_rastreio_solicitacoes
  FOR SELECT USING (paciente_id = meu_paciente_id());

CREATE POLICY "paciente_rastreio_update" ON public.intestino_rastreio_solicitacoes
  FOR UPDATE USING (paciente_id = meu_paciente_id());

-- nutri_rastreio_all: não alterada (já usa nutri_id = auth.uid() + EXISTS)
