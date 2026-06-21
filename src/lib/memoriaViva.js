// ─────────────────────────────────────────────────────────────────────────────
// Memória Clínica Viva 2.0
// Sintetiza 3 fontes em uma lista unificada de verdades clínicas classificadas.
// Sem IA. Sem inferência. Regras objetivas e auditáveis.
// Função pura — sem imports, sem efeitos colaterais.
// ─────────────────────────────────────────────────────────────────────────────

const DIAS_MS    = 86_400_000;
const NIVEL_ORDEM = { consolidado: 0, consolidacao: 1, observacao: 2 };

function nivelLabel(nivel) {
  return nivel === 'consolidado'  ? 'Consolidado'
       : nivel === 'consolidacao' ? 'Em consolidação'
       :                            'Em observação';
}

function fmtData(isoStr) {
  if (!isoStr) return '';
  const [y, m, d] = isoStr.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function insightFonteLabel(tipo) {
  const L = {
    fator_dominante:      'Convergências Clínicas',
    ciclo:                'Fatores Associados · Ciclo',
    associacao_relevante: 'Corpo → Comportamento',
    recuperacao:          'Tempo de Retomada',
    tendencia_emergente:  'Padrões em Formação',
  };
  return L[tipo] ?? 'Perfil Biológico';
}

// ── Ponto de entrada ──────────────────────────────────────────────────────────
// aprendizados        — rows de estrategias (Fonte A)
// narrativasAprovadas — rows de jornada_historico (Fonte B)
// insights            — array de gerarInsights() (Fonte C)
// hoje                — Date — injetada para testabilidade

export function sintetizarMemoria({ aprendizados, narrativasAprovadas, insights, hoje }) {
  const agoraMs = (hoje ?? new Date()).getTime();
  const items   = [];

  // ── Fonte A: Aprendizados de estratégia ────────────────────────────────────
  // nivel: depende de aprendizado_essencial + idade desde o encerramento
  // - não essencial            → observacao
  // - essencial < 90 dias      → consolidacao
  // - essencial ≥ 90 dias      → consolidado

  for (const a of (aprendizados ?? [])) {
    if (!a.aprendizados) continue;
    const encMs = a.encerrada_em ? new Date(a.encerrada_em).getTime() : agoraMs;
    const ageMs = agoraMs - encMs;
    const nivel = !a.aprendizado_essencial     ? 'observacao'
                : ageMs >= 90 * DIAS_MS        ? 'consolidado'
                :                                'consolidacao';

    items.push({
      id:                    a.id,
      texto:                 a.aprendizados,
      origem:                'estrategia',
      data:                  a.encerrada_em?.slice(0, 10) ?? null,
      nivel,
      badge:                 nivelLabel(nivel),
      meta:                  [a.titulo, a.categoria, a.encerrada_em ? `enc. ${fmtData(a.encerrada_em)}` : null]
                               .filter(Boolean).join(' · '),
      aprendizado_essencial: !!a.aprendizado_essencial,
      _sortTs:               encMs,
    });
  }

  // ── Fonte B: Narrativas de fase aprovadas ──────────────────────────────────
  // narrativa_aprovada IS NOT NULL → sempre "Em consolidação"
  // (nutri aprovou a narrativa = curadoria consciente da fase)

  for (const n of (narrativasAprovadas ?? [])) {
    if (!n.narrativa_aprovada) continue;
    const dataMs = n.narrativa_aprovada_em
      ? new Date(n.narrativa_aprovada_em).getTime()
      : n.data_fim_fase
        ? new Date(n.data_fim_fase + 'T12:00:00').getTime()
        : agoraMs;

    items.push({
      id:      `narrativa_${n.id}`,
      texto:   n.narrativa_aprovada,
      origem:  'narrativa_fase',
      data:    n.data_fim_fase ?? null,
      nivel:   'consolidacao',
      badge:   'Em consolidação',
      meta:    `Fase ${n.fase} · ${n.nome_fase} · narrativa aprovada`,
      _sortTs: dataMs,
    });
  }

  // ── Fonte C: Insights biológicos (relevância >= 0.5) ──────────────────────
  // 0.5 ≤ relevância < 0.7 → consolidacao
  // relevância ≥ 0.7        → consolidado

  for (const ins of (insights ?? [])) {
    if (!ins || ins.relevancia < 0.5) continue;
    const nivel = ins.relevancia >= 0.7 ? 'consolidado' : 'consolidacao';

    items.push({
      id:      `insight_${ins.tipo}`,
      texto:   ins.texto,
      origem:  'insight_biologico',
      data:    null,
      nivel,
      badge:   nivelLabel(nivel),
      meta:    `Perfil Biológico · ${insightFonteLabel(ins.tipo)}`,
      _sortTs: Math.round(ins.relevancia * 1e12),
    });
  }

  // Ordenar: nivel (consolidado → consolidacao → observacao); desempate → mais recente
  return items.sort((a, b) => {
    const dn = NIVEL_ORDEM[a.nivel] - NIVEL_ORDEM[b.nivel];
    return dn !== 0 ? dn : b._sortTs - a._sortTs;
  });
}
