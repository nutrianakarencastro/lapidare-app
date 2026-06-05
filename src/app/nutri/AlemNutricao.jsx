import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { CATEGORIAS_ALEM, CATEGORIA_MAP, ordenarItens, normalizarLinks, MAX_LINKS } from '../../lib/alemNutricaoUtils.js';

// ─── Placeholder de imagem (mini) ─────────────────────────────────────────────

function MiniImagem({ url, categoriaId }) {
  const [erro, setErro] = useState(false);
  const info = CATEGORIA_MAP[categoriaId];
  const size = 64;

  if (!url || erro) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 8, flexShrink: 0,
        background: 'var(--bg3)', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`ti ti-${info?.icon ?? 'star'}`} style={{ fontSize: 22, color: 'var(--text4)' }} aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={url}
      alt=""
      onError={() => setErro(true)}
      style={{ width: size, height: size, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
    />
  );
}

// ─── Sheet: criação / edição ──────────────────────────────────────────────────

const FORM_VAZIO = {
  categoria: '', titulo: '', marca: '', descricao: '',
  links: [], imagem_url: '', destaque: false, ordem: 0,
};

function SheetItem({ inicial, onSalvar, onFechar, salvando }) {
  const [form, setForm] = useState({ ...FORM_VAZIO, ...inicial });
  const [previewErro, setPreviewErro] = useState(false);

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  // Gerenciamento de links
  function addLink() {
    if (form.links.length >= MAX_LINKS) return;
    set('links', [...form.links, { titulo: '', url: '' }]);
  }

  function removeLink(i) {
    set('links', form.links.filter((_, idx) => idx !== i));
  }

  function updateLink(i, campo, valor) {
    const novo = form.links.map((l, idx) => idx === i ? { ...l, [campo]: valor } : l);
    set('links', novo);
  }

  const podeEnviar = form.categoria && form.titulo.trim();

  return (
    <div className="sheet-backdrop" onClick={onFechar}>
      <div className="sheet" style={{ maxHeight: '92vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        <div className="serif" style={{ fontSize: 20, marginBottom: 16 }}>
          {inicial?.id ? 'Editar item' : 'Novo item'}
        </div>

        {/* Categoria */}
        <div style={{ marginBottom: 18 }}>
          <div style={labelStyle}>Categoria <span style={{ color: 'var(--red)' }}>*</span></div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {CATEGORIAS_ALEM.map(cat => (
              <button
                key={cat.id}
                onClick={() => set('categoria', cat.id)}
                style={{
                  padding: '7px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: form.categoria === cat.id ? 600 : 400,
                  background: form.categoria === cat.id ? 'var(--dark)' : 'var(--bg2)',
                  color: form.categoria === cat.id ? 'white' : 'var(--text3)',
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Título */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Título <span style={{ color: 'var(--red)' }}>*</span></div>
          <input
            value={form.titulo}
            onChange={e => set('titulo', e.target.value)}
            placeholder="Ex: Protetor solar mineral"
            style={inputStyle}
          />
        </div>

        {/* Marca */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Marca</div>
          <input
            value={form.marca}
            onChange={e => set('marca', e.target.value)}
            placeholder="Ex: Simple Organic"
            style={inputStyle}
          />
        </div>

        {/* Descrição */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Descrição</div>
          <textarea
            value={form.descricao}
            onChange={e => set('descricao', e.target.value)}
            placeholder="Por que você recomenda? Diferenciais do produto…"
            rows={3}
            style={{ ...inputStyle, resize: 'none' }}
          />
        </div>

        {/* Links */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ ...labelStyle, marginBottom: 10 }}>Links</div>
          {form.links.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'flex-start' }}>
              <input
                value={l.titulo}
                onChange={e => updateLink(i, 'titulo', e.target.value)}
                placeholder="Título (ex: Spotify)"
                style={{ ...inputStyle, flex: '0 0 38%', marginBottom: 0 }}
              />
              <input
                value={l.url}
                onChange={e => updateLink(i, 'url', e.target.value)}
                placeholder="https://..."
                style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
              />
              <button
                onClick={() => removeLink(i)}
                style={{
                  padding: '10px', borderRadius: 8, border: 'none', cursor: 'pointer',
                  background: 'var(--bg2)', color: 'var(--red)', flexShrink: 0,
                  fontFamily: 'var(--font-sans)',
                }}
              >
                <i className="ti ti-x" style={{ fontSize: 14 }} aria-hidden="true" />
              </button>
            </div>
          ))}
          {form.links.length < MAX_LINKS && (
            <button
              onClick={addLink}
              style={{
                padding: '8px 14px', borderRadius: 99, border: '1px dashed var(--border)',
                background: 'transparent', cursor: 'pointer',
                fontSize: 13, color: 'var(--text3)', fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              <i className="ti ti-plus" style={{ fontSize: 13 }} aria-hidden="true" />
              Adicionar link
            </button>
          )}
        </div>

        {/* Imagem URL */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>URL da imagem de capa</div>
          <input
            value={form.imagem_url}
            onChange={e => { set('imagem_url', e.target.value); setPreviewErro(false); }}
            placeholder="https://..."
            style={inputStyle}
          />
          {form.imagem_url && !previewErro && (
            <img
              src={form.imagem_url}
              alt="preview"
              onError={() => setPreviewErro(true)}
              style={{ width: '100%', borderRadius: 8, marginTop: 8, maxHeight: 140, objectFit: 'cover' }}
            />
          )}
          {form.imagem_url && previewErro && (
            <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6 }}>
              Imagem não pôde ser carregada. Verifique a URL.
            </div>
          )}
        </div>

        {/* Destaque */}
        <div style={{ marginBottom: 14 }}>
          <div style={labelStyle}>Destaque</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[true, false].map(v => (
              <button
                key={String(v)}
                onClick={() => set('destaque', v)}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                  fontSize: 13, fontWeight: 500, fontFamily: 'var(--font-sans)',
                  background: form.destaque === v ? 'var(--dark)' : 'var(--bg2)',
                  color: form.destaque === v ? 'white' : 'var(--text3)',
                }}
              >
                {v ? '★ Sim' : 'Não'}
              </button>
            ))}
          </div>
          {form.destaque && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
              Badge "Recomendado pela sua nutri" aparecerá para a paciente.
            </div>
          )}
        </div>

        {/* Ordenação */}
        <div style={{ marginBottom: 24 }}>
          <div style={labelStyle}>Ordenação (menor = primeiro)</div>
          <input
            type="number"
            value={form.ordem}
            onChange={e => set('ordem', parseInt(e.target.value, 10) || 0)}
            min={0}
            style={{ ...inputStyle, width: 100 }}
          />
        </div>

        <button
          onClick={() => onSalvar(form)}
          disabled={!podeEnviar || salvando}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none',
            fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)',
            cursor: podeEnviar ? 'pointer' : 'not-allowed',
            background: podeEnviar ? 'var(--dark)' : 'var(--bg3)',
            color: podeEnviar ? 'white' : 'var(--text4)',
          }}
        >
          {salvando ? 'Salvando…' : inicial?.id ? 'Salvar alterações' : 'Publicar'}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AlemNutricaoNutri() {
  const { user } = useSession();
  const [itens, setItens] = useState(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos');
  const [statusFiltro, setStatusFiltro] = useState('ativos');
  const [sheet, setSheet] = useState(null); // null | {} | item existente
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from('alem_nutricao_itens')
      .select('*')
      .eq('nutri_id', user.id)
      .order('ordem', { ascending: true })
      .order('criado_em', { ascending: false });
    setItens(data ?? []);
  }, [user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  function mostrarAviso(msg) {
    setAviso(msg);
    setTimeout(() => setAviso(null), 2500);
  }

  async function salvar(form) {
    setSalvando(true);
    const linksLimpos = (form.links ?? [])
      .filter(l => l.url?.trim())
      .map(l => ({ titulo: l.titulo?.trim() || l.url, url: l.url.trim() }));

    const payload = {
      nutri_id: user.id,
      categoria: form.categoria,
      titulo: form.titulo.trim(),
      marca: form.marca?.trim() || null,
      descricao: form.descricao?.trim() || null,
      links: linksLimpos,
      imagem_url: form.imagem_url?.trim() || null,
      destaque: !!form.destaque,
      ativo: true,
      ordem: form.ordem ?? 0,
    };

    const { error } = form.id
      ? await supabase.from('alem_nutricao_itens').update(payload).eq('id', form.id)
      : await supabase.from('alem_nutricao_itens').insert(payload);

    setSalvando(false);
    if (error) { mostrarAviso('Erro ao salvar. Tente novamente.'); return; }
    setSheet(null);
    await carregar();
    mostrarAviso(form.id ? 'Item atualizado.' : 'Item publicado.');
  }

  async function toggleAtivo(item) {
    const novoAtivo = !item.ativo;
    await supabase.from('alem_nutricao_itens').update({ ativo: novoAtivo }).eq('id', item.id);
    await carregar();
    mostrarAviso(novoAtivo ? 'Item reativado.' : 'Item arquivado.');
  }

  if (itens === null) {
    return <div style={{ padding: 24, color: 'var(--text3)', fontSize: 14 }}>Carregando…</div>;
  }

  const itensFiltrados = ordenarItens(
    itens.filter(i => {
      const passaCategoria = categoriaFiltro === 'todos' || i.categoria === categoriaFiltro;
      const passaStatus    = statusFiltro === 'ativos' ? i.ativo : !i.ativo;
      return passaCategoria && passaStatus;
    })
  );

  return (
    <div>
      {aviso && (
        <div style={{
          background: 'var(--dark)', color: 'white', padding: '10px 20px',
          borderRadius: 10, fontSize: 13, marginBottom: 16, fontFamily: 'var(--font-sans)',
        }}>
          {aviso}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div className="page-title">Além da Nutrição</div>
        <button
          onClick={() => setSheet({})}
          style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
            background: 'var(--dark)', color: 'white',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <i className="ti ti-plus" style={{ fontSize: 14 }} aria-hidden="true" />
          Novo item
        </button>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
        <button onClick={() => setCategoriaFiltro('todos')} style={chipStyle(categoriaFiltro === 'todos')}>
          Todos
        </button>
        {CATEGORIAS_ALEM.map(cat => (
          <button key={cat.id} onClick={() => setCategoriaFiltro(cat.id)} style={chipStyle(categoriaFiltro === cat.id)}>
            {cat.label}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['ativos', 'arquivados'].map(s => (
          <button key={s} onClick={() => setStatusFiltro(s)} style={chipStyle(statusFiltro === s)}>
            {s === 'ativos' ? 'Ativos' : 'Arquivados'}
          </button>
        ))}
      </div>

      {/* Vazio */}
      {!itensFiltrados.length && (
        <div className="card empty-card">
          <i className="ti ti-star" style={{ fontSize: 28, color: 'var(--text4)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', marginBottom: 4 }}>
            {statusFiltro === 'ativos' ? 'Nenhum item publicado' : 'Nenhum item arquivado'}
          </div>
          <div className="empty-sub" style={{ fontSize: 13 }}>
            {statusFiltro === 'ativos' && 'Clique em "+ Novo item" para publicar sua primeira recomendação.'}
          </div>
        </div>
      )}

      {/* Lista */}
      {itensFiltrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {itensFiltrados.map(item => {
            const links = normalizarLinks(item.links);
            const catInfo = CATEGORIA_MAP[item.categoria];
            return (
              <div key={item.id} style={{
                background: 'var(--white)', border: '0.5px solid var(--border)',
                borderRadius: 12, padding: '14px 16px',
                display: 'flex', gap: 14, alignItems: 'flex-start',
                opacity: item.ativo ? 1 : 0.55,
              }}>
                <MiniImagem url={item.imagem_url} categoriaId={item.categoria} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 2 }}>
                    <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: 'var(--dark)', lineHeight: 1.3 }}>
                      {item.titulo}
                    </div>
                    {item.destaque && (
                      <i className="ti ti-star-filled" style={{ fontSize: 13, color: '#c4a882', flexShrink: 0, marginTop: 2 }} aria-hidden="true" />
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
                    {catInfo?.label}
                    {item.marca && ` · ${item.marca}`}
                    {links.length > 0 && ` · ${links.length} link${links.length > 1 ? 's' : ''}`}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => setSheet(item)}
                      style={btnSecStyle}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => toggleAtivo(item)}
                      style={btnSecStyle}
                    >
                      {item.ativo ? 'Arquivar' : 'Reativar'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sheet !== null && (
        <SheetItem
          inicial={sheet}
          onSalvar={salvar}
          onFechar={() => setSheet(null)}
          salvando={salvando}
        />
      )}
    </div>
  );
}

const labelStyle = {
  fontSize: 12, fontWeight: 600, color: 'var(--dark)', marginBottom: 6,
};

const inputStyle = {
  width: '100%', borderRadius: 10, border: '1px solid var(--border)',
  padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)',
  background: 'var(--bg2)', color: 'var(--dark)', boxSizing: 'border-box',
};

function chipStyle(ativo) {
  return {
    padding: '6px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
    fontSize: 12, fontWeight: ativo ? 600 : 400, whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)',
    background: ativo ? 'var(--dark)' : 'var(--bg2)',
    color: ativo ? 'white' : 'var(--text3)',
  };
}

const btnSecStyle = {
  padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
  fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
  background: 'var(--bg2)', color: 'var(--dark)',
};
