// ── Evidências para Conduta — Sprint 14 ─────────────────────────────────────
// Relaciona o objetivo_principal de uma conduta às evidências do Perfil Biológico.
// Mecanismo: vocabulário clínico normalizado (PT-BR). Sem IA. Sem inferência.

// ── Normalização ─────────────────────────────────────────────────────────────
// Transforma qualquer texto em tokens comparáveis com as chaves do vocab.

function normalizar(str) {
  return (str ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')  // remove diacríticos
    .replace(/[^a-z]/g, ' ');          // não-letra vira espaço
}

// ── Vocabulário clínico ───────────────────────────────────────────────────────
// Chaves: tokens já normalizados (sem acentos, lowercase).
// Valores: campos[] e eixos[] que o token ativa no Perfil Biológico.
// tempoRetomada: true quando o token sinaliza objetivo longitudinal.

const VOCAB = {
  // Sono
  sono:              { campos: ['sono'],                                   eixos: ['adrenal', 'progesterona'] },
  dormir:            { campos: ['sono'],                                   eixos: ['adrenal', 'progesterona'] },
  insonia:           { campos: ['sono'],                                   eixos: ['adrenal'] },

  // Energia
  energia:           { campos: ['energia'],                                eixos: ['adrenal', 'tireoidiano', 'glicemico'] },
  fadiga:            { campos: ['energia'],                                eixos: ['adrenal', 'tireoidiano'] },
  cansaco:           { campos: ['energia'],                                eixos: ['adrenal', 'tireoidiano'] },
  disposicao:        { campos: ['energia'],                                eixos: ['adrenal', 'tireoidiano'] },
  vitalidade:        { campos: ['energia'],                                eixos: ['adrenal', 'tireoidiano'] },

  // Humor / emocional
  humor:             { campos: ['humor', 'irritabilidade'],                eixos: ['progesterona', 'estrogenico'] },
  emocional:         { campos: ['humor', 'ansiedade'],                     eixos: ['progesterona', 'adrenal'] },
  emocoes:           { campos: ['humor', 'ansiedade'],                     eixos: ['progesterona', 'adrenal'] },
  choro:             { campos: ['humor'],                                  eixos: ['progesterona'] },

  // Ansiedade / estresse
  ansiedade:         { campos: ['ansiedade'],                              eixos: ['adrenal', 'progesterona', 'glicemico'] },
  estresse:          { campos: ['ansiedade', 'sono'],                      eixos: ['adrenal'] },
  stress:            { campos: ['ansiedade', 'sono'],                      eixos: ['adrenal'] },
  nervosismo:        { campos: ['ansiedade'],                              eixos: ['adrenal'] },

  // Irritabilidade
  irritabilidade:    { campos: ['irritabilidade'],                         eixos: ['glicemico', 'progesterona', 'adrenal'] },
  irritacao:         { campos: ['irritabilidade'],                         eixos: ['glicemico', 'progesterona'] },

  // Compulsão / glicemia
  compulsao:         { campos: ['compulsao'],                              eixos: ['glicemico'] },
  glicemia:          { campos: ['compulsao', 'energia'],                   eixos: ['glicemico'] },
  acucar:            { campos: ['compulsao'],                              eixos: ['glicemico'] },
  insulina:          { campos: ['compulsao', 'energia'],                   eixos: ['glicemico'] },
  glicemico:         { campos: ['compulsao', 'energia'],                   eixos: ['glicemico'] },

  // Intestino / digestão
  intestino:         { campos: ['intestino'],                              eixos: ['intestinal'] },
  intestinal:        { campos: ['intestino'],                              eixos: ['intestinal'] },
  digestao:          { campos: ['intestino'],                              eixos: ['intestinal'] },
  digestivo:         { campos: ['intestino'],                              eixos: ['intestinal'] },
  estufamento:       { campos: ['inchaco', 'intestino'],                   eixos: ['intestinal'] },
  constipacao:       { campos: ['intestino'],                              eixos: ['intestinal'] },
  prisao:            { campos: ['intestino'],                              eixos: ['intestinal'] },
  microbioma:        { campos: ['intestino'],                              eixos: ['intestinal'] },
  flora:             { campos: ['intestino'],                              eixos: ['intestinal'] },

  // Inflamação / dor
  inflamacao:        { campos: ['dor_cabeca', 'inchaco', 'dor_pelvica'],  eixos: ['inflamatorio'] },
  inflamatorio:      { campos: ['dor_cabeca', 'inchaco'],                  eixos: ['inflamatorio'] },
  dor:               { campos: ['dor_cabeca', 'dor_pelvica'],              eixos: ['inflamatorio'] },
  enxaqueca:         { campos: ['dor_cabeca'],                             eixos: ['estrogenico', 'inflamatorio'] },
  cabeca:            { campos: ['dor_cabeca'],                             eixos: ['estrogenico'] },
  pelvica:           { campos: ['dor_pelvica'],                            eixos: ['estrogenico', 'inflamatorio'] },
  colica:            { campos: ['dor_pelvica'],                            eixos: ['estrogenico'] },
  endometriose:      { campos: ['dor_pelvica'],                            eixos: ['estrogenico', 'inflamatorio'] },

  // Retenção / inchaço
  retencao:          { campos: ['retencao', 'inchaco'],                    eixos: ['estrogenico'] },
  inchaco:           { campos: ['inchaco', 'retencao'],                    eixos: ['estrogenico', 'inflamatorio'] },

  // Acne / pele
  acne:              { campos: ['acne'],                                   eixos: ['androgenico', 'inflamatorio'] },
  pele:              { campos: ['acne'],                                   eixos: ['androgenico'] },
  espinha:           { campos: ['acne'],                                   eixos: ['androgenico'] },

  // Foco / cognitivo
  foco:              { campos: ['foco'],                                   eixos: ['tireoidiano', 'adrenal', 'glicemico'] },
  concentracao:      { campos: ['foco'],                                   eixos: ['tireoidiano'] },
  cognitivo:         { campos: ['foco'],                                   eixos: ['tireoidiano', 'adrenal'] },
  cognitiva:         { campos: ['foco'],                                   eixos: ['tireoidiano', 'adrenal'] },
  memoria:           { campos: ['foco'],                                   eixos: ['tireoidiano', 'estrogenico'] },

  // Libido
  libido:            { campos: ['libido'],                                 eixos: ['androgenico', 'adrenal'] },
  sexual:            { campos: ['libido'],                                 eixos: ['androgenico'] },

  // Tireóide
  tireoide:          { campos: ['energia', 'foco'],                        eixos: ['tireoidiano'] },
  tireoidiano:       { campos: ['energia', 'foco'],                        eixos: ['tireoidiano'] },
  hipotireoidismo:   { campos: ['energia', 'foco'],                        eixos: ['tireoidiano'] },

  // Hormonal / ciclo (genérico — ativa apenas eixos, sem campos diretos)
  hormonal:          { campos: [],                                         eixos: ['estrogenico', 'progesterona', 'androgenico'] },
  hormonio:          { campos: [],                                         eixos: ['estrogenico', 'progesterona'] },
  hormonios:         { campos: [],                                         eixos: ['estrogenico', 'progesterona'] },
  ciclo:             { campos: [],                                         eixos: ['estrogenico', 'progesterona'] },
  menstrual:         { campos: [],                                         eixos: ['estrogenico', 'progesterona'] },
  menstruacao:       { campos: [],                                         eixos: ['estrogenico'] },
  lutea:             { campos: [],                                         eixos: ['progesterona'] },

  // Estrogênio / progesterona (específico)
  estrogenio:        { campos: ['retencao', 'dor_cabeca'],                 eixos: ['estrogenico'] },
  progesterona:      { campos: ['sono', 'humor'],                          eixos: ['progesterona'] },

  // Adrenal / cortisol
  adrenal:           { campos: ['ansiedade', 'sono'],                      eixos: ['adrenal'] },
  cortisol:          { campos: ['ansiedade', 'sono'],                      eixos: ['adrenal'] },

  // Tempo de retomada
  retomada:          { campos: [], eixos: [], tempoRetomada: true },
  recuperacao:       { campos: [], eixos: [], tempoRetomada: true },
  carga:             { campos: [], eixos: [], tempoRetomada: true },
};

// IDs dos fatores modificáveis → campo correspondente no motor
const CAMPO_DO_FATOR = {
  sono_ruim: 'sono',
  ansiedade: 'ansiedade',
  intestino: 'intestino',
};

// ── Mapeamento principal ──────────────────────────────────────────────────────
// Recebe conduta (objeto da tabela) + perfilResult (de calcularPerfilBiologico).
// Retorna array de evidências ordenadas por relevância, máx 4 (ou 2 se genérico).
// Retorna [] se nenhuma correspondência for encontrada.

export function mapearEvidencias({ conduta, perfilResult }) {
  if (!perfilResult || !conduta) return [];

  // Texto: objetivo principal + objetivos secundários como complemento
  const partes = [
    conduta.objetivo_principal ?? '',
    ...(conduta.objetivos_secundarios ?? []),
  ];
  const tokens = new Set(
    normalizar(partes.join(' ')).split(/\s+/).filter(Boolean)
  );

  const camposAtivados  = new Set();
  const eixosAtivados   = new Set();
  let   tempoRetomadaAtivado = false;

  for (const token of tokens) {
    const entrada = VOCAB[token];
    if (!entrada) continue;
    entrada.campos.forEach(c => camposAtivados.add(c));
    entrada.eixos.forEach(e => eixosAtivados.add(e));
    if (entrada.tempoRetomada) tempoRetomadaAtivado = true;
  }

  if (!camposAtivados.size && !eixosAtivados.size && !tempoRetomadaAtivado) return [];

  // Objetivo genérico = apenas eixos ativados, sem campos diretos
  const ehGenerico = camposAtivados.size === 0;
  const limite     = ehGenerico ? 2 : 4;

  const candidatos = [];

  // 1. Fatores Associados — match por campo (mais concreto)
  const { mapaGatilhos } = perfilResult;
  if (mapaGatilhos?.disponivel) {
    for (const fator of mapaGatilhos.fatores ?? []) {
      const campo = CAMPO_DO_FATOR[fator.id];
      if (campo && camposAtivados.has(campo)) {
        candidatos.push({
          tipo: `fator_${fator.id}`,
          label: 'Fator associado',
          detalhe: fator.label,
          prioridade: 1,
          score: fator.delta,
        });
      }
    }
  }

  // 2. Priorização — match por eixo (mais robusto)
  const { priorizacao } = perfilResult;
  if (priorizacao) {
    if (eixosAtivados.has(priorizacao.principal.eixoId)) {
      candidatos.push({
        tipo: 'priorizacao',
        label: 'Área de atenção observada',
        detalhe: priorizacao.principal.eixoNome,
        prioridade: 2,
        score: 1,
        _eixoId: priorizacao.principal.eixoId,
      });
    }
    if (priorizacao.secundaria && eixosAtivados.has(priorizacao.secundaria.eixoId)) {
      candidatos.push({
        tipo: 'priorizacao_sec',
        label: 'Área complementar observada',
        detalhe: priorizacao.secundaria.eixoNome,
        prioridade: 2,
        score: 0.65,
        _eixoId: priorizacao.secundaria.eixoId,
      });
    }
  }

  // 3. Associações V2 — match por campo
  const { corpoComportamento } = perfilResult;
  if (corpoComportamento?.disponivel) {
    for (const assoc of corpoComportamento.associacoes ?? []) {
      if (camposAtivados.has(assoc.campoA) || camposAtivados.has(assoc.campoB)) {
        const lA = assoc.labelA.charAt(0).toUpperCase() + assoc.labelA.slice(1);
        candidatos.push({
          tipo: `assoc_${assoc.id}`,
          label: 'Associação observada',
          detalhe: `${lA} ↔ ${assoc.labelB}`,
          prioridade: 3,
          score: assoc.score,
        });
      }
    }
  }

  // 4. Convergências — match por eixo
  for (const conv of perfilResult.convergencias ?? []) {
    if (eixosAtivados.has(conv.eixoId)) {
      candidatos.push({
        tipo: `conv_${conv.eixoId}`,
        label: 'Padrão convergente',
        detalhe: conv.eixoNome,
        prioridade: 4,
        score: conv.score,
        _eixoId: conv.eixoId,
      });
    }
  }

  // 5. Tempo de Retomada — match por flag
  const { tempoRetomada } = perfilResult;
  if (tempoRetomadaAtivado && tempoRetomada?.disponivel) {
    const labelDias = tempoRetomada.mediana === 1 ? 'dia' : 'dias';
    candidatos.push({
      tipo: 'retomada',
      label: 'Tempo de retomada',
      detalhe: `${tempoRetomada.mediana} ${labelDias} (mediana observada)`,
      prioridade: 5,
      score: 1,
    });
  }

  // Ordenar: prioridade crescente, score decrescente dentro de cada prioridade
  candidatos.sort((a, b) => a.prioridade - b.prioridade || b.score - a.score);

  // Dedup: por tipo + por eixo entre priorização e convergência
  const vistos     = new Set();
  const vistosEixo = new Set();
  const selecionados = [];
  for (const c of candidatos) {
    if (vistos.has(c.tipo)) continue;
    if (c._eixoId && vistosEixo.has(c._eixoId)) continue;
    if (selecionados.length >= limite) break;
    vistos.add(c.tipo);
    if (c._eixoId) vistosEixo.add(c._eixoId);
    selecionados.push(c);
  }

  return selecionados;
}
