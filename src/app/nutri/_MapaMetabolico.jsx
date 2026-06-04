import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { EIXOS, dataBR } from '../../lib/cicloUtils.js';
import {
  calcularMapaVivo, calcularAlertasMapa, calcularCorrelacoesMapa, calcularDelta,
  EIXOS_ORDEM, EIXOS_PACIENTE, intensidadeTexto, intensidadeCor, dataInicioMapaVivo,
} from '../../lib/mapaUtils.js';

// ─── Radar SVG 9 eixos ────────────────────────────────────────────────────────

const RAD  = Math.PI / 180;
const CX   = 160;
const CY   = 160;
const RAIO = 120;
const N    = 9;

function pontoRadar(i, valor) {
  const angulo = (90 - (360 / N) * i) * RAD;
  const r = RAIO * (valor / 100);
  return { x: CX + r * Math.cos(angulo), y: CY - r * Math.sin(angulo) };
}

function anelPontos(frac) {
  return EIXOS_ORDEM.map((_, i) => {
    const angulo = (90 - (360 / N) * i) * RAD;
    return `${CX + RAIO * frac * Math.cos(angulo)},${CY - RAIO * frac * Math.sin(angulo)}`;
  }).join(' ');
}

function Radar({ scores, scoresMarco }) {
  const polVivo = EIXOS_ORDEM.map((k, i) => {
    const p = pontoRadar(i, scores[k] ?? 0);
    return `${p.x},${p.y}`;
  }).join(' ');

  const polMarco = scoresMarco
    ? EIXOS_ORDEM.map((k, i) => {
      const p = pontoRadar(i, scoresMarco[k] ?? 0);
      return `${p.x},${p.y}`;
    }).join(' ')
    : null;

  return (
    <svg viewBox="0 0 320 320" width="100%" style={{ maxWidth: 320, display: 'block', margin: '0 auto' }}>
      {/* anéis de fundo */}
      {[0.25, 0.5, 0.75, 1].map(f => (
        <polygon key={f} points={anelPontos(f)}
          fill="none" stroke="var(--border)" strokeWidth={f === 1 ? 1 : 0.5} />
      ))}
      {/* linhas de eixo */}
      {EIXOS_ORDEM.map((_, i) => {
        const p = pontoRadar(i, 100);
        return <line key={i} x1={CX} y1={CY} x2={p.x} y2={p.y} stroke="var(--border)" strokeWidth={0.5} />;
      })}
      {/* polígono do marco (se existir) */}
      {polMarco && (
        <polygon points={polMarco}
          fill="rgba(90,143,168,.12)"
          stroke="#5b8fa8" strokeWidth={1.5} strokeDasharray="4 3" />
      )}
      {/* polígono do mapa vivo */}
      <polygon points={polVivo}
        fill="rgba(196,164,130,.2)"
        stroke="#c4a882" strokeWidth={2} />
      {/* labels dos eixos */}
      {EIXOS_ORDEM.map((k, i) => {
        const angulo = (90 - (360 / N) * i) * RAD;
        const r      = RAIO + 22;
        const lx     = CX + r * Math.cos(angulo);
        const ly     = CY - r * Math.sin(angulo);
        const info   = EIXOS_PACIENTE[k];
        const score  = scores[k] ?? 0;
        return (
          <text key={k} x={lx} y={ly}
            textAnchor="middle" dominantBaseline="middle"
            fontSize={8} fontWeight={score >= 55 ? 700 : 400}
            fill={score >= 55 ? intensidadeCor(score) : 'var(--text3)'}>
            {info?.labelAmigavel?.split(' ')[0] ?? k}
          </text>
        );
      })}
    </svg>
  );
}

// ─── Barra de score com delta ─────────────────────────────────────────────────

