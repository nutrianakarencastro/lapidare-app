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
