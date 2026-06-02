import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { useTheme } from '../../lib/theme.jsx';
import { textoDias, dataConsultaBR, diasAte, linkCall, consultaEmBreve, gerarGoogleCalendarUrl, dataBR } from '../../lib/utils.js';
import { calcularFaseDoCiclo, FASES } from '../../lib/cicloUtils.js';

export default function Inicio() {
  const tema = useTheme();
  const nutriNome = tema.nutri_nome ?? 'Sua nutri';
  const navigate = useNavigate();
  const { user } = useSession();
  const [plano, setPlano] = useState(null);
  const [planoPdfPath, setPlanoPdfPath] = useState(null);
  const [compras, setCompras] = useState(null);
  const [exameRecente, setExameRecente] = useState(null);
  const [proximaConsulta, setProximaConsulta] = useState(null);
  const [checkinPendente, setCheckinPendente] = useState(null);
  const [ebooksNovos, setEbooksNovos] = useState(0);
  const [habitos, setHabitos] = useState([]);
  const [habitosLogs, setHabitosLogs] = useState({});  // { habito_id: valor }
  const [habitosStreak, setHabitosStreak] = useState(0);
  const [jornada, setJornada] = useState(null);
  const [feedbackPendente, setFeedbackPendente] = useState(null);
  const [cicloPeriodos,   setCicloPeriodos]   = useState([]);
  const [totalSupl,       setTotalSupl]       = useState(0);
  const [suplTomados,     setSuplTomados]     = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) return;
      const agora = new Date().toISOString();
      const hoje  = new Date().toISOString().slice(0, 10);
      const [planoRes, comprasRes, consultaRes, checkinRes, ebooksRes, habitosRes, logsHojeRes, jornadaRes, feedbackRes, cicloRes, suplRes, suplLogsRes, examesRes] = await Promise.all([
        supabase.from('planos').select('dados, publicado_em, pdf_path')
          .eq('paciente_id', user.id).order('publicado_em', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('listas_compras').select('dados, publicado_em')
          .eq('paciente_id', user.id).order('publicado_em', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('consultas').select('id, data_hora, tipo, duracao_min, meet_link, links_extras')
          .eq('paciente_id', user.id).eq('status', 'agendada')
          .gte('data_hora', agora).order('data_hora', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('checkin_envios').select('id, enviado_em, lembrete_enviado_em, nome, tipo')
          .eq('paciente_id', user.id).is('respondido_em', null)
          .order('enviado_em', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('ebooks_pacientes').select('id', { count: 'exact', head: true })
          .eq('paciente_id', user.id).is('visto_em', null),
        supabase.from('habitos').select('id, nome, emoji, tipo, meta, unidade, ordem')
          .eq('paciente_id', user.id).eq('ativo', true).order('ordem'),
        supabase.from('habitos_logs').select('habito_id, valor, data')
          .eq('paciente_id', user.id)
          .gte('data', new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10)),
        supabase.from('jornadas')
          .select('fase, nome_fase, objetivo_fase, consulta_numero, data_inicio_fase, duracao_semanas_prevista, metas_semana, proximo_marco, data_proximo_marco, evolucao_resumida')
          .eq('paciente_id', user.id)
          .maybeSingle(),
        supabase.from('checkin_envios')
          .select('id, nome, tipo, feedback, feedback_em, feedback_atualizado_em, feedback_lido_em')
          .eq('paciente_id', user.id)
          .not('feedback', 'is', null)
          .order('feedback_atualizado_em', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from('ciclo_periodos')
          .select('inicio, fim')
          .eq('paciente_id', user.id)
          .order('inicio', { ascending: false })
          .limit(6),
        supabase.from('suplementos')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', user.id)
          .eq('ativo', true),
        supabase.from('suplementos_logs')
          .select('id', { count: 'exact', head: true })
          .eq('paciente_id', user.id)
          .eq('data', hoje)
          .eq('tomado', true),
        supabase.from('exames_avaliacoes')
          .select('id, titulo, atualizado_em, visto_pela_paciente_em')
          .eq('paciente_id', user.id)
          .order('data_avaliacao', { ascending: false })
          .limit(1).maybeSingle(),
      ]);
      if (!active) return;
      setPlano(planoRes.data?.dados ?? null);
      setPlanoPdfPath(planoRes.data?.pdf_path ?? null);
      setCompras(comprasRes.data?.dados ?? null);
      setProximaConsulta(consultaRes.data ?? null);
      setCheckinPendente(checkinRes.data ?? null);
      setEbooksNovos(ebooksRes.count ?? 0);
      setExameRecente(examesRes.data ?? null);

      const habitosLista = habitosRes.data ?? [];
      const logsHoje = {};
      for (const l of (logsHojeRes.data ?? [])) {
        if (l.data === hoje) logsHoje[l.habito_id] = Number(l.valor);
      }
      setHabitos(habitosLista);
      setHabitosLogs(logsHoje);
      setJornada(jornadaRes.data ?? null);

      const fb = feedbackRes.data;
      const novoFeedback = fb && (
        !fb.feedback_lido_em ||
        (fb.feedback_atualizado_em &&
         new Date(fb.feedback_atualizado_em) > new Date(fb.feedback_lido_em))
      );
      setFeedbackPendente(novoFeedback ? fb : null);
      setCicloPeriodos(cicloRes.data ?? []);
      setTotalSupl(suplRes.count ?? 0);
      setSuplTomados(suplLogsRes.count ?? 0);

      // Calcula streak (dias seguidos com todos cumpridos)
      const todosLogs = logsHojeRes.data ?? [];
      let streakCount = 0;
      for (let i = 0; i < 30; i++) {
        const dia = new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10);
        const todos = habitosLista.every(h => {
          const log = todosLogs.find(l => l.habito_id === h.id && l.data === dia);
          if (!log) return false;
          const v = Number(log.valor);
          if (h.tipo === 'boolean') return v >= 1;
          if (h.tipo === 'numero')  return h.meta ? v >= h.meta : v > 0;
          if (h.tipo === 'escala')  return v >= 4;
          return false;
        });
        if (todos && habitosLista.length > 0) streakCount++; else break;
      }
      setHabitosStreak(streakCount);
    }
    load();
    return () => { active = false; };
  }, [user]);

  const proximaRef = plano?.refeicoes?.find(r => !r.feita) ?? plano?.refeicoes?.[0] ?? null;
  const totalCompras = compras?.lista?.reduce((a, c) => a + (c.itens?.length ?? 0), 0) ?? 0;

  const dias = proximaConsulta ? diasAte(proximaConsulta.data_hora) : null;
  const urgente = dias !== null && dias <= 1; // hoje ou amanhã
  const emBreve = proximaConsulta ? consultaEmBreve(proximaConsulta.data_hora) : false;
  const callUrl = proximaConsulta ? linkCall(proximaConsulta) : null;
  const gcalUrl = proximaConsulta ? gerarGoogleCalendarUrl({
    titulo: `Consulta com ${nutriNome}`,
    dataHoraInicio: proximaConsulta.data_hora,
    duracaoMin: proximaConsulta.duracao_min,
    descricao: `Link da call: ${callUrl ?? ''}`,
    local: 'Online',
  }) : null;

  // Lembrete de check-in: se foi enviado pela nutri E ainda não respondido.
  // Se houver `lembrete_enviado_em`, fica em estilo "urgente" (gradiente forte).
  const ckUrgente = !!checkinPendente?.lembrete_enviado_em;

  async function marcarEbooksComoVistos() {
    await supabase.from('ebooks_pacientes')
      .update({ visto_em: new Date().toISOString() })
      .eq('paciente_id', user.id).is('visto_em', null);
    navigate('/paciente/ebooks');
  }

  function cumpriuHabito(h, valor) {
    if (valor === undefined || valor === null) return false;
    if (h.tipo === 'boolean') return valor >= 1;
    if (h.tipo === 'numero')  return h.meta ? valor >= h.meta : valor > 0;
    if (h.tipo === 'escala')  return valor >= 4;
    return false;
  }

  async function setValorHabito(habito, valor) {
    const hoje = new Date().toISOString().slice(0, 10);

    // Boolean toggle-off: passa 0 ao RPC (que faz delete em habitos_logs)
    const atual = habitosLogs[habito.id];
    const finalValor = (habito.tipo === 'boolean' && atual !== undefined && atual === valor) ? 0 : valor;

    // Optimistic update — hábitos
    if (finalValor === 0 && habito.tipo === 'boolean') {
      setHabitosLogs(prev => { const n = { ...prev }; delete n[habito.id]; return n; });
    } else {
      setHabitosLogs(prev => ({ ...prev, [habito.id]: finalValor }));
    }

    // Optimistic update — metas da jornada vinculadas a este hábito
    if (jornada?.metas_semana) {
      const novasMetas = jornada.metas_semana.map(m =>
        m.habito_id === habito.id ? { ...m, concluida: finalValor > 0 } : m
      );
      setJornada(j => ({ ...j, metas_semana: novasMetas }));
    }

    // RPC única: grava habitos_logs + sincroniza meta vinculada na jornada
    await supabase.rpc('paciente_marcar_habito_e_meta', {
      p_habito_id: habito.id,
      p_valor:     finalValor,
      p_data:      hoje,
    });
  }

  const habitosCumpridos = habitos.filter(h => cumpriuHabito(h, habitosLogs[h.id])).length;

  // ── Calendário Hoje ──────────────────────────────────────────────
  const calHoje       = new Date().toISOString().slice(0, 10);
  const infoCiclo     = cicloPeriodos.length > 0 ? calcularFaseDoCiclo(cicloPeriodos, calHoje) : null;
  const faseCiclo     = infoCiclo && infoCiclo.fase !== 'desconhecida' ? (FASES[infoCiclo.fase] ?? null) : null;

  const calTotalMetas     = (jornada?.metas_semana ?? []).length;
  const calMetasConcluidas = (jornada?.metas_semana ?? []).filter(m => m.concluida).length;

  const calDiasConsulta  = proximaConsulta ? diasAte(proximaConsulta.data_hora) : null;
  const calConsultaProxima = calDiasConsulta !== null && calDiasConsulta <= 7;
  const calConsultaTexto   = calConsultaProxima
    ? (calDiasConsulta === 0 ? 'Consulta hoje' : calDiasConsulta === 1 ? 'Consulta amanhã' : `Consulta em ${calDiasConsulta} dias`)
    : null;

  const calHasTaskItems = habitos.length > 0 || totalSupl > 0 || calTotalMetas > 0;
  const calTudoEmDia    = calHasTaskItems &&
    (habitos.length === 0    || habitosCumpridos   === habitos.length) &&
    (totalSupl === 0         || suplTomados        === totalSupl) &&
    (calTotalMetas === 0     || calMetasConcluidas === calTotalMetas) &&
    !checkinPendente && !calConsultaProxima;

  const calTemConteudo = faseCiclo !== null || !!jornada?.objetivo_fase ||
    habitos.length > 0 || totalSupl > 0 || calTotalMetas > 0 ||
    !!checkinPendente  || calConsultaProxima;

  function semanaAtualDe(dataInicio) {
    if (!dataInicio) return 1;
    const diff = Math.floor((new Date() - new Date(dataInicio + 'T12:00:00')) / 86400000);
    return Math.max(1, Math.ceil((diff + 1) / 7));
  }

  async function toggleMetaInicio(metaId, concluida) {
    if (!jornada) return;
    const novas = (jornada.metas_semana ?? []).map(m =>
      m.id === metaId ? { ...m, concluida } : m
    );
    setJornada(j => ({ ...j, metas_semana: novas }));
    await supabase.rpc('paciente_marcar_meta', { p_metas: novas });
  }

  return (
    <>
      {/* Card de feedback da nutricionista */}
      {feedbackPendente && (
        <div
          onClick={() => navigate(`/paciente/checkin/${feedbackPendente.id}`)}
          style={{
            margin: '0 16px 14px', padding: '16px 18px',
            background: 'linear-gradient(135deg, var(--ink) 0%, #3d2b1a 100%)',
            borderRadius: 16, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 14,
          }}>
          <div style={{
            width: 46, height: 46, borderRadius: 12, flexShrink: 0,
            background: 'var(--gold)', color: 'var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>💌</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
              color: 'var(--gold)', fontWeight: 600, marginBottom: 3,
            }}>Novo feedback</div>
            <div className="serif" style={{ fontSize: 17, color: 'var(--bg-soft)', lineHeight: 1.15, marginBottom: 3 }}>
              Sua nutricionista deixou um novo feedback para você
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)' }}>
              {feedbackPendente.feedback_atualizado_em
                ? dataBR(feedbackPendente.feedback_atualizado_em)
                : dataBR(feedbackPendente.feedback_em)}
              {' · '}Toque para ler
            </div>
          </div>
          <i className="ti ti-chevron-right" style={{ fontSize: 18, color: 'var(--gold)', flexShrink: 0 }} aria-hidden="true" />
        </div>
      )}

      {/* Aviso de e-books novos */}
      {ebooksNovos > 0 && (
        <div onClick={marcarEbooksComoVistos}
          style={{
            margin: '0 16px 12px', padding: '14px 16px',
            background: 'linear-gradient(135deg, var(--gold-soft, var(--bg-soft)), var(--white))',
            border: '0.5px solid var(--gold-deep)',
            borderRadius: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: 'var(--gold-deep)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, flexShrink: 0,
          }}>📚</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
              color: 'var(--gold-deep)', fontWeight: 500, marginBottom: 2,
            }}>Novo material</div>
            <div className="serif" style={{ fontSize: 17, lineHeight: 1.1 }}>
              {ebooksNovos === 1
                ? 'Você tem 1 e-book novo'
                : `Você tem ${ebooksNovos} e-books novos`}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Toque para abrir
            </div>
          </div>
          <i className="ti ti-chevron-right" style={{ fontSize: 18, color: 'var(--muted)' }} aria-hidden="true"></i>
        </div>
      )}

      {/* Card de análise de exames */}
      {exameRecente && (() => {
        const nova = !exameRecente.visto_pela_paciente_em ||
          new Date(exameRecente.atualizado_em) > new Date(exameRecente.visto_pela_paciente_em);
        return (
          <div
            onClick={() => navigate('/paciente/exames')}
            style={{
              margin: '0 16px 12px', padding: '14px 16px',
              background: nova
                ? 'linear-gradient(135deg, var(--gold-soft, var(--bg-soft)), var(--white))'
                : 'var(--white)',
              border: nova ? '0.5px solid var(--gold-deep)' : '0.5px solid var(--hair)',
              borderRadius: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: nova ? 'var(--gold-deep)' : 'var(--bg-soft)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20,
            }}>🧪</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
                color: nova ? 'var(--gold-deep)' : 'var(--muted)',
                fontWeight: 500, marginBottom: 2,
              }}>
                {nova ? 'Nova análise' : 'Resultados de exames'}
              </div>
              <div className="serif" style={{ fontSize: 17, lineHeight: 1.1 }}>
                {exameRecente.titulo || 'Análise de Exames'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Toque para ver
              </div>
            </div>
            <i className="ti ti-chevron-right" style={{ fontSize: 18, color: 'var(--muted)' }} aria-hidden="true" />
          </div>
        );
      })()}

      {/* ── Seu calendário hoje ── */}
      {calTemConteudo && (
        <div style={{
          margin: '0 16px 14px',
          background: 'var(--white)',
          border: '0.5px solid var(--hair)',
          borderRadius: 16,
          padding: '14px 16px',
        }}>
          <div style={{
            fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 500,
            marginBottom: jornada?.objetivo_fase ? 8 : 12,
          }}>
            Seu calendário hoje
          </div>

          {jornada?.objetivo_fase && (
            <div style={{
              fontSize: 13, color: 'var(--gold-deep)', fontWeight: 500,
              marginBottom: 12,
            }}>
              ✨ Foco atual: {jornada.objetivo_fase}
            </div>
          )}

          {calTudoEmDia ? (
            <div style={{ fontSize: 13, color: 'var(--green)', lineHeight: 1.65 }}>
              ✨ Tudo em dia por hoje.<br />
              <span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                Continue cuidando de você.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {faseCiclo && (
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  {faseCiclo.icone} {faseCiclo.label}{infoCiclo.diaDociclo ? ` · Dia ${infoCiclo.diaDociclo}` : ''}
                </div>
              )}
              {totalSupl > 0 && (
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  💊 {suplTomados} de {totalSupl} suplemento{totalSupl !== 1 ? 's' : ''} tomado{suplTomados !== 1 && totalSupl !== 1 ? 's' : ''}
                </div>
              )}
              {habitos.length > 0 && (
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  💧 {habitosCumpridos} de {habitos.length} hábito{habitos.length !== 1 ? 's' : ''} concluído{habitos.length !== 1 ? 's' : ''}
                </div>
              )}
              {calTotalMetas > 0 && (
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  🎯 {calMetasConcluidas} de {calTotalMetas} meta{calTotalMetas !== 1 ? 's' : ''} concluída{calMetasConcluidas !== 1 && calTotalMetas !== 1 ? 's' : ''}
                </div>
              )}
              {checkinPendente && (
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  📝 Check-in disponível
                </div>
              )}
              {calConsultaProxima && (
                <div style={{ fontSize: 13, color: 'var(--ink)' }}>
                  📅 {calConsultaTexto}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Visão completa dos hábitos do dia (interativa) */}
      {habitos.length > 0 && (
        <div style={{
          margin: '0 16px 14px', padding: 16,
          background: 'var(--white)',
          border: `0.5px solid ${habitosCumpridos === habitos.length ? 'var(--green, var(--hair))' : 'var(--hair)'}`,
          borderRadius: 16,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div>
              <div style={{
                fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
                color: 'var(--muted)', fontWeight: 500,
              }}>Hábitos de hoje</div>
              <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--ink)', marginTop: 2 }}>
                {habitosCumpridos}<span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 400 }}>/{habitos.length}</span>
                {habitosCumpridos === habitos.length && habitos.length > 0 && (
                  <span style={{ marginLeft: 8, fontSize: 14 }}>🎉</span>
                )}
              </div>
            </div>
            {habitosStreak > 0 && (
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                padding: '4px 10px',
                background: 'var(--orange-bg, var(--bg-soft))',
                borderRadius: 999, fontSize: 11,
                color: 'var(--orange, var(--gold-deep))', fontWeight: 500,
              }}>
                <i className="ti ti-flame" aria-hidden="true"></i>
                {habitosStreak} dia{habitosStreak === 1 ? '' : 's'}
              </div>
            )}
          </div>

          {/* Lista de hábitos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {habitos.map(h => {
              const valor = habitosLogs[h.id];
              const ok = cumpriuHabito(h, valor);
              return (
                <div key={h.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 10,
                  background: ok ? 'var(--green-soft, var(--bg-soft))' : 'var(--bg-soft)',
                  border: `0.5px solid ${ok ? 'var(--green, transparent)' : 'transparent'}`,
                }}>
                  <span style={{ fontSize: 18 }}>{h.emoji ?? '✨'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13, fontWeight: 500, color: 'var(--ink)',
                      textDecoration: ok && h.tipo === 'boolean' ? 'line-through' : 'none',
                      opacity: ok && h.tipo === 'boolean' ? 0.7 : 1,
                    }}>{h.nome}</div>
                  </div>

                  {h.tipo === 'boolean' && (
                    <button onClick={() => setValorHabito(h, ok ? 0 : 1)}
                      style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: ok ? 'var(--green, var(--gold-deep))' : 'var(--white)',
                        color: ok ? '#fff' : 'var(--muted-2)',
                        border: `1.5px solid ${ok ? 'var(--green, var(--gold-deep))' : 'var(--hair)'}`,
                        cursor: 'pointer', fontSize: 14, padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                      {ok && <i className="ti ti-check" aria-hidden="true"></i>}
                    </button>
                  )}

                  {h.tipo === 'numero' && (() => {
                    const v = valor ?? 0;
                    const meta = h.meta ?? 0;
                    const passo = meta && meta < 5 ? 0.5 : 1;
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button onClick={() => setValorHabito(h, Math.max(0, Number((v - passo).toFixed(1))))}
                          style={{
                            width: 26, height: 26, borderRadius: 6,
                            background: 'var(--white)', border: '1px solid var(--hair)',
                            cursor: 'pointer', fontSize: 14, color: 'var(--ink)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>−</button>
                        <div style={{
                          minWidth: 60, textAlign: 'center', fontSize: 12,
                          color: 'var(--ink)', fontWeight: 600,
                        }}>
                          {v}<span style={{ color: 'var(--muted)', fontWeight: 400 }}>
                            {meta ? `/${meta}` : ''} {h.unidade ?? ''}
                          </span>
                        </div>
                        <button onClick={() => setValorHabito(h, Number((v + passo).toFixed(1)))}
                          style={{
                            width: 26, height: 26, borderRadius: 6,
                            background: 'var(--white)', border: '1px solid var(--hair)',
                            cursor: 'pointer', fontSize: 14, color: 'var(--ink)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>+</button>
                      </div>
                    );
                  })()}

                  {h.tipo === 'escala' && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      {[1,2,3,4,5].map(n => {
                        const ativo = (valor ?? 0) === n;
                        const emoji = ['😞','😕','😐','🙂','😄'][n-1];
                        return (
                          <button key={n} onClick={() => setValorHabito(h, n)}
                            style={{
                              width: 26, height: 26, borderRadius: 6,
                              background: ativo ? 'var(--gold-deep)' : 'transparent',
                              border: 'none', cursor: 'pointer', fontSize: 14, padding: 0,
                              opacity: ativo ? 1 : 0.5,
                            }}>{emoji}</button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Ver detalhes */}
          <button onClick={() => navigate('/paciente/habitos')}
            style={{
              width: '100%', marginTop: 10, padding: '8px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
            }}>
            Ver histórico completo
            <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true"></i>
          </button>
        </div>
      )}

      {/* Card de jornada — visível apenas se existir jornada ativa */}
      {jornada && (() => {
        const semana = semanaAtualDe(jornada.data_inicio_fase);
        const total  = jornada.duracao_semanas_prevista ?? 4;
        const pct    = Math.min(100, Math.round((semana / total) * 100));
        const metas  = jornada.metas_semana ?? [];
        const concluidas = metas.filter(m => m.concluida).length;
        return (
          <div style={{
            margin: '0 16px 12px', padding: '14px 16px',
            background: 'var(--white)', border: '0.5px solid var(--hair)',
            borderRadius: 16,
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div>
                <div style={{
                  fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
                  color: 'var(--gold-deep)', fontWeight: 600, marginBottom: 2,
                }}>
                  Fase {jornada.fase}{jornada.consulta_numero != null ? ` · Consulta ${jornada.consulta_numero}` : ''} · Semana {semana} de {total}
                </div>
                <div style={{ fontSize: 17, fontFamily: 'var(--font-serif)', color: 'var(--ink)', lineHeight: 1.1 }}>
                  {jornada.nome_fase}
                </div>
              </div>
              <button
                onClick={() => navigate('/paciente/jornada')}
                style={{
                  background: 'none', border: '0.5px solid var(--hair)',
                  borderRadius: 8, padding: '4px 10px', cursor: 'pointer',
                  fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-sans)',
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                Ver tudo <i className="ti ti-chevron-right" style={{ fontSize: 12 }} aria-hidden="true" />
              </button>
            </div>

            {/* Barra de progresso */}
            <div style={{ marginBottom: metas.length > 0 ? 12 : 0 }}>
              <div style={{ height: 5, borderRadius: 3, background: 'var(--hair)' }}>
                <div style={{
                  height: '100%', borderRadius: 3,
                  width: `${pct}%`, background: 'var(--gold-deep)',
                  transition: 'width .4s ease',
                }} />
              </div>
            </div>

            {/* Metas */}
            {metas.length > 0 && (
              <div>
                <div style={{
                  fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase',
                  color: 'var(--muted)', fontWeight: 500, marginBottom: 7,
                }}>
                  Metas · {concluidas}/{metas.length}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {metas.map(m => (
                    <button
                      key={m.id}
                      onClick={() => toggleMetaInicio(m.id, !m.concluida)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 9,
                        padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
                        background: m.concluida ? 'var(--green-soft, var(--bg-soft))' : 'var(--bg-soft)',
                        border: `0.5px solid ${m.concluida ? 'var(--green, var(--hair))' : 'var(--hair)'}`,
                        textAlign: 'left', width: '100%', fontFamily: 'var(--font-sans)',
                      }}>
                      <div style={{
                        width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                        background: m.concluida ? 'var(--green, var(--gold-deep))' : 'var(--white)',
                        border: `1.5px solid ${m.concluida ? 'var(--green, var(--gold-deep))' : 'var(--hair)'}`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}>
                        {m.concluida && (
                          <i className="ti ti-check" style={{ fontSize: 9, color: 'var(--white)' }} aria-hidden="true" />
                        )}
                      </div>
                      <span style={{
                        fontSize: 12, color: 'var(--ink)',
                        textDecoration: m.concluida ? 'line-through' : 'none',
                        opacity: m.concluida ? 0.6 : 1,
                      }}>
                        {m.texto}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Lembrete de check-in pendente */}
      {checkinPendente && (
        <div
          onClick={() => navigate(`/paciente/checkin/${checkinPendente.id}`)}
          style={{
            margin: '0 16px 12px',
            background: ckUrgente
              ? 'linear-gradient(135deg, #ffd9c4 0%, #f5a373 100%)'
              : 'var(--paper)',
            border: ckUrgente ? 'none' : '1.5px dashed var(--gold)',
            borderRadius: 14,
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer',
          }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11,
            background: ckUrgente ? 'rgba(28,23,18,.12)' : 'var(--gold-soft)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <i className="ti ti-clipboard-text" style={{
              fontSize: 20, color: ckUrgente ? 'var(--ink)' : 'var(--gold-deep)',
            }} aria-hidden="true"></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
              color: ckUrgente ? 'var(--ink)' : 'var(--gold-deep)',
              fontWeight: 500, marginBottom: 2,
            }}>
              {ckUrgente
                ? 'Lembrete · pendente'
                : checkinPendente.tipo === 'pre_consulta'
                  ? 'Check-in pré-consulta'
                  : 'Check-in pendente'}
            </div>
            <div className="serif" style={{ fontSize: 18, lineHeight: 1.1, marginBottom: 2 }}>
              {checkinPendente.tipo === 'pre_consulta'
                ? 'Antes da nossa primeira consulta'
                : (checkinPendente.nome || 'Sua Dra. pediu um check-in')}
            </div>
            <div style={{ fontSize: 11, color: ckUrgente ? 'var(--ink)' : 'var(--muted)', opacity: ckUrgente ? .8 : 1 }}>
              {checkinPendente.tipo === 'pre_consulta'
                ? 'Toque para responder — leva uns 5 minutos'
                : 'Toque para responder · leva uns 3 minutos'}
            </div>
          </div>
          <i className="ti ti-chevron-right" style={{ fontSize: 18, color: ckUrgente ? 'var(--ink)' : 'var(--muted)', flexShrink: 0 }} aria-hidden="true"></i>
        </div>
      )}

      {/* Lembrete de consulta */}
      {proximaConsulta && (
        <div style={{
          margin: '0 16px 12px',
          background: urgente
            ? 'linear-gradient(135deg, var(--gold) 0%, var(--gold-deep) 100%)'
            : 'linear-gradient(135deg, var(--gold-soft) 0%, var(--bg-soft) 100%)',
          border: urgente ? 'none' : '0.5px solid var(--gold)',
          borderRadius: 14,
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 14,
          color: urgente ? 'var(--ink)' : 'var(--ink)',
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 11,
            background: urgente ? 'rgba(28,23,18,.12)' : 'var(--paper)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <i className="ti ti-calendar-event"
               style={{ fontSize: 20, color: urgente ? 'var(--ink)' : 'var(--gold-deep)' }}
               aria-hidden="true"></i>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
              color: urgente ? 'var(--ink)' : 'var(--gold-deep)',
              fontWeight: 500, marginBottom: 2, opacity: urgente ? .85 : 1,
            }}>
              Próxima consulta
            </div>
            <div className="serif" style={{ fontSize: 20, lineHeight: 1.1, marginBottom: 2 }}>
              {textoDias(proximaConsulta.data_hora)}
            </div>
            <div style={{ fontSize: 11, color: urgente ? 'var(--ink)' : 'var(--muted)', opacity: urgente ? .8 : 1 }}>
              {dataConsultaBR(proximaConsulta.data_hora)} · {proximaConsulta.duracao_min}min
            </div>
            {callUrl && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                <a href={callUrl} target="_blank" rel="noreferrer"
                  onClick={e => e.stopPropagation()}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: emBreve ? 'var(--green)' : (urgente ? 'rgba(28,23,18,.85)' : 'var(--ink)'),
                    color: 'var(--bg-soft)',
                    padding: emBreve ? '8px 14px' : '6px 12px',
                    borderRadius: 10,
                    fontSize: emBreve ? 12 : 11,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}>
                  <i className="ti ti-video" style={{ fontSize: 14 }} aria-hidden="true"></i>
                  {emBreve ? 'Entrar na call agora' : 'Entrar na call'}
                </a>
                {gcalUrl && !urgente && (
                  <a href={gcalUrl} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: 'transparent',
                      color: 'var(--muted)',
                      border: '0.5px solid var(--hair)',
                      padding: '6px 12px', borderRadius: 10,
                      fontSize: 11, fontWeight: 500,
                      textDecoration: 'none',
                    }}>
                    <i className="ti ti-calendar-plus" style={{ fontSize: 13 }} aria-hidden="true"></i>
                    Adicionar à agenda
                  </a>
                )}
              </div>
            )}
            {Array.isArray(proximaConsulta.links_extras) && proximaConsulta.links_extras.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                {proximaConsulta.links_extras.map((link, i) => (
                  <a key={i} href={link.url} target="_blank" rel="noreferrer"
                    onClick={e => e.stopPropagation()}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      background: 'transparent',
                      color: urgente ? 'var(--ink)' : 'var(--gold-deep)',
                      border: '0.5px solid ' + (urgente ? 'rgba(28,23,18,.4)' : 'var(--gold)'),
                      padding: '5px 10px', borderRadius: 10,
                      fontSize: 11, fontWeight: 500,
                      textDecoration: 'none',
                    }}>
                    <i className="ti ti-external-link" style={{ fontSize: 12 }} aria-hidden="true"></i>
                    {link.label || 'Link'}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Hero — próxima refeição */}
      {proximaRef ? (
        <div className="card dark" style={{ padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--bg-soft)', opacity: .6 }}>
              Próxima refeição{proximaRef.horario ? ` · ${proximaRef.horario}` : ''}
            </span>
            {proximaRef.emoji && (
              <span className="pill" style={{ background: 'var(--gold)', color: 'var(--ink)' }}>{proximaRef.emoji}</span>
            )}
          </div>
          <div className="serif" style={{ fontSize: 22, color: 'var(--bg-soft)', lineHeight: 1.1, marginBottom: 4 }}>
            {proximaRef.nome}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted-2)', marginBottom: 10 }}>
            {proximaRef.alimentos?.slice(0, 2).map(a => a.nome).join(' · ')}
          </div>
          <button className="btn gold sm" onClick={() => navigate('/paciente/plano')}>Ver plano completo</button>
        </div>
      ) : (
        <div className="card" style={{ padding: '20px 18px', textAlign: 'center' }}>
          <i className="ti ti-sparkles" style={{ fontSize: 28, color: 'var(--gold-deep)', display: 'block', marginBottom: 8 }}></i>
          <div className="serif" style={{ fontSize: 18, marginBottom: 4 }}>Bem-vinda ao Útera ✨</div>
          {(plano || planoPdfPath) ? (
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Sua prescrição alimentar está pronta. Toque no card abaixo para acessar.
            </div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              Dra. {nutriNome} publicará sua prescrição em breve. Você será notificada!
            </div>
          )}
        </div>
      )}

      {/* Cards 2x2 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, margin: '0 16px 10px' }}>
        <div className="card" style={{ margin: 0, padding: '12px 14px', cursor: 'pointer' }} onClick={() => navigate('/paciente/plano')}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <i className="ti ti-salad" style={{ fontSize: 14, color: 'var(--green)' }}></i>
            <span style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Prescrição Alimentar</span>
          </div>
          {plano ? (
            <>
              <div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>
                {plano.macros?.kcal}<span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 2 }}>kcal</span>
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 3 }}>
                P {plano.macros?.prot_g}g · C {plano.macros?.cho_g}g · G {plano.macros?.lip_g}g
              </div>
            </>
          ) : planoPdfPath ? (
            <div style={{ fontSize: 12, color: 'var(--green)' }}>Prescrição disponível</div>
          ) : (
            <div style={{ fontSize: 12, color: 'var(--muted)' }}>Aguardando prescrição</div>
          )}
        </div>

        <div className="card" style={{ margin: 0, padding: '12px 14px', cursor: 'pointer' }} onClick={() => navigate('/paciente/ciclo')}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <i className="ti ti-moon" style={{ fontSize: 14, color: 'var(--muted)' }}></i>
            <span style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Ciclos & Hormônios</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ver sua fase atual</div>
        </div>

        <div className="card" style={{ margin: 0, padding: '12px 14px', cursor: 'pointer' }} onClick={() => navigate('/paciente/progresso')}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <i className="ti ti-trending-up" style={{ fontSize: 14, color: 'var(--blue)' }}></i>
            <span style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Progresso</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Veja sua evolução</div>
        </div>

        <div className="card" style={{ margin: 0, padding: '12px 14px', cursor: 'pointer' }} onClick={() => navigate('/paciente/suplementos')}>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
            <i className="ti ti-pill" style={{ fontSize: 14, color: 'var(--gold-deep)' }}></i>
            <span style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>Suplementação</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)' }}>Ver seus suplementos</div>
        </div>
      </div>
    </>
  );
}
