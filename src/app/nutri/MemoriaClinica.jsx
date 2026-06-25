import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { PROTOCOLOS_INDEX } from '../../data/protocolos/_index.js';

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

const TITULO_PROTOCOLO = Object.fromEntries(
  PROTOCOLOS_INDEX.map(p => [p.id, p.titulo])
);

export default function MemoriaClinica() {
  const { user } = useSession();
  const [busca, setBusca]         = useState('');
  const [termo, setTermo]         = useState('');
  const [obs, setObs]             = useState([]);
  const [carregando, setCarregando] = useState(false);

  // Debounce 350ms
  useEffect(() => {
    const t = setTimeout(() => setTermo(busca.trim()), 350);
    return () => clearTimeout(t);
  }, [busca]);

  // Busca no banco
  useEffect(() => {
    if (!user?.id) return;
    let active = true;
    setCarregando(true);
    let q = supabase
      .from('protocolo_observacoes')
      .select('id, protocolo_id, categoria, origem, observacao, created_at')
      .eq('nutri_id', user.id)
      .order('created_at', { ascending: false });
    if (termo) q = q.ilike('observacao', `%${termo}%`);
    else       q = q.limit(40);
    q.then(({ data }) => {
      if (active) { setObs(data ?? []); setCarregando(false); }
    });
    return () => { active = false; };
  }, [termo, user?.id]);

  // Agrupa: protocolo_id → categoria → observações[]
  const agrupado = useMemo(() => {
    const map = {};
    for (const o of obs) {
      if (!map[o.protocolo_id]) {
        map[o.protocolo_id] = {
          titulo: TITULO_PROTOCOLO[o.protocolo_id] ?? o.protocolo_id,
          cats: {},
        };
      }
      const cats = map[o.protocolo_id].cats;
      if (!cats[o.categoria]) cats[o.categoria] = [];
      cats[o.categoria].push(o);
    }
    return map;
  }, [obs]);

  const labelCat = v => CATEGORIAS_OBS.find(c => c.v === v)?.label ?? v;
  const labelOri = v => ORIGENS_OBS.find(o => o.v === v)?.label ?? v;
  const fmtData  = iso => new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
  });

  const protocolosIds = Object.keys(agrupado);
  const total = obs.length;

  if (!user) return null;

  return (
    <>
      <div className="page-title">Memória Clínica</div>
      <div className="page-sub">Busca nas observações registradas nos protocolos</div>

      {/* Campo de busca */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <i className="ti ti-search" style={{
          position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
          fontSize: 15, color: 'var(--text3)', pointerEvents: 'none',
        }} aria-hidden="true" />
        <input
          type="search"
          placeholder="Buscar nas observações clínicas…"
          value={busca}
          onChange={e => setBusca(e.target.value)}
          style={{ paddingLeft: 34, width: '100%', boxSizing: 'border-box' }}
        />
      </div>

      {/* Contagem */}
      {!carregando && (
        <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>
          {termo
            ? `${total} resultado${total !== 1 ? 's' : ''} para "${termo}"`
            : `${total} observaç${total !== 1 ? 'ões' : 'ão'} recente${total !== 1 ? 's' : ''}`
          }
        </div>
      )}

      {/* Estado vazio */}
      {!carregando && total === 0 && (
        <div className="card" style={{ padding: '36px 20px', textAlign: 'center' }}>
          <i className="ti ti-brain" style={{
            fontSize: 34, color: 'var(--border)', display: 'block', marginBottom: 10,
          }} aria-hidden="true" />
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dark)', marginBottom: 6 }}>
            {termo ? 'Nenhuma observação encontrada' : 'Nenhuma observação registrada'}
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
            {termo
              ? 'Tente termos diferentes ou abra um protocolo para registrar novas observações.'
              : 'Abra um protocolo e registre observações clínicas para vê-las aqui.'
            }
          </div>
        </div>
      )}

      {/* Resultados agrupados por protocolo */}
      {!carregando && protocolosIds.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {protocolosIds.map(pid => {
            const grupo = agrupado[pid];
            const catEntries = Object.entries(grupo.cats);
            return (
              <div key={pid}>
                {/* Header do protocolo */}
                <div style={{
                  fontSize: 11, fontWeight: 700, letterSpacing: '.1em',
                  textTransform: 'uppercase', color: 'var(--text3)',
                  marginBottom: 8, lineHeight: 1.5,
                }}>
                  {grupo.titulo}
                </div>

                <div className="card" style={{ padding: 0 }}>
                  {catEntries.map(([cat, itens], ci) => (
                    <div key={cat}>
                      {/* Sub-header de categoria */}
                      <div style={{
                        padding: '7px 16px',
                        background: 'var(--bg2)',
                        borderBottom: '0.5px solid var(--border)',
                        ...(ci === 0 ? { borderRadius: '8px 8px 0 0' } : {}),
                        fontSize: 11, fontWeight: 600, color: 'var(--text2)',
                      }}>
                        {labelCat(cat)}
                      </div>

                      {/* Observações */}
                      {itens.map((o, oi) => {
                        const isLast = ci === catEntries.length - 1 && oi === itens.length - 1;
                        return (
                          <div key={o.id} style={{
                            padding: '12px 16px',
                            borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
                          }}>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                              <span style={{
                                fontSize: 11, padding: '2px 8px', borderRadius: 999,
                                background: 'var(--bg2)', color: 'var(--text2)',
                                border: '0.5px solid var(--border)', fontWeight: 500,
                              }}>
                                {labelOri(o.origem)}
                              </span>
                              <span style={{ fontSize: 11, color: 'var(--text3)', paddingTop: 3 }}>
                                {fmtData(o.created_at)}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
                              {termo ? highlight(o.observacao, termo) : o.observacao}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function highlight(texto, termo) {
  const escaped = termo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const partes = texto.split(new RegExp(`(${escaped})`, 'gi'));
  return partes.map((p, i) =>
    p.toLowerCase() === termo.toLowerCase()
      ? <mark key={i} style={{
          background: '#fef3c7', color: 'var(--dark)',
          borderRadius: 2, padding: '0 1px',
        }}>{p}</mark>
      : p
  );
}
