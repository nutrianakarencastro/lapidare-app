import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';

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

export default function ResumoClinico({ pacienteId, nutriId, onIrParaTab }) {
  const navigate = useNavigate();
  const [prox, setProx] = useState(undefined);
  const [ultCons, setUltCons] = useState(undefined);
  const [checkin, setCheckin] = useState(undefined);
  const [followup, setFollowup] = useState(undefined);
  const [avaliacao, setAvaliacao] = useState(undefined);
  const [anamnese, setAnamnese] = useState(undefined);
  const [condutaAtual, setCondutaAtual] = useState(undefined);
  const [metas, setMetas]               = useState(undefined);

  useEffect(() => {
    let active = true;
    async function load() {
      const agora = new Date().toISOString();
      const [proxRes, ultConsRes, checkinRes, followupRes, avalRes, anamRes, condutaRes, metasRes] = await Promise.all([
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
    }
    load();
    return () => { active = false; };
  }, [pacienteId, nutriId]);

  if (prox === undefined) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  const diasFollowup = diasDesde(followup?.data ?? followup?.created_at);
  const diasAvaliacao = diasDesde(avaliacao?.data);

  const labelSub = { fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 500, marginBottom: 8 };
  const btnAcao  = { fontSize: 11, padding: '3px 9px', marginTop: 10 };

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
