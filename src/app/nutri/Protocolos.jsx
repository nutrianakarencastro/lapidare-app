import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PROTOCOLOS_INDEX } from '../../data/protocolos/_index.js';
import { parseProtocolo } from '../../lib/parseProtocolo.js';

// Carrega todos os .md como texto puro em build-time (Vite import.meta.glob)
const RAW_FILES = import.meta.glob(
  '../../data/protocolos/*.md',
  { query: '?raw', import: 'default', eager: true }
);

// Parser executado uma vez no carregamento do módulo — resultado em memória
const PROTOCOLOS_PARSED = Object.fromEntries(
  PROTOCOLOS_INDEX.map(p => {
    const key = Object.keys(RAW_FILES).find(k => k.endsWith('/' + p.arquivo));
    const raw = key ? RAW_FILES[key] : null;
    return [p.id, raw ? parseProtocolo(raw) : null];
  })
);

const CATEGORIAS = [
  'Hormônios',
  'Fertilidade',
  'Metabolismo',
  'Intestino',
  'Comportamento Alimentar',
  'Menopausa',
  'Longevidade Feminina',
];

const CAMADAS_ORDEM = [
  { chave: 'identidade',   label: 'Identidade do Protocolo' },
  { chave: 'raciocinio',   label: 'Estrutura do Raciocínio' },
  { chave: 'linhaDoTempo', label: 'Linha do Tempo Terapêutica' },
  { chave: 'ferramentas',  label: 'Caixa de Ferramentas' },
  { chave: 'sabedoria',    label: 'Sabedoria Clínica' },
];

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export default function Protocolos() {
  const [busca, setBusca] = useState('');
  const [categoriaSelecionada, setCategoriaSelecionada] = useState(null);
  const [protocoloAberto, setProtocoloAberto] = useState(null);
  const location = useLocation();
  const stateConsumed = useRef(false);

  // Abre diretamente o protocolo quando vindo de navegação contextual.
  // useRef garante que executa apenas uma vez por montagem.
  useEffect(() => {
    if (stateConsumed.current) return;
    const id = location.state?.protocoloId;
    if (id) {
      const protocolo = PROTOCOLOS_INDEX.find(p => p.id === id);
      if (protocolo) setProtocoloAberto(protocolo);
    }
    stateConsumed.current = true;
  }, [location.state]);

  const protocolosFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return PROTOCOLOS_INDEX.filter(p => {
      const matchBusca = !q || p.titulo.toLowerCase().includes(q);
      const matchCategoria = !categoriaSelecionada || (p.categorias ?? []).includes(categoriaSelecionada);
      return matchBusca && matchCategoria;
    });
  }, [busca, categoriaSelecionada]);

  const handleCategoria = (cat) =>
    setCategoriaSelecionada(prev => (prev === cat ? null : cat));

  if (protocoloAberto) {
    const parsed = PROTOCOLOS_PARSED[protocoloAberto.id];
    return (
      <ProtocoloDetalhe
        protocolo={protocoloAberto}
        camadas={parsed?.camadas ?? null}
        onVoltar={() => setProtocoloAberto(null)}
      />
    );
  }

  return (
    <ProtocoloLista
      busca={busca}
      onBusca={setBusca}
      categorias={CATEGORIAS}
      categoriaSelecionada={categoriaSelecionada}
      onCategoria={handleCategoria}
      protocolos={protocolosFiltrados}
      total={PROTOCOLOS_INDEX.length}
      onAbrir={setProtocoloAberto}
    />
  );
}

/* ============================================================
   TELA DE LISTA
   ============================================================ */
