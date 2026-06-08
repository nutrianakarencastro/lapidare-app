// ─────────────────────────────────────────────────────────────────────────────
// Perfil Biológico da Mulher — Útera
// Detecta padrões de sintomas por fase do ciclo a partir de dados acumulados.
// Sem IA. Sem inferências mágicas. Estatística simples e auditável.
// ─────────────────────────────────────────────────────────────────────────────

import { calcularFaseDoCiclo } from './cicloUtils.js';
import { calcularTendenciasClinicas } from './intestinoUtils.js';
import { EIXOS } from './clinical/eixos.js';

// ── Constantes ────────────────────────────────────────────────────────────────

const FASES_VALIDAS = ['menstrual', 'folicular', 'ovulacao', 'lutea'];

const FASE_LABEL = {
  menstrual: 'menstrual',
  folicular: 'folicular',
  ovulacao:  'peri-ovulatória',
  lutea:     'lútea',
};

const RATIO_PADRAO   = 1.5;  // fase dominante ≥ 1.5× média das outras
const RATIO_FORMACAO = 1.3;
const DELTA_PADRAO   = 0.15; // diferença absoluta mínima de 15 pp
const DELTA_FORMACAO = 0.10;
const PREV_MIN       = 0.20; // prevalência mínima na fase dominante para ser relevante

const MIN_OBS_ALTA     = 10;
const MIN_OBS_MODERADA = 5;
const MIN_OBS_FORMACAO = 2;

// ── Agrupamentos V1 ───────────────────────────────────────────────────────────

const GRUPOS = [
  { id: 'sono',      label: 'Sono'                  },
  { id: 'energia',   label: 'Energia'                },
  { id: 'humor',     label: 'Humor e Irritabilidade' },
  { id: 'compulsao', label: 'Compulsão'              },
  { id: 'acne',      label: 'Acne'                   },
  { id: 'retencao',  label: 'Retenção e Inchaço'     },
];

// ── Presença e problema por dia ───────────────────────────────────────────────
// Retorna null se não há dado registrado para esse grupo neste dia.
// Retorna true se o dia é "problemático" nesse grupo, false se não.

function dadoDia(s, grupoId) {
  switch (grupoId) {
    case 'sono': {
      if (s.sono == null) return null;
      return s.sono <= 2 || !!s.insonia || !!s.acorda_madrugada;
    }
    case 'energia': {
      if (s.energia == null) return null;
      return s.energia <= 2;
    }
    case 'humor': {
      if (s.humor == null) return null;
      return s.humor <= 2 || (s.irritabilidade ?? 0) >= 2 || !!s.choro;
    }
    case 'compulsao': {
      if (s.compulsao == null) return null;
      return s.compulsao >= 1;
    }
    case 'acne': {
      if (s.acne == null) return null;
      return s.acne >= 1;
    }
    case 'retencao': {
      if (s.retencao == null && s.inchaco == null) return null;
      return (s.retencao ?? 0) >= 1 || (s.inchaco ?? 0) >= 1;
    }
    default: return null;
  }
}

// ── Narrativas ────────────────────────────────────────────────────────────────

function nCiclosLabel(n) {
  return n === 1 ? 'último ciclo' : `últimos ${n} ciclos`;
}

const NARRATIVAS = {
  sono:      (f, n) => `Nos ${nCiclosLabel(n)}, o sono tende a ser mais difícil na fase ${f}.`,
  energia:   (f, n) => `Nos ${nCiclosLabel(n)}, a energia costuma ser mais baixa na fase ${f}.`,
  humor:     (f, n) => `Nos ${nCiclosLabel(n)}, humor e irritabilidade tendem a ser mais intensos na fase ${f}.`,
  compulsao: (f, n) => `Nos ${nCiclosLabel(n)}, sinais de compulsão alimentar aparecem com mais frequência na fase ${f}.`,
  acne:      (f, n) => `Nos ${nCiclosLabel(n)}, a acne tende a aparecer com mais frequência na fase ${f}.`,
  retencao:  (f, n) => `Nos ${nCiclosLabel(n)}, retenção ou inchaço aparecem com mais frequência na fase ${f}.`,
};

