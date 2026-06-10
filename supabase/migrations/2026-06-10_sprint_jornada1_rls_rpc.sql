-- =============================================================
-- Jornada Sprint 1 — Corretiva: RLS e RPC
-- =============================================================
-- Corrige policies e RPC que usavam auth.uid() para identificar
-- a paciente clínica, em conflito com a arquitetura B.6 onde
-- pacientes.id ≠ auth.uid() para pacientes migradas.
-- Padrão correto: meu_paciente_id() (definida em B.2).
-- =============================================================

-- ── jornadas: leitura pela paciente ──────────────────────────
DROP POLICY IF EXISTS jornadas_paciente_select ON public.jornadas;
CREATE POLICY jornadas_paciente_select ON public.jornadas
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- ── jornada_historico: leitura pela paciente ─────────────────
DROP POLICY IF EXISTS jornada_historico_paciente_select ON public.jornada_historico;
CREATE POLICY jornada_historico_paciente_select ON public.jornada_historico
  FOR SELECT USING (paciente_id = meu_paciente_id());

-- ── paciente_marcar_meta: escrita da paciente via RPC ─────────
CREATE OR REPLACE FUNCTION public.paciente_marcar_meta(p_metas jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.jornadas
  SET    metas_semana = p_metas,
         updated_at   = now()
  WHERE  paciente_id = meu_paciente_id();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.paciente_marcar_meta(jsonb) FROM public;
GRANT  EXECUTE ON FUNCTION public.paciente_marcar_meta(jsonb) TO authenticated;
