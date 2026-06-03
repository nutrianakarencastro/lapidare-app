import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

const TIPOS = [
  { id: 'contrato',          label: 'Contrato',          categoria: 'Administrativo' },
  { id: 'recibo',            label: 'Recibo',            categoria: 'Administrativo' },
  { id: 'declaracao',        label: 'Declaração',        categoria: 'Administrativo' },
  { id: 'termo',             label: 'Termo',             categoria: 'Administrativo' },
  { id: 'encaminhamento',    label: 'Encaminhamento',    categoria: 'Clínico'        },
  { id: 'relatorio_clinico', label: 'Relatório clínico', categoria: 'Clínico'        },
  { id: 'laudo',             label: 'Laudo',             categoria: 'Clínico'        },
  { id: 'outro',             label: 'Outro',             categoria: 'Outro'          },
];

const STATUS_CFG = {
  enviado:   { label: 'Enviado',   bg: '#f3f4f6', color: '#6b7280' },
  assinado:  { label: 'Assinado',  bg: '#dbeafe', color: '#1d4ed8' },
  arquivado: { label: 'Arquivado', bg: '#f1f5f9', color: '#94a3b8' },
};

function fmtData(d) {
  if (!d) return '';
  const [y, m, dia] = String(d).split('-');
  return `${dia}/${m}/${y}`;
}

function formVazio() {
  return {
    titulo: '', tipo: 'contrato',
    data_documento: new Date().toISOString().slice(0, 10),
    descricao: '', link_externo: '', status: 'enviado',
  };
}

function populateForm(doc) {
  return {
    titulo:        doc.titulo        || '',
    tipo:          doc.tipo          || 'contrato',
    data_documento:doc.data_documento|| '',
    descricao:     doc.descricao     || '',
    link_externo:  doc.link_externo  || '',
    status:        doc.status        || 'enviado',
  };
}

const inpSt = {
  width: '100%', boxSizing: 'border-box', padding: '7px 10px',
  borderRadius: 6, border: '0.5px solid var(--border)',
  fontSize: 13, fontFamily: 'var(--font-sans)',
  background: 'var(--white)', color: 'var(--dark)',
};
const lblSt = {
  fontSize: 11, fontWeight: 500, color: 'var(--text3)',
  display: 'block', marginBottom: 4,
};

/* ── Form (cria e edita) ──────────────────────────────── */
function FormDocumento({ nutriId, pacienteId, editando, onSalvo, onCancelar }) {
  const [form, setForm]               = useState(editando ? populateForm(editando) : formVazio());
  const [arquivo, setArquivo]         = useState(null);
  const [removendoPdf, setRemovendoPdf] = useState(false);
  const [salvando, setSalvando]       = useState(false);
  const [erro, setErro]               = useState(null);
  const [fileKey, setFileKey]         = useState(0);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const existePdf = editando?.pdf_path && !removendoPdf;

  async function salvar() {
    setErro(null);
    if (!form.titulo.trim()) { setErro('Título obrigatório.'); return; }
    if (!arquivo && !form.link_externo.trim() && !existePdf) {
      setErro('Adicione um PDF ou um link externo.'); return;
    }
    setSalvando(true);

    let pdfPath = editando?.pdf_path ?? null;
    let pdfNome = editando?.pdf_nome ?? null;

    if (arquivo) {
      if (editando?.pdf_path)
        await supabase.storage.from('documentos').remove([editando.pdf_path]);
      const path = `${nutriId}/${pacienteId}/${Date.now()}.pdf`;
      const { error: upErr } = await supabase.storage
        .from('documentos').upload(path, arquivo, { contentType: 'application/pdf' });
      if (upErr) { setSalvando(false); setErro('Upload falhou: ' + upErr.message); return; }
      pdfPath = path;
      pdfNome = arquivo.name;
    } else if (removendoPdf && editando?.pdf_path) {
      await supabase.storage.from('documentos').remove([editando.pdf_path]);
      pdfPath = null;
      pdfNome = null;
    }

    const payload = {
      titulo:         form.titulo.trim(),
      tipo:           form.tipo,
      data_documento: form.data_documento || null,
      descricao:      form.descricao.trim() || null,
      link_externo:   form.link_externo.trim() || null,
      status:         form.status,
      pdf_path:       pdfPath,
      pdf_nome:       pdfNome,
    };

    const { error } = editando
      ? await supabase.from('documentos').update(payload).eq('id', editando.id)
      : await supabase.from('documentos').insert({ ...payload, nutri_id: nutriId, paciente_id: pacienteId });

    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onSalvo();
  }

  return (
    <>
      {erro && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12,
          background: '#fff0f0', color: '#c0392b', border: '0.5px solid #f5c0c0',
        }}>{erro}</div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <label style={lblSt}>Título *</label>
          <input style={inpSt} value={form.titulo} onChange={set('titulo')}
            placeholder="Ex: Contrato de acompanhamento" />
        </div>
        <div>
          <label style={lblSt}>Tipo *</label>
          <select style={inpSt} value={form.tipo} onChange={set('tipo')}>
            <optgroup label="Administrativo">
              <option value="contrato">Contrato</option>
              <option value="recibo">Recibo</option>
              <option value="declaracao">Declaração</option>
              <option value="termo">Termo</option>
            </optgroup>
            <optgroup label="Clínico">
              <option value="encaminhamento">Encaminhamento</option>
              <option value="relatorio_clinico">Relatório clínico</option>
              <option value="laudo">Laudo</option>
            </optgroup>
            <optgroup label="Outro">
              <option value="outro">Outro</option>
            </optgroup>
          </select>
        </div>
        <div>
          <label style={lblSt}>Data do documento</label>
          <input type="date" style={inpSt} value={form.data_documento}
            onChange={set('data_documento')} />
        </div>
        <div>
          <label style={lblSt}>Status</label>
          <select style={inpSt} value={form.status} onChange={set('status')}>
            <option value="enviado">Enviado</option>
            <option value="assinado">Assinado</option>
            <option value="arquivado">Arquivado</option>
          </select>
        </div>
      </div>

      <div style={{ marginTop: 10 }}>
        <label style={lblSt}>Descrição (opcional)</label>
        <textarea style={{ ...inpSt, resize: 'vertical', minHeight: 56 }}
          value={form.descricao} onChange={set('descricao')}
          placeholder="Observações sobre o documento…" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div>
          <label style={lblSt}>📄 PDF</label>
          {existePdf ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
              <i className="ti ti-file-type-pdf" style={{ color: '#e05252' }} aria-hidden="true" />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {editando.pdf_nome}
              </span>
              <button onClick={() => { setRemovendoPdf(true); setArquivo(null); setFileKey(k => k + 1); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--red)', fontSize: 13 }}>
                <i className="ti ti-x" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <input key={fileKey} type="file" accept="application/pdf"
              style={{ fontSize: 12 }}
              onChange={e => { setArquivo(e.target.files[0] ?? null); setRemovendoPdf(false); }} />
          )}
        </div>
        <div>
          <label style={lblSt}>🔗 Link externo (opcional)</label>
          <input style={inpSt} value={form.link_externo} onChange={set('link_externo')}
            placeholder="https://zapsign.com.br/…" />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }}
          onClick={onCancelar}>Cancelar</button>
        <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
          onClick={salvar} disabled={salvando}>
          <i className="ti ti-check" aria-hidden="true" />
          {salvando ? 'Salvando…' : (editando ? 'Salvar alterações' : 'Criar documento')}
        </button>
      </div>
    </>
  );
}

