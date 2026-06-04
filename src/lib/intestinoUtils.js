// ─────────────────────────────────────────────────────────────────────────────
// BIBLIOTECA INTESTINAL ÚTERA
// Score refinado, classificações e sinais de atenção clínica
// ─────────────────────────────────────────────────────────────────────────────

// Escala de Bristol — linguagem amigável para paciente
export const BRISTOL_LABELS = {
  1: { label: 'Bolinhas duras',    desc: 'Fezes separadas, muito difíceis de passar' },
  2: { label: 'Grumoso, difícil', desc: 'Como salsicha, mas grumoso e irregular' },
  3: { label: 'Trincado',          desc: 'Com rachaduras na superfície' },
  4: { label: 'Liso e fácil',      desc: 'Forma perfeita, passa sem esforço',        ideal: true },
  5: { label: 'Pedaços macios',    desc: 'Pedaços com bordas definidas, fáceis',     aceitavel: true },
  6: { label: 'Pastoso',           desc: 'Pedaços irregulares, amolecidos' },
  7: { label: 'Líquido',           desc: 'Sem partes sólidas, totalmente líquido' },
};

// Score por registro diário (0–100)
function scoreDiario(log) {
  if (!log.evacuou) return 20;

  let pts = 0;

  const b = log.bristol;
  if (b === 1)        pts += 25;
  else if (b === 2)   pts += 15;
  else if (b === 3)   pts += 5;
  else if (b === 6)   pts += 10;
  else if (b === 7)   pts += 20;
  // bristol 4 e 5 = 0 pts (ideal/aceitável)

  if (log.esvaziamento_incompleto)          pts += 20;
  if ((log.estufamento ?? 0) >= 2)          pts += 15;
  else if ((log.estufamento ?? 0) === 1)    pts += 5;
  if ((log.dor_abdominal ?? 0) >= 2)        pts += 15;
  else if ((log.dor_abdominal ?? 0) === 1)  pts += 5;
  if (log.urgencia)                         pts += 10;
  if (log.esforco)                          pts += 10;
  if ((log.gases ?? 0) >= 2)               pts += 10;
  else if ((log.gases ?? 0) === 1)          pts += 3;

  return Math.min(100, pts);
}

// Score médio dos registros diários (0–100), null se sem dados
export function calcularScoreIntestinal(logs) {
  const diarios = (logs ?? []).filter(l => l.tipo === 'diario');
  if (!diarios.length) return null;
  const total = diarios.reduce((acc, l) => acc + scoreDiario(l), 0);
  return Math.round(total / diarios.length);
}

// Sinais de atenção clínica para a nutri
export function detectarSinaisAtencao(logs) {
  if (!logs || !logs.length) return [];
  const sinais = [];

  const comMuco = logs.filter(l => l.muco).length;
  if (comMuco > 0) {
    sinais.push({ id: 'muco', label: 'Muco', count: comMuco, nivel: 'atencao' });
  }

  const comEsvaziamento = logs.filter(l => l.esvaziamento_incompleto).length;
  if (comEsvaziamento >= 3) {
    sinais.push({ id: 'esvaziamento_incompleto', label: 'Esvaziamento incompleto', count: comEsvaziamento, nivel: 'atencao' });
  } else if (comEsvaziamento > 0) {
    sinais.push({ id: 'esvaziamento_incompleto', label: 'Esvaziamento incompleto', count: comEsvaziamento, nivel: 'observar' });
  }

  const comDor = logs.filter(l => (l.dor_abdominal ?? 0) >= 2).length;
  if (comDor >= 5) {
    sinais.push({ id: 'dor_recorrente', label: 'Dor abdominal recorrente', count: comDor, nivel: 'atencao' });
  } else if (comDor >= 2) {
    sinais.push({ id: 'dor_recorrente', label: 'Dor abdominal', count: comDor, nivel: 'observar' });
  }

  // Dados de rastreio
  const comCorAlterada = logs.filter(l =>
    l.cor_fezes && !['Marrom normal', 'Não observei'].includes(l.cor_fezes)
  ).length;
  if (comCorAlterada > 0) {
    sinais.push({ id: 'cor_alterada', label: 'Cor das fezes alterada', count: comCorAlterada, nivel: 'observar' });
  }

  const comOdorForte = logs.filter(l =>
    l.cheiro_fezes && ['Forte', 'Muito forte'].includes(l.cheiro_fezes)
  ).length;
  if (comOdorForte >= 3) {
    sinais.push({ id: 'odor_forte', label: 'Odor intenso frequente', count: comOdorForte, nivel: 'observar' });
  }

  return sinais;
}

// Distribuição Bristol (contagem por tipo 1–7)
export function distribuicaoBristol(logs) {
  const dist = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0 };
  for (const l of (logs ?? [])) {
    if (l.tipo === 'diario' && l.bristol >= 1 && l.bristol <= 7) {
      dist[l.bristol]++;
    }
  }
  return dist;
}

