// ─────────────────────────────────────────────────────────────────────────────
// Perfil Biológico da Mulher — Útera
// Detecta padrões de sintomas por fase do ciclo a partir de dados acumulados.
// Sem IA. Sem inferências mágicas. Estatística simples e auditável.
// ─────────────────────────────────────────────────────────────────────────────

import { calcularFaseDoCiclo } from './cicloUtils.js';
import { calcularTendenciasClinicas } from './intestinoUtils.js';

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
  const cobertura       = Math.min(100, Math.round((diasRegistrados / 90) * 100));

  if (diasRegistrados < 14 || ciclosCompletos < 1) {
    return { estagio: 'insuficiente', ciclosCompletos, diasRegistrados, cobertura };
  }
  if (diasRegistrados >= 60 && ciclosCompletos >= 2) {
    return { estagio: 'consolidado', ciclosCompletos, diasRegistrados, cobertura };
  }
  return { estagio: 'inicial', ciclosCompletos, diasRegistrados, cobertura };
}

// ── Corpo → Comportamento ─────────────────────────────────────────────────────

const PARES_V1 = [
  { id: 'sono_compulsao',     gatilho: 'sono',      efeito: 'compulsao',     gatilhoLabel: 'sono difícil',       efeitoLabel: 'compulsão alimentar' },
  { id: 'sono_energia',       gatilho: 'sono',      efeito: 'energia',       gatilhoLabel: 'sono difícil',       efeitoLabel: 'energia baixa'       },
  { id: 'sono_irritabilidade',gatilho: 'sono',      efeito: 'irritabilidade',gatilhoLabel: 'sono difícil',       efeitoLabel: 'irritabilidade'      },
  { id: 'intestino_acne',     gatilho: 'intestino', efeito: 'acne',          gatilhoLabel: 'intestino alterado', efeitoLabel: 'acne'                },
  { id: 'intestino_energia',  gatilho: 'intestino', efeito: 'energia',       gatilhoLabel: 'intestino alterado', efeitoLabel: 'energia baixa'       },
  { id: 'intestino_inchaco',  gatilho: 'intestino', efeito: 'inchaco',       gatilhoLabel: 'intestino alterado', efeitoLabel: 'inchaço'             },
];

function intestinoAlterado(s, altSet) {
  return altSet.has(s.data) || (s.intestino != null && s.intestino !== 'normal');
}

function intestinoTemDados(s, altSet) {
  return s.intestino != null || altSet.has(s.data);
}

function gatilhoDia(s, par, altSet) {
  if (par.gatilho === 'sono')      return s.sono != null ? s.sono <= 2 : null;
  if (par.gatilho === 'intestino') return intestinoTemDados(s, altSet) ? intestinoAlterado(s, altSet) : null;
  return null;
}

function efeitoDia(s, par) {
  switch (par.efeito) {
    case 'compulsao':     return s.compulsao     != null ? s.compulsao >= 1     : null;
    case 'energia':       return s.energia       != null ? s.energia <= 2       : null;
    case 'irritabilidade':return s.irritabilidade!= null ? s.irritabilidade >= 2: null;
    case 'acne':          return s.acne          != null ? s.acne >= 1          : null;
    case 'inchaco':       return s.inchaco       != null ? s.inchaco >= 1       : null;
    default: return null;
  }
}

function gerarNarrativaAssociacao({ par, prevCom, prevSem, delta, forca }) {
  const base = `Nos registros disponíveis, nos dias em que houve ${par.gatilhoLabel}, ${par.efeitoLabel} apareceu em ${prevCom}% dos dias — contra ${prevSem}% nos dias sem ${par.gatilhoLabel} (${delta} pontos percentuais de diferença).`;
  return forca === 'forte' ? base + ' Pode ser um ponto de atenção clínica.' : base;
}

function analisarPar({ sintomas, par, altSet }) {
  // Dias com ambos os campos com dados registrados
  const analisados = sintomas.filter(s => {
    const g = gatilhoDia(s, par, altSet);
    const e = efeitoDia(s, par);
    return g !== null && e !== null;
  });

  if (analisados.length < 20) return null;

  const comG = analisados.filter(s => gatilhoDia(s, par, altSet) === true);
  const semG = analisados.filter(s => gatilhoDia(s, par, altSet) === false);

  const nCom = comG.length;
  const nSem = semG.length;
  if (nCom < 10 || nSem < 5) return null;

  const prevCom = comG.filter(s => efeitoDia(s, par)).length / nCom;
  const prevSem = semG.filter(s => efeitoDia(s, par)).length / nSem;
  const delta   = prevCom - prevSem;
  const ratio   = prevSem < 0.01
    ? (prevCom >= 0.25 ? 5.0 : 1.0)
    : prevCom / prevSem;

  if (delta < 0.15 || prevCom < 0.20 || ratio < 1.4) return null;

  const forca    = delta >= 0.25 ? 'forte' : 'moderada';
  const confianca = nCom >= 20   ? 'alta'  : 'moderada';
  const pCom = Math.round(prevCom * 100);
  const pSem = Math.round(prevSem * 100);
  const dlt  = Math.round(delta   * 100);

  return {
    id: par.id, gatilhoLabel: par.gatilhoLabel, efeitoLabel: par.efeitoLabel,
    prevCom: pCom, prevSem: pSem, delta: dlt,
    nCom, nSem, forca, confianca,
    narrativa: gerarNarrativaAssociacao({ par, prevCom: pCom, prevSem: pSem, delta: dlt, forca }),
  };
}

export function calcularCorpoComportamento({ sintomas, intestinoLogs }) {
  const diasRegistrados = new Set((sintomas ?? []).map(s => s.data)).size;
  const cobertura       = Math.min(100, Math.round((diasRegistrados / 90) * 100));

  if (diasRegistrados < 30 || cobertura < 30) {
    return { disponivel: false, diasRegistrados, cobertura };
  }

  const coberturaBaixa = cobertura < 50;

  // Conjunto de datas com intestino alterado (de intestino_logs)
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

  let associacoes = PARES_V1
    .map(par => analisarPar({ sintomas, par, altSet }))
    .filter(Boolean);

  // Cobertura baixa: confiança moderada → não exibir; alta → rebaixar para moderada
  if (coberturaBaixa) {
    associacoes = associacoes
      .map(a => a.confianca === 'moderada' ? null : { ...a, confianca: 'moderada' })
      .filter(Boolean);
  }

  // Ordenar: força forte primeiro, depois por delta
  associacoes.sort((a, b) => {
    if (a.forca !== b.forca) return a.forca === 'forte' ? -1 : 1;
    return b.delta - a.delta;
  });

  return { disponivel: true, associacoes, cobertura, coberturaBaixa, diasRegistrados };
}

// ── Ponto de entrada principal ────────────────────────────────────────────────

export function calcularPerfilBiologico({ sintomas, periodos, intestinoLogs }) {
  const dadosBase = determinarEstagio({ sintomas, periodos });

  if (dadosBase.estagio === 'insuficiente') {
    return { dadosBase, principalPadrao: null, padroes: [], padroesEmFormacao: [], intestinoCiclo: [], corpoComportamento: { disponivel: false } };
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

  const principalPadrao   = padroes.find(p => p.confianca === 'alta') ?? null;
  const intestinoCiclo    = calcularTendenciasClinicas(intestinoLogs ?? [], sintomas ?? []);
  const corpoComportamento = calcularCorpoComportamento({ sintomas, intestinoLogs });

  return { dadosBase, principalPadrao, padroes, padroesEmFormacao, intestinoCiclo, corpoComportamento };
}
