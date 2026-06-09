-- =============================================================
-- B.3 — Auth flow: ativação por vinculação, sem criação
-- =============================================================
-- Reescreve handle_new_user para o novo paradigma:
-- "Toda paciente nasce pela nutri."
--
-- Ativação = vincular auth.uid() ao prontuário existente.
-- Sem fallback INSERT. RAISE EXCEPTION em toda falha.
--
-- Validações no fluxo 'paciente':
--   1. Token fornecido em metadata
--   2. Paciente existe (encontrada pelo token)
--   3. Email corresponde ao registro
--   4. auth_user_id IS NULL (não ativada ainda)
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role     text := coalesce(new.raw_user_meta_data ->> 'role', '');
  v_token    uuid;
  v_paciente public.pacientes%rowtype;
BEGIN

  -- ── Nutricionista ─────────────────────────────────────────────────────────
  IF v_role = 'nutri' THEN
    INSERT INTO public.nutris (id, nome, crn, email)
    VALUES (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'nome', new.email),
      new.raw_user_meta_data ->> 'crn',
      new.email
    )
    ON CONFLICT (id) DO NOTHING;

  -- ── Paciente ──────────────────────────────────────────────────────────────
  ELSIF v_role = 'paciente' THEN

    -- 1. Token obrigatório
    BEGIN
      v_token := (new.raw_user_meta_data ->> 'token')::uuid;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Token de convite inválido. Use o link de convite enviado pela sua nutricionista.';
    END;

    IF v_token IS NULL THEN
      RAISE EXCEPTION 'Token de convite não fornecido. Use o link de convite enviado pela sua nutricionista.';
    END IF;

    -- 2. Localizar paciente pelo token
    SELECT * INTO v_paciente
    FROM public.pacientes
    WHERE token = v_token;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Link de convite inválido ou expirado. Solicite um novo link à sua nutricionista.';
    END IF;

    -- 3. Validar que o email corresponde ao convite
    IF lower(v_paciente.email) != lower(new.email) THEN
      RAISE EXCEPTION 'O email não corresponde ao convite. Use o email: %', v_paciente.email;
    END IF;

    -- 4. Verificar que a conta ainda não foi ativada
    IF v_paciente.auth_user_id IS NOT NULL THEN
      RAISE EXCEPTION 'Esta conta já foi ativada. Acesse pelo login em /paciente/login';
    END IF;

    -- 5. Tudo válido — ativar: vincular identidade ao prontuário
    UPDATE public.pacientes
      SET auth_user_id = new.id,
          status_app   = 'ativa'
      WHERE id = v_paciente.id;

  END IF;

  RETURN new;
END;
$$;
