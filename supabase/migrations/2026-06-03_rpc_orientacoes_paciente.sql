-- =============================================================
-- RPC SECURITY DEFINER para leitura de orientações da paciente
-- Contorna ambiguidade na policy paciente_select_orientacoes onde
-- `id` no EXISTS poderia ser resolvido como orientacoes_pacientes.id
-- em vez de orientacoes.id, bloqueando o SELECT silenciosamente.
-- =============================================================

CREATE OR REPLACE FUNCTION public.get_orientacoes_da_paciente()
RETURNS TABLE (
  atribuicao_id          uuid,
  status                 text,
  visto_pela_paciente_em timestamptz,
  atribuido_em           timestamptz,
  orientacao_id          uuid,
  titulo                 text,
  descricao              text,
  categoria              text,
  subcategoria           text,
  tags                   text[],
  thumbnail_path         text,
  thumbnail_nome         text,
  pdf_path               text,
  pdf_nome               text,
  video_url              text,
  audio_path             text,
  audio_nome             text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    op.id                    AS atribuicao_id,
    op.status,
    op.visto_pela_paciente_em,
    op.atribuido_em,
    op.orientacao_id,
    o.titulo,
    o.descricao,
    o.categoria,
    o.subcategoria,
    o.tags,
    o.thumbnail_path,
    o.thumbnail_nome,
    o.pdf_path,
    o.pdf_nome,
    o.video_url,
    o.audio_path,
    o.audio_nome
  FROM public.orientacoes_pacientes op
  JOIN public.orientacoes o ON o.id = op.orientacao_id
  WHERE op.paciente_id = auth.uid()
  ORDER BY op.atribuido_em DESC;
END;
$$;
