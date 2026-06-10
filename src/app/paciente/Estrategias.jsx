import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { podeAcessar } from '../../lib/modelos.js';
import BloqueioModelo from '../../components/BloqueioModelo.jsx';
import { dataBR } from '../../lib/utils.js';

function labelFreq(tipo, valor) {
  if (tipo === 'diaria')        return 'Todo dia';
  if (tipo === 'dias_uteis')    return 'Dias úteis';
  if (tipo === 'semanal')       return valor ? `${valor}× por semana` : 'Semanal';
  if (tipo === 'personalizada') return valor || 'Conforme combinado';
  return '';
}

function periodo(e) {
  if (!e.data_inicio) return '';
  const inicio = dataBR(e.data_inicio);
  return e.data_fim ? `${inicio} até ${dataBR(e.data_fim)}` : `A partir de ${inicio}`;
}

function labelAconteceu(v) {
  return { sim: 'Sim', parcialmente: 'Parcialmente', nao: 'Não aconteceu' }[v] ?? v;
}

function labelDificuldade(v) {
  return { facil: 'Fácil', desafiador: 'Desafiador', muito_dificil: 'Muito difícil' }[v] ?? '—';
}

const HOJE = new Date().toISOString().slice(0, 10);

const ACONTECEU_OPTS = [
  { v: 'sim',          label: 'Sim',           color: 'var(--green)',  bg: 'var(--green-bg)'  },
  { v: 'parcialmente', label: 'Parcialmente',   color: 'var(--orange)', bg: 'var(--orange-bg)' },
  { v: 'nao',          label: 'Não aconteceu',  color: 'var(--text3)', bg: 'var(--bg2)'       },
];

const DIFICULDADE_OPTS = [
  { v: 'facil',         label: 'Fácil'         },
  { v: 'desafiador',    label: 'Desafiador'     },
  { v: 'muito_dificil', label: 'Muito difícil'  },
];

