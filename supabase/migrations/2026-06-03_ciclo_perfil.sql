-- =============================================================
-- Migration: 2026-06-03_ciclo_perfil.sql
-- Cria ciclo_perfil (perfil hormonal/reprodutivo da paciente).
-- Idempotente.
-- =============================================================

CREATE TABLE IF NOT EXISTS public.ciclo_perfil (
  paciente_id             uuid PRIMARY KEY
    REFERENCES auth.users(id) ON DELETE CASCADE,

  -- ── Situação do ciclo (o que acontece com a menstruação agora) ───
  situacao_ciclo          text NOT NULL DEFAULT 'menstrua_regularmente'
    CHECK (situacao_ciclo IN (
      'menstrua_regularmente',
      'ciclo_irregular',
      'ciclo_suprimido',
      'nao_menstrua',
      'outro'
    )),

  -- ── Estado hormonal / reprodutivo (contexto fisiológico) ────────
  estado_reprodutivo      text NOT NULL DEFAULT 'nenhum'
    CHECK (estado_reprodutivo IN (
      'nenhum',
      'perimenopausa',
      'menopausa',
      'gestante',
      'pos_parto',
      'outro'
    )),
  amamentando             boolean NOT NULL DEFAULT false,

  -- ── Contraceptivo ───────────────────────────────────────────────
  usa_contraceptivo       boolean NOT NULL DEFAULT false,
  contraceptivo_tipo      text
    CHECK (contraceptivo_tipo IN (
      'pilula','diu_hormonal','implante','injetavel','adesivo','anel_vaginal','outro'
    )),
  contraceptivo_nome      text,
  contraceptivo_continuo  boolean,
  contraceptivo_menstrua  boolean,
  contraceptivo_obs       text,

  -- ── TRH ─────────────────────────────────────────────────────────
  usa_trh                 boolean NOT NULL DEFAULT false,
  trh_tipo                text
    CHECK (trh_tipo IN (
      'estrogênio','progesterona','combinada','testosterona','outro'
    )),
  trh_via                 text
    CHECK (trh_via IN (
      'oral','transdermica','gel','adesivo','implante','outro'
    )),
  trh_obs                 text,

  -- ── Observações ─────────────────────────────────────────────────
  obs_geral               text,

  updated_at              timestamptz NOT NULL DEFAULT now()
);

-- ── RLS ─────────────────────────────────────────────────────────────

ALTER TABLE public.ciclo_perfil ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "paciente_all_ciclo_perfil"    ON public.ciclo_perfil;
DROP POLICY IF EXISTS "nutri_select_ciclo_perfil"    ON public.ciclo_perfil;
DROP POLICY IF EXISTS "nutri_upsert_ciclo_perfil"    ON public.ciclo_perfil;

-- Paciente: acesso total ao próprio perfil
CREATE POLICY "paciente_all_ciclo_perfil" ON public.ciclo_perfil
  FOR ALL USING (paciente_id = auth.uid()) WITH CHECK (paciente_id = auth.uid());

-- Nutri: leitura do perfil das suas pacientes
CREATE POLICY "nutri_select_ciclo_perfil" ON public.ciclo_perfil
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE id = paciente_id AND nutri_id = auth.uid()
    )
  );

-- Nutri: pode criar/atualizar perfil das suas pacientes
CREATE POLICY "nutri_upsert_ciclo_perfil" ON public.ciclo_perfil
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE id = paciente_id AND nutri_id = auth.uid()
    )
  );

CREATE POLICY "nutri_update_ciclo_perfil" ON public.ciclo_perfil
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.pacientes
      WHERE id = paciente_id AND nutri_id = auth.uid()
    )
  );
