-- ─────────────────────────────────────────────────────────────────────────────
-- Sprint Além da Nutrição
-- Biblioteca global de recomendações da nutri para todas as pacientes
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS alem_nutricao_itens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nutri_id      uuid NOT NULL REFERENCES nutris(id) ON DELETE CASCADE,

  categoria     text NOT NULL CHECK (categoria IN (
                  'cosmeticos', 'higiene', 'casa', 'trocas', 'conteudos'
                )),
  titulo        text NOT NULL,
  marca         text,
  descricao     text,
  links         jsonb NOT NULL DEFAULT '[]',   -- [{ "titulo": text, "url": text }]
  imagem_url    text,
  destaque      boolean NOT NULL DEFAULT false,
  ativo         boolean NOT NULL DEFAULT true,
  ordem         smallint NOT NULL DEFAULT 0,

  criado_em     timestamptz DEFAULT now(),
  atualizado_em timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alem_nutricao_nutri_ativo
  ON alem_nutricao_itens(nutri_id, ativo, ordem, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_alem_nutricao_categoria
  ON alem_nutricao_itens(nutri_id, categoria, ativo);

-- Trigger: atualiza atualizado_em automaticamente
CREATE OR REPLACE FUNCTION set_atualizado_em_alem_nutricao()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.atualizado_em = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_alem_nutricao_atualizado_em ON alem_nutricao_itens;
CREATE TRIGGER trg_alem_nutricao_atualizado_em
  BEFORE UPDATE ON alem_nutricao_itens
  FOR EACH ROW EXECUTE FUNCTION set_atualizado_em_alem_nutricao();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE alem_nutricao_itens ENABLE ROW LEVEL SECURITY;

-- Nutri: CRUD completo nos seus próprios itens
CREATE POLICY "nutri_alem_nutricao_all" ON alem_nutricao_itens
  FOR ALL USING (nutri_id = auth.uid())
  WITH CHECK (nutri_id = auth.uid());

-- Paciente: SELECT nos itens ativos da sua nutri
CREATE POLICY "paciente_alem_nutricao_read" ON alem_nutricao_itens
  FOR SELECT USING (
    ativo = true AND
    EXISTS (
      SELECT 1 FROM pacientes
      WHERE pacientes.id = auth.uid()
        AND pacientes.nutri_id = alem_nutricao_itens.nutri_id
    )
  );
