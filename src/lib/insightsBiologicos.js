// ─────────────────────────────────────────────────────────────────────────────
// Perfil Biológico Inteligente
// Transforma dados analíticos do perfilBiologicoUtils em insights clínicos.
// Sem IA. Sem inferências mágicas. Regras objetivas e auditáveis.
// Função pura — sem efeitos colaterais, sem imports externos.
// ─────────────────────────────────────────────────────────────────────────────

function clamp01(v) { return Math.min(1, Math.max(0, v)); }

// ── 1. Fator Dominante ────────────────────────────────────────────────────────
// Fonte: priorizacao.principal + convergencias[0].score
// Gate:  priorizacao !== null && convergencias.length > 0

function insightFatorDominante(r) {
  if (!r.priorizacao || !r.convergencias?.length) return null;

  const top    = r.priorizacao.principal;
  const campos = (top.top3 ?? []).map(c => c.label).join(', ');
  // score do motor varia de ~6 (mínimo SCORE_MINIMO_EIXO) a ~40+ em padrões muito fortes
  const relevancia = clamp01(0.90 * clamp01((r.convergencias[0].score ?? 0) / 40));

  return {
    tipo:      'fator_dominante',
    relevancia,
    titulo:    `Eixo ${top.eixoNome} em destaque`,
    texto:     `Os registros apontam consistentemente para o eixo ${top.eixoNome}. `
             + (top.eixoSubtitulo ? `${top.eixoSubtitulo}. ` : '')
             + (campos ? `Campos mais evidentes: ${campos}.` : ''),
    badge:     'Prioridade clínica',
    fonte:     'Convergências Clínicas',
    icone:     'dna',
  };
}

// ── 2. Ciclo ──────────────────────────────────────────────────────────────────
// Fonte: mapaGatilhos.influenciaCiclo (preferencial) ou principalPadrao lútea
// Gate:  influenciaCiclo.delta >= 15  OU  principalPadrao.faseDominante === 'lutea'

function insightCiclo(r) {
  const inf = r.mapaGatilhos?.influenciaCiclo;

  if (inf && inf.delta >= 15) {
    return {
      tipo:      'ciclo',
      relevancia: clamp01(0.80 * clamp01(inf.delta / 60)),
      titulo:    'Influência da fase lútea',
      texto:     `A fase lútea concentra maior carga sintomática — ${inf.pioraLutea}% dos dias `
               + `nessa fase apresentaram múltiplos sintomas alterados, contra ${inf.pioraOutras}% `
               + `nas demais fases.`,
      badge:     `+${inf.delta} pontos`,
      fonte:     'Fatores Associados',
      icone:     'moon',
    };
  }

  const pp = r.principalPadrao;
  if (pp?.faseDominante === 'lutea' && pp?.confianca === 'alta') {
    return {
      tipo:      'ciclo',
      relevancia: clamp01(0.80 * clamp01((pp.delta ?? 0) / 60)),
      titulo:    `${pp.grupoLabel} concentrado na fase ${pp.faseDomLabel}`,
      texto:     pp.narrativa ?? '',
      badge:     `+${pp.delta ?? 0} pontos`,
      fonte:     'Padrões por Fase',
      icone:     'moon',
    };
  }

  return null;
}

// ── 3. Associação Relevante ───────────────────────────────────────────────────
// Fonte: corpoComportamento.associacoes[0] (maior score interno)
// Gate:  disponivel && associacoes.length > 0 && lift >= 1.5

function insightAssociacaoRelevante(r) {
  const cc = r.corpoComportamento;
  if (!cc?.disponivel || !cc.associacoes?.length) return null;

  const top = cc.associacoes[0];
  if ((top.lift ?? 0) < 1.5) return null;

  const labelA = top.labelA.charAt(0).toUpperCase() + top.labelA.slice(1);

  return {
    tipo:      'associacao_relevante',
    relevancia: clamp01(0.65 * clamp01(top.lift / 3)),
    titulo:    `${labelA} + ${top.labelB}`,
    texto:     top.narrativa ?? '',
    badge:     `${top.lift}×`,
    fonte:     'Corpo → Comportamento',
    icone:     'arrows-right-left',
  };
}

// ── 4. Recuperação ────────────────────────────────────────────────────────────
// Fonte: tempoRetomada
// Gate:  tempoRetomada.disponivel === true (≥ 7 episódios internamente garantidos)

function insightRecuperacao(r) {
  const tr = r.tempoRetomada;
  if (!tr?.disponivel) return null;

  const { mediana, minDias, maxDias, nEpisodios } = tr;
  const dias = mediana === 1 ? 'dia' : 'dias';

  return {
    tipo:      'recuperacao',
    relevancia: 0.50,
    titulo:    `Retomada em mediana de ${mediana} ${dias}`,
    texto:     `Em ${nEpisodios} episódios observados, os registros voltaram ao padrão habitual `
             + `em mediana de ${mediana} ${dias} (variação: ${minDias}–${maxDias} dias).`,
    badge:     `${nEpisodios} episódios`,
    fonte:     'Tempo de Retomada',
    icone:     'refresh',
  };
}

// ── 5. Tendência Emergente ────────────────────────────────────────────────────
// Fonte: padroesEmFormacao[0] (maior nObs, já ordenado pelo motor)
// Gate:  padroesEmFormacao.length > 0

function insightTendenciaEmergente(r) {
  const pf = r.padroesEmFormacao;
  if (!pf?.length) return null;

  const p = pf[0];
  return {
    tipo:      'tendencia_emergente',
    relevancia: 0.25,
    titulo:    `Sinal inicial: ${p.grupoLabel} na fase ${p.faseDomLabel}`,
    texto:     p.narrativa ?? '',
    badge:     `${p.nObs} obs`,
    fonte:     'Padrões em Formação',
    icone:     'plant',
  };
}

// ── Ponto de entrada ──────────────────────────────────────────────────────────
export function gerarInsights(perfilResult) {
  if (!perfilResult || perfilResult.dadosBase?.estagio === 'insuficiente') return [];

  return [
    insightFatorDominante(perfilResult),
    insightCiclo(perfilResult),
    insightAssociacaoRelevante(perfilResult),
    insightRecuperacao(perfilResult),
    insightTendenciaEmergente(perfilResult),
  ]
    .filter(Boolean)
    .sort((a, b) => b.relevancia - a.relevancia)
    .slice(0, 5);
}