/* ── Componente principal ────────────────────────────────── */
export default function DocumentosPaciente({ pacienteId, nutriId, pacienteNome }) {
  const [documentos,       setDocumentos]       = useState(null);
  const [filtroArquivados, setFiltroArquivados] = useState(false);
  const [criando,          setCriando]          = useState(false);
  const [editandoId,       setEditandoId]       = useState(null);
  const [feedback,         setFeedback]         = useState(null);

  async function carregar() {
    const { data } = await supabase
      .from('documentos')
      .select('*')
      .eq('nutri_id', nutriId)
      .eq('paciente_id', pacienteId)
      .order('data_documento', { ascending: false });
    setDocumentos(data ?? []);
  }

  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  async function abrirDocumento(doc) {
    let url = doc.link_externo;
    if (doc.pdf_path) {
      const { data, error } = await supabase.storage
        .from('documentos').createSignedUrl(doc.pdf_path, 300);
      if (error) { alert('Não foi possível abrir: ' + error.message); return; }
      url = data.signedUrl;
    }
    if (url) window.open(url, '_blank', 'noopener');
  }

  async function toggleArquivar(doc) {
    const arquivando = doc.status !== 'arquivado';
    const msg = arquivando
      ? `Arquivar "${doc.titulo}"? O documento será mantido, mas ficará inativo.`
      : `Reativar "${doc.titulo}"?`;
    if (!window.confirm(msg)) return;
    await supabase.from('documentos')
      .update({ status: arquivando ? 'arquivado' : 'enviado' })
      .eq('id', doc.id);
    carregar();
  }

  function salvo(msg) {
    setCriando(false);
    setEditandoId(null);
    carregar();
    setFeedback({ tipo: 'ok', msg });
    setTimeout(() => setFeedback(null), 3000);
  }

  const mostrar = useMemo(() => {
    if (!documentos) return [];
    return documentos.filter(d =>
      filtroArquivados ? d.status === 'arquivado' : d.status !== 'arquivado'
    );
  }, [documentos, filtroArquivados]);

  const editando = editandoId ? (documentos ?? []).find(d => d.id === editandoId) ?? null : null;
  const primeiroNome = pacienteNome?.split(' ')[0] ?? 'paciente';

  return (
    <>
      {feedback && (
        <div style={{
          padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 14,
          background: feedback.tipo === 'ok' ? '#f0fdf4' : '#fff0f0',
          color: feedback.tipo === 'ok' ? '#166534' : '#c0392b',
          border: `0.5px solid ${feedback.tipo === 'ok' ? '#bbf7d0' : '#f5c0c0'}`,
        }}>{feedback.msg}</div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          onClick={() => setFiltroArquivados(v => !v)}
          style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
            fontFamily: 'var(--font-sans)', border: '0.5px solid var(--border)',
            background: filtroArquivados ? 'var(--dark)' : 'var(--white)',
            color: filtroArquivados ? '#fff' : 'var(--dark)',
          }}>
          {filtroArquivados ? 'Ver ativos' : '📦 Arquivados'}
        </button>
        <button className="btn" style={{ marginLeft: 'auto' }}
          onClick={() => { setCriando(true); setEditandoId(null); }}>
          <i className="ti ti-plus" aria-hidden="true" /> Novo documento
        </button>
      </div>

      {criando && (
        <div style={{ border: '0.5px solid var(--dark)', borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 12 }}>
            Novo documento para {primeiroNome}
          </div>
          <FormDocumento nutriId={nutriId} pacienteId={pacienteId} editando={null}
            onSalvo={() => salvo('Documento criado.')}
            onCancelar={() => setCriando(false)} />
        </div>
      )}

      {documentos === null ? (
        <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>
      ) : mostrar.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-files empty-icon" aria-hidden="true" />
          <div className="empty-title">
            {filtroArquivados ? 'Nenhum documento arquivado' : 'Nenhum documento ainda'}
          </div>
          {!filtroArquivados && (
            <div className="empty-sub">
              Envie contratos, recibos, encaminhamentos e outros documentos para {primeiroNome}.
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {mostrar.map(doc => {
            const isEditOpen = editandoId === doc.id;
            const stCfg    = STATUS_CFG[doc.status] ?? STATUS_CFG.enviado;
            const tipoLabel = TIPOS.find(t => t.id === doc.tipo)?.label ?? doc.tipo;

            return (
              <div key={doc.id} style={{
                border: `0.5px solid ${isEditOpen ? 'var(--dark)' : 'var(--border)'}`,
                borderRadius: 10, overflow: 'hidden',
                opacity: doc.status === 'arquivado' ? 0.65 : 1,
              }}>
                <div style={{
                  display: 'flex', gap: 12, padding: '12px 14px', alignItems: 'flex-start',
                  background: isEditOpen ? 'var(--dark)' : 'var(--white)',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 99,
                        background: 'var(--bg2)', color: 'var(--text3)', fontWeight: 500,
                      }}>{tipoLabel}</span>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 99,
                        background: stCfg.bg, color: stCfg.color, fontWeight: 500,
                      }}>{stCfg.label}</span>
                    </div>
                    <div style={{
                      fontSize: 14, fontWeight: 500,
                      color: isEditOpen ? '#faf8f5' : 'var(--dark)',
                    }}>{doc.titulo}</div>
                    {doc.descricao && (
                      <div style={{
                        fontSize: 11, marginTop: 3, lineHeight: 1.4,
                        color: isEditOpen ? 'rgba(255,255,255,.6)' : 'var(--text3)',
                      }}>{doc.descricao}</div>
                    )}
                    <div style={{
                      fontSize: 11, marginTop: 4,
                      color: isEditOpen ? 'rgba(255,255,255,.5)' : 'var(--text3)',
                      display: 'flex', gap: 10,
                    }}>
                      {doc.data_documento && <span>📅 {fmtData(doc.data_documento)}</span>}
                      {doc.pdf_path       && <span>📄 PDF</span>}
                      {doc.link_externo   && <span>🔗 Link</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 }}>
                    {(doc.pdf_path || doc.link_externo) && (
                      <button className="btn-outline" style={{ fontSize: 11, padding: '3px 8px' }}
                        onClick={() => abrirDocumento(doc)}>
                        <i className="ti ti-external-link" style={{ fontSize: 12 }} aria-hidden="true" /> Abrir
                      </button>
                    )}
                    <button className="btn-outline" style={{ fontSize: 11, padding: '3px 8px' }}
                      onClick={() => { setEditandoId(isEditOpen ? null : doc.id); setCriando(false); }}>
                      {isEditOpen ? 'Fechar' : 'Editar'}
                    </button>
                    <button onClick={() => toggleArquivar(doc)}
                      title={doc.status === 'arquivado' ? 'Reativar' : 'Arquivar'}
                      style={{
                        background: 'none', border: 'none', cursor: 'pointer',
                        color: 'var(--text3)', padding: 4, fontSize: 14,
                      }}>
                      <i className={`ti ti-${doc.status === 'arquivado' ? 'archive-off' : 'archive'}`}
                         aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {isEditOpen && editando && (
                  <div style={{ padding: 16, background: 'var(--white)' }}>
                    <FormDocumento nutriId={nutriId} pacienteId={pacienteId} editando={editando}
                      onSalvo={() => salvo('Documento salvo.')}
                      onCancelar={() => setEditandoId(null)} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