export default function Estrategias() {
  const { user, profile } = useSession();
  const pacienteId = profile?.id;

  const [ativas,     setAtivas]     = useState(null);
  const [historico,  setHistorico]  = useState([]);
  const [logs,       setLogs]       = useState({});
  const [rascunhos,  setRascunhos]  = useState({});
  const [salvando,   setSalvando]   = useState({});
  const [feedback,   setFeedback]   = useState({});
  const [histAberto, setHistAberto] = useState({});

  async function carregar() {
    if (!user) return;

    const { data: estrategiasData } = await supabase
      .from('estrategias')
      .select('id, titulo, objetivo, categoria, frequencia_tipo, frequencia_valor, data_inicio, data_fim, mensagem_paciente, status')
      .eq('paciente_id', pacienteId)
      .order('created_at', { ascending: false });

    const lista = estrategiasData ?? [];
    const ativasLista    = lista.filter(e => e.status === 'ativa');
    const encerradasLista = lista.filter(e => e.status === 'encerrada');
    setAtivas(ativasLista);
    setHistorico(encerradasLista);

    if (lista.length === 0) return;

    const ids = lista.map(e => e.id);
    const { data: logsData } = await supabase
      .from('estrategia_logs')
      .select('*')
      .in('estrategia_id', ids)
      .order('data', { ascending: false });

    const logMap = {};
    for (const l of (logsData ?? [])) {
      if (!logMap[l.estrategia_id]) logMap[l.estrategia_id] = [];
      logMap[l.estrategia_id].push(l);
    }
    setLogs(logMap);

    // Pré-preenche rascunho com log de hoje se já existir
    const novosRascunhos = {};
    for (const e of ativasLista) {
      const logHoje = (logMap[e.id] ?? []).find(l => l.data === HOJE);
      novosRascunhos[e.id] = logHoje
        ? { aconteceu: logHoje.aconteceu, dificuldade: logHoje.dificuldade ?? '', obs: logHoje.observacoes ?? '' }
        : { aconteceu: '', dificuldade: '', obs: '' };
    }
    setRascunhos(novosRascunhos);
  }

  useEffect(() => { carregar(); }, [user]);

  function setR(estrategiaId, campo, valor) {
    setRascunhos(s => ({ ...s, [estrategiaId]: { ...(s[estrategiaId] ?? {}), [campo]: valor } }));
  }

  async function registrar(estrategiaId) {
    const r = rascunhos[estrategiaId];
    if (!r?.aconteceu) return;
    setSalvando(s => ({ ...s, [estrategiaId]: true }));
    await supabase.rpc('paciente_registrar_estrategia', {
      p_estrategia_id: estrategiaId,
      p_aconteceu:     r.aconteceu,
      p_dificuldade:   r.dificuldade || null,
      p_observacoes:   r.obs?.trim() || null,
    });
    setSalvando(s => ({ ...s, [estrategiaId]: false }));
    setFeedback(s => ({ ...s, [estrategiaId]: 'Registrado!' }));
    setTimeout(() => setFeedback(s => ({ ...s, [estrategiaId]: null })), 2500);
    carregar();
  }

  if (ativas === null) {
    return (
      <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Carregando…
      </div>
    );
  }

  if (!podeAcessar(profile?.acesso_utera, 'estrategias')) {
    return <BloqueioModelo modulo="Estratégias Terapêuticas" tierMinimo={3} />;
  }

  return (
    <div>
      {/* Estratégias ativas */}
      {ativas.length === 0 ? (
        <div className="card" style={{ padding: 28, textAlign: 'center' }}>
          <i className="ti ti-flask" style={{ fontSize: 32, color: 'var(--text4)', display: 'block', marginBottom: 10 }} aria-hidden="true"></i>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dark)', marginBottom: 6 }}>
            Nenhuma estratégia ativa
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            Quando sua nutri propor um experimento clínico, ele aparece aqui para você registrar como está sendo.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {ativas.map(e => {
            const r = rascunhos[e.id] ?? {};
            const logHoje = (logs[e.id] ?? []).find(l => l.data === HOJE);
            const jaRegistrou = !!logHoje;
            const totalLogs = logs[e.id]?.length ?? 0;

            return (
              <div key={e.id} className="card" style={{ padding: 18 }}>
                {e.categoria && (
                  <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--blue)', marginBottom: 4 }}>
                    {e.categoria}
                  </div>
                )}
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>{e.titulo}</div>
                {e.objetivo && (
                  <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 4 }}>{e.objetivo}</div>
                )}
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
                  {[labelFreq(e.frequencia_tipo, e.frequencia_valor), periodo(e)].filter(Boolean).join(' · ')}
                </div>

                {e.mensagem_paciente && (
                  <div style={{
                    fontSize: 13, color: 'var(--text2)', padding: '10px 14px',
                    background: 'var(--bg2)', borderRadius: 8, marginBottom: 16,
                    lineHeight: 1.6,
                  }}>
                    {e.mensagem_paciente}
                  </div>
                )}

                {/* Registro do dia */}
                <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 14 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--dark)', marginBottom: 10 }}>
                    {jaRegistrou ? 'Registro de hoje — editar' : 'Hoje isso aconteceu?'}
                  </div>

                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {ACONTECEU_OPTS.map(opt => (
                      <button
                        key={opt.v}
                        onClick={() => setR(e.id, 'aconteceu', opt.v)}
                        style={{
                          padding: '7px 14px', borderRadius: 999, fontSize: 12, cursor: 'pointer',
                          border: r.aconteceu === opt.v ? `1.5px solid ${opt.color}` : '0.5px solid var(--border)',
                          background: r.aconteceu === opt.v ? opt.bg : 'transparent',
                          color: r.aconteceu === opt.v ? opt.color : 'var(--text3)',
                          fontWeight: r.aconteceu === opt.v ? 600 : 400,
                          transition: 'all .1s',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>

                  {r.aconteceu && r.aconteceu !== 'nao' && (
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Como foi pra você?</div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {DIFICULDADE_OPTS.map(opt => (
                          <button
                            key={opt.v}
                            onClick={() => setR(e.id, 'dificuldade', r.dificuldade === opt.v ? '' : opt.v)}
                            style={{
                              padding: '5px 12px', borderRadius: 999, fontSize: 11, cursor: 'pointer',
                              border: r.dificuldade === opt.v ? '1.5px solid var(--blue)' : '0.5px solid var(--border)',
                              background: r.dificuldade === opt.v ? 'var(--blue-bg)' : 'transparent',
                              color: r.dificuldade === opt.v ? 'var(--blue)' : 'var(--text3)',
                            }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {r.aconteceu && (
                    <>
                      <textarea
                        value={r.obs ?? ''}
                        onChange={ev => setR(e.id, 'obs', ev.target.value)}
                        rows={2}
                        placeholder="Algo que queira anotar? (opcional)"
                        style={{
                          width: '100%', resize: 'none', boxSizing: 'border-box',
                          fontSize: 12, padding: '8px 10px', borderRadius: 8,
                          border: '0.5px solid var(--border)', fontFamily: 'var(--font-sans)',
                          outline: 'none', marginBottom: 10,
                        }}
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button
                          className="btn"
                          style={{ fontSize: 12, padding: '7px 18px' }}
                          onClick={() => registrar(e.id)}
                          disabled={salvando[e.id]}
                        >
                          {salvando[e.id] ? 'Salvando…' : jaRegistrou ? 'Atualizar' : 'Registrar'}
                        </button>
                        {feedback[e.id] && (
                          <span style={{ fontSize: 12, color: 'var(--green)' }}>
                            <i className="ti ti-check" aria-hidden="true"></i> {feedback[e.id]}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {/* Histórico desta estratégia */}
                {totalLogs > 0 && (
                  <div style={{ marginTop: 14 }}>
                    <button
                      onClick={() => setHistAberto(s => ({ ...s, [e.id]: !s[e.id] }))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--text3)', padding: 0 }}
                    >
                      <i className={`ti ti-chevron-${histAberto[e.id] ? 'up' : 'down'}`} aria-hidden="true"></i>
                      {histAberto[e.id] ? ' Ocultar histórico' : ` Ver histórico (${totalLogs} registro${totalLogs === 1 ? '' : 's'})`}
                    </button>
                    {histAberto[e.id] && (
                      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {(logs[e.id] ?? []).map(l => (
                          <div key={l.id} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'center', padding: '6px 0', borderBottom: '0.5px solid var(--border)' }}>
                            <div style={{ width: 72, flexShrink: 0, color: 'var(--text3)', fontSize: 11 }}>{dataBR(l.data)}</div>
                            <span style={{
                              fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 999, flexShrink: 0,
                              background: l.aconteceu === 'sim' ? 'var(--green-bg)' : l.aconteceu === 'parcialmente' ? 'var(--orange-bg)' : 'var(--bg2)',
                              color:      l.aconteceu === 'sim' ? 'var(--green)'   : l.aconteceu === 'parcialmente' ? 'var(--orange)'    : 'var(--text3)',
                            }}>{labelAconteceu(l.aconteceu)}</span>
                            {l.dificuldade && <span style={{ color: 'var(--text3)', fontSize: 11 }}>{labelDificuldade(l.dificuldade)}</span>}
                            {l.observacoes && (
                              <span style={{ color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {l.observacoes}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Experimentos anteriores (encerradas) */}
      {historico.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <div className="section-label" style={{ marginBottom: 10 }}>Experimentos anteriores</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historico.map(e => {
              const totalLogs = logs[e.id]?.length ?? 0;
              return (
                <div key={e.id} className="card" style={{ padding: 14, opacity: 0.82 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      {e.categoria && (
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: 2 }}>
                          {e.categoria}
                        </div>
                      )}
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--dark)' }}>{e.titulo}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                        {periodo(e)}{totalLogs > 0 ? ` · ${totalLogs} registro${totalLogs === 1 ? '' : 's'}` : ''}
                      </div>
                    </div>
                    {totalLogs > 0 && (
                      <button
                        onClick={() => setHistAberto(s => ({ ...s, [e.id]: !s[e.id] }))}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}
                      >
                        {histAberto[e.id] ? 'Ocultar' : 'Ver'}
                      </button>
                    )}
                  </div>

                  {/* Mensagem observacional — Sprint 23.2 */}
                  {totalLogs > 0 && (
                    <div style={{
                      marginTop: 10, padding: '10px 12px',
                      background: 'var(--bg2)', borderRadius: 8,
                      fontSize: 12, color: 'var(--text2)', lineHeight: 1.6,
                    }}>
                      Seus registros mostraram algumas mudanças durante este período. Converse com sua nutri sobre o significado desses dados no seu contexto.
                    </div>
                  )}

                  {histAberto[e.id] && (
                    <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 1 }}>
                      {(logs[e.id] ?? []).map(l => (
                        <div key={l.id} style={{ display: 'flex', gap: 8, fontSize: 11, alignItems: 'center', padding: '5px 0', borderBottom: '0.5px solid var(--border)' }}>
                          <div style={{ width: 72, flexShrink: 0, color: 'var(--text3)' }}>{dataBR(l.data)}</div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 7px', borderRadius: 999, flexShrink: 0,
                            background: l.aconteceu === 'sim' ? 'var(--green-bg)' : l.aconteceu === 'parcialmente' ? 'var(--orange-bg)' : 'var(--bg2)',
                            color:      l.aconteceu === 'sim' ? 'var(--green)'   : l.aconteceu === 'parcialmente' ? 'var(--orange)'    : 'var(--text3)',
                          }}>{labelAconteceu(l.aconteceu)}</span>
                          {l.observacoes && <span style={{ color: 'var(--text2)', flex: 1 }}>{l.observacoes}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
