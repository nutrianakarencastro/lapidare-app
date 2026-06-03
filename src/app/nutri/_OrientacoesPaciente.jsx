import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

const STATUS_CFG = {
  nao_visualizada: { label: 'Não visualizou', bg: '#f3f4f6', color: '#6b7280' },
  visualizada:     { label: 'Visualizou',     bg: '#dbeafe', color: '#1d4ed8' },
  concluida:       { label: 'Concluiu',        bg: '#dcfce7', color: '#166534' },
};

export default function OrientacoesPaciente({ pacienteId, nutriId, pacienteNome }) {
  const [atribuicoes, setAtribuicoes] = useState(null);
  const [biblioteca,  setBiblioteca]  = useState([]);
  const [busca,       setBusca]       = useState('');
  const [salvando,    setSalvando]    = useState(false);

  async function carregar() {
    const [atRes, bibRes] = await Promise.all([
      supabase
        .from('orientacoes_pacientes')
        .select('id, status, atribuido_em, orientacoes(id, titulo, categoria, subcategoria, pdf_path, video_url, audio_path, tags)')
        .eq('paciente_id', pacienteId)
        .eq('nutri_id', nutriId)
        .order('atribuido_em', { ascending: false }),
      supabase
        .from('orientacoes')
        .select('id, titulo, categoria, subcategoria, pdf_path, video_url, audio_path, tags')
        .eq('nutri_id', nutriId)
        .eq('ativo', true)
        .order('created_at', { ascending: false }),
    ]);
    setAtribuicoes(atRes.data ?? []);
    setBiblioteca(bibRes.data ?? []);
  }

  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  async function remover(atribuicaoId, titulo) {
    if (!window.confirm(`Remover "${titulo}" de ${pacienteNome.split(' ')[0]}?`)) return;
    await supabase.from('orientacoes_pacientes').delete().eq('id', atribuicaoId);
    setAtribuicoes(prev => prev.filter(a => a.id !== atribuicaoId));
  }

  async function atribuir(orientacaoId) {
    setSalvando(true);
    await supabase.from('orientacoes_pacientes').insert({
      orientacao_id: orientacaoId,
      paciente_id:   pacienteId,
      nutri_id:      nutriId,
    });
    setSalvando(false);
    carregar();
  }

  if (atribuicoes === null)
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;

  const atribuidasIds = new Set(atribuicoes.map(a => a.orientacoes?.id).filter(Boolean));

  const disponiveis = biblioteca.filter(o => {
    if (atribuidasIds.has(o.id)) return false;
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return (o.titulo ?? '').toLowerCase().includes(q)
      || (o.categoria ?? '').toLowerCase().includes(q);
  });

  return (
    <>
      {/* ── Atribuídas ── */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
        <div className="card-title">
          Orientações de {pacienteNome.split(' ')[0]}
        </div>
        <div className="card-sub" style={{ marginBottom: 14 }}>
          Conteúdo atribuído — veja o status de visualização de cada item
        </div>

        {atribuicoes.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)', padding: '12px 0' }}>
            Nenhuma orientação atribuída ainda. Selecione da biblioteca abaixo.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {atribuicoes.map(at => {
              const o   = at.orientacoes;
              if (!o) return null;
              const cfg = STATUS_CFG[at.status] ?? STATUS_CFG.nao_visualizada;
              return (
                <div key={at.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: '0.5px solid var(--border)', background: 'var(--white)',
                }}>
                  <i className="ti ti-notebook"
                    style={{ fontSize: 18, color: 'var(--text3)', flexShrink: 0 }}
                    aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)', marginBottom: 2 }}>
                      {o.titulo}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      {(o.categoria || o.subcategoria) && (
                        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
                          {[o.categoria, o.subcategoria].filter(Boolean).join(' › ')}
                        </span>
                      )}
                      {o.pdf_path   && <span style={{ fontSize: 10, color: '#e05252' }}>📄</span>}
                      {o.video_url  && <span style={{ fontSize: 10 }}>🎥</span>}
                      {o.audio_path && <span style={{ fontSize: 10 }}>🎙️</span>}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, padding: '3px 8px', borderRadius: 99,
                    background: cfg.bg, color: cfg.color, fontWeight: 500,
                    flexShrink: 0, whiteSpace: 'nowrap',
                  }}>{cfg.label}</span>
                  <button
                    onClick={() => remover(at.id, o.titulo)}
                    title="Remover atribuição"
                    style={{
                      background: 'none', border: '0.5px solid var(--red)',
                      borderRadius: 6, padding: '3px 7px',
                      color: 'var(--red)', cursor: 'pointer', flexShrink: 0,
                    }}>
                    <i className="ti ti-x" style={{ fontSize: 12 }} aria-hidden="true" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Biblioteca — disponíveis para atribuir ── */}
      <div className="card" style={{ padding: '16px 18px' }}>
        <div className="card-title">Biblioteca</div>
        <div className="card-sub" style={{ marginBottom: 12 }}>
          Orientações disponíveis para atribuir a {pacienteNome.split(' ')[0]}
        </div>

        {biblioteca.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Sua biblioteca está vazia. Crie orientações no menu <strong>Biblioteca → Orientações</strong>.
          </div>
        ) : (
          <>
            <input
              className="input-field"
              placeholder="Buscar orientação…"
              value={busca}
              onChange={e => setBusca(e.target.value)}
              style={{ marginBottom: 10 }}
            />

            {disponiveis.length === 0 && busca.trim() && (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Nenhuma orientação encontrada com esse filtro.
              </div>
            )}

            {disponiveis.length === 0 && !busca.trim() && biblioteca.length > 0 && (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                Todas as orientações já foram atribuídas a {pacienteNome.split(' ')[0]}.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {disponiveis.map(o => (
                <div key={o.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: '0.5px solid var(--border)', background: 'var(--bg2)',
                }}>
                  <i className="ti ti-notebook"
                    style={{ fontSize: 16, color: 'var(--text3)', flexShrink: 0 }}
                    aria-hidden="true" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)' }}>
                      {o.titulo}
                    </div>
                    {(o.categoria || o.subcategoria) && (
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {[o.categoria, o.subcategoria].filter(Boolean).join(' › ')}
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4, fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                    {o.pdf_path   && <span>📄</span>}
                    {o.video_url  && <span>🎥</span>}
                    {o.audio_path && <span>🎙️</span>}
                  </div>
                  <button
                    className="btn"
                    onClick={() => atribuir(o.id)}
                    disabled={salvando}
                    style={{ fontSize: 12, padding: '4px 12px', flexShrink: 0 }}>
                    Atribuir
                  </button>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
