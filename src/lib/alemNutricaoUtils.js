export const CATEGORIAS_ALEM = [
  { id: 'cosmeticos', label: 'Cosméticos',         icon: 'sparkles'    },
  { id: 'higiene',    label: 'Higiene',             icon: 'droplet'     },
  { id: 'casa',       label: 'Casa',                icon: 'home'        },
  { id: 'trocas',     label: 'Trocas Sustentáveis', icon: 'leaf'        },
  { id: 'conteudos',  label: 'Conteúdos',           icon: 'book'        },
];

export const CATEGORIA_MAP = Object.fromEntries(
  CATEGORIAS_ALEM.map(c => [c.id, c])
);

// Ordena itens: destaques primeiro, depois por ordem, depois por criado_em desc
export function ordenarItens(itens) {
  return [...itens].sort((a, b) => {
    if (a.destaque !== b.destaque) return a.destaque ? -1 : 1;
    if (a.ordem !== b.ordem) return a.ordem - b.ordem;
    return new Date(b.criado_em) - new Date(a.criado_em);
  });
}

// Garante que links é sempre um array válido de { titulo, url }.
// Adiciona https:// se o protocolo estiver ausente — sem protocolo, o browser
// interpreta a URL como caminho relativo ao SPA e a navegação falha silenciosamente.
export function normalizarLinks(links) {
  if (!Array.isArray(links)) return [];
  return links
    .filter(l => l && typeof l === 'object' && l.url?.trim())
    .map(l => {
      const url = l.url.trim();
      const normalizada = /^https?:\/\//i.test(url) ? url : `https://${url}`;
      return { ...l, url: normalizada };
    });
}

export const MAX_LINKS = 10;
