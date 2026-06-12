import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';
import { OBJETIVOS_CLINICOS } from '../../lib/suplementacaoConfig.js';

const HOJE = () => new Date().toISOString().slice(0, 10);

export default function Suplementos() {
  const { user, profile } = useSession();
  const pacienteId = profile?.id;
  const [suplementos, setSuplementos] = useState(null);
  const [logs,        setLogs]        = useState([]);
  const [pdfs,        setPdfs]        = useState([]);
  const [farmacias,   setFarmacias]   = useState([]);

  async function carregar() {
    if (!user) return;
    const [supRes, logRes, pdfRes, farmRes] = await Promise.all([
      supabase.from('suplementos').select('*')
        .eq('paciente_id', pacienteId).eq('ativo', true).order('ordem'),
      supabase.from('suplementos_logs').select('*')
        .eq('paciente_id', pacienteId)
        .gte('data', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
        .order('data', { ascending: false }),
      supabase.from('prescricoes').select('id, titulo, storage_path, created_at')
        .eq('paciente_id', pacienteId).eq('tipo', 'suplementacao')
        .order('created_at', { ascending: false }),
      supabase.from('farmacias_paciente')
        .select('id, codigo_desconto, farmacias(id, nome, telefone, link_contato, codigo_desconto, arquivo_url, observacoes)')
        .eq('paciente_id', pacienteId).order('ordem'),
    ]);
    setSuplementos(supRes.data ?? []);
    setLogs(logRes.data ?? []);
    setPdfs(pdfRes.data ?? []);
    setFarmacias(farmRes.data ?? []);
  }
  useEffect(() => { carregar(); }, [user]);

  // ── Toggle suplemento tomado (lógica original intacta) ───────────────────
  async function toggle(s) {
    const hoje = HOJE();
    const ja = logs.find(l => l.suplemento_id === s.id && l.data === hoje);
    if (ja) {
      await supabase.from('suplementos_logs').delete().eq('id', ja.id);
    } else {
      await supabase.from('suplementos_logs').insert({
        suplemento_id: s.id, paciente_id: pacienteId, data: hoje, tomado: true,
      });
    }
    carregar();
  }

  async function abrirPdf(storage_path) {
    const { data, error } = await supabase.storage.from('prescricoes').createSignedUrl(storage_path, 120);
    if (error) { alert('Não foi possível abrir: ' + error.message); return; }
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function copiarCupom(cupom) {
    try {
      await navigator.clipboard.writeText(cupom);
      alert(`Cupom "${cupom}" copiado!`);
    } catch {
      alert(`Cupom: ${cupom}`);
    }
  }

  // ── Métricas (lógica original) ───────────────────────────────────────────
  const logMap = useMemo(() => {
    const m = {};
    for (const l of logs) {
      if (!m[l.suplemento_id]) m[l.suplemento_id] = {};
      m[l.suplemento_id][l.data] = l;
    }
    return m;
  }, [logs]);

  const streak = useMemo(() => {
    if (!suplementos || suplementos.length === 0) return 0;
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const dia = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
      if (suplementos.every(s => logMap[s.id]?.[dia]?.tomado)) count++; else break;
    }
    return count;
  }, [suplementos, logMap]);

  const dias7 = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      arr.push({
        iso: d.toISOString().slice(0, 10),
        dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 1).toUpperCase(),
        num: d.getDate(),
      });
    }
    return arr;
  }, []);

  const hoje = HOJE();
  const tomadosHoje = (suplementos ?? []).filter(s => logMap[s.id]?.[hoje]?.tomado).length;
  const total = suplementos?.length ?? 0;
  const temManipulacao = pdfs.length > 0 || farmacias.length > 0;

  if (suplementos === null) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Carregando…</div>;
  }

  return (
    <div style={{ padding: '0 16px' }}>

      {/* ══ BLOCO 1: MANIPULAÇÃO ════════════════════════════════════════════ */}
      {temManipulacao && (
        <div style={{
          background: 'var(--white)', border: '0.5px solid var(--hair)',
          borderRadius: 16, padding: '14px 16px', marginBottom: 14,
        }}>
          <div style={{
            fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 600, marginBottom: 12,
          }}>
            Manipulação
          </div>

          {/* PDFs */}
          {pdfs.length > 0 && (
            <div style={{ marginBottom: farmacias.length > 0 ? 14 : 0 }}>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
                Prescrição de manipulação
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {pdfs.map(pdf => (
                  <button key={pdf.id}
                    onClick={() => abrirPdf(pdf.storage_path)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
                      cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
                      width: '100%',
                    }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                      background: 'var(--gold-soft, var(--bg-soft))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <i className="ti ti-file-text" style={{ fontSize: 18, color: 'var(--gold-deep)' }} aria-hidden="true"></i>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{pdf.titulo}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                        {dataBR(pdf.created_at)} · Toque para abrir
                      </div>
                    </div>
                    <i className="ti ti-external-link" style={{ fontSize: 14, color: 'var(--muted)', flexShrink: 0 }} aria-hidden="true"></i>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Farmácias */}
          {farmacias.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
                Farmácias parceiras
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {farmacias.map(fp => {
                  const f = fp.farmacias;
                  if (!f) return null;
                  const cupom = fp.codigo_desconto || f.codigo_desconto;
                  return (
                    <div key={fp.id} style={{
                      padding: '12px 14px', borderRadius: 12,
                      background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: cupom || f.observacoes ? 8 : 0 }}>
                        <i className="ti ti-building-store" style={{ fontSize: 16, color: 'var(--gold-deep)', flexShrink: 0 }} aria-hidden="true"></i>
                        <div style={{ flex: 1, fontWeight: 500, fontSize: 14, color: 'var(--ink)' }}>{f.nome}</div>
                      </div>
                      {f.observacoes && (
                        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 8, lineHeight: 1.4 }}>
                          {f.observacoes}
                        </div>
                      )}
                      {cupom && (
                        <button onClick={() => copiarCupom(cupom)} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6,
                          padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                          background: 'var(--gold-soft, var(--white))',
                          border: '0.5px solid var(--gold, var(--hair))',
                          fontSize: 12, fontFamily: 'var(--font-sans)',
                          color: 'var(--gold-deep)', fontWeight: 500, marginBottom: 8,
                        }}>
                          <i className="ti ti-tag" aria-hidden="true"></i>
                          {cupom}
                          <i className="ti ti-copy" style={{ fontSize: 11, opacity: .7 }} aria-hidden="true"></i>
                        </button>
                      )}
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {f.telefone && (
                          <a href={`tel:${f.telefone.replace(/\D/g, '')}`}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px', borderRadius: 8,
                              background: 'var(--white)', border: '0.5px solid var(--hair)',
                              fontSize: 12, color: 'var(--ink)', textDecoration: 'none',
                              fontFamily: 'var(--font-sans)',
                            }}>
                            <i className="ti ti-phone" aria-hidden="true"></i> {f.telefone}
                          </a>
                        )}
                        {f.link_contato && (
                          <a href={f.link_contato} target="_blank" rel="noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px', borderRadius: 8,
                              background: 'var(--ink)', border: 'none',
                              fontSize: 12, color: 'var(--white)', textDecoration: 'none',
                              fontFamily: 'var(--font-sans)',
                            }}>
                            <i className="ti ti-message-circle" aria-hidden="true"></i> Entrar em contato
                          </a>
                        )}
                        {f.arquivo_url && (
                          <a href={f.arquivo_url} target="_blank" rel="noreferrer"
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 5,
                              padding: '6px 12px', borderRadius: 8,
                              background: 'transparent', border: '0.5px solid var(--hair)',
                              fontSize: 12, color: 'var(--muted)', textDecoration: 'none',
                              fontFamily: 'var(--font-sans)',
                            }}>
                            <i className="ti ti-paperclip" aria-hidden="true"></i> Ver material
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ BLOCO 2: SUPLEMENTOS PRONTOS ════════════════════════════════════ */}
      {suplementos.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <i className="ti ti-pill" style={{ fontSize: 40, color: 'var(--muted-2)' }} aria-hidden="true"></i>
          <div style={{ fontSize: 14, fontWeight: 500, margin: '8px 0 4px' }}>Nenhum suplemento prescrito</div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>A Dra. ainda não cadastrou seus suplementos.</div>
        </div>
      ) : (
        <>
          {/* Resumo do dia */}
          <div style={{
            background: 'linear-gradient(135deg, var(--gold-soft, var(--bg-soft)), var(--white))',
            border: '0.5px solid var(--hair)',
            borderRadius: 16, padding: 18, marginBottom: 14, textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 500 }}>
              Hoje
            </div>
            <div style={{ fontSize: 36, fontWeight: 600, color: 'var(--ink)', lineHeight: 1, margin: '4px 0' }}>
              {tomadosHoje}<span style={{ fontSize: 18, color: 'var(--muted)', fontWeight: 400 }}>/{total}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              {tomadosHoje === total ? '🎉 Todos tomados!' : `Faltam ${total - tomadosHoje}`}
            </div>
            {streak > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                marginTop: 10, padding: '4px 10px',
                background: 'var(--orange-bg, var(--bg-soft))',
                borderRadius: 999, fontSize: 11, color: 'var(--orange, var(--gold-deep))', fontWeight: 500,
              }}>
                <i className="ti ti-flame" aria-hidden="true"></i>
                {streak} dia{streak === 1 ? '' : 's'} seguido{streak === 1 ? '' : 's'}
              </div>
            )}
          </div>

          {/* Lista do dia */}
          <div style={{
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 500, margin: '4px 4px 8px',
          }}>Suplementos de hoje</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {suplementos.map(s => {
              const tomado = !!logMap[s.id]?.[hoje]?.tomado;
              const objetivos = s.objetivo_clinico ?? [];
              return (
                <div key={s.id} style={{ borderRadius: 12, overflow: 'hidden' }}>
                  <button onClick={() => toggle(s)} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: 14, width: '100%',
                    background: tomado ? 'var(--green-soft, var(--bg-soft))' : 'var(--white)',
                    border: `1px solid ${tomado ? 'var(--green, var(--hair))' : 'var(--hair)'}`,
                    borderBottom: (s.link_compra || objetivos.length > 0) ? 'none' : undefined,
                    borderRadius: (s.link_compra || objetivos.length > 0) ? '12px 12px 0 0' : 12,
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'var(--font-sans)', transition: 'all .15s ease',
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: tomado ? 'var(--green, var(--gold-deep))' : 'var(--bg-soft)',
                      color: tomado ? 'var(--white)' : 'var(--muted)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, border: tomado ? 'none' : '1.5px solid var(--hair)',
                    }}>
                      {tomado ? <i className="ti ti-check" aria-hidden="true"></i> : null}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 500, color: 'var(--ink)',
                        textDecoration: tomado ? 'line-through' : 'none',
                        opacity: tomado ? 0.7 : 1,
                      }}>{s.nome}</div>
                      {s.marca && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{s.marca}</div>
                      )}
                      <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                        {s.dose    && <span>{s.dose}</span>}
                        {s.horario && <span>· {s.horario}</span>}
                      </div>
                      {s.posologia && (
                        <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>
                          {s.posologia}
                        </div>
                      )}
                      {objetivos.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                          {objetivos.map(id => (
                            <span key={id} style={{
                              fontSize: 9, padding: '2px 7px', borderRadius: 20,
                              background: 'var(--gold-soft, var(--bg-soft))',
                              color: 'var(--gold-deep)', fontWeight: 500,
                            }}>
                              {OBJETIVOS_CLINICOS.find(o => o.id === id)?.label ?? id}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <i className="ti ti-pill" style={{ fontSize: 18, color: 'var(--muted-2)', flexShrink: 0 }} aria-hidden="true"></i>
                  </button>

                  {/* Rodapé do card: link de compra + cupom */}
                  {(s.link_compra || s.cupom_desconto) && (
                    <div style={{
                      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                      padding: '8px 14px',
                      background: 'var(--bg-soft)',
                      border: `1px solid ${tomado ? 'var(--green, var(--hair))' : 'var(--hair)'}`,
                      borderTop: 'none',
                      borderRadius: '0 0 12px 12px',
                    }}>
                      {s.link_compra && (
                        <a href={s.link_compra} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 8,
                            background: 'var(--ink)', fontSize: 11,
                            color: 'var(--white)', textDecoration: 'none',
                            fontFamily: 'var(--font-sans)', fontWeight: 500,
                          }}>
                          <i className="ti ti-shopping-cart" aria-hidden="true"></i>
                          {s.marca ? `Comprar — ${s.marca}` : 'Comprar no site da marca'}
                        </a>
                      )}
                      {s.cupom_desconto && (
                        <button onClick={async e => { e.stopPropagation(); try { await navigator.clipboard.writeText(s.cupom_desconto); alert(`Cupom "${s.cupom_desconto}" copiado!`); } catch { alert(`Cupom: ${s.cupom_desconto}`); } }}
                          style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '5px 12px', borderRadius: 8, cursor: 'pointer',
                            background: 'transparent',
                            border: '0.5px solid var(--hair)',
                            fontSize: 11, fontFamily: 'var(--font-sans)',
                            color: 'var(--gold-deep)', fontWeight: 500,
                          }}>
                          <i className="ti ti-tag" aria-hidden="true"></i>
                          Cupom: {s.cupom_desconto}
                          <i className="ti ti-copy" style={{ fontSize: 10, opacity: .6 }} aria-hidden="true"></i>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Histórico 7 dias (original intacto) */}
          <div style={{
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 500, margin: '4px 4px 8px',
          }}>Últimos 7 dias</div>

          <div style={{
            background: 'var(--white)', border: '0.5px solid var(--hair)',
            borderRadius: 12, padding: 12, marginBottom: 24,
          }}>
            {suplementos.map((s, idx) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                paddingTop: idx === 0 ? 0 : 10, paddingBottom: 10,
                borderBottom: idx < suplementos.length - 1 ? '0.5px solid var(--hair-soft, var(--hair))' : 'none',
              }}>
                <div style={{ fontSize: 12, fontWeight: 500, flex: 1, color: 'var(--ink)', minWidth: 0 }}>
                  {s.nome}
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  {dias7.map(d => {
                    const tomado = !!logMap[s.id]?.[d.iso]?.tomado;
                    const isHoje = d.iso === hoje;
                    return (
                      <div key={d.iso} style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: tomado ? 'var(--green, var(--gold-deep))' : (isHoje ? 'var(--bg-soft)' : 'transparent'),
                        border: tomado ? 'none' : '0.5px solid var(--hair)',
                        color: tomado ? 'var(--white)' : 'var(--muted-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 500,
                      }} title={d.iso}>
                        {tomado ? <i className="ti ti-check" style={{ fontSize: 11 }} aria-hidden="true"></i> : d.num}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
