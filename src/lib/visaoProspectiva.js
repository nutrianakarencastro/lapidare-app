// ── Visão Prospectiva — Sprint 17 ─────────────────────────────────────────────
// Transforma padrões históricos em pontos de atenção futuros.
// Sem IA. Sem previsão. Linguagem estritamente observacional.

// ── Templates de texto ────────────────────────────────────────────────────────

const GRUPO_PROSPECTIVO = {
  sono:      'sono mais difícil',
  energia:   'queda de energia',
  humor:     'humor e irritabilidade mais intensos',
  compulsao: 'maior frequência de compulsão alimentar',
  acne:      'maior frequência de acne',
  retencao:  'maior frequência de retenção e inchaço',
};

function textoFase(padrao) {
  const sintoma = GRUPO_PROSPECTIVO[padrao.grupoId] ?? padrao.grupoLabel.toLowerCase();
  const fase    = padrao.faseDomLabel;
  return padrao.confianca === 'alta'
    ? `Na fase ${fase}, os registros costumam mostrar ${sintoma}.`
    : `Os registros sugerem que a fase ${fase} pode concentrar ${sintoma}.`;
}

const FATOR_TEXTO = {
  sono_ruim: 'Nos dias em que o sono está difícil, os registros costumam mostrar maior carga sintomática.',
  ansiedade: 'Nos dias em que a ansiedade está elevada, os registros costumam mostrar maior carga sintomática.',
  intestino: 'Nos dias em que o intestino está alterado, os registros costumam mostrar maior carga sintomática.',
};

function textoFator(fator) {
  return FATOR_TEXTO[fator.id]
    ?? `Quando ${fator.label}, os registros costumam mostrar maior carga sintomática.`;
}

function textoRetomada(tempoRetomada) {
  const { mediana } = tempoRetomada;
  const labelDias   = mediana === 1 ? 'dia' : 'dias';
  return `Após períodos de maior carga, os registros costumam levar cerca de ${mediana} ${labelDias} para voltar ao padrão habitual.`;
}

// ── Função principal ──────────────────────────────────────────────────────────
// Recebe perfilResult (de calcularPerfilBiologico) — sem novas queries.
// Retorna array de pontos de atenção (máx 3), ordenados por prioridade de fonte.

export function gerarPontosAtencao(perfilResult) {
  if (!perfilResult || perfilResult.dadosBase?.estagio === 'insuficiente') return [];

  const pontos        = [];
  const temasCobertos = new Set();

  function addPonto(ponto) {
    if (pontos.length >= 3)              return;
    if (temasCobertos.has(ponto.tema))   return;
    temasCobertos.add(ponto.tema);
    pontos.push({ id: ponto.id, tipo: ponto.tipo, texto: ponto.texto, fonte: ponto.fonte });
  }

  // P1: Padrões por fase — alta confiança primeiro, depois moderada
  // formacao excluído: sinal ainda não consolidado
  const padroesOrdenados = [
    ...(perfilResult.padroes ?? []).filter(p => p.confianca === 'alta'),
    ...(perfilResult.padroes ?? []).filter(p => p.confianca === 'moderada'),
  ];

  for (const p of padroesOrdenados) {
    addPonto({
      id:    `fase_${p.grupoId}_${p.faseDominante}`,
      tipo:  'fase',
      texto: textoFase(p),
      fonte: 'Padrões por Fase',
      tema:  `fase_${p.grupoId}_${p.faseDominante}`,
    });
    // Marca fase lútea como coberta para impedir duplicação via influenciaCiclo
    if (p.faseDominante === 'lutea') temasCobertos.add('fase_lutea_geral');
  }

  // P2: Influência do ciclo (fase lútea geral) — só se não coberta por padrão de fase
  const { mapaGatilhos } = perfilResult;
  if (mapaGatilhos?.influenciaCiclo && (mapaGatilhos.influenciaCiclo.delta ?? 0) >= 15) {
    addPonto({
      id:    'fase_lutea_carga',
      tipo:  'fase',
      texto: 'A fase lútea costuma concentrar maior carga sintomática nos registros desta paciente.',
      fonte: 'Influência do Ciclo',
      tema:  'fase_lutea_geral',
    });
  }

  // P3: Fatores modificáveis
  if (mapaGatilhos?.disponivel) {
    for (const fator of mapaGatilhos.fatores ?? []) {
      addPonto({
        id:    `fator_${fator.id}`,
        tipo:  'fator',
        texto: textoFator(fator),
        fonte: 'Fatores Associados',
        tema:  `fator_${fator.id}`,
      });
    }
  }

  // P4: Tempo de retomada
  const { tempoRetomada } = perfilResult;
  if (tempoRetomada?.disponivel) {
    addPonto({
      id:    'retomada',
      tipo:  'retomada',
      texto: textoRetomada(tempoRetomada),
      fonte: 'Tempo de Retomada',
      tema:  'retomada',
    });
  }

  return pontos;
}
