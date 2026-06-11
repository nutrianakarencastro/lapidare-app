const CAMADAS_CONFIG = [
  {
    chave: 'identidade',
    nome: 'Identidade do Protocolo',
    comCamada: ['identidade'],
    semCamada: ['identidade do protocolo'],
  },
  {
    chave: 'raciocinio',
    nome: 'Estrutura do Raciocínio',
    comCamada: ['racioc'],
    semCamada: ['estrutura do racioc'],
  },
  {
    chave: 'linhaDoTempo',
    nome: 'Linha do Tempo Terapêutica',
    comCamada: ['linha do tempo'],
    semCamada: ['linha do tempo'],
  },
  {
    chave: 'ferramentas',
    nome: 'Caixa de Ferramentas',
    comCamada: ['ferramentas'],
    semCamada: ['caixa de ferramentas'],
  },
  {
    chave: 'sabedoria',
    nome: 'Sabedoria Clínica',
    comCamada: ['sabedoria'],
    semCamada: ['sabedoria clinica'],
  },
];

function normalizar(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function identificarCamada(linha) {
  if (!/^#+\s/.test(linha)) return null;
  const norm = normalizar(linha);
  const temCamada = norm.includes('camada');
  for (const c of CAMADAS_CONFIG) {
    const palavras = temCamada ? c.comCamada : c.semCamada;
    if (palavras.some(pw => norm.includes(normalizar(pw)))) {
      return c.chave;
    }
  }
  return null;
}

export function parseProtocolo(raw) {
  const linhas = raw.split('\n');
  const blocos = {
    identidade:   [],
    raciocinio:   [],
    linhaDoTempo: [],
    ferramentas:  [],
    sabedoria:    [],
  };
  let camadaAtual = null;

  for (const linha of linhas) {
    const camada = identificarCamada(linha);
    if (camada) {
      camadaAtual = camada;
      continue;
    }
    if (camadaAtual) {
      blocos[camadaAtual].push(linha);
    }
  }

  const camadas = {};
  for (const c of CAMADAS_CONFIG) {
    const conteudo = blocos[c.chave].join('\n').trim();
    if (!conteudo) {
      console.warn(`parseProtocolo: camada não encontrada — "${c.nome}"`);
    }
    camadas[c.chave] = conteudo || null;
  }

  return { camadas };
}
