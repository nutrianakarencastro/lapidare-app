/**
 * BIBLIOTECA CLÍNICA ÚTERA — Etapa 3
 * Correlações funcionais entre eixos.
 *
 * Correlações mais poderosas para o app (priorizadas):
 *   1. Progesterona + glicemia
 *   2. Estrogênio + estroboloma
 *   3. Cortisol + sono
 *   4. SOP + resistência insulínica
 *   5. Perimenopausa
 *   6. Tireoide funcional
 *   7. Intestino + inflamação
 *   8. Estrogênio + retenção/inflamação
 *   9. Fase lútea + compulsão
 *  10. Cortisol + despertar noturno
 */

export const CORRELACOES = [

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'progesterona_glicemia',
    prioridade: 1,
    nome: 'Progesterona + Glicemia',
    eixos: ['progesterona', 'glicemico'],
    correlacaoForte: [
      'compulsão por doce',
      'irritabilidade',
      'ansiedade no fim do dia',
      'acordar de madrugada',
      'insônia',
      'TPM alimentar',
      'fome intensa na fase lútea',
      'oscilação energética',
    ],
    interpretacao: 'Possível pior tolerância neuroglicêmica associada à fase lútea.',
    racionalFisiologico: 'Na fase lútea ocorre aumento da demanda energética, maior necessidade serotoninérgica, alteração da sensibilidade à insulina e maior vulnerabilidade ao cortisol. Isso pode favorecer hipoglicemia reativa, cravings, despertares noturnos e desregulação de saciedade.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'estrogenio_estroboloma',
    prioridade: 2,
    nome: 'Estrogênio + Estroboloma',
    eixos: ['estrogenico', 'intestinal'],
    correlacaoForte: [
      'constipação',
      'coágulos menstruais',
      'fluxo intenso',
      'dor mamária',
      'distensão abdominal',
      'acne cíclica',
      'piora pré-menstrual',
      'sensação inflamatória',
    ],
    interpretacao: 'Possível recirculação estrogênica aumentada associada ao eixo intestino-fígado.',
    racionalFisiologico: 'Alterações intestinais podem aumentar beta-glucuronidase, reabsorção estrogênica e sobrecarga hepática funcional. A constipação é uma das associações mais frequentes clinicamente com sintomas de dominância estrogênica.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cortisol_sono',
    prioridade: 3,
    nome: 'Cortisol / HPA + Sono',
    eixos: ['adrenal'],
    correlacaoForte: [
      'acordar cansada',
      'sono leve',
      'ansiedade',
      'despertar noturno',
      'fadiga da tarde',
      'compulsão noturna',
      'dificuldade de emagrecimento',
      'tensão muscular',
    ],
    interpretacao: 'Possível desregulação do eixo HPA e ritmo cortisol-melatonina.',
    racionalFisiologico: 'Disfunções do eixo HPA podem alterar glicemia, sono, saciedade, resposta inflamatória e metabolismo tireoidiano e hormonal. Muito comum em pacientes com sobrecarga emocional, privação de sono, excesso de estímulo e inflamação crônica.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'sop_resistencia_insulinica',
    prioridade: 4,
    nome: 'SOP + Resistência Insulínica',
    eixos: ['androgenico', 'glicemico'],
    correlacaoForte: [
      'acne',
      'oleosidade',
      'aumento de pelos',
      'ciclos irregulares',
      'dificuldade de emagrecimento',
      'compulsão',
      'acúmulo abdominal',
      'queda de cabelo',
    ],
    interpretacao: 'Possível hiperandrogenismo funcional associado à resistência insulínica.',
    racionalFisiologico: 'A hiperinsulinemia pode estimular produção ovariana de andrógenos, redução de SHBG e maior testosterona livre. Clinicamente é muito frequente observar compulsão, inflamação, acne persistente, dificuldade metabólica e ciclos anovulatórios.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'perimenopausa',
    prioridade: 5,
    nome: 'Perimenopausa / Transição Hormonal',
    eixos: ['perimenopausa'],
    correlacaoForte: [
      'ciclos espaçando',
      'calorões',
      'suor noturno',
      'insônia',
      'ansiedade',
      'oscilação emocional',
      'pior recuperação',
      'fadiga',
      'aumento abdominal',
    ],
    interpretacao: 'Padrão compatível com transição menopausal.',
    racionalFisiologico: 'A perimenopausa cursa com oscilação estrogênica, queda progressiva de progesterona, maior vulnerabilidade metabólica e alterações do sono e termorregulação. Frequentemente associada a resistência insulínica, pior recuperação muscular, alterações cognitivas e aumento inflamatório.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'tireoide_funcional',
    prioridade: 6,
    nome: 'Eixo Tireoidiano Funcional',
    eixos: ['tireoidiano'],
    correlacaoForte: [
      'lentidão cognitiva e corporal',
      'frio excessivo',
      'queda de cabelo',
      'queda de sobrancelhas',
      'pele seca',
      'intestino lento',
      'energia muito baixa',
      'dificuldade de emagrecimento',
    ],
    interpretacao: 'Padrão compatível com hipofunção tireoidiana funcional.',
    racionalFisiologico: 'Baixa disponibilidade energética, inflamação crônica e estresse prolongado podem comprometer a conversão T4→T3, reduzir termogênese, desacelerar o trânsito intestinal e impactar o metabolismo energético basal. A queda do terço externo das sobrancelhas é sinal clínico de alta especificidade.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'intestino_inflamacao',
    prioridade: 7,
    nome: 'Intestino + Inflamação',
    eixos: ['intestinal', 'inflamatorio'],
    correlacaoForte: [
      'distensão abdominal',
      'constipação',
      'fadiga',
      'acne',
      'dor de cabeça',
      'névoa mental',
      'piora alimentar',
      'sensibilidade intestinal',
    ],
    interpretacao: 'Possível disbiose e aumento de atividade inflamatória intestinal.',
    racionalFisiologico: 'Alterações de microbiota podem impactar metabolismo hormonal, permeabilidade intestinal, inflamação sistêmica, neurotransmissores, saciedade e humor.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'estrogenio_retencao_inflamacao',
    prioridade: 8,
    nome: 'Estrogênio + Retenção / Inflamação',
    eixos: ['estrogenico', 'inflamatorio'],
    correlacaoForte: [
      'fluxo intenso',
      'coágulos',
      'dor mamária',
      'edema',
      'enxaqueca menstrual',
      'irritabilidade pré-menstrual',
      'piora da TPM',
      'sensibilidade emocional',
    ],
    interpretacao: 'Possível predominância estrogênica relativa.',
    racionalFisiologico: 'Maior estímulo estrogênico pode aumentar proliferação endometrial, retenção hídrica, atividade inflamatória, sensibilidade mamária e labilidade emocional. Frequentemente associado a baixa progesterona relativa, dificuldade de detoxificação hepática e recirculação intestinal de estrogênios.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'fase_lutea_compulsao',
    prioridade: 9,
    nome: 'Fase Lútea + Compulsão',
    eixos: ['progesterona', 'glicemico'],
    correlacaoForte: [
      'irritabilidade',
      'ansiedade',
      'compulsão alimentar',
      'insônia',
      'TPM intensa',
      'piora na fase lútea',
      'sensibilidade emocional',
      'retenção hídrica',
    ],
    interpretacao: 'Possível redução de suporte progesterônico e menor efeito gabaérgico na fase lútea.',
    racionalFisiologico: 'A progesterona participa da modulação do GABA, estabilidade emocional, qualidade do sono, controle de impulsividade e maior tolerância ao estresse. Oscilações ou queda relativa podem aumentar hiperexcitabilidade neuronal, desejo por carboidratos, pior tolerância glicêmica e despertares noturnos.',
  },

  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'cortisol_despertar_noturno',
    prioridade: 10,
    nome: 'Cortisol + Despertar Noturno',
    eixos: ['adrenal'],
    correlacaoForte: [
      'despertares noturnos',
      'ansiedade',
      'compulsão noturna',
      'acordar cansada',
      'agitação com cansaço',
    ],
    interpretacao: 'Possível desregulação do ritmo circadiano do cortisol.',
    racionalFisiologico: 'O cortisol elevado noturno interfere na qualidade do sono, aumenta o comportamento hedônico alimentar e compromete a recuperação fisiológica.',
  },
];

export default CORRELACOES;
