import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';

// Limpa o nome do item: tira quantidade (após "—" ou "-") e parênteses.
// Retorna null se for um item de substituição (deve ser filtrado).
function limparItem(raw) {
  if (!raw || typeof raw !== 'string') return null;
  // Filtra substitutos: "(substituição de ...)", "(substitui ...)"
  if (/\(\s*substitui/i.test(raw)) return null;
  // Quebra na primeira ocorrência de " — ", " – " ou " - "
  let s = raw.split(/\s+[—–-]\s+/)[0];
  // Remove qualquer texto entre parênteses
  s = s.replace(/\s*\([^)]*\)/g, '');
  s = s.trim();
  return s || null;
}

// Aplica limparItem em toda a lista e remove itens vazios/substitutos.
// Também dedupe dentro da mesma categoria (case-insensitive).
function limparLista(compras) {
  if (!compras?.lista) return compras;
  const novasCategorias = compras.lista
    .map(cat => {
      const vistos = new Set();
      const itensLimpos = (cat.itens ?? [])
        .map(limparItem)
        .filter(Boolean)
        .filter(nome => {
          const k = nome.toLowerCase();
          if (vistos.has(k)) return false;
          vistos.add(k);
          return true;
        });
      return { ...cat, itens: itensLimpos };
    })
    .filter(cat => cat.itens.length > 0);
  return { ...compras, lista: novasCategorias };
}

export default function Compras() {
  const { user } = useSession();
  const [compras, setCompras] = useState(undefined);
  const [marcados, setMarcados] = useState({});
  const [pdfPath, setPdfPath] = useState(null);
  const [pdfAtualizadoEm, setPdfAtualizadoEm] = useState(null);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) return;
      const { data } = await supabase
        .from('listas_compras')
        .select('dados, publicado_em, pdf_path, pdf_nome, pdf_atualizado_em')
        .eq('paciente_id', user.id)
        .order('publicado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!active) return;
      setCompras(data?.dados ?? null);
      setPdfPath(data?.pdf_path ?? null);
      setPdfAtualizadoEm(data?.pdf_atualizado_em ?? null);
    }
    load();
    return () => { active = false; };
  }, [user]);

  async function abrirPdf() {
    // Segurança: path deve pertencer ao próprio paciente
    if (!pdfPath?.startsWith(user.id + '/')) return;
    const { data: signed, error } = await supabase.storage
      .from('planos').createSignedUrl(pdfPath, 120);
    if (error || !signed?.signedUrl) return;
    // Abertura mobile-friendly (evita bloqueio de popup em iOS/Android)
    const a = document.createElement('a');
    a.href = signed.signedUrl;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // Lista limpa: sem quantidades, sem substitutos, sem duplicados.
  const comprasLimpas = useMemo(() => compras ? limparLista(compras) : compras, [compras]);

  if (compras === undefined) {
    return <div className="empty-state"><div className="empty-sub">Carregando…</div></div>;
  }

  // Sem dados e sem PDF: estado realmente vazio
  if (!compras && !pdfPath) {
    return (
      <div className="empty-state">
        <i className="ti ti-shopping-cart empty-icon" aria-hidden="true"></i>
        <div className="empty-title">Lista não enviada ainda</div>
        <div className="empty-sub">
          Sua nutricionista enviará a lista de compras junto com o plano alimentar.
        </div>
      </div>
    );
  }

  const totalItens = comprasLimpas?.lista?.reduce((a, c) => a + (c.itens?.length ?? 0), 0) ?? 0;
  const totalMarcados = Object.values(marcados).filter(Boolean).length;

  const toggle = (key) => setMarcados(m => ({ ...m, [key]: !m[key] }));

  return (
    <>
      {/* Botão de PDF da lista */}
      {pdfPath && (
        <div onClick={abrirPdf} style={{
          margin: '0 16px 12px', padding: '12px 14px',
          background: 'var(--white)', border: '0.5px solid var(--hair)',
          borderRadius: 12, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <i className="ti ti-file-type-pdf" style={{ fontSize: 20, color: '#e05252', flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
              Abrir Lista de Compras
            </div>
            {pdfAtualizadoEm && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Atualizado em {dataBR(pdfAtualizadoEm)}
              </div>
            )}
          </div>
          <i className="ti ti-external-link" style={{ fontSize: 15, color: 'var(--muted)', flexShrink: 0 }} aria-hidden="true" />
        </div>
      )}

      {/* Progresso e lista — só quando há dados estruturados */}
      {comprasLimpas && (
        <>
          <div className="card" style={{ padding: '14px 16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>
                Progresso
              </span>
              <span className="pill ghost">{totalMarcados}/{totalItens} itens</span>
            </div>
            <div className="bar">
              <i style={{ width: `${totalItens > 0 ? (totalMarcados / totalItens) * 100 : 0}%`, background: 'var(--green)' }}></i>
            </div>
          </div>

          {comprasLimpas.lista?.map((cat, ci) => (
            <div key={ci} className="card" style={{ padding: '12px 16px' }}>
              <div style={{
                fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
                color: 'var(--gold-deep)', fontWeight: 500, marginBottom: 8,
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                {cat.emoji && <span>{cat.emoji}</span>}
                <span>{cat.categoria}</span>
                <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--muted)' }}>{cat.itens?.length ?? 0} itens</span>
              </div>
              {cat.itens?.map((item, ii) => {
                const key = `${ci}-${ii}`;
                const done = !!marcados[key];
                return (
                  <div key={ii} className={`compra-item ${done ? 'done' : ''}`} onClick={() => toggle(key)}>
                    <button className={`check ${done ? 'done' : ''}`}
                      onClick={(e) => { e.stopPropagation(); toggle(key); }}
                      aria-label={done ? 'Desmarcar' : 'Marcar'}>
                      <i className="ti ti-check"></i>
                    </button>
                    <span className="compra-nome">{item}</span>
                  </div>
                );
              })}
            </div>
          ))}

          {totalMarcados === totalItens && totalItens > 0 && (
            <div style={{ margin: '0 16px 16px', textAlign: 'center', padding: 16, background: 'var(--green-soft)', borderRadius: 12 }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>🎉</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)' }}>Lista completa!</div>
            </div>
          )}
        </>
      )}
    </>
  );
}
