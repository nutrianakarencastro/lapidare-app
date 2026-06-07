import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';

const EIXOS = [
  'Ciclo', 'Intestino', 'Sono', 'Energia', 'Pele',
  'Exames', 'Composição corporal', 'Hábitos', 'Mapa Metabólico',
];

const STATUS_META = [
  { v: 'ativa',        label: 'Ativa'        },
  { v: 'em_evolucao',  label: 'Em evolução'  },
  { v: 'concluida',    label: 'Concluída'    },
  { v: 'pausada',      label: 'Pausada'      },
];

const PRIORIDADES = [
  { v: 'alta',  label: 'Alta'  },
  { v: 'media', label: 'Média' },
  { v: 'baixa', label: 'Baixa' },
];

const ORDEM_PRIORIDADE = { alta: 0, media: 1, baixa: 2 };

const FILTROS = [
  { id: 'todas',       label: 'Todas'        },
  { id: 'ativa',       label: 'Ativas'       },
  { id: 'em_evolucao', label: 'Em evolução'  },
  { id: 'concluida',   label: 'Concluídas'   },
  { id: 'pausada',     label: 'Pausadas'     },
];

function hoje() {
  return new Date().toISOString().slice(0, 10);
}

function formVazio() {
  return {
    titulo:       '',
    eixo:         '',
    descricao:    '',
    criterio:     '',
    status:       'ativa',
    prioridade:   'media',
    criado_em:    hoje(),
    concluido_em: '',
    pausado_em:   '',
    observacoes:  '',
  };
}

function ordenarMetas(lista) {
  return [...lista].sort((a, b) => {
    const pa = ORDEM_PRIORIDADE[a.prioridade] ?? 1;
    const pb = ORDEM_PRIORIDADE[b.prioridade] ?? 1;
    if (pa !== pb) return pa - pb;
    return b.criado_em.localeCompare(a.criado_em);
  });
}