const NARRATIVAS_FORMACAO = {
  sono:      (f, n) => `Nos ${nCiclosLabel(n)}, sinais iniciais de sono mais difícil na fase ${f}.`,
  energia:   (f, n) => `Nos ${nCiclosLabel(n)}, sinais iniciais de energia mais baixa na fase ${f}.`,
  humor:     (f, n) => `Nos ${nCiclosLabel(n)}, sinais iniciais de humor mais difícil na fase ${f}.`,
  compulsao: (f, n) => `Nos ${nCiclosLabel(n)}, sinais iniciais de compulsão na fase ${f}.`,
  acne:      (f, n) => `Nos ${nCiclosLabel(n)}, sinais iniciais de acne mais frequente na fase ${f}.`,
  retencao:  (f, n) => `Nos ${nCiclosLabel(n)}, sinais iniciais de retenção ou inchaço na fase ${f}.`,
};

// ── Análise de um grupo por fase ──────────────────────────────────────────────

function analisarGrupo(porFase, grupo, nCiclos) {
  // Contar dias problemáticos / dias com dado por fase
  const stats = {};
  for (const [fase, dias] of Object.entries(porFase)) {
    let prob = 0, total = 0;
    for (const s of dias) {
      const d = dadoDia(s, grupo.id);
      if (d !== null) { total++; if (d) prob++; }
    }
    if (total >= MIN_OBS_FORMACAO) stats[fase] = { prob, total, prev: prob / total };
  }

  const fases = Object.keys(stats);
  if (fases.length < 2) return null;

  // Fase dominante = maior prevalência
  fases.sort((a, b) => stats[b].prev - stats[a].prev);
  const faseDominante      = fases[0];
  const { total: nObs, prev: prevDominante } = stats[faseDominante];
  const mediaOutras        = fases.slice(1).reduce((acc, f) => acc + stats[f].prev, 0) / (fases.length - 1);

  if (prevDominante < PREV_MIN) return null;

  const delta = prevDominante - mediaOutras;
  const ratio = mediaOutras < 0.05
    ? (prevDominante >= 0.25 ? 5.0 : 1.0)
    : prevDominante / mediaOutras;

  const ePatrao   = ratio >= RATIO_PADRAO   && delta >= DELTA_PADRAO;
  const eFormacao = ratio >= RATIO_FORMACAO && delta >= DELTA_FORMACAO;
  if (!ePatrao && !eFormacao) return null;

  let confianca;
  if (!ePatrao)                   confianca = 'formacao';
  else if (nObs >= MIN_OBS_ALTA)     confianca = 'alta';
  else if (nObs >= MIN_OBS_MODERADA) confianca = 'moderada';
  else                            confianca = 'formacao';

  const faseDomLabel = FASE_LABEL[faseDominante];
  const narrativeFn  = confianca === 'formacao' ? NARRATIVAS_FORMACAO : NARRATIVAS;

  return {
    grupoId:       grupo.id,
    grupoLabel:    grupo.label,
    faseDominante,
    faseDomLabel,
    prevDominante: Math.round(prevDominante * 100),
    prevOutras:    Math.round(mediaOutras * 100),
    delta:         Math.round(delta * 100),
    confianca,
    nObs,
    narrativa:     narrativeFn[grupo.id]?.(faseDomLabel, nCiclos) ?? '',
  };
}

// ── Determinação de estágio ───────────────────────────────────────────────────

