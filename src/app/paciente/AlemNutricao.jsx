import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { podeAcessar } from '../../lib/modelos.js';
import BloqueioModelo from '../../components/BloqueioModelo.jsx';
import { CATEGORIAS_ALEM, CATEGORIA_MAP, ordenarItens, normalizarLinks } from '../../lib/alemNutricaoUtils.js';

// ─── Placeholder de imagem ────────────────────────────────────────────────────

function ImagemCapa({ url, categoriaId, titulo }) {
  const [erro, setErro] = useState(false);
  const info = CATEGORIA_MAP[categoriaId];

  if (!url || erro) {
    return (
      <div style={{
        width: '100%', paddingBottom: '56.25%', position: 'relative',
        background: 'var(--bg-soft)', borderRadius: '12px 12px 0 0', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 8,
        }}>
          <i className={`ti ti-${info?.icon ?? 'star'}`}
            style={{ fontSize: 32, color: 'var(--muted-2)' }} aria-hidden="true" />
          <span style={{ fontSize: 11, color: 'var(--muted-2)', textAlign: 'center', padding: '0 12px' }}>
            {titulo}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', paddingBottom: '56.25%', position: 'relative', borderRadius: '12px 12px 0 0', overflow: 'hidden' }}>
      <img
        src={url}
        alt={titulo}
        onError={() => setErro(true)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
    </div>
  );
}

// ─── DIAGNÓSTICO TEMPORÁRIO ── remover após identificar a causa ───────────────
const DBG = true;

function CardItem({ item }) {
  const links       = normalizarLinks(item.links);
  const linkHref    = links.length > 0 ? links[0].url : null;
  const linkOriginal = Array.isArray(item.links) && item.links.length > 0
    ? (item.links[0]?.url ?? '(campo url ausente)')
    : '(links vazio ou nulo)';

  const clickado   = useRef(false);
  const [cliques, setCliques] = useState(0);

  function handleClick(e) {
    e.preventDefault();
    clickado.current = true;
    setCliques(n => n + 1);
    if (linkHref) window.location.href = linkHref;
  }

  const cardStyle = {
    background: 'var(--paper)', border: '0.5px solid var(--hair)',
    borderRadius: 12, overflow: 'hidden',
    display: 'block', textDecoration: 'none',
    cursor: linkHref ? 'pointer' : 'default',
  };

  const dbgStyle = {
    margin: '10px 16px 14px',
    padding: '8px 10px',
    borderRadius: 8,
    background: '#fff3cd',
    border: '1px solid #ffc107',
    fontSize: 10,
    fontFamily: 'monospace',
    color: '#333',
    lineHeight: 1.6,
    wordBreak: 'break-all',
  };

  const debug = DBG && (
    <div style={dbgStyle}>
      <strong>🔍 DIAGNÓSTICO</strong><br />
      <b>link original:</b> {linkOriginal}<br />
      <b>link normalizado:</b> {linkHref ?? '(nulo — card não é <a>)'}<br />
      <b>renderiza como {'<a>'}:</b> {linkHref ? '✅ SIM' : '❌ NÃO'}<br />
      <b>cliques registrados:</b> {cliques} {cliques > 0 ? '✅ click dispara' : '⬜ aguardando toque'}<br />
    </div>
  );

  const conteudo = (
    <>
      <ImagemCapa url={item.imagem_url} categoriaId={item.categoria} titulo={item.titulo} />

      <div style={{ padding: '14px 16px 4px' }}>
        {item.destaque && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 10, fontWeight: 700, color: '#7ea85a',
            background: '#eef5e3', padding: '3px 8px', borderRadius: 99,
            marginBottom: 8,
          }}>
            <i className="ti ti-star-filled" style={{ fontSize: 10 }} aria-hidden="true" />
            Recomendado pela sua nutri
          </div>
        )}

        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--dark)', marginBottom: 4, lineHeight: 1.35 }}>
          {item.titulo}
        </div>

        {item.marca && (
          <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6, fontWeight: 500 }}>
            {item.marca}
          </div>
        )}

        {item.descricao && (
          <div style={{
            fontSize: 13, color: 'var(--muted)', lineHeight: 1.55, marginBottom: 12,
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {item.descricao}
          </div>
        )}

        {linkHref && (
          <div style={{ marginTop: item.descricao ? 0 : 4, marginBottom: 12 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 99,
              background: 'var(--ink)', color: 'var(--paper)',
              fontSize: 13, fontWeight: 500,
            }}>
              <i className="ti ti-external-link" style={{ fontSize: 12 }} aria-hidden="true" />
              Ver indicação
            </span>
          </div>
        )}
      </div>

      {debug}
    </>
  );

  if (linkHref) {
    return (
      <div style={cardStyle} onClick={handleClick}>
        {conteudo}
      </div>
    );
  }

  return <div style={cardStyle}>{conteudo}</div>;
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function AlemNutricao() {
  const { user, profile } = useSession();
  const [itens, setItens] = useState(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState('todos');

  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    async function carregar() {
      const { data } = await supabase
        .from('alem_nutricao_itens')
        .select('*')
        .order('ordem', { ascending: true })
        .order('criado_em', { ascending: false });
      if (!active) return;
      setItens(data ?? []);
    }
    carregar();
    return () => { active = false; };
  }, [user?.id]);

  if (itens === null) {
    return (
      <div className="card empty-card" style={{ marginTop: 8 }}>
        <div className="empty-sub">Carregando…</div>
      </div>
    );
  }

  const itensFiltrados = ordenarItens(
    categoriaFiltro === 'todos'
      ? itens
      : itens.filter(i => i.categoria === categoriaFiltro)
  );

  if (!podeAcessar(profile?.acesso_utera, 'alem_nutricao')) {
    return <BloqueioModelo modulo="Além da Nutrição" tierMinimo={2} />;
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Filtros por categoria */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 20, paddingBottom: 4 }}>
        <button
          onClick={() => setCategoriaFiltro('todos')}
          style={chipStyle(categoriaFiltro === 'todos')}
        >
          Todos
        </button>
        {CATEGORIAS_ALEM.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoriaFiltro(cat.id)}
            style={chipStyle(categoriaFiltro === cat.id)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Estado vazio */}
      {!itensFiltrados.length && (
        <div className="card empty-card">
          <i className={`ti ti-${CATEGORIA_MAP[categoriaFiltro]?.icon ?? 'star'}`}
            style={{ fontSize: 32, color: 'var(--muted-2)', display: 'block', marginBottom: 10 }}
            aria-hidden="true" />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)', marginBottom: 6 }}>
            {categoriaFiltro === 'todos'
              ? 'Nenhuma indicação publicada ainda'
              : `Nenhuma indicação em ${CATEGORIA_MAP[categoriaFiltro]?.label ?? 'esta categoria'}`}
          </div>
          <div className="empty-sub" style={{ fontSize: 13 }}>
            Em breve sua nutri publicará recomendações aqui.
          </div>
        </div>
      )}

      {/* Lista de cards */}
      {itensFiltrados.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {itensFiltrados.map(item => (
            <CardItem key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function chipStyle(ativo) {
  return {
    padding: '7px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
    fontSize: 13, fontWeight: ativo ? 600 : 400, whiteSpace: 'nowrap',
    fontFamily: 'var(--font-sans)',
    background: ativo ? 'var(--dark)' : 'var(--bg-soft)',
    color: ativo ? 'white' : 'var(--muted)',
    flexShrink: 0,
  };
}