export default function Metas({ pacienteId, nutriId, pacienteNome }) {
  const [registros, setRegistros] = useState(null);
  const [form, setForm]           = useState(null);
  const [editId, setEditId]       = useState(null);
  const [busy, setBusy]           = useState(false);
  const [feedback, setFeedback]   = useState(null);
  const [filtro, setFiltro]       = useState('todas');

  async function carregar() {
    const { data } = await supabase.from('metas_terapeuticas')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('nutri_id', nutriId)
      .order('criado_em', { ascending: false });
    setRegistros(data ?? []);
  }

  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function onStatusChange(e) {
    const novo = e.target.value;
    setForm(f => ({
      ...f,
      status:       novo,
      concluido_em: novo === 'concluida' ? (f.concluido_em || hoje()) : f.concluido_em,
      pausado_em:   novo === 'pausada'   ? (f.pausado_em   || hoje()) : f.pausado_em,
    }));
  }

  async function salvar() {
    setFeedback(null);
    if (!form.titulo.trim()) return setFeedback({ tipo: 'erro', msg: 'Informe um título.' });
    if (!form.criado_em)     return setFeedback({ tipo: 'erro', msg: 'Informe a data de criação.' });
    setBusy(true);

    const payload = {
      paciente_id:  pacienteId,
      nutri_id:     nutriId,
      titulo:       form.titulo.trim(),
      eixo:         form.eixo        || null,
      descricao:    form.descricao.trim()   || null,
      criterio:     form.criterio.trim()    || null,
      status:       form.status,
      prioridade:   form.prioridade,
      criado_em:    form.criado_em,
      concluido_em: form.concluido_em || null,
      pausado_em:   form.pausado_em   || null,
      observacoes:  form.observacoes.trim() || null,
    };

    const { error } = editId
      ? await supabase.from('metas_terapeuticas').update(payload).eq('id', editId)
      : await supabase.from('metas_terapeuticas').insert(payload);

    setBusy(false);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });

    setFeedback({ tipo: 'ok', msg: editId ? 'Meta atualizada.' : 'Meta registrada.' });
    setForm(null);
    setEditId(null);
    carregar();
  }

  async function excluir(m) {
    if (!window.confirm(`Excluir meta "${m.titulo}"?`)) return;
    await supabase.from('metas_terapeuticas').delete().eq('id', m.id);
    carregar();
  }

  function abrirNovo() {
    setEditId(null);
    setFeedback(null);
    setForm(formVazio());
  }

  function abrirEditar(m) {
    setEditId(m.id);
    setFeedback(null);
    setForm({
      titulo:       m.titulo,
      eixo:         m.eixo         ?? '',
      descricao:    m.descricao    ?? '',
      criterio:     m.criterio     ?? '',
      status:       m.status,
      prioridade:   m.prioridade,
      criado_em:    m.criado_em,
      concluido_em: m.concluido_em ?? '',
      pausado_em:   m.pausado_em   ?? '',
      observacoes:  m.observacoes  ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelar() {
    setForm(null);
    setEditId(null);
    setFeedback(null);
  }

  if (registros === null) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  const contagem = FILTROS.reduce((acc, f) => {
    acc[f.id] = f.id === 'todas'
      ? registros.length
      : registros.filter(r => r.status === f.id).length;
    return acc;
  }, {});

  const visiveis = ordenarMetas(
    filtro === 'todas' ? registros : registros.filter(r => r.status === filtro)
  );

  return (
    <>
      {/* ── Botão nova meta ── */}
      {!form && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button className="btn" onClick={abrirNovo}>
            <i className="ti ti-plus" aria-hidden="true"></i> Nova meta
          </button>
        </div>
      )}

      {/* ── Feedback fora do form ── */}
      {!form && feedback && (
        <div style={{
          marginBottom: 12, padding: '9px 13px', borderRadius: 8, fontSize: 12,
          background: feedback.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)',
          color: feedback.tipo === 'ok' ? 'var(--green)' : 'var(--red)',
        }}>
          <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`}
            style={{ marginRight: 5 }} aria-hidden="true"></i>
          {feedback.msg}
        </div>
      )}

      {/* ── Formulário ── */}
      {form && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <div className="card-title">{editId ? 'Editar meta' : 'Nova meta terapêutica'}</div>
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
            {/* Título */}
            <label className="field-label">Título *</label>
            <input value={form.titulo} onChange={sf('titulo')}
              placeholder="Ex: Melhorar constipação, Reduzir fluxo intenso…" />

            {/* Eixo + Prioridade */}
            <div className="grid2" style={{ marginTop: 12 }}>
              <div>
                <label className="field-label">Eixo relacionado</label>
                <select value={form.eixo} onChange={sf('eixo')}>
                  <option value="">— sem eixo —</option>
                  {EIXOS.map(e => <option key={e} value={e}>{e}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Prioridade</label>
                <select value={form.prioridade} onChange={sf('prioridade')}>
                  {PRIORIDADES.map(p => <option key={p.v} value={p.v}>{p.label}</option>)}
                </select>
              </div>
            </div>

            {/* Descrição */}
            <label className="field-label" style={{ marginTop: 12 }}>Descrição</label>
            <textarea rows={2} value={form.descricao} onChange={sf('descricao')}
              placeholder="O que essa meta significa para essa paciente?" />

            {/* Critério */}
            <label className="field-label" style={{ marginTop: 10 }}>Critério de evolução</label>
            <textarea rows={2} value={form.criterio} onChange={sf('criterio')}
              placeholder="Como vamos saber que melhorou? Ex: evacuar diariamente, ferritina > 50…" />

            {/* Status + Data criação */}
            <div className="grid2" style={{ marginTop: 12 }}>
              <div>
                <label className="field-label">Status</label>
                <select value={form.status} onChange={onStatusChange}>
                  {STATUS_META.map(s => <option key={s.v} value={s.v}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="field-label">Data de criação</label>
                <input type="date" value={form.criado_em} onChange={sf('criado_em')} />
              </div>
            </div>

            {/* Datas condicionais */}
            {form.status === 'concluida' && (
              <div style={{ marginTop: 10 }}>
                <label className="field-label">Data de conclusão</label>
                <input type="date" value={form.concluido_em} onChange={sf('concluido_em')}
                  style={{ maxWidth: 200 }} />
              </div>
            )}
            {form.status === 'pausada' && (
              <div style={{ marginTop: 10 }}>
                <label className="field-label">Data de pausa</label>
                <input type="date" value={form.pausado_em} onChange={sf('pausado_em')}
                  style={{ maxWidth: 200 }} />
              </div>
            )}

            {/* Observações */}
            <label className="field-label" style={{ marginTop: 12 }}>Observações clínicas</label>
            <textarea rows={2} value={form.observacoes} onChange={sf('observacoes')}
              placeholder="Contexto clínico, decisões, nuances relevantes…" />

            {feedback && (
              <div style={{
                marginTop: 10, padding: '8px 12px', borderRadius: 6, fontSize: 13,
                background: feedback.tipo === 'ok' ? 'var(--green-bg)' : 'var(--red-bg)',
                color: feedback.tipo === 'ok' ? 'var(--green)' : 'var(--red)',
              }}>
                <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`}
                  style={{ marginRight: 5 }} aria-hidden="true"></i>
                {feedback.msg}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
              <button className="btn" onClick={salvar}
                disabled={busy || !form.titulo.trim() || !form.criado_em}>
                <i className="ti ti-check" aria-hidden="true"></i>
                {busy ? 'Salvando…' : (editId ? 'Salvar alterações' : 'Registrar meta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filtros ── */}
      {!form && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
          {FILTROS.map(f => {
            const n = contagem[f.id] ?? 0;
            const ativo = filtro === f.id;
            return (
              <button key={f.id} onClick={() => setFiltro(f.id)}
                style={{
                  padding: '5px 12px', borderRadius: 20,
                  fontSize: 12, fontWeight: 500,
                  border: '0.5px solid ' + (ativo ? 'var(--dark)' : 'var(--border)'),
                  background: ativo ? 'var(--dark)' : 'var(--white)',
                  color: ativo ? '#fff' : (n === 0 && f.id !== 'todas' ? 'var(--text4)' : 'var(--text2)'),
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                  transition: 'all .15s',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}>
                {f.label}
                {n > 0 && (
                  <span style={{
                    fontSize: 10, fontWeight: 600,
                    background: ativo ? 'rgba(255,255,255,.2)' : 'var(--bg3, #eae4dc)',
                    color: ativo ? '#fff' : 'var(--text3)',
                    borderRadius: 10, padding: '1px 5px',
                  }}>{n}</span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Lista ── */}
      {!form && (
        visiveis.length === 0 ? (
          <div className="card empty-card">
            <div className="empty-sub">
              {filtro === 'todas'
                ? 'Nenhuma meta registrada. Use o botão acima para iniciar.'
                : `Nenhuma meta com status "${FILTROS.find(f => f.id === filtro)?.label}".`}
            </div>
          </div>
        ) : (
          visiveis.map(m => (
            <MetaCard
              key={m.id}
              meta={m}
              editandoId={editId}
              onEditar={() => abrirEditar(m)}
              onExcluir={() => excluir(m)}
            />
          ))
        )
      )}
    </>
  );
}

// ── Card de meta ───────────────────────────────────────────────────────────
const COR_PRIORIDADE = { alta: 'var(--red)', media: 'var(--orange)', baixa: 'var(--text3)' };
const COR_STATUS = {
  ativa:       'var(--blue)',
  em_evolucao: 'var(--green)',
  concluida:   'var(--green)',
  pausada:     'var(--text3)',
};
const BG_STATUS = {
  ativa:       'var(--blue-bg, #eff6ff)',
  em_evolucao: 'var(--green-bg)',
  concluida:   'var(--green-bg)',
  pausada:     'var(--bg3, #eae4dc)',
};
const LABEL_STATUS = {
  ativa: 'Ativa', em_evolucao: 'Em evolução', concluida: 'Concluída', pausada: 'Pausada',
};

function MetaCard({ meta: m, editandoId, onEditar, onExcluir }) {
  const editando = editandoId === m.id;

  return (
    <div className="card" style={{
      marginBottom: 12,
      borderLeft: `3px solid ${COR_PRIORIDADE[m.prioridade] ?? 'transparent'}`,
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
            {/* Badge status */}
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: .4,
              background: BG_STATUS[m.status],
              color: COR_STATUS[m.status],
              padding: '2px 8px', borderRadius: 20,
            }}>
              {LABEL_STATUS[m.status]}
            </span>
            {/* Badge prioridade */}
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: .4,
              color: COR_PRIORIDADE[m.prioridade],
            }}>
              ● {m.prioridade.charAt(0).toUpperCase() + m.prioridade.slice(1)}
            </span>
            {m.eixo && (
              <span style={{
                fontSize: 10, color: 'var(--text3)',
                background: 'var(--bg3, #eae4dc)',
                padding: '2px 7px', borderRadius: 20,
              }}>{m.eixo}</span>
            )}
          </div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>
            {m.titulo}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)' }}>
            Criada em {dataBR(m.criado_em)}
            {m.status === 'concluida' && m.concluido_em && (
              <span style={{ color: 'var(--green)', marginLeft: 8 }}>
                · Concluída em {dataBR(m.concluido_em)}
              </span>
            )}
            {m.status === 'pausada' && m.pausado_em && (
              <span style={{ marginLeft: 8 }}>· Pausada em {dataBR(m.pausado_em)}</span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button className="btn-outline" style={{ fontSize: 12, padding: '3px 10px' }}
            onClick={onEditar}>
            <i className="ti ti-edit" aria-hidden="true"></i> Editar
          </button>
          <button onClick={onExcluir}
            style={{
              background: 'none', border: '0.5px solid var(--border)',
              borderRadius: 6, padding: '3px 8px', cursor: 'pointer', color: 'var(--red)',
            }}>
            <i className="ti ti-trash" style={{ fontSize: 13 }} aria-hidden="true"></i>
          </button>
        </div>
      </div>

      {/* Corpo */}
      <div style={{ padding: '8px 16px 14px' }}>
        {m.descricao && <Secao titulo="Descrição" texto={m.descricao} />}
        {m.criterio  && <Secao titulo="Critério de evolução" texto={m.criterio} />}
        {m.observacoes && <Secao titulo="Observações clínicas" texto={m.observacoes} />}
        {!m.descricao && !m.criterio && !m.observacoes && (
          <div style={{ fontSize: 12, color: 'var(--text4)', fontStyle: 'italic', paddingTop: 6 }}>
            Sem detalhes registrados.
          </div>
        )}
      </div>
    </div>
  );
}

function Secao({ titulo, texto }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 1,
        textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4,
      }}>
        {titulo}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>{texto}</div>
    </div>
  );
}