function ProtocoloLista({ busca, onBusca, categorias, categoriaSelecionada, onCategoria, protocolos, total, onAbrir }) {
  return (
    <>
      <div className="page-title">Protocolos</div>
      <div className="page-sub">
        {total} protocolo{total !== 1 ? 's' : ''} · raciocínio clínico estruturado por fase
      </div>

      {/* Busca */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <i className="ti ti-search" style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 15, color: 'var(--text3)', pointerEvents: 'none',
        }} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar protocolo…"
          value={busca}
          onChange={e => onBusca(e.target.value)}
          style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      {/* Filtro por categoria */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        <CategoriaChip
          label="Todos"
          ativa={!categoriaSelecionada}
          onClick={() => onCategoria(categoriaSelecionada ?? '__reset__')}
        />
        {categorias.map(cat => (
          <CategoriaChip
            key={cat}
            label={cat}
            ativa={categoriaSelecionada === cat}
            onClick={() => onCategoria(cat)}
          />
        ))}
      </div>

      {/* Lista */}
      {protocolos.length === 0 ? (
        <div className="card" style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text3)', fontSize: 14 }}>
          Nenhum protocolo encontrado.
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {protocolos.map((p, i) => (
            <ProtocoloCard
              key={p.id}
              protocolo={p}
              isLast={i === protocolos.length - 1}
              onAbrir={() => onAbrir(p)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function CategoriaChip({ label, ativa, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        fontSize: 12, padding: '4px 12px', borderRadius: 999,
        border: '0.5px solid ' + (ativa ? 'var(--dark)' : 'var(--border)'),
        background: ativa ? 'var(--dark)' : 'var(--white)',
        color: ativa ? 'var(--white)' : 'var(--text2)',
        cursor: 'pointer', fontFamily: 'var(--font-sans)',
        transition: 'background .15s, border-color .15s, color .15s',
      }}
    >
      {label}
    </button>
  );
}

/* ============================================================
   CARD DO PROTOCOLO
   Expansões futuras reservadas via prop `acoes` (Sprint 30.x):
   acoes.onFavoritar        → favoritar em localStorage / Supabase
   acoes.onVincularPaciente → tabela protocolo_paciente
   acoes.onSugerirMateriais → match por categoria
   acoes.onSugerirEstrategias → match por tag clínica
   acoes.onSugerirRastreios   → match por camada 4
   ============================================================ */
function ProtocoloCard({ protocolo, isLast, onAbrir }) {
  return (
    <div
      onClick={onAbrir}
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '14px 16px',
        borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
        cursor: 'pointer', transition: 'background .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = '#faf8f5'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10,
        background: 'var(--bg2)', border: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <i className="ti ti-clipboard-heart" style={{ fontSize: 18, color: 'var(--text3)' }} aria-hidden="true" />
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dark)', marginBottom: 3, lineHeight: 1.4 }}>
          {protocolo.titulo}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {(protocolo.categorias ?? [protocolo.categoria]).join(' · ')}
        </div>
      </div>

      <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
    </div>
  );
}

/* ============================================================
   TELA DE DETALHE
   ============================================================ */
function ProtocoloDetalhe({ protocolo, camadas, onVoltar }) {
  return (
    <>
      <button
        onClick={onVoltar}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          fontSize: 13, color: 'var(--text2)', padding: '0 0 18px',
          fontFamily: 'var(--font-sans)',
        }}
      >
        <i className="ti ti-arrow-left" style={{ fontSize: 15 }} aria-hidden="true" />
        Voltar aos protocolos
      </button>

      <div className="page-title">{protocolo.titulo}</div>
      <div className="page-sub" style={{ marginBottom: 20 }}>
        {(protocolo.categorias ?? [protocolo.categoria]).join(' · ')}
      </div>

      <div className="card" style={{ padding: 0 }}>
        {CAMADAS_ORDEM.map((c, i) => (
          <CamadaSection
            key={c.chave}
            label={c.label}
            numero={i + 1}
            conteudo={camadas?.[c.chave] ?? null}
            defaultAberta={i === 0}
            isLast={i === CAMADAS_ORDEM.length - 1}
          />
        ))}
      </div>
    </>
  );
}

/* ============================================================
   SEÇÃO EXPANSÍVEL (CAMADA)
   ============================================================ */
function CamadaSection({ label, numero, conteudo, defaultAberta, isLast }) {
  const [aberta, setAberta] = useState(defaultAberta);

  return (
    <div style={{ borderBottom: isLast ? 'none' : '0.5px solid var(--border)' }}>
      <button
        onClick={() => setAberta(a => !a)}
        style={{
          width: '100%', textAlign: 'left', background: 'none', border: 'none',
          padding: '14px 16px', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          fontFamily: 'var(--font-sans)',
          transition: 'background .15s',
        }}
        onMouseEnter={e => e.currentTarget.style.background = '#faf8f5'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 22, height: 22, borderRadius: '50%',
            background: aberta ? 'var(--dark)' : 'var(--bg2)',
            border: '0.5px solid ' + (aberta ? 'var(--dark)' : 'var(--border)'),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 700,
            color: aberta ? 'var(--white)' : 'var(--text3)',
            flexShrink: 0, transition: 'all .15s',
          }}>
            {numero}
          </span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>{label}</span>
        </div>
        <i
          className={`ti ti-chevron-${aberta ? 'up' : 'down'}`}
          style={{ fontSize: 14, color: 'var(--text3)', flexShrink: 0 }}
          aria-hidden="true"
        />
      </button>

      {aberta && (
        <div style={{ padding: '0 16px 18px', borderTop: '0.5px solid var(--border)' }}>
          {conteudo ? (
            <RenderMarkdown conteudo={conteudo} />
          ) : (
            <p style={{ fontSize: 13, color: 'var(--text3)', fontStyle: 'italic', margin: '14px 0 0' }}>
              Conteúdo não encontrado nesta seção.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ============================================================
   RENDERIZADOR DE MARKDOWN (sem dependências externas)
   Suporta: # h1, ## h2, ### h3, * listas, **bold**, escapes \X
   ============================================================ */
function inlineMarkdown(texto) {
  const limpo = texto.replace(/\\(.)/g, '$1'); // desescapar \. \+ etc.
  const partes = limpo.split(/(\*\*[^*]+\*\*)/g);
  return partes.map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={i}>{p.slice(2, -2)}</strong>;
    }
    return p || null;
  });
}

function RenderMarkdown({ conteudo }) {
  if (!conteudo) return null;

  const linhas = conteudo.split('\n');
  const elementos = [];
  let listaItems = [];
  let k = 0;

  const flushLista = () => {
    if (!listaItems.length) return;
    elementos.push(
      <ul key={`ul${k++}`} style={{ margin: '4px 0 10px 18px', padding: 0 }}>
        {listaItems}
      </ul>
    );
    listaItems = [];
  };

  const limparTitulo = (s) => s.replace(/\*\*/g, '').replace(/\\(.)/g, '$1').trim();

  for (const rawLinha of linhas) {
    const trim = rawLinha.trim();

    if (!trim || trim === '---') { flushLista(); continue; }

    const mH3 = trim.match(/^###\s+(.*)/);
    const mH2 = trim.match(/^##\s+(.*)/);
    const mH1 = trim.match(/^#\s+(.*)/);

    if (mH3) {
      flushLista();
      elementos.push(
        <div key={k++} style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
          letterSpacing: '.07em', color: 'var(--text3)',
          marginTop: 16, marginBottom: 5,
        }}>
          {limparTitulo(mH3[1])}
        </div>
      );
      continue;
    }

    if (mH2) {
      flushLista();
      elementos.push(
        <div key={k++} style={{
          fontSize: 13, fontWeight: 600, color: 'var(--dark)',
          marginTop: 16, marginBottom: 5,
        }}>
          {limparTitulo(mH2[1])}
        </div>
      );
      continue;
    }

    if (mH1) {
      flushLista();
      elementos.push(
        <div key={k++} style={{
          fontSize: 14, fontWeight: 700, color: 'var(--dark)',
          marginTop: 20, marginBottom: 6,
          fontFamily: 'var(--font-serif)',
        }}>
          {limparTitulo(mH1[1])}
        </div>
      );
      continue;
    }

    const mLista = trim.match(/^[*\-]\s+(.*)/);
    if (mLista) {
      listaItems.push(
        <li key={k++} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 1 }}>
          {inlineMarkdown(mLista[1])}
        </li>
      );
      continue;
    }

    flushLista();
    elementos.push(
      <p key={k++} style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.75, marginBottom: 8, marginTop: 0 }}>
        {inlineMarkdown(trim)}
      </p>
    );
  }

  flushLista();
  return <div style={{ paddingTop: 14 }}>{elementos}</div>;
}
