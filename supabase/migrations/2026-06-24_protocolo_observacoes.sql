-- Sprint 28.1 — Observação Clínica sobre Protocolos
-- Registros da nutricionista sobre aplicação, barreiras, perfil e adesão

CREATE TABLE public.protocolo_observacoes (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nutri_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protocolo_id text        NOT NULL,
  categoria    text        NOT NULL
                           CHECK (categoria IN (
                             'resposta_clinica', 'barreira', 'perfil', 'sequencia', 'adesao'
                           )),
  observacao   text        NOT NULL,
  origem       text        NOT NULL
                           CHECK (origem IN (
                             'consulta', 'atendimento', 'analise_posterior'
                           )),
  created_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.protocolo_observacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nutri_all_protocolo_observacoes"
  ON public.protocolo_observacoes
  FOR ALL
  USING   (nutri_id = auth.uid())
  WITH CHECK (nutri_id = auth.uid());

CREATE INDEX protocolo_observacoes_nutri_idx
  ON public.protocolo_observacoes (nutri_id, protocolo_id, created_at DESC);
