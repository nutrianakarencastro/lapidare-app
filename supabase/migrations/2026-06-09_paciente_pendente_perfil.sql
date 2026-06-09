-- =============================================================
-- Migration: 2026-06-09_paciente_pendente_perfil.sql
-- Atualiza handle_new_user para transferir cpf e whatsapp→telefone
-- na ativação da paciente pendente.
-- Idempotente — CREATE OR REPLACE, sem risco de downtime.
-- =============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role text := coalesce(new.raw_user_meta_data ->> 'role', '');
BEGIN
  IF v_role = 'nutri' THEN
    INSERT INTO public.nutris (id, nome, crn, email)
    VALUES (
      new.id,
      coalesce(new.raw_user_meta_data ->> 'nome', new.email),
      new.raw_user_meta_data ->> 'crn',
      new.email
    )
    ON CONFLICT (id) DO NOTHING;

  ELSIF v_role = 'paciente' THEN
    DECLARE
      v_nutri_id  uuid := (new.raw_user_meta_data ->> 'nutri_id')::uuid;
      v_pendente  public.pacientes_pendentes%rowtype;
    BEGIN
      SELECT * INTO v_pendente
      FROM public.pacientes_pendentes
      WHERE nutri_id = v_nutri_id AND lower(email) = lower(new.email)
      LIMIT 1;

      IF found THEN
        -- Paciente com convite: herda perfil preparado pela nutri.
        -- coalesce prioriza o que a paciente preencheu no signup.
        INSERT INTO public.pacientes (
          id, nutri_id, nome, email,
          objetivo, tipo_plano, modalidade, nascimento,
          cpf, telefone
        )
        VALUES (
          new.id,
          v_nutri_id,
          coalesce(new.raw_user_meta_data ->> 'nome',       v_pendente.nome,       new.email),
          new.email,
          coalesce(new.raw_user_meta_data ->> 'objetivo',   v_pendente.objetivo),
          coalesce(new.raw_user_meta_data ->> 'tipo_plano', v_pendente.tipo_plano),
          coalesce(new.raw_user_meta_data ->> 'modalidade', v_pendente.modalidade),
          coalesce((new.raw_user_meta_data ->> 'nascimento')::date, v_pendente.nascimento),
          v_pendente.cpf,
          v_pendente.whatsapp
        )
        ON CONFLICT (id) DO NOTHING;

        UPDATE public.pacientes_pendentes
          SET status = 'ativado'
          WHERE id = v_pendente.id;

      ELSE
        -- Sem convite prévio: apenas dados do signup.
        INSERT INTO public.pacientes (
          id, nutri_id, nome, email,
          objetivo, tipo_plano, modalidade, nascimento
        )
        VALUES (
          new.id,
          v_nutri_id,
          coalesce(new.raw_user_meta_data ->> 'nome', new.email),
          new.email,
          new.raw_user_meta_data ->> 'objetivo',
          new.raw_user_meta_data ->> 'tipo_plano',
          new.raw_user_meta_data ->> 'modalidade',
          (new.raw_user_meta_data ->> 'nascimento')::date
        )
        ON CONFLICT (id) DO NOTHING;
      END IF;
    END;
  END IF;

  RETURN new;
END;
$$;
