import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';
import { calcularLeituraConsistencia } from '../../lib/consistenciaUtils.js';
import { calcularPerfilBiologico } from '../../lib/perfilBiologicoUtils.js';
import { gerarPontosAtencao } from '../../lib/visaoProspectiva.js';

function tipoConsulta(tipo) {
  if (!tipo) return '—';
  if (tipo === 'primeira') return '1ª consulta';
  if (tipo === 'avaliacao') return 'Avaliação';
  const m = tipo.match(/^consulta_(\d+)$/);
  if (m) return `Consulta ${String(m[1]).padStart(2, '0')}`;
  return tipo;
}

function diasDesde(isoDate) {
  if (!isoDate) return null;
  const base = isoDate.length > 10 ? isoDate : isoDate + 'T12:00:00';
  return Math.floor((Date.now() - new Date(base).getTime()) / 86_400_000);
}

function corDias(dias, limOk, limWarn) {
  if (dias === null) return 'var(--text3)';
  if (dias <= limOk) return 'var(--green)';
  if (dias <= limWarn) return 'var(--orange)';
  return 'var(--red)';
}

const COR_LEITURA = {
  excelente:     'var(--green)',
  boa:           'var(--green)',
  em_construcao: 'var(--amber)',
  oscilante:     'var(--orange)',
  retomada:      'var(--orange)',
};

