import { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';
import {
  calcularCruzamentos,
  calcularJanelaBaseline,
  duracaoDias,
} from '../../lib/estrategiasUtils.js';

const CATEGORIAS = [
  'Alimentação', 'Sono', 'Suplementação', 'Movimento',
  'Intestino', 'Bem-estar emocional', 'Autocuidado',
];

const FREQ_TIPOS = [
  { v: 'diaria',        l: 'Todo dia' },
  { v: 'dias_uteis',    l: 'Dias úteis (seg–sex)' },
  { v: 'semanal',       l: 'X vezes por semana' },
  { v: 'personalizada', l: 'Personalizada' },
];

const MAX_ATIVAS = 3;

function labelFreq(tipo, valor) {
  if (tipo === 'diaria')        return 'Todo dia';
  if (tipo === 'dias_uteis')    return 'Dias úteis (seg–sex)';
  if (tipo === 'semanal')       return valor ? `${valor}× por semana` : 'Semanal';
  if (tipo === 'personalizada') return valor || 'Personalizada';
  return '—';
}

function labelAconteceu(v) {
  return { sim: 'Sim', parcialmente: 'Parcialmente', nao: 'Não aconteceu' }[v] ?? v;
}

function labelDificuldade(v) {
  return { facil: 'Fácil', desafiador: 'Desafiador', muito_dificil: 'Muito difícil' }[v] ?? '—';
}

function periodo(e) {
  if (!e.data_inicio) return '';
  const inicio = dataBR(e.data_inicio);
  return e.data_fim ? `${inicio} → ${dataBR(e.data_fim)}` : `A partir de ${inicio}`;
}

function formVazio() {
  return {
    titulo: '', objetivo: '', categoria: '',
    frequencia_tipo: 'diaria', frequencia_valor: '',
    data_inicio: new Date().toISOString().slice(0, 10),
    data_fim: '',
    mensagem_paciente: '', observacoes_nutri: '',
  };
}

function textoDir(direcao) {
  return {
    aumento:      '↑ valores mais altos observados',
    reducao:      '↓ valores mais baixos observados',
    estavel:      '→ sem variação expressiva',
    sem_baseline: '— sem dados anteriores para comparação',
  }[direcao] ?? '—';
}

function corDir(direcao) {
  return {
    aumento:      'var(--blue)',
    reducao:      'var(--text2)',
    estavel:      'var(--text3)',
    sem_baseline: 'var(--text4)',
  }[direcao] ?? 'var(--text3)';
}

export default function Estrategias({ pacienteId, nutriId, pacienteNome }) {
  const [ativas,    setAtivas]    = useState(null);
  const [historico, setHistorico] = useState([]);
  const [form,      setForm]      = useState(null);
  const [editId,    setEditId]    = useState(null);
  const [encerrando, setEncerrando] = useState(null);
  const [logsAbertos,  setLogsAbertos]  = useState({});
  const [obsAbertos,   setObsAbertos]   = useState({});
  const [obsLoading,   setObsLoading]   = useState({});
  const [busy,     setBusy]     = useState(false);
  const [feedback, setFeedback] = useState(null);
  const perfilCicloRef = useRef(null);

  async function carregar() {
    const { data } = await supabase
      .from('estrategias')
      .select('*')
      .eq('paciente_id', pacienteId)
      .eq('nutri_id', nutriId)
      .order('created_at', { ascending: false });
    const lista = data ?? [];
    setAtivas(lista.filter(e => e.status === 'ativa'));
    setHistorico(lista.filter(e => e.status === 'encerrada'));
  }

  useEffect(() => { carregar(); }, [pacienteId, nutriId]);

  const sf = k => ev => setForm(f => ({ ...f, [k]: ev.target.value }));

  async function salvar() {
    setFeedback(null);
    if (!form.titulo.trim()) return setFeedback({ tipo: 'erro', msg: 'Informe o título.' });
    if (!form.data_inicio)   return setFeedback({ tipo: 'erro', msg: 'Informe a data de início.' });
    setBusy(true);
    const mostraValor = ['semanal', 'personalizada'].includes(form.frequencia_tipo);
    const payload = {
      nutri_id:          nutriId,
      paciente_id:       pacienteId,
      titulo:            form.titulo.trim(),
      objetivo:          form.objetivo.trim()          || null,
      categoria:         form.categoria                || null,
      frequencia_tipo:   form.frequencia_tipo          || null,
      frequencia_valor:  mostraValor ? (form.frequencia_valor.trim() || null) : null,
      data_inicio:       form.data_inicio,
      data_fim:          form.data_fim                 || null,
      mensagem_paciente: form.mensagem_paciente.trim() || null,
      observacoes_nutri: form.observacoes_nutri.trim() || null,
    };
    if (editId) {
      await supabase.from('estrategias')
        .update({ ...payload, updated_at: new Date().toISOString() })
        .eq('id', editId);
    } else {
      await supabase.from('estrategias').insert(payload);
    }
    setBusy(false);
    setForm(null);
    setEditId(null);
    carregar();
  }

  async function encerrar() {
    if (!encerrando) return;
    setBusy(true);
    await supabase.from('estrategias').update({
      status:       'encerrada',
      aprendizados: encerrando.aprendizados?.trim() || null,
      encerrada_em: new Date().toISOString(),
      updated_at:   new Date().toISOString(),
    }).eq('id', encerrando.id);
    setBusy(false);
    setEncerrando(null);
    carregar();
  }

  async function toggleLogs(e) {
    if (logsAbertos[e.id] !== undefined) {
      setLogsAbertos(s => { const n = { ...s }; delete n[e.id]; return n; });
      return;
    }
    const { data } = await supabase
      .from('estrategia_logs').select('*')
      .eq('estrategia_id', e.id).order('data', { ascending: false });
    setLogsAbertos(s => ({ ...s, [e.id]: data ?? [] }));
  }

  async function toggleObs(e) {
    if (obsAbertos[e.id] !== undefined) {
      setObsAbertos(s => { const n = { ...s }; delete n[e.id]; return n; });
      return;
    }
    setObsLoading(s => ({ ...s, [e.id]: true }));

    const dataFim = e.data_fim ?? e.encerrada_em?.slice(0, 10) ?? new Date().toISOString().slice(0, 10);
    const dias    = duracaoDias(e.data_inicio, dataFim);
    const { inicio: blInicio, fim: blFim } = calcularJanelaBaseline(e.data_inicio, dias);

    const [sintDur, sintAnt, intDur, intAnt, periodos, perfilRes, estrLogs] = await Promise.all([
      supabase.from('ciclo_sintomas_diarios')
        .select('data, humor, energia, sono, compulsao, ansiedade')
        .eq('paciente_id', pacienteId).gte('data', e.data_inicio).lte('data', dataFim),
      supabase.from('ciclo_sintomas_diarios')
        .select('data, humor, energia, sono, compulsao, ansiedade')
        .eq('paciente_id', pacienteId).gte('data', blInicio).lte('data', blFim),
      supabase.from('intestino_logs')
        .select('data, evacuou, bristol, estufamento, dor_abdominal, esvaziamento_incompleto, urgencia, esforco, gases')
        .eq('paciente_id', pacienteId).eq('tipo', 'diario').gte('data', e.data_inicio).lte('data', dataFim),
      supabase.from('intestino_logs')
        .select('data, evacuou, bristol, estufamento, dor_abdominal, esvaziamento_incompleto, urgencia, esforco, gases')
        .eq('paciente_id', pacienteId).eq('tipo', 'diario').gte('data', blInicio).lte('data', blFim),
      supabase.from('ciclo_periodos')
        .select('inicio, fim').eq('paciente_id', pacienteId)
        .gte('inicio', blInicio).lte('inicio', dataFim),
      perfilCicloRef.current
        ? Promise.resolve({ data: perfilCicloRef.current })
        : supabase.from('ciclo_perfil').select('situacao_ciclo').eq('paciente_id', pacienteId).maybeSingle(),
      supabase.from('estrategia_logs').select('aconteceu').eq('estrategia_id', e.id),
    ]);

    if (!perfilCicloRef.current && perfilRes.data) {
      perfilCicloRef.current = perfilRes.data;
    }

    // Estratégias simultâneas: outras encerradas com sobreposição de período
    const simultaneas = historico.filter(h =>
      h.id !== e.id &&
      h.data_inicio <= dataFim &&
      (h.data_fim ?? h.encerrada_em?.slice(0, 10) ?? '9999') >= e.data_inicio
    );

    const cruzamentos = calcularCruzamentos({
      estrategia:          { ...e, data_fim: dataFim },
      sintomasDurante:     sintDur.data  ?? [],
      sintomasAntes:       sintAnt.data  ?? [],
      intestinoDurante:    intDur.data   ?? [],
      intestinoAntes:      intAnt.data   ?? [],
      estrategiaLogs:      estrLogs.data ?? [],
      periodos:            periodos.data ?? [],
      situacaoCiclo:       perfilRes.data?.situacao_ciclo ?? 'menstrua_regularmente',
      estrategiasSimultaneas: simultaneas,
    });

    setObsAbertos(s => ({ ...s, [e.id]: cruzamentos }));
    setObsLoading(s => ({ ...s, [e.id]: false }));
  }

  function abrirEditar(e) {
    setEditId(e.id);
    setForm({
      titulo:            e.titulo,
      objetivo:          e.objetivo          ?? '',
      categoria:         e.categoria         ?? '',
      frequencia_tipo:   e.frequencia_tipo   ?? 'diaria',
      frequencia_valor:  e.frequencia_valor  ?? '',
      data_inicio:       e.data_inicio,
      data_fim:          e.data_fim          ?? '',
      mensagem_paciente: e.mensagem_paciente ?? '',
      observacoes_nutri: e.observacoes_nutri ?? '',
    });
    setFeedback(null);
  }

  const podeNova = (ativas?.length ?? 0) < MAX_ATIVAS;

  return (
    <div>
      {/* Cabeçalho */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)' }}>Estratégias Terapêuticas</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{ativas?.length ?? 0}/{MAX_ATIVAS} ativas</div>
        </div>
        <button
          className="btn"
          style={{ fontSize: 12, padding: '6px 12px' }}
          disabled={!podeNova}
          title={podeNova ? undefined : 'Limite de 3 estratégias ativas atingido'}
          onClick={() => { setForm(formVazio()); setEditId(null); setFeedback(null); }}
        >
          <i className="ti ti-plus" aria-hidden="true"></i> Nova estratégia
        </button>
      </div>

      {!podeNova && !form && (
        <div className="al-b" style={{ marginBottom: 12, background: 'var(--orange-bg)', borderLeftColor: 'var(--orange)' }}>
          <i className="ti ti-alert-triangle" style={{ fontSize: 16, color: 'var(--orange)', marginTop: 1 }} aria-hidden="true"></i>
          <div className="al-d" style={{ color: 'var(--orange)' }}>
            Limite de {MAX_ATIVAS} estratégias ativas atingido. Encerre uma antes de criar outra.
          </div>
        </div>
      )}

      {/* Formulário */}
      {form && (
        <div className="card" style={{ padding: 18, marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
            {editId ? 'Editar estratégia' : 'Nova estratégia'}
          </div>
          <FL label="Título *">
            <input value={form.titulo} onChange={sf('titulo')} placeholder="Ex: Jantar sem tela" />
          </FL>
          <FL label="Objetivo clínico">
            <input value={form.objetivo} onChange={sf('objetivo')} placeholder="O que queremos observar ou trabalhar" />
          </FL>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FL label="Categoria">
              <select value={form.categoria} onChange={sf('categoria')}>
                <option value="">— opcional —</option>
                {CATEGORIAS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </FL>
            <FL label="Frequência">
              <select value={form.frequencia_tipo} onChange={sf('frequencia_tipo')}>
                {FREQ_TIPOS.map(f => <option key={f.v} value={f.v}>{f.l}</option>)}
              </select>
            </FL>
          </div>
          {form.frequencia_tipo === 'semanal' && (
            <FL label="Vezes por semana">
              <input type="number" min={1} max={7} style={{ width: 90 }}
                value={form.frequencia_valor} onChange={sf('frequencia_valor')} placeholder="Ex: 3" />
            </FL>
          )}
          {form.frequencia_tipo === 'personalizada' && (
            <FL label="Descreva a frequência">
              <input value={form.frequencia_valor} onChange={sf('frequencia_valor')}
                placeholder="Ex: Segunda, quarta e sexta" />
            </FL>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <FL label="Início *">
              <input type="date" value={form.data_inicio} onChange={sf('data_inicio')} />
            </FL>
            <FL label="Fim (opcional)">
              <input type="date" value={form.data_fim} onChange={sf('data_fim')} />
            </FL>
          </div>
          <FL label="Mensagem para a paciente">
            <textarea value={form.mensagem_paciente} onChange={sf('mensagem_paciente')} rows={2}
              placeholder="O que a paciente verá no app — linguagem acolhedora"
              style={{ width: '100%', resize: 'vertical', minHeight: 52, boxSizing: 'border-box' }} />
          </FL>
          <FL label="Observações clínicas internas">
            <textarea value={form.observacoes_nutri} onChange={sf('observacoes_nutri')} rows={2}
              placeholder="Notas internas — não visíveis à paciente"
              style={{ width: '100%', resize: 'vertical', minHeight: 52, boxSizing: 'border-box' }} />
          </FL>
          {feedback?.tipo === 'erro' && (
            <div style={{ fontSize: 12, color: 'var(--red)', padding: '6px 10px', borderRadius: 6, background: 'var(--red-bg)', marginBottom: 10 }}>
              {feedback.msg}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }}
              onClick={() => { setForm(null); setEditId(null); }}>Cancelar</button>
            <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
              onClick={salvar} disabled={busy}>
              <i className="ti ti-check" aria-hidden="true"></i> {busy ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      )}

      {/* Ativas */}
      {ativas === null ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '20px 0' }}>Carregando…</div>
      ) : ativas.length === 0 && !form ? (
        <div className="card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 6 }}>
            Nenhuma estratégia ativa para {pacienteNome?.split(' ')[0] ?? 'essa paciente'}.
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.6 }}>
            Estratégias são experimentos clínicos temporários — crie uma quando quiser observar algo junto à paciente.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {ativas.map(e => (
            <div key={e.id} className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {e.categoria && (
                    <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--blue)', marginBottom: 3 }}>
                      {e.categoria}
                    </div>
                  )}
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--dark)' }}>{e.titulo}</div>
                  {e.objetivo && <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2 }}>{e.objetivo}</div>}
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                    {labelFreq(e.frequencia_tipo, e.frequencia_valor)} · {periodo(e)}
                  </div>
                  {e.mensagem_paciente && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 8, padding: '7px 10px', background: 'var(--bg2)', borderRadius: 6 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, display: 'block', marginBottom: 2 }}>VISÍVEL À PACIENTE</span>
                      {e.mensagem_paciente}
                    </div>
                  )}
                  {e.observacoes_nutri && (
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6, fontStyle: 'italic' }}>
                      Nota interna: {e.observacoes_nutri}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                  <button className="btn-outline" style={{ fontSize: 10, padding: '3px 9px' }} onClick={() => abrirEditar(e)}>
                    <i className="ti ti-edit" aria-hidden="true"></i> Editar
                  </button>
                  <button className="btn-outline" style={{ fontSize: 10, padding: '3px 9px' }} onClick={() => toggleLogs(e)}>
                    <i className="ti ti-chart-bar" aria-hidden="true"></i>
                    {logsAbertos[e.id] !== undefined ? 'Ocultar logs' : 'Ver logs'}
                  </button>
                  <button
                    style={{ fontSize: 10, padding: '3px 9px', borderRadius: 6, background: 'none', border: '0.5px solid var(--text3)', color: 'var(--text3)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    onClick={() => setEncerrando({ id: e.id, titulo: e.titulo, aprendizados: '' })}
                  >
                    <i className="ti ti-x" aria-hidden="true"></i> Encerrar
                  </button>
                </div>
              </div>
              {logsAbertos[e.id] !== undefined && (
                <div style={{ marginTop: 12, borderTop: '0.5px solid var(--border)', paddingTop: 10 }}>
                  {logsAbertos[e.id].length === 0 ? (
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>A paciente ainda não registrou nenhum dia.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {logsAbertos[e.id].map(l => (
                        <div key={l.id} style={{ display: 'flex', gap: 10, fontSize: 12, alignItems: 'center' }}>
                          <div style={{ width: 80, flexShrink: 0, color: 'var(--text3)', fontSize: 11 }}>{dataBR(l.data)}</div>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: '1px 8px', borderRadius: 999, flexShrink: 0,
                            background: l.aconteceu === 'sim' ? 'var(--green-bg)' : l.aconteceu === 'parcialmente' ? 'var(--orange-bg)' : 'var(--bg2)',
                            color:      l.aconteceu === 'sim' ? 'var(--green)'   : l.aconteceu === 'parcialmente' ? 'var(--orange)'    : 'var(--text3)',
                          }}>{labelAconteceu(l.aconteceu)}</span>
                          {l.dificuldade && <span style={{ color: 'var(--text3)', fontSize: 11 }}>{labelDificuldade(l.dificuldade)}</span>}
                          {l.observacoes && <span style={{ color: 'var(--text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.observacoes}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Histórico encerradas */}
      {historico.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <div className="section-label" style={{ marginBottom: 8 }}>Histórico encerrado ({historico.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {historico.map(e => {
              const obs      = obsAbertos[e.id];
              const loadObs  = obsLoading[e.id];
              const obsOpen  = obs !== undefined;

              return (
                <div key={e.id} className="card" style={{ padding: 14, opacity: 0.9 }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
                    <div style={{ flex: 1 }}>
                      {e.categoria && (
                        <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text3)', marginBottom: 2 }}>
                          {e.categoria}
                        </div>
                      )}
                      <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--dark)' }}>{e.titulo}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{periodo(e)}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
                      <button className="btn-outline" style={{ fontSize: 10, padding: '3px 9px' }}
                        onClick={() => toggleObs(e)} disabled={loadObs}>
                        <i className="ti ti-chart-dots" aria-hidden="true"></i>
                        {loadObs ? 'Carregando…' : obsOpen ? 'Ocultar obs.' : 'Ver observações'}
                      </button>
                      <button className="btn-outline" style={{ fontSize: 10, padding: '3px 9px' }}
                        onClick={() => toggleLogs(e)}>
                        <i className="ti ti-chart-bar" aria-hidden="true"></i>
                        {logsAbertos[e.id] !== undefined ? 'Ocultar logs' : 'Ver logs'}
                      </button>
                    </div>
                  </div>

                  {/* Logs */}
                  {logsAbertos[e.id] !== undefined && (
                    <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 8, marginBottom: 10 }}>
                      {logsAbertos[e.id].length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>Nenhum registro.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {logsAbertos[e.id].map(l => (
                            <div key={l.id} style={{ display: 'flex', gap: 10, fontSize: 11, alignItems: 'center' }}>
                              <div style={{ width: 80, flexShrink: 0, color: 'var(--text3)' }}>{dataBR(l.data)}</div>
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
                  )}

                  {/* Observações do período */}
                  {obsOpen && (
                    <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: 12, marginBottom: 10 }}>
                      {!obs.suficiente ? (
                        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
                          Dados insuficientes para observação ({obs.percentual ?? 0}% de cobertura — mínimo 40%).
                        </div>
                      ) : (
                        <>
                          {/* Aviso simultâneas — ALTAMENTE VISÍVEL */}
                          {obs.avisoSimultaneas && (
                            <div style={{
                              background: 'var(--orange-bg)',
                              border: '1.5px solid var(--orange)',
                              borderRadius: 8, padding: '10px 14px', marginBottom: 14,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, color: 'var(--orange)', fontSize: 12, marginBottom: 4 }}>
                                <i className="ti ti-alert-triangle" style={{ fontSize: 14 }} aria-hidden="true"></i>
                                Atenção — estratégias simultâneas no mesmo período
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--text1)', lineHeight: 1.6 }}>
                                {obs.titulosSimultaneas.map(t => `"${t}"`).join(', ')} também estav{obs.titulosSimultaneas.length > 1 ? 'am' : 'a'} ativa{obs.titulosSimultaneas.length > 1 ? 's' : ''} neste período.
                                Não é possível isolar o efeito de cada estratégia nesta observação.
                              </div>
                            </div>
                          )}

                          {/* Cobertura */}
                          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>
                            {obs.cobertura.diasComDado} de {obs.cobertura.diasTotais} dias com registro ({obs.cobertura.percentual}% de cobertura)
                          </div>

                          {/* Sinais */}
                          {obs.sinais.length > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div className="section-label" style={{ marginBottom: 6 }}>Sinais observados no período</div>
                              {obs.sinais.map(s => (
                                <div key={s.campo} style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '6px 0', borderBottom: '0.5px solid var(--border)', fontSize: 12,
                                }}>
                                  <div style={{ color: 'var(--text2)', fontWeight: 500 }}>{s.label}</div>
                                  <div style={{ color: corDir(s.direcao), fontSize: 11 }}>{textoDir(s.direcao)}</div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Intestino (nutri only — score numérico) */}
                          {obs.intestino.diasComRegistro > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div className="section-label" style={{ marginBottom: 6 }}>Intestino</div>
                              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 3 }}>
                                Score médio: {obs.intestino.scoreMedDurante}
                                {obs.intestino.scoreMedAntes != null && ` (vs. ${obs.intestino.scoreMedAntes} antes)`}
                                {' — '}<span style={{ color: corDir(obs.intestino.direcao) }}>{textoDir(obs.intestino.direcao)}</span>
                              </div>
                              {obs.intestino.bristolMaisFrequente != null && (
                                <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                                  Bristol mais frequente: tipo {obs.intestino.bristolMaisFrequente}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Adesão */}
                          {obs.aderencia.total > 0 && (
                            <div style={{ marginBottom: 14 }}>
                              <div className="section-label" style={{ marginBottom: 6 }}>Adesão declarada</div>
                              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                                Sim {obs.aderencia.sim} · Parcialmente {obs.aderencia.parcialmente} · Não {obs.aderencia.nao}
                              </div>
                            </div>
                          )}

                          {/* Aviso fase do ciclo — versão clínica */}
                          {obs.fasesAviso && (
                            <div style={{
                              fontSize: 12, color: 'var(--text2)', padding: '8px 12px',
                              background: 'var(--bg2)', borderRadius: 6, marginBottom: 12, lineHeight: 1.6,
                            }}>
                              <span style={{ fontWeight: 600, color: 'var(--text1)' }}>Contexto de ciclo: </span>
                              {obs.fasesAviso.textoNutri}
                            </div>
                          )}

                          {/* Disclaimer */}
                          <div style={{ fontSize: 11, color: 'var(--text4)', lineHeight: 1.5 }}>
                            ⚠ {obs.disclaimer}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Aprendizado clínico — sempre visível, após obs */}
                  {e.aprendizados && (
                    <div style={{ marginTop: obsOpen ? 0 : 0, padding: '10px 12px', background: 'var(--bg2)', borderRadius: 8, borderTop: '0.5px solid var(--border)', paddingTop: 12 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 5 }}>
                        Aprendizado clínico
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--dark)', lineHeight: 1.6 }}>{e.aprendizados}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal encerrar */}
      {encerrando && (
        <div onClick={() => setEncerrando(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(28,23,18,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 24,
        }}>
          <div onClick={ev => ev.stopPropagation()} style={{
            background: 'var(--white)', borderRadius: 14, padding: 24,
            maxWidth: 440, width: '100%', border: '0.5px solid var(--border)',
            boxShadow: '0 8px 32px rgba(28,23,18,.12)',
          }}>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Encerrar estratégia</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>"{encerrando.titulo}"</div>
            <FL label="Aprendizados clínicos (opcional)">
              <textarea rows={3} value={encerrando.aprendizados}
                onChange={ev => setEncerrando(s => ({ ...s, aprendizados: ev.target.value }))}
                placeholder="O que essa estratégia revelou? O que ficou de aprendizado clínico?"
                style={{ width: '100%', resize: 'vertical', boxSizing: 'border-box' }} />
            </FL>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }}
                onClick={() => setEncerrando(null)}>Cancelar</button>
              <button className="btn" style={{ flex: 1, justifyContent: 'center' }}
                onClick={encerrar} disabled={busy}>
                {busy ? 'Encerrando…' : 'Encerrar estratégia'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function FL({ label, children }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span style={{ display: 'block', fontSize: 11, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}
