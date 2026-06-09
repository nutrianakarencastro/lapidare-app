import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { calcularPerfilBiologico, calcularMapaGatilhos } from '../../lib/perfilBiologicoUtils.js';
import { calcularRegistrosCarga, calcularCorrelacaoSupl } from '../../lib/registrosHabitos.js';

const COR_CONF = {
  alta:     'var(--green)',
  moderada: 'var(--amber)',
};

// ── Força da associação (Corpo → Comportamento) ────────────────────────────────
const COR_FORCA   = { forte: 'var(--green)', moderada: 'var(--amber)' };
const BG_FORCA    = { forte: 'var(--green-bg)', moderada: '#fef9e7' };
const LABEL_FORCA = { forte: 'Associação consistente', moderada: 'Associação observada' };

function AssociacaoCard({ assoc: a, isLast }) {
  const cor     = COR_FORCA[a.forca];
  const isSolid = a.confianca === 'alta';

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '12px 0',
      borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
    }}>
      {/* Dot: sólido = alta confiança; contorno = moderada */}
      <span style={{
        width: 9, height: 9, borderRadius: '50%', flexShrink: 0, marginTop: 4,
        background:   isSolid ? cor : 'transparent',
        border:       `2px solid ${cor}`,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>
            {a.labelA.charAt(0).toUpperCase() + a.labelA.slice(1)} e {a.labelB}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600, letterSpacing: .4,
            background: BG_FORCA[a.forca], color: cor,
            padding: '2px 7px', borderRadius: 20,
          }}>
            {LABEL_FORCA[a.forca]}
          </span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 4 }}>
          "{a.narrativa}"
        </div>
        <div style={{ fontSize: 11, color: 'var(--text4)' }}>
          Co-ocorrência: {a.prevAB}% dos dias · esperado: {a.esperado}% · {a.nAB} registros em comum
        </div>
      </div>
    </div>
  );
}
// ── Mapa de Gatilhos ──────────────────────────────────────────────────────────
const COR_FORCA_MAPA   = { forte: 'var(--green)', moderada: 'var(--amber)' };
const BG_FORCA_MAPA    = { forte: 'var(--green-bg)', moderada: '#fef9e7' };
const LABEL_FORCA_MAPA = { forte: 'Associação consistente', moderada: 'Associação observada' };

function FatorCard({ fator, isLast }) {
  const cor = COR_FORCA_MAPA[fator.forca];
  return (
    <div style={{ padding: '12px 0', borderBottom: isLast ? 'none' : '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, flexWrap: 'wrap' }}>
        <span style={{
          fontSize: 9, fontWeight: 600, letterSpacing: .4,
          background: BG_FORCA_MAPA[fator.forca], color: cor,
          padding: '2px 7px', borderRadius: 20,
        }}>
          {LABEL_FORCA_MAPA[fator.forca]}
        </span>
      </div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 4 }}>
        "{fator.narrativa}"
      </div>
      <div style={{ fontSize: 11, color: 'var(--text4)' }}>
        {fator.nCom} dias com a condição · {fator.nSem} sem a condição
      </div>
    </div>
  );
}

