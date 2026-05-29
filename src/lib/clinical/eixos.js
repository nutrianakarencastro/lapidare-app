/**
 * BIBLIOTECA CLÍNICA ÚTERA — Etapas 1 e 2
 * Definição dos 8 eixos hormonais funcionais com sintomas e pesos clínicos.
 *
 * Premissa central (Etapa 1):
 *   - O sistema interpreta padrões, não sintomas isolados.
 *   - 4 ou mais sinais dentro de um eixo = possível desequilíbrio funcional.
 *   - Sintomas devem ser analisados dentro da fase do ciclo.
 *   - Recorrência é mais importante que episódios únicos.
 *   - Eixos podem coexistir simultaneamente.
 */

// ─── Estrutura de um sintoma ──────────────────────────────────────────────────
// {
//   id:     string  — chave única, usada pelo engine de scores
//   label:  string  — nome clínico exibível
//   peso:   1|2|3|4 — peso clínico (Etapa 2)
// }

export const EIXOS = {

  // ─────────────────────────────────────────────────────────────────────────
  estrogenico: {
    id: 'estrogenico',
    numero: 1,
    nome: 'Eixo Estrogênico',
    subtitulo: 'Dominância estrogênica / metabolização estrogênica comprometida',
    criterioAlerta: 4,
    cor: '#c4616e',
    corSoft: '#fdedef',
    sintomas: [
      { id: 'fluxo_intenso',            label: 'Fluxo menstrual intenso',                   peso: 3 },
      { id: 'coagulos',                 label: 'Coágulos',                                   peso: 4 },
      { id: 'colica_forte',             label: 'Cólica forte',                               peso: 3 },
      { id: 'dor_mamaria',              label: 'Dor mamária',                                peso: 3 },
      { id: 'edema_retencao',           label: 'Edema / retenção hídrica',                   peso: 2 },
      { id: 'enxaqueca_ciclica',        label: 'Enxaqueca cíclica',                          peso: 2 },
      { id: 'irritabilidade_premenstrual', label: 'Irritabilidade pré-menstrual',             peso: 1 },
      { id: 'acne_ciclica',             label: 'Acne cíclica',                               peso: 1 },
      { id: 'intestino_preso_lutea',    label: 'Intestino preso na fase lútea',              peso: 2 },
      { id: 'inchaco_corporal',         label: 'Sensação de inchaço corporal',               peso: 1 },
    ],
    interpretacaoClinica: [
      'Dominância estrogênica relativa',
      'Baixa oposição da progesterona',
      'Dificuldade de metabolização hepática',
      'Estroboloma alterado',
      'Maior recirculação intestinal de estrogênio',
      'Maior carga inflamatória',
    ],
    logicaClinica: [
      'Coágulos e fluxo intenso têm maior especificidade estrogênica',
      'Edema e irritabilidade isoladamente são inespecíficos',
      'Dor mamária associada a fluxo intenso aumenta relevância clínica',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  progesterona: {
    id: 'progesterona',
    numero: 2,
    nome: 'Eixo Progesterona',
    subtitulo: 'Fase lútea / baixa progesterona funcional',
    criterioAlerta: 4,
    cor: '#9b8b7a',
    corSoft: '#f2ede6',
    sintomas: [
      { id: 'insonia_lutea',            label: 'Insônia antes da menstruação',               peso: 3 },
      { id: 'ansiedade_premenstrual',   label: 'Ansiedade pré-menstrual',                    peso: 2 },
      { id: 'irritabilidade',           label: 'Irritabilidade',                             peso: 2 },
      { id: 'compulsao_doces',          label: 'Compulsão por doces',                        peso: 2 },
      { id: 'piora_humor_lutea',        label: 'Piora importante do humor na fase lútea',    peso: 3 },
      { id: 'spotting_premenstrual',    label: 'Spotting / escape antes da menstruação',     peso: 4 },
      { id: 'energia_baixa_premenstrual', label: 'Baixa energia pré-menstrual',             peso: 2 },
      { id: 'sensibilidade_emocional',  label: 'Sensibilidade emocional aumentada',          peso: 2 },
      { id: 'sono_fragmentado',         label: 'Sono leve ou fragmentado na fase lútea',     peso: 3 },
      { id: 'tolerancia_estresse_pior', label: 'Pior tolerância ao estresse',                peso: 2 },
    ],
    interpretacaoClinica: [
      'Baixa progesterona funcional',
      'Fase lútea insuficiente',
      'Ovulação fraca',
      'Pior modulação GABAérgica',
      'Maior impacto neuroquímico da fase lútea',
    ],
    logicaClinica: [
      'Spotting pré-menstrual é altamente sugestivo',
      'Insônia lútea recorrente tem alto valor clínico',
      'Humor isoladamente não deve disparar alerta forte',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  glicemico: {
    id: 'glicemico',
    numero: 3,
    nome: 'Eixo Glicêmico',
    subtitulo: 'Resistência à insulina / glicemia instável',
    criterioAlerta: 4,
    cor: '#c4a882',
    corSoft: '#faf3e8',
    sintomas: [
      { id: 'irritabilidade_jejum',     label: 'Irritabilidade quando fica sem comer',       peso: 3 },
      { id: 'tremor_ansiedade_jejum',   label: 'Tremores ou ansiedade em jejum',             peso: 4 },
      { id: 'desejo_doces',             label: 'Desejo intenso por doces',                   peso: 3 },
      { id: 'compulsao_final_dia',      label: 'Compulsão no final do dia',                  peso: 3 },
      { id: 'sonolencia_apos_refeicao', label: 'Sonolência após refeições',                  peso: 3 },
      { id: 'queda_energia_refeicoes',  label: 'Queda de energia entre refeições',           peso: 3 },
      { id: 'calorons_jejum',           label: 'Calorões associados a jejum',                peso: 2 },
      { id: 'piora_treino',             label: 'Piora do rendimento no treino',              peso: 2 },
      { id: 'fome_noturna',             label: 'Fome intensa ao acordar de madrugada',       peso: 3 },
      { id: 'inflamacao_carbo',         label: 'Sensação de corpo inflamado após carboidratos', peso: 2 },
    ],
    interpretacaoClinica: [
      'Glicemia instável',
      'Resistência à insulina',
      'Hipoglicemia reativa',
      'Pior flexibilidade metabólica',
      'Maior ativação de cortisol compensatório',
    ],
    logicaClinica: [
      'Tremor em jejum é muito sugestivo',
      'Compulsão isolada é menos específica',
      'Associação entre jejum + irritabilidade + doce aumenta força do eixo',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  adrenal: {
    id: 'adrenal',
    numero: 4,
    nome: 'Eixo Adrenal',
    subtitulo: 'Cortisol / estresse / recuperação',
    criterioAlerta: 4,
    cor: '#d4956a',
    corSoft: '#faeeda',
    sintomas: [
      { id: 'acordar_cansada',          label: 'Acordar cansada',                            peso: 3 },
      { id: 'insonia',                  label: 'Insônia',                                    peso: 3 },
      { id: 'despertares_noturnos',     label: 'Despertares noturnos',                       peso: 4 },
      { id: 'agitacao_cansaco',         label: 'Agitação com cansaço',                       peso: 4 },
      { id: 'ansiedade',                label: 'Ansiedade',                                  peso: 2 },
      { id: 'irritabilidade_adrenal',   label: 'Irritabilidade',                             peso: 2 },
      { id: 'compulsao_noturna',        label: 'Compulsão noturna',                          peso: 2 },
      { id: 'recuperacao_treino_ruim',  label: 'Baixa recuperação pós-treino',               peso: 3 },
      { id: 'dor_corporal',             label: 'Dores corporais frequentes',                 peso: 2 },
      { id: 'energia_instavel',         label: 'Energia instável ao longo do dia',           peso: 3 },
      { id: 'alerta_constante',         label: 'Sensação de alerta constante',               peso: 3 },
    ],
    interpretacaoClinica: [
      'Desregulação do cortisol',
      'Hiperativação do eixo HPA',
      'Fadiga de recuperação',
      'Sobrecarga fisiológica',
      'Baixa tolerância ao estresse',
    ],
    logicaClinica: [
      'Agitação + cansaço simultâneos têm grande relevância',
      'Despertar noturno recorrente pesa muito',
      'Irritabilidade isolada não é suficiente',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  intestinal: {
    id: 'intestinal',
    numero: 5,
    nome: 'Eixo Intestinal / Estroboloma',
    subtitulo: 'Intestino e metabolismo hormonal',
    criterioAlerta: 4,
    cor: '#7ea85a',
    corSoft: '#eef5e3',
    sintomas: [
      { id: 'constipacao',              label: 'Constipação',                                peso: 3 },
      { id: 'intestino_solto',          label: 'Intestino solto',                            peso: 2 },
      { id: 'alternancia_intestinal',   label: 'Alternância intestinal',                     peso: 4 },
      { id: 'gases',                    label: 'Gases',                                      peso: 2 },
      { id: 'distensao_abdominal',      label: 'Distensão abdominal',                        peso: 3 },
      { id: 'acne_persistente',         label: 'Acne persistente',                           peso: 2 },
      { id: 'colica_menstrual',         label: 'Cólica menstrual',                           peso: 2 },
      { id: 'fluxo_intenso_int',        label: 'Fluxo intenso',                              peso: 2 },
      { id: 'dor_mamaria_int',          label: 'Dor mamária',                                peso: 2 },
      { id: 'piora_hormonal_intestino', label: 'Piora hormonal quando intestino trava',      peso: 4 },
      { id: 'digestao_lenta',           label: 'Sensação de digestão lenta',                 peso: 3 },
    ],
    interpretacaoClinica: [
      'Disbiose intestinal',
      'Estroboloma alterado',
      'Maior recirculação estrogênica',
      'Inflamação intestinal',
      'Pior excreção hormonal',
      'Comprometimento da barreira intestinal',
    ],
    logicaClinica: [
      'Alternância intestinal tem alta relevância funcional',
      'Relação intestino ↔ sintomas hormonais aumenta peso',
      'Distensão recorrente é mais relevante que gases isolados',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  inflamatorio: {
    id: 'inflamatorio',
    numero: 6,
    nome: 'Eixo Inflamatório',
    subtitulo: 'Inflamação sistêmica funcional',
    criterioAlerta: 4,
    cor: '#993556',
    corSoft: '#fbeaf0',
    sintomas: [
      { id: 'colica_intensa',           label: 'Cólica intensa',                             peso: 3 },
      { id: 'enxaqueca',                label: 'Enxaqueca',                                  peso: 3 },
      { id: 'dor_articular',            label: 'Dor articular',                              peso: 3 },
      { id: 'edema',                    label: 'Edema',                                      peso: 2 },
      { id: 'acne_inflamatoria',        label: 'Acne inflamatória',                          peso: 3 },
      { id: 'fluxo_intenso_inf',        label: 'Fluxo intenso',                              peso: 2 },
      { id: 'coagulos_inf',             label: 'Coágulos',                                   peso: 2 },
      { id: 'fadiga_importante',        label: 'Fadiga importante',                          peso: 3 },
      { id: 'recuperacao_muscular_ruim', label: 'Pior recuperação muscular',                 peso: 2 },
      { id: 'corpo_dolorido',           label: 'Sensação de corpo dolorido',                 peso: 3 },
    ],
    interpretacaoClinica: [
      'Maior atividade inflamatória sistêmica',
      'Pior resposta antioxidante',
      'Maior carga inflamatória hormonal',
      'Inflamação intestinal associada',
    ],
    logicaClinica: [
      'Dor articular + fadiga aumentam suspeita inflamatória',
      'Acne inflamatória persistente tem peso importante',
      'Coágulo isolado não define eixo inflamatório',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  androgenico: {
    id: 'androgenico',
    numero: 7,
    nome: 'Eixo Androgênico',
    subtitulo: 'Hiperandrogenismo funcional',
    criterioAlerta: 3,
    cor: '#a08456',
    corSoft: '#faf3e8',
    sintomas: [
      { id: 'acne_mandibular',          label: 'Acne mandibular',                            peso: 4 },
      { id: 'oleosidade_excessiva',     label: 'Oleosidade excessiva',                       peso: 3 },
      { id: 'queda_cabelo',             label: 'Queda de cabelo',                            peso: 4 },
      { id: 'irregularidade_menstrual', label: 'Irregularidade menstrual',                   peso: 3 },
      { id: 'ciclos_anovulatorios',     label: 'Ciclos anovulatórios',                       peso: 4 },
      { id: 'dificuldade_perceber_ovulacao', label: 'Dificuldade de perceber ovulação',      peso: 2 },
      { id: 'muco_cervical_reduzido',   label: 'Pouco muco cervical fértil',                 peso: 2 },
      { id: 'aumento_pelos',            label: 'Aumento de pelos',                           peso: 4 },
      { id: 'piora_pele_ovulacao',      label: 'Piora de pele na ovulação / fase lútea',     peso: 2 },
      { id: 'compulsao_ri',             label: 'Compulsão associada à resistência insulínica', peso: 1 },
    ],
    interpretacaoClinica: [
      'Hiperandrogenismo funcional',
      'Resistência à insulina associada',
      'Sensibilidade tecidual androgênica',
      'Padrão compatível com SOP',
      'Maior atividade de 5-alfa-redutase',
    ],
    logicaClinica: [
      'Acne mandibular é altamente sugestiva',
      'Hirsutismo e anovulação têm peso muito alto',
      'Muco cervical sozinho tem pouca especificidade',
    ],
  },

  // ─────────────────────────────────────────────────────────────────────────
  perimenopausa: {
    id: 'perimenopausa',
    numero: 8,
    nome: 'Eixo Perimenopausa / Transição Hormonal',
    subtitulo: 'Transição menopausal e instabilidade neuroendócrina',
    criterioAlerta: 4,
    cor: '#7a6b84',
    corSoft: '#f0ecf5',
    sintomas: [
      { id: 'ciclos_irregulares',       label: 'Ciclos irregulares',                         peso: 3 },
      { id: 'ciclos_espacando',         label: 'Ciclos espaçando progressivamente',           peso: 4 },
      { id: 'amenorreia_temporaria',    label: 'Amenorreia temporária',                       peso: 4 },
      { id: 'fluxo_imprevisivel',       label: 'Fluxo imprevisível',                          peso: 3 },
      { id: 'mudanca_fluxo',            label: 'Mudança importante do fluxo',                 peso: 3 },
      { id: 'calorons',                 label: 'Calorões',                                    peso: 4 },
      { id: 'suor_noturno',             label: 'Suor noturno',                                peso: 4 },
      { id: 'insonia_peri',             label: 'Insônia',                                     peso: 3 },
      { id: 'irritabilidade_peri',      label: 'Irritabilidade',                              peso: 2 },
      { id: 'dor_articular_peri',       label: 'Dor articular',                               peso: 3 },
      { id: 'fadiga_peri',              label: 'Fadiga',                                      peso: 2 },
      { id: 'piora_enxaqueca',          label: 'Piora de enxaqueca',                          peso: 2 },
      { id: 'oscilacao_emocional',      label: 'Oscilação emocional',                         peso: 2 },
      { id: 'mudanca_metabolica',       label: 'Mudança metabólica inexplicável',              peso: 3 },
    ],
    progressao: {
      inicial: {
        label: 'Perimenopausa inicial',
        criterios: ['Ciclos variando ≥ 7 dias', 'Início de irregularidade', 'Sintomas oscilatórios leves'],
      },
      intermediaria: {
        label: 'Perimenopausa intermediária',
        criterios: ['Ciclos começando a espaçar', 'Períodos de 45–60 dias sem menstruar', 'Sintomas vasomotores mais presentes'],
      },
      tardia: {
        label: 'Perimenopausa tardia',
        criterios: ['Meses sem menstruar', 'Retorno ocasional do ciclo', 'Grande instabilidade hormonal', 'Piora importante de sono, humor e calorões'],
      },
      menopausa: {
        label: 'Menopausa provável',
        criterios: ['≥ 12 meses sem menstruar'],
      },
    },
    interpretacaoClinica: [
      'Transição menopausal',
      'Oscilação estrogênica importante',
      'Redução progressiva da progesterona',
      'Maior instabilidade neuroendócrina',
      'Alteração da estabilidade glicêmica e cortisol',
    ],
    logicaClinica: [
      'Calorões e suor noturno têm alta especificidade',
      'Espaçamento progressivo dos ciclos é altamente relevante',
      'Irregularidade isolada não fecha padrão peri',
    ],
  },
};

// ─── Princípios do sistema (Etapa 1) ─────────────────────────────────────────
export const PRINCIPIOS = [
  'O sistema deve interpretar padrões, não sintomas isolados',
  'Os sintomas devem ser analisados dentro da fase do ciclo',
  'A recorrência é mais importante do que episódios únicos',
  'Os eixos podem coexistir simultaneamente',
  'O sistema deve gerar consciência e responsabilização, não medo',
  'O objetivo é traduzir fisiologia feminina em linguagem compreensível e clínica',
];

// ─── Princípios dos pesos (Etapa 2) ──────────────────────────────────────────
export const PRINCIPIOS_PESOS = [
  'Sintomas inespecíficos nunca devem dominar o score',
  'Sintomas recorrentes devem ganhar mais peso futuramente',
  'Associação entre sintomas aumenta relevância clínica',
  'O sistema deve priorizar padrões ao longo do tempo',
  'Fases do ciclo modificam interpretação dos sintomas',
  'O objetivo é leitura funcional, não diagnóstico médico',
];

export default EIXOS;