export function determinarEstagio({ sintomas, periodos }) {
  const diasRegistrados = new Set((sintomas ?? []).map(s => s.data)).size;
  const ciclosCompletos = (periodos ?? []).filter(p => p.inicio && p.fim).length;
  const cobertura       = Math.min(100, Math.round((diasRegistrados / 180) * 100));

  if (diasRegistrados < 14 || ciclosCompletos < 1) {
    return { estagio: 'insuficiente', ciclosCompletos, diasRegistrados, cobertura };
  }
  if (diasRegistrados >= 60 && ciclosCompletos >= 2) {
    return { estagio: 'consolidado', ciclosCompletos, diasRegistrados, cobertura };
  }
  return { estagio: 'inicial', ciclosCompletos, diasRegistrados, cobertura };
}

// ── Motor de Descoberta V2 — Corpo → Comportamento ───────────────────────────
// Paradigma: Associação ↔ Associação (simétrico, sem gatilho/efeito predefinido)
// Janela: 180 dias · Método: co-ocorrência em excesso (lift + excesso absoluto)

const CAMPOS_MOTOR = [
  { id: 'sono',           label: 'sono difícil',       altFn: (s)       => s.sono           != null ? s.sono           <= 2 : null },
  { id: 'energia',        label: 'energia baixa',       altFn: (s)       => s.energia        != null ? s.energia        <= 2 : null },
  { id: 'humor',          label: 'humor baixo',         altFn: (s)       => s.humor          != null ? s.humor          <= 2 : null },
  { id: 'foco',           label: 'foco reduzido',       altFn: (s)       => s.foco           != null ? s.foco           <= 2 : null },
  { id: 'libido',         label: 'libido baixa',        altFn: (s)       => s.libido         != null ? s.libido         <= 2 : null },
  { id: 'ansiedade',      label: 'ansiedade elevada',   altFn: (s)       => s.ansiedade      != null ? s.ansiedade      >= 2 : null },
  { id: 'irritabilidade', label: 'irritabilidade alta', altFn: (s)       => s.irritabilidade != null ? s.irritabilidade >= 2 : null },
  { id: 'compulsao',      label: 'compulsão alimentar', altFn: (s)       => s.compulsao      != null ? s.compulsao      >= 1 : null },
  { id: 'acne',           label: 'acne',                altFn: (s)       => s.acne           != null ? s.acne           >= 1 : null },
  { id: 'retencao',       label: 'retenção',            altFn: (s)       => s.retencao       != null ? s.retencao       >= 1 : null },
  { id: 'inchaco',        label: 'inchaço',             altFn: (s)       => s.inchaco        != null ? s.inchaco        >= 1 : null },
  { id: 'dor_cabeca',     label: 'dor de cabeça',       altFn: (s)       => s.dor_cabeca     != null ? s.dor_cabeca     >= 2 : null },
  { id: 'dor_pelvica',    label: 'dor pélvica',         altFn: (s)       => s.dor_pelvica    != null ? s.dor_pelvica    >= 1 : null },
  { id: 'intestino',      label: 'intestino alterado',
    altFn: (s, altSet) => {
      const temDado = s.intestino != null || altSet.has(s.data);
      if (!temDado) return null;
      return altSet.has(s.data) || s.intestino !== 'normal';
    },
  },
];

// Pares semanticamente sobrepostos — excluídos antes do cálculo
// Chaves em ordem canônica (sort), independente da posição em CAMPOS_MOTOR
const BLACKLIST_MOTOR = new Set([
  'inchaco|retencao',
  'humor|irritabilidade',
]);

