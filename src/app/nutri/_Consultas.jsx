import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

const TIPOS = [
  { v: 'primeira', label: '1ª Consulta' },
  ...Array.from({ length: 12 }, (_, i) => ({
    v: `consulta_${i + 1}`,
    label: `Consulta ${String(i + 1).padStart(2, '0')}`,
  })),
  { v: 'avaliacao', label: 'Avaliação' },
  { v: 'retorno',   label: 'Retorno'   },
];

function tipoLabel(tipo) {
  if (!tipo) return '—';
  if (tipo === 'primeira') return '1ª Consulta';
  if (tipo === 'avaliacao') return 'Avaliação';
  if (tipo === 'retorno') return 'Retorno';
  const m = tipo.match(/^consulta_(\d+)$/);
  if (m) return `Consulta ${String(m[1]).padStart(2, '0')}`;
  return tipo;
}

function hojeLocal() {
  return new Date().toISOString().slice(0, 10);
}

function agoraLocal() {
  return new Date().toTimeString().slice(0, 5);
}

function dataHoraLabel(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formVazio() {
  return {
    data:                  hojeLocal(),
    hora:                  agoraLocal(),
    tipo:                  '',
    status:                'realizada',
    resumo:                '',
    queixas_achados:       '',
    objetivos_discutidos:  '',
    proximos_passos:       '',
    observacoes_internas:  '',
  };
}

const COR_STATUS = {
  agendada:     'var(--blue)',
  em_andamento: 'var(--orange)',
  realizada:    'var(--green)',
};
const BG_STATUS = {
  agendada:     'var(--blue-bg, #eff6ff)',
  em_andamento: 'var(--amber-bg, #fff7ed)',
  realizada:    'var(--green-bg)',
};
const LABEL_STATUS = {
  agendada:     'Agendada',
  em_andamento: 'Em andamento',
  realizada:    'Realizada',
};

export default function ConsultasClinicas({ pacienteId, nutriId, pacienteNome, onIrParaTab }) {
  const [consultas, setConsultas] = useState(null);
  const [form, setForm]           = useState(null);
  const [editId, setEditId]       = useState(null);
  const [busy, setBusy]           = useState(false);
  const [feedback, setFeedback]   = useState(null);

  async function carregar() {
    const { data } = await supabase.from('consultas')
      .select('id, data_hora, tipo, status, obs, resumo, queixas_achados, objetivos_discutidos, proximos_passos, observacoes_internas')
      .eq('paciente_id', pacienteId)
      .eq('nutri_id', nutriId)
      .neq('status', 'cancelada')
      .order('data_hora', { ascending: false });
    setConsultas(data ?? []);
  }

  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function sugerirTipo() {
    const { count } = await supabase.from('consultas')
      .select('id', { count: 'exact', head: true })
      .eq('paciente_id', pacienteId)
      .neq('status', 'cancelada')
      .neq('tipo', 'avaliacao');
    const n = (count ?? 0) + 1;
    if (n === 1)    return 'primeira';
    if (n <= 12)    return `consulta_${n}`;
    return 'consulta_12';
  }

  async function abrirNovo() {
    setEditId(null);
    setFeedback(null);
    const tipo = await sugerirTipo();
    setForm({ ...formVazio(), tipo });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function abrirRegistrar(c) {
    setEditId(c.id);
    setFeedback(null);
    const dt = new Date(c.data_hora);
    setForm({
      data:                 dt.toISOString().slice(0, 10),
      hora:                 dt.toTimeString().slice(0, 5),
      tipo:                 c.tipo ?? '',
      status:               'realizada',
      resumo:               c.resumo               ?? '',
      queixas_achados:      c.queixas_achados      ?? '',
      objetivos_discutidos: c.objetivos_discutidos ?? '',
      proximos_passos:      c.proximos_passos      ?? '',
      observacoes_internas: c.observacoes_internas ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function abrirEditar(c) {
    setEditId(c.id);
    setFeedback(null);
    const dt = new Date(c.data_hora);
    setForm({
      data:                 dt.toISOString().slice(0, 10),
      hora:                 dt.toTimeString().slice(0, 5),
      tipo:                 c.tipo   ?? '',
      status:               c.status,
      resumo:               c.resumo               ?? '',
      queixas_achados:      c.queixas_achados      ?? '',
      objetivos_discutidos: c.objetivos_discutidos ?? '',
      proximos_passos:      c.proximos_passos      ?? '',
      observacoes_internas: c.observacoes_internas ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelar() {
    setForm(null);
    setEditId(null);
    setFeedback(null);
  }

  async function salvar() {
    setFeedback(null);
    if (!form.data || !form.hora) return setFeedback({ tipo: 'erro', msg: 'Informe data e hora.' });
    setBusy(true);

    const data_hora = new Date(`${form.data}T${form.hora}:00`).toISOString();
    const payload = {
      paciente_id:           pacienteId,
      nutri_id:              nutriId,
      data_hora,
      tipo:                  form.tipo || null,
      status:                form.status,
      resumo:                form.resumo.trim()               || null,
      queixas_achados:       form.queixas_achados.trim()      || null,
      objetivos_discutidos:  form.objetivos_discutidos.trim() || null,
      proximos_passos:       form.proximos_passos.trim()      || null,
      observacoes_internas:  form.observacoes_internas.trim() || null,
    };

    const { error } = editId
      ? await supabase.from('consultas').update(payload).eq('id', editId)
      : await supabase.from('consultas').insert(payload);

    setBusy(false);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });

    setFeedback({
      tipo: 'ok',
      msg: editId ? 'Consulta atualizada.' : 'Consulta registrada.',
      conduta: form.status === 'realizada',
    });
    setForm(null);
    setEditId(null);
    carregar();
  }

  if (consultas === null) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  const ativas     = consultas.filter(c => c.status === 'agendada' || c.status === 'em_andamento');
  const realizadas = consultas.filter(c => c.status === 'realizada');

  return (
    <>
      {/* ── Botão nova consulta ── */}
      {!form && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button className="btn" onClick={abrirNovo}>
            <i className="ti ti-plus" aria-hidden="true"></i> Nova consulta
          </button>
        </div>
      )}

      {/* ── Feedback ── */}
      {!form && feedback && (
        <div style={{
          marginBottom: 14, padding: '12px 14px', borderRadius: 8, fontSize: 12,
          background: feedback.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)',
          color:      feedback.tipo === 'ok' ? 'var(--green)'    : 'var(--red)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <span>
              <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`}
                style={{ marginRight: 5 }} aria-hidden="true"></i>
              {feedback.msg}
            </span>
            {feedback.conduta && (
              <button className="btn-outline"
                style={{ fontSize: 11, padding: '3px 10px', color: 'var(--dark)', flexShrink: 0 }}
                onClick={() => { setFeedback(null); onIrParaTab?.('condutas'); }}>
                <i className="ti ti-clipboard-list" aria-hidden="true"></i> Criar conduta
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Formulário ── */}
      {form && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                {editId ? `Registrar — ${tipoLabel(form.tipo)}` : 'Nova consulta'}
              </div>
              {pacienteNome && (
                <div className="card-sub">{pacienteNome.split(' ')[0]}</div>
              )}
            </div>
            <button className="btn-outline" style={{ fontSize: 12, padding: '4px 10px' }}
              onClick={cancelar}>
              Cancelar
            </button>
          </div>

          <div className="card-body">
            {/* Data · Hora */}
            <div className="grid2">
              <div>
                <label className="field-label">Data *</label>
                <input type="date" value={form.data} onChange={sf('data')} />
              </div>
              <div>
                <label className="field-label">Hora *</label>
                <input type="time" value={form.hora} onChange={sf('hora')} />
              </div>
            </div>

            {/* Tipo · Status */}
            <div className="grid2" style={{ marginTop: 12 }}>
              <div>
                <label className="field-label">Tipo</label>
                <select value={form.tipo} onChange={sf('tipo')}>
                  <option value="">— sem tipo —</option>
                  {TIPOS.map(t => <option key={t.v} value={t.v}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Status</label>
                <select value={form.status} onChange={sf('status')}>
                  <option value="em_andamento">Em andamento</option>
                  <option value="realizada">Realizada</option>
                </select>
              </div>
            </div>

            {/* Campos clínicos */}
            <label className="field-label" style={{ marginTop: 14 }}>Resumo da consulta</label>
            <textarea rows={3} value={form.resumo} onChange={sf('resumo')}
              placeholder="O que aconteceu nesta consulta?" />

            <label className="field-label" style={{ marginTop: 10 }}>Principais queixas / achados</label>
            <textarea rows={2} value={form.queixas_achados} onChange={sf('queixas_achados')}
              placeholder="Ex: Constipação persistente, acne piora pré-menstrual…" />

            <label className="field-label" style={{ marginTop: 10 }}>Objetivos discutidos</label>
            <textarea rows={2} value={form.objetivos_discutidos} onChange={sf('objetivos_discutidos')}
              placeholder="Ex: Regular intestino, reduzir fluxo intenso…" />

            <label className="field-label" style={{ marginTop: 10 }}>Próximos passos</label>
            <textarea rows={2} value={form.proximos_passos} onChange={sf('proximos_passos')}
              placeholder="Ex: Retorno em 6 semanas, aguardar ferritina…" />

            <label className="field-label" style={{ marginTop: 10 }}>Observações internas</label>
            <textarea rows={2} value={form.observacoes_internas} onChange={sf('observacoes_internas')}
              placeholder="Contexto clínico, decisões, nuances relevantes…" />

            {feedback && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 13,
                background: feedback.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)',
                color:      feedback.tipo === 'ok' ? 'var(--green)'    : 'var(--red)',
              }}>
                <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`}
                  style={{ marginRight: 5 }} aria-hidden="true"></i>
                {feedback.msg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={salvar}
                disabled={busy || !form.data || !form.hora}>
                <i className="ti ti-check" aria-hidden="true"></i>
                {busy ? 'Salvando…' : (editId ? 'Salvar alterações' : 'Registrar consulta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Agendadas / Em andamento ── */}
      {!form && ativas.length > 0 && (
        <>
          <SectionLabel>Agendadas · Em andamento</SectionLabel>
          {ativas.map(c => (
            <ConsultaCard
              key={c.id}
              consulta={c}
              editandoId={editId}
              onRegistrar={() => abrirRegistrar(c)}
              onEditar={null}
            />
          ))}
        </>
      )}

      {/* ── Histórico ── */}
      {!form && realizadas.length > 0 && (
        <>
          <SectionLabel>Histórico clínico</SectionLabel>
          {realizadas.map(c => (
            <ConsultaCard
              key={c.id}
              consulta={c}
              editandoId={editId}
              onRegistrar={null}
              onEditar={() => abrirEditar(c)}
            />
          ))}
        </>
      )}

      {/* ── Vazia ── */}
      {!form && consultas.length === 0 && (
        <div className="card empty-card">
          <div className="empty-sub">Nenhuma consulta registrada. Use o botão acima para iniciar.</div>
        </div>
      )}
    </>
  );
}

// ── Separador de seção ─────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 600, letterSpacing: 1.2,
      textTransform: 'uppercase', color: 'var(--text3)',
      marginBottom: 10, marginTop: 4,
    }}>
      {children}
    </div>
  );
}

// ── Card de consulta ───────────────────────────────────────────────────────
function ConsultaCard({ consulta: c, editandoId, onRegistrar, onEditar }) {
  const editando = editandoId === c.id;
  const isAtiva  = c.status === 'agendada' || c.status === 'em_andamento';

  return (
    <div className="card" style={{
      marginBottom: 12,
      borderLeft: `3px solid ${COR_STATUS[c.status] ?? 'transparent'}`,
      opacity: editandoId && !editando ? 0.55 : 1,
      transition: 'opacity .2s',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '14px 16px 0', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 3 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: .4,
              background: BG_STATUS[c.status],
              color: COR_STATUS[c.status],
              padding: '2px 8px', borderRadius: 20,
            }}>
              {LABEL_STATUS[c.status]}
            </span>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)' }}>
              {tipoLabel(c.tipo)}
            </span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {dataHoraLabel(c.data_hora)}
          </div>
        </div>

        <div style={{ flexShrink: 0 }}>
          {isAtiva && onRegistrar ? (
            <button className="btn" style={{ fontSize: 12, padding: '4px 12px' }}
              onClick={onRegistrar}>
              <i className="ti ti-pencil" aria-hidden="true"></i>
              {c.status === 'em_andamento' ? 'Continuar' : 'Registrar'}
            </button>
          ) : onEditar ? (
            <button className="btn-outline" style={{ fontSize: 12, padding: '3px 10px' }}
              onClick={onEditar}>
              <i className="ti ti-edit" aria-hidden="true"></i> Editar
            </button>
          ) : null}
        </div>
      </div>

      {/* Resumo, se preenchido */}
      {c.resumo ? (
        <div style={{ padding: '8px 16px 14px', fontSize: 12, color: 'var(--text2)', lineHeight: 1.55 }}>
          {c.resumo.length > 130 ? c.resumo.slice(0, 130) + '…' : c.resumo}
        </div>
      ) : (
        <div style={{ paddingBottom: 14 }} />
      )}
    </div>
  );
}
