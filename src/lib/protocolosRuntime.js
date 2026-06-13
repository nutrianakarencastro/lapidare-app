// Carrega todos os .md de protocolos em build-time (Vite import.meta.glob eager)
// e extrai título + essência para consumo no app sem expor o conteúdo clínico completo.
//
// Exporta PROTOCOLOS_RUNTIME: Record<id, { titulo: string, essencia: string | null }>
// Usado por: _Jornada.jsx (nutri) e Jornada.jsx (paciente).

import { PROTOCOLOS_INDEX } from '../data/protocolos/_index.js';

const RAW_FILES = import.meta.glob(
  '../data/protocolos/*.md',
  { query: '?raw', import: 'default', eager: true }
);

function extractEssencia(raw) {
  const idx = raw.search(/essência do protocolo/i);
  if (idx === -1) return null;
  const after = raw.slice(idx);
  const match = after.match(/\*\*"([\s\S]+?)"\*\*/);
  return match ? match[1].trim() : null;
}

export const PROTOCOLOS_RUNTIME = Object.fromEntries(
  PROTOCOLOS_INDEX.map(p => {
    const key = Object.keys(RAW_FILES).find(k => k.endsWith('/' + p.arquivo));
    const raw = key ? RAW_FILES[key] : null;
    return [p.id, {
      titulo:   p.titulo,
      essencia: raw ? extractEssencia(raw) : null,
    }];
  })
);