export default function ResumoClinico({ pacienteId, nutriId, onIrParaTab }) {
  const navigate = useNavigate();
  const [prox,         setProx]         = useState(undefined);
  const [ultCons,      setUltCons]      = useState(undefined);
  const [checkin,      setCheckin]      = useState(undefined);
  const [followup,     setFollowup]     = useState(undefined);
  const [avaliacao,    setAvaliacao]    = useState(undefined);
  const [anamnese,     setAnamnese]     = useState(undefined);
  const [condutaAtual, setCondutaAtual] = useState(undefined);
  const [metas,        setMetas]        = useState(undefined);
  const [consistencia, setConsistencia] = useState(undefined);
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

  useEffect(() => {
    let active = true;
    async function load() {
      const agora = new Date().toISOString();

      // Corte de 30 dias para a leitura de consistência
      const c30 = new Date();
      c30.setDate(c30.getDate() - 30);
      const c30str = c30.toISOString().slice(0, 10);
      const c30ts  = c30.toISOString();

      const [
        proxRes, ultConsRes, checkinRes, followupRes, avalRes, anamRes, condutaRes, metasRes,
        cicloRes, intestinoRes,
        habitosCountRes, habitosLogsRes,
        checkinsConsRes,
        suplCountRes, suplLogsRes,
      ] = await Promise.all([
        // ── Existentes ────────────────────────────────────────────────────────
        supabase.from('consultas').select('id, data_hora, tipo')
          .eq('paciente_id', pacienteId).neq('status', 'cancelada')
          .gte('data_hora', agora).order('data_hora').limit(1).maybeSingle(),
        supabase.from('consultas').select('id, data_hora, tipo')
          .eq('paciente_id', pacienteId).neq('status', 'cancelada')
          .lt('data_hora', agora).order('data_hora', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('checkin_envios').select('id, enviado_em, respondido_em, perguntas')
          .eq('paciente_id', pacienteId)
          .order('enviado_em', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('followups').select('id, titulo, data, created_at')
          .eq('paciente_id', pacienteId)
          .order('data', { ascending: false }).order('created_at', { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from('peso_registros').select('id, data, kg, pgc')
          .eq('paciente_id', pacienteId)
          .order('data', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('anamneses').select('id, titulo, data, created_at')
          .eq('paciente_id', pacienteId)
          .order('data', { ascending: false }).order('created_at', { ascending: false })
          .limit(1).maybeSingle(),
        supabase.from('condutas').select('id, titulo, objetivo_principal, data')
          .eq('paciente_id', pacienteId).eq('is_atual', true)
          .order('data', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('metas_terapeuticas').select('id, prioridade, status')
          .eq('paciente_id', pacienteId)
          .in('status', ['ativa', 'em_evolucao']),

        // ── Consistência: registros clínicos ──────────────────────────────────
        supabase.from('ciclo_sintomas_diarios').select('data')
          .eq('paciente_id', pacienteId).gte('data', c30str),
        supabase.from('intestino_logs').select('data')
          .eq('paciente_id', pacienteId).eq('tipo', 'diario').gte('data', c30str),

        // ── Consistência: hábitos ─────────────────────────────────────────────
        supabase.from('habitos').select('id', { count: 'exact', head: true })
          .eq('paciente_id', pacienteId).eq('ativo', true),
        supabase.from('habitos_logs').select('data')
          .eq('paciente_id', pacienteId).gte('data', c30str),

        // ── Consistência: check-ins na janela ─────────────────────────────────
        supabase.from('checkin_envios').select('respondido_em')
          .eq('paciente_id', pacienteId).gte('enviado_em', c30ts),

        // ── Consistência: suplementação ───────────────────────────────────────
        supabase.from('suplementos').select('id', { count: 'exact', head: true })
          .eq('paciente_id', pacienteId).eq('ativo', true),
        supabase.from('suplementos_logs').select('data')
          .eq('paciente_id', pacienteId).eq('tomado', true).gte('data', c30str),
      ]);

      if (!active) return;

      setProx(proxRes.data ?? null);
      setUltCons(ultConsRes.data ?? null);
      setCheckin(checkinRes.data ?? null);
      setFollowup(followupRes.data ?? null);
      setAvaliacao(avalRes.data ?? null);
      setAnamnese(anamRes.data ?? null);
      setCondutaAtual(condutaRes.data ?? null);
      setMetas(metasRes.data ?? []);

      // Calcular leitura de consistência
      const datasRegistros = [
        ...(cicloRes.data ?? []).map(r => r.data),
        ...(intestinoRes.data ?? []).map(r => r.data),
      ];
      const temHabitos = (habitosCountRes.count ?? 0) > 0;
      const temSupl    = (suplCountRes.count    ?? 0) > 0;
      const checkinsConsEnviados = checkinsConsRes.data ?? [];

      setConsistencia(calcularLeituraConsistencia({
        datasRegistros,
        temHabitos,
        datasHabitos:        (habitosLogsRes.data ?? []).map(r => r.data),
        checkinsTotal:       checkinsConsEnviados.length,
        checkinsRespondidos: checkinsConsEnviados.filter(c => c.respondido_em !== null).length,
        temSupl,
        datasSupl:           (suplLogsRes.data ?? []).map(r => r.data),
      }));
    }
    load();
    return () => { active = false; };
  }, [pacienteId, nutriId]);

  if (prox === undefined) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  const diasFollowup  = diasDesde(followup?.data ?? followup?.created_at);
  const diasAvaliacao = diasDesde(avaliacao?.data);

  const labelSub = { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 500, marginBottom: 8 };
  const btnAcao  = { fontSize: 11, padding: '3px 9px', marginTop: 10 };

  const pontosAtencao = perfilResult ? gerarPontosAtencao(perfilResult) : [];

  return (
    <>
      {/* ── Consultas ── */}
      <div className="g2">
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={labelSub}>Próxima consulta</div>
          {prox ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)' }}>
                {new Date(prox.data_hora).toLocaleString('pt-BR', {
                  weekday: 'short', day: '2-digit', month: 'short',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{tipoConsulta(prox.tipo)}</div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nenhuma agendada</div>
          )}
          <button className="btn-outline" style={btnAcao} onClick={() => navigate('/nutri/agenda')}>
            <i className="ti ti-calendar" aria-hidden="true"></i> Agenda
          </button>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={labelSub}>Última consulta</div>
              {ultCons ? (
                <>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)' }}>
                    {dataBR(ultCons.data_hora)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{tipoConsulta(ultCons.tipo)}</div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nenhuma realizada ainda</div>
              )}
            </div>
            <button className="btn-outline" style={{ fontSize: 11, padding: '3px 9px', flexShrink: 0, marginTop: 2 }}
              onClick={() => onIrParaTab?.('consultas')}>
              <i className="ti ti-stethoscope" aria-hidden="true"></i> Ver
            </button>
          </div>
        </div>
      </div>

      {/* ── Check-in ── */}
      <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
          <div style={{ flex: 1 }}>
            <div style={labelSub}>Último check-in</div>
            {checkin ? (
              <>
                <div style={{ fontSize: 14, fontWeight: 500 }}>
                  {checkin.respondido_em ? (
                    <span style={{ color: 'var(--green)' }}>
                      <i className="ti ti-check" style={{ marginRight: 4 }} aria-hidden="true"></i>
                      Respondido em {dataBR(checkin.respondido_em)}
                    </span>
                  ) : (
                    <span style={{ color: 'var(--orange)' }}>
                      <i className="ti ti-clock" style={{ marginRight: 4 }} aria-hidden="true"></i>
                      Aguardando resposta
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                  Enviado em {dataBR(checkin.enviado_em)} · {checkin.perguntas?.length ?? 0} perguntas
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nenhum check-in enviado</div>
            )}
          </div>
          <button className="btn-outline" style={{ fontSize: 11, padding: '3px 9px', flexShrink: 0 }}
            onClick={() => onIrParaTab?.('checkin')}>
            <i className="ti ti-send" aria-hidden="true"></i> Enviar
          </button>
        </div>
      </div>

      {/* ── Leitura de Consistência ── */}
      {consistencia !== undefined && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={labelSub}>Consistência clínica · últimos 30 dias</div>
          {consistencia.aguardando ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text3)', marginBottom: 4 }}>
                Aguardando dados iniciais
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>
                Ainda não há registros suficientes para uma leitura confiável.
              </div>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                <span style={{
                  fontSize: 14, fontWeight: 600,
                  color: COR_LEITURA[consistencia.classificacao] ?? 'var(--text2)',
                }}>
                  {consistencia.label}
                </span>
                {consistencia.queda7d && (
                  <span style={{ fontSize: 11, color: 'var(--orange)', fontWeight: 500 }}>
                    ↘ Queda recente (7d)
                  </span>
                )}
              </div>
              {consistencia.explicacao && (
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, marginBottom: 6 }}>
                  {consistencia.explicacao}
                </div>
              )}
            </>
          )}
          <div style={{ fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', marginTop: 2 }}>
            Baseado nos registros disponíveis no app.
          </div>
        </div>
      )}

      {/* ── Avaliação + Follow-up ── */}
      <div className="g2">
        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={labelSub}>Última avaliação</div>
          {avaliacao ? (
            <>
              <div style={{ fontSize: 15, fontWeight: 600, color: corDias(diasAvaliacao, 30, 90) }}>
                {avaliacao.kg ? `${avaliacao.kg} kg` : 'Registrada'}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {dataBR(avaliacao.data)}
                {avaliacao.pgc ? ` · ${avaliacao.pgc}% gordura` : ''}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nenhuma registrada</div>
          )}
          <button className="btn-outline" style={btnAcao} onClick={() => onIrParaTab?.('avaliacao')}>
            <i className="ti ti-ruler-measure" aria-hidden="true"></i> Registrar
          </button>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div style={labelSub}>Último follow-up</div>
          {followup ? (
            <>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dark)', marginBottom: 2 }}>
                {followup.titulo || 'Sem título'}
              </div>
              <div style={{ fontSize: 12, color: corDias(diasFollowup, 7, 15) }}>
                {dataBR(followup.data ?? followup.created_at)}
                {diasFollowup !== null && (
                  <span style={{ color: 'var(--text3)', marginLeft: 4 }}>
                    ({diasFollowup === 0 ? 'hoje' : `há ${diasFollowup}d`})
                  </span>
                )}
              </div>
            </>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text3)' }}>Nenhum follow-up</div>
          )}
          <button className="btn-outline" style={btnAcao} onClick={() => onIrParaTab?.('followup')}>
            <i className="ti ti-notebook" aria-hidden="true"></i> Follow-up
          </button>
        </div>
      </div>

      {/* ── Conduta atual ── */}
      {condutaAtual && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={labelSub}>Conduta atual</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>
                {condutaAtual.titulo}
              </div>
              {condutaAtual.objetivo_principal && (
                <div style={{ fontSize: 12, color: 'var(--text2)', marginTop: 2, lineHeight: 1.5 }}>
                  {condutaAtual.objetivo_principal}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>
                {dataBR(condutaAtual.data)}
              </div>
            </div>
            <button className="btn-outline" style={{ fontSize: 11, padding: '3px 9px', flexShrink: 0 }}
              onClick={() => onIrParaTab?.('condutas')}>
              <i className="ti ti-clipboard-list" aria-hidden="true"></i> Ver condutas
            </button>
          </div>
        </div>
      )}

      {/* ── Metas terapêuticas ── */}
      {metas && metas.length > 0 && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={labelSub}>Metas terapêuticas</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>
                {metas.length} {metas.length === 1 ? 'meta ativa' : 'metas ativas'}
              </div>
              {metas.some(m => m.prioridade === 'alta') && (
                <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 2 }}>
                  {metas.filter(m => m.prioridade === 'alta').length} de alta prioridade
                </div>
              )}
            </div>
            <button className="btn-outline" style={{ fontSize: 11, padding: '3px 9px', flexShrink: 0 }}
              onClick={() => onIrParaTab?.('metas')}>
              <i className="ti ti-target" aria-hidden="true"></i> Ver metas
            </button>
          </div>
        </div>
      )}

      {/* ── Pontos de Atenção ── */}
      {pontosAtencao.length > 0 && (
        <PontosAtencaoCard pontos={pontosAtencao} />
      )}

      {/* ── Última anamnese ── */}
      {anamnese && (
        <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={labelSub}>Última anamnese</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dark)' }}>{anamnese.titulo}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                {dataBR(anamnese.data ?? anamnese.created_at)}
              </div>
            </div>
            <button className="btn-outline" style={{ fontSize: 11, padding: '3px 9px' }}
              onClick={() => onIrParaTab?.('anamnese')}>
              <i className="ti ti-clipboard-text" aria-hidden="true"></i> Ver
            </button>
          </div>
        </div>
      )}
    </>
  );
}

// ── Pontos de Atenção ─────────────────────────────────────────────────────────
function PontosAtencaoCard({ pontos }) {
  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 12 }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 500, marginBottom: 4 }}>
        Pontos de Atenção
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12, lineHeight: 1.4 }}>
        Padrões observados nos registros que tendem a se repetir.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pontos.map(p => (
          <div key={p.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: 'var(--amber)', flexShrink: 0, marginTop: 5,
            }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>
                {p.texto}
              </div>
              <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 2 }}>
                {p.fonte}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', lineHeight: 1.5 }}>
        Baseado nos padrões observados nos registros. Não representa prognóstico clínico.
      </div>
    </div>
  );
}
