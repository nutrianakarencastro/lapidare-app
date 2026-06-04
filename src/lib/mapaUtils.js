import { EIXOS } from './cicloUtils.js';
import {
  calcularFaseDoCiclo, calcularScoresHormonais, gerarAlertas, detectarCorrelacoes,
  classificarEstagioPeri,
} from './cicloUtils.js';
import { calcularScoreIntestinal } from './intestinoUtils.js';

// ─────────────────────────────────────────────────────────────────────────────
// DISCLAIMER obrigatório para exibição à paciente
// ─────────────────────────────────────────────────────────────────────────────

export const DISCLAIMER = 'Esta análise é uma estimativa funcional baseada nos dados registrados e não substitui avaliação médica ou diagnóstico.';

// ─────────────────────────────────────────────────────────────────────────────
// LINGUAGEM AMIGÁVEL — paciente vê labels e explicações acolhedoras
// ─────────────────────────────────────────────────────────────────────────────

export const EIXOS_PACIENTE = {
  glicemico: {
    labelAmigavel: 'Energia & Açúcar',
    icon: 'bolt',
    cor: '#c4a882',
    corSoft: '#faf3e8',
    descricao: 'Como seu corpo usa a energia dos alimentos ao longo do dia.',
    intensidades: {
      leve:          'Sua energia parece estável — ótimo sinal metabólico.',
      moderado:      'Algumas oscilações de energia ao longo do dia. Vale observar horários de refeição.',
      elevado:       'Oscilações frequentes de energia. Seu corpo pode estar pedindo mais equilíbrio glicêmico.',
      muito_elevado: 'Padrão de instabilidade energética constante. Merece atenção nutricional prioritária.',
    },
  },
  adrenal: {
    labelAmigavel: 'Estresse & Sono',
    icon: 'moon',
    cor: '#d4956a',
    corSoft: '#faeeda',
    descricao: 'Como seu corpo está lidando com o estresse e recuperando durante o sono.',
    intensidades: {
      leve:          'Seu sistema de estresse parece equilibrado — continue cuidando do seu sono.',
      moderado:      'Sinais de que seu sistema de estresse está trabalhando mais do que o ideal.',
      elevado:       'Seu corpo está sobrecarregado. Sono e recuperação merecem atenção.',
      muito_elevado: 'Padrão de exaustão adrenal. Priorize descanso e fale com sua nutri.',
    },
  },
  estrogenico: {
    labelAmigavel: 'Equilíbrio Estrogênico',
    icon: 'wave-sine',
    cor: '#c4616e',
    corSoft: '#fdedef',
    descricao: 'Como seu estrogênio está sendo produzido e eliminado pelo seu corpo.',
    intensidades: {
      leve:          'Bom equilíbrio estrogênico nos dados registrados.',
      moderado:      'Alguns sinais de desequilíbrio estrogênico. Observar padrão ao longo do ciclo.',
      elevado:       'Padrão sugestivo de excesso de estrogênio ou dificuldade de eliminação.',
      muito_elevado: 'Sinais importantes de desequilíbrio estrogênico. Converse com sua nutri.',
    },
  },
  progesterona: {
    labelAmigavel: 'Progesterona & Humor',
    icon: 'heart',
    cor: '#9b8b7a',
    corSoft: '#f2ede6',
    descricao: 'Como a progesterona influencia seu humor e sono, especialmente na fase pré-menstrual.',
    intensidades: {
      leve:          'Sua fase lútea parece tranquila — boa sinalização de progesterona.',
      moderado:      'Alguns sinais de queda de progesterona na fase pré-menstrual.',
      elevado:       'Padrão de baixa progesterona funcional. Humor e sono antes da menstruação merecem atenção.',
      muito_elevado: 'Sinais marcantes de fase lútea insuficiente. Converse com sua nutri.',
    },
  },
  androgenico: {
    labelAmigavel: 'Androgênios & Pele',
    icon: 'flame',
    cor: '#a08456',
    corSoft: '#faf3e8',
    descricao: 'Como os hormônios androgênicos afetam sua pele, cabelo e ciclo.',
    intensidades: {
      leve:          'Boa regulação androgênica nos dados registrados.',
      moderado:      'Alguns sinais de androgênios elevados. Observar pele e ciclo.',
      elevado:       'Padrão sugestivo de hiperandrogenismo funcional. Acne e cabelo merecem atenção.',
      muito_elevado: 'Sinais marcantes de androgênios elevados. Converse com sua nutri.',
    },
  },
  intestinal: {
    labelAmigavel: 'Intestino & Hormônios',
    icon: 'leaf',
    cor: '#7ea85a',
    corSoft: '#eef5e3',
    descricao: 'Como seu intestino influencia o equilíbrio hormonal e a eliminação de toxinas.',
    intensidades: {
      leve:          'Seu intestino parece estar funcionando bem — ótimo para o equilíbrio hormonal.',
      moderado:      'Alguns sinais de alteração intestinal que podem impactar os hormônios.',
      elevado:       'Seu intestino pode estar dificultando a eliminação de hormônios.',
      muito_elevado: 'Padrão intestinal que merece atenção prioritária na sua nutrição.',
    },
  },
  inflamatorio: {
    labelAmigavel: 'Inflamação',
    icon: 'alert-triangle',
    cor: '#993556',
    corSoft: '#fbeaf0',
    descricao: 'O nível de inflamação que seu corpo está carregando nos últimos dias.',
    intensidades: {
      leve:          'Sinais de boa resposta anti-inflamatória nos dados registrados.',
      moderado:      'Alguns sinais inflamatórios presentes — observe alimentação e qualidade do sono.',
      elevado:       'Padrão inflamatório relevante. Alimentação e descanso merecem atenção.',
      muito_elevado: 'Carga inflamatória importante. Converse com sua nutri sobre estratégias de suporte.',
    },
  },
  perimenopausa: {
    labelAmigavel: 'Transição Hormonal',
    icon: 'moon-stars',
    cor: '#7a6b84',
    corSoft: '#f0ecf5',
    descricao: 'Sinais de transição hormonal que podem indicar uma mudança no seu ciclo de vida.',
    intensidades: {
      leve:          'Poucos sinais de transição hormonal nos dados.',
      moderado:      'Alguns sinais de transição hormonal presentes.',
      elevado:       'Padrão sugestivo de transição menopausal. Converse com sua nutri.',
      muito_elevado: 'Sinais marcantes de transição hormonal. Suporte especializado é importante.',
    },
  },
  tireoidiano: {
    labelAmigavel: 'Tireoide & Metabolismo',
    icon: 'thermometer',
    cor: '#5b8fa8',
    corSoft: '#e8f2f8',
    descricao: 'Como sua tireoide pode estar influenciando seu metabolismo e disposição.',
    intensidades: {
      leve:          'Poucos sinais de alteração tireoidiana nos dados registrados.',
      moderado:      'Alguns sinais que merecem observação — frio, cansaço e queda de cabelo.',
      elevado:       'Padrão sugestivo de hipofunção tireoidiana funcional. Converse com sua nutri.',
      muito_elevado: 'Sinais marcantes de alteração tireoidiana. Avaliação laboratorial recomendada.',
    },
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE INTENSIDADE
// ─────────────────────────────────────────────────────────────────────────────

export function intensidadeKey(score) {
  if (score >= 76) return 'muito_elevado';
  if (score >= 51) return 'elevado';
  if (score >= 26) return 'moderado';
  return 'leve';
}

export function intensidadeTexto(score) {
  if (score >= 76) return 'Muito elevado';
  if (score >= 51) return 'Elevado';
  if (score >= 26) return 'Moderado';
  return 'Leve';
}

export function intensidadeCor(score) {
  if (score >= 76) return 'var(--red)';
  if (score >= 51) return 'var(--orange)';
  if (score >= 26) return 'var(--amber)';
  return 'var(--green)';
}

export function intensidadeCorBg(score) {
  if (score >= 76) return 'var(--red-bg)';
  if (score >= 51) return 'var(--orange-bg)';
  if (score >= 26) return '#fef9e7';
  return 'var(--green-bg)';
}

// ─────────────────────────────────────────────────────────────────────────────
// JANELA TEMPORAL DO MAPA VIVO
// ─────────────────────────────────────────────────────────────────────────────

// Retorna a data ISO (YYYY-MM-DD) do início da janela de 30 dias de calendário.
// Usar como filtro .gte('data', dataInicioMapaVivo()) na query Supabase.
export function dataInicioMapaVivo() {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toISOString().slice(0, 10);
}

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULO DO MAPA VIVO (últimos 30 dias de calendário)
// ─────────────────────────────────────────────────────────────────────────────

const SCORES_ZERO = {
  glicemico: 0, adrenal: 0, estrogenico: 0, progesterona: 0,
  androgenico: 0, intestinal: 0, inflamatorio: 0, perimenopausa: 0, tireoidiano: 0,
};

export function calcularMapaVivo(sintomas, periodos = [], intestinoLogs = []) {
  const ultimos30 = (sintomas ?? []).slice(0, 30);
  if (!ultimos30.length) return { scores: SCORES_ZERO, confianca: 0, diasComDados: 0 };

  const estagioPeri = classificarEstagioPeri(periodos);
  const acumulado   = { ...SCORES_ZERO };

  for (const s of ultimos30) {
    const { fase } = calcularFaseDoCiclo(periodos, s.data);
    const sc = calcularScoresHormonais(s, fase, estagioPeri);
    if (sc) {
      for (const k of Object.keys(acumulado)) {
        acumulado[k] += (sc[k] ?? 0) / ultimos30.length;
      }
    }
  }

  const scores = Object.fromEntries(
    Object.entries(acumulado).map(([k, v]) => [k, Math.round(v)])
  );

  // Enriquece o eixo intestinal com score refinado de intestino_logs quando há dados suficientes
  const scoreIntestinalRefinado = calcularScoreIntestinal(intestinoLogs);
  if (scoreIntestinalRefinado !== null && (intestinoLogs ?? []).filter(l => l.tipo === 'diario').length >= 5) {
    scores.intestinal = scoreIntestinalRefinado;
  }

  // Confiança: 100% com 30 dias, proporcional abaixo disso
  const confianca = Math.min(100, Math.round((ultimos30.length / 30) * 100));

  return { scores, confianca, diasComDados: ultimos30.length, estagioPeri };
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTAS E CORRELAÇÕES DO MAPA
// ─────────────────────────────────────────────────────────────────────────────

export function calcularAlertasMapa(scores) {
  return gerarAlertas(scores);
}

export function calcularCorrelacoesMapa(scores) {
  return detectarCorrelacoes(scores);
}

// ─────────────────────────────────────────────────────────────────────────────
// DELTA ENTRE MAPA VIVO E MARCO CLÍNICO
// ─────────────────────────────────────────────────────────────────────────────

export function calcularDelta(scoresVivo, scoresMarco) {
  if (!scoresVivo || !scoresMarco) return {};
  return Object.fromEntries(
    Object.keys(SCORES_ZERO).map(k => [
      k,
      (scoresVivo[k] ?? 0) - (scoresMarco[k] ?? 0),
    ])
  );
}

// Ordem de exibição dos eixos no radar (9 eixos)
export const EIXOS_ORDEM = [
  'glicemico', 'adrenal', 'estrogenico', 'progesterona', 'androgenico',
  'intestinal', 'inflamatorio', 'perimenopausa', 'tireoidiano',
];
