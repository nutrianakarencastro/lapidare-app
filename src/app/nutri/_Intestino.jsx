import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase.js';
import { dataBR } from '../../lib/utils.js';
import {
  BRISTOL_LABELS,
  distribuicaoBristol, mediaEvacuacoesPorSemana,
  detectarSinaisAtencao, calcularTendenciasClinicas,
  bristolMaisFrequente,
} from '../../lib/intestinoUtils.js';

// ─── Bristol SVG (mesmo do paciente) ─────────────────────────────────────────

function BristolSVG({ tipo, size = 30 }) {
  const verde = '#7ea85a';
  const ambar = '#c4a882';
  const rosa  = '#c4616e';
  const cor   = (tipo === 4 || tipo === 5) ? verde : (tipo <= 2 || tipo === 7) ? rosa : ambar;

  const conteudo = {
    1: <g>{[[9,10],[21,10],[9,22],[21,22],[15,16]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r={4} fill={cor}/>)}</g>,
    2: <g><ellipse cx={15} cy={16} rx={11} ry={6} fill={cor}/><circle cx={8} cy={14} r={4} fill={cor}/><circle cx={22} cy={18} r={3} fill={cor}/></g>,
    3: <g><rect x={5} y={12} width={20} height={8} rx={4} fill={cor}/>{[9,14,19].map(x=><line key={x} x1={x} y1={12} x2={x-1} y2={20} stroke="white" strokeWidth={1.5}/>)}</g>,
    4: <rect x={4} y={13} width={22} height={6} rx={3} fill={cor}/>,
    5: <g>{[[7,13,5],[16,15,5],[22,12,4]].map(([cx,cy,r],i)=><ellipse key={i} cx={cx} cy={cy} rx={r} ry={r-1} fill={cor}/>)}</g>,
    6: <g>{[[8,12,4],[17,16,5],[12,22,3],[22,21,4]].map(([cx,cy,r],i)=><circle key={i} cx={cx} cy={cy} r={r} fill={cor} opacity={0.85}/>)}</g>,
    7: <path d="M4,16 Q8,10 15,13 Q22,10 26,16 Q22,22 15,19 Q8,22 4,16Z" fill={cor} opacity={0.75}/>,
  };

  return (
    <svg viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
      {conteudo[tipo] ?? null}
    </svg>
  );
}

// ─── Distribuição Bristol (gráfico de barras simples) ────────────────────────

