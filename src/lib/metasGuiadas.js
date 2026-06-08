// ── Metas Guiadas por Evidência — Sprint 15 ─────────────────────────────────
// Sugere temas ainda não cobertos pelas metas ativas ou conduta atual.
// Sem IA. Sem criação automática. Apenas facilita a seleção.

function normalizar(str) {
  return (str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z]/g, ' ');
}

// ── 9 temas canônicos para V1 ─────────────────────────────────────────────────
// tokensDedup: tokens normalizados que indicam que o tema já está sendo coberto.

const TEMAS = {
  sono:      { id: 'sono',       label: 'Qualidade do sono',              tokensDedup: ['sono', 'dormir', 'insonia'] },
  energia:   { id: 'energia',    label: 'Níveis de energia',              tokensDedup: ['energia', 'fadiga', 'cansaco', 'disposicao', 'vitalidade'] },
  intestino: { id: 'intestino',  label: 'Regularidade intestinal',        tokensDedup: ['intestino', 'intestinal', 'digestao', 'digestivo', 'constipacao', 'prisao', 'estufamento'] },
  fase_lutea:{ id: 'fase_lutea', label: 'Sintomas na fase lútea',         tokensDedup: ['lutea', 'menstrual', 'menstruacao', 'ciclo', 'hormonal'] },
  compulsao: { id: 'compulsao',  label: 'Compulsão alimentar',            tokensDedup: ['compulsao', 'glicemia', 'acucar'] },
  ansiedade: { id: 'ansiedade',  label: 'Ansiedade e estresse',           tokensDedup: ['ansiedade', 'estresse', 'stress', 'nervosismo'] },
  humor:     { id: 'humor',      label: 'Humor e estabilidade emocional', tokensDedup: ['humor', 'emocional', 'irritabilidade', 'irritacao'] },
  acne:      { id: 'acne',       label: 'Saúde da pele e acne',           tokensDedup: ['acne', 'pele', 'espinha', 'oleosidade'] },
  retencao:  { id: 'retencao',   label: 'Retenção hídrica',               tokensDedup: ['retencao', 'inchaco', 'hidrica'] },
};

// Índice reverso: token → Set de temaIds (construído uma vez no carregamento do módulo)
const TOKEN_TEMAS = {};
for (const [temaId, tema] of Object.entries(TEMAS)) {
  for (const token of tema.tokensDedup) {
    if (!TOKEN_TEMAS[token]) TOKEN_TEMAS[token] = new Set();
    TOKEN_TEMAS[token].add(temaId);
  }
}

// Eixos clínicos → temas (apenas os 9 da V1; eixos sem mapeamento retornam [])
const EIXO_TEMAS = {
  adrenal:     ['ansiedade', 'sono', 'energia'],
  tireoidiano: ['energia'],
  glicemico:   ['compulsao', 'energia'],
  progesterona:['humor', 'sono'],
  estrogenico: ['retencao', 'fase_lutea'],
  androgenico: ['acne'],
  inflamatorio:[],
  intestinal:  ['intestino'],
};

// Fatores modificáveis → temaId
const FATOR_TEMA = {
  sono_ruim: 'sono',
  ansiedade: 'ansiedade',
  intestino: 'intestino',
};

// ── Extração de temas a partir de texto livre ─────────────────────────────────
function temasDoTexto(texto) {
  const tokens = normalizar(texto).split(/\s+/).filter(Boolean);
  const temas  = new Set();
  for (const token of tokens) {
    TOKEN_TEMAS[token]?.forEach(t => temas.add(t));
  }
  return temas;
}

// ── Função principal ──────────────────────────────────────────────────────────
// perfilResult  — retorno de calcularPerfilBiologico
// metasAtivas   — metas com status 'ativa' ou 'em_evolucao'
// condutaAtual  — objeto da conduta is_atual (ou null)
// Retorna array de temas (máx 3) ainda não cobertos.

export function sugerirMetas({ perfilResult, metasAtivas, condutaAtual }) {
  if (!perfilResult) return [];

  // 1. Candidatos do perfil, ordenados por prioridade de fonte
  const candidatos = [];
  const adicionados = new Set();

  function addTema(temaId, prioridade) {
    if (!TEMAS[temaId] || adicionados.has(temaId)) return;
    adicionados.add(temaId);
    candidatos.push({ temaId, prioridade });
  }

  // P1: fatores modificáveis — mais concretos e acionáveis
  const { mapaGatilhos } = perfilResult;
  if (mapaGatilhos?.disponivel) {
    for (const fator of mapaGatilhos.fatores ?? []) {
      const tema = FATOR_TEMA[fator.id];
      if (tema) addTema(tema, 1);
    }
  }

  // P2: influência do ciclo
  if (mapaGatilhos?.influenciaCiclo) {
    addTema('fase_lutea', 2);
  }

  // P3: priorização principal
  const { priorizacao } = perfilResult;
  if (priorizacao) {
    for (const temaId of EIXO_TEMAS[priorizacao.principal.eixoId] ?? []) {
      addTema(temaId, 3);
    }
    if (priorizacao.secundaria) {
      for (const temaId of EIXO_TEMAS[priorizacao.secundaria.eixoId] ?? []) {
        addTema(temaId, 4);
      }
    }
  }

  if (candidatos.length === 0) return [];

  // 2. Temas cobertos por metas ativas/em evolução
  const temasCobertos = new Set();
  for (const meta of metasAtivas ?? []) {
    temasDoTexto(meta.titulo).forEach(t => temasCobertos.add(t));
    if (meta.eixo) temasDoTexto(meta.eixo).forEach(t => temasCobertos.add(t));
  }

  // 3. Temas cobertos pela conduta atual
  if (condutaAtual) {
    const texto = [
      condutaAtual.objetivo_principal ?? '',
      ...(condutaAtual.objetivos_secundarios ?? []),
    ].join(' ');
    temasDoTexto(texto).forEach(t => temasCobertos.add(t));
  }

  // 4. Filtrar cobertos e retornar até 3
  return candidatos
    .filter(c => !temasCobertos.has(c.temaId))
    .slice(0, 3)
    .map(c => TEMAS[c.temaId]);
}
