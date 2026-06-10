// Listas compartilhadas entre Cadastrar e PacientePerfil.
// 'outro_livre' é sentinela de UI — nunca persiste no banco.

export const MODELOS_CLINICOS = [
  { v: 'consulta',       l: 'Consulta'       },
  { v: 'acompanhamento', l: 'Acompanhamento'  },
  { v: 'manutencao',     l: 'Manutenção'      },
  { v: 'reviva',         l: 'Reviva'          },
  { v: 'longevidade',    l: 'Longevidade'     },
];

export const NIVEIS_ACESSO_UTERA = [
  { v: 'essencial',  l: 'Essencial'  },
  { v: 'expandido',  l: 'Expandido'  },
  { v: 'completo',   l: 'Completo'   },
];

export const PLANOS = [
  { v: 'consulta_avulsa', l: 'Consulta avulsa' },
  { v: 'trimestral',      l: 'Trimestral' },
  { v: 'semestral',       l: 'Semestral' },
  { v: 'anual',           l: 'Anual' },
  { v: 'consultoria',     l: 'Consultoria' },
  { v: 'acompanhamento',  l: 'Acompanhamento' },
  { v: 'outro_livre',     l: 'Outro…' },
];

export const OBJETIVOS = [
  'Emagrecimento',
  'Hipertrofia',
  'Reeducação alimentar',
  'Saúde geral',
  'Performance esportiva',
];

export const MODALIDADES = ['Presencial', 'Online', 'Híbrido'];
