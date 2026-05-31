export const OBJETIVOS_CLINICOS = [
  { id: 'saude_hormonal',         label: 'Saúde hormonal' },
  { id: 'sono_recuperacao',       label: 'Sono e recuperação' },
  { id: 'imunidade_antioxidante', label: 'Imunidade e antioxidante' },
  { id: 'saude_intestinal',       label: 'Saúde intestinal e microbiota' },
  { id: 'energia_metabolismo',    label: 'Energia e metabolismo' },
  { id: 'saude_ossea_articular',  label: 'Saúde óssea e articular' },
  { id: 'saude_cardiovascular',   label: 'Saúde cardiovascular' },
  { id: 'controle_glicemico',     label: 'Controle glicêmico e insulínico' },
  { id: 'pele_cabelo_unhas',      label: 'Pele, cabelo e unhas' },
  { id: 'funcao_cognitiva_humor', label: 'Função cognitiva e humor' },
  { id: 'anti_inflamatorio',      label: 'Anti-inflamatório' },
  { id: 'suporte_fertilidade',    label: 'Suporte à fertilidade' },
  { id: 'detox_eliminacao',       label: 'Detox e eliminação' },
  { id: 'composicao_corporal',    label: 'Composição corporal e sarcopenia' },
];

export function labelObjetivo(id) {
  return OBJETIVOS_CLINICOS.find(o => o.id === id)?.label ?? id;
}
