-- =============================================================
-- B.2 — Migração de pendentes + RPCs auxiliares
-- =============================================================
-- 1. Migra pacientes_pendentes não ativadas para pacientes
-- 2. Cria meu_paciente_id() — retorna pacientes.id via auth_user_id
-- 3. Cria buscar_paciente_por_token() — lookup público para signup
-- Idempotente. Sem alteração de RLS ou frontend.
-- =============================================================

-- ── 1. Migrar pacientes_pendentes → pacientes ─────────────────────────────────
-- Migra apenas registros não ativados.
-- NOT EXISTS previne duplicata por (nutri_id, email).
-- 'ativado' em pacientes_pendentes → já existe em pacientes, ignorar.

INSERT INTO public.pacientes (
  id,
  nutri_id,
  nome,
  email,
  objetivo,
  tipo_plano,
  modalidade,
  nascimento,
  cpf,
  telefone,
  obs,
  status_app,
  token,
  created_at
)
SELECT
  gen_random_uuid(),
  pp.nutri_id,
  pp.nome,
  pp.email,
  pp.objetivo,
  pp.tipo_plano,
  pp.modalidade,
  pp.nascimento,
  pp.cpf,
  pp.whatsapp,     -- whatsapp → telefone
  pp.obs,
  CASE pp.status
    WHEN 'pendente' THEN 'nao_convidada'
    WHEN 'enviado'  THEN 'convite_enviado'
    ELSE                 'nao_convidada'
  END,
  pp.token,
  pp.created_at
FROM public.pacientes_pendentes pp
WHERE pp.status IN ('pendente', 'enviado')
  AND NOT EXISTS (
    SELECT 1
    FROM public.pacientes p
    WHERE lower(p.email) = lower(pp.email)
      AND p.nutri_id = pp.nutri_id
  );

-- Relatório da migração
DO $$
DECLARE
  n_migradas   int;
  n_ignoradas  int;
BEGIN
  SELECT count(*) INTO n_migradas
    FROM public.pacientes
    WHERE auth_user_id IS NULL
      AND status_app IN ('nao_convidada', 'convite_enviado');

  SELECT count(*) INTO n_ignoradas
    FROM public.pacientes_pendentes
    WHERE status IN ('pendente', 'enviado')
      AND EXISTS (
        SELECT 1 FROM public.pacientes p
        WHERE lower(p.email) = lower(pacientes_pendentes.email)
          AND p.nutri_id = pacientes_pendentes.nutri_id
      );

  RAISE NOTICE 'B.2 migração: % pacientes migradas de pendentes. % ignoradas por duplicata.', n_migradas, n_ignoradas;
END $$;


-- ── 2. meu_paciente_id() ─────────────────────────────────────────────────────
-- Retorna pacientes.id da paciente autenticada, via auth_user_id.
-- Usada nas políticas RLS da fase B.5.
-- Retorna NULL se não encontrar (paciente não ativa / não autenticada).

CREATE OR REPLACE FUNCTION public.meu_paciente_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id
  FROM public.pacientes
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.meu_paciente_id() FROM public;
GRANT  EXECUTE ON FUNCTION public.meu_paciente_id() TO authenticated;


-- ── 3. buscar_paciente_por_token() ───────────────────────────────────────────
-- Lookup público pelo token de convite.
-- Substitui buscar_pendente_por_token na fase B.3.
-- Retorna apenas pacientes sem auth_user_id (não ativadas).
-- Acessível por anon para o fluxo de signup sem conta.

CREATE OR REPLACE FUNCTION public.buscar_paciente_por_token(p_token uuid)
RETURNS TABLE (
  nome        text,
  email       text,
  nascimento  date,
  objetivo    text,
  tipo_plano  text,
  modalidade  text,
  nutri_id    uuid,
  nutri_nome  text,
  status_app  text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.nome,
    p.email,
    p.nascimento,
    p.objetivo,
    p.tipo_plano,
    p.modalidade,
    p.nutri_id,
    n.nome  AS nutri_nome,
    p.status_app
  FROM public.pacientes p
  JOIN public.nutris    n ON n.id = p.nutri_id
  WHERE p.token        = p_token
    AND p.auth_user_id IS NULL
    AND p.status_app  IN ('nao_convidada', 'convite_enviado')
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.buscar_paciente_por_token(uuid) FROM public;
GRANT  EXECUTE ON FUNCTION public.buscar_paciente_por_token(uuid) TO anon, authenticated;
