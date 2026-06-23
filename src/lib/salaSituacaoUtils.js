// Motor puro da Sala de Situação Clínica — Sprint 27 / Sprint E.1.
// Recebe dados já carregados por _ResumoClinico.jsx e retorna
// sinais priorizados. Sem queries, sem side-effects.

import { LABEL_REFEICAO } from './glicemiaUtils.js';

function diasDesde(isoDate) {
  if (!isoDate) return null;
  const base = isoDate.length > 10 ? isoDate : isoDate + 'T12:00:00';
  return Math.floor((Date.now() - new Date(base).getTime()) / 86_400_000);
}

function semanaAtual(dataInicio) {
  if (!dataInicio) return 1;
  const diff = Math.floor((Date.now() - new Date(dataInicio + 'T12:00:00').getTime()) / 86_400_000);
  return Math.max(1, Math.ceil((diff + 1) / 7));
}

function dataCorteISO(diasAtras) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().slice(0, 10);
}

const REFEICOES_FIXAS = ['jejum', 'cafe_manha', 'almoco', 'jantar'];

// glicemia: { ativo, registros, diasAtivo } | null
// intestino: { ativo, periodicidade, registros } | null
export function gerarSinais({ checkin, consistencia, condutaAtual, metas, memoriaClinica, jornada, glicemia, intestino }) {
  const alta     = [];
  const observar = [];
  const contexto = [];

  const modulosAtivos = glicemia?.ativo === true || intestino?.ativo === true;

  // ── 🔴🟡⚪ DMG ────────────────────────────────────────────────────────────
  if (glicemia?.ativo) {
    const regs  = glicemia.registros ?? [];
    const c7str = dataCorteISO(7);

    // 🔴 Hipoglicemia: ≥1 registro < 70 mg/dL nos últimos 14 dias
    const hipoglicemias = regs.filter(r => r.valor_mg_dl < 70);
    if (hipoglicemias.length >= 1) {
      alta.push({
        id:        'dmg_hipoglicemia',
        prioridade: 'alta',
        texto:     `Hipoglicemia detectada — ${hipoglicemias.length} registro${hipoglicemias.length !== 1 ? 's' : ''} abaixo de 70 mg/dL`,
        acao:      'glicemia',
      });
    }

    // 🔴 Jejum alterado: ≥2 jejuns ≥ 95 mg/dL nos últimos 7 dias
    const jejunsAlterados = regs.filter(r =>
      r.tipo_refeicao === 'jejum' && r.data >= c7str && r.valor_mg_dl >= 95
    );
    if (jejunsAlterados.length >= 2) {
      alta.push({
        id:        'dmg_jejum_alterado',
        prioridade: 'alta',
        texto:     `Jejum alterado em ${jejunsAlterados.length} dias nesta semana`,
        acao:      'glicemia',
      });
    }

    // 🟡 Pós-prandial alterado: ≥30% das medições acima da meta
    const posPrandiais = regs.filter(r => r.tipo_refeicao !== 'jejum');
    if (posPrandiais.length > 0) {
      const foraMeta = posPrandiais.filter(r =>
        r.protocolo === '1h' ? r.valor_mg_dl >= 140 : r.valor_mg_dl >= 120
      );
      const pct = Math.round((foraMeta.length / posPrandiais.length) * 100);
      if (pct >= 30) {
        observar.push({
          id:        'dmg_postprandial',
          prioridade: 'observar',
          texto:     `Pós-prandial elevado em ${pct}% das medições`,
          acao:      'glicemia',
        });
      }
    }

    // 🟡 Refeição crítica: refeição com maior frequência de alterações (≥2)
    const altPorRefeicao = {};
    for (const r of regs) {
      const foraMeta = r.tipo_refeicao === 'jejum'
        ? r.valor_mg_dl >= 95
        : (r.protocolo === '1h' ? r.valor_mg_dl >= 140 : r.valor_mg_dl >= 120);
      if (foraMeta) altPorRefeicao[r.tipo_refeicao] = (altPorRefeicao[r.tipo_refeicao] ?? 0) + 1;
    }
    const candidatas = Object.entries(altPorRefeicao).filter(([, cnt]) => cnt >= 2);
    if (candidatas.length > 0) {
      candidatas.sort((a, b) => b[1] - a[1]);
      const [topKey] = candidatas[0];
      observar.push({
        id:        'dmg_refeicao_critica',
        prioridade: 'observar',
        texto:     `${LABEL_REFEICAO[topKey] ?? topKey} apresenta maior frequência de alterações glicêmicas`,
        acao:      'glicemia',
      });
    }

    // ⚪ Alta adesão DMG: janela fixa 14 dias, somente após 7 dias de módulo ativo
    // 56 = 14 dias × 4 refeições fixas por dia
    if ((glicemia.diasAtivo ?? 0) >= 7) {
      const fixasRegistradas = regs.filter(r => REFEICOES_FIXAS.includes(r.tipo_refeicao)).length;
      const pct = Math.round((fixasRegistradas / 56) * 100);
      if (pct >= 80) {
        contexto.push({
          id:        'dmg_alta_adesao',
          prioridade: 'contexto',
          texto:     `Alta adesão ao diário glicêmico — ${pct}% de registros`,
          acao:      'glicemia',
        });
      }
    }
  }

  // ── 🔴🟡⚪ Intestino ──────────────────────────────────────────────────────
  if (intestino?.ativo) {
    const regs = intestino.registros ?? [];

    // 🔴 Bristol 1–2 recorrente: ≥3 registros nos últimos 14 dias
    const bristol12 = regs.filter(r => r.bristol != null && r.bristol <= 2);
    if (bristol12.length >= 3) {
      alta.push({
        id:        'intestino_bristol_baixo',
        prioridade: 'alta',
        texto:     `Bristol 1–2 recorrente — ${bristol12.length} registros nos últimos 14 dias`,
        acao:      'intestino',
      });
    }

    // 🔴 Bristol 6–7 recorrente: ≥3 registros nos últimos 14 dias
    const bristol67 = regs.filter(r => r.bristol != null && r.bristol >= 6);
    if (bristol67.length >= 3) {
      alta.push({
        id:        'intestino_bristol_alto',
        prioridade: 'alta',
        texto:     `Bristol 6–7 recorrente — ${bristol67.length} registros nos últimos 14 dias`,
        acao:      'intestino',
      });
    }

    // 🟡 Padrão intestinal oscilante: Bristol 1–2 E 6–7 simultâneos
    if (bristol12.length >= 3 && bristol67.length >= 3) {
      observar.push({
        id:        'intestino_padrao_oscilante',
        prioridade: 'observar',
        texto:     'Padrão intestinal oscilante — fezes endurecidas e líquidas recorrentes no mesmo período',
        acao:      'intestino',
      });
    }

    // 🟡 Estufamento recorrente: intensidade ≥2 em ≥3 registros
    const estufamento = regs.filter(r => r.estufamento != null && r.estufamento >= 2);
    if (estufamento.length >= 3) {
      observar.push({
        id:        'intestino_estufamento',
        prioridade: 'observar',
        texto:     `Estufamento recorrente em ${estufamento.length} registros nos últimos 14 dias`,
        acao:      'intestino',
      });
    }

    // 🟡 Náuseas recorrentes: intensidade ≥2 em ≥3 registros
    const nauseas = regs.filter(r => r.nauseas != null && r.nauseas >= 2);
    if (nauseas.length >= 3) {
      observar.push({
        id:        'intestino_nauseas',
        prioridade: 'observar',
        texto:     `Náuseas recorrentes em ${nauseas.length} registros nos últimos 14 dias`,
        acao:      'intestino',
      });
    }

    // 🟡 Sensação de evacuação incompleta: ≥3 ocorrências
    const evIncompleta = regs.filter(r => r.esvaziamento_incompleto === true);
    if (evIncompleta.length >= 3) {
      observar.push({
        id:        'intestino_esvaziamento',
        prioridade: 'observar',
        texto:     `Sensação de evacuação incompleta em ${evIncompleta.length} registros`,
        acao:      'intestino',
      });
    }

    // ⚪ Alta adesão intestinal — sob_demanda não gera sinal
    const esperadasMap = { diario: 14, semanal: 2, quinzenal: 1 };
    const esperadas = esperadasMap[intestino.periodicidade] ?? null;
    if (esperadas !== null) {
      const pct = Math.round((regs.length / esperadas) * 100);
      if (pct >= 80) {
        contexto.push({
          id:        'intestino_alta_adesao',
          prioridade: 'contexto',
          texto:     'Alta adesão ao diário intestinal',
          acao:      'intestino',
        });
      }
    }
  }

  // ── 🔴 Alta atenção — administrativos ────────────────────────────────────
  if (checkin && !checkin.respondido_em) {
    const dias = diasDesde(checkin.enviado_em);
    if (dias != null && dias >= 3) {
      alta.push({
        id:        'checkin_pendente',
        prioridade: 'alta',
        texto:     `Check-in pendente há ${dias} dia${dias !== 1 ? 's' : ''} sem resposta`,
        acao:      'checkin',
      });
    }
  }

  if (consistencia && !consistencia.aguardando && consistencia.queda7d) {
    alta.push({
      id:        'consistencia_queda',
      prioridade: 'alta',
      texto:     'Consistência de registros caiu nos últimos 7 dias',
      acao:      null,
    });
  }

  // ── 🟡 Observar — administrativos ────────────────────────────────────────
  if (
    consistencia && !consistencia.aguardando &&
    !consistencia.queda7d &&
    ['oscilante', 'retomada'].includes(consistencia.classificacao)
  ) {
    observar.push({
      id:        'consistencia_critica',
      prioridade: 'observar',
      texto:     consistencia.classificacao === 'retomada'
        ? 'Consistência precisa de retomada nos últimos 30 dias'
        : 'Consistência oscilante nos últimos 30 dias',
      acao:      null,
    });
  }

  if (condutaAtual?.data) {
    const dias = diasDesde(condutaAtual.data);
    if (dias != null && dias > 90) {
      observar.push({
        id:        'conduta_antiga',
        prioridade: 'observar',
        texto:     `Conduta atual registrada há ${dias} dias — vale revisitar`,
        acao:      'condutas',
      });
    }
  }

  if (metas && metas.length > 0 && !metas.some(m => m.status === 'em_evolucao')) {
    observar.push({
      id:        'metas_sem_evolucao',
      prioridade: 'observar',
      texto:     `${metas.length} meta${metas.length !== 1 ? 's' : ''} ativa${metas.length !== 1 ? 's' : ''} sem evolução registrada`,
      acao:      'metas',
    });
  }

  // ── ⚪ Contexto ──────────────────────────────────────────────────────────
  if (memoriaClinica) {
    const essenciais = memoriaClinica.filter(a => a.aprendizado_essencial);
    if (essenciais.length > 0) {
      const preview = essenciais.slice(0, 2).map(a => a.titulo).join(' · ');
      contexto.push({
        id:        'aprendizados_evidencia',
        prioridade: 'contexto',
        texto:     `${essenciais.length} aprendizado${essenciais.length !== 1 ? 's' : ''} em evidência — ${preview}${essenciais.length > 2 ? '…' : ''}`,
        acao:      null,
      });
    }
  }

  if (jornada) {
    const semana = semanaAtual(jornada.data_inicio_fase);
    const total  = jornada.duracao_semanas_prevista ?? 4;
    contexto.push({
      id:        'fase_jornada',
      prioridade: 'contexto',
      texto:     `Fase ${jornada.fase} — ${jornada.nome_fase} · Semana ${semana} de ${total}`,
      acao:      'jornada',
    });
  }

  const limA = modulosAtivos ? 3 : 2;
  const limO = modulosAtivos ? 4 : 3;

  return [
    ...alta.slice(0, limA),
    ...observar.slice(0, limO),
    ...contexto.slice(0, 2),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// calcularComparacao14d — Sprint Sala de Situação 2.0
// Motor puro: recebe dados dos últimos 28 dias e devolve evolução comparada.
// Sem queries, sem side-effects.
// ─────────────────────────────────────────────────────────────────────────────

function corteISO(diasAtras) {
  const d = new Date();
  d.setDate(d.getDate() - diasAtras);
  return d.toISOString().slice(0, 10);
}

function mediaNumerica(vals) {
  if (!vals.length) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

const INTESTINO_SCORE_MAP = { normal: 0, preso: 1, solto: 1, gases: 1, alternado: 2 };

const ORDEM_MAGNITUDE = { marcante: 3, moderada: 2, leve: 1 };

// Texto específico por campo quando piorou — evita geração dinâmica de gênero/concordância
const TEXTO_PIORA = {
  energia:     'Queda de energia no mesmo período — pode refletir resposta às condutas em andamento.',
  humor:       'Humor reduzido no mesmo período — pode ter relação com fase do ciclo ou contexto de vida.',
  sono:        'Sono reduzido no mesmo período — pode influenciar regulação emocional e metabólica.',
  compulsao:   'Compulsão em alta no mesmo período — pode refletir influência do ciclo ou variação no padrão alimentar.',
  ansiedade:   'Ansiedade elevada no mesmo período — vale investigar estressores externos ou padrão de ciclo.',
  dor:         'Dor mais frequente no mesmo período — vale observar a relação com a fase do ciclo.',
  intestino:   'Trânsito intestinal alterado no mesmo período — pode estar relacionado ao padrão alimentar ou variação hormonal.',
  glicemia:    'Controle glicêmico reduzido no mesmo período — vale revisar refeições e padrão de sono.',
  consistencia:'Queda na consistência dos registros — vale explorar na consulta.',
  adesao:      'Queda na adesão no mesmo período.',
};

const DESC_CAMPO_2 = {
  energia:      'energia',
  humor:        'humor',
  sono:         'sono',
  compulsao:    'compulsão',
  ansiedade:    'ansiedade',
  dor:          'dor',
  intestino:    'trânsito intestinal',
  consistencia: 'consistência dos registros',
  glicemia:     'controle glicêmico',
  adesao:       'adesão aos hábitos',
};

function cap(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

function classificar14d({ id, label, j1, j2, threshold, sentido = 'positivo' }) {
  const MIN = 5;
  if (j1.length < MIN || j2.length < MIN) return { status: 'insuficiente', id, label };
  const mJ1 = mediaNumerica(j1);
  const mJ2 = mediaNumerica(j2);
  const delta   = mJ2 - mJ1;
  const efetivo = sentido === 'positivo' ? delta : -delta;
  const abs     = Math.abs(efetivo);
  let status, magnitude;
  if (efetivo >= threshold) {
    status    = 'melhorou';
    magnitude = abs >= threshold * 3 ? 'marcante' : abs >= threshold * 2 ? 'moderada' : 'leve';
  } else if (efetivo <= -threshold) {
    status    = 'piorou';
    magnitude = abs >= threshold * 3 ? 'marcante' : abs >= threshold * 2 ? 'moderada' : 'leve';
  } else {
    status    = 'estagnou';
    magnitude = null;
  }
  return { status, id, label, magnitude, valorJ1: +mJ1.toFixed(1), valorJ2: +mJ2.toFixed(1) };
}

function gerarLeituraClinica({ melhorou, piorou, estagnou, diasJ2 }) {
  if (diasJ2 < 5) {
    return 'Registros insuficientes nos últimos 14 dias para uma leitura clínica.';
  }

  const frases = [];

  // Frase 1 — padrão dominante
  if (melhorou.length > 0 && melhorou.length >= piorou.length) {
    const nomes = melhorou.slice(0, 2).map(m => DESC_CAMPO_2[m.id] ?? m.label);
    const mag   = melhorou[0].magnitude;
    const desc  = mag === 'marcante' ? 'melhora expressiva' : mag === 'moderada' ? 'melhora moderada' : 'melhora leve';
    const verbo = nomes.length > 1 ? 'apresentaram' : 'apresentou';
    frases.push(`${cap(nomes[0])}${nomes[1] ? ' e ' + nomes[1] : ''} ${verbo} ${desc} em relação ao período anterior.`);
  } else if (piorou.length > 0) {
    const nomes = piorou.slice(0, 2).map(p => DESC_CAMPO_2[p.id] ?? p.label);
    const mag   = piorou[0].magnitude;
    const desc  = mag === 'marcante' ? 'piora expressiva' : mag === 'moderada' ? 'piora moderada' : 'piora leve';
    const verbo = nomes.length > 1 ? 'apresentaram' : 'apresentou';
    frases.push(`${cap(nomes[0])}${nomes[1] ? ' e ' + nomes[1] : ''} ${verbo} ${desc} em relação ao período anterior.`);
  } else {
    frases.push('Período de manutenção — sem variação expressiva nas métricas monitoradas.');
  }

  // Frase 2 — contraponto se há piora com melhora, ou detalhe da piora dominante
  if (piorou.length > 0) {
    const top  = piorou[0];
    const txt  = TEXTO_PIORA[top.id];
    if (txt) frases.push(txt);
  }

  // Frase 3 — direcional de consistência
  const cons = [...melhorou, ...piorou, ...estagnou].find(m => m.id === 'consistencia');
  if (cons) {
    if (cons.status === 'melhorou') {
      frases.push('Engajamento nos registros em alta — boa base para análise clínica.');
    } else if (cons.status === 'piorou') {
      frases.push('Queda na consistência dos registros — vale explorar na consulta.');
    } else {
      frases.push('Consistência dos registros mantida no período.');
    }
  }

  return frases.slice(0, 3).join(' ');
}

export function calcularComparacao14d({
  sintomas28d       = [],
  intestinoLogs28d  = [],
  habitosLogs28d    = [],
  glicemia28d       = [],
  temHabitos        = false,
  moduloDMGAtivo    = false,
  modIntestinoAtivo = false,
}) {
  const c14 = corteISO(14);
  const c28 = corteISO(28);

  const isJ2 = d => String(d).slice(0, 10) >= c14;
  const isJ1 = d => { const s = String(d).slice(0, 10); return s >= c28 && s < c14; };

  const sintJ2 = sintomas28d.filter(r => isJ2(r.data));
  const sintJ1 = sintomas28d.filter(r => isJ1(r.data));
  const diasJ2  = new Set(sintJ2.map(r => String(r.data).slice(0, 10))).size;
  const diasJ1  = new Set(sintJ1.map(r => String(r.data).slice(0, 10))).size;

  const resultados = [];

  // ── Métricas positivas (0–4): energia, humor, sono ───────────────────────
  for (const [id, label] of [['energia', 'Energia'], ['humor', 'Humor'], ['sono', 'Sono']]) {
    resultados.push(classificar14d({
      id, label,
      j1: sintJ1.map(r => r[id]).filter(v => v != null),
      j2: sintJ2.map(r => r[id]).filter(v => v != null),
      threshold: 0.4,
      sentido: 'positivo',
    }));
  }

  // ── Métricas negativas (0–2): compulsão, ansiedade ───────────────────────
  for (const [id, label] of [['compulsao', 'Compulsão'], ['ansiedade', 'Ansiedade']]) {
    resultados.push(classificar14d({
      id, label,
      j1: sintJ1.map(r => r[id]).filter(v => v != null),
      j2: sintJ2.map(r => r[id]).filter(v => v != null),
      threshold: 0.3,
      sentido: 'negativo',
    }));
  }

  // ── Dor — max diário de dor_pelvica e dor_cabeca ─────────────────────────
  resultados.push(classificar14d({
    id: 'dor', label: 'Dor',
    j1: sintJ1.map(r => Math.max(r.dor_pelvica ?? 0, r.dor_cabeca ?? 0)),
    j2: sintJ2.map(r => Math.max(r.dor_pelvica ?? 0, r.dor_cabeca ?? 0)),
    threshold: 0.3,
    sentido: 'negativo',
  }));

  // ── Intestino ─────────────────────────────────────────────────────────────
  if (modIntestinoAtivo) {
    const bJ1 = intestinoLogs28d.filter(r => isJ1(r.data) && r.bristol != null).map(r => r.bristol);
    const bJ2 = intestinoLogs28d.filter(r => isJ2(r.data) && r.bristol != null).map(r => r.bristol);
    if (bJ1.length >= 5 && bJ2.length >= 5) {
      const mJ1 = mediaNumerica(bJ1);
      const mJ2 = mediaNumerica(bJ2);
      // Distância do ideal (bristol 4): menor = melhor
      const distJ1  = Math.abs(mJ1 - 4);
      const distJ2  = Math.abs(mJ2 - 4);
      const deltaDist = distJ2 - distJ1;
      const abs = Math.abs(deltaDist);
      let status, magnitude;
      if (deltaDist <= -0.5) {
        status = 'melhorou';
        magnitude = abs >= 1.5 ? 'marcante' : abs >= 1.0 ? 'moderada' : 'leve';
      } else if (deltaDist >= 0.5) {
        status = 'piorou';
        magnitude = abs >= 1.5 ? 'marcante' : abs >= 1.0 ? 'moderada' : 'leve';
      } else {
        status = 'estagnou';
        magnitude = null;
      }
      resultados.push({ status, id: 'intestino', label: 'Intestino', magnitude, valorJ1: +mJ1.toFixed(1), valorJ2: +mJ2.toFixed(1) });
    } else {
      resultados.push({ status: 'insuficiente', id: 'intestino', label: 'Intestino' });
    }
  } else {
    // Fallback via ciclo_sintomas_diarios.intestino (text → score 0–2)
    resultados.push(classificar14d({
      id: 'intestino', label: 'Intestino',
      j1: sintJ1.map(r => INTESTINO_SCORE_MAP[r.intestino]).filter(v => v != null),
      j2: sintJ2.map(r => INTESTINO_SCORE_MAP[r.intestino]).filter(v => v != null),
      threshold: 0.3,
      sentido: 'negativo',
    }));
  }

  // ── Consistência — dias únicos com registro / 14 ─────────────────────────
  const pctJ2 = Math.round(diasJ2 / 14 * 100);
  const pctJ1 = Math.round(diasJ1 / 14 * 100);
  const deltaC = pctJ2 - pctJ1;
  const absC   = Math.abs(deltaC);
  let statusC, magC;
  if (deltaC >= 15)       { statusC = 'melhorou'; magC = absC >= 45 ? 'marcante' : absC >= 30 ? 'moderada' : 'leve'; }
  else if (deltaC <= -15) { statusC = 'piorou';   magC = absC >= 45 ? 'marcante' : absC >= 30 ? 'moderada' : 'leve'; }
  else                    { statusC = 'estagnou';  magC = null; }
  resultados.push({ status: statusC, id: 'consistencia', label: 'Consistência', magnitude: magC, valorJ1: pctJ1, valorJ2: pctJ2, unidade: '%' });

  // ── Glicemia — % dentro da meta (apenas se DMG ativo) ────────────────────
  if (moduloDMGAtivo) {
    const gJ1 = glicemia28d.filter(r => isJ1(r.data));
    const gJ2 = glicemia28d.filter(r => isJ2(r.data));
    if (gJ1.length >= 4 && gJ2.length >= 4) {
      const pctMeta = regs => {
        const ok = regs.filter(r => {
          if (r.valor_mg_dl < 70) return false;
          if (r.tipo_refeicao === 'jejum') return r.valor_mg_dl <= 94;
          return r.protocolo === '1h' ? r.valor_mg_dl <= 139 : r.valor_mg_dl <= 119;
        });
        return Math.round(ok.length / regs.length * 100);
      };
      const pG1 = pctMeta(gJ1);
      const pG2 = pctMeta(gJ2);
      const deltaG = pG2 - pG1;
      const absG   = Math.abs(deltaG);
      let statusG, magG;
      if (deltaG >= 10)       { statusG = 'melhorou'; magG = absG >= 30 ? 'marcante' : absG >= 20 ? 'moderada' : 'leve'; }
      else if (deltaG <= -10) { statusG = 'piorou';   magG = absG >= 30 ? 'marcante' : absG >= 20 ? 'moderada' : 'leve'; }
      else                    { statusG = 'estagnou';  magG = null; }
      resultados.push({ status: statusG, id: 'glicemia', label: 'Glicemia', magnitude: magG, valorJ1: pG1, valorJ2: pG2, unidade: '%' });
    } else {
      resultados.push({ status: 'insuficiente', id: 'glicemia', label: 'Glicemia' });
    }
  }

  // ── Adesão — dias com log de hábitos / 14 (apenas se hábitos ativos) ──────
  if (temHabitos) {
    const hJ2 = new Set(habitosLogs28d.filter(r => isJ2(r.data)).map(r => String(r.data).slice(0, 10))).size;
    const hJ1 = new Set(habitosLogs28d.filter(r => isJ1(r.data)).map(r => String(r.data).slice(0, 10))).size;
    const pA2 = Math.round(hJ2 / 14 * 100);
    const pA1 = Math.round(hJ1 / 14 * 100);
    const deltaA = pA2 - pA1;
    const absA   = Math.abs(deltaA);
    let statusA, magA;
    if (deltaA >= 20)       { statusA = 'melhorou'; magA = absA >= 60 ? 'marcante' : absA >= 40 ? 'moderada' : 'leve'; }
    else if (deltaA <= -20) { statusA = 'piorou';   magA = absA >= 60 ? 'marcante' : absA >= 40 ? 'moderada' : 'leve'; }
    else                    { statusA = 'estagnou';  magA = null; }
    resultados.push({ status: statusA, id: 'adesao', label: 'Adesão', magnitude: magA, valorJ1: pA1, valorJ2: pA2, unidade: '%' });
  }

  // ── Separar por grupo, ordenar por magnitude, limitar a 3 cada ───────────
  const melhorou = resultados
    .filter(r => r.status === 'melhorou')
    .sort((a, b) => (ORDEM_MAGNITUDE[b.magnitude] ?? 0) - (ORDEM_MAGNITUDE[a.magnitude] ?? 0))
    .slice(0, 3);
  const piorou = resultados
    .filter(r => r.status === 'piorou')
    .sort((a, b) => (ORDEM_MAGNITUDE[b.magnitude] ?? 0) - (ORDEM_MAGNITUDE[a.magnitude] ?? 0))
    .slice(0, 3);
  const estagnou = resultados
    .filter(r => r.status === 'estagnou')
    .slice(0, 3);

  const leituraClinica = gerarLeituraClinica({ melhorou, piorou, estagnou, diasJ2 });

  return { melhorou, piorou, estagnou, diasJ2, diasJ1, leituraClinica };
}

// ─────────────────────────────────────────────────────────────────────────────
// gerarLeituraClinica21 — Sprint Sala de Situação 2.1
// Interpretação clínica contextualizada. Função pura — sem queries.
// ─────────────────────────────────────────────────────────────────────────────

const MAPA_CATEGORIA_CAMPO = {
  'Sono':               ['sono'],
  'Bem-estar emocional':['humor', 'ansiedade', 'compulsao'],
  'Alimentação':        ['compulsao', 'glicemia', 'energia'],
  'Intestino':          ['intestino'],
  'Suplementação':      ['energia', 'humor', 'sono'],
  'Movimento':          ['energia', 'humor'],
  'Autocuidado':        ['humor', 'ansiedade'],
};

const FASES_NEGATIVAS = new Set(['lutea', 'menstrual']);
const FASES_POSITIVAS = new Set(['folicular', 'ovulacao']);

function semanasDe(dataISOouDate) {
  if (!dataISOouDate) return null;
  const d = typeof dataISOouDate === 'string'
    ? new Date(dataISOouDate + 'T12:00:00')
    : dataISOouDate;
  return Math.ceil((Date.now() - d.getTime()) / (7 * 86_400_000));
}

export function gerarLeituraClinica21({
  comparacao        = null,
  estrategiasAtivas = [],
  metas             = [],
  jornadaAtual      = null,
  perfilBiologico   = null,
  consistencia      = null,
  faseAtual         = null,
  memoriaClinica    = [],
}) {
  const melhorou  = comparacao?.melhorou  ?? [];
  const piorou    = comparacao?.piorou    ?? [];
  const estagnou  = comparacao?.estagnou  ?? [];
  const diasJ2    = comparacao?.diasJ2    ?? 0;

  const idsMelhorou = new Set(melhorou.map(m => m.id));
  const idsPiorou   = new Set(piorou.map(p => p.id));
  // Campos que não melhoraram: relevantes para memória e perfil
  const idsNaoMelhorou = new Set([...idsPiorou, ...estagnou.map(e => e.id)]);

  const mapaGatilhos = perfilBiologico?.mapaGatilhos ?? null;
  const priorizacao  = perfilBiologico?.priorizacao  ?? null;

  // ── Frame 1 — O que explica ───────────────────────────────────────────────

  let hipotese = null;

  // R1.1 — Estratégia ativa mapeada para campo que melhorou → consistente
  if (melhorou.length > 0 && estrategiasAtivas.length > 0) {
    for (const estr of estrategiasAtivas) {
      const campos = MAPA_CATEGORIA_CAMPO[estr.categoria] ?? [];
      const match  = melhorou.find(m => campos.includes(m.id));
      if (match) {
        const campo = DESC_CAMPO_2[match.id] ?? match.label;
        hipotese = {
          texto:     `A melhora em ${campo} coincide com a estratégia de ${estr.categoria} em andamento — possível resposta à intervenção.`,
          confianca: 'consistente',
        };
        break;
      }
    }
  }

  // R1.2 — Gatilho confirmado no Perfil Biológico se repete em piora → consistente
  if (!hipotese && piorou.length > 0 && mapaGatilhos?.fatores?.length > 0) {
    const match = piorou.reduce((achou, p) => {
      if (achou) return achou;
      const f = mapaGatilhos.fatores.find(g => g.id === p.id && g.forca === 'forte');
      return f ? f : null;
    }, null);
    if (match) {
      hipotese = {
        texto:     `Sinal de ${match.label} observado neste período — o Perfil Biológico já identificou esse padrão como associado a dias difíceis.`,
        confianca: 'consistente',
      };
    }
  }

  // R1.3 — Padrão lúteo histórico confirmado → compatível
  if (!hipotese && faseAtual === 'lutea' && mapaGatilhos?.influenciaCiclo) {
    const match = piorou.find(p => p.id === 'ansiedade' || p.id === 'compulsao');
    if (match) {
      hipotese = {
        texto:     `O aumento de ${DESC_CAMPO_2[match.id] ?? match.label} é compatível com o padrão lúteo já identificado no Perfil Biológico desta paciente.`,
        confianca: 'compatível',
      };
    }
  }

  // R1.4 — Janela hormonal favorável sem contradição → compatível
  if (!hipotese && FASES_POSITIVAS.has(faseAtual)) {
    const match = melhorou.find(m => m.id === 'energia' || m.id === 'humor');
    const piorouMesmo = piorou.some(p => p.id === 'energia' || p.id === 'humor');
    if (match && !piorouMesmo) {
      const faseLbl = faseAtual === 'folicular' ? 'folicular' : 'de ovulação';
      hipotese = {
        texto:     `A fase ${faseLbl} favorece naturalmente energia e bem-estar hormonal — parte da melhora pode refletir esse contexto.`,
        confianca: 'compatível',
      };
    }
  }

  // R1.5 — Melhora em energia/humor mesmo em fase lútea → compatível
  if (!hipotese && faseAtual === 'lutea') {
    const match = melhorou.find(m => m.id === 'energia' || m.id === 'humor');
    if (match) {
      hipotese = {
        texto:     `Melhora em energia e humor mesmo em fase lútea — pode indicar boa regulação e resposta às condutas atuais.`,
        confianca: 'compatível',
      };
    }
  }

  // R1.6 — Período de estabilidade → observação
  if (!hipotese && melhorou.length === 0 && piorou.length === 0) {
    hipotese = {
      texto:     `Período de manutenção — indicadores estáveis em relação ao período anterior.`,
      confianca: 'observação',
    };
  }

  // ── Frame 2 — Investigar ──────────────────────────────────────────────────

  let investigar = null;

  // R2.1 — Dissociação energia/sono
  if (idsMelhorou.has('energia') && idsPiorou.has('sono')) {
    investigar = 'Energia em alta com sono reduzido — vale investigar se há compensação adrenérgica ou estressor sustentando essa energia.';
  }

  // R2.2 — Dissociação humor/ansiedade
  if (!investigar && idsMelhorou.has('humor') && idsPiorou.has('ansiedade')) {
    investigar = 'Humor positivo com ansiedade elevada — padrão que pode indicar adaptação ativa a um estressor não rastreado.';
  }

  // R2.3 — Piora de ansiedade/compulsão fora de fase negativa
  if (!investigar && faseAtual && !FASES_NEGATIVAS.has(faseAtual) && faseAtual !== 'desconhecida') {
    const match = piorou.find(p => p.id === 'ansiedade' || p.id === 'compulsao');
    if (match) {
      investigar = `${cap(DESC_CAMPO_2[match.id] ?? match.label)} em alta fora do período lúteo — vale investigar estressores contextuais ou variação alimentar.`;
    }
  }

  // R2.4 — Queda de energia em fase esperada para alta
  if (!investigar && FASES_POSITIVAS.has(faseAtual) && idsPiorou.has('energia')) {
    investigar = 'Queda de energia em fase folicular — período em que energia tende a ser mais alta. Vale investigar sono, alimentação ou contexto recente.';
  }

  // R2.5 — Viés de seleção: melhora com queda nos registros
  if (!investigar && melhorou.length > 0 && consistencia?.queda7d && diasJ2 < 10) {
    investigar = 'Melhora nos sintomas com queda nos registros — resultado pode estar enviesado pelos dias em que houve registro.';
  }

  // R2.6 — Eixo prioritário em piora
  if (!investigar && priorizacao?.principal?.top3?.length > 0) {
    const top3ids = new Set(priorizacao.principal.top3.map(c => c.id));
    const match   = piorou.find(p => top3ids.has(p.id));
    if (match) {
      investigar = `A piora em ${DESC_CAMPO_2[match.id] ?? match.label} está no eixo de atenção prioritária do Perfil Biológico: ${priorizacao.principal.eixoNome}. Pode sinalizar reativação do padrão.`;
    }
  }

  // ── Frame 3 — Próxima fase ────────────────────────────────────────────────

  let direcional = null;
  const semanasAtuais   = semanasDe(jornadaAtual?.data_inicio_fase);
  const duracaoPrevista = jornadaAtual?.duracao_semanas_prevista ?? null;

  // R3.0 — Fase além do prazo com predomínio de piora
  if (semanasAtuais && duracaoPrevista && semanasAtuais > duracaoPrevista && piorou.length > melhorou.length) {
    direcional = 'Fase com duração prevista ultrapassada e predomínio de piora — pode ser momento de encerrar e abrir nova direção na jornada.';
  }

  // R3.1 — Resposta consolidada → avançar fase
  if (!direcional && melhorou.length >= 3 && ['moderada', 'marcante'].includes(melhorou[0]?.magnitude) && (semanasAtuais ?? 0) >= 2 && diasJ2 >= 10) {
    direcional = 'Resposta positiva consolidada — momento favorável para avançar os objetivos da fase ou revisar o que foi alcançado.';
  }

  // R3.2 — Fase no limite com resposta mista → revisar antes de avançar
  if (!direcional && semanasAtuais && duracaoPrevista && semanasAtuais >= duracaoPrevista - 1 && melhorou.length > 0 && piorou.length > 0) {
    direcional = 'Próximo ao encerramento da fase com resposta mista — vale revisar objetivos antes de avançar ou prolongar.';
  }

  // R3.3 — Predomínio de piora com magnitude → revisar condutas
  if (!direcional && piorou.length > melhorou.length && ['moderada', 'marcante'].includes(piorou[0]?.magnitude)) {
    direcional = 'Mais indicadores em piora que em melhora — vale revisitar condutas antes de avançar a fase.';
  }

  // R3.4 — Resposta mista em curso
  if (!direcional && melhorou.length > 0 && piorou.length > 0) {
    direcional = 'Período misto — manter o que funciona e revisar o que piorou na próxima consulta.';
  }

  // R3.5 — Alta consistência + melhora (fallback positivo, não duplica R3.1)
  if (!direcional && ['excelente', 'boa'].includes(consistencia?.classificacao) && melhorou.length > 0) {
    direcional = 'Consistência alta aliada à melhora — base sólida para decisão clínica na próxima consulta.';
  }

  // R3.6 — Dados insuficientes
  if (!direcional && diasJ2 < 7) {
    direcional = 'Poucos registros na janela atual — interpretar com cautela e priorizar adesão antes da próxima análise.';
  }

  // ── Frame 4 — O que continua verdadeiro ──────────────────────────────────

  let continua = null;

  // R4.1 — Gatilho forte do Perfil Biológico ainda presente (não melhorou)
  if (mapaGatilhos?.fatores?.length > 0) {
    const match = mapaGatilhos.fatores.find(f => f.forca === 'forte' && idsNaoMelhorou.has(f.id));
    if (match) {
      continua = `Padrão do Perfil Biológico mantido: ${match.label} continua associado a dias difíceis neste período.`;
    }
  }

  // R4.2 — Eixo prioritário não apresentou melhora
  if (!continua && priorizacao?.principal?.top3?.length > 0) {
    const top3ids = priorizacao.principal.top3.map(c => c.id);
    if (top3ids.some(id => !idsMelhorou.has(id))) {
      continua = `O eixo ${priorizacao.principal.eixoNome} permanece como área de atenção — os campos associados ainda não apresentaram melhora neste período.`;
    }
  }

  // R4.3 — Influência lútea histórica ativa (sem duplicar Frame 1 quando R1.3 disparou)
  if (!continua && mapaGatilhos?.influenciaCiclo && faseAtual === 'lutea') {
    const jaExplicadoNoFrame1 = hipotese?.texto?.includes('lútea');
    if (!jaExplicadoNoFrame1) {
      continua = 'A influência da fase lútea nos sintomas — confirmada no histórico desta paciente — está ativa neste período.';
    }
  }

  // R4.4 — Aprendizado essencial compatível com sinais recentes
  if (!continua) {
    const essenciais = memoriaClinica.filter(m => m.aprendizado_essencial);
    if (essenciais.length > 0) {
      // Prioridade 1: categoria do aprendizado mapeia para campo em piorou[] ou estagnou[]
      const compat = essenciais.filter(m => {
        const campos = MAPA_CATEGORIA_CAMPO[m.categoria] ?? [];
        return campos.some(c => idsNaoMelhorou.has(c));
      });

      // Prioridade 2: sem match de categoria → recência ≤ 180 dias como critério mínimo
      const c180 = corteISO(180);
      const candidatos = compat.length > 0
        ? compat
        : essenciais.filter(m => m.encerrada_em && m.encerrada_em >= c180);

      if (candidatos.length > 0) {
        const escolhido = candidatos
          .slice()
          .sort((a, b) => (b.encerrada_em ?? '').localeCompare(a.encerrada_em ?? ''))[0];
        continua = `Aprendizado em evidência: ${escolhido.titulo}.`;
      }
    }
  }

  return { hipotese, investigar, direcional, continua };
}