function BarraMapa({ eixoKey, score, scoreMarco }) {
  const delta = scoreMarco != null ? score - scoreMarco : null;
  const corFill = score >= 70 ? 'var(--red)' : score >= 55 ? 'var(--orange)' : score >= 35 ? 'var(--amber)' : 'var(--green)';
  const eixo   = EIXOS[eixoKey] ?? {};

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--dark)', fontWeight: 500 }}>{eixo.label ?? eixoKey}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {delta !== null && (
            <span style={{
              fontSize: 10, fontWeight: 600,
              color: delta > 0 ? 'var(--red)' : delta < 0 ? 'var(--green)' : 'var(--text4)',
            }}>
              {delta > 0 ? `+${delta}` : delta < 0 ? `${delta}` : '='}
            </span>
          )}
          <span style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{score}%</span>
        </div>
      </div>
      <div style={{ height: 7, borderRadius: 4, background: 'var(--bg3)', overflow: 'hidden', position: 'relative' }}>
        {scoreMarco != null && (
          <div style={{
            position: 'absolute', width: `${scoreMarco}%`, height: '100%',
            background: '#5b8fa840', borderRadius: 4,
          }} />
        )}
        <div style={{ width: `${score}%`, height: '100%', background: corFill, borderRadius: 4, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

// ─── Card de alerta clínico ───────────────────────────────────────────────────

function CardAlerta({ icon, titulo, textoNutricionista, descricao, sugestao, conscienciaCorporal, tipo = 'aviso', score }) {
  const [aberto, setAberto] = useState(false);
  const cor = tipo === 'alerta'
    ? { bg: 'var(--red-bg)', border: 'var(--red)', text: 'var(--red)' }
    : { bg: 'var(--orange-bg)', border: 'var(--orange)', text: 'var(--orange)' };
  const texto = textoNutricionista || descricao;
  const temExpandido = !!(sugestao || conscienciaCorporal);

  return (
    <div style={{ background: cor.bg, border: `0.5px solid ${cor.border}`, borderRadius: 10 }}>
      <button onClick={() => temExpandido && setAberto(a => !a)}
        style={{
          width: '100%', padding: '11px 13px', background: 'none', border: 'none',
          cursor: temExpandido ? 'pointer' : 'default',
          display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--font-sans)', textAlign: 'left',
        }}>
        <i className={`ti ti-${icon}`} style={{ fontSize: 16, color: cor.text, flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)' }}>{titulo}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1, lineHeight: 1.4 }}>{texto}</div>
        </div>
        {score !== undefined && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: cor.text, flexShrink: 0,
            background: 'rgba(255,255,255,.5)', padding: '2px 8px', borderRadius: 20,
          }}>{score}%</span>
        )}
        {temExpandido && (
          <i className={`ti ti-chevron-${aberto ? 'up' : 'down'}`} style={{ fontSize: 13, color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
        )}
      </button>
      {aberto && (
        <div style={{
          padding: '0 13px 12px 39px', fontSize: 11, color: 'var(--text2)', lineHeight: 1.6,
          borderTop: `0.5px solid ${cor.border}30`,
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {sugestao && (
            <div>
              <strong style={{ color: 'var(--dark)', display: 'block', marginBottom: 2 }}>Conduta sugerida:</strong>
              {sugestao}
            </div>
          )}
          {conscienciaCorporal && (
            <div style={{ fontStyle: 'italic', color: 'var(--text3)' }}>{conscienciaCorporal}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card de correlação funcional ─────────────────────────────────────────────

function CardCorrelacao({ nome, interpretacao, racionalFisiologico, correlacaoForte }) {
  const [aberto, setAberto] = useState(false);
  return (
    <div style={{ background: 'var(--blue-bg)', border: '0.5px solid var(--blue)', borderRadius: 10 }}>
      <button onClick={() => setAberto(a => !a)}
        style={{
          width: '100%', padding: '11px 13px', background: 'none', border: 'none',
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
          fontFamily: 'var(--font-sans)', textAlign: 'left',
        }}>
        <i className="ti ti-arrows-join" style={{ fontSize: 16, color: 'var(--blue)', flexShrink: 0 }} aria-hidden="true" />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)' }}>{nome}</div>
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1, lineHeight: 1.4 }}>{interpretacao}</div>
        </div>
        <i className={`ti ti-chevron-${aberto ? 'up' : 'down'}`} style={{ fontSize: 13, color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
      </button>
      {aberto && (
        <div style={{
          padding: '0 13px 12px 39px', fontSize: 11, color: 'var(--text2)', lineHeight: 1.6,
          borderTop: '0.5px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div>
            <strong style={{ color: 'var(--dark)', display: 'block', marginBottom: 3 }}>Racional fisiológico:</strong>
            {racionalFisiologico}
          </div>
          {correlacaoForte?.length > 0 && (
            <div>
              <strong style={{ color: 'var(--dark)', display: 'block', marginBottom: 5 }}>Sinais associados:</strong>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {correlacaoForte.map(s => (
                  <span key={s} style={{
                    fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                    background: 'rgba(255,255,255,.55)', color: 'var(--blue)',
                    border: '0.5px solid var(--blue)',
                  }}>{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Salvar marco clínico ─────────────────────────────────────────────────────

function SalvarMarco({ pacienteId, nutriId, scores, onSalvo }) {
  const [nome, setNome]   = useState('');
  const [obs, setObs]     = useState('');
  const [busy, setBusy]   = useState(false);
  const [erro, setErro]   = useState(null);
  const [aberto, setAberto] = useState(false);

  async function salvar() {
    if (!nome.trim()) return setErro('Informe um nome para o marco.');
    setBusy(true);
    setErro(null);
    const { error } = await supabase.from('mapa_marcos').insert({
      paciente_id: pacienteId,
      nutri_id:    nutriId,
      nome:        nome.trim(),
      scores,
      obs:         obs.trim() || null,
    });
    setBusy(false);
    if (error) return setErro(error.message);
    setNome(''); setObs(''); setAberto(false);
    onSalvo?.();
  }

  if (!aberto) {
    return (
      <button className="btn-outline" onClick={() => setAberto(true)}
        style={{ fontSize: 12, padding: '6px 12px' }}>
        <i className="ti ti-bookmark-plus" aria-hidden="true" /> Salvar marco clínico
      </button>
    );
  }

  return (
    <div style={{ padding: '14px 16px', background: 'var(--bg2)', borderRadius: 10, border: '0.5px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>Salvar marco clínico</div>
      <label className="field-label">Nome do marco</label>
      <input value={nome} onChange={e => setNome(e.target.value)}
        placeholder="Ex: Baseline, Consulta 2, Após fase intestinal…" />
      <label className="field-label" style={{ marginTop: 8 }}>Observação (opcional)</label>
      <textarea rows={2} value={obs} onChange={e => setObs(e.target.value)}
        placeholder="Contexto clínico do momento…" />
      {erro && (
        <div style={{ marginTop: 6, fontSize: 12, color: 'var(--red)' }}>{erro}</div>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button className="btn-outline" onClick={() => setAberto(false)} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
          Cancelar
        </button>
        <button className="btn" onClick={salvar} disabled={busy} style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}>
          {busy ? 'Salvando…' : 'Salvar marco'}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MapaMetabolicoNutri({ pacienteId, pacienteNome, nutriId }) {
  const [sintomas,     setSintomas]     = useState(null);
  const [periodos,     setPeriodos]     = useState([]);
  const [marcos,       setMarcos]       = useState([]);
  const [marcoSel,     setMarcoSel]     = useState('');

  async function carregar() {
    const [sRes, pRes, mRes] = await Promise.all([
      supabase.from('ciclo_sintomas_diarios')
        .select('*').eq('paciente_id', pacienteId)
        .gte('data', dataInicioMapaVivo())
        .order('data', { ascending: false }),
      supabase.from('ciclo_periodos')
        .select('id, inicio, fim').eq('paciente_id', pacienteId)
        .order('inicio', { ascending: false }),
      supabase.from('mapa_marcos')
        .select('*').eq('paciente_id', pacienteId)
        .order('criado_em', { ascending: false }),
    ]);
    setSintomas(sRes.data ?? []);
    setPeriodos(pRes.data ?? []);
    setMarcos(mRes.data ?? []);
  }

  useEffect(() => {
    let active = true;
    carregar().then(() => { if (!active) return; });
    return () => { active = false; };
  }, [pacienteId]);

  const mapa = useMemo(() => {
    if (sintomas === null) return null;
    return calcularMapaVivo(sintomas, periodos);
  }, [sintomas, periodos]);

  const alertas     = useMemo(() => mapa ? calcularAlertasMapa(mapa.scores) : [], [mapa]);
  const correlacoes = useMemo(() => mapa ? calcularCorrelacoesMapa(mapa.scores) : [], [mapa]);

  const marcoAtual = useMemo(
    () => marcos.find(m => m.id === marcoSel) ?? null,
    [marcos, marcoSel]
  );

  const delta = useMemo(
    () => mapa && marcoAtual ? calcularDelta(mapa.scores, marcoAtual.scores) : null,
    [mapa, marcoAtual]
  );

  if (sintomas === null) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  if (!sintomas.length) {
    return (
      <div className="card empty-card">
        <i className="ti ti-map" style={{ fontSize: 28, color: 'var(--text4)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
        <div className="empty-sub">
          {pacienteNome?.split(' ')[0] ?? 'A paciente'} ainda não registrou sintomas no app.
          O Mapa Metabólico é calculado a partir dos dados de ciclo.
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Cabeçalho com confiança dos dados */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Mapa Vivo · {mapa.diasComDados} {mapa.diasComDados === 1 ? 'dia' : 'dias'} de dados
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <div style={{ height: 5, width: 80, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
              <div style={{ width: `${mapa.confianca}%`, height: '100%', background: mapa.confianca >= 70 ? 'var(--green)' : 'var(--orange)', transition: 'width .4s' }} />
            </div>
            <span style={{ fontSize: 11, color: mapa.confianca >= 70 ? 'var(--green)' : 'var(--orange)', fontWeight: 600 }}>
              {mapa.confianca}% confiança
            </span>
          </div>
        </div>
        <SalvarMarco pacienteId={pacienteId} nutriId={nutriId} scores={mapa.scores} onSalvo={carregar} />
      </div>

      {/* Comparação com marco */}
      {marcos.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <label className="field-label">Comparar com marco clínico</label>
          <select value={marcoSel} onChange={e => setMarcoSel(e.target.value)} style={{ fontSize: 13 }}>
            <option value="">— Sem comparação —</option>
            {marcos.map(m => (
              <option key={m.id} value={m.id}>
                {m.nome} · {dataBR(m.criado_em)}
              </option>
            ))}
          </select>
          {marcoAtual?.obs && (
            <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>
              "{marcoAtual.obs}"
            </div>
          )}
        </div>
      )}

      {/* Radar SVG */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Radar metabólico</div>
            <div className="card-sub">9 eixos · média dos últimos {mapa.diasComDados} dias{marcoAtual ? ` · comparando com "${marcoAtual.nome}"` : ''}</div>
          </div>
        </div>
        <div className="card-body">
          <Radar scores={mapa.scores} scoresMarco={marcoAtual?.scores} />
          {marcoAtual && (
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                <div style={{ width: 24, height: 3, background: '#c4a882', borderRadius: 2 }} />
                Mapa Vivo
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
                <div style={{ width: 24, height: 3, background: '#5b8fa8', borderRadius: 2, borderTop: '2px dashed #5b8fa8', background: 'none', borderBottom: 'none' }} />
                {marcoAtual.nome}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Barras com porcentagem */}
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Scores por eixo</div>
            <div className="card-sub">Linguagem técnica · limiar de alerta: ≥ 55%{delta ? ' · delta vs marco' : ''}</div>
          </div>
        </div>
        <div className="card-body">
          {EIXOS_ORDEM.map(k => (
            <BarraMapa
              key={k}
              eixoKey={k}
              score={mapa.scores[k] ?? 0}
              scoreMarco={marcoAtual ? (marcoAtual.scores[k] ?? 0) : null}
            />
          ))}
        </div>
      </div>

      {/* Alertas clínicos */}
      {alertas.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Alertas clínicos</div>
              <div className="card-sub">Eixos acima do limiar funcional</div>
            </div>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: 'var(--red-bg)', color: 'var(--red)',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{alertas.length}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alertas.map((a, i) => <CardAlerta key={i} {...a} />)}
          </div>
        </div>
      )}

      {/* Correlações funcionais */}
      {correlacoes.length > 0 && (
        <div className="card" style={{ marginBottom: 14 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Correlações funcionais</div>
              <div className="card-sub">Padrões que se potencializam — Biblioteca Clínica Útera</div>
            </div>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: 'var(--blue-bg)', color: 'var(--blue)',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{correlacoes.length}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {correlacoes.map(c => <CardCorrelacao key={c.id} {...c} />)}
          </div>
        </div>
      )}

      {/* Marcos clínicos salvos */}
      {marcos.length > 0 && (
        <>
          <div className="section-label">Marcos clínicos ({marcos.length})</div>
          <div className="card" style={{ padding: 0 }}>
            {marcos.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
                borderBottom: i === marcos.length - 1 ? 'none' : '0.5px solid var(--border)',
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 8,
                  background: 'var(--bg2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <i className="ti ti-bookmark" style={{ fontSize: 15, color: 'var(--text3)' }} aria-hidden="true" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{m.nome}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>{dataBR(m.criado_em)}</div>
                  {m.obs && <div style={{ fontSize: 11, color: 'var(--text3)', fontStyle: 'italic' }}>"{m.obs}"</div>}
                </div>
                <button
                  onClick={() => setMarcoSel(prev => prev === m.id ? '' : m.id)}
                  className="btn-outline"
                  style={{ fontSize: 11, padding: '4px 9px', color: marcoSel === m.id ? 'var(--dark)' : 'var(--text3)' }}>
                  {marcoSel === m.id ? 'Comparando' : 'Comparar'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
