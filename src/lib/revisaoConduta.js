// ── Revisão de Conduta — Sprint 16 ───────────────────────────────────────────
// Compara os registros antes e depois da criação da conduta atual.
// Sem IA. Sem causalidade. Linguagem estritamente observacional.

function normalizar(str) {
  return (str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, ' ');
}

// ── altFns por campo ──────────────────────────────────────────────────────────
// Mesmos limiares de perfilBiologicoUtils.js — redefinidos aqui para
// manter o módulo autossuficiente.

const CAMPOS_ALTFN = {
  sono:          s => s.sono           != null ? s.sono          <= 2 : null,
  energia:       s => s.energia        != null ? s.energia       <= 2 : null,
  humor:         s => s.humor          != null ? s.humor         <= 2 : null,
  foco:          s => s.foco           != null ? s.foco          <= 2 : null,
  libido:        s => s.libido         != null ? s.libido        <= 2 : null,
  ansiedade:     s => s.ansiedade      != null ? s.ansiedade     >= 2 : null,
  irritabilidade:s => s.irritabilidade != null ? s.irritabilidade >= 2 : null,
  compulsao:     s => s.compulsao      != null ? s.compulsao     >= 1 : null,
  acne:          s => s.acne           != null ? s.acne          >= 1 : null,
  retencao:      s => s.retencao       != null ? s.retencao      >= 1 : null,
  inchaco:       s => s.inchaco        != null ? s.inchaco       >= 1 : null,
  dor_cabeca:    s => s.dor_cabeca     != null ? s.dor_cabeca    >= 2 : null,
  dor_pelvica:   s => s.dor_pelvica    != null ? s.dor_pelvica   >= 1 : null,
  intestino:     s => s.intestino      != null ? s.intestino     !== 'normal' : null,
};

// Composite outcome (7 campos do Sprint 12 — mesma lógica de ehPioraDia)
const OUTCOME_FNS = [
  s => s.humor          != null ? s.humor          <= 2 : null,
  s => s.acne           != null ? s.acne           >= 1 : null,
  s => s.retencao       != null ? s.retencao       >= 1 : null,
  s => s.inchaco        != null ? s.inchaco        >= 1 : null,
  s => s.dor_cabeca     != null ? s.dor_cabeca     >= 2 : null,
  s => s.dor_pelvica    != null ? s.dor_pelvica    >= 1 : null,
  s => s.irritabilidade != null ? s.irritabilidade >= 2 : null,
];

function ehPioraDia(s) {
  let comDado = 0, alt = 0;
  for (const fn of OUTCOME_FNS) {
    const v = fn(s);
    if (v !== null) { comDado++; if (v) alt++; }
  }
  return comDado >= 3 ? alt >= 2 : null;
}

// ── Vocabulário: tokens do objetivo → campos rastreáveis ─────────────────────

const VOCAB_OBJETIVO = {
  sono:          ['sono'],
  dormir:        ['sono'],
  insonia:       ['sono'],
  energia:       ['energia'],
  fadiga:        ['energia'],
  cansaco:       ['energia'],
  disposicao:    ['energia'],
  vitalidade:    ['energia'],
  humor:         ['humor', 'irritabilidade'],
  emocional:     ['humor'],
  emocoes:       ['humor'],
  ansiedade:     ['ansiedade'],
  estresse:      ['ansiedade'],
  stress:        ['ansiedade'],
  nervosismo:    ['ansiedade'],
  irritabilidade:['irritabilidade'],
  irritacao:     ['irritabilidade'],
  compulsao:     ['compulsao'],
  glicemia:      ['compulsao', 'energia'],
  acucar:        ['compulsao'],
  intestino:     ['intestino'],
  intestinal:    ['intestino'],
  digestao:      ['intestino'],
  digestivo:     ['intestino'],
  constipacao:   ['intestino'],
  prisao:        ['intestino'],
  acne:          ['acne'],
  pele:          ['acne'],
  espinha:       ['acne'],
  retencao:      ['retencao', 'inchaco'],
  inchaco:       ['inchaco', 'retencao'],
  foco:          ['foco'],
  concentracao:  ['foco'],
  cognitivo:     ['foco'],
  memoria:       ['foco'],
  libido:        ['libido'],
  sexual:        ['libido'],
  dor:           ['dor_pelvica', 'dor_cabeca'],
  pelvica:       ['dor_pelvica'],
  colica:        ['dor_pelvica'],
  endometriose:  ['dor_pelvica'],
  enxaqueca:     ['dor_cabeca'],
  cabeca:        ['dor_cabeca'],
};

function camposDoObjetivo(conduta) {
  const texto = [
    conduta.objetivo_principal ?? '',
    ...(conduta.objetivos_secundarios ?? []),
  ].join(' ');
  const tokens = normalizar(texto).split(/\s+/).filter(Boolean);
  const campos = new Set();
  for (const token of tokens) {
    VOCAB_OBJETIVO[token]?.forEach(id => campos.add(id));
  }
  return [...campos].filter(id => CAMPOS_ALTFN[id]);
}

