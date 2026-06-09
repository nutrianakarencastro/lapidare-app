import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';
import { OBJETIVOS_CLINICOS } from '../../lib/suplementacaoConfig.js';

const inpSt = {
  width: '100%', boxSizing: 'border-box',
  padding: '7px 10px', borderRadius: 6,
  border: '0.5px solid var(--border)',
  fontSize: 13, fontFamily: 'var(--font-sans)',
  background: 'var(--white)', color: 'var(--dark)',
};

// ─── Bloco de cabeçalho de seção ─────────────────────────────────────────────
function SecHeader({ label }) {
  return (
    <div style={{
      fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
      color: 'var(--text3)', fontWeight: 500, marginBottom: 10, marginTop: 4,
    }}>{label}</div>
  );
}

export default function Suplementacao({ pacienteId, nutriId, pacienteNome }) {
  // ── Estado existente ─────────────────────────────────────────────────────
  const [suplementos,  setSuplementos]  = useState(null);
  const [logs,         setLogs]         = useState([]);
  const [pdfs,         setPdfs]         = useState([]);
  const [editar,       setEditar]       = useState(null);
  const [pdfFile,      setPdfFile]      = useState(null);
  const [busy,         setBusy]         = useState(false);

  // ── Estado novo — farmácias ──────────────────────────────────────────────
  const [farmacias,        setFarmacias]        = useState([]);
  const [vinculadas,       setVinculadas]        = useState([]);
  const [editarFarm,       setEditarFarm]        = useState(null);
  const [vincularId,       setVincularId]        = useState('');
  const [vincularCupom,    setVincularCupom]     = useState('');
  const [mostrarGerenciar, setMostrarGerenciar]  = useState(false);
  const [busyFarm,         setBusyFarm]          = useState(false);

  async function carregar() {
    const [supRes, logRes, pdfRes, farmRes, vincRes] = await Promise.all([
      supabase.from('suplementos').select('*').eq('paciente_id', pacienteId).order('ordem'),
      supabase.from('suplementos_logs').select('*')
        .eq('paciente_id', pacienteId)
        .gte('data', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10))
        .order('data', { ascending: false }),
      supabase.from('prescricoes').select('id, titulo, storage_path, created_at')
        .eq('paciente_id', pacienteId).eq('tipo', 'suplementacao')
        .order('created_at', { ascending: false }),
      supabase.from('farmacias').select('*').eq('nutri_id', nutriId).order('ordem'),
      supabase.from('farmacias_paciente')
        .select('id, codigo_desconto, ordem, farmacia_id, farmacias(id, nome, telefone, link_contato, codigo_desconto, arquivo_url, observacoes)')
        .eq('paciente_id', pacienteId).order('ordem'),
    ]);
    setSuplementos(supRes.data ?? []);
    setLogs(logRes.data ?? []);
    setPdfs(pdfRes.data ?? []);
    setFarmacias(farmRes.data ?? []);
    setVinculadas(vincRes.data ?? []);
  }
  useEffect(() => { carregar(); }, [pacienteId]);

  // ── Suplementos ──────────────────────────────────────────────────────────
  async function salvar(s) {
    if (!s.nome?.trim()) { alert('Informe o nome do suplemento.'); return; }
    setBusy(true);
    const payload = {
      nome:             s.nome.trim(),
      marca:            s.marca?.trim()            || null,
      dose:             s.dose?.trim()             || null,
      posologia:        s.posologia?.trim()         || null,
      horario:          s.horario?.trim()           || null,
      horarios:         s.horarios ?? [],
      duracao_prevista: s.duracao_prevista?.trim()  || null,
      link_compra:      s.link_compra?.trim()       || null,
      cupom_desconto:   s.cupom_desconto?.trim()    || null,
      objetivo_clinico: s.objetivo_clinico ?? [],
      obs:              s.obs?.trim()               || null,
    };
    if (s.novo) {
      await supabase.from('suplementos').insert({
        ...payload,
        paciente_id: pacienteId, nutri_id: nutriId,
        ativo: true, ordem: (suplementos?.length ?? 0),
      });
    } else {
      await supabase.from('suplementos').update({
        ...payload,
        ativo: s.ativo, updated_at: new Date().toISOString(),
      }).eq('id', s.id);
    }
    setBusy(false);
    setEditar(null);
    carregar();
  }

  async function excluir(s) {
    if (!window.confirm(`Excluir "${s.nome}"? Os logs de aderência também serão removidos.`)) return;
    await supabase.from('suplementos').delete().eq('id', s.id);
    carregar();
  }

  // ── PDFs (lógica original preservada) ────────────────────────────────────
  async function subirPdf() {
    if (!pdfFile) return;
    setBusy(true);
    const ext = (pdfFile.name.split('.').pop() || 'pdf').toLowerCase();
    const titulo = pdfFile.name.replace(/\.[^.]+$/, '');
    const path = `${pacienteId}/${Date.now()}-suplementacao.${ext}`;
    const { error: upErr } = await supabase.storage.from('prescricoes')
      .upload(path, pdfFile, { contentType: pdfFile.type });
    if (upErr) { setBusy(false); alert('Erro: ' + upErr.message); return; }
    await supabase.from('prescricoes').insert({
      paciente_id: pacienteId, nutri_id: nutriId,
      tipo: 'suplementacao', titulo, storage_path: path,
    });
    setBusy(false);
    setPdfFile(null);
    const inp = document.getElementById('sup-pdf-file');
    if (inp) inp.value = '';
    carregar();
  }

  async function abrirPdf(pdf) {
    const { data, error } = await supabase.storage.from('prescricoes').createSignedUrl(pdf.storage_path, 120);
    if (error) return alert('Erro: ' + error.message);
    window.open(data.signedUrl, '_blank', 'noopener');
  }

  async function excluirPdf(pdf) {
    if (!window.confirm(`Excluir PDF "${pdf.titulo}"?`)) return;
    await supabase.storage.from('prescricoes').remove([pdf.storage_path]);
    await supabase.from('prescricoes').delete().eq('id', pdf.id);
    carregar();
  }

  // ── Farmácias — CRUD global ───────────────────────────────────────────────
  async function salvarFarmacia(f) {
    if (!f.nome?.trim()) { alert('Informe o nome da farmácia.'); return; }
    setBusyFarm(true);
    const payload = {
      nome:            f.nome.trim(),
      telefone:        f.telefone?.trim()        || null,
      link_contato:    f.link_contato?.trim()    || null,
      codigo_desconto: f.codigo_desconto?.trim() || null,
      arquivo_url:     f.arquivo_url?.trim()     || null,
      observacoes:     f.observacoes?.trim()     || null,
    };
    if (f.novo) {
      await supabase.from('farmacias').insert({
        ...payload, nutri_id: nutriId,
        ativa: true, ordem: farmacias.length,
      });
    } else {
      await supabase.from('farmacias').update(payload).eq('id', f.id);
    }
    setBusyFarm(false);
    setEditarFarm(null);
    carregar();
  }

  async function excluirFarmacia(f) {
    if (!window.confirm(`Excluir farmácia "${f.nome}"? Todos os vínculos com pacientes serão removidos.`)) return;
    await supabase.from('farmacias').delete().eq('id', f.id);
    carregar();
  }

  // ── Farmácias — vínculos com a paciente ──────────────────────────────────
  async function vincular() {
    if (!vincularId) return;
    setBusyFarm(true);
    await supabase.from('farmacias_paciente').insert({
      farmacia_id:     vincularId,
      paciente_id:     pacienteId,
      nutri_id:        nutriId,
      codigo_desconto: vincularCupom.trim() || null,
      ordem:           vinculadas.length,
    });
    setVincularId('');
    setVincularCupom('');
    setBusyFarm(false);
    carregar();
  }

  async function desvincular(vinculoId) {
    await supabase.from('farmacias_paciente').delete().eq('id', vinculoId);
    carregar();
  }

  // ── Aderência (lógica original) ───────────────────────────────────────────
  const aderencia = useMemo(() => {
    const ativos = (suplementos ?? []).filter(s => s.ativo);
    if (ativos.length === 0) return null;
    const dias7 = [];
    for (let i = 6; i >= 0; i--) {
      dias7.push(new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
    }
    const esperado = ativos.length * dias7.length;
    const cumprido = logs.filter(l =>
      l.tomado && dias7.includes(l.data) && ativos.some(s => s.id === l.suplemento_id)
    ).length;
    return Math.round((cumprido / esperado) * 100);
  }, [suplementos, logs]);

  const primeiroNome = pacienteNome?.split(' ')[0] ?? 'paciente';
  const farmNaoVinculadas = farmacias.filter(f =>
    f.ativa && !vinculadas.some(v => v.farmacia_id === f.id)
  );

  return (
    <>
      {/* ══ BLOCO 1: MANIPULAÇÃO ════════════════════════════════════════════ */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Manipulação</div>
            <div className="card-sub">Prescrição em PDF + farmácias parceiras</div>
          </div>
        </div>

        <div className="card-body">

          {/* ─ PDFs ──────────────────────────────────────────────────────── */}
          <SecHeader label="Prescrição em PDF" />
          <div style={{
            border: '1.5px dashed var(--border)', borderRadius: 8,
            padding: 12, marginBottom: 10,
            display: 'flex', gap: 8, alignItems: 'center',
          }}>
            <input id="sup-pdf-file" type="file" accept="application/pdf"
              onChange={e => setPdfFile(e.target.files?.[0] ?? null)}
              style={{ flex: 1, padding: 4 }} />
            <button className="btn" onClick={subirPdf} disabled={!pdfFile || busy}>
              <i className="ti ti-upload" aria-hidden="true"></i> Subir
            </button>
          </div>
          {pdfs.length === 0 ? (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 16 }}>
              Nenhuma prescrição enviada ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
              {pdfs.map(pdf => (
                <div key={pdf.id} style={{
                  display: 'flex', gap: 10, alignItems: 'center',
                  padding: 10, borderRadius: 8, background: 'var(--white)',
                  border: '0.5px solid var(--border)',
                }}>
                  <i className="ti ti-file-text" style={{ fontSize: 16, color: 'var(--text3)' }} aria-hidden="true"></i>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{pdf.titulo}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)' }}>Enviado em {dataBR(pdf.created_at)}</div>
                  </div>
                  <button onClick={() => abrirPdf(pdf)} className="btn-outline" style={{ fontSize: 11, padding: '3px 8px' }}>
                    <i className="ti ti-eye" aria-hidden="true"></i> Abrir
                  </button>
                  <button onClick={() => excluirPdf(pdf)} style={{
                    background: 'none', border: '0.5px solid var(--red)',
                    borderRadius: 6, padding: '3px 8px', color: 'var(--red)', cursor: 'pointer',
                  }}>
                    <i className="ti ti-trash" aria-hidden="true"></i>
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* ─ Farmácias vinculadas a esta paciente ──────────────────────── */}
          <SecHeader label="Farmácias parceiras indicadas" />
          {vinculadas.length === 0 ? (
            <div style={{
              fontSize: 12, color: 'var(--text3)', padding: '10px 0', marginBottom: 10,
            }}>
              Nenhuma farmácia indicada para {primeiroNome} ainda.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 12 }}>
              {vinculadas.map(v => {
                const f = v.farmacias;
                if (!f) return null;
                const cupom = v.codigo_desconto || f.codigo_desconto;
                return (
                  <div key={v.id} style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start',
                    padding: '10px 12px', borderRadius: 9,
                    background: 'var(--white)', border: '0.5px solid var(--border)',
                  }}>
                    <i className="ti ti-building-store" style={{ fontSize: 16, color: 'var(--gold-deep)', marginTop: 2, flexShrink: 0 }} aria-hidden="true"></i>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{f.nome}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                        {f.telefone && <span><i className="ti ti-phone" aria-hidden="true"></i> {f.telefone}</span>}
                        {f.link_contato && <span><i className="ti ti-link" aria-hidden="true"></i> Link</span>}
                      </div>
                      {cupom && (
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                          Cupom: <span style={{ fontWeight: 600, color: 'var(--gold-deep)' }}>{cupom}</span>
                        </div>
                      )}
                      {f.arquivo_url && (
                        <a href={f.arquivo_url} target="_blank" rel="noreferrer"
                          onClick={e => e.stopPropagation()}
                          style={{ fontSize: 11, color: 'var(--text3)', display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                          <i className="ti ti-paperclip" aria-hidden="true"></i> Ver folder / material
                        </a>
                      )}
                    </div>
                    <button onClick={() => desvincular(v.id)} style={{
                      background: 'none', border: '0.5px solid var(--border)',
                      borderRadius: 6, padding: '3px 8px', fontSize: 11,
                      color: 'var(--text3)', cursor: 'pointer',
                    }}>
                      <i className="ti ti-x" aria-hidden="true"></i>
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Indicar farmácia existente */}
          {farmNaoVinculadas.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              <select
                value={vincularId}
                onChange={e => setVincularId(e.target.value)}
                style={{ ...inpSt, flex: '1 1 160px' }}
              >
                <option value="">Selecionar farmácia…</option>
                {farmNaoVinculadas.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
              <input
                placeholder="Cupom específico (opcional)"
                value={vincularCupom}
                onChange={e => setVincularCupom(e.target.value)}
                style={{ ...inpSt, flex: '1 1 160px' }}
              />
              <button className="btn" onClick={vincular} disabled={!vincularId || busyFarm}>
                <i className="ti ti-plus" aria-hidden="true"></i> Indicar
              </button>
            </div>
          )}

          {/* Gerenciar farmácias da clínica */}
          <button
            onClick={() => setMostrarGerenciar(g => !g)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-sans)',
              display: 'inline-flex', alignItems: 'center', gap: 4, padding: 0,
            }}>
            <i className={`ti ti-chevron-${mostrarGerenciar ? 'up' : 'down'}`} aria-hidden="true"></i>
            Gerenciar farmácias da clínica ({farmacias.length})
          </button>

          {mostrarGerenciar && (
            <div style={{
              marginTop: 10, padding: 14, borderRadius: 10,
              background: 'var(--bg2)', border: '0.5px solid var(--border)',
            }}>
              {farmacias.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
                  Nenhuma farmácia cadastrada ainda.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {farmacias.map(f => (
                    <div key={f.id} style={{
                      display: 'flex', gap: 8, alignItems: 'center',
                      padding: '8px 10px', borderRadius: 8,
                      background: 'var(--white)', border: '0.5px solid var(--border)',
                      opacity: f.ativa ? 1 : 0.5,
                    }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{f.nome}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          {f.telefone    && <span>{f.telefone}</span>}
                          {f.codigo_desconto && <span>Cupom: {f.codigo_desconto}</span>}
                        </div>
                      </div>
                      <button onClick={() => setEditarFarm({ ...f, novo: false })}
                        className="btn-outline" style={{ fontSize: 11, padding: '3px 8px' }}>
                        <i className="ti ti-edit" aria-hidden="true"></i>
                      </button>
                      <button onClick={() => excluirFarmacia(f)} style={{
                        background: 'none', border: '0.5px solid var(--red)',
                        borderRadius: 6, padding: '3px 8px', color: 'var(--red)', cursor: 'pointer',
                      }}>
                        <i className="ti ti-trash" aria-hidden="true"></i>
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <button className="btn-outline"
                onClick={() => setEditarFarm({ novo: true, nome: '', telefone: '', link_contato: '', codigo_desconto: '', arquivo_url: '', observacoes: '' })}>
                <i className="ti ti-plus" aria-hidden="true"></i> Nova farmácia
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══ BLOCO 2: SUPLEMENTOS PRONTOS ════════════════════════════════════ */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Suplementos prontos</div>
            <div className="card-sub">Lista pra ela checar todo dia + tracker de aderência</div>
          </div>
          <button className="btn"
            onClick={() => setEditar({
              novo: true, nome: '', marca: '', dose: '', posologia: '', horario: '',
              horarios: [],
              duracao_prevista: '', link_compra: '', cupom_desconto: '',
              objetivo_clinico: [], obs: '', ativo: true,
            })}>
            <i className="ti ti-plus" aria-hidden="true"></i> Novo suplemento
          </button>
        </div>

        <div className="card-body">
          {/* Aderência (original) */}
          {aderencia !== null && (
            <div style={{
              display: 'flex', gap: 12, alignItems: 'center',
              padding: 12, borderRadius: 10, marginBottom: 14,
              background: aderencia >= 70 ? 'var(--green-bg)' : aderencia >= 40 ? 'var(--orange-bg)' : 'var(--red-bg)',
              border: `0.5px solid var(--${aderencia >= 70 ? 'green' : aderencia >= 40 ? 'orange' : 'red'})`,
            }}>
              <div style={{
                fontSize: 24, fontWeight: 600,
                color: `var(--${aderencia >= 70 ? 'green' : aderencia >= 40 ? 'orange' : 'red'})`,
              }}>{aderencia}%</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>Aderência últimos 7 dias</div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {aderencia >= 70 ? 'Excelente — paciente engajada' :
                   aderencia >= 40 ? 'Atenção — converse no próximo check-in' :
                                     'Baixa aderência — vale investigar o motivo'}
                </div>
              </div>
            </div>
          )}

          {suplementos === null ? (
            <div style={{ padding: 16, color: 'var(--text3)', fontSize: 13 }}>Carregando…</div>
          ) : suplementos.length === 0 ? (
            <div style={{
              padding: '14px 16px', borderRadius: 8, background: 'var(--bg2)',
              fontSize: 12, color: 'var(--text3)',
            }}>
              Nenhum suplemento adicionado. Clica em "Novo suplemento" pra começar.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {suplementos.map(s => (
                <div key={s.id} style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                  padding: 12, borderRadius: 8,
                  background: s.ativo ? 'var(--white)' : 'var(--bg2)',
                  border: '0.5px solid var(--border)',
                  opacity: s.ativo ? 1 : 0.6,
                }}>
                  <i className="ti ti-pill" style={{ fontSize: 16, color: 'var(--gold-deep)', marginTop: 2, flexShrink: 0 }} aria-hidden="true"></i>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {s.nome}
                      {!s.ativo && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6 }}>(pausado)</span>}
                    </div>
                    {s.marca && <div style={{ fontSize: 11, color: 'var(--text3)' }}>{s.marca}</div>}
                    <div style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                      {s.dose    && <span><i className="ti ti-droplet" aria-hidden="true"></i> {s.dose}</span>}
                      {s.horario && <span><i className="ti ti-clock" aria-hidden="true"></i> {s.horario}</span>}
                    </div>
                    {(s.objetivo_clinico ?? []).length > 0 && (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
                        {(s.objetivo_clinico).map(id => (
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
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <button onClick={() => setEditar({ ...s, novo: false })}
                      className="btn-outline" style={{ fontSize: 11, padding: '3px 8px' }}>
                      <i className="ti ti-edit" aria-hidden="true"></i>
                    </button>
                    <button onClick={() => excluir(s)} style={{
                      background: 'none', border: '0.5px solid var(--red)',
                      borderRadius: 6, padding: '3px 8px', color: 'var(--red)', cursor: 'pointer',
                    }}>
                      <i className="ti ti-trash" aria-hidden="true"></i>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Modal: editar suplemento ─────────────────────────────────────── */}
      {editar && (
        <ModalSuplemento s={editar} onClose={() => setEditar(null)} onSave={salvar} busy={busy} />
      )}

      {/* ── Modal: editar farmácia ───────────────────────────────────────── */}
      {editarFarm && (
        <ModalFarmacia
          f={editarFarm}
          onClose={() => setEditarFarm(null)}
          onSave={salvarFarmacia}
          busy={busyFarm}
        />
      )}
    </>
  );
}

// ─── Modal suplemento (expandido com novos campos) ───────────────────────────
function ModalSuplemento({ s, onClose, onSave, busy }) {
  const [form, setForm] = useState(() => ({
    objetivo_clinico: [],
    horarios: [],
    ...s,
  }));
  const [novoHorario, setNovoHorario] = useState('');
  const sv = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function adicionarHorario() {
    if (!novoHorario) return;
    const atual = form.horarios ?? [];
    if (atual.includes(novoHorario)) return;
    sv('horarios', [...atual, novoHorario].sort());
    setNovoHorario('');
  }

  function removerHorario(h) {
    sv('horarios', (form.horarios ?? []).filter(x => x !== h));
  }

  function toggleObj(id) {
    const atual = form.objetivo_clinico ?? [];
    sv('objetivo_clinico', atual.includes(id) ? atual.filter(x => x !== id) : [...atual, id]);
  }

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 100, padding: '16px 16px', overflowY: 'auto',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--white)', borderRadius: 12,
        maxWidth: 520, width: '100%', padding: 20,
        marginTop: 24, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{s.novo ? 'Novo suplemento' : 'Editar suplemento'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>
            <i className="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>

        {/* Nome + Marca */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="form-lbl">Nome *</label>
            <input value={form.nome} onChange={e => sv('nome', e.target.value)} placeholder="Ex: Vitamina D3 2000UI" autoFocus />
          </div>
          <div>
            <label className="form-lbl">Marca</label>
            <input value={form.marca ?? ''} onChange={e => sv('marca', e.target.value)} placeholder="Ex: Vitaminlife" />
          </div>
        </div>

        {/* Dose + Horário */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="form-lbl">Dose</label>
            <input value={form.dose ?? ''} onChange={e => sv('dose', e.target.value)} placeholder="1 cápsula, 5g..." />
          </div>
          <div>
            <label className="form-lbl">Horário (descrição)</label>
            <input value={form.horario ?? ''} onChange={e => sv('horario', e.target.value)} placeholder="Café da manhã, antes de dormir…" />
          </div>
        </div>

        {/* Horários de lembrete */}
        <div style={{ marginBottom: 10 }}>
          <label className="form-lbl">Horários de lembrete na home da paciente</label>
          {(form.horarios ?? []).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
              {(form.horarios ?? []).map(h => (
                <span key={h} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  fontSize: 12, padding: '3px 8px', borderRadius: 16,
                  background: 'var(--bg2)', border: '0.5px solid var(--border)',
                  color: 'var(--dark)',
                }}>
                  {h.slice(0, 5)}
                  <button type="button" onClick={() => removerHorario(h)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, color: 'var(--text4)', lineHeight: 1, fontSize: 12,
                  }}>
                    <i className="ti ti-x" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="time"
              value={novoHorario}
              onChange={e => setNovoHorario(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarHorario())}
              style={{ flex: 1 }}
            />
            <button type="button" className="btn-outline" onClick={adicionarHorario} style={{ whiteSpace: 'nowrap' }}>
              <i className="ti ti-plus" aria-hidden="true" /> Adicionar
            </button>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4 }}>
            Aparece na seção "Suplementação de hoje" na home da paciente.
          </div>
        </div>

        {/* Posologia + Duração */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="form-lbl">Posologia</label>
            <input value={form.posologia ?? ''} onChange={e => sv('posologia', e.target.value)} placeholder="Tomar com refeição..." />
          </div>
          <div>
            <label className="form-lbl">Duração prevista</label>
            <input value={form.duracao_prevista ?? ''} onChange={e => sv('duracao_prevista', e.target.value)} placeholder="30 dias, 3 meses..." />
          </div>
        </div>

        {/* Link + Cupom */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="form-lbl">Link de compra</label>
            <input value={form.link_compra ?? ''} onChange={e => sv('link_compra', e.target.value)} placeholder="https://..." />
          </div>
          <div>
            <label className="form-lbl">Cupom de desconto</label>
            <input value={form.cupom_desconto ?? ''} onChange={e => sv('cupom_desconto', e.target.value)} placeholder="NUTRI10..." />
          </div>
        </div>

        {/* Objetivo clínico */}
        <div style={{ marginBottom: 12 }}>
          <label className="form-lbl">Objetivo clínico</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {OBJETIVOS_CLINICOS.map(o => {
              const sel = (form.objetivo_clinico ?? []).includes(o.id);
              return (
                <button key={o.id} type="button" onClick={() => toggleObj(o.id)}
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 20, cursor: 'pointer',
                    background: sel ? 'var(--gold-deep)' : 'var(--bg2)',
                    color: sel ? '#fff' : 'var(--dark)',
                    border: `0.5px solid ${sel ? 'var(--gold-deep)' : 'var(--border)'}`,
                    fontFamily: 'var(--font-sans)', fontWeight: sel ? 500 : 400,
                    transition: 'all .12s',
                  }}>
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Obs */}
        <div style={{ marginBottom: 12 }}>
          <label className="form-lbl">Observação</label>
          <input value={form.obs ?? ''} onChange={e => sv('obs', e.target.value)} placeholder="Tomar em jejum, com gordura..." />
        </div>

        {!s.novo && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, fontSize: 13, cursor: 'pointer' }}>
            <input type="checkbox" checked={!form.ativo} onChange={e => sv('ativo', !e.target.checked)} />
            Pausar (paciente não vê na lista do dia)
          </label>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onSave(form)} disabled={busy}>
            <i className="ti ti-check" aria-hidden="true"></i> {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Modal farmácia ───────────────────────────────────────────────────────────
function ModalFarmacia({ f, onClose, onSave, busy }) {
  const [form, setForm] = useState(f);
  const sv = (k, v) => setForm(fm => ({ ...fm, [k]: v }));

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--white)', borderRadius: 12,
        maxWidth: 440, width: '100%', padding: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 500 }}>{f.novo ? 'Nova farmácia' : 'Editar farmácia'}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>
            <i className="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>

        <label className="form-lbl">Nome *</label>
        <input value={form.nome} onChange={e => sv('nome', e.target.value)} placeholder="Ex: Farmácia Sabará" autoFocus />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
          <div>
            <label className="form-lbl">Telefone / WhatsApp</label>
            <input value={form.telefone ?? ''} onChange={e => sv('telefone', e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className="form-lbl">Cupom padrão</label>
            <input value={form.codigo_desconto ?? ''} onChange={e => sv('codigo_desconto', e.target.value)} placeholder="NUTRI10" />
          </div>
        </div>

        <label className="form-lbl" style={{ marginTop: 10 }}>Link de contato</label>
        <input value={form.link_contato ?? ''} onChange={e => sv('link_contato', e.target.value)} placeholder="https://wa.me/... ou site" />

        <label className="form-lbl" style={{ marginTop: 10 }}>Folder / material de divulgação (URL)</label>
        <input value={form.arquivo_url ?? ''} onChange={e => sv('arquivo_url', e.target.value)} placeholder="https://drive.google.com/... ou link do material" />

        <label className="form-lbl" style={{ marginTop: 10 }}>Observações</label>
        <input value={form.observacoes ?? ''} onChange={e => sv('observacoes', e.target.value)} placeholder="Atende online, entrega para SP..." />

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onSave(form)} disabled={busy}>
            <i className="ti ti-check" aria-hidden="true"></i> {busy ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
