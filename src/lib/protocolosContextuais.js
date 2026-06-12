// Mapeamento categoria_clinica → IDs de protocolos sugeridos.
// Ordem dos IDs = prioridade de exibição.
// A função filtra contra o índice real — IDs inválidos são silenciosamente ignorados.

const MAPA = {
  sop:                     ['sop', 'obesidade', 'dominancia-estrogenica', 'constipacao'],
  gestacional:             ['diabetes-gestacional', 'fertilidade', 'constipacao'],
  perimenopausa:           ['perimenopausa', 'cortisol', 'insonia', 'osteopenia', 'obesidade'],
  menopausa:               ['pos-menopausa', 'osteopenia', 'insonia', 'cortisol', 'obesidade'],
  hormonios:               ['dominancia-estrogenica', 'tpm', 'cortisol', 'ansiedade-depressao'],
  fertilidade_tentantes:   ['fertilidade', 'dominancia-estrogenica', 'hipotireoidismo', 'endometriose'],
  pos_parto:               ['constipacao', 'insonia', 'ansiedade-depressao', 'hipotireoidismo'],
  endometriose_adenomiose: ['endometriose', 'dominancia-estrogenica', 'constipacao', 'sop'],
  obesidade_feminina:      ['obesidade', 'cortisol', 'insonia', 'glp1'],
  intestino:               ['constipacao', 'endometriose', 'dominancia-estrogenica', 'sop'],
  longevidade_feminina:    ['osteopenia', 'perimenopausa', 'cortisol', 'insonia', 'obesidade'],
  nutricao_clinica_geral:  ['constipacao', 'ansiedade-depressao', 'hipotireoidismo', 'cortisol'],
};

// Recebe a categoria_clinica da paciente e o array PROTOCOLOS_INDEX.
// Retorna os objetos de protocolo sugeridos, na ordem do mapeamento.
export function protocolosSugeridos(categoriaClinica, index) {
  if (!categoriaClinica) return [];
  const ids = MAPA[categoriaClinica] ?? [];
  return ids
    .map(id => index.find(p => p.id === id))
    .filter(Boolean);
}