// Bristol mais frequente (número 1–7), null se sem dados
export function bristolMaisFrequente(logs) {
  const dist = distribuicaoBristol(logs);
  const entries = Object.entries(dist).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  const [tipo] = entries.sort(([, a], [, b]) => b - a)[0];
  return parseInt(tipo, 10);
}

// Média de evacuações por semana nos últimos 30 dias
export function mediaEvacuacoesPorSemana(logs) {
  const diarios = (logs ?? []).filter(l => l.tipo === 'diario');
  if (!diarios.length) return null;
  const evacuou = diarios.filter(l => l.evacuou).length;
  return Math.round((evacuou / diarios.length) * 7 * 10) / 10;
}

// Tendências clínicas: cruzamento intestino_logs x ciclo_sintomas_diarios
// Retorna array de { descricao, percentual } para exibição pela nutri
export function calcularTendenciasClinicas(intestinoLogs, sintomasDiarios) {
  const tendencias = [];
  if (!intestinoLogs?.length || !sintomasDiarios?.length) return tendencias;

  // Index de sintomas por data
  const sintomasPorData = {};
  for (const s of sintomasDiarios) {
    sintomasPorData[s.data] = s;
  }

  // Dias com intestino alterado (bristol fora de 4–5, esvaziamento, ou dor >= 2)
  const diasAlterados = intestinoLogs.filter(l =>
    l.tipo === 'diario' && (
      (l.bristol && l.bristol !== 4 && l.bristol !== 5) ||
      l.esvaziamento_incompleto ||
      (l.dor_abdominal ?? 0) >= 2
    )
  );

  if (!diasAlterados.length) return tendencias;

  // Coincidência com energia baixa
  const comEnergiaData = diasAlterados.filter(l => {
    const s = sintomasPorData[l.data];
    return s && s.energia !== null && s.energia !== undefined && s.energia <= 2;
  });
  const pctEnergia = Math.round((comEnergiaData.length / diasAlterados.length) * 100);
  if (pctEnergia >= 40) {
    tendencias.push({ id: 'energia', descricao: `Intestino alterado coincidiu com energia baixa em ${pctEnergia}% dos registros` });
  }

  // Coincidência com acne
  const comAcneData = diasAlterados.filter(l => {
    const s = sintomasPorData[l.data];
    return s && (s.acne ?? 0) >= 1;
  });
  const pctAcne = Math.round((comAcneData.length / diasAlterados.length) * 100);
  if (pctAcne >= 40) {
    tendencias.push({ id: 'acne', descricao: `Intestino alterado coincidiu com acne em ${pctAcne}% dos registros` });
  }

  // Piora intestinal pré-menstrual (via ciclo_sintomas_diarios.humor ou compulsao na fase lútea)
  const comSintomasEstrogenicos = diasAlterados.filter(l => {
    const s = sintomasPorData[l.data];
    return s && ((s.inchaco ?? 0) >= 2 || (s.compulsao ?? 0) >= 2);
  });
  const pctEstrogeno = Math.round((comSintomasEstrogenicos.length / diasAlterados.length) * 100);
  if (pctEstrogeno >= 35) {
    tendencias.push({ id: 'estrogenico', descricao: `Piora intestinal associada a inchaço ou compulsão em ${pctEstrogeno}% dos registros` });
  }

  return tendencias;
}

// Opções estruturadas para campos do rastreio aprofundado
export const COR_FEZES_OPCOES = [
  'Marrom normal',
  'Marrom clara',
  'Amarelada',
  'Esverdeada',
  'Muito escura',
  'Preta',
  'Avermelhada',
  'Não observei',
];

export const CHEIRO_FEZES_OPCOES = [
  'Normal',
  'Forte',
  'Muito forte',
  'Azedo',
  'Não observei',
];

export const GATILHOS_OPCOES = [
  'Laticínios',
  'Farinhas / massas',
  'Açúcar',
  'Álcool',
  'Estresse',
  'Menstruação',
  'Outro',
  'Não percebi',
];

export const SENSACAO_APOS_OPCOES = [
  'Aliviada, esvaziamento completo',
  'Alívio parcial, ainda com sensação de peso',
  'Sem alívio, sensação de bloqueio',
  'Urgência logo depois',
];

export const MOMENTO_ESTUFAMENTO_OPCOES = [
  'Durante as refeições',
  'Após as refeições (até 1h)',
  'Algumas horas após comer',
  'Não relacionado às refeições',
  'Ao longo do dia, crescendo à tarde',
];

export const LOCALIZACAO_DOR_OPCOES = [
  'Baixo ventre (abaixo do umbigo)',
  'Lateral esquerda',
  'Lateral direita',
  'Em volta do umbigo',
  'Difusa, sem localização específica',
  'Não sinto dor',
];

export const RELACAO_CICLO_OPCOES = [
  'Piora pré-menstrual (TPM)',
  'Piora durante a menstruação',
  'Piora na ovulação',
  'Sem relação percebida com o ciclo',
  'Não tenho ciclo regular',
];
