-- =============================================================
-- B.6 Recovery — pacientes_pendentes → public.pacientes
-- =============================================================
-- Contexto: após B.6 o frontend passou a listar somente
-- public.pacientes. Linhas de pacientes_pendentes com status
-- 'pendente' ou 'enviado' que ainda não existiam em
-- public.pacientes sumiram da UI.
--
-- Esta migration recupera essas linhas de forma segura:
--   • Não duplica por (nutri_id, email)
--   • Preserva o token original — links já enviados continuam válidos
--   • Mapeia status: pendente → nao_convidada | enviado → convite_enviado
--   • Não apaga pacientes_pendentes
--   • Idempotente: rodar duas vezes não produz efeito adicional
-- =============================================================

DO $$
DECLARE
  n_elegiveis int;
  n_migradas  int;
  n_restantes int;
BEGIN

  -- ── Elegíveis antes da migração ──────────────────────────────
  SELECT count(*) INTO n_elegiveis
  FROM public.pacientes_pendentes pp
  WHERE pp.status IN ('pendente', 'enviado')
    AND NOT EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.nutri_id     = pp.nutri_id
        AND lower(p.email) = lower(pp.email)
    );

  -- ── Inserção ─────────────────────────────────────────────────
  INSERT INTO public.pacientes (
    id,
    nutri_id,
    nome,
    email,
    telefone,
    cpf,
    nascimento,
    objetivo,
    tipo_plano,
    modalidade,
    obs,
    token,
    status_app,
    created_at
  )
  SELECT
    gen_random_uuid(),
    pp.nutri_id,
    pp.nome,
    lower(pp.email),
    COALESCE(pp.telefone, pp.whatsapp),          -- telefone adicionado em 2026-06-08c; whatsapp é o campo legado
    pp.cpf,
    pp.nascimento,
    pp.objetivo,
    pp.tipo_plano,
    pp.modalidade,
    pp.obs,
    COALESCE(pp.token, gen_random_uuid()),        -- preserva token para links já enviados
    CASE pp.status
      WHEN 'enviado'  THEN 'convite_enviado'
      ELSE                 'nao_convidada'
    END,
    pp.created_at
  FROM public.pacientes_pendentes pp
  WHERE pp.status IN ('pendente', 'enviado')
    AND NOT EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.nutri_id     = pp.nutri_id
        AND lower(p.email) = lower(pp.email)
    )
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS n_migradas = ROW_COUNT;

  -- ── Verificação pós-migração ──────────────────────────────────
  SELECT count(*) INTO n_restantes
  FROM public.pacientes_pendentes pp
  WHERE pp.status IN ('pendente', 'enviado')
    AND NOT EXISTS (
      SELECT 1 FROM public.pacientes p
      WHERE p.nutri_id     = pp.nutri_id
        AND lower(p.email) = lower(pp.email)
    );

  RAISE NOTICE 'B.6 Recovery concluído. Elegíveis: %. Migradas: %. Sem correspondência após: %.',
    n_elegiveis, n_migradas, n_restantes;

END $$;


-- =============================================================
-- Queries de validação — rodar após a migration
-- =============================================================

-- 1. Quantas linhas existem em pacientes_pendentes com status pendente/enviado
-- SELECT count(*) AS total_pendentes
-- FROM public.pacientes_pendentes
-- WHERE status IN ('pendente', 'enviado');

-- 2. Quantas foram migradas para public.pacientes (match por nutri_id + email)
-- SELECT count(*) AS total_migradas
-- FROM public.pacientes_pendentes pp
-- JOIN public.pacientes p
--   ON p.nutri_id = pp.nutri_id
--  AND lower(p.email) = lower(pp.email)
-- WHERE pp.status IN ('pendente', 'enviado')
--   AND p.status_app IN ('nao_convidada', 'convite_enviado');

-- 3. Quais ainda ficaram sem correspondência em public.pacientes (deve ser 0)
-- SELECT pp.id, pp.nutri_id, pp.nome, pp.email, pp.status, pp.created_at
-- FROM public.pacientes_pendentes pp
-- WHERE pp.status IN ('pendente', 'enviado')
--   AND NOT EXISTS (
--     SELECT 1 FROM public.pacientes p
--     WHERE p.nutri_id     = pp.nutri_id
--       AND lower(p.email) = lower(pp.email)
--   )
-- ORDER BY pp.created_at;
