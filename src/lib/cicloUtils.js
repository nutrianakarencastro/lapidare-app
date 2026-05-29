import { EIXOS as EIXOS_CLINICOS } from './clinical/eixos.js';
import { ALERTAS_PROBLEMA } from './clinical/alertas.js';

// ─────────────────────────────────────────────────────────────────────────────
// FASES DO CICLO
// ─────────────────────────────────────────────────────────────────────────────

export const FASES = {
  menstrual:    { label: 'Menstrual',             cor: '#c4616e', corSoft: '#fdedef', icone: '🩸' },
  folicular:    { label: 'Folicular',             cor: '#c4a882', corSoft: '#faf3e8', icone: '🌱' },
  ovulacao:     { label: 'Ovulação',              cor: '#7ea85a', corSoft: '#eef5e3', icone: '✨' },
  lutea:        { label: 'Lútea',                 cor: '#9b8b7a', corSoft: '#f2ede6', icone: '🌙' },
  atrasada:     { label: 'Atrasada',              cor: '#854f0b', corSoft: '#faeeda', icone: '⏳' },
  desconhecida: { label: 'Sem dados suficientes', cor: '#b4a896', corSoft: '#f5f2ec', icone: '—'  },
};

// ─────────────────────────────────────────────────────────────────────────────
// CÁLCULO DE FASE
// ─────────────────────────────────────────────────────────────────────────────

