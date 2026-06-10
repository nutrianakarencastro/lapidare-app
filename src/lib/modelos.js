// Controle de acesso da Experiência Útera.
// acesso_utera (em pacientes) define o que está liberado no app.
// modelo_acompanhamento é independente — referência clínica, sem efeito aqui.

const TIER = { essencial: 1, expandido: 2, completo: 3 };

const MODULO_TIER = {
  // Tier 1 — ESSENCIAL
  plano: 1, progresso: 1, compras: 1, habitos: 1,
  exames: 1, suplementos: 1, orientacoes: 1, documentos: 1,
  // Tier 2 — EXPANDIDO
  checkin: 2, jornada: 2, ciclo: 2, intestino: 2, alem_nutricao: 2,
  // Tier 3 — COMPLETO
  estrategias: 3, mapa: 3,
};

export function podeAcessar(acesso, modulo) {
  if (!modulo) return true;
  const tierAcesso = TIER[acesso ?? 'completo'] ?? 3;
  const tierModulo = MODULO_TIER[modulo] ?? 1;
  return tierAcesso >= tierModulo;
}

export function tierNome(tierMinimo) {
  return { 2: 'Expandido', 3: 'Completo' }[tierMinimo] ?? '';
}
