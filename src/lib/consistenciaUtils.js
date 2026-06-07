// ─────────────────────────────────────────────────────────────────────────────
// Leitura de Consistência Clínica — Útera
// Calcula uma leitura qualitativa de consistência baseada nos registros
// disponíveis no app nos últimos 30 dias. Score interno apenas.
// ─────────────────────────────────────────────────────────────────────────────

const JANELA       = 30;
const JANELA_CURTA = 7;
const MIN_DIAS     = 7;

function diasUnicos(datas) {
  return new Set((datas ?? []).map(d => String(d).slice(0, 10))).size;
}

function filtrarRecentes(datas, diasAtras) {
  const corte = new Date();
  corte.setDate(corte.getDate() - diasAtras);
  const corteStr = corte.toISOString().slice(0, 10);
  return (datas ?? []).filter(d => String(d).slice(0, 10) >= corteStr);
}

function calcularScore({ datasRegistros, temHabitos, datasHabitos, checkinsTotal, checkinsRespondidos, temSupl, datasSupl, janela }) {
  const scoreReg = Math.min(100, Math.round(diasUnicos(datasRegistros) / janela * 100));
  const dimensoes = [{ score: scoreReg, peso: 40 }];

  if (temHabitos) {
    const s = Math.min(100, Math.round(diasUnicos(datasHabitos) / janela * 100));
    dimensoes.push({ score: s, peso: 25 });
  }
  if (checkinsTotal > 0) {
    const s = Math.round((checkinsRespondidos / checkinsTotal) * 100);
    dimensoes.push({ score: s, peso: 20 });
  }
  if (temSupl) {
    const s = Math.min(100, Math.round(diasUnicos(datasSupl) / janela * 100));
    dimensoes.push({ score: s, peso: 15 });
  }

  const totalPeso = dimensoes.reduce((acc, d) => acc + d.peso, 0);
  return Math.round(dimensoes.reduce((acc, d) => acc + d.score * d.peso / totalPeso, 0));
}

function classificar(score) {
  if (score >= 80) return { classificacao: 'excelente',     label: 'Consistência excelente'     };
  if (score >= 65) return { classificacao: 'boa',           label: 'Consistência boa'           };
  if (score >= 50) return { classificacao: 'em_construcao', label: 'Consistência em construção' };
  if (score >= 30) return { classificacao: 'oscilante',     label: 'Consistência oscilante'     };
  return               { classificacao: 'retomada',      label: 'Precisa de retomada'        };
}

function gerarExplicacao({ scoreReg, temHabitos, scoreHab, checkinsTotal, checkinsRespondidos, temSupl, scoreSup }) {
  const partes = [];

  if (scoreReg >= 70)      partes.push('Registros clínicos frequentes');
  else if (scoreReg >= 40) partes.push('Registros clínicos com alguma regularidade');
  else                     partes.push('Registros clínicos irregulares');

  if (temHabitos && scoreHab != null) {
    if (scoreHab >= 70)      partes.push('hábitos bem cumpridos');
    else if (scoreHab >= 40) partes.push('hábitos com regularidade');
    else                     partes.push('hábitos irregulares');
  }

  if (checkinsTotal > 0) {
    const pct = Math.round(checkinsRespondidos / checkinsTotal * 100);
    if (pct >= 100)     partes.push('check-ins respondidos');
    else if (pct >= 50) partes.push('check-ins com regularidade');
    else                partes.push('check-ins com pendências');
  }

  if (temSupl && scoreSup != null) {
    if (scoreSup >= 70)      partes.push('suplementação em dia');
    else if (scoreSup >= 40) partes.push('suplementação com regularidade');
    else                     partes.push('suplementação oscilante');
  }

  return partes.join(' · ') + (partes.length ? '.' : '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Função principal exportada
// ─────────────────────────────────────────────────────────────────────────────

export function calcularLeituraConsistencia({
  datasRegistros,           // string[] ISO dates — ciclo + intestino (últimos 30d)
  temHabitos,               // boolean — há hábitos configurados para a paciente
  datasHabitos = [],        // string[] ISO dates — habitos_logs (últimos 30d)
  checkinsTotal,            // number — check-ins enviados na janela
  checkinsRespondidos,      // number — check-ins respondidos na janela
  temSupl,                  // boolean — há suplementos ativos
  datasSupl = [],           // string[] ISO dates — suplementos_logs (últimos 30d, tomado=true)
}) {
  if (diasUnicos(datasRegistros) < MIN_DIAS) {
    return { aguardando: true };
  }

  const score30 = calcularScore({
    datasRegistros, temHabitos, datasHabitos,
    checkinsTotal, checkinsRespondidos,
    temSupl, datasSupl,
    janela: JANELA,
  });

  // Score de curto prazo (7d) — ignora check-ins por janela muito curta
  const score7 = calcularScore({
    datasRegistros: filtrarRecentes(datasRegistros, JANELA_CURTA),
    temHabitos,
    datasHabitos:   filtrarRecentes(datasHabitos, JANELA_CURTA),
    checkinsTotal: 0, checkinsRespondidos: 0,
    temSupl,
    datasSupl: filtrarRecentes(datasSupl, JANELA_CURTA),
    janela: JANELA_CURTA,
  });

  const scoreReg = Math.min(100, Math.round(diasUnicos(datasRegistros) / JANELA * 100));
  const scoreHab = temHabitos ? Math.min(100, Math.round(diasUnicos(datasHabitos) / JANELA * 100)) : null;
  const scoreSup = temSupl    ? Math.min(100, Math.round(diasUnicos(datasSupl)    / JANELA * 100)) : null;

  return {
    aguardando: false,
    score: score30,
    ...classificar(score30),
    explicacao: gerarExplicacao({ scoreReg, temHabitos, scoreHab, checkinsTotal, checkinsRespondidos, temSupl, scoreSup }),
    queda7d: score7 < score30 - 20,
  };
}
