import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';
import { PROTOCOLOS_RUNTIME } from '../../lib/protocolosRuntime.js';

const inpSt = {
  width: '100%', boxSizing: 'border-box',
  padding: '8px 10px', borderRadius: 6,
  border: '0.5px solid var(--border)',
  fontSize: 13, fontFamily: 'var(--font-sans)',
  background: 'var(--white)', color: 'var(--dark)',
};

function labelFreqJornada(tipo, valor) {
  if (tipo === 'diaria')        return 'Todo dia';
  if (tipo === 'dias_uteis')    return 'Dias úteis';
  if (tipo === 'semanal')       return valor ? `${valor}× por semana` : 'Semanal';
  if (tipo === 'personalizada') return valor || 'Personalizada';
  return null;
}

function semanaAtualDe(dataInicio) {
  if (!dataInicio) return 1;
  const diff = Math.floor((new Date() - new Date(dataInicio + 'T12:00:00')) / 86400000);
  return Math.max(1, Math.ceil((diff + 1) / 7));
}

function novaJornada(nutriId, pacienteId) {
  return {
    novo: true,
    paciente_id: pacienteId,
    nutri_id: nutriId,
    fase: 1,
    nome_fase: 'Fase 1',
    objetivo_fase: '',
    consulta_numero: '',
    data_inicio_fase: new Date().toISOString().slice(0, 10),
    duracao_semanas_prevista: 4,
    metas_semana: [],
    proximo_marco: '',
    data_proximo_marco: '',
    evolucao_resumida: '',
    observacoes: '',
  };
}