function MapaGatilhosCard({ mapa, mapaFase, faseInfo }) {
  const { fatores, influenciaCiclo } = mapa;
  const temFatores = fatores && fatores.length > 0;
  const temFase    = mapaFase !== null && faseInfo !== null && faseInfo.diasRegistrados >= 14;
  if (!temFatores && !influenciaCiclo && !temFase) return null;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Fatores Associados a Dias Difíceis</div>
          <div className="card-sub">Condições mais presentes nos dias de maior carga sintomática nos registros</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 0 }}>

        {/* ── 180 dias ── */}
        {!temFatores && !influenciaCiclo && (
          <div style={{ fontSize: 12, color: 'var(--text4)', fontStyle: 'italic', marginBottom: 10 }}>
            Nenhum padrão identificado nos últimos 180 dias.
          </div>
        )}
        {temFatores && fatores.map((f, i) => (
          <FatorCard key={f.id} fator={f} isLast={i === fatores.length - 1 && !influenciaCiclo} />
        ))}
        {influenciaCiclo && (
          <>
            {temFatores && <div style={{ height: '0.5px', background: 'var(--border)', margin: '6px 0 12px' }} />}
            <div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                color: 'var(--text4)', marginBottom: 6,
              }}>
                Influência do ciclo observada
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 4 }}>
                "{influenciaCiclo.narrativa}"
              </div>
              <div style={{ fontSize: 11, color: 'var(--text4)' }}>
                {influenciaCiclo.nLutea} dias em fase lútea analisados
              </div>
            </div>
          </>
        )}

        {/* ── Fase atual ── */}
        {temFase && (
          <>
            <div style={{ height: '0.5px', background: 'var(--border)', margin: '10px 0 12px' }} />
            <div>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                color: 'var(--text4)', marginBottom: 8,
              }}>
                Fase atual · há {faseInfo.diasCalendario} dia{faseInfo.diasCalendario !== 1 ? 's' : ''}
              </div>
              {!mapaFase.disponivel ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                  Esta fase ainda possui poucos registros para identificar padrões observados.
                  <br />
                  <span style={{ fontSize: 11, color: 'var(--text4)' }}>
                    {faseInfo.diasRegistrados} dias registrados.
                  </span>
                </div>
              ) : !mapaFase.fatores?.length && !mapaFase.influenciaCiclo ? (
                <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
                  Nenhum padrão associado identificado nesta fase.
                  <br />
                  <span style={{ fontSize: 11, color: 'var(--text4)' }}>
                    {faseInfo.diasRegistrados} dias registrados.
                  </span>
                </div>
              ) : (
                <>
                  {(mapaFase.fatores ?? []).map((f, i) => (
                    <FatorCard
                      key={f.id}
                      fator={f}
                      isLast={i === (mapaFase.fatores.length - 1) && !mapaFase.influenciaCiclo}
                    />
                  ))}
                  {mapaFase.influenciaCiclo && (
                    <>
                      {mapaFase.fatores?.length > 0 && (
                        <div style={{ height: '0.5px', background: 'var(--border)', margin: '6px 0 12px' }} />
                      )}
                      <div style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                        color: 'var(--text4)', marginBottom: 6,
                      }}>
                        Influência do ciclo observada
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 4 }}>
                        "{mapaFase.influenciaCiclo.narrativa}"
                      </div>
                    </>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 6 }}>
                    {faseInfo.diasRegistrados} dias registrados nesta fase.
                  </div>
                </>
              )}
            </div>
          </>
        )}

        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', lineHeight: 1.5 }}>
          Associações calculadas nos dias com registro completo dos campos relevantes. Não indicam relação causal. A fase lútea é um contexto fisiológico, não um fator modificável.
        </div>
      </div>
    </div>
  );
}

// ── Convergências Clínicas ─────────────────────────────────────────────────────
function ConvergenciaCard({ conv, isLast }) {
  return (
    <div style={{
      paddingBottom: isLast ? 0 : 16,
      marginBottom:  isLast ? 0 : 16,
      borderBottom:  isLast ? 'none' : '0.5px solid var(--border)',
    }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>
          Padrões compatíveis com o {conv.eixoNome}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
          {conv.eixoSubtitulo}
        </div>
      </div>

      <div style={{ marginBottom: conv.pares.length > 0 ? 10 : 0 }}>
        <div style={{
          fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
          color: 'var(--text4)', marginBottom: 5,
        }}>
          Campos convergentes
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {conv.campos.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text2)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--amber)', flexShrink: 0 }} />
              {c.label}
            </div>
          ))}
        </div>
      </div>

      {conv.pares.length > 0 && (
        <div>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            color: 'var(--text4)', marginBottom: 5,
          }}>
            Associação reforçada
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {conv.pares.map((par, i) => (
              <div key={i} style={{ fontSize: 12, color: 'var(--text2)' }}>
                {par.labelA.charAt(0).toUpperCase() + par.labelA.slice(1)} ↔ {par.labelB}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Tempo de Retomada ─────────────────────────────────────────────────────────
function TempoRetomadaCard({ tempoRetomada }) {
  const { mediana, minDias, maxDias, nEpisodios } = tempoRetomada;
  const labelDias = mediana === 1 ? 'dia' : 'dias';
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Tempo de Retomada</div>
          <div className="card-sub">Tempo observado de retomada após períodos de maior carga sintomática.</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 0 }}>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 10 }}>
          <span style={{ fontSize: 28, fontWeight: 700, color: 'var(--dark)', lineHeight: 1 }}>
            {mediana}
          </span>
          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 500 }}>
            {labelDias}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            (mediana observada)
          </span>
        </div>

        <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            Variação:{' '}
            <strong style={{ color: 'var(--text2)' }}>
              {minDias} a {maxDias} {maxDias === 1 ? 'dia' : 'dias'}
            </strong>
          </span>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>
            Baseado em{' '}
            <strong style={{ color: 'var(--text2)' }}>
              {nEpisodios} {nEpisodios === 1 ? 'período' : 'períodos'} analisados
            </strong>
          </span>
        </div>

        <div style={{
          padding: '8px 11px', borderRadius: 7, fontSize: 11,
          background: 'var(--bg2)', color: 'var(--text3)', lineHeight: 1.55,
          marginBottom: 10,
        }}>
          A fase lútea está incluída no cálculo. Períodos de maior carga nessa fase refletem uma influência fisiológica do ciclo sobre os registros.
        </div>

        <div style={{ fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', lineHeight: 1.5 }}>
          Baseado nos registros observados nos últimos 180 dias. Não representa avaliação funcional. A interpretação clínica é da nutricionista.
        </div>
      </div>
    </div>
  );
}