function GraficoBristol({ dist }) {
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  if (!total) return null;
  const max = Math.max(...Object.values(dist), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[1, 2, 3, 4, 5, 6, 7].map(tipo => {
        const n    = dist[tipo] ?? 0;
        const pct  = Math.round((n / total) * 100);
        const frac = n / max;
        const ideal = tipo === 4 || tipo === 5;
        const cor   = ideal ? '#7ea85a' : (tipo <= 2 || tipo === 7) ? '#c4616e' : '#c4a882';

        return (
          <div key={tipo} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <BristolSVG tipo={tipo} size={22} />
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden' }}>
                <div style={{ width: `${frac * 100}%`, height: '100%', background: cor, borderRadius: 4, transition: 'width .4s ease' }} />
              </div>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', minWidth: 40, textAlign: 'right' }}>
              {n > 0 ? `${n}× (${pct}%)` : '—'}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Card de métrica ──────────────────────────────────────────────────────────

function CardMetrica({ label, valor, sub }) {
  return (
    <div style={{
      background: 'var(--white)', border: '0.5px solid var(--border)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--dark)' }}>{valor ?? '—'}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function IntestinoNutri({ pacienteId, nutriId }) {
  const [logs, setLogs] = useState(null);
  const [sintomasDiarios, setSintomasDiarios] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [solicitandoRastreio, setSolicitandoRastreio] = useState(false);
  const [aviso, setAviso] = useState(null);

  const dataInicio30 = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const carregar = useCallback(async () => {
    const [logsRes, sintRes, histRes] = await Promise.all([
      supabase.from('intestino_logs')
        .select('*')
        .eq('paciente_id', pacienteId)
        .gte('data', dataInicio30)
        .order('data', { ascending: false }),
      supabase.from('ciclo_sintomas_diarios')
        .select('data, energia, acne, inchaco, compulsao, humor')
        .eq('paciente_id', pacienteId)
        .gte('data', dataInicio30),
      supabase.from('intestino_rastreio_solicitacoes')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('solicitado_em', { ascending: false })
        .limit(10),
    ]);
    setLogs(logsRes.data ?? []);
    setSintomasDiarios(sintRes.data ?? []);
    setHistorico(histRes.data ?? []);
  }, [pacienteId]);

  useEffect(() => { carregar(); }, [carregar]);

  async function encerrarPendenciasRastreio() {
    const agora = new Date().toISOString();
    const { data, error } = await supabase
      .from('intestino_rastreio_solicitacoes')
      .update({ cancelado_em: agora, cancelado_por: nutriId })
      .eq('paciente_id', pacienteId)
      .is('respondido_em', null)
      .is('cancelado_em', null)
      .select('id');
    if (error) { setAviso('Erro ao encerrar pendência. Tente novamente.'); return; }
    if (!data?.length) { setAviso('Nenhuma pendência ativa encontrada.'); return; }
    await carregar();
    setAviso('Pendência encerrada.');
    setTimeout(() => setAviso(null), 3000);
  }

  async function solicitarRastreio() {
    setSolicitandoRastreio(true);
    const { error } = await supabase.from('intestino_rastreio_solicitacoes').insert({
      paciente_id: pacienteId,
      nutri_id: nutriId,
    });
    setSolicitandoRastreio(false);
    if (error) { setAviso('Erro ao solicitar. Tente novamente.'); return; }
    await carregar();
    setAviso('Rastreio solicitado! A paciente verá o aviso no app.');
    setTimeout(() => setAviso(null), 3000);
  }

  if (logs === null) {
    return (
      <div style={{ padding: 24, color: 'var(--text3)', fontSize: 14 }}>Carregando…</div>
    );
  }

  const diarios   = logs.filter(l => l.tipo === 'diario');
  const rastreios = logs.filter(l => l.tipo === 'rastreio');
  const dist      = distribuicaoBristol(diarios);
  const mediaEvac = mediaEvacuacoesPorSemana(diarios);
  const bristolFreq = bristolMaisFrequente(diarios);
  const sinais    = detectarSinaisAtencao(logs);
  const tendencias = calcularTendenciasClinicas(diarios, sintomasDiarios);

  const pendente = historico.find(h => !h.respondido_em && !h.cancelado_em);

  return (
    <div style={{ paddingBottom: 32 }}>
      {aviso && (
        <div style={{
          background: 'var(--dark)', color: 'white', padding: '10px 20px',
          borderRadius: 10, fontSize: 13, marginBottom: 16,
          fontFamily: 'var(--font-sans)',
        }}>
          {aviso}
        </div>
      )}

      {/* ── Ação: Solicitar rastreio ───────────────────────────────────────── */}
      <div style={{
        background: 'var(--bg2)', border: '0.5px solid var(--border)',
        borderRadius: 12, padding: '14px 16px', marginBottom: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)' }}>Rastreio intestinal aprofundado</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
            {pendente
              ? 'Aguardando resposta da paciente'
              : 'Solicite quando quiser uma avaliação detalhada'}
          </div>
        </div>
        <button
          onClick={solicitarRastreio}
          disabled={solicitandoRastreio || !!pendente}
          style={{
            padding: '9px 16px', borderRadius: 10, border: 'none', cursor: pendente ? 'not-allowed' : 'pointer',
            fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)', whiteSpace: 'nowrap',
            background: pendente ? 'var(--bg3)' : 'var(--dark)',
            color: pendente ? 'var(--text4)' : 'white',
          }}
        >
          {solicitandoRastreio ? 'Solicitando…' : pendente ? 'Pendente' : 'Solicitar rastreio'}
        </button>
      </div>

      {/* ── Sem dados ──────────────────────────────────────────────────────── */}
      {!diarios.length && !rastreios.length && (
        <div className="card empty-card">
          <i className="ti ti-leaf" style={{ fontSize: 28, color: 'var(--text4)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', marginBottom: 4 }}>
            Sem registros intestinais
          </div>
          <div className="empty-sub" style={{ fontSize: 13 }}>
            A paciente ainda não registrou dados intestinais nos últimos 30 dias.
          </div>
        </div>
      )}

      {/* ── Métricas gerais ────────────────────────────────────────────────── */}
      {diarios.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 10 }}>Últimos 30 dias</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 20 }}>
            <CardMetrica label="Dias registrados" valor={diarios.length} sub="dos últimos 30" />
            <CardMetrica
              label="Evacuações / semana"
              valor={mediaEvac !== null ? `${mediaEvac}×` : '—'}
              sub="média"
            />
            <CardMetrica
              label="Bristol mais comum"
              valor={bristolFreq ? BRISTOL_LABELS[bristolFreq]?.label : '—'}
              sub={bristolFreq ? (bristolFreq === 4 || bristolFreq === 5 ? 'ideal' : '') : ''}
            />
          </div>

          {/* ── Sinais de atenção ─────────────────────────────────────────── */}
          {sinais.length > 0 && (
            <>
              <div className="section-label" style={{ marginBottom: 10 }}>Sinais de atenção</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                {sinais.map(s => (
                  <div
                    key={s.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 14px', borderRadius: 10,
                      background: s.nivel === 'atencao' ? '#fdedef' : 'var(--bg2)',
                      border: `0.5px solid ${s.nivel === 'atencao' ? '#f0c0c8' : 'var(--border)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <i
                        className={`ti ti-${s.nivel === 'atencao' ? 'alert-triangle' : 'eye'}`}
                        style={{ fontSize: 15, color: s.nivel === 'atencao' ? '#c4616e' : 'var(--text3)' }}
                        aria-hidden="true"
                      />
                      <span style={{ fontSize: 13, fontWeight: 600, color: s.nivel === 'atencao' ? '#c4616e' : 'var(--dark)' }}>
                        {s.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                      {s.count} {s.count === 1 ? 'vez' : 'vezes'}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Distribuição Bristol ──────────────────────────────────────── */}
          <div className="section-label" style={{ marginBottom: 10 }}>Distribuição Bristol</div>
          <div style={{
            background: 'var(--white)', border: '0.5px solid var(--border)',
            borderRadius: 12, padding: '16px', marginBottom: 20,
          }}>
            <GraficoBristol dist={dist} />
          </div>

          {/* ── Padrão de sintomas ────────────────────────────────────────── */}
          {(() => {
            const comGases     = diarios.filter(l => (l.gases ?? 0) >= 2).length;
            const comEstuf     = diarios.filter(l => (l.estufamento ?? 0) >= 2).length;
            const comDor       = diarios.filter(l => (l.dor_abdominal ?? 0) >= 2).length;
            const comUrgencia  = diarios.filter(l => l.urgencia).length;
            const linhas = [
              { label: 'Gases moderado/forte', count: comGases },
              { label: 'Estufamento moderado/forte', count: comEstuf },
              { label: 'Dor abdominal moderada/forte', count: comDor },
              { label: 'Urgência', count: comUrgencia },
            ].filter(l => l.count > 0);
            if (!linhas.length) return null;
            return (
              <>
                <div className="section-label" style={{ marginBottom: 10 }}>Padrão de sintomas</div>
                <div style={{
                  background: 'var(--white)', border: '0.5px solid var(--border)',
                  borderRadius: 12, padding: '14px 16px', marginBottom: 20,
                }}>
                  {linhas.map((l, i) => (
                    <div
                      key={l.label}
                      style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: i < linhas.length - 1 ? '0.5px solid var(--border)' : 'none',
                      }}
                    >
                      <span style={{ fontSize: 13, color: 'var(--dark)' }}>{l.label}</span>
                      <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                        {l.count}/{diarios.length} dias
                      </span>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}

          {/* ── Tendências clínicas ───────────────────────────────────────── */}
          {tendencias.length > 0 && (
            <>
              <div className="section-label" style={{ marginBottom: 10 }}>Tendências clínicas observadas</div>
              <div style={{
                background: '#eef5e3', border: '0.5px solid #c8e0a8',
                borderRadius: 12, padding: '14px 16px', marginBottom: 20,
                display: 'flex', flexDirection: 'column', gap: 8,
              }}>
                {tendencias.map(t => (
                  <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                    <i className="ti ti-trending-up" style={{ fontSize: 14, color: '#7ea85a', marginTop: 2 }} aria-hidden="true" />
                    <span style={{ fontSize: 13, color: '#3d6b27', lineHeight: 1.5 }}>{t.descricao}</span>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* ── Registros diários detalhados ──────────────────────────────── */}
          <div className="section-label" style={{ marginBottom: 10 }}>Registros diários</div>
          <div style={{
            background: 'var(--white)', border: '0.5px solid var(--border)',
            borderRadius: 12, overflow: 'hidden', marginBottom: 20,
          }}>
            {diarios.slice(0, 20).map((l, i) => (
              <div
                key={l.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: i < Math.min(diarios.length, 20) - 1 ? '0.5px solid var(--border)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ minWidth: 70, fontSize: 12, color: 'var(--text3)' }}>{dataBR(l.data)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, flexWrap: 'wrap' }}>
                    {l.evacuou ? (
                      <>
                        {l.bristol && <BristolSVG tipo={l.bristol} size={22} />}
                        {l.bristol && (
                          <span style={{ fontSize: 12, color: 'var(--dark)' }}>
                            {BRISTOL_LABELS[l.bristol]?.label}
                          </span>
                        )}
                        {l.frequencia_dia && (
                          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{l.frequencia_dia}×</span>
                        )}
                      </>
                    ) : (
                      <span style={{ fontSize: 12, color: 'var(--text3)' }}>Não evacuou</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {l.muco                      && <span title="Muco"                    style={flagStyle('#c4616e')}>M</span>}
                    {l.esvaziamento_incompleto    && <span title="Esvaziamento incompleto" style={flagStyle('#c4a882')}>EI</span>}
                    {(l.dor_abdominal ?? 0) >= 2  && <span title="Dor abdominal"          style={flagStyle('#c4a882')}>D</span>}
                    {(l.nauseas ?? 0) >= 2         && <span title="Náuseas"                style={flagStyle('#c4a882')}>N</span>}
                  </div>
                </div>
                {l.observacoes && (
                  <div style={{ marginTop: 4, paddingLeft: 82, fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', lineHeight: 1.4 }}>
                    {l.observacoes}
                  </div>
                )}
              </div>
            ))}
            {diarios.length > 20 && (
              <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text3)' }}>
                + {diarios.length - 20} registros anteriores
              </div>
            )}
          </div>
        </>
      )}

      {/* ── Rastreios aprofundados ─────────────────────────────────────────── */}
      {rastreios.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 10 }}>Rastreios aprofundados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
            {rastreios.map(r => (
              <div key={r.id} style={{
                background: 'var(--white)', border: '0.5px solid var(--border)',
                borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>{dataBR(r.data)}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {r.cor_fezes          && <RastreioCampo label="Cor" valor={r.cor_fezes} />}
                  {r.cheiro_fezes       && <RastreioCampo label="Cheiro" valor={r.cheiro_fezes} />}
                  {r.momento_estufamento && <RastreioCampo label="Momento do estufamento" valor={r.momento_estufamento} />}
                  {r.localizacao_dor    && <RastreioCampo label="Localização da dor" valor={r.localizacao_dor} />}
                  {r.sensacao_apos_evacuar && <RastreioCampo label="Sensação após evacuar" valor={r.sensacao_apos_evacuar} />}
                  {r.relacao_refeicoes  && <RastreioCampo label="Relação com refeições" valor={r.relacao_refeicoes} />}
                  {r.relacao_ciclo      && <RastreioCampo label="Relação com ciclo" valor={r.relacao_ciclo} />}
                  {r.observacoes        && <RastreioCampo label="Observações" valor={r.observacoes} />}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Histórico de solicitações ──────────────────────────────────────── */}
      {historico.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 10 }}>Histórico de rastreios</div>
          <div style={{
            background: 'var(--white)', border: '0.5px solid var(--border)',
            borderRadius: 12, overflow: 'hidden',
          }}>
            {historico.slice(0, 5).map((h, i) => (
              <div key={h.id} style={{
                padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                borderBottom: i < Math.min(historico.length, 5) - 1 ? '0.5px solid var(--border)' : 'none',
              }}>
                <div style={{ fontSize: 13, color: 'var(--dark)' }}>
                  Solicitado em {dataBR(h.solicitado_em?.slice(0, 10))}
                </div>
                {h.respondido_em ? (
                  <span style={{ fontSize: 11, color: '#7ea85a', fontWeight: 600 }}>Respondido ✓</span>
                ) : h.cancelado_em ? (
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Encerrado</span>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, color: 'var(--amber)', fontWeight: 600 }}>Pendente</span>
                    <button
                      onClick={() => encerrarPendenciasRastreio()}
                      style={{
                        fontSize: 11, padding: '2px 8px', borderRadius: 6,
                        border: '0.5px solid var(--border)', background: 'none',
                        cursor: 'pointer', color: 'var(--text3)',
                        fontFamily: 'var(--font-sans)',
                      }}>
                      Encerrar pendência
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RastreioCampo({ label, valor }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, minWidth: 120 }}>{label}:</span>
      <span style={{ fontSize: 12, color: 'var(--dark)', flex: 1 }}>{valor}</span>
    </div>
  );
}

function flagStyle(cor) {
  return {
    fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 99,
    background: `${cor}22`, color: cor,
  };
}
