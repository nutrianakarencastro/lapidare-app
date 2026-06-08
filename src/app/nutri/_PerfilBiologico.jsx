import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { calcularPerfilBiologico } from '../../lib/perfilBiologicoUtils.js';

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
  const [resultado, setResultado] = useState(null);
  const [formacaoAberto, setFormacaoAberto] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const corte = new Date();
      corte.setDate(corte.getDate() - 180);
      const c180 = corte.toISOString().slice(0, 10);

      const [sintomasRes, periodosRes, intestinoRes] = await Promise.all([
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
      ]);

      if (!active) return;
      setResultado(calcularPerfilBiologico({
        sintomas:      sintomasRes.data  ?? [],
        periodos:      periodosRes.data  ?? [],
        intestinoLogs: intestinoRes.data ?? [],
      }));
    }
    load();
    return () => { active = false; };
  }, [pacienteId]);

  if (!resultado) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  const { dadosBase, principalPadrao, padroes, padroesEmFormacao, intestinoCiclo, corpoComportamento } = resultado;

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
    </>
  );
}