// ── Priorização Clínica ────────────────────────────────────────────────────────
function PriorizacaoCard({ priorizacao }) {
  const { principal, secundaria } = priorizacao;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Priorização Clínica</div>
          <div className="card-sub">Síntese dos padrões encontrados neste perfil</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 0 }}>

        {/* ── Área principal ── */}
        <div style={{ marginBottom: secundaria ? 14 : 10 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
            color: 'var(--text4)', marginBottom: 6,
          }}>
            Área de atenção observada
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--dark)', marginBottom: 2 }}>
            {principal.eixoNome}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 10 }}>
            {principal.eixoSubtitulo}
          </div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text4)', marginBottom: 5 }}>
            Baseado principalmente em:
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {principal.top3.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text2)' }}>
                <span style={{ color: 'var(--text4)', flexShrink: 0 }}>•</span>
                {c.label}
              </div>
            ))}
          </div>
        </div>

        {/* ── Área secundária (opcional) ── */}
        {secundaria && (
          <>
            <div style={{ height: '0.5px', background: 'var(--border)', marginBottom: 12 }} />
            <div style={{ marginBottom: 10 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase',
                color: 'var(--text4)', marginBottom: 5,
              }}>
                Área complementar nos registros
              </div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>
                {secundaria.eixoNome}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
                {secundaria.eixoSubtitulo}
              </div>
            </div>
          </>
        )}

        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', lineHeight: 1.6 }}>
          Síntese observacional baseada nos padrões dos registros.
          Não representa diagnóstico funcional. A interpretação clínica é da nutricionista.
        </div>
      </div>
    </div>
  );
}

const BG_CONF = {
  alta:     'var(--green-bg)',
  moderada: '#fef9e7',
};
const LABEL_CONF = {
  alta:     'Alta confiança',
  moderada: 'Confiança moderada',
};

// ── Card: padrão confirmado ────────────────────────────────────────────────────
function PadraoCard({ padrao, isPrincipal = false }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '13px 0',
      borderBottom: isPrincipal ? 'none' : '0.5px solid var(--border)',
    }}>
      <span style={{
        width: 9, height: 9, borderRadius: '50%', flexShrink: 0,
        background: COR_CONF[padrao.confianca], marginTop: 4,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>
            {padrao.grupoLabel} · fase {padrao.faseDomLabel}
          </span>
          <span style={{
            fontSize: 9, fontWeight: 600, letterSpacing: .4,
            background: BG_CONF[padrao.confianca], color: COR_CONF[padrao.confianca],
            padding: '2px 7px', borderRadius: 20,
          }}>
            {LABEL_CONF[padrao.confianca]}
          </span>
        </div>
        <div style={{
          fontSize: 12, color: 'var(--text2)', lineHeight: 1.6,
          fontStyle: 'italic', marginBottom: 5,
        }}>
          "{padrao.narrativa}"
        </div>
        <div style={{ fontSize: 11, color: 'var(--text4)', lineHeight: 1.5 }}>
          Presente em {padrao.prevDominante}% dos dias nessa fase
          {padrao.prevOutras > 0 ? ` · ${padrao.prevOutras}% nas outras fases` : ''}
          {' · '}{padrao.nObs} observações
        </div>
      </div>
    </div>
  );
}