export default function Jornada({ pacienteId, nutriId, pacienteNome }) {
  const navigate = useNavigate();
  const [jornada,   setJornada]   = useState(undefined);
  const [historico, setHistorico] = useState([]);
  const [form,      setForm]      = useState(null);
  const [novaMeta,         setNovaMeta]         = useState('');
  const [novaMetaHabitoId, setNovaMetaHabitoId] = useState('');
  const [habitosPaciente,  setHabitosPaciente]  = useState([]);
  const [busy,      setBusy]      = useState(false);
  const [aviso,     setAviso]     = useState(null);
  const [encerrando, setEncerrando] = useState(false);
  const [histAberto, setHistAberto] = useState(false);
  const [metasAtivas,         setMetasAtivas]         = useState([]);
  const [estrategiasAtivas,   setEstrategiasAtivas]   = useState([]);
  const [condutaAtual,        setCondutaAtual]        = useState(null);
  const [protocolosAtivos,    setProtocolosAtivos]    = useState([]);
  const [metasPorFase,        setMetasPorFase]        = useState({});
  const [estrategiasPorFase,  setEstrategiasPorFase]  = useState({});

  async function carregar() {
    const [jRes, hRes, habRes, metasRes, estratRes, condutaRes, protRes, metasFaseRes, estratFaseRes] = await Promise.all([
      supabase.from('jornadas').select('*').eq('paciente_id', pacienteId).maybeSingle(),
      supabase.from('jornada_historico').select('*')
        .eq('paciente_id', pacienteId)
        .order('data_inicio_fase', { ascending: false }),
      supabase.from('habitos').select('id, nome, emoji, tipo')
        .eq('paciente_id', pacienteId).eq('ativo', true).order('ordem'),
      supabase.from('metas_terapeuticas')
        .select('id, titulo, eixo, prioridade, status, fase_uuid_origem')
        .eq('paciente_id', pacienteId).eq('nutri_id', nutriId)
        .in('status', ['ativa', 'em_evolucao'])
        .order('prioridade'),
      supabase.from('estrategias')
        .select('id, titulo, categoria, frequencia_tipo, frequencia_valor, fase_uuid_origem')
        .eq('paciente_id', pacienteId).eq('nutri_id', nutriId)
        .eq('status', 'ativa')
        .order('created_at', { ascending: false }),
      supabase.from('condutas')
        .select('id, titulo, objetivo_principal, data')
        .eq('paciente_id', pacienteId).eq('nutri_id', nutriId)
        .eq('is_atual', true)
        .limit(1).maybeSingle(),
      supabase.from('paciente_protocolos')
        .select('id, protocolo_id, aplicado_em')
        .eq('paciente_id', pacienteId)
        .eq('status', 'ativo')
        .order('aplicado_em', { ascending: true }),
      supabase.from('metas_terapeuticas')
        .select('id, titulo, eixo, status, fase_uuid_origem')
        .eq('paciente_id', pacienteId).eq('nutri_id', nutriId)
        .not('fase_uuid_origem', 'is', null),
      supabase.from('estrategias')
        .select('id, titulo, categoria, status, fase_uuid_origem')
        .eq('paciente_id', pacienteId).eq('nutri_id', nutriId)
        .not('fase_uuid_origem', 'is', null),
    ]);
    const j = jRes.data ?? null;
    setJornada(j);
    setHistorico(hRes.data ?? []);
    setForm(j ? { ...j, novo: false } : null);
    setHabitosPaciente(habRes.data ?? []);
    setMetasAtivas(metasRes.data ?? []);
    setEstrategiasAtivas(estratRes.data ?? []);
    setCondutaAtual(condutaRes.data ?? null);
    setProtocolosAtivos(protRes.data ?? []);
    const porFase = {};
    for (const m of metasFaseRes.data ?? []) {
      if (!porFase[m.fase_uuid_origem]) porFase[m.fase_uuid_origem] = [];
      porFase[m.fase_uuid_origem].push(m);
    }
    setMetasPorFase(porFase);
    const estratPorFase = {};
    for (const e of estratFaseRes.data ?? []) {
      if (!estratPorFase[e.fase_uuid_origem]) estratPorFase[e.fase_uuid_origem] = [];
      estratPorFase[e.fase_uuid_origem].push(e);
    }
    setEstrategiasPorFase(estratPorFase);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  const sv = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function adicionarMeta() {
    const texto = novaMeta.trim();
    if (!texto) return;
    sv('metas_semana', [...(form.metas_semana ?? []), {
      id:        crypto.randomUUID(),
      texto,
      concluida: false,
      habito_id: novaMetaHabitoId || null,
    }]);
    setNovaMeta('');
    setNovaMetaHabitoId('');
  }

  function removerMeta(id) {
    sv('metas_semana', (form.metas_semana ?? []).filter(m => m.id !== id));
  }

  function feedback(msg) {
    setAviso(msg);
    setTimeout(() => setAviso(null), 3500);
  }

  async function salvar() {
    if (!form.nome_fase?.trim())    { setAviso('Informe o nome da fase.');        return; }
    if (!form.data_inicio_fase)     { setAviso('Informe a data de início da fase.'); return; }
    setBusy(true);
    const payload = {
      fase:                     Number(form.fase) || 1,
      nome_fase:                form.nome_fase.trim(),
      objetivo_fase:            form.objetivo_fase?.trim() || null,
      consulta_numero:          form.consulta_numero !== '' && form.consulta_numero != null ? Number(form.consulta_numero) : null,
      data_inicio_fase:         form.data_inicio_fase,
      duracao_semanas_prevista: Number(form.duracao_semanas_prevista) || 4,
      metas_semana:             form.metas_semana ?? [],
      proximo_marco:            form.proximo_marco?.trim() || null,
      data_proximo_marco:       form.data_proximo_marco || null,
      evolucao_resumida:        form.evolucao_resumida?.trim() || null,
      observacoes:              form.observacoes?.trim() || null,
      updated_at:               new Date().toISOString(),
    };

    const { error } = form.novo
      ? await supabase.from('jornadas').insert({ ...payload, paciente_id: pacienteId, nutri_id: nutriId })
      : await supabase.from('jornadas').update(payload).eq('id', jornada.id);

    setBusy(false);
    if (error) { feedback('Erro ao salvar: ' + error.message); return; }
    feedback('Jornada salva.');
    carregar();
  }

  async function encerrarFase(iniciarNova) {
    setBusy(true);
    const { error } = await supabase.rpc('nutri_encerrar_fase', {
      p_jornada_id:        jornada.id,
      p_iniciar_nova:      iniciarNova,
      p_objetivo_fase:     form.objetivo_fase?.trim()     || null,
      p_evolucao_resumida: form.evolucao_resumida?.trim() || null,
      p_observacoes:       form.observacoes?.trim()       || null,
      p_metas_semana:      form.metas_semana ?? [],
    });
    setBusy(false);
    if (error) { feedback('Erro ao encerrar fase: ' + error.message); return; }
    feedback(iniciarNova
      ? 'Fase encerrada. Nova fase iniciada.'
      : 'Acompanhamento encerrado. Histórico preservado.'
    );
    setEncerrando(false);
    carregar();
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (jornada === undefined) {
    return (
      <div className="card">
        <div className="card-body" style={{ color: 'var(--text3)', fontSize: 13 }}>Carregando…</div>
      </div>
    );
  }

  const primeiroNome = pacienteNome?.split(' ')[0] ?? 'paciente';

  const metasDaFase = metasAtivas.filter(
    m => m.fase_uuid_origem && jornada?.fase_uuid && m.fase_uuid_origem === jornada.fase_uuid
  );
  const metasGerais = metasAtivas.filter(m => !m.fase_uuid_origem);

  const estrategiasDaFase = estrategiasAtivas.filter(
    e => e.fase_uuid_origem && jornada?.fase_uuid && e.fase_uuid_origem === jornada.fase_uuid
  );
  const estrategiasGerais = estrategiasAtivas.filter(e => !e.fase_uuid_origem);

  return (
    <>
      {/* ── Aviso ─────────────────────────────────────────────────────────── */}
      {aviso && (
        <div style={{
          marginBottom: 12, padding: '9px 13px', borderRadius: 8, fontSize: 12,
          background: aviso.startsWith('Erro') ? 'var(--red-bg, #ffeaea)' : 'var(--green-bg)',
          color: aviso.startsWith('Erro') ? 'var(--red)' : 'var(--green)',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <i className={`ti ti-${aviso.startsWith('Erro') ? 'alert-circle' : 'check'}`} aria-hidden="true" />
          {aviso}
        </div>
      )}

      {/* ── Formulário da fase ativa ───────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">
              {jornada ? `Jornada de ${primeiroNome}` : `Iniciar jornada de ${primeiroNome}`}
            </div>
            <div className="card-sub">
              {jornada
                ? `Fase ${jornada.fase} · Semana ${semanaAtualDe(jornada.data_inicio_fase)} de ${jornada.duracao_semanas_prevista}`
                : 'Nenhuma jornada ativa — crie a primeira fase abaixo'}
            </div>
          </div>
          {jornada && (
            <button
              className="btn"
              onClick={salvar}
              disabled={busy}
            >
              {busy ? 'Salvando…' : 'Salvar'}
            </button>
          )}
        </div>

        <div className="card-body">
          {/* Se não há jornada, mostra só o botão de iniciar */}
          {!jornada && !form && (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <i className="ti ti-route" style={{ fontSize: 32, color: 'var(--text4)', display: 'block', marginBottom: 10 }} aria-hidden="true" />
              <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 16 }}>
                Crie a primeira fase para esta paciente.
              </div>
              <button className="btn" onClick={() => setForm(novaJornada(nutriId, pacienteId))}>
                <i className="ti ti-plus" aria-hidden="true" /> Iniciar jornada
              </button>
            </div>
          )}

          {form && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Fase, consulta e nome */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Fase nº</div>
                  <input
                    type="number" min="1" value={form.fase}
                    onChange={e => sv('fase', Number(e.target.value))}
                    style={{ ...inpSt }}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Consulta nº</div>
                  <input
                    type="number" min="1" placeholder="—"
                    value={form.consulta_numero ?? ''}
                    onChange={e => sv('consulta_numero', e.target.value)}
                    style={inpSt}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Nome da fase</div>
                  <input
                    type="text" placeholder="Ex: Fase 1 — Diagnóstico"
                    value={form.nome_fase ?? ''}
                    onChange={e => sv('nome_fase', e.target.value)}
                    style={inpSt}
                  />
                </div>
              </div>

              {/* Objetivo */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Objetivo da fase</div>
                <textarea
                  placeholder="O que você quer alcançar nesta fase?"
                  value={form.objetivo_fase ?? ''}
                  onChange={e => sv('objetivo_fase', e.target.value)}
                  rows={2}
                  style={{ ...inpSt, resize: 'vertical', minHeight: 52, lineHeight: 1.5 }}
                />
              </div>

              {/* Temporalidade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Início da fase</div>
                  <input
                    type="date" value={form.data_inicio_fase ?? ''}
                    onChange={e => sv('data_inicio_fase', e.target.value)}
                    style={inpSt}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Duração prevista (semanas)</div>
                  <input
                    type="number" min="1" max="52"
                    value={form.duracao_semanas_prevista ?? 4}
                    onChange={e => sv('duracao_semanas_prevista', Number(e.target.value))}
                    style={inpSt}
                  />
                </div>
              </div>

              {/* Metas da semana */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Metas da semana</div>
                {(form.metas_semana ?? []).length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
                    {(form.metas_semana ?? []).map(m => {
                      const hab = m.habito_id
                        ? habitosPaciente.find(h => h.id === m.habito_id)
                        : null;
                      return (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '7px 10px', borderRadius: 7,
                          background: 'var(--bg2)', border: '0.5px solid var(--border)',
                        }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <span style={{ fontSize: 13, color: 'var(--dark)' }}>{m.texto}</span>
                            {hab ? (
                              <span style={{
                                marginLeft: 8, fontSize: 10, padding: '1px 7px', borderRadius: 20,
                                background: 'var(--gold-soft, var(--white))',
                                border: '0.5px solid var(--gold, var(--border))',
                                color: 'var(--gold-deep)', fontWeight: 500,
                              }}>
                                {hab.emoji ?? '●'} {hab.nome}
                              </span>
                            ) : (
                              <span style={{
                                marginLeft: 8, fontSize: 10, padding: '1px 7px', borderRadius: 20,
                                background: 'var(--bg2)', color: 'var(--text4)',
                                border: '0.5px solid var(--border)',
                              }}>
                                meta livre
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => removerMeta(m.id)}
                            style={{
                              background: 'none', border: 'none', cursor: 'pointer',
                              color: 'var(--text4)', fontSize: 14, padding: '0 2px',
                            }}>
                            <i className="ti ti-x" aria-hidden="true" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    placeholder="Descrição da meta…"
                    value={novaMeta}
                    onChange={e => setNovaMeta(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), adicionarMeta())}
                    style={{ ...inpSt, flex: '1 1 160px' }}
                  />
                  {habitosPaciente.length > 0 && (
                    <select
                      value={novaMetaHabitoId}
                      onChange={e => setNovaMetaHabitoId(e.target.value)}
                      style={{ ...inpSt, flex: '0 0 auto', maxWidth: 180 }}
                    >
                      <option value="">Meta livre</option>
                      {habitosPaciente.map(h => (
                        <option key={h.id} value={h.id}>
                          {h.emoji ?? '●'} {h.nome}
                        </option>
                      ))}
                    </select>
                  )}
                  <button className="btn-outline" onClick={adicionarMeta} style={{ whiteSpace: 'nowrap' }}>
                    <i className="ti ti-plus" aria-hidden="true" /> Adicionar
                  </button>
                </div>
              </div>

              {/* Próximo marco */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Próximo marco</div>
                  <input
                    type="text" placeholder="Ex: Consulta de retorno"
                    value={form.proximo_marco ?? ''}
                    onChange={e => sv('proximo_marco', e.target.value)}
                    style={inpSt}
                  />
                </div>
                <div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Data do marco</div>
                  <input
                    type="date" value={form.data_proximo_marco ?? ''}
                    onChange={e => sv('data_proximo_marco', e.target.value)}
                    style={inpSt}
                  />
                </div>
              </div>

              {/* Evolução resumida — visível à paciente */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  Evolução resumida
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 10,
                    background: 'var(--green-bg)', color: 'var(--green)',
                  }}>visível à paciente</span>
                </div>
                <textarea
                  placeholder="Um texto motivacional ou resumo do que a paciente conquistou…"
                  value={form.evolucao_resumida ?? ''}
                  onChange={e => sv('evolucao_resumida', e.target.value)}
                  rows={3}
                  style={{ ...inpSt, resize: 'vertical', minHeight: 68, lineHeight: 1.5 }}
                />
              </div>

              {/* Observações — interno */}
              <div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                  Observações internas
                  <span style={{
                    fontSize: 9, padding: '1px 6px', borderRadius: 10,
                    background: 'var(--bg2)', color: 'var(--text3)',
                  }}>só você vê</span>
                </div>
                <textarea
                  placeholder="Anotações clínicas, impressões da última consulta…"
                  value={form.observacoes ?? ''}
                  onChange={e => sv('observacoes', e.target.value)}
                  rows={3}
                  style={{ ...inpSt, resize: 'vertical', minHeight: 68, lineHeight: 1.5 }}
                />
              </div>

              {/* Botões */}
              <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                {form.novo ? (
                  <button className="btn" onClick={salvar} disabled={busy} style={{ flex: 1 }}>
                    {busy ? 'Salvando…' : 'Iniciar jornada'}
                  </button>
                ) : (
                  <>
                    <button className="btn" onClick={salvar} disabled={busy} style={{ flex: 1 }}>
                      {busy ? 'Salvando…' : 'Salvar alterações'}
                    </button>
                    <button
                      onClick={() => setEncerrando(true)}
                      disabled={busy}
                      style={{
                        padding: '8px 14px', borderRadius: 7, cursor: 'pointer',
                        background: 'none', border: '0.5px solid var(--border)',
                        fontSize: 12, color: 'var(--text3)', fontFamily: 'var(--font-sans)',
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}>
                      <i className="ti ti-flag-check" aria-hidden="true" /> Encerrar fase
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Histórico de fases ────────────────────────────────────────────── */}
      {historico.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header" style={{ cursor: 'pointer' }} onClick={() => setHistAberto(h => !h)}>
            <div>
              <div className="card-title">Histórico de fases</div>
              <div className="card-sub">{historico.length} fase{historico.length !== 1 ? 's' : ''} encerrada{historico.length !== 1 ? 's' : ''}</div>
            </div>
            <i className={`ti ti-chevron-${histAberto ? 'up' : 'down'}`} style={{ color: 'var(--text3)', fontSize: 16 }} aria-hidden="true" />
          </div>

          {histAberto && (
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {historico.map(h => {
                const metasDaFaseHist      = h.fase_uuid ? (metasPorFase[h.fase_uuid]      ?? []) : [];
                const estrategiasDaFaseHist = h.fase_uuid ? (estrategiasPorFase[h.fase_uuid] ?? []) : [];
                return (
                <div key={h.id} style={{
                  padding: '12px 14px', borderRadius: 10,
                  border: '0.5px solid var(--border)', background: 'var(--white)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                      background: 'var(--bg2)', color: 'var(--text3)',
                    }}>Fase {h.fase}</span>
                    {h.consulta_numero != null && (
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 20,
                        background: 'var(--bg2)', color: 'var(--text3)',
                      }}>Consulta {h.consulta_numero}</span>
                    )}
                    <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)' }}>{h.nome_fase}</span>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text3)' }}>
                      {h.semanas_cumpridas} sem.
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                    {dataBR(h.data_inicio_fase)} → {dataBR(h.data_fim_fase)}
                  </div>
                  {h.objetivo_fase && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 4 }}>{h.objetivo_fase}</div>
                  )}
                  {h.observacoes && (
                    <div style={{
                      marginTop: 6, padding: '6px 8px', borderRadius: 6,
                      background: 'var(--bg2)', fontSize: 11, color: 'var(--text3)',
                      fontStyle: 'italic',
                    }}>
                      {h.observacoes}
                    </div>
                  )}
                  {metasDaFaseHist.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--border)' }}>
                      <div style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
                        textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 5,
                      }}>
                        Objetivos terapêuticos desta fase
                      </div>
                      {metasDaFaseHist.map(m => (
                        <div key={m.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 12, color: 'var(--text2)', marginBottom: 3,
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                            background: m.status === 'concluida' ? 'var(--green)'
                                      : m.status === 'pausada'   ? 'var(--text4)'
                                      : 'var(--blue)',
                          }} />
                          <span style={{
                            flex: 1,
                            textDecoration: m.status === 'concluida' ? 'line-through' : 'none',
                            opacity: m.status === 'pausada' ? 0.6 : 1,
                          }}>
                            {m.titulo}
                          </span>
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: '1px 6px',
                            borderRadius: 10, flexShrink: 0,
                            background: m.status === 'concluida' ? 'var(--green-bg)'
                                      : m.status === 'pausada'   ? 'var(--bg2)'
                                      : 'var(--blue-bg, #eff6ff)',
                            color:      m.status === 'concluida' ? 'var(--green)'
                                      : m.status === 'pausada'   ? 'var(--text3)'
                                      : 'var(--blue)',
                          }}>
                            {m.status === 'concluida' ? 'Concluída'
                            : m.status === 'pausada'   ? 'Pausada'
                            : 'Ativa'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                  {estrategiasDaFaseHist.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '0.5px solid var(--border)' }}>
                      <div style={{
                        fontSize: 10, fontWeight: 600, letterSpacing: '.06em',
                        textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 5,
                      }}>
                        Estratégias utilizadas nesta fase
                      </div>
                      {estrategiasDaFaseHist.map(e => (
                        <div key={e.id} style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          fontSize: 12, color: 'var(--text2)', marginBottom: 3,
                        }}>
                          <span style={{
                            width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
                            background: e.status === 'encerrada' ? 'var(--text4)' : 'var(--blue)',
                          }} />
                          <span style={{
                            flex: 1,
                            opacity: e.status === 'encerrada' ? 0.7 : 1,
                          }}>
                            {e.titulo}
                          </span>
                          {e.categoria && (
                            <span style={{ fontSize: 9, color: 'var(--text4)' }}>{e.categoria}</span>
                          )}
                          <span style={{
                            fontSize: 9, fontWeight: 600, padding: '1px 6px',
                            borderRadius: 10, flexShrink: 0,
                            background: e.status === 'encerrada' ? 'var(--bg2)' : 'var(--blue-bg, #eff6ff)',
                            color:      e.status === 'encerrada' ? 'var(--text3)' : 'var(--blue)',
                          }}>
                            {e.status === 'encerrada' ? 'Encerrada' : 'Ativa'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Contexto clínico desta fase ──────────────────────────────────── */}
      {(protocolosAtivos.length > 0 || metasAtivas.length > 0 || estrategiasAtivas.length > 0 || condutaAtual) && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Contexto clínico desta fase</div>
              <div className="card-sub">O que está em curso neste momento do tratamento</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Protocolos que orientam esta fase */}
            {protocolosAtivos.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '.08em',
                  textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6,
                }}>
                  Protocolos que orientam esta fase · {protocolosAtivos.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {protocolosAtivos.map(row => {
                    const info = PROTOCOLOS_RUNTIME[row.protocolo_id];
                    return (
                      <div key={row.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 12px', borderRadius: 8,
                        background: 'var(--bg2)', border: '0.5px solid var(--border)',
                      }}>
                        <i className="ti ti-file-medical" style={{ fontSize: 15, color: 'var(--gold-deep)', flexShrink: 0 }} aria-hidden="true" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)' }}>
                            {info?.titulo ?? row.protocolo_id}
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 1 }}>
                            Aplicado em {dataBR(row.aplicado_em)}
                          </div>
                        </div>
                        <button
                          onClick={() => navigate('/nutri/protocolos', { state: { protocoloId: row.protocolo_id } })}
                          style={{
                            background: 'none', border: '0.5px solid var(--border)',
                            borderRadius: 6, padding: '4px 10px', cursor: 'pointer',
                            fontSize: 11, color: 'var(--text2)', fontFamily: 'var(--font-sans)',
                            display: 'inline-flex', alignItems: 'center', gap: 4,
                            whiteSpace: 'nowrap', flexShrink: 0,
                          }}>
                          Ver <i className="ti ti-arrow-right" style={{ fontSize: 10 }} aria-hidden="true" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Conduta atual */}
            {condutaAtual && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                  Conduta atual
                </div>
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--bg2)', border: '0.5px solid var(--border)' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: condutaAtual.objetivo_principal ? 3 : 0 }}>
                    {condutaAtual.titulo}
                  </div>
                  {condutaAtual.objetivo_principal && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                      {condutaAtual.objetivo_principal}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 4 }}>
                    {dataBR(condutaAtual.data)}
                  </div>
                </div>
              </div>
            )}

            {/* Objetivos terapêuticos desta fase */}
            {metasDaFase.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                  Objetivos terapêuticos desta fase · {metasDaFase.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {metasDaFase.map(m => <MetaAtivaRow key={m.id} m={m} />)}
                </div>
              </div>
            )}

            {/* Metas terapêuticas gerais (sem fase vinculada) */}
            {metasGerais.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                  Metas terapêuticas gerais · {metasGerais.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {metasGerais.map(m => <MetaAtivaRow key={m.id} m={m} />)}
                </div>
              </div>
            )}

            {/* Estratégias desta fase */}
            {estrategiasDaFase.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                  Estratégias desta fase · {estrategiasDaFase.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {estrategiasDaFase.map(e => <EstrategiaAtivaRow key={e.id} e={e} />)}
                </div>
              </div>
            )}

            {/* Estratégias ativas gerais (sem fase vinculada) */}
            {estrategiasGerais.length > 0 && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                  Estratégias ativas · {estrategiasGerais.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {estrategiasGerais.map(e => <EstrategiaAtivaRow key={e.id} e={e} />)}
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── Modal encerrar fase ───────────────────────────────────────────── */}
      {encerrando && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(28,23,18,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 100, padding: 24,
        }}>
          <div style={{
            background: 'var(--white)', borderRadius: 16, padding: 24,
            maxWidth: 360, width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,.18)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>Encerrar fase {form?.fase}?</div>
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20, lineHeight: 1.5 }}>
              A fase atual será arquivada no histórico. Os dados salvos no formulário serão preservados.
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                className="btn"
                onClick={() => encerrarFase(true)}
                disabled={busy}
                style={{ justifyContent: 'center' }}>
                <i className="ti ti-arrow-right" aria-hidden="true" />
                {busy ? 'Arquivando…' : 'Encerrar e iniciar próxima fase'}
              </button>
              <button
                onClick={() => encerrarFase(false)}
                disabled={busy}
                style={{
                  padding: '10px', borderRadius: 8, cursor: 'pointer',
                  background: 'none', border: '0.5px solid var(--border)',
                  fontSize: 13, color: 'var(--text3)', fontFamily: 'var(--font-sans)',
                }}>
                {busy ? '…' : 'Encerrar acompanhamento'}
              </button>
              <button
                onClick={() => setEncerrando(false)}
                disabled={busy}
                style={{
                  padding: '8px', borderRadius: 8, cursor: 'pointer',
                  background: 'none', border: 'none',
                  fontSize: 12, color: 'var(--text4)', fontFamily: 'var(--font-sans)',
                }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Linha de meta ativa (reutilizada nas duas seções do contexto clínico) ────
function MetaAtivaRow({ m }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', borderRadius: 7,
      background: 'var(--bg2)', border: '0.5px solid var(--border)',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
        background: { alta: 'var(--red)', media: 'var(--orange)', baixa: 'var(--text3)' }[m.prioridade] ?? 'var(--text3)',
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--dark)', fontWeight: 500 }}>{m.titulo}</div>
        {m.eixo && (
          <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{m.eixo}</div>
        )}
      </div>
      <span style={{
        fontSize: 9, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
        background: m.status === 'em_evolucao' ? 'var(--green-bg)' : 'var(--blue-bg, #eff6ff)',
        color:      m.status === 'em_evolucao' ? 'var(--green)'    : 'var(--blue)',
      }}>
        {m.status === 'em_evolucao' ? 'Em evolução' : 'Ativa'}
      </span>
    </div>
  );
}

// ── Linha de estratégia ativa (contexto clínico desta fase) ──────────────────
function EstrategiaAtivaRow({ e }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '8px 10px', borderRadius: 7,
      background: 'var(--bg2)', border: '0.5px solid var(--border)',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, color: 'var(--dark)', fontWeight: 500 }}>{e.titulo}</div>
        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>
          {[e.categoria, labelFreqJornada(e.frequencia_tipo, e.frequencia_valor)].filter(Boolean).join(' · ')}
        </div>
      </div>
    </div>
  );
}
