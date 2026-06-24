import { useState, useMemo, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { PROTOCOLOS_INDEX } from '../../data/protocolos/_index.js';
import { parseProtocolo } from '../../lib/parseProtocolo.js';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';

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

const CATEGORIAS_OBS = [
  { v: 'resposta_clinica', label: 'Resposta Clínica' },
  { v: 'barreira',         label: 'Barreira'          },
  { v: 'perfil',           label: 'Perfil'            },
  { v: 'sequencia',        label: 'Sequência'         },
  { v: 'adesao',           label: 'Adesão'            },
];

const ORIGENS_OBS = [
  { v: 'consulta',          label: 'Consulta'          },
  { v: 'atendimento',       label: 'Atendimento'       },
  { v: 'analise_posterior', label: 'Análise posterior' },
];

/* ============================================================
   COMPONENTE PRINCIPAL
   ============================================================ */
export default function Protocolos() {
  const { user } = useSession();
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
        nutriId={user?.id}
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
function ProtocoloDetalhe({ protocolo, camadas, onVoltar, nutriId }) {
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

      {nutriId && (
        <ObservacoesSection protocoloId={protocolo.id} nutriId={nutriId} />
      )}
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
   OBSERVAÇÕES CLÍNICAS
   ============================================================ */
function ObservacoesSection({ protocoloId, nutriId }) {
  const [obs, setObs]               = useState([]);
  const [mostrarForm, setMostrarForm] = useState(false);
  const [form, setForm]             = useState({ categoria: '', origem: '', observacao: '' });
  const [salvando, setSalvando]     = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from('protocolo_observacoes')
      .select('id, categoria, origem, observacao, created_at')
      .eq('nutri_id', nutriId)
      .eq('protocolo_id', protocoloId)
      .order('created_at', { ascending: false });
    setObs(data ?? []);
  }

  useEffect(() => { carregar(); }, [protocoloId, nutriId]);

  async function salvar() {
    if (!form.categoria || !form.origem || !form.observacao.trim()) return;
    setSalvando(true);
    await supabase.from('protocolo_observacoes').insert({
      nutri_id:     nutriId,
      protocolo_id: protocoloId,
      categoria:    form.categoria,
      origem:       form.origem,
      observacao:   form.observacao.trim(),
    });
    setSalvando(false);
    setForm({ categoria: '', origem: '', observacao: '' });
    setMostrarForm(false);
    await carregar();
  }

  async function excluir(id) {
    await supabase.from('protocolo_observacoes').delete().eq('id', id);
    await carregar();
  }

  const labelCat = v => CATEGORIAS_OBS.find(c => c.v === v)?.label ?? v;
  const labelOri = v => ORIGENS_OBS.find(o => o.v === v)?.label ?? v;
  const fmtData  = iso => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  const formValido = form.categoria && form.origem && form.observacao.trim();

  return (
    <div style={{ marginTop: 24 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>
          Observações clínicas
        </div>
        {!mostrarForm && (
          <button
            onClick={() => setMostrarForm(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 999,
              background: 'var(--dark)', color: 'var(--white)',
              border: 'none', fontSize: 12, fontWeight: 500,
              cursor: 'pointer', fontFamily: 'var(--font-sans)',
            }}
          >
            <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" />
            Nova
          </button>
        )}
      </div>

      {mostrarForm && (
        <div className="card" style={{ padding: 16, marginBottom: 14 }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
              Categoria
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {CATEGORIAS_OBS.map(c => (
                <button
                  key={c.v}
                  onClick={() => setForm(f => ({ ...f, categoria: c.v }))}
                  style={{
                    fontSize: 12, padding: '4px 11px', borderRadius: 999,
                    border: '0.5px solid ' + (form.categoria === c.v ? 'var(--dark)' : 'var(--border)'),
                    background: form.categoria === c.v ? 'var(--dark)' : 'var(--white)',
                    color: form.categoria === c.v ? 'var(--white)' : 'var(--text2)',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
              Origem
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {ORIGENS_OBS.map(o => (
                <button
                  key={o.v}
                  onClick={() => setForm(f => ({ ...f, origem: o.v }))}
                  style={{
                    fontSize: 12, padding: '4px 11px', borderRadius: 999,
                    border: '0.5px solid ' + (form.origem === o.v ? 'var(--dark)' : 'var(--border)'),
                    background: form.origem === o.v ? 'var(--dark)' : 'var(--white)',
                    color: form.origem === o.v ? 'var(--white)' : 'var(--text2)',
                    cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  }}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
              Observação
            </div>
            <textarea
              value={form.observacao}
              onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))}
              placeholder="Descreva a observação clínica…"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box', resize: 'vertical',
                padding: '8px 10px', borderRadius: 8, fontSize: 13,
                border: '0.5px solid var(--border)', fontFamily: 'var(--font-sans)',
                color: 'var(--dark)', lineHeight: 1.6,
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => { setMostrarForm(false); setForm({ categoria: '', origem: '', observacao: '' }); }}
              style={{
                flex: 1, padding: '8px 0', borderRadius: 8,
                background: 'var(--bg2)', color: 'var(--text3)',
                border: '0.5px solid var(--border)', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              Cancelar
            </button>
            <button
              onClick={salvar}
              disabled={salvando || !formValido}
              style={{
                flex: 2, padding: '8px 0', borderRadius: 8,
                background: (salvando || !formValido) ? 'var(--bg2)' : 'var(--dark)',
                color: (salvando || !formValido) ? 'var(--text3)' : 'var(--white)',
                border: 'none', fontSize: 13, fontWeight: 500,
                cursor: (salvando || !formValido) ? 'default' : 'pointer',
                fontFamily: 'var(--font-sans)',
              }}
            >
              {salvando ? 'Salvando…' : 'Salvar observação'}
            </button>
          </div>
        </div>
      )}

      {obs.length === 0 && !mostrarForm && (
        <div className="card" style={{ padding: 16, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Nenhuma observação registrada para este protocolo.
        </div>
      )}

      {obs.length > 0 && (
        <div className="card" style={{ padding: 0 }}>
          {obs.map((o, i) => (
            <div
              key={o.id}
              style={{
                padding: '12px 16px',
                borderBottom: i < obs.length - 1 ? '0.5px solid var(--border)' : 'none',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999,
                      background: 'var(--bg2)', color: 'var(--text2)',
                      fontWeight: 600, border: '0.5px solid var(--border)',
                    }}>
                      {labelCat(o.categoria)}
                    </span>
                    <span style={{
                      fontSize: 11, padding: '2px 8px', borderRadius: 999,
                      background: 'var(--bg2)', color: 'var(--text3)',
                      border: '0.5px solid var(--border)',
                    }}>
                      {labelOri(o.origem)}
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 4 }}>
                    {o.observacao}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {fmtData(o.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => excluir(o.id)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text3)', padding: 4, flexShrink: 0,
                    fontSize: 15, lineHeight: 1,
                  }}
                  title="Excluir observação"
                >
                  <i className="ti ti-trash" aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
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
