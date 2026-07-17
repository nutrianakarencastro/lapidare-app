-- =============================================================
-- Migration: 2026-07-17_v2_2_prefs_first_transition_timestamps.sql
-- Arquitetura da Atenção V2 — Sprint V2.2 (semântica de timestamps)
--
-- Ajusta o CASE do UPSERT em set_preferencia_push para que
-- push_ativado_em e push_desativado_em representem a PRIMEIRA
-- transição para cada estado (imutáveis após gravados), em vez de
-- refletirem a última chamada da RPC.
--
-- Regra permanente:
--   - transição false→true: preencher push_ativado_em apenas se ainda
--     estiver NULL; caso contrário, preservar o valor original.
--   - true→true (idempotente): manter push_ativado_em inalterado.
--   - transição true→false: preencher push_desativado_em apenas se
--     ainda estiver NULL; caso contrário, preservar.
--   - false→false: manter push_desativado_em inalterado.
--
-- Consequência: cada timestamp é gravado uma única vez na vida da
-- linha (na primeira transição para aquele estado). Se um dia for
-- necessário registrar "última confirmação da preferência", deve ser
-- outro conceito e outro campo — jamais reaproveitar estes.
--
-- Motivação: push_ativado_em deve representar a primeira concessão
-- de consentimento da paciente, valor de auditoria imutável, não
-- carimbo da última vez que a preferência foi salva.
--
-- Não altera assinatura, contrato ou ACL — apenas o corpo. RPC
-- redefinida via CREATE OR REPLACE.
--
-- Idempotente.
-- =============================================================


CREATE OR REPLACE FUNCTION public.set_preferencia_push(
  p_categoria_atencao TEXT,
  p_ativo             BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paciente_id UUID;
BEGIN
  v_paciente_id := meu_paciente_id();

  IF v_paciente_id IS NULL
     OR p_categoria_atencao IS NULL
     OR p_categoria_atencao = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.preferencias_atencao (
    paciente_id, categoria_atencao, push_ativo,
    push_ativado_em, push_desativado_em, atualizado_em
  ) VALUES (
    v_paciente_id, p_categoria_atencao, p_ativo,
    CASE WHEN p_ativo THEN NOW() ELSE NULL END,
    CASE WHEN p_ativo THEN NULL ELSE NOW() END,
    NOW()
  )
  ON CONFLICT (paciente_id, categoria_atencao) DO UPDATE SET
    push_ativo         = EXCLUDED.push_ativo,
    push_ativado_em    = CASE
                          WHEN EXCLUDED.push_ativo
                            THEN COALESCE(preferencias_atencao.push_ativado_em, NOW())
                          ELSE preferencias_atencao.push_ativado_em
                        END,
    push_desativado_em = CASE
                          WHEN NOT EXCLUDED.push_ativo
                            THEN COALESCE(preferencias_atencao.push_desativado_em, NOW())
                          ELSE preferencias_atencao.push_desativado_em
                        END,
    atualizado_em      = NOW();
END $$;
