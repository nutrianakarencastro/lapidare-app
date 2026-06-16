import { useNavigate } from 'react-router-dom';
import { useSession } from '../../lib/session.jsx';
import { podeAcessar } from '../../lib/modelos.js';
import BloqueioModelo from '../../components/BloqueioModelo.jsx';
import { dataBR } from '../../lib/utils.js';
import { semanaAtualDe, useJornada } from '../../lib/jornadaUtils.js';
import { PROTOCOLOS_RUNTIME } from '../../lib/protocolosRuntime.js';

export default function Jornada() {
  const { profile } = useSession();
  const pacienteId = profile?.id;
  const navigate = useNavigate();
  const { jornada, historico, habitos, protocolos, loading, toggleMeta } = useJornada(pacienteId);

  if (loading) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Carregando…
      </div>
    );
  }

  if (!jornada && historico.length === 0) {
    return (
      <div style={{ padding: '40px 16px', textAlign: 'center' }}>
        <i className="ti ti-route" style={{ fontSize: 36, color: 'var(--muted)', display: 'block', marginBottom: 10 }} aria-hidden="true" />
        <div style={{ fontSize: 15, color: 'var(--ink)', fontFamily: 'var(--font-serif)', marginBottom: 6 }}>
          Sua jornada ainda não começou
        </div>
        <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
          Sua nutricionista vai criar sua jornada em breve.
        </div>
      </div>
    );
  }

  const semana   = jornada ? semanaAtualDe(jornada.data_inicio_fase) : null;
  const total    = jornada?.duracao_semanas_prevista ?? 4;
  const pct      = jornada ? Math.min(100, Math.round((semana / total) * 100)) : 0;
  const metasConcluidas = (jornada?.metas_semana ?? []).filter(m => m.concluida).length;
  const totalMetas      = (jornada?.metas_semana ?? []).length;

  if (!podeAcessar(profile?.acesso_utera, 'jornada')) {
    return <BloqueioModelo modulo="Minha Jornada" tierMinimo={2} />;
  }

  return (
    <div style={{ padding: '0 16px 32px' }}>

      {/* ── Fases encerradas (linha do tempo) ──────────────────────────────── */}
      {historico.map((h, i) => (
        <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 4 }}>
          {/* Linha do tempo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
            <div style={{
              width: 14, height: 14, borderRadius: '50%', flexShrink: 0,
              background: 'var(--hair)', border: '2px solid var(--muted)',
              marginTop: 16,
            }} />
            <div style={{ flex: 1, width: 1, background: 'var(--hair)', minHeight: 16 }} />
          </div>

          {/* Conteúdo da fase encerrada */}
          <div style={{
            flex: 1, padding: '12px 14px', borderRadius: 12, marginBottom: 8,
            background: 'var(--paper)', border: '0.5px solid var(--hair)',
            opacity: 0.8,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
              <span style={{
                fontSize: 9, fontWeight: 600, letterSpacing: '.1em', textTransform: 'uppercase',
                color: 'var(--muted)',
              }}>
                Fase {h.fase} · Concluída
              </span>
              <i className="ti ti-check" style={{ fontSize: 11, color: 'var(--muted)' }} aria-hidden="true" />
            </div>
            <div style={{ fontSize: 15, fontFamily: 'var(--font-serif)', color: 'var(--ink)', marginBottom: 3 }}>
              {h.nome_fase}
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>
              {h.consulta_numero != null && `Consulta ${h.consulta_numero} · `}
              {dataBR(h.data_inicio_fase)} → {dataBR(h.data_fim_fase)} · {h.semanas_cumpridas} semana{h.semanas_cumpridas !== 1 ? 's' : ''}
            </div>
            {(() => {
              const exibir = (h.narrativa_publicada && h.narrativa_aprovada) ? h.narrativa_aprovada : (h.evolucao_resumida ?? null);
              return exibir ? (
                <div style={{
                  marginTop: 8, padding: '8px 10px', borderRadius: 8,
                  background: 'var(--bg-soft)', fontSize: 12, color: 'var(--ink-soft)',
                  lineHeight: 1.5, fontStyle: 'italic',
                }}>
                  "{exibir}"
                </div>
              ) : null;
            })()}
          </div>
        </div>
      ))}

      {/* ── Fase ativa ────────────────────────────────────────────────────── */}
      {jornada && (
        <div style={{ display: 'flex', gap: 14 }}>
          {/* Ponto da linha do tempo */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
            <div style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              background: 'var(--gold-deep)', border: '2.5px solid var(--gold)',
              marginTop: 16,
            }} />
          </div>

          {/* Conteúdo da fase ativa */}
          <div style={{ flex: 1, marginBottom: 8 }}>
            <div style={{
              padding: '16px', borderRadius: 16,
              background: 'var(--white)', border: '0.5px solid var(--hair)',
            }}>
              {/* Header */}
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 9, fontWeight: 600, letterSpacing: '.18em',
                  textTransform: 'uppercase', color: 'var(--gold-deep)', marginBottom: 3,
                }}>
                  Fase {jornada.fase}{jornada.consulta_numero != null ? ` · Consulta ${jornada.consulta_numero}` : ''} · Em andamento
                </div>
                <div style={{ fontSize: 20, fontFamily: 'var(--font-serif)', color: 'var(--ink)', lineHeight: 1.1 }}>
                  {jornada.nome_fase}
                </div>
              </div>

              {/* Objetivo */}
              {jornada.objetivo_fase && (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', lineHeight: 1.5, marginBottom: 12 }}>
                  {jornada.objetivo_fase}
                </div>
              )}

              {/* Protocolos ativos — versão paciente */}
              {protocolos.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
                    color: 'var(--muted)', fontWeight: 600, marginBottom: 8,
                  }}>
                    Estamos trabalhando agora em
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {protocolos.slice(0, 3).map(p => {
                      const info = PROTOCOLOS_RUNTIME[p.protocolo_id];
                      if (!info) return null;
                      return (
                        <div key={p.protocolo_id} style={{
                          padding: '12px 14px', borderRadius: 12,
                          background: 'linear-gradient(135deg, var(--gold-soft, #fdf8f0), var(--white))',
                          border: '0.5px solid var(--gold)',
                        }}>
                          <div style={{
                            fontSize: 13, fontWeight: 600, color: 'var(--ink)',
                            fontFamily: 'var(--font-serif)', marginBottom: info.essencia ? 6 : 0,
                          }}>
                            {info.titulo}
                          </div>
                          {info.essencia && (
                            <div style={{
                              fontSize: 12, color: 'var(--ink-soft)',
                              lineHeight: 1.6, fontStyle: 'italic',
                            }}>
                              "{info.essencia}"
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Progresso semanal */}
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500 }}>
                    Semana {semana} de {total}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{pct}%</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--hair)' }}>
                  <div style={{
                    height: '100%', borderRadius: 3,
                    width: `${pct}%`,
                    background: 'var(--gold-deep)',
                    transition: 'width .4s ease',
                  }} />
                </div>
              </div>

              {/* Metas */}
              {totalMetas > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{
                    fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
                    color: 'var(--muted)', fontWeight: 600, marginBottom: 8,
                  }}>
                    Metas desta semana · {metasConcluidas}/{totalMetas}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                    {(jornada.metas_semana ?? []).map(m => {
                      const hab = m.habito_id
                        ? habitos.find(h => h.id === m.habito_id)
                        : null;
                      return (
                      <button
                        key={m.id}
                        onClick={() => toggleMeta(m.id, !m.concluida)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          padding: '8px 10px', borderRadius: 9, cursor: 'pointer',
                          background: m.concluida ? 'var(--green-soft, var(--bg-soft))' : 'var(--bg-soft)',
                          border: `0.5px solid ${m.concluida ? 'var(--green, var(--hair))' : 'var(--hair)'}`,
                          textAlign: 'left', width: '100%',
                          fontFamily: 'var(--font-sans)',
                        }}>
                        <div style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: m.concluida ? 'var(--green, var(--gold-deep))' : 'var(--white)',
                          border: `1.5px solid ${m.concluida ? 'var(--green, var(--gold-deep))' : 'var(--hair)'}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {m.concluida && (
                            <i className="ti ti-check" style={{ fontSize: 10, color: 'var(--white)' }} aria-hidden="true" />
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span style={{
                            fontSize: 13, color: 'var(--ink)',
                            textDecoration: m.concluida ? 'line-through' : 'none',
                            opacity: m.concluida ? 0.6 : 1,
                          }}>
                            {m.texto}
                          </span>
                          {hab && (
                            <span style={{
                              marginLeft: 7, fontSize: 10, padding: '1px 6px', borderRadius: 20,
                              background: 'var(--gold-soft, var(--bg-soft))',
                              color: 'var(--gold-deep)', fontWeight: 500,
                              verticalAlign: 'middle',
                            }}>
                              {hab.emoji ?? '●'} {hab.nome}
                            </span>
                          )}
                        </div>
                      </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Próximo marco */}
              {jornada.proximo_marco && (
                <div style={{
                  padding: '8px 12px', borderRadius: 9,
                  background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12,
                }}>
                  <i className="ti ti-flag" style={{ fontSize: 14, color: 'var(--gold-deep)', flexShrink: 0 }} aria-hidden="true" />
                  <div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 1 }}>Próximo marco</div>
                    <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500 }}>
                      {jornada.proximo_marco}
                      {jornada.data_proximo_marco && (
                        <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: 6 }}>
                          · {dataBR(jornada.data_proximo_marco)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Evolução resumida */}
              {jornada.evolucao_resumida && (
                <div style={{
                  padding: '10px 12px', borderRadius: 10,
                  background: 'linear-gradient(135deg, var(--gold-soft, var(--bg-soft)), var(--white))',
                  border: '0.5px solid var(--gold)',
                  fontSize: 13, color: 'var(--ink)', lineHeight: 1.6,
                  fontStyle: 'italic',
                }}>
                  "{jornada.evolucao_resumida}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Se só tem histórico (acompanhamento encerrado) */}
      {!jornada && historico.length > 0 && (
        <div style={{
          padding: '14px 16px', borderRadius: 12,
          background: 'var(--paper)', border: '0.5px solid var(--hair)',
          textAlign: 'center', fontSize: 13, color: 'var(--muted)',
          marginLeft: 34,
        }}>
          Acompanhamento concluído. {historico.length} fase{historico.length !== 1 ? 's' : ''} na jornada.
        </div>
      )}
    </div>
  );
}
