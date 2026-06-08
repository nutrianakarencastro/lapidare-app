-- =============================================================
-- Migration: 2026-06-08c_pacientes_telefone_cpf.sql
-- Adiciona telefone e cpf à tabela pacientes e pacientes_pendentes.
-- Atualiza a função de onboarding para copiar os novos campos.
-- =============================================================

-- ── 1. Novos campos em pacientes ─────────────────────────────

ALTER TABLE public.pacientes
  ADD COLUMN IF NOT EXISTS telefone text,
  ADD COLUMN IF NOT EXISTS cpf      text;

-- ── 2. Novo campo em pacientes_pendentes ─────────────────────
-- cpf já existe nessa tabela; apenas telefone é novo.

ALTER TABLE public.pacientes_pendentes
  ADD COLUMN IF NOT EXISTS telefone text;

-- ── 3. Atualizar função de onboarding ────────────────────────
-- Copia telefone e cpf de pacientes_pendentes para pacientes
-- no momento em que a paciente cria sua conta pelo link de convite.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
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
      v_nutri_id uuid := (new.raw_user_meta_data ->> 'nutri_id')::uuid;
      v_pendente public.pacientes_pendentes%rowtype;
      v_template record;
    BEGIN
      SELECT * INTO v_pendente
      FROM public.pacientes_pendentes
      WHERE nutri_id = v_nutri_id AND lower(email) = lower(new.email)
      LIMIT 1;

      IF FOUND THEN
        INSERT INTO public.pacientes
          (id, nutri_id, nome, email, objetivo, tipo_plano, modalidade, nascimento, telefone, cpf)
        VALUES (
          new.id,
          v_nutri_id,
          coalesce(new.raw_user_meta_data ->> 'nome',       v_pendente.nome,       new.email),
          new.email,
          coalesce(new.raw_user_meta_data ->> 'objetivo',   v_pendente.objetivo),
          coalesce(new.raw_user_meta_data ->> 'tipo_plano', v_pendente.tipo_plano),
          coalesce(new.raw_user_meta_data ->> 'modalidade', v_pendente.modalidade),
          coalesce((new.raw_user_meta_data ->> 'nascimento')::date, v_pendente.nascimento),
          v_pendente.telefone,
          v_pendente.cpf
        )
        ON CONFLICT (id) DO NOTHING;

        UPDATE public.pacientes_pendentes
          SET status = 'ativado'
          WHERE id = v_pendente.id;
      ELSE
        INSERT INTO public.pacientes
          (id, nutri_id, nome, email, objetivo, tipo_plano, modalidade, nascimento, telefone, cpf)
        VALUES (
          new.id,
          v_nutri_id,
          coalesce(new.raw_user_meta_data ->> 'nome', new.email),
          new.email,
          new.raw_user_meta_data ->> 'objetivo',
          new.raw_user_meta_data ->> 'tipo_plano',
          new.raw_user_meta_data ->> 'modalidade',
          (new.raw_user_meta_data ->> 'nascimento')::date,
          NULL,
          NULL
        )
        ON CONFLICT (id) DO NOTHING;
      END IF;

      FOR v_template IN
        SELECT id, nome, perguntas FROM public.checkin_templates
        WHERE nutri_id = v_nutri_id AND tipo = 'pre_consulta'
      LOOP
        INSERT INTO public.checkin_envios (nutri_id, paciente_id, nome, tipo, perguntas, enviado_em)
        VALUES (
          v_nutri_id, new.id,
          coalesce(v_template.nome, 'Check-in pré-consulta'),
          'pre_consulta', v_template.perguntas, now()
        );
      END LOOP;
    END;
  END IF;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
