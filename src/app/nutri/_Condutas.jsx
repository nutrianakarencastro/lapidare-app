import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';
import { calcularPerfilBiologico } from '../../lib/perfilBiologicoUtils.js';
import { mapearEvidencias } from '../../lib/evidenciasConduta.js';

const ORIGENS = [
  { v: '',         label: '— sem origem —' },
  { v: 'consulta', label: 'Consulta'       },
  { v: 'check-in', label: 'Check-in'       },
  { v: 'revisao',  label: 'Revisão'        },
];

function linhasParaArray(str) {
  return (str ?? '').split('\n').map(s => s.trim()).filter(Boolean);
}

function arrayParaLinhas(arr) {
  return (arr ?? []).join('\n');
}

function formVazio() {
  return {
    data:                  new Date().toISOString().slice(0, 10),
    titulo:                '',
    objetivo_principal:    '',
    objetivos_secundarios: '',
    lista:                 '',
    observacoes:           '',
    is_atual:              true,
    origem:                '',
  };
}

export default function Condutas({ pacienteId, nutriId, pacienteNome }) {
  const [registros, setRegistros] = useState(null);
  const [form, setForm] = useState(null);
  const [editId, setEditId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [perfilResult, setPerfilResult] = useState(null);

  useEffect(() => {
    let active = true;
    async function loadPerfil() {
      const corte = new Date();
      corte.setDate(corte.getDate() - 180);
      const c180 = corte.toISOString().slice(0, 10);
      const [sintomasRes, periodosRes, intestinoRes] = await Promise.all([
        supabase.from('ciclo_sintomas_diarios')
          .select('data, humor, energia, sono, foco, libido, irritabilidade, ansiedade, compulsao, acne, retencao, inchaco, dor_cabeca, dor_pelvica, insonia, acorda_madrugada, choro, intestino')
          .eq('paciente_id', pacienteId).gte('data', c180).order('data', { ascending: false }),
        supabase.from('ciclo_periodos')
          .select('id, inicio, fim')
          .eq('paciente_id', pacienteId).order('inicio', { ascending: false }),
        supabase.from('intestino_logs')
          .select('data, tipo, bristol, evacuou, esvaziamento_incompleto, dor_abdominal, estufamento')
          .eq('paciente_id', pacienteId).eq('tipo', 'diario').gte('data', c180),
      ]);
      if (!active) return;
      setPerfilResult(calcularPerfilBiologico({
        sintomas:      sintomasRes.data  ?? [],
        periodos:      periodosRes.data  ?? [],
        intestinoLogs: intestinoRes.data ?? [],
      }));
    }
    loadPerfil();
    return () => { active = false; };
  }, [pacienteId]);

  async function carregar() {
    const { data } = await supabase.from('condutas')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('nutri_id', nutriId)
      .order('is_atual', { ascending: false })
      .order('data', { ascending: false });
    setRegistros(data ?? []);
  }

  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  const sf = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
  const sc = k => e => setForm(f => ({ ...f, [k]: e.target.checked }));

  async function salvar() {
    setFeedback(null);
    if (!form.titulo.trim()) return setFeedback({ tipo: 'erro', msg: 'Informe um título.' });
    if (!form.data)          return setFeedback({ tipo: 'erro', msg: 'Informe uma data.'  });
    setBusy(true);

    // Ao marcar como atual: desmarca todas as outras desta paciente
    if (form.is_atual) {
      const base = supabase.from('condutas')
        .update({ is_atual: false })
        .eq('paciente_id', pacienteId)
        .eq('nutri_id', nutriId)
        .eq('is_atual', true);
      await (editId ? base.neq('id', editId) : base);
    }

    const payload = {
      paciente_id:           pacienteId,
      nutri_id:              nutriId,
      data:                  form.data,
      titulo:                form.titulo.trim(),
      objetivo_principal:    form.objetivo_principal.trim() || null,
      objetivos_secundarios: linhasParaArray(form.objetivos_secundarios),
      condutas:              linhasParaArray(form.lista),
      observacoes:           form.observacoes.trim() || null,
      is_atual:              form.is_atual,
      origem:                form.origem || null,
    };

    const { error } = editId
      ? await supabase.from('condutas').update(payload).eq('id', editId)
      : await supabase.from('condutas').insert(payload);

    setBusy(false);
    if (error) return setFeedback({ tipo: 'erro', msg: error.message });

    setFeedback({ tipo: 'ok', msg: editId ? 'Conduta atualizada.' : 'Conduta registrada.' });
    setForm(null);
    setEditId(null);
    carregar();
  }

  async function excluir(c) {
    if (!window.confirm(`Excluir conduta "${c.titulo}"?`)) return;
    await supabase.from('condutas').delete().eq('id', c.id);
    carregar();
  }

  function abrirNovo() {
    setEditId(null);
    setFeedback(null);
    setForm(formVazio());
  }

  function abrirEditar(c) {
    setEditId(c.id);
    setFeedback(null);
    setForm({
      data:                  c.data,
      titulo:                c.titulo,
      objetivo_principal:    c.objetivo_principal    ?? '',
      objetivos_secundarios: arrayParaLinhas(c.objetivos_secundarios),
      lista:                 arrayParaLinhas(c.condutas),
      observacoes:           c.observacoes           ?? '',
      is_atual:              c.is_atual,
      origem:                c.origem                ?? '',
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function cancelar() {
    setForm(null);
    setEditId(null);
    setFeedback(null);
  }

  const temAtualOutra = registros?.some(r => r.is_atual && r.id !== editId);

  if (registros === null) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  return (
    <>
      {/* ── Botão nova conduta ── */}
      {!form && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button className="btn" onClick={abrirNovo}>
            <i className="ti ti-plus" aria-hidden="true"></i> Nova conduta
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

      {/* ── Formulário (novo ou edição) ── */}
      {form && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <div>
              <div className="card-title">{editId ? 'Editar conduta' : 'Nova conduta'}</div>
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
            <div className="grid2">
              <div>
                <label className="field-label">Data *</label>
                <input type="date" value={form.data} onChange={sf('data')} />
              </div>
              <div>
                <label className="field-label">Título *</label>
                <input value={form.titulo} onChange={sf('titulo')}
                  placeholder="Ex: Consulta 1 — Fase intestinal" />
              </div>
            </div>

            <label className="field-label" style={{ marginTop: 12 }}>Objetivo principal</label>
            <textarea rows={2} value={form.objetivo_principal} onChange={sf('objetivo_principal')}
              placeholder="Ex: Regular intestino e reduzir estufamento" />

            <label className="field-label" style={{ marginTop: 10 }}>
              Objetivos secundários
              <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>um por linha</span>
            </label>
            <textarea rows={3} value={form.objetivos_secundarios} onChange={sf('objetivos_secundarios')}
              placeholder={'Melhorar energia\nReduzir inflamação'} />

            <label className="field-label" style={{ marginTop: 10 }}>
              Condutas
              <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>uma por linha</span>
            </label>
            <textarea rows={5} value={form.lista} onChange={sf('lista')}
              placeholder={'Aumentar ingestão de fibras\nSuporte digestivo\nAjustar horários das refeições\nSolicitar rastreio intestinal'} />

            <label className="field-label" style={{ marginTop: 10 }}>Observações clínicas</label>
            <textarea rows={3} value={form.observacoes} onChange={sf('observacoes')}
              placeholder="Contexto clínico, dúvidas, decisões importantes…" />

            <label className="field-label" style={{ marginTop: 10 }}>
              Origem
              <span style={{ fontWeight: 400, color: 'var(--text3)', marginLeft: 6 }}>opcional</span>
            </label>
            <select value={form.origem} onChange={sf('origem')} style={{ maxWidth: 200 }}>
              {ORIGENS.map(o => <option key={o.v} value={o.v}>{o.label}</option>)}
            </select>

            <label style={{
              display: 'flex', alignItems: 'flex-start', gap: 9,
              marginTop: 16, cursor: 'pointer',
            }}>
              <input type="checkbox" checked={form.is_atual} onChange={sc('is_atual')}
                style={{ marginTop: 2, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: 'var(--dark)' }}>
                <strong>Marcar como conduta atual</strong>
                {form.is_atual && temAtualOutra && (
                  <span style={{ display: 'block', fontSize: 11, color: 'var(--orange)', marginTop: 2 }}>
                    A conduta anterior perderá esta marcação.
                  </span>
                )}
              </span>
            </label>

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
                disabled={busy || !form.titulo.trim() || !form.data}>
                <i className="ti ti-check" aria-hidden="true"></i>
                {busy ? 'Salvando…' : (editId ? 'Salvar alterações' : 'Registrar conduta')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lista de condutas ── */}
      {registros.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-sub">Nenhuma conduta registrada. Use o botão acima para iniciar.</div>
        </div>
      ) : (
        registros.map(c => (
          <CondutaCard
            key={c.id}
            conduta={c}
            editandoId={editId}
            onEditar={() => abrirEditar(c)}
            onExcluir={() => excluir(c)}
            perfilResult={c.is_atual ? perfilResult : null}
          />
        ))
      )}
    </>
  );
}

// ── Bloco de evidências ───────────────────────────────────────────────────────
function EvidenciasBlock({ evidencias, objetivoPrincipal }) {
  if (!evidencias || evidencias.length === 0) return null;
  return (
    <div style={{
      marginTop: 14, padding: '12px 14px', borderRadius: 8,
      background: 'var(--bg2)',
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
        color: 'var(--text4)', marginBottom: objetivoPrincipal ? 5 : 8,
      }}>
        Registros que apontam para este objetivo
      </div>
      {objetivoPrincipal && (
        <div style={{
          fontSize: 11, color: 'var(--text3)', fontStyle: 'italic',
          marginBottom: 9, lineHeight: 1.4,
        }}>
          "{objetivoPrincipal}"
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {evidencias.map((ev, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <span style={{
              fontSize: 9, fontWeight: 600, letterSpacing: .3, textTransform: 'uppercase',
              background: '#fef9e7', color: 'var(--amber)',
              padding: '2px 7px', borderRadius: 20, flexShrink: 0, marginTop: 1, whiteSpace: 'nowrap',
            }}>
              {ev.label}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
              {ev.detalhe}
            </span>
          </div>
        ))}
      </div>
      <div style={{
        marginTop: 10, fontSize: 9, color: 'var(--text4)', fontStyle: 'italic', lineHeight: 1.5,
      }}>
        Baseado nos registros dos últimos 180 dias. Não representa avaliação diagnóstica. A interpretação clínica é da nutricionista.
      </div>
    </div>
  );
}

// ── Card de conduta ────────────────────────────────────────────────────────
function CondutaCard({ conduta: c, editandoId, onEditar, onExcluir, perfilResult }) {
  const editando  = editandoId === c.id;
  const evidencias = perfilResult ? mapearEvidencias({ conduta: c, perfilResult }) : [];

  return (
    <div className="card" style={{
      marginBottom: 12,
      borderLeft: c.is_atual ? '3px solid var(--green)' : '3px solid transparent',
      opacity: editandoId && !editando ? 0.55 : 1,
      transition: 'opacity .2s',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        padding: '14px 16px 0', gap: 10,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
            {c.is_atual && (
              <span style={{
                fontSize: 10, fontWeight: 600, letterSpacing: .5,
                background: 'var(--green-bg)', color: 'var(--green)',
                padding: '2px 8px', borderRadius: 20,
              }}>
                Atual
              </span>
            )}
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)' }}>{c.titulo}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            {dataBR(c.data)}
            {c.origem && (
              <span style={{ marginLeft: 8, textTransform: 'capitalize' }}>· {c.origem}</span>
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
        {c.objetivo_principal && (
          <Secao titulo="Objetivo principal" texto={c.objetivo_principal} />
        )}
        {c.objetivos_secundarios?.length > 0 && (
          <Secao titulo="Objetivos secundários" lista={c.objetivos_secundarios} />
        )}
        {c.condutas?.length > 0 && (
          <Secao titulo="Condutas" lista={c.condutas} />
        )}
        {c.observacoes && (
          <Secao titulo="Observações clínicas" texto={c.observacoes} />
        )}
        {!c.objetivo_principal && !c.objetivos_secundarios?.length &&
         !c.condutas?.length && !c.observacoes && (
          <div style={{ fontSize: 12, color: 'var(--text4)', fontStyle: 'italic', paddingTop: 6 }}>
            Sem detalhes registrados.
          </div>
        )}
        <EvidenciasBlock evidencias={evidencias} objetivoPrincipal={c.objetivo_principal} />
      </div>
    </div>
  );
}

function Secao({ titulo, texto, lista }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{
        fontSize: 10, fontWeight: 600, letterSpacing: 1,
        textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4,
      }}>
        {titulo}
      </div>
      {texto && (
        <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>{texto}</div>
      )}
      {lista && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {lista.map((item, i) => (
            <div key={i} style={{
              fontSize: 13, color: 'var(--text2)', lineHeight: 1.5,
              display: 'flex', alignItems: 'baseline', gap: 7,
            }}>
              <span style={{ color: 'var(--text3)', flexShrink: 0, fontWeight: 500 }}>·</span>
              {item}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
