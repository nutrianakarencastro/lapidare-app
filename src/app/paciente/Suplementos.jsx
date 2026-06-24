import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR, dataHojeISO, formatarDataISO } from '../../lib/utils.js';
import { OBJETIVOS_CLINICOS } from '../../lib/suplementacaoConfig.js';

const HOJE = () => dataHojeISO();

export default function Suplementos() {
  const { user, profile } = useSession();
  const pacienteId = profile?.id;
  const [suplementos, setSuplementos] = useState(null);
  const [logs,        setLogs]        = useState([]);
  const [pdfs,        setPdfs]        = useState([]);
  const [farmacias,   setFarmacias]   = useState([]);
  // pdfUrls: { [pdf.id]: { url: string|null, erro: boolean } }
  const [pdfUrls,     setPdfUrls]     = useState({});
  const [modoData,    setModoData]    = useState('hoje');
  const [dataCustom,  setDataCustom]  = useState(HOJE());
  const [agora,       setAgora]       = useState(() => new Date());

  const ontem        = formatarDataISO(new Date(agora.getTime() - 86_400_000));
  const dataRegistro = modoData === 'hoje' ? HOJE()
    : modoData === 'ontem' ? ontem
    : dataCustom;
  const labelDataSel = modoData === 'hoje' ? 'Hoje'
    : modoData === 'ontem' ? 'Ontem'
    : new Date(dataCustom + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  useEffect(() => {
    const id = setInterval(() => setAgora(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  async function carregar() {
    if (!user) return;
    const [supRes, logRes, pdfRes, farmRes] = await Promise.all([
      supabase.from('suplementos').select('*')
        .eq('paciente_id', pacienteId).eq('ativo', true).order('ordem'),
      supabase.from('suplementos_logs').select('*')
        .eq('paciente_id', pacienteId)
        .gte('data', formatarDataISO(new Date(Date.now() - 30 * 86_400_000)))
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

  // Pré-gera as signed URLs assim que os PDFs chegam.
  // Cada PDF vira um <a href> real — sem async no toque.
  useEffect(() => {
    if (!pdfs.length) return;
    let active = true;
    async function gerarUrls() {
      const entradas = await Promise.all(
        pdfs.map(async pdf => {
          const { data, error } = await supabase.storage
            .from('prescricoes')
            .createSignedUrl(pdf.storage_path, 3600);
          return [pdf.id, error ? { url: null, erro: true } : { url: data.signedUrl, erro: false }];
        })
      );
      if (!active) return;
      setPdfUrls(Object.fromEntries(entradas));
    }
    gerarUrls();
    return () => { active = false; };
  }, [pdfs]);

  async function toggleDose(s, horario) {
    const horKey = horario ?? '__base__';
    const ja = logHorariosMap[s.id]?.[dataRegistro]?.[horKey];
    if (ja) {
      await supabase.from('suplementos_logs').delete().eq('id', ja.id);
    } else {
      await supabase.from('suplementos_logs').insert({
        suplemento_id: s.id, paciente_id: pacienteId,
        data: dataRegistro, tomado: true,
        horario: horario ?? null,
      });
    }
    carregar();
  }

  async function copiarCupom(cupom) {
    try {
      await navigator.clipboard.writeText(cupom);
      alert(`Cupom "${cupom}" copiado!`);
    } catch {
      alert(`Cupom: ${cupom}`);
    }
  }

  // logHorariosMap: índice por [suplemento_id][data][horario_key]
  // horario_key = valor TIME string ('17:30:00') ou '__base__' para sem horário
  const logHorariosMap = useMemo(() => {
    const m = {};
    for (const l of logs) {
      if (!m[l.suplemento_id]) m[l.suplemento_id] = {};
      if (!m[l.suplemento_id][l.data]) m[l.suplemento_id][l.data] = {};
      m[l.suplemento_id][l.data][l.horario ?? '__base__'] = l;
    }
    return m;
  }, [logs]);

  // logMap: [suplemento_id][data].tomado = true somente quando TODOS os horários estão registrados
  // Usado por streak e histórico 7 dias (dia = completo ou não)
  const logMap = useMemo(() => {
    const m = {};
    for (const s of (suplementos ?? [])) {
      m[s.id] = {};
      for (const dia of Object.keys(logHorariosMap[s.id] ?? {})) {
        const esperados = s.horarios?.length > 0 ? s.horarios : ['__base__'];
        if (esperados.every(h => logHorariosMap[s.id][dia]?.[h]?.tomado)) {
          m[s.id][dia] = { tomado: true };
        }
      }
    }
    return m;
  }, [logHorariosMap, suplementos]);

  const timeline = useMemo(() => {
    if (modoData !== 'hoje' || !suplementos?.length) return null;
    const hojeDia = HOJE();
    const hStr = `${String(agora.getHours()).padStart(2, '0')}:${String(agora.getMinutes()).padStart(2, '0')}:00`;
    const doses = suplementos
      .filter(s => s.horarios?.length > 0)
      .flatMap(s => s.horarios.map(h => {
        const tomado = !!logHorariosMap[s.id]?.[hojeDia]?.[h]?.tomado;
        const status = tomado ? 'concluida' : h <= hStr ? 'atrasada' : 'futura';
        return { s, h, status };
      }))
      .sort((a, b) => a.h.localeCompare(b.h));
    const atrasadas  = doses.filter(d => d.status === 'atrasada');
    const futuras    = doses.filter(d => d.status === 'futura');
    const concluidas = doses.filter(d => d.status === 'concluida');
    return {
      atrasadas,
      proxima:   futuras[0] ?? null,
      futuras:   futuras.slice(1),
      concluidas,
      temDoses:  doses.length > 0,
    };
  }, [suplementos, logHorariosMap, agora, modoData]);

  const streak = useMemo(() => {
    if (!suplementos || suplementos.length === 0) return 0;
    let count = 0;
    for (let i = 0; i < 30; i++) {
      const dia = formatarDataISO(new Date(Date.now() - i * 86_400_000));
      if (suplementos.every(s => logMap[s.id]?.[dia]?.tomado)) count++; else break;
    }
    return count;
  }, [suplementos, logMap]);

  const dias7 = useMemo(() => {
    const arr = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86_400_000);
      arr.push({
        iso: formatarDataISO(d),
        dia: d.toLocaleDateString('pt-BR', { weekday: 'short' }).slice(0, 1).toUpperCase(),
        num: d.getDate(),
      });
    }
    return arr;
  }, []);

  const hoje = HOJE();
  const total = (suplementos ?? []).reduce((acc, s) => acc + Math.max(1, s.horarios?.length ?? 0), 0);
  const tomadosHoje = (suplementos ?? []).reduce((acc, s) => {
    if (!s.horarios?.length) {
      return acc + (logHorariosMap[s.id]?.[dataRegistro]?.['__base__']?.tomado ? 1 : 0);
    }
    return acc + s.horarios.filter(h => logHorariosMap[s.id]?.[dataRegistro]?.[h]?.tomado).length;
  }, 0);
  const temManipulacao = pdfs.length > 0 || farmacias.length > 0;

  const tempoAte = (h) => {
    const [hh, mm] = h.split(':').map(Number);
    const alvo = new Date(agora);
    alvo.setHours(hh, mm, 0, 0);
    const diffMs = alvo - agora;
    if (diffMs <= 0) return null;
    const hr = Math.floor(diffMs / 3_600_000);
    const mn = Math.floor((diffMs % 3_600_000) / 60_000);
    return hr > 0 ? `em ${hr}h ${mn}min` : `em ${mn}min`;
  };

  if (suplementos === null) {
    return <div style={{ padding: 24, textAlign: 'center', color: 'var(--muted)' }}>Carregando…</div>;
  }

  return (
    <div style={{ padding: '0 16px' }}>

      {/* ══ BLOCO 1: MANIPULAÇÃO ════════════════════════════════════════════ */}
      {temManipulacao && (
        <div style={{
          background: 'var(--paper)', border: '0.5px solid var(--hair)',
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
                {pdfs.map(pdf => {
                  const urlState = pdfUrls[pdf.id];
                  const pronto   = urlState && !urlState.erro && urlState.url;
                  const erro     = urlState?.erro;

                  const innerContent = (
                    <>
                      <div style={{
                        width: 36, height: 36, borderRadius: 9, flexShrink: 0,
                        background: 'var(--gold-soft, var(--bg-soft))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        <i className="ti ti-file-text" style={{ fontSize: 18, color: 'var(--gold-deep)' }} aria-hidden="true"></i>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{pdf.titulo}</div>
                        <div style={{ fontSize: 11, color: erro ? 'var(--red, #c0392b)' : 'var(--muted)' }}>
                          {erro
                            ? 'Não consegui preparar o PDF. Avise sua nutricionista.'
                            : pronto
                            ? `${dataBR(pdf.created_at)} · Toque para abrir`
                            : 'Preparando PDF…'}
                        </div>
                      </div>
                      {pronto && <i className="ti ti-external-link" style={{ fontSize: 14, color: 'var(--muted)', flexShrink: 0 }} aria-hidden="true"></i>}
                    </>
                  );

                  if (pronto) {
                    return (
                      <a key={pdf.id}
                        href={urlState.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '10px 12px', borderRadius: 10,
                          background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
                          cursor: 'pointer', textDecoration: 'none', fontFamily: 'var(--font-sans)',
                          width: '100%', boxSizing: 'border-box',
                        }}>
                        {innerContent}
                      </a>
                    );
                  }

                  return (
                    <div key={pdf.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 10,
                      background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
                      fontFamily: 'var(--font-sans)', opacity: erro ? 1 : 0.65,
                    }}>
                      {innerContent}
                    </div>
                  );
                })}
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
                          background: 'var(--gold-soft, var(--paper))',
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
                              background: 'var(--paper)', border: '0.5px solid var(--hair)',
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
                              fontSize: 12, color: 'var(--paper)', textDecoration: 'none',
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
            background: 'linear-gradient(135deg, var(--gold-soft, var(--bg-soft)), var(--paper))',
            border: '0.5px solid var(--hair)',
            borderRadius: 16, padding: 18, marginBottom: 14, textAlign: 'center',
          }}>
            <div style={{ fontSize: 12, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 1.5, fontWeight: 500 }}>
              {labelDataSel}
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

          {/* Seletor de data */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { key: 'hoje',   label: 'Hoje'         },
                { key: 'ontem',  label: 'Ontem'        },
                { key: 'custom', label: 'Escolher data' },
              ].map(op => (
                <button
                  key={op.key}
                  onClick={() => setModoData(op.key)}
                  style={{
                    padding: '5px 14px', borderRadius: 99, border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: modoData === op.key ? 600 : 400,
                    fontFamily: 'var(--font-sans)',
                    background: modoData === op.key ? 'var(--ink)' : 'var(--bg2)',
                    color: modoData === op.key ? 'var(--paper)' : 'var(--muted)',
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>
            {modoData === 'custom' && (
              <input
                type="date"
                max={HOJE()}
                value={dataCustom}
                onChange={e => setDataCustom(e.target.value)}
                style={{
                  marginTop: 8, fontSize: 13, padding: '6px 10px',
                  borderRadius: 8, border: '0.5px solid var(--hair)',
                  fontFamily: 'var(--font-sans)', background: 'var(--paper)',
                  color: 'var(--ink)',
                }}
              />
            )}
          </div>

          {/* Próxima Dose — timeline do dia (somente quando modoData = hoje) */}
          {timeline?.temDoses && (
            <div style={{ marginBottom: 12 }}>

              {/* Atrasado */}
              {timeline.atrasadas.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{
                    fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
                    color: 'var(--orange, #d97706)', fontWeight: 600, margin: '0 2px 6px',
                  }}>
                    ⚠ Atrasado
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {timeline.atrasadas.map(d => (
                      <div key={`${d.s.id}-${d.h}`} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 10,
                        background: 'var(--bg-soft)',
                        border: '0.5px solid var(--orange, #d97706)',
                      }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--orange, #d97706)', minWidth: 38, flexShrink: 0 }}>
                          {d.h.slice(0, 5)}
                        </span>
                        <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 500, minWidth: 0 }}>
                          {d.s.nome}
                        </span>
                        <button
                          onClick={() => toggleDose(d.s, d.h)}
                          style={{
                            fontSize: 11, padding: '4px 12px', borderRadius: 20, flexShrink: 0,
                            background: 'var(--orange, #d97706)', color: '#fff',
                            border: 'none', cursor: 'pointer',
                            fontFamily: 'var(--font-sans)', fontWeight: 500,
                          }}
                        >
                          Registrar
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Próxima Dose */}
              {timeline.proxima && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{
                    fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
                    fontWeight: 600, margin: '0 2px 6px',
                    display: 'flex', alignItems: 'center', gap: 6, color: 'var(--ink)',
                  }}>
                    ► Próxima dose
                    {tempoAte(timeline.proxima.h) && (
                      <span style={{ fontSize: 9, color: 'var(--muted)', fontWeight: 400, letterSpacing: 0 }}>
                        · {tempoAte(timeline.proxima.h)}
                      </span>
                    )}
                  </div>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 12px', borderRadius: 10,
                    background: 'var(--paper)', border: '0.5px solid var(--hair)',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)', minWidth: 38, flexShrink: 0 }}>
                      {timeline.proxima.h.slice(0, 5)}
                    </span>
                    <span style={{ flex: 1, fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                      {timeline.proxima.s.nome}
                    </span>
                  </div>
                  {timeline.futuras.map(d => (
                    <div key={`${d.s.id}-${d.h}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 12px' }}>
                      <span style={{ fontSize: 12, color: 'var(--muted)', minWidth: 38, flexShrink: 0 }}>{d.h.slice(0, 5)}</span>
                      <span style={{ fontSize: 12, color: 'var(--muted)' }}>{d.s.nome}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Concluídas */}
              {timeline.concluidas.length > 0 && (
                <div style={{ marginBottom: 4 }}>
                  <div style={{
                    fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase',
                    color: 'var(--green)', fontWeight: 600, margin: '0 2px 6px',
                  }}>
                    ✓ Concluídas
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {timeline.concluidas.map(d => (
                      <div key={`${d.s.id}-${d.h}`} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '7px 12px', borderRadius: 10,
                        background: 'var(--green-soft, var(--bg-soft))',
                      }}>
                        <span style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600, minWidth: 38, flexShrink: 0 }}>
                          {d.h.slice(0, 5)}
                        </span>
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--muted)' }}>{d.s.nome}</span>
                        <i className="ti ti-check" style={{ fontSize: 12, color: 'var(--green)', flexShrink: 0 }} aria-hidden="true"></i>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ height: '0.5px', background: 'var(--hair)', margin: '8px 0 12px' }} />
            </div>
          )}

          {/* Lista do dia */}
          <div style={{
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 500, margin: '4px 4px 8px',
          }}>
            {modoData === 'hoje' ? 'Suplementos de hoje'
              : modoData === 'ontem' ? 'Suplementos de ontem'
              : `Suplementos de ${labelDataSel}`}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
            {suplementos.map(s => {
              const objetivos   = s.objetivo_clinico ?? [];
              const temHorarios = s.horarios?.length > 0;
              const todosFeitos = !!logMap[s.id]?.[dataRegistro]?.tomado;

              if (!temHorarios) {
                // ── Sem horários: toggle único (comportamento original) ────────
                const tomado = !!logHorariosMap[s.id]?.[dataRegistro]?.['__base__']?.tomado;
                return (
                  <div key={s.id} style={{ borderRadius: 12, overflow: 'hidden' }}>
                    <button onClick={() => toggleDose(s, null)} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: 14, width: '100%',
                      background: tomado ? 'var(--green-soft, var(--bg-soft))' : 'var(--paper)',
                      border: `1px solid ${tomado ? 'var(--green, var(--hair))' : 'var(--hair)'}`,
                      borderBottom: (s.link_compra || s.cupom_desconto) ? 'none' : undefined,
                      borderRadius: (s.link_compra || s.cupom_desconto) ? '12px 12px 0 0' : 12,
                      cursor: 'pointer', textAlign: 'left',
                      fontFamily: 'var(--font-sans)', transition: 'all .15s ease',
                    }}>
                      <div style={{
                        width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                        background: tomado ? 'var(--green, var(--gold-deep))' : 'var(--bg-soft)',
                        color: tomado ? 'var(--paper)' : 'var(--muted)',
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
                        {s.marca && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{s.marca}</div>}
                        <div style={{ fontSize: 11, color: 'var(--muted)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                          {s.dose    && <span>{s.dose}</span>}
                          {s.horario && <span>· {s.horario}</span>}
                        </div>
                        {s.posologia && <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 2 }}>{s.posologia}</div>}
                        {objetivos.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                            {objetivos.map(id => (
                              <span key={id} style={{ fontSize: 9, padding: '2px 7px', borderRadius: 20, background: 'var(--gold-soft, var(--bg-soft))', color: 'var(--gold-deep)', fontWeight: 500 }}>
                                {OBJETIVOS_CLINICOS.find(o => o.id === id)?.label ?? id}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <i className="ti ti-pill" style={{ fontSize: 18, color: 'var(--muted-2)', flexShrink: 0 }} aria-hidden="true"></i>
                    </button>
                    {(s.link_compra || s.cupom_desconto) && (
                      <div style={{
                        display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                        padding: '8px 14px', background: 'var(--bg-soft)',
                        border: `1px solid ${tomado ? 'var(--green, var(--hair))' : 'var(--hair)'}`,
                        borderTop: 'none', borderRadius: '0 0 12px 12px',
                      }}>
                        {s.link_compra && (
                          <a href={s.link_compra} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'var(--ink)', fontSize: 11, color: 'var(--paper)', textDecoration: 'none', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                            <i className="ti ti-shopping-cart" aria-hidden="true"></i>
                            {s.marca ? `Comprar — ${s.marca}` : 'Comprar no site da marca'}
                          </a>
                        )}
                        {s.cupom_desconto && (
                          <button onClick={async e => { e.stopPropagation(); try { await navigator.clipboard.writeText(s.cupom_desconto); alert(`Cupom "${s.cupom_desconto}" copiado!`); } catch { alert(`Cupom: ${s.cupom_desconto}`); } }}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '0.5px solid var(--hair)', fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--gold-deep)', fontWeight: 500 }}>
                            <i className="ti ti-tag" aria-hidden="true"></i>
                            Cupom: {s.cupom_desconto}
                            <i className="ti ti-copy" style={{ fontSize: 10, opacity: .6 }} aria-hidden="true"></i>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              }

              // ── Com horários: header de grupo + 1 toggle por horário ─────────
              return (
                <div key={s.id} style={{
                  borderRadius: 12, overflow: 'hidden',
                  border: `1px solid ${todosFeitos ? 'var(--green, var(--hair))' : 'var(--hair)'}`,
                }}>
                  {/* Header: nome, dose, posologia — sem toggle */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                    background: todosFeitos ? 'var(--green-soft, var(--bg-soft))' : 'var(--paper)',
                  }}>
                    <i className="ti ti-pill" style={{ fontSize: 18, color: 'var(--muted-2)', flexShrink: 0 }} aria-hidden="true"></i>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 500, color: 'var(--ink)',
                        textDecoration: todosFeitos ? 'line-through' : 'none',
                        opacity: todosFeitos ? 0.7 : 1,
                      }}>{s.nome}</div>
                      {s.marca    && <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 1 }}>{s.marca}</div>}
                      {s.dose     && <div style={{ fontSize: 11, color: 'var(--muted)' }}>{s.dose}</div>}
                      {s.posologia && <div style={{ fontSize: 11, color: 'var(--muted)', fontStyle: 'italic', marginTop: 1 }}>{s.posologia}</div>}
                    </div>
                  </div>

                  {/* 1 toggle por horário */}
                  {s.horarios.map(h => {
                    const tomadoH = !!logHorariosMap[s.id]?.[dataRegistro]?.[h]?.tomado;
                    return (
                      <button
                        key={h}
                        onClick={() => toggleDose(s, h)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 12,
                          padding: '10px 14px', width: '100%', border: 'none',
                          borderTop: '0.5px solid var(--hair)',
                          background: tomadoH ? 'var(--green-soft, var(--bg-soft))' : 'var(--paper)',
                          cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'var(--font-sans)', transition: 'background .15s ease',
                        }}
                      >
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: tomadoH ? 'var(--green, var(--gold-deep))' : 'var(--bg-soft)',
                          color: tomadoH ? 'var(--paper)' : 'var(--muted)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 13, border: tomadoH ? 'none' : '1.5px solid var(--hair)',
                        }}>
                          {tomadoH ? <i className="ti ti-check" aria-hidden="true"></i> : null}
                        </div>
                        <span style={{
                          fontSize: 14, fontWeight: 500,
                          color: tomadoH ? 'var(--muted)' : 'var(--ink)',
                          textDecoration: tomadoH ? 'line-through' : 'none',
                        }}>
                          {h.slice(0, 5)}
                        </span>
                      </button>
                    );
                  })}

                  {/* Rodapé: link de compra + cupom */}
                  {(s.link_compra || s.cupom_desconto) && (
                    <div style={{
                      display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                      padding: '8px 14px', background: 'var(--bg-soft)',
                      borderTop: '0.5px solid var(--hair)',
                    }}>
                      {s.link_compra && (
                        <a href={s.link_compra} target="_blank" rel="noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: 'var(--ink)', fontSize: 11, color: 'var(--paper)', textDecoration: 'none', fontFamily: 'var(--font-sans)', fontWeight: 500 }}>
                          <i className="ti ti-shopping-cart" aria-hidden="true"></i>
                          {s.marca ? `Comprar — ${s.marca}` : 'Comprar no site da marca'}
                        </a>
                      )}
                      {s.cupom_desconto && (
                        <button onClick={async e => { e.stopPropagation(); try { await navigator.clipboard.writeText(s.cupom_desconto); alert(`Cupom "${s.cupom_desconto}" copiado!`); } catch { alert(`Cupom: ${s.cupom_desconto}`); } }}
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, cursor: 'pointer', background: 'transparent', border: '0.5px solid var(--hair)', fontSize: 11, fontFamily: 'var(--font-sans)', color: 'var(--gold-deep)', fontWeight: 500 }}>
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
            background: 'var(--paper)', border: '0.5px solid var(--hair)',
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
                    // Suplemento sem horários: lógica original (completo ou vazio)
                    // Suplemento com horários: 3 estados (completo / parcial / vazio)
                    const temHorarios = s.horarios?.length > 0;
                    let estadoDia;
                    if (!temHorarios) {
                      estadoDia = logMap[s.id]?.[d.iso]?.tomado ? 'completo' : 'vazio';
                    } else {
                      const n = s.horarios.filter(h => logHorariosMap[s.id]?.[d.iso]?.[h]?.tomado).length;
                      estadoDia = n === s.horarios.length ? 'completo' : n > 0 ? 'parcial' : 'vazio';
                    }
                    const isHoje  = d.iso === hoje;
                    const bg = estadoDia === 'completo' ? 'var(--green, var(--gold-deep))'
                      : estadoDia === 'parcial'  ? 'var(--orange, #d97706)'
                      : isHoje ? 'var(--bg-soft)' : 'transparent';
                    return (
                      <div key={d.iso} style={{
                        width: 22, height: 22, borderRadius: 6,
                        background: bg,
                        border: estadoDia === 'vazio' ? '0.5px solid var(--hair)' : 'none',
                        color: estadoDia !== 'vazio' ? 'var(--paper)' : 'var(--muted-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 9, fontWeight: 500,
                      }} title={d.iso}>
                        {estadoDia === 'completo'
                          ? <i className="ti ti-check" style={{ fontSize: 11 }} aria-hidden="true"></i>
                          : estadoDia === 'parcial'
                          ? <span style={{ fontSize: 11, lineHeight: 1 }}>◐</span>
                          : d.num}
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