// ── Card: padrão em formação ───────────────────────────────────────────────────
function PadraoFormacaoCard({ padrao, isLast }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 12,
      padding: '11px 0',
      borderBottom: isLast ? 'none' : '0.5px solid var(--border)',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        border: '1.5px dashed var(--text3)', marginTop: 4,
      }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)', marginBottom: 3 }}>
          {padrao.grupoLabel} · fase {padrao.faseDomLabel}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic', lineHeight: 1.55, marginBottom: 3 }}>
          "{padrao.narrativa}"
        </div>
        <div style={{ fontSize: 10, color: 'var(--text4)' }}>
          {padrao.nObs} observações
        </div>
      </div>
    </div>
  );
}

// ── Registros e Carga Sintomática ─────────────────────────────────────────────
function RegistroSuplCard({ dados }) {
  const { cargaCom, cargaSem, delta, nCom, nSem } = dados;
  const linhaSt = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
    padding: '8px 0',
    borderBottom: '0.5px solid var(--border)',
  };
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Registros de Suplementação e Carga Sintomática</div>
          <div className="card-sub">Padrão observado nos dias com e sem registro de suplementação nos últimos 180 dias.</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 0 }}>
        <div style={linhaSt}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Dias com registro de suplementação</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>{cargaCom}%</span>
        </div>
        <div style={{ ...linhaSt, borderBottom: 'none' }}>
          <span style={{ fontSize: 12, color: 'var(--text2)' }}>Dias sem registro de suplementação</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>{cargaSem}%</span>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text4)', marginTop: 10 }}>
          {nCom} dias com registro · {nSem} dias sem registro
          {' · '}diferença observada: {Math.abs(delta)} pp
        </div>
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', lineHeight: 1.5 }}>
          Registro de suplementação não equivale a suplementação tomada. Padrões observacionais não indicam relação causal.
        </div>
      </div>
    </div>
  );
}

function RegistrosECargaCard({ dados }) {
  const { cargaAltaPresenca, delta, nSemanasAlta, nSemanasBaixa } = dados;
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div className="card-header">
        <div>
          <div className="card-title">Registros e Carga Sintomática</div>
          <div className="card-sub">Padrões observados entre semanas com mais registros de hábitos e a carga sintomática no mesmo período.</div>
        </div>
      </div>
      <div className="card-body" style={{ paddingTop: 0 }}>
        <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.6, fontStyle: 'italic', marginBottom: 12 }}>
          "Nas semanas com registros de hábitos mais frequentes, a carga sintomática nos registros pareceu menor."
        </div>
        <div style={{ marginBottom: 10 }}>
          <div style={{
            fontSize: 10, fontWeight: 600, letterSpacing: .5, textTransform: 'uppercase',
            color: 'var(--text4)', marginBottom: 3,
          }}>
            Semanas com registros mais frequentes
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            Carga sintomática: <strong style={{ color: 'var(--dark)' }}>{cargaAltaPresenca}%</strong> dos dias
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            Diferença observada: {delta} pontos percentuais em relação às semanas com menos registros
          </div>
        </div>
        <div style={{ fontSize: 10, color: 'var(--text4)' }}>
          {nSemanasAlta} semanas com registros frequentes · {nSemanasBaixa} com menos registros
        </div>
        <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', lineHeight: 1.5 }}>
          Associações observadas nos registros. Não indica relação causal. Presença de registros não equivale a adesão aos hábitos.
        </div>
      </div>
    </div>
  );
}

// ── Cabeçalho de estágio ───────────────────────────────────────────────────────
function EstagioHeader({ dadosBase }) {
  const isConsolidado = dadosBase.estagio === 'consolidado';
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
        color: isConsolidado ? 'var(--green)' : 'var(--amber)',
        marginBottom: 6,
      }}>
        {isConsolidado ? 'Perfil Consolidado' : 'Perfil Inicial'}
      </div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          <strong style={{ color: 'var(--dark)' }}>{dadosBase.ciclosCompletos}</strong>{' '}
          {dadosBase.ciclosCompletos === 1 ? 'ciclo registrado' : 'ciclos registrados'}
        </span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          <strong style={{ color: 'var(--dark)' }}>{dadosBase.diasRegistrados}</strong> dias com dados
        </span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>
          Cobertura:{' '}
          <strong style={{ color: dadosBase.cobertura >= 50 ? 'var(--green)' : 'var(--orange)' }}>
            {dadosBase.cobertura}%
          </strong>
        </span>
      </div>
      {dadosBase.cobertura < 30 && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8, fontSize: 11,
          background: 'var(--orange-bg)', color: 'var(--orange)', lineHeight: 1.5,
        }}>
          Cobertura baixa — mais registros aumentam a confiança dos padrões.
        </div>
      )}
    </div>
  );
}