function analisarParMotor(a, b, sintomas, altSet) {
  const analisados = sintomas.filter(s => {
    const va = a.altFn(s, altSet);
    const vb = b.altFn(s, altSet);
    return va !== null && vb !== null;
  });

  const n = analisados.length;
  if (n < 20) return null;

  const nA  = analisados.filter(s => a.altFn(s, altSet) === true).length;
  const nB  = analisados.filter(s => b.altFn(s, altSet) === true).length;
  const nAB = analisados.filter(s =>
    a.altFn(s, altSet) === true && b.altFn(s, altSet) === true
  ).length;

  if (nAB < 8) return null;

  const prevA = nA / n;
  const prevB = nB / n;

  // Ambos os campos precisam ter variância real no período
  if (prevA < 0.15 || prevA > 0.85 || prevB < 0.15 || prevB > 0.85) return null;

  const prevAB   = nAB / n;
  const esperado = prevA * prevB;  // >= 0.15×0.15 = 0.0225 after variance filter
  const excesso  = prevAB - esperado;
  const lift     = prevAB / esperado;

  if (lift < 1.5 || excesso < 0.15) return null;

  const excessoPP  = Math.round(excesso  * 100);
  const esperadoPP = Math.round(esperado * 100);
  const prevABPP   = Math.round(prevAB   * 100);

  const forca     = excesso >= 0.25 ? 'forte' : 'moderada';
  const confianca = nAB >= 15 ? 'alta' : 'moderada';
  const fator     = confianca === 'alta' ? 1.0 : 0.85;
  const score     = excessoPP * Math.min(lift, 4.0) * fator;

  const lA = a.label.charAt(0).toUpperCase() + a.label.slice(1);
  const narrativa =
    `${lA} e ${b.label} foram registrados juntos em ${prevABPP}% dos dias analisados — contra ${esperadoPP}% esperado.`;

  return {
    id:       `${a.id}|${b.id}`,
    labelA:   a.label,
    labelB:   b.label,
    campoA:   a.id,
    campoB:   b.id,
    prevAB:   prevABPP,
    esperado: esperadoPP,
    excesso:  excessoPP,
    lift:     Math.round(lift * 10) / 10,
    n, nAB,
    forca, confianca, score, narrativa,
  };
}

export function calcularCorpoComportamento({ sintomas, intestinoLogs }) {
  const diasRegistrados = new Set((sintomas ?? []).map(s => s.data)).size;
  const cobertura       = Math.min(100, Math.round((diasRegistrados / 180) * 100));

  if (diasRegistrados < 20) {
    return { disponivel: false, diasRegistrados, cobertura };
  }

  const coberturaBaixa = cobertura < 50;

  const altSet = new Set(
    (intestinoLogs ?? [])
      .filter(l =>
        l.tipo === 'diario' && (
          (l.bristol && l.bristol !== 4 && l.bristol !== 5) ||
          l.esvaziamento_incompleto ||
          (l.dor_abdominal ?? 0) >= 2
        )
      )
      .map(l => l.data)
  );

  // Calcular todos os pares válidos do pool único
  const candidatos = [];
  for (let i = 0; i < CAMPOS_MOTOR.length; i++) {
    for (let j = i + 1; j < CAMPOS_MOTOR.length; j++) {
      const a = CAMPOS_MOTOR[i];
      const b = CAMPOS_MOTOR[j];
      if (BLACKLIST_MOTOR.has([a.id, b.id].sort().join('|'))) continue;
      const r = analisarParMotor(a, b, sintomas ?? [], altSet);
      if (r) candidatos.push(r);
    }
  }

  // Cobertura baixa: ocultar confiança moderada; rebaixar alta → moderada
  let filtrados = candidatos;
  if (coberturaBaixa) {
    filtrados = candidatos
      .map(c => c.confianca === 'moderada' ? null : { ...c, confianca: 'moderada', score: c.score * 0.85 })
      .filter(Boolean);
  }

  // Ranquear por score interno; desempate por nAB
  filtrados.sort((a, b) => b.score - a.score || b.nAB - a.nAB);

  // Deduplicação: máximo 2 aparições por campo
  const aparicoes = {};
  const selecionados = [];
  for (const par of filtrados) {
    const cA = aparicoes[par.campoA] ?? 0;
    const cB = aparicoes[par.campoB] ?? 0;
    if (cA < 2 && cB < 2) {
      selecionados.push(par);
      aparicoes[par.campoA] = cA + 1;
      aparicoes[par.campoB] = cB + 1;
      if (selecionados.length === 4) break;
    }
  }

  return { disponivel: true, associacoes: selecionados, candidatos, cobertura, coberturaBaixa, diasRegistrados };
}