// ── Cálculos de taxa ──────────────────────────────────────────────────────────

const MIN_DIAS_CAMPO  = 10;
const MIN_DIAS_PIORA  = 14;
const DIAS_RECENTE    = 7;
const DELTA_REDUCAO   = -15; // pp — limite para sinalizar redução
const DELTA_AUMENTO   =  10; // pp — limite para sinalizar aumento

function calcTaxa(sintomas, altFn) {
  let comDado = 0, alt = 0;
  for (const s of sintomas) {
    const v = altFn(s);
    if (v !== null) { comDado++; if (v) alt++; }
  }
  return comDado >= MIN_DIAS_CAMPO ? Math.round((alt / comDado) * 100) : null;
}

function taxaObjetivoMedia(sintomas, campos) {
  const taxas = campos
    .map(id => calcTaxa(sintomas, CAMPOS_ALTFN[id]))
    .filter(v => v !== null);
  if (taxas.length === 0) return null;
  return Math.round(taxas.reduce((s, v) => s + v, 0) / taxas.length);
}

function taxaPioraGeral(sintomas) {
  let comDado = 0, piora = 0;
  for (const s of sintomas) {
    const v = ehPioraDia(s);
    if (v !== null) { comDado++; if (v) piora++; }
  }
  return comDado >= MIN_DIAS_PIORA ? Math.round((piora / comDado) * 100) : null;
}

// ── Função principal ──────────────────────────────────────────────────────────

export function calcularRevisao({ sintomas, conduta }) {
  if (!sintomas || !conduta?.data) return { disponivel: false };

  const dataConduta = conduta.data; // 'YYYY-MM-DD'
  const hoje        = new Date().toISOString().slice(0, 10);
  const diasDesde   = Math.round(
    (new Date(hoje + 'T12:00:00') - new Date(dataConduta + 'T12:00:00')) / 86400000
  );

  // Conduta criada há menos de 7 dias — separado de "dados insuficientes"
  if (diasDesde < DIAS_RECENTE) {
    return {
      disponivel: true,
      motivo: 'conduta_muito_recente',
      sintese: 'Ainda é cedo para comparar os registros relacionados a este objetivo.',
    };
  }

  const antes  = sintomas.filter(s => s.data <  dataConduta);
  const depois = sintomas.filter(s => s.data >= dataConduta);

  const diasAntes  = new Set(antes.map(s  => s.data)).size;
  const diasDepois = new Set(depois.map(s => s.data)).size;

  if (diasDepois < MIN_DIAS_PIORA) {
    return {
      disponivel: true,
      motivo: 'dados_insuficientes_apos',
      sintese: 'Ainda há poucos dias registrados após esta conduta para uma comparação.',
      diasAntes,
      diasDepois,
    };
  }

  if (diasAntes < MIN_DIAS_PIORA) {
    return {
      disponivel: true,
      motivo: 'dados_insuficientes_antes',
      sintese: 'Ainda há poucos dados antes desta conduta na janela de análise.',
      diasAntes,
      diasDepois,
    };
  }

  const campos     = camposDoObjetivo(conduta);
  const indicadores = [];
  let   deltaDecisorio = null;

  // Indicador 1: campos do objetivo
  if (campos.length > 0) {
    const tA = taxaObjetivoMedia(antes,  campos);
    const tD = taxaObjetivoMedia(depois, campos);
    if (tA !== null && tD !== null) {
      const delta = tD - tA;
      deltaDecisorio = delta;
      indicadores.push({
        id: 'objetivo',
        label: 'Campos relacionados ao objetivo',
        antes: tA, depois: tD, delta,
      });
    }
  }

  // Indicador 2: carga sintomática geral
  const pA = taxaPioraGeral(antes);
  const pD = taxaPioraGeral(depois);
  if (pA !== null && pD !== null) {
    const delta = pD - pA;
    if (deltaDecisorio === null) deltaDecisorio = delta;
    indicadores.push({
      id: 'piora_geral',
      label: 'Carga sintomática geral',
      antes: pA, depois: pD, delta,
    });
  }

  if (indicadores.length === 0) {
    return {
      disponivel: true,
      motivo: 'sem_indicadores',
      sintese: 'Ainda há poucos dados nos campos relacionados a este objetivo para uma comparação.',
      diasAntes,
      diasDepois,
    };
  }

  const sintese =
    deltaDecisorio <= DELTA_REDUCAO
      ? 'Os registros sugerem redução nos campos relacionados a este objetivo.'
      : deltaDecisorio >= DELTA_AUMENTO
        ? 'Os registros mostram aumento nos campos relacionados a este objetivo.'
        : 'Os registros ainda não mostram mudança relevante nos campos acompanhados.';

  return { disponivel: true, sintese, indicadores, diasAntes, diasDepois };
}
