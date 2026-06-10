import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';

const FONTES = [
  { v: 'manual',  l: 'Manual'  },
  { v: 'tactiq',  l: 'Tactiq'  },
  { v: 'outro',   l: 'Outro'   },
];

const LABEL_FONTE = { manual: 'Manual', tactiq: 'Tactiq', api: 'API', outro: 'Outro' };

const PREVIEW_CHARS = 500;

function contarPalavras(texto) {
  return texto.trim().split(/\s+/).filter(Boolean).length;
}

function formVazio() {
  return { texto_bruto: '', fonte: 'manual', visibilidade: 'privado' };
}

export default function RegistrosClinicos({ pacienteId, nutriId, pacienteNome }) {
  const [registros,  setRegistros]  = useState(null);
  const [form,       setForm]       = useState(null);
  const [editId,     setEditId]     = useState(null);
  const [busy,       setBusy]       = useState(false);
  const [feedback,   setFeedback]   = useState(null);
  const [expandidos, setExpandidos] = useState({});

  async function carregar() {
    const { data } = await supabase
      .from('registros_clinicos')
      .select('id, texto_bruto, fonte, visibilidade, consulta_id, created_at, updated_at')
      .eq('paciente_id', pacienteId)
      .eq('nutri_id', nutriId)
      .order('created_at', { ascending: false });
    setRegistros(data ?? []);
  }

  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function abrirNovo() {
    setEditId(null);
    setFeedback(null);
    setForm(formVazio());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function abrirEditar(r) {
    setEditId(r.id);
    setFeedback(null);
    setForm({ texto_bruto: r.texto_bruto, fonte: r.fonte, visibilidade: r.visibilidade });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelar() { setForm(null); setEditId(null); setFeedback(null); }

  async function salvar() {
    setFeedback(null);
    if (!form.texto_bruto?.trim()) {
      return setFeedback({ tipo: 'erro', msg: 'O texto do registro é obrigatório.' });
    }
    setBusy(true);
    const payload = {
      paciente_id:  pacienteId,
      nutri_id:     nutriId,
      texto_bruto:  form.texto_bruto.trim(),
      fonte:        form.fonte,
      visibilidade: form.visibilidade,
    };
    const { error } = editId
      ? await supabase.from('registros_clinicos')
          .update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editId)
      : await supabase.from('registros_clinicos').insert(payload);
    setBusy(false);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });
    setFeedback({ tipo: 'ok', msg: editId ? 'Registro atualizado.' : 'Registro salvo.' });
    setForm(null);
    setEditId(null);
    carregar();
  }

  async function excluir(r) {
    if (!window.confirm('Excluir este registro clínico? A ação não pode ser desfeita.')) return;
    await supabase.from('registros_clinicos').delete().eq('id', r.id);
    carregar();
  }

  if (registros === null) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  return (
    <>
      {/* ── Botão novo ── */}
      {!form && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button className="btn" onClick={abrirNovo}>
            <i className="ti ti-plus" aria-hidden="true"></i> Novo registro
          </button>
        </div>
      )}

      {/* ── Feedback ── */}
      {!form && feedback && (
        <div style={{
          marginBottom: 14, padding: '9px 13px', borderRadius: 8, fontSize: 12,
          background: feedback.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)',
          color:      feedback.tipo === 'ok' ? 'var(--green)'    : 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`} aria-hidden="true" />
          {feedback.msg}
        </div>
      )}

      {/* ── Formulário ── */}
      {form && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <div className="card-title">{editId ? 'Editar registro' : 'Novo registro clínico'}</div>
              {pacienteNome && <div className="card-sub">{pacienteNome.split(' ')[0]}</div>}
            </div>
            <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }} onClick={cancelar}>
              Cancelar
            </button>
          </div>

          <div className="card-body">
            <div className="grid2">
              <div>
                <label className="field-label">Fonte</label>
                <select value={form.fonte} onChange={sf('fonte')}>
                  {FONTES.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Visibilidade</label>
                <select value={form.visibilidade} onChange={sf('visibilidade')}>
                  <option value="privado">Privado</option>
                </select>
                <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 3, lineHeight: 1.4 }}>
                  Visível apenas para você.
                </div>
              </div>
            </div>

            <label className="field-label" style={{ marginTop: 14 }}>Texto do registro</label>
            <textarea
              rows={12}
              value={form.texto_bruto}
              onChange={sf('texto_bruto')}
              placeholder="Cole aqui a transcrição exportada do Tactiq, ou escreva suas notas clínicas…"
              style={{ resize: 'vertical', minHeight: 220, fontFamily: 'var(--font-mono, monospace)', fontSize: 12, lineHeight: 1.65 }}
            />
            {form.texto_bruto?.trim() && (
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 3, textAlign: 'right' }}>
                {contarPalavras(form.texto_bruto).toLocaleString('pt-BR')} palavras
              </div>
            )}

            {feedback && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 13,
                background: feedback.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)',
                color:      feedback.tipo === 'ok' ? 'var(--green)'    : 'var(--red)',
              }}>
                <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`} style={{ marginRight: 5 }} aria-hidden="true" />
                {feedback.msg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={salvar} disabled={busy || !form.texto_bruto?.trim()}>
                <i className="ti ti-check" aria-hidden="true"></i>
                {busy ? 'Salvando…' : (editId ? 'Salvar alterações' : 'Salvar registro')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lista ── */}
      {!form && registros.length === 0 && (
        <div className="card empty-card">
          <div className="empty-sub">
            Nenhum registro clínico ainda. Cole transcrições ou notas usando o botão acima.
          </div>
        </div>
      )}

      {!form && registros.map(r => {
        const expandido = !!expandidos[r.id];
        const palavras  = contarPalavras(r.texto_bruto);
        const temMais   = r.texto_bruto.length > PREVIEW_CHARS;
        const editando  = editId === r.id;

        return (
          <div key={r.id} className="card" style={{
            marginBottom: 12,
            opacity: editId && !editando ? 0.55 : 1,
            transition: 'opacity .2s',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '14px 16px 0', gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 5 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: '.05em',
                    textTransform: 'uppercase',
                    background: 'var(--bg3, #eae4dc)', color: 'var(--text3)',
                    padding: '2px 8px', borderRadius: 20,
                  }}>
                    {LABEL_FONTE[r.fonte] ?? r.fonte}
                  </span>
                  <span style={{
                    fontSize: 10, color: 'var(--text4)',
                    background: 'var(--bg2)', padding: '2px 8px', borderRadius: 20,
                    display: 'inline-flex', alignItems: 'center', gap: 3,
                  }}>
                    <i className="ti ti-lock" style={{ fontSize: 9 }} aria-hidden="true" />
                    Privado
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                  {dataBR(r.created_at)}
                  {' · '}
                  {palavras.toLocaleString('pt-BR')} palavra{palavras !== 1 ? 's' : ''}
                  {r.updated_at > r.created_at && (
                    <span style={{ color: 'var(--text4)', marginLeft: 6 }}>
                      · editado em {dataBR(r.updated_at)}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button className="btn-outline" style={{ fontSize: 11, padding: '3px 9px' }} onClick={() => abrirEditar(r)}>
                  <i className="ti ti-edit" aria-hidden="true"></i> Editar
                </button>
                <button
                  onClick={() => excluir(r)}
                  style={{
                    background: 'none', border: '0.5px solid var(--border)',
                    borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--red)',
                  }}>
                  <i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true"></i>
                </button>
              </div>
            </div>

            {/* Texto */}
            <div style={{ padding: '10px 16px 14px' }}>
              <pre style={{
                margin: 0,
                fontSize: 12, color: 'var(--text2)', lineHeight: 1.7,
                fontFamily: 'var(--font-mono, ui-monospace, monospace)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                background: 'var(--bg2)', padding: '10px 14px', borderRadius: 8,
                maxHeight: expandido ? 'none' : '12em',
                overflow: expandido ? 'visible' : 'hidden',
              }}>
                {r.texto_bruto}
              </pre>
              {temMais && (
                <button
                  onClick={() => setExpandidos(e => ({ ...e, [r.id]: !e[r.id] }))}
                  style={{
                    marginTop: 6, fontSize: 11, color: 'var(--text3)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    padding: 0, fontFamily: 'var(--font-sans)',
                  }}>
                  {expandido
                    ? '↑ Ver menos'
                    : `↓ Ver tudo (${palavras.toLocaleString('pt-BR')} palavras)`}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </>
  );
}
