-- =============================================================
-- Sprint Jornada 6B — Publicação de Narrativa pela Nutri
--
-- Adiciona os campos de aprovação à jornada_historico.
-- A nutri revisa, edita e publica a narrativa_automatica.
-- A paciente só vê narrativa_aprovada quando narrativa_publicada = true.
-- Fallback: evolucao_resumida.
--
-- narrativa_publicada separa "texto salvo" de "visível à paciente":
--   publicar  → narrativa_aprovada = texto, narrativa_aprovada_em = now(),
--               narrativa_publicada = true
--   ocultar   → narrativa_publicada = false
--               (texto e timestamp preservados para republicação)
--
-- Sem nova RPC: nutri já tem FOR ALL em jornada_historico.
-- Sem alteração de RLS.
-- Sem alteração de snapshot_clinico, fase_metricas ou motor 6A.
-- =============================================================

ALTER TABLE public.jornada_historico
  ADD COLUMN IF NOT EXISTS narrativa_aprovada    text        NULL,
  ADD COLUMN IF NOT EXISTS narrativa_aprovada_em timestamptz NULL,
  ADD COLUMN IF NOT EXISTS narrativa_publicada   boolean     NOT NULL DEFAULT false;
