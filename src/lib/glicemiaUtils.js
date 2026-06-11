// Lógica de negócio do Diário Glicêmico DMG.
// Todas as funções são puras — sem efeitos colaterais.

export const REFEICOES_FIXAS = ['jejum', 'cafe_manha', 'almoco', 'jantar'];

export const LABEL_REFEICAO = {
  jejum:      'Jejum',
  cafe_manha: 'Café da manhã',
  almoco:     'Almoço',
  jantar:     'Jantar',
  extra:      'Extra',
};

// Retorna 'hipoglicemia' | 'meta' | 'fora_meta'
export function classificar(valor, tipo, protocolo) {
  if (valor < 70) return 'hipoglicemia';
  if (tipo === 'jejum') return valor <= 94 ? 'meta' : 'fora_meta';
  if (protocolo === '1h') return valor <= 139 ? 'meta' : 'fora_meta';
  return valor <= 119 ? 'meta' : 'fora_meta'; // 2h
}

// Rótulo do limite da meta para exibição
export function metaLabel(tipo, protocolo) {
  if (tipo === 'jejum') return '<95';
  return protocolo === '1h' ? '<140' : '<120';
}

export const AVISO_HIPOGLICEMIA =
  'Valor abaixo de 70 mg/dL detectado. Em caso de sintomas (tontura, sudorese, palpitações, fraqueza) ou recorrência, comunique imediatamente sua equipe assistente.';

export const LABEL_CURTO = {
  jejum: 'Jejum', cafe_manha: 'Café', almoco: 'Almoço', jantar: 'Jantar', extra: 'Extra',
};

// ─── Timers de lembrete pós-refeição (localStorage) ─────────────────────────
const TIMER_KEY = 'glicemia_timer';

export function salvarTimer(tipo, protocolo) {
  const timers = JSON.parse(localStorage.getItem(TIMER_KEY) ?? '[]');
  const outros = timers.filter(t => t.tipo !== tipo);
  outros.push({ tipo, protocolo, startTime: Date.now() });
  localStorage.setItem(TIMER_KEY, JSON.stringify(outros));
}

export function removerTimer(tipo) {
  const timers = JSON.parse(localStorage.getItem(TIMER_KEY) ?? '[]');
  localStorage.setItem(TIMER_KEY, JSON.stringify(timers.filter(t => t.tipo !== tipo)));
}

export function lerTimersHoje() {
  const hoje = new Date().toISOString().slice(0, 10);
  const all = JSON.parse(localStorage.getItem(TIMER_KEY) ?? '[]');
  return all.filter(t => new Date(t.startTime).toISOString().slice(0, 10) === hoje);
}

export function timerVencido(timer) {
  const ms = timer.protocolo === '1h' ? 3_600_000 : 7_200_000;
  return Date.now() - timer.startTime >= ms;
}

export function timerEsperadoEm(timer) {
  const ms = timer.protocolo === '1h' ? 3_600_000 : 7_200_000;
  return new Date(timer.startTime + ms).toTimeString().slice(0, 5);
}