export function duracaoMediaCiclo(periodos) {
  const sorted = [...periodos]
    .filter(p => p.inicio)
    .sort((a, b) => new Date(a.inicio) - new Date(b.inicio));
  if (sorted.length < 2) return 28;
  const diffs = [];
  for (let i = 1; i < sorted.length; i++) {
    const d = Math.round(
      (new Date(sorted[i].inicio + 'T12:00:00') - new Date(sorted[i - 1].inicio + 'T12:00:00')) / 86400000
    );
    if (d >= 15 && d <= 60) diffs.push(d);
  }
  if (!diffs.length) return 28;
  return Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

export function calcularFaseDoCiclo(periodos, dataAlvo = new Date()) {
  if (!periodos?.length) {
    return { fase: 'desconhecida', diaDociclo: null, duracaoMedia: 28, ovulacaoPrevista: null, proximoPeriodo: null };
  }
  const alvo = dataAlvo instanceof Date ? dataAlvo : new Date(dataAlvo + 'T12:00:00');
  const anterior = periodos
    .filter(p => new Date(p.inicio + 'T12:00:00') <= alvo)
    .sort((a, b) => new Date(b.inicio) - new Date(a.inicio))[0];
  if (!anterior) {
    return { fase: 'desconhecida', diaDociclo: null, duracaoMedia: 28, ovulacaoPrevista: null, proximoPeriodo: null };
  }
  const media = duracaoMediaCiclo(periodos);
  const inicio = new Date(anterior.inicio + 'T12:00:00');
  const diaDociclo = Math.round((alvo - inicio) / 86400000) + 1;
  const fimSangramento = anterior.fim
    ? new Date(anterior.fim + 'T12:00:00')
    : new Date(inicio.getTime() + 4 * 86400000);

  let fase;
  if (alvo <= fimSangramento)                         fase = 'menstrual';
  else if (diaDociclo <= Math.round(media * 0.46))    fase = 'folicular';
  else if (diaDociclo <= Math.round(media * 0.54) + 1) fase = 'ovulacao';
  else if (diaDociclo <= media)                       fase = 'lutea';
  else                                                 fase = 'atrasada';

  const ovulacaoPrevista = new Date(inicio.getTime() + (media - 14) * 86400000);
  const proximoPeriodo   = new Date(inicio.getTime() + media * 86400000);
  return { fase, diaDociclo, duracaoMedia: media, ovulacaoPrevista, proximoPeriodo };
}

export function isDiaPeriodo(periodos, dataIso) {
  const alvo = new Date(dataIso + 'T12:00:00');
  return periodos.some(p => {
    const ini = new Date(p.inicio + 'T12:00:00');
    const fim = p.fim ? new Date(p.fim + 'T12:00:00') : new Date(ini.getTime() + 4 * 86400000);
    return alvo >= ini && alvo <= fim;
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// EIXOS — metadados de UI + dados clínicos da Biblioteca Clínica Útera
// ─────────────────────────────────────────────────────────────────────────────

// Ícones e labels são UI-specific (não existem na biblioteca clínica)
const EIXO_UI = {
  glicemico:    { label: 'Glicêmico',               icon: 'chart-bar'      },
  adrenal:      { label: 'Adrenal / Cortisol',       icon: 'bolt'           },
  estrogenico:  { label: 'Dominância estrogênica',   icon: 'wave-sine'      },
  progesterona: { label: 'Progesterona baixa',        icon: 'moon'           },
  androgenico:  { label: 'Hiperandrogenismo',         icon: 'flame'          },
  intestinal:   { label: 'Intestinal / Estroboloma',  icon: 'leaf'           },
  inflamatorio: { label: 'Inflamatório',              icon: 'alert-triangle' },
};

// EIXOS exportado combina metadados de UI com dados clínicos da biblioteca
export const EIXOS = Object.fromEntries(
  Object.entries(EIXO_UI).map(([k, ui]) => {
    const clinico = EIXOS_CLINICOS[k] ?? {};
    return [k, {
      ...ui,
      subtitulo:      clinico.subtitulo      ?? null,
      cor:            clinico.cor            ?? '#888',
      corSoft:        clinico.corSoft        ?? '#f5f5f5',
      criterioAlerta: clinico.criterioAlerta ?? 4,
    }];
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// SCORES HORMONAIS (0–100)
// ─────────────────────────────────────────────────────────────────────────────

export function calcularScoresHormonais(s, fase = 'desconhecida') {
  if (!s) return null;
  const b  = v => (v ? 1 : 0);
  const e5 = v => (v ? Math.max(0, 6 - v) : 0); // 5→1, 1→5
  const naLutea = fase === 'lutea' || fase === 'menstrual';
  const clamp = v => Math.min(100, Math.max(0, v));

  const glicemico = clamp(
    ((s.compulsao ?? 0) >= 2 ? 30 : (s.compulsao ?? 0) >= 1 ? 15 : 0) +
    ((s.irritabilidade ?? 0) >= 2 ? 20 : 0) +
    (e5(s.energia) >= 4 ? 25 : e5(s.energia) >= 3 ? 12 : 0) +
    (naLutea && e5(s.humor) >= 4 ? 15 : 0) +
    (e5(s.foco) >= 4 ? 10 : 0)
  );

  const adrenal = clamp(
    ((s.ansiedade ?? 0) >= 2 ? 30 : (s.ansiedade ?? 0) >= 1 ? 15 : 0) +
    (e5(s.sono) >= 4 ? 25 : e5(s.sono) >= 3 ? 12 : 0) +
    (e5(s.energia) >= 4 ? 20 : e5(s.energia) >= 3 ? 10 : 0) +
    b(s.calorons) * 15 + b(s.suor_noturno) * 15
  );

  const estrogenico = clamp(
    ((s.retencao ?? 0) >= 2 ? 25 : (s.retencao ?? 0) >= 1 ? 12 : 0) +
    ((s.dor_mamas ?? 0) >= 2 ? 25 : (s.dor_mamas ?? 0) >= 1 ? 12 : 0) +
    ((s.inchaco ?? 0) >= 2 ? 20 : (s.inchaco ?? 0) >= 1 ? 10 : 0) +
    (naLutea && e5(s.humor) >= 4 ? 15 : 0) +
    b(s.choro) * 15
  );

  const progesterona = clamp(
    (naLutea && (s.irritabilidade ?? 0) >= 2 ? 30 : 0) +
    ((s.ansiedade ?? 0) >= 2 ? 20 : 0) +
    (naLutea && e5(s.sono) >= 4 ? 20 : 0) +
    b(s.choro) * 15 +
    (naLutea && (s.compulsao ?? 0) >= 2 ? 15 : 0)
  );

  const androgenico = clamp(
    ((s.acne ?? 0) >= 2 ? 35 : (s.acne ?? 0) >= 1 ? 15 : 0) +
    ((s.oleosidade ?? 0) >= 2 ? 35 : (s.oleosidade ?? 0) >= 1 ? 15 : 0) +
    ((s.libido !== null && s.libido !== undefined && (s.libido <= 1 || s.libido >= 5)) ? 15 : 0) +
    ((s.dor_pelvica ?? 0) >= 2 ? 15 : 0)
  );

  const intestinal = clamp(
    (s.intestino && s.intestino !== 'normal' ? 30 : 0) +
    ((s.inchaco ?? 0) >= 2 ? 25 : (s.inchaco ?? 0) >= 1 ? 12 : 0) +
    ((s.acne ?? 0) >= 1 ? 20 : 0) +
    ((s.compulsao ?? 0) >= 2 ? 15 : 0) +
    (s.intestino === 'gases' ? 10 : 0)
  );

  const inflamatorio = clamp(
    ((s.dor_pelvica ?? 0) >= 2 ? 30 : (s.dor_pelvica ?? 0) >= 1 ? 15 : 0) +
    b(s.enxaqueca) * 25 +
    ((s.dor_cabeca ?? 0) >= 2 ? 20 : (s.dor_cabeca ?? 0) >= 1 ? 10 : 0) +
    ((s.retencao ?? 0) >= 2 ? 15 : 0) +
    ((s.inchaco ?? 0) >= 2 ? 10 : 0)
  );

  return { glicemico, adrenal, estrogenico, progesterona, androgenico, intestinal, inflamatorio };
}

// ─────────────────────────────────────────────────────────────────────────────
// ALERTAS CLÍNICOS — Biblioteca Clínica Útera (Etapa 4)
// ─────────────────────────────────────────────────────────────────────────────

const LIMIAR = 55; // score mínimo para disparar alerta (mantém comportamento anterior)

function scoreParaIntensidade(score) {
  if (score >= 85) return 'atencao_clinica';
  if (score >= 70) return 'importante';
  return 'moderado';
}

const INTENSIDADE_TIPO = {
  moderado:        'aviso',
  importante:      'alerta',
  atencao_clinica: 'alerta',
};

export function gerarAlertas(scores) {
  if (!scores) return [];

  // Eixos acima do limiar, ordenados por score descendente
  const ativos = Object.entries(scores)
    .filter(([, v]) => v >= LIMIAR)
    .sort(([, a], [, b]) => b - a);

  if (!ativos.length) return [];

  const eixosAtivosSet = new Set(ativos.map(([k]) => k));
  const alertasUsados  = new Set();
  const resultado      = [];

  for (const [eixo, score] of ativos) {
    // Candidatos na biblioteca: alertas que referenciam este eixo
    const candidatos = ALERTAS_PROBLEMA
      .filter(a => !alertasUsados.has(a.id) && a.eixos.includes(eixo))
      .map(a => ({
        alerta: a,
        // Fit: quantos eixos do alerta estão ativos (favorece alertas multi-eixo)
        fit: a.eixos.filter(e => eixosAtivosSet.has(e)).length,
      }))
      .sort((a, b) => b.fit - a.fit || a.alerta.numero - b.alerta.numero);

    if (!candidatos.length) continue;

    const { alerta } = candidatos[0];
    alertasUsados.add(alerta.id);

    const intensidade = scoreParaIntensidade(score);

    resultado.push({
      // Campos compatíveis com o formato atual da UI
      icon:     EIXOS[eixo]?.icon ?? 'alert-circle',
      titulo:   alerta.nome,
      descricao: alerta.textoPaciente,
      sugestao:  alerta.microconduta ?? alerta.conscienciaCorporal ?? null,
      tipo:      INTENSIDADE_TIPO[intensidade],
      score,
      eixo,
      // Campos novos da Biblioteca Clínica Útera
      textoNutricionista:  alerta.textoNutricionista,
      conscienciaCorporal: alerta.conscienciaCorporal ?? null,
      intensidade,
      alertaId: alerta.id,
    });
  }

  return resultado;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS DE DATA / CALENDÁRIO
// ─────────────────────────────────────────────────────────────────────────────

export function isoHoje() {
  return new Date().toISOString().slice(0, 10);
}

export function diasDoMes(ano, mes) {
  const primeiro = new Date(ano, mes, 1);
  const ultimo   = new Date(ano, mes + 1, 0);
  const offset   = primeiro.getDay();
  const dias = [];
  for (let i = 0; i < offset; i++) dias.push(null);
  for (let d = 1; d <= ultimo.getDate(); d++) {
    dias.push(
      `${ano}-${String(mes + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    );
  }
  return dias;
}

export function formatMesAno(ano, mes) {
  return new Date(ano, mes, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
}

export function dataBRCurta(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit',
  });
}

export function dataBR(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}