// ── Convergências Clínicas — Sprint 10 ───────────────────────────────────────
// Mapeia associações validadas do V2 para eixos clínicos do Método ÚTERA.
// Observacional: padrões que os registros apontam — não diagnóstico funcional.

// Perimenopausa é intencionalmente excluído: seus campos-chave (calorons,
// suor_noturno, despertar_noturno) são booleanos fora do pool do motor.
const MAPEAMENTO_CAMPO_EIXO = {
  sono:          [{ eixo: 'adrenal', peso: 3 }, { eixo: 'progesterona', peso: 2 }],
  energia:       [{ eixo: 'adrenal', peso: 3 }, { eixo: 'tireoidiano', peso: 3 }, { eixo: 'glicemico', peso: 2 }, { eixo: 'progesterona', peso: 1 }],
  humor:         [{ eixo: 'progesterona', peso: 2 }, { eixo: 'estrogenico', peso: 1 }],
  foco:          [{ eixo: 'tireoidiano', peso: 2 }, { eixo: 'adrenal', peso: 1 }, { eixo: 'glicemico', peso: 1 }],
  libido:        [{ eixo: 'androgenico', peso: 1 }, { eixo: 'adrenal', peso: 1 }],
  ansiedade:     [{ eixo: 'adrenal', peso: 2 }, { eixo: 'progesterona', peso: 2 }, { eixo: 'glicemico', peso: 2 }],
  irritabilidade:[{ eixo: 'glicemico', peso: 3 }, { eixo: 'progesterona', peso: 2 }, { eixo: 'adrenal', peso: 2 }, { eixo: 'estrogenico', peso: 1 }],
  compulsao:     [{ eixo: 'glicemico', peso: 3 }, { eixo: 'adrenal', peso: 2 }, { eixo: 'progesterona', peso: 2 }],
  acne:          [{ eixo: 'intestinal', peso: 2 }, { eixo: 'estrogenico', peso: 1 }, { eixo: 'inflamatorio', peso: 1 }, { eixo: 'androgenico', peso: 1 }],
  retencao:      [{ eixo: 'estrogenico', peso: 3 }],
  inchaco:       [{ eixo: 'estrogenico', peso: 2 }, { eixo: 'inflamatorio', peso: 1 }, { eixo: 'intestinal', peso: 1 }],
  dor_cabeca:    [{ eixo: 'estrogenico', peso: 2 }, { eixo: 'inflamatorio', peso: 2 }],
  dor_pelvica:   [{ eixo: 'estrogenico', peso: 2 }, { eixo: 'inflamatorio', peso: 2 }, { eixo: 'intestinal', peso: 1 }],
  intestino:     [{ eixo: 'intestinal', peso: 3 }, { eixo: 'tireoidiano', peso: 1 }, { eixo: 'estrogenico', peso: 1 }],
};

const SCORE_MINIMO_EIXO = 6;

function pesoCampoEixo(campoId, eixoId) {
  const mapeamentos = MAPEAMENTO_CAMPO_EIXO[campoId];
  if (!mapeamentos) return 0;
  return mapeamentos.find(e => e.eixo === eixoId)?.peso ?? 0;
}