// ── Componente principal ───────────────────────────────────────────────────────
export default function PerfilBiologico({ pacienteId }) {
  const [resultado,        setResultado]        = useState(null);
  const [registrosHabitos, setRegistrosHabitos] = useState(null);
  const [correlacaoSupl,   setCorrelacaoSupl]   = useState(null);
  const [mapaGatilhosFase, setMapaGatilhosFase] = useState(null);
  const [faseInfo,         setFaseInfo]         = useState(null);
  const [formacaoAberto,   setFormacaoAberto]   = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const corte = new Date();
      corte.setDate(corte.getDate() - 180);
      const c180 = corte.toISOString().slice(0, 10);

      const agora = new Date().toISOString();
      const [sintomasRes, periodosRes, intestinoRes, habitosRes, suplRes, consultaRes] = await Promise.all([
        supabase.from('ciclo_sintomas_diarios')
          .select('data, humor, energia, sono, foco, libido, irritabilidade, ansiedade, compulsao, acne, retencao, inchaco, dor_cabeca, dor_pelvica, insonia, acorda_madrugada, choro, intestino')
          .eq('paciente_id', pacienteId)
          .gte('data', c180)
          .order('data', { ascending: false }),
        supabase.from('ciclo_periodos')
          .select('id, inicio, fim')
          .eq('paciente_id', pacienteId)
          .order('inicio', { ascending: false }),
        supabase.from('intestino_logs')
          .select('data, tipo, bristol, evacuou, esvaziamento_incompleto, dor_abdominal, estufamento')
          .eq('paciente_id', pacienteId)
          .eq('tipo', 'diario')
          .gte('data', c180),
        supabase.from('habitos_logs')
          .select('data, habito_id, valor')
          .eq('paciente_id', pacienteId)
          .gte('data', c180),
        supabase.from('suplementos_logs')
          .select('data, tomado')
          .eq('paciente_id', pacienteId)
          .eq('tomado', true)
          .gte('data', c180),
        supabase.from('consultas')
          .select('data_hora')
          .eq('paciente_id', pacienteId)
          .eq('status', 'realizada')
          .lt('data_hora', agora)
          .order('data_hora', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!active) return;

      const perfilResult = calcularPerfilBiologico({
        sintomas:      sintomasRes.data  ?? [],
        periodos:      periodosRes.data  ?? [],
        intestinoLogs: intestinoRes.data ?? [],
      });
      setResultado(perfilResult);
      setRegistrosHabitos(calcularRegistrosCarga({
        sintomas:    sintomasRes.data ?? [],
        habitosLogs: habitosRes.data  ?? [],
      }));
      setCorrelacaoSupl(calcularCorrelacaoSupl({
        sintomas:       sintomasRes.data ?? [],
        suplementosLogs: suplRes.data   ?? [],
      }));

      // Consciência de fase — Fatores Associados
      const lastConsulta = consultaRes.data;
      if (lastConsulta) {
        const faseInicio       = lastConsulta.data_hora.slice(0, 10);
        const sintomasFase     = (sintomasRes.data ?? []).filter(s => s.data >= faseInicio);
        const intestinoFase    = (intestinoRes.data ?? []).filter(l => l.data >= faseInicio);
        const diasRegistrados  = new Set(sintomasFase.map(s => s.data)).size;
        const diasCalendario   = Math.floor(
          (Date.now() - new Date(lastConsulta.data_hora).getTime()) / 86_400_000
        );
        setFaseInfo({ diasCalendario, diasRegistrados });
        if (diasRegistrados >= 14) {
          setMapaGatilhosFase(calcularMapaGatilhos({
            sintomas:        sintomasFase,
            intestinoLogs:   intestinoFase,
            periodos:        periodosRes.data ?? [],
            ciclosCompletos: perfilResult.dadosBase?.ciclosCompletos ?? 0,
          }));
        }
      }
    }
    load();
    return () => { active = false; };
  }, [pacienteId]);

  if (!resultado) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  const { dadosBase, principalPadrao, padroes, padroesEmFormacao, intestinoCiclo, corpoComportamento, convergencias, priorizacao, mapaGatilhos, tempoRetomada } = resultado;

  // ── Insuficiente ─────────────────────────────────────────────────────────────
  if (dadosBase.estagio === 'insuficiente') {
    return (
      <div className="card empty-card">
        <i className="ti ti-dna" style={{ fontSize: 28, color: 'var(--text4)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
          Aguardando dados iniciais
        </div>
        <div className="empty-sub">
          O Perfil Biológico precisa de pelo menos um ciclo completo registrado no app.
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)' }}>
          Ciclos registrados: {dadosBase.ciclosCompletos} · Dias com dados: {dadosBase.diasRegistrados}
        </div>
      </div>
    );
  }

  // ── Perfil Inicial ────────────────────────────────────────────────────────────
  if (dadosBase.estagio === 'inicial') {
    return (
      <>
        <EstagioHeader dadosBase={dadosBase} />

        {padroesEmFormacao.length === 0 ? (
          <div className="card empty-card">
            <div className="empty-sub">
              Ainda sem sinais suficientes para detectar padrões. Continue registrando os sintomas diários.
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-header">
              <div>
                <div className="card-title">Padrões em Formação</div>
                <div className="card-sub">Sinais iniciais — ainda em formação com mais registros</div>
              </div>
            </div>
            <div className="card-body">
              {padroesEmFormacao.map((p, i) => (
                <PadraoFormacaoCard key={p.grupoId} padrao={p} isLast={i === padroesEmFormacao.length - 1} />
              ))}
              <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text4)', fontStyle: 'italic' }}>
                Baseado em registros iniciais. Padrões se consolidam com 2+ ciclos registrados.
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  // ── Perfil Consolidado ────────────────────────────────────────────────────────
  const demaisPadroes = principalPadrao
    ? padroes.filter(p => p.grupoId !== principalPadrao.grupoId)
    : padroes;

  return (
    <>
      <EstagioHeader dadosBase={dadosBase} />

      {/* ── Principal padrão ── */}
      {principalPadrao && (
        <div className="card" style={{ marginBottom: 14, borderLeft: '3px solid var(--amber)' }}>
          <div className="card-header">
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1.3, textTransform: 'uppercase',
                color: 'var(--amber)', marginBottom: 4,
              }}>
                Principal padrão observado
              </div>
              <div className="card-title">
                {principalPadrao.grupoLabel} · fase {principalPadrao.faseDomLabel}
              </div>
            </div>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: .4,
              background: 'var(--green-bg)', color: 'var(--green)',
              padding: '3px 9px', borderRadius: 20, flexShrink: 0,
            }}>
              Alta confiança
            </span>
          </div>
          <div className="card-body">
            <div style={{
              fontSize: 13, color: 'var(--text2)', lineHeight: 1.65,
              fontStyle: 'italic', marginBottom: 8,
            }}>
              "{principalPadrao.narrativa}"
            </div>
            <div style={{ fontSize: 11, color: 'var(--text4)' }}>
              Presente em {principalPadrao.prevDominante}% dos dias nessa fase
              {principalPadrao.prevOutras > 0 ? ` · ${principalPadrao.prevOutras}% nas outras fases` : ''}
              {' · '}{principalPadrao.nObs} observações
            </div>
          </div>
        </div>
      )}

      {/* ── Demais padrões ── */}
      {demaisPadroes.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <div>
              <div className="card-title">
                {principalPadrao ? 'Demais padrões' : 'Padrões identificados'}
              </div>
              <div className="card-sub">Baseado nos últimos {dadosBase.ciclosCompletos} ciclos</div>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            {demaisPadroes.map((p, i) => (
              <PadraoCard
                key={p.grupoId}
                padrao={p}
                isPrincipal={i === demaisPadroes.length - 1}
              />
            ))}
          </div>
        </div>
      )}

      {/* Estado sem padrões identificados */}
      {padroes.length === 0 && (
        <div className="card empty-card" style={{ marginBottom: 14 }}>
          <div className="empty-sub">
            Nenhum padrão identificado com confiança suficiente ainda. Continue registrando os sintomas.
          </div>
        </div>
      )}

      {/* ── Intestino × ciclo ── */}
      {intestinoCiclo.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Intestino × ciclo</div>
              <div className="card-sub">Correlações entre intestino e outros sintomas</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {intestinoCiclo.map((t, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, color: 'var(--text2)', lineHeight: 1.6 }}>
                <span style={{ color: 'var(--text3)', flexShrink: 0 }}>·</span>
                {t.descricao}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Corpo → Comportamento ── */}
      {corpoComportamento?.disponivel && corpoComportamento.associacoes.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Corpo → Comportamento</div>
              <div className="card-sub">Associações observadas nos registros · mesmo dia · 180 dias</div>
            </div>
          </div>
          {corpoComportamento.coberturaBaixa && (
            <div style={{
              margin: '0 16px 10px', padding: '7px 11px', borderRadius: 7, fontSize: 11,
              background: 'var(--orange-bg)', color: 'var(--orange)', lineHeight: 1.5,
            }}>
              Cobertura de registros abaixo de 50% — associações têm menor confiabilidade.
            </div>
          )}
          <div className="card-body" style={{ paddingTop: 0 }}>
            {corpoComportamento.associacoes.map((a, i) => (
              <AssociacaoCard
                key={a.id}
                assoc={a}
                isLast={i === corpoComportamento.associacoes.length - 1}
              />
            ))}
            <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', lineHeight: 1.5 }}>
              Associações calculadas nos dias com registro completo de ambos os campos. Não indicam relação causal. O motor não controla a fase do ciclo.
            </div>
          </div>
        </div>
      )}

      {/* ── Mapa de Gatilhos ── */}
      {mapaGatilhos?.disponivel && (
        <MapaGatilhosCard
          mapa={mapaGatilhos}
          mapaFase={mapaGatilhosFase}
          faseInfo={faseInfo}
        />
      )}

      {/* ── Convergências Clínicas ── */}
      {convergencias?.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Convergências Clínicas</div>
              <div className="card-sub">Quais padrões os registros vêm apontando ao longo do tempo</div>
            </div>
          </div>
          <div className="card-body" style={{ paddingTop: 0 }}>
            {convergencias.map((conv, i) => (
              <ConvergenciaCard
                key={conv.eixoId}
                conv={conv}
                isLast={i === convergencias.length - 1}
              />
            ))}
            <div style={{ marginTop: 12, fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', lineHeight: 1.6 }}>
              Convergências identificadas a partir de associações observadas nos registros.
              Não representam diagnóstico funcional. A interpretação clínica é da nutricionista.
            </div>
          </div>
        </div>
      )}

      {/* ── Priorização Clínica ── */}
      {priorizacao && <PriorizacaoCard priorizacao={priorizacao} />}

      {/* ── Tempo de Retomada ── */}
      {tempoRetomada?.disponivel && <TempoRetomadaCard tempoRetomada={tempoRetomada} />}

      {/* ── Padrões em Formação ── */}
      {padroesEmFormacao.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <button
            onClick={() => setFormacaoAberto(a => !a)}
            style={{
              width: '100%', background: 'none', border: 'none', cursor: 'pointer',
              fontFamily: 'var(--font-sans)', padding: 0,
            }}
          >
            <div className="card-header" style={{ paddingBottom: formacaoAberto ? 0 : 14 }}>
              <div>
                <div className="card-title">Padrões em Formação</div>
                <div className="card-sub">Sinais com dados ainda insuficientes para confirmar</div>
              </div>
              <i className={`ti ti-chevron-${formacaoAberto ? 'up' : 'down'}`}
                style={{ fontSize: 14, color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
            </div>
          </button>
          {formacaoAberto && (
            <div className="card-body" style={{ paddingTop: 4 }}>
              {padroesEmFormacao.map((p, i) => (
                <PadraoFormacaoCard key={p.grupoId} padrao={p} isLast={i === padroesEmFormacao.length - 1} />
              ))}
              <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text4)', fontStyle: 'italic' }}>
                Esses sinais ainda estão em formação. Mais registros aumentam a confiabilidade.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Registros e Carga Sintomática ── */}
      {registrosHabitos?.disponivel && <RegistrosECargaCard dados={registrosHabitos} />}

      {/* ── Registros de Suplementação e Carga Sintomática ── */}
      {correlacaoSupl?.disponivel && <RegistroSuplCard dados={correlacaoSupl} />}
    </>
  );
}
