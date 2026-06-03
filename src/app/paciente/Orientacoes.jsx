import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';

const STATUS_CFG = {
  nao_visualizada: { label: 'Novo',      bg: 'var(--gold)',              color: 'var(--ink)'   },
  visualizada:     { label: 'Visto',     bg: 'var(--bg-soft, #f3f4f6)', color: 'var(--muted)' },
  concluida:       { label: 'Concluído', bg: '#dcfce7',                  color: '#166534'      },
};

export default function OrientacoesPaciente() {
  const { user } = useSession();
  const [atribuicoes, setAtribuicoes] = useState(null);   // null = carregando
  const [erroQuery,   setErroQuery]   = useState(null);
  const [abertaId,    setAbertaId]    = useState(null);
  const [pdfUrls,     setPdfUrls]     = useState({});
  const [audioUrls,   setAudioUrls]   = useState({});
  const [thumbUrls,   setThumbUrls]   = useState({});

  async function carregar() {
    if (!user) return;
    setErroQuery(null);

    const { data: rows, error: rpcError } = await supabase
      .rpc('get_orientacoes_da_paciente');

    if (rpcError) {
      setErroQuery(rpcError.message);
      setAtribuicoes([]);
      return;
    }

    const lista = (rows ?? []).map(r => {
      if (!r.atribuicao_id) return null;
      return {
        id:                     r.atribuicao_id,
        status:                 r.status,
        visto_pela_paciente_em: r.visto_pela_paciente_em,
        atribuido_em:           r.atribuido_em,
        orientacao_id:          r.orientacao_id,
        orientacao: r.orientacao_id ? {
          id:             r.orientacao_id,
          titulo:         r.titulo         ?? null,
          descricao:      r.descricao      ?? null,
          categoria:      r.categoria      ?? null,
          subcategoria:   r.subcategoria   ?? null,
          tags:           Array.isArray(r.tags) ? r.tags : [],
          thumbnail_path: r.thumbnail_path ?? null,
          thumbnail_nome: r.thumbnail_nome ?? null,
          pdf_path:       r.pdf_path       ?? null,
          pdf_nome:       r.pdf_nome       ?? null,
          video_url:      r.video_url      ?? null,
          audio_path:     r.audio_path     ?? null,
          audio_nome:     r.audio_nome     ?? null,
        } : null,
      };
    }).filter(Boolean);

    setAtribuicoes(lista);

    // Signed URLs para thumbnails (batch)
    const thumbPaths = lista
      .filter(a => a.orientacao?.thumbnail_path)
      .map(a => a.orientacao.thumbnail_path);

    if (thumbPaths.length > 0) {
      const { data: signed } = await supabase.storage
        .from('orientacoes').createSignedUrls(thumbPaths, 300);
      const map = {};
      for (const s of signed ?? []) {
        const a = lista.find(x => x.orientacao?.thumbnail_path === s.path);
        if (a && s.signedUrl) map[a.id] = s.signedUrl;
      }
      setThumbUrls(map);
    }
  }

  useEffect(() => { carregar(); }, [user]);

  async function abrirFechar(at) {
    const novaAberta = abertaId === at.id ? null : at.id;
    setAbertaId(novaAberta);
    if (!novaAberta) return;

    // Marcar como visualizada via RPC
    if (at.status === 'nao_visualizada') {
      await supabase.rpc('marcar_orientacao_vista', { p_atribuicao_id: at.id });
      setAtribuicoes(prev => prev.map(a =>
        a.id === at.id
          ? { ...a, status: 'visualizada', visto_pela_paciente_em: new Date().toISOString() }
          : a
      ));
    }

    const o = at.orientacao;
    if (!o) return;

    if (o.pdf_path && !pdfUrls[at.id]) {
      const { data } = await supabase.storage
        .from('orientacoes').createSignedUrl(o.pdf_path, 300);
      if (data?.signedUrl) setPdfUrls(prev => ({ ...prev, [at.id]: data.signedUrl }));
    }

    if (o.audio_path && !audioUrls[at.id]) {
      const { data } = await supabase.storage
        .from('orientacoes').createSignedUrl(o.audio_path, 300);
      if (data?.signedUrl) setAudioUrls(prev => ({ ...prev, [at.id]: data.signedUrl }));
    }
  }

  async function toggleConcluida(at) {
    const novaConcluida = at.status !== 'concluida';
    setAtribuicoes(prev => prev.map(a =>
      a.id === at.id ? { ...a, status: novaConcluida ? 'concluida' : 'visualizada' } : a
    ));
    await supabase.rpc('marcar_orientacao_concluida', {
      p_atribuicao_id: at.id,
      p_concluida:     novaConcluida,
    });
  }

  // ── Estados da tela ──────────────────────────────────────────

  if (atribuicoes === null)
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;

  if (erroQuery)
    return (
      <div className="card empty-card">
        <i className="ti ti-alert-circle empty-icon" style={{ color: 'var(--red)' }} aria-hidden="true" />
        <div className="empty-title">Não foi possível carregar</div>
        <div className="empty-sub">{erroQuery}</div>
        <button className="btn" onClick={carregar} style={{ marginTop: 12 }}>Tentar novamente</button>
      </div>
    );

  if (atribuicoes.length === 0)
    return (
      <div className="card empty-card">
        <i className="ti ti-notebook empty-icon" aria-hidden="true" />
        <div className="empty-title">Nenhuma orientação ainda</div>
        <div className="empty-sub">Sua nutricionista enviará orientações personalizadas para você aqui.</div>
      </div>
    );

  // ── Lista ────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
      {atribuicoes.map(at => {
        const o = at.orientacao;

        if (!o) return (
          <div key={at.id} style={{
            border: '0.5px solid var(--hair)', borderRadius: 14,
            padding: '14px', fontSize: 13, color: 'var(--muted)',
          }}>
            Conteúdo indisponível no momento.
          </div>
        );

        const isAberta = abertaId === at.id;
        const isNova   = at.status === 'nao_visualizada';
        const cfg      = STATUS_CFG[at.status] ?? STATUS_CFG.visualizada;
        const tags     = Array.isArray(o.tags) ? o.tags : [];

        return (
          <div key={at.id} style={{
            border: `0.5px solid ${isNova ? 'var(--gold)' : isAberta ? 'var(--dark)' : 'var(--hair)'}`,
            borderRadius: 14, overflow: 'hidden',
            background: isNova
              ? 'linear-gradient(135deg, var(--gold-soft, #fffbeb), var(--white))'
              : 'var(--white)',
          }}>

            {/* ── Header clicável ── */}
            <button onClick={() => abrirFechar(at)}
              style={{
                display: 'flex', gap: 12, padding: '14px',
                background: 'none', border: 'none', cursor: 'pointer',
                width: '100%', textAlign: 'left', fontFamily: 'var(--font-sans)',
                alignItems: 'flex-start',
              }}>

              {/* Thumbnail */}
              <div style={{
                width: 52, height: 52, borderRadius: 10, flexShrink: 0,
                overflow: 'hidden', background: 'var(--bg-soft)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {thumbUrls[at.id]
                  ? <img src={thumbUrls[at.id]} alt=""
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <i className="ti ti-notebook"
                      style={{ fontSize: 22, color: 'var(--muted)' }} aria-hidden="true" />
                }
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 3 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', lineHeight: 1.2 }}>
                    {o.titulo ?? 'Sem título'}
                  </span>
                  {isNova && (
                    <span style={{
                      fontSize: 9, padding: '2px 7px', borderRadius: 99,
                      background: 'var(--gold)', color: 'var(--ink)',
                      fontWeight: 700, letterSpacing: '.06em',
                    }}>NOVO</span>
                  )}
                </div>

                {(o.categoria || o.subcategoria) && (
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 5 }}>
                    {[o.categoria, o.subcategoria].filter(Boolean).join(' › ')}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  {o.pdf_path   && <span style={{ fontSize: 10, color: '#e05252' }}>📄 PDF</span>}
                  {o.video_url  && <span style={{ fontSize: 10, color: 'var(--muted)' }}>🎥 Vídeo</span>}
                  {o.audio_path && <span style={{ fontSize: 10, color: 'var(--muted)' }}>🎙️ Podcast</span>}
                  <span style={{
                    marginLeft: 'auto', fontSize: 10, padding: '2px 8px', borderRadius: 99,
                    background: cfg.bg, color: cfg.color, fontWeight: 600,
                  }}>{cfg.label}</span>
                </div>
              </div>

              <i className={`ti ti-chevron-${isAberta ? 'up' : 'down'}`}
                style={{ fontSize: 16, color: 'var(--muted)', flexShrink: 0, marginTop: 4 }}
                aria-hidden="true" />
            </button>

            {/* ── Conteúdo expandido ── */}
            {isAberta && (
              <div style={{ borderTop: '0.5px solid var(--hair)', padding: '14px 14px 16px' }}>

                {o.descricao && (
                  <p style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55, margin: '0 0 14px' }}>
                    {o.descricao}
                  </p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                  {/* PDF */}
                  {o.pdf_path && (
                    pdfUrls[at.id] ? (
                      <a href={pdfUrls[at.id]} target="_blank" rel="noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 10,
                          background: '#fff5f5', border: '0.5px solid #f5c0c0',
                          textDecoration: 'none',
                        }}>
                        <i className="ti ti-file-type-pdf"
                           style={{ fontSize: 22, color: '#e05252', flexShrink: 0 }} aria-hidden="true" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                            {o.pdf_nome || 'Abrir PDF'}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>Toque para abrir</div>
                        </div>
                        <i className="ti ti-external-link"
                           style={{ fontSize: 14, color: 'var(--muted)', flexShrink: 0 }} aria-hidden="true" />
                      </a>
                    ) : (
                      <div style={{ padding: '8px 12px', borderRadius: 10,
                        background: 'var(--bg-soft)', fontSize: 12, color: 'var(--muted)' }}>
                        Carregando PDF…
                      </div>
                    )
                  )}

                  {/* Vídeo */}
                  {o.video_url && (
                    <a href={o.video_url} target="_blank" rel="noreferrer"
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 10,
                        background: '#f0f9ff', border: '0.5px solid #bae6fd',
                        textDecoration: 'none',
                      }}>
                      <i className="ti ti-brand-youtube"
                         style={{ fontSize: 22, color: '#e52c2c', flexShrink: 0 }} aria-hidden="true" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                          Assistir ao vídeo
                        </div>
                        <div style={{
                          fontSize: 10, color: 'var(--muted)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{o.video_url}</div>
                      </div>
                      <i className="ti ti-external-link"
                         style={{ fontSize: 14, color: 'var(--muted)', flexShrink: 0 }} aria-hidden="true" />
                    </a>
                  )}

                  {/* Áudio */}
                  {o.audio_path && (
                    audioUrls[at.id] ? (
                      <div style={{
                        padding: '10px 12px', borderRadius: 10,
                        background: '#f5f3ff', border: '0.5px solid #ddd6fe',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                          <i className="ti ti-microphone"
                             style={{ fontSize: 18, color: '#7c3aed' }} aria-hidden="true" />
                          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--ink)' }}>
                            {o.audio_nome || 'Podcast / Áudio'}
                          </span>
                        </div>
                        <audio controls style={{ width: '100%' }} src={audioUrls[at.id]}>
                          Seu navegador não suporta áudio.
                        </audio>
                      </div>
                    ) : (
                      <div style={{ padding: '8px 12px', borderRadius: 10,
                        background: 'var(--bg-soft)', fontSize: 12, color: 'var(--muted)' }}>
                        Carregando áudio…
                      </div>
                    )
                  )}
                </div>

                {/* Tags */}
                {tags.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 14 }}>
                    {tags.map(tag => (
                      <span key={tag} style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 99,
                        background: 'var(--bg-soft)', color: 'var(--muted)',
                        border: '0.5px solid var(--hair)',
                      }}>{tag}</span>
                    ))}
                  </div>
                )}

                {/* Botão concluída */}
                <button onClick={() => toggleConcluida(at)}
                  style={{
                    marginTop: 14, width: '100%', padding: '10px 0',
                    borderRadius: 10, cursor: 'pointer',
                    border: `0.5px solid ${at.status === 'concluida' ? '#166534' : 'var(--hair)'}`,
                    background: at.status === 'concluida' ? '#f0fdf4' : 'var(--bg-soft)',
                    color: at.status === 'concluida' ? '#166534' : 'var(--muted)',
                    fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}>
                  <i className={`ti ti-${at.status === 'concluida' ? 'check' : 'circle-check'}`}
                     aria-hidden="true" />
                  {at.status === 'concluida' ? 'Concluído' : 'Marcar como concluído'}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
