// ── Registros e Carga Sintomática — Sprint 18 ────────────────────────────────
// Observa se semanas com mais registros de hábitos coincidem com menor carga
// sintomática. Analisa PRESENÇA DE REGISTROS, não adesão aos hábitos.
// Sem IA. Sem causalidade. Sem julgamento.

// Outcome composite (mesmos 7 campos do Sprint 12 — autossuficiente)
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

const PRESENCA_ALTA  = 0.70; // >= 5/7 dias com registro de hábitos
const PRESENCA_BAIXA = 0.30; // <= 2/7 dias
const MIN_SEMANAS    = 4;    // mínimo de semanas em cada grupo
const MIN_DIAS_CARGA = 3;    // mínimo de dias válidos para carga da semana
const DELTA_MINIMO   = -15;  // redução mínima em pp para exibir insight

export function calcularRegistrosCarga({ sintomas, habitosLogs }) {
  if (!sintomas || !habitosLogs || habitosLogs.length === 0) {
    return { disponivel: false, motivo: 'sem_habitos' };
  }

  const hoje   = new Date().toISOString().slice(0, 10);
  const corte  = new Date();
  corte.setDate(corte.getDate() - 180);
  const inicio = corte.toISOString().slice(0, 10);

  // Percorrer semanas dentro da janela de 180 dias
  const semanas = [];
  let   current = new Date(inicio + 'T12:00:00');
  const endDate = new Date(hoje   + 'T12:00:00');

  while (current <= endDate) {
    const semInicioStr = current.toISOString().slice(0, 10);
    const semFimDate   = new Date(current.getTime() + 6 * 86400000);
    const semFimStr    = semFimDate > endDate ? hoje : semFimDate.toISOString().slice(0, 10);

    // Presença de registros de hábitos esta semana
    const diasHabito = new Set(
      habitosLogs
        .filter(l => l.data >= semInicioStr && l.data <= semFimStr)
        .map(l => l.data)
    ).size;
    const presenca = diasHabito / 7;

    // Carga sintomática esta semana
    const sintomasSem = sintomas.filter(s => s.data >= semInicioStr && s.data <= semFimStr);
    let diasValidos = 0, diasPiora = 0;
    for (const s of sintomasSem) {
      const v = ehPioraDia(s);
      if (v !== null) { diasValidos++; if (v) diasPiora++; }
    }
    const carga = diasValidos >= MIN_DIAS_CARGA
      ? Math.round((diasPiora / diasValidos) * 100)
      : null;

    semanas.push({ presenca, carga });
    current = new Date(current.getTime() + 7 * 86400000);
  }

  // Segmentar: alta vs baixa presença de registros de hábitos
  const semanasAlta  = semanas.filter(s => s.presenca >= PRESENCA_ALTA  && s.carga !== null);
  const semanasBaixa = semanas.filter(s => s.presenca <= PRESENCA_BAIXA && s.carga !== null);

  if (semanasAlta.length < MIN_SEMANAS || semanasBaixa.length < MIN_SEMANAS) {
    return { disponivel: false, motivo: 'poucos_dados' };
  }

  const cargaAlta  = Math.round(semanasAlta.reduce( (s, w) => s + w.carga, 0) / semanasAlta.length);
  const cargaBaixa = Math.round(semanasBaixa.reduce((s, w) => s + w.carga, 0) / semanasBaixa.length);
  const delta      = cargaAlta - cargaBaixa; // negativo = favorável

  // Exibir apenas quando alta presença coincide com menor carga (direção favorável)
  if (delta > DELTA_MINIMO) {
    return { disponivel: false, motivo: 'sem_contraste' };
  }

  return {
    disponivel:        true,
    cargaAltaPresenca: cargaAlta,
    delta,
    nSemanasAlta:      semanasAlta.length,
    nSemanasBaixa:     semanasBaixa.length,
  };
}

// ── Registros de Suplementação × Carga Sintomática ───────────────────────────
// Compara dias com registro de suplementação (tomado=true) vs dias sem registro.
// Mede registros — não equivale a suplementação real tomada.
// Sem causalidade. Sem direção otimizada. Observação bidirecional neutra.

const MIN_DIAS_SUPL = 20;

export function calcularCorrelacaoSupl({ sintomas, suplementosLogs }) {
  if (!sintomas?.length || !suplementosLogs?.length) {
    return { disponivel: false, motivo: 'sem_dados' };
  }

  const datasComSupl = new Set(
    suplementosLogs.filter(l => l.tomado === true).map(l => l.data)
  );
  if (datasComSupl.size === 0) {
    return { disponivel: false, motivo: 'sem_dados' };
  }

  const diasCom = [], diasSem = [];
  for (const s of sintomas) {
    const piora = ehPioraDia(s);
    if (piora === null) continue;
    if (datasComSupl.has(s.data)) diasCom.push(piora);
    else                          diasSem.push(piora);
  }

  if (diasCom.length < MIN_DIAS_SUPL || diasSem.length < MIN_DIAS_SUPL) {
    return { disponivel: false, motivo: 'poucos_dados' };
  }

  const cargaCom = Math.round(diasCom.filter(Boolean).length / diasCom.length * 100);
  const cargaSem = Math.round(diasSem.filter(Boolean).length / diasSem.length * 100);

  return {
    disponivel: true,
    cargaCom,
    cargaSem,
    delta:      cargaCom - cargaSem,
    nCom:       diasCom.length,
    nSem:       diasSem.length,
  };
}