export function calcularConvergencias({ candidatos }) {
  if (!candidatos || candidatos.length === 0) return [];

  // Coletar campos ativos e seus labels a partir dos candidatos
  const camposAtivos = new Set();
  const labelsDoCampo = {};
  for (const c of candidatos) {
    camposAtivos.add(c.campoA);
    camposAtivos.add(c.campoB);
    labelsDoCampo[c.campoA] = c.labelA;
    labelsDoCampo[c.campoB] = c.labelB;
  }

  const resultados = [];

  for (const eixoId of Object.keys(EIXOS)) {
    // Campos ativos que apontam para este eixo
    const camposDoEixo = [...camposAtivos].filter(id => pesoCampoEixo(id, eixoId) > 0);
    if (camposDoEixo.length < 3) continue;

    // Candidatos onde AMBOS os campos apontam para este eixo (reforço duplo)
    const paresReforco = candidatos.filter(c =>
      pesoCampoEixo(c.campoA, eixoId) > 0 && pesoCampoEixo(c.campoB, eixoId) > 0
    );
    if (paresReforco.length === 0) continue;

    // Score: pares reforçados × 1.5, campos solo × 1.0
    // Um campo que aparece em múltiplos pares soma seu peso em cada par —
    // intencionalmente: mais pares validados = evidência mais robusta do eixo.
    let score = 0;
    const camposPontuados = new Set();
    for (const par of paresReforco) {
      score += (pesoCampoEixo(par.campoA, eixoId) + pesoCampoEixo(par.campoB, eixoId)) * 1.5;
      camposPontuados.add(par.campoA);
      camposPontuados.add(par.campoB);
    }
    for (const id of camposDoEixo) {
      if (!camposPontuados.has(id)) score += pesoCampoEixo(id, eixoId);
    }

    if (score < SCORE_MINIMO_EIXO) continue;

    // Cobertura: campos ativos / total de campos do motor mapeados para este eixo
    const totalMapeados = Object.keys(MAPEAMENTO_CAMPO_EIXO)
      .filter(id => pesoCampoEixo(id, eixoId) > 0).length;
    const cobertura = Math.round((camposDoEixo.length / totalMapeados) * 100);

    resultados.push({
      eixoId,
      eixoNome:      EIXOS[eixoId].nome,
      eixoSubtitulo: EIXOS[eixoId].subtitulo,
      campos:  camposDoEixo.map(id => ({ id, label: labelsDoCampo[id] ?? id })),
      pares:   paresReforco.map(p => ({ labelA: p.labelA, labelB: p.labelB })),
      score,
      cobertura,
    });
  }

  // Ordenar por score; desempate por cobertura
  resultados.sort((a, b) => b.score - a.score || b.cobertura - a.cobertura);

  return resultados.slice(0, 2);
}

// ── Ponto de entrada principal ────────────────────────────────────────────────

export function calcularPerfilBiologico({ sintomas, periodos, intestinoLogs }) {
  const dadosBase = determinarEstagio({ sintomas, periodos });

  if (dadosBase.estagio === 'insuficiente') {
    return { dadosBase, principalPadrao: null, padroes: [], padroesEmFormacao: [], intestinoCiclo: [], corpoComportamento: { disponivel: false }, convergencias: [] };
  }

  // Classificar cada dia de sintoma pela fase do ciclo
  const porFase = { menstrual: [], folicular: [], ovulacao: [], lutea: [] };
  for (const s of sintomas) {
    const { fase } = calcularFaseDoCiclo(periodos, s.data);
    if (FASES_VALIDAS.includes(fase)) porFase[fase].push(s);
  }

  const nCiclos = dadosBase.ciclosCompletos;
  const resultados = GRUPOS.map(g => analisarGrupo(porFase, g, nCiclos)).filter(Boolean);

  const padroes = resultados
    .filter(r => r.confianca === 'alta' || r.confianca === 'moderada')
    .sort((a, b) => {
      if (a.confianca !== b.confianca) return a.confianca === 'alta' ? -1 : 1;
      return b.delta - a.delta;
    });

  const padroesEmFormacao = resultados
    .filter(r => r.confianca === 'formacao')
    .sort((a, b) => b.nObs - a.nObs);

  const principalPadrao    = padroes.find(p => p.confianca === 'alta') ?? null;
  const intestinoCiclo     = calcularTendenciasClinicas(intestinoLogs ?? [], sintomas ?? []);
  const corpoComportamento = calcularCorpoComportamento({ sintomas, intestinoLogs });
  const convergencias      = calcularConvergencias({ candidatos: corpoComportamento.candidatos ?? [] });

  return { dadosBase, principalPadrao, padroes, padroesEmFormacao, intestinoCiclo, corpoComportamento, convergencias };
}
