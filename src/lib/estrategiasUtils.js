import { calcularFaseDoCiclo } from './cicloUtils.js';

const THRESHOLD_COBERTURA = 0.40;
const DELTA_EXPRESSIVO    = 0.30;  // escala 0–5
const DELTA_INTESTINO     = 8;     // escala 0–100
const FASE_AVISO          = 0.60;  // % de dias em fase dominante para disparar aviso

// ── Helpers ──────────────────────────────────────────────────────────────────

function media(valores) {
  const v = valores.filter(x => x != null && !isNaN(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}

function r2(n) { return n != null ? Math.round(n * 100) / 100 : null; }

export function duracaoDias(inicio, fim) {
  if (!inicio || !fim) return 0;
  const a = new Date(inicio + 'T12:00:00');
  const b = new Date(fim    + 'T12:00:00');
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

export function subtrairDias(iso, n) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function calcularJanelaBaseline(dataInicio, dias) {
  return {
    inicio: subtrairDias(dataInicio, dias),
    fim:    subtrairDias(dataInicio, 1),
  };
}

function diasEntreDatas(inicio, fim) {
  const dias = [];
  const d = new Date(inicio + 'T12:00:00');
  const f = new Date(fim    + 'T12:00:00');
  while (d <= f) {
    dias.push(d.toISOString().slice(0, 10));
    d.setDate(d.getDate() + 1);
  }
  return dias;
}

function direcaoSinal(delta) {
  if (delta == null)            return 'sem_baseline';
  if (Math.abs(delta) < DELTA_EXPRESSIVO) return 'estavel';
  return delta > 0 ? 'aumento' : 'reducao';
}

function direcaoIntestino(delta) {
  if (delta == null)           return 'sem_baseline';
  if (Math.abs(delta) < DELTA_INTESTINO) return 'estavel';
  return delta > 0 ? 'aumento' : 'reducao';
}

function scoreIntestinoDia(log) {
  let s = 50;
  if (log.evacuou === true)               s += 10;
  if (log.evacuou === false)              s -= 15;
  const b = { 1: -20, 2: -10, 3: 5, 4: 20, 5: 5, 6: -10, 7: -20 };
  if (log.bristol != null)                s += b[log.bristol] ?? 0;
  if (log.esvaziamento_incompleto)        s -= 10;
  if ((log.estufamento   ?? 0) >= 2)      s -= 10;
  if ((log.dor_abdominal ?? 0) >= 2)      s -= 10;
  if (log.urgencia)                       s -= 5;
  if (log.esforco)                        s -= 5;
  return Math.max(0, Math.min(100, s));
}

const SINAIS = [
  { campo: 'humor',     label: 'Humor'                   },
  { campo: 'energia',   label: 'Energia'                  },
  { campo: 'sono',      label: 'Sono'                     },
  { campo: 'compulsao', label: 'Episódios de compulsão'   },
  { campo: 'ansiedade', label: 'Ansiedade'                },
];

// ── Função principal ──────────────────────────────────────────────────────────

export function calcularCruzamentos({
  estrategia,
  sintomasDurante,
  sintomasAntes,
  intestinoDurante,
  intestinoAntes,
  estrategiaLogs,
  periodos,
  situacaoCiclo,
  estrategiasSimultaneas = [],
}) {
  const dataFim = estrategia.data_fim
    ?? estrategia.encerrada_em?.slice(0, 10)
    ?? new Date().toISOString().slice(0, 10);

  const diasTotais  = duracaoDias(estrategia.data_inicio, dataFim);
  const diasComDado = sintomasDurante.length;
  const cobertura   = diasTotais > 0 ? diasComDado / diasTotais : 0;

  if (cobertura < THRESHOLD_COBERTURA) {
    return {
      suficiente:  false,
      diasComDado,
      diasTotais,
      percentual: Math.round(cobertura * 100),
    };
  }

  // ── Sinais ────────────────────────────────────────────────────────────────
  const sinais = SINAIS
    .map(({ campo, label }) => {
      const mediaDurante = media(sintomasDurante.map(s => s[campo]));
      const mediaAntes   = media(sintomasAntes.map(s => s[campo]));
      const delta = (mediaDurante != null && mediaAntes != null)
        ? mediaDurante - mediaAntes : null;
      return {
        campo, label,
        mediaDurante: r2(mediaDurante),
        mediaAntes:   r2(mediaAntes),
        delta:        r2(delta),
        direcao:      direcaoSinal(delta),
      };
    })
    .filter(s => s.mediaDurante != null);

  // ── Intestino (score para nutri; direção para paciente via chamador) ───────
  const scoresDur     = intestinoDurante.map(scoreIntestinoDia);
  const scoresAnt     = intestinoAntes.map(scoreIntestinoDia);
  const scoreMedDur   = r2(media(scoresDur));
  const scoreMedAnt   = r2(media(scoresAnt));
  const deltaInt      = (scoreMedDur != null && scoreMedAnt != null)
    ? r2(scoreMedDur - scoreMedAnt) : null;

  const bristolCounts = {};
  for (const l of intestinoDurante) {
    if (l.bristol != null) bristolCounts[l.bristol] = (bristolCounts[l.bristol] ?? 0) + 1;
  }
  const bristolMaisFrequente = Object.keys(bristolCounts).length
    ? Number(Object.entries(bristolCounts).sort((a, b) => b[1] - a[1])[0][0])
    : null;

  const intestino = {
    diasComRegistro:   intestinoDurante.length,
    scoreMedDurante:   scoreMedDur,
    scoreMedAntes:     scoreMedAnt,
    delta:             deltaInt,
    direcao:           direcaoIntestino(deltaInt),
    bristolMaisFrequente,
  };

  // ── Adesão ────────────────────────────────────────────────────────────────
  const aderencia = {
    total:        estrategiaLogs.length,
    sim:          estrategiaLogs.filter(l => l.aconteceu === 'sim').length,
    parcialmente: estrategiaLogs.filter(l => l.aconteceu === 'parcialmente').length,
    nao:          estrategiaLogs.filter(l => l.aconteceu === 'nao').length,
  };

  // ── Fases do ciclo ────────────────────────────────────────────────────────
  let fasesAviso = null;
  const cicloAtivo = situacaoCiclo !== 'ciclo_suprimido' && situacaoCiclo !== 'nao_menstrua';
  if (cicloAtivo && periodos?.length) {
    const todosDias = diasEntreDatas(estrategia.data_inicio, dataFim);
    const contagem  = {};
    for (const dia of todosDias) {
      const { fase } = calcularFaseDoCiclo(periodos, dia, situacaoCiclo);
      contagem[fase] = (contagem[fase] ?? 0) + 1;
    }
    const [faseDom, qtdDom] = Object.entries(contagem)
      .sort((a, b) => b[1] - a[1])[0] ?? [];
    if (faseDom && qtdDom / todosDias.length > FASE_AVISO && (faseDom === 'lutea' || faseDom === 'menstrual')) {
      const nomeFase = faseDom === 'lutea' ? 'lútea' : 'menstrual';
      fasesAviso = {
        fase: faseDom,
        dias: qtdDom,
        totalDias: todosDias.length,
        // Versão clínica para nutri
        textoNutri: `O período coincidiu majoritariamente com a fase ${nomeFase} (${qtdDom} de ${todosDias.length} dias). A variabilidade hormonal natural desta fase pode contribuir para as mudanças observadas nos sinais clínicos.`,
      };
    }
  }

  return {
    suficiente: true,
    cobertura: {
      diasComDado,
      diasTotais,
      percentual: Math.round(cobertura * 100),
    },
    sinais,
    intestino,
    aderencia,
    fasesAviso,
    avisoSimultaneas:   estrategiasSimultaneas.length > 0,
    titulosSimultaneas: estrategiasSimultaneas.map(e => e.titulo),
    disclaimer: `Observações baseadas em ${diasComDado} de ${diasTotais} dias com registro. Variações podem refletir múltiplos fatores além desta estratégia.`,
  };
}
