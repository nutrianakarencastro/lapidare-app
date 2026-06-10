// Motor puro da Sala de Situação Clínica — Sprint 27.
// Recebe dados já carregados por _ResumoClinico.jsx e retorna
// sinais priorizados. Sem queries, sem side-effects.

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

export function gerarSinais({ checkin, consistencia, condutaAtual, metas, memoriaClinica, jornada }) {
  const alta     = [];
  const observar = [];
  const contexto = [];

  // ── 🔴 Alta atenção ──────────────────────────────────────────────────────

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

  // ── 🟡 Observar ──────────────────────────────────────────────────────────

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

  return [
    ...alta.slice(0, 2),
    ...observar.slice(0, 3),
    ...contexto.slice(0, 2),
  ];
}
