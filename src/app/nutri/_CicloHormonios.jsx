import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import {
  FASES, EIXOS,
  calcularFaseDoCiclo, calcularScoresHormonais, gerarAlertas, detectarCorrelacoes,
  classificarEstagioPeri,
  duracaoMediaCiclo, diasDoMes, isoHoje, dataBR, dataBRCurta,
} from '../../lib/cicloUtils.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function diasEntre(a, b) {
  if (!a || !b) return null;
  return Math.round(Math.abs(new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
}

// ─── Cards de alerta ──────────────────────────────────────────────────────────

function CardAlerta({ icon, titulo, descricao, textoNutricionista, sugestao, conscienciaCorporal, tipo = 'aviso', score, intensidade }) {
  const [aberto, setAberto] = useState(false);
  const cor = tipo === 'alerta' ? { bg: 'var(--red-bg)', border: 'var(--red)', text: 'var(--red)' }
    : tipo === 'info' ? { bg: 'var(--blue-bg)', border: 'var(--blue)', text: 'var(--blue)' }
    : { bg: 'var(--orange-bg)', border: 'var(--orange)', text: 'var(--orange)' };

  // Nutri vê texto clínico; paciente veria textoPaciente (em descricao)
  const textoHeader = textoNutricionista || descricao;
  const temExpandido = sugestao || conscienciaCorporal;

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
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 1, lineHeight: 1.4 }}>{textoHeader}</div>
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
            <div style={{ fontStyle: 'italic', color: 'var(--text3)' }}>
              {conscienciaCorporal}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Card de correlação funcional ─────────────────────────────────────────────

function CardCorrelacao({ nome, eixos, interpretacao, racionalFisiologico, correlacaoForte }) {
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

// ─── Barra de score ───────────────────────────────────────────────────────────

function BarraScore({ label, valor, suave }) {
  const corFill = suave
    ? (valor >= 70 ? 'var(--orange)' : valor >= 55 ? 'var(--amber)' : 'var(--green)')
    : (valor >= 70 ? 'var(--red)' : valor >= 55 ? 'var(--orange)' : valor >= 35 ? 'var(--amber)' : 'var(--green)');
  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
        <span style={{ fontSize: 12, color: 'var(--dark)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{valor}%</span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
        <div style={{ width: `${valor}%`, height: '100%', background: corFill, borderRadius: 3, transition: 'width .5s ease' }} />
      </div>
    </div>
  );
}

// ─── Timeline de sintomas (últimos 30 dias) ───────────────────────────────────

const TIMELINE_KEYS = [
  { key: 'humor',        label: 'Humor',       inv: true  },
  { key: 'energia',      label: 'Energia',     inv: true  },
  { key: 'sono',         label: 'Sono',        inv: true  },
  { key: 'dor_pelvica',  label: 'Dor pélvica', inv: false },
  { key: 'compulsao',    label: 'Compulsão',   inv: false },
  { key: 'inchaco',      label: 'Inchaço',     inv: false },
  { key: 'irritabilidade', label: 'Irritab.',  inv: false },
  { key: 'ansiedade',    label: 'Ansiedade',   inv: false },
];

function Timeline({ sintomas, periodos }) {
  const hoje = isoHoje();
  const dias30 = useMemo(() => {
    const arr = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      arr.push(d.toISOString().slice(0, 10));
    }
    return arr;
  }, []);

  const sintomaMap = useMemo(() => {
    const m = {};
    for (const s of sintomas) m[s.data] = s;
    return m;
  }, [sintomas]);

  function corCelula(key, valor, inv) {
    if (valor === null || valor === undefined) return 'transparent';
    if (typeof valor === 'boolean') return valor ? '#c4616e40' : 'transparent';
    const v = inv ? (6 - valor) : valor; // invert: 1→5, 5→1 for inv=true
    if (v >= 3) return '#c4616e60';
    if (v >= 2) return '#c4a88250';
    if (v >= 1) return '#ebd9b840';
    return 'transparent';
  }

  const fasesPorDia = useMemo(() => {
    const m = {};
    for (const d of dias30) m[d] = calcularFaseDoCiclo(periodos, d).fase;
    return m;
  }, [dias30, periodos]);

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ minWidth: 560 }}>
        {/* header de datas */}
        <div style={{ display: 'flex', marginBottom: 4, paddingLeft: 72 }}>
          {dias30.filter((_, i) => i % 5 === 0).map(d => (
            <div key={d} style={{ width: `${100 / 6}%`, fontSize: 9, color: 'var(--text3)', textAlign: 'center' }}>
              {dataBRCurta(d)}
            </div>
          ))}
        </div>
        {/* fases */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6, gap: 1 }}>
          <div style={{ width: 72, fontSize: 9, color: 'var(--text3)', flexShrink: 0 }}>Fase</div>
          {dias30.map(d => {
            const f = fasesPorDia[d] ?? 'desconhecida';
            const info = FASES[f] ?? FASES.desconhecida;
            return (
              <div key={d} title={info.label} style={{
                flex: 1, height: 8, background: info.cor + '60',
                borderRadius: 2,
              }} />
            );
          })}
        </div>
        {/* linhas de sintomas */}
        {TIMELINE_KEYS.map(({ key, label, inv }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', marginBottom: 2, gap: 1 }}>
            <div style={{ width: 72, fontSize: 10, color: 'var(--text2)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {label}
            </div>
            {dias30.map(d => {
              const s = sintomaMap[d];
              const val = s ? s[key] : null;
              const bg = corCelula(key, val, inv);
              return (
                <div key={d} title={val != null ? `${label}: ${val}` : `${d}: sem dado`}
                  style={{
                    flex: 1, height: 16, borderRadius: 2,
                    background: bg || 'var(--bg3)',
                    opacity: bg === 'transparent' ? 0.3 : 1,
                  }} />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Histórico de períodos ────────────────────────────────────────────────────

function HistoricoPeriodos({ periodos }) {
  const sorted = useMemo(
    () => [...periodos].sort((a, b) => new Date(b.inicio) - new Date(a.inicio)),
    [periodos]
  );

  return (
    <div className="card" style={{ padding: 0 }}>
      {sorted.length === 0 ? (
        <div style={{ padding: '20px 16px', fontSize: 13, color: 'var(--text3)', textAlign: 'center' }}>
          Nenhum período registrado ainda.
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Início</th>
              <th>Fim</th>
              <th>Sangramento</th>
              <th>Ciclo</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((p, i) => {
              const prox = sorted[i - 1];
              const dur  = prox ? diasEntre(p.inicio, prox.inicio) : null;
              const sang = p.fim ? diasEntre(p.inicio, p.fim) + 1 : null;
              const ok   = dur && dur >= 21 && dur <= 35;
              return (
                <tr key={p.id}>
                  <td><strong>{dataBR(p.inicio)}</strong></td>
                  <td>{p.fim ? dataBR(p.fim) : <span style={{ color: 'var(--text4)' }}>—</span>}</td>
                  <td>{sang ? `${sang}d` : '—'}</td>
                  <td>{dur ? `${dur}d` : '—'}</td>
                  <td>
                    {dur ? (
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                        background: ok ? 'var(--green-bg)' : 'var(--orange-bg)',
                        color: ok ? 'var(--green)' : 'var(--orange)',
                      }}>
                        {ok ? 'Regular' : (dur < 21 ? 'Curto' : 'Longo')}
                      </span>
                    ) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Padrões e recorrências ───────────────────────────────────────────────────

const ESTAGIO_PERI_INFO = {
  inicial:       { label: 'Perimenopausa inicial',        desc: 'Variação no padrão menstrual. Sinais sugestivos de transição hormonal.' },
  intermediaria: { label: 'Perimenopausa intermediária',  desc: 'Ciclos espaçando progressivamente. Padrão compatível com transição menopausal.' },
  tardia:        { label: 'Perimenopausa tardia',         desc: 'Grande instabilidade hormonal. Suporte metabólico, ósseo e cardiovascular indicado.' },
  menopausa:     { label: 'Menopausa provável',           desc: 'Padrão compatível com menopausa. Considerar avaliação de saúde óssea e cardiovascular.' },
};

function PadroesRecorrencias({ periodos, sintomas, estagioPeri }) {
  const padroes = useMemo(() => {
    if (sintomas.length < 10) return [];
    const total = sintomas.length;
    const result = [];

    // Correlação sintoma × fase
    const faseMap = {};
    for (const s of sintomas) {
      const { fase } = calcularFaseDoCiclo(periodos, s.data);
      if (!faseMap[fase]) faseMap[fase] = [];
      faseMap[fase].push(s);
    }

    const checks = [
      { label: 'irritabilidade alta', fn: s => (s.irritabilidade ?? 0) >= 2 },
      { label: 'compulsão',           fn: s => (s.compulsao ?? 0) >= 2 },
      { label: 'energia baixa',       fn: s => s.energia && s.energia <= 2 },
      { label: 'dor pélvica',         fn: s => (s.dor_pelvica ?? 0) >= 2 },
      { label: 'ansiedade',           fn: s => (s.ansiedade ?? 0) >= 2 },
    ];

    for (const fase of ['menstrual', 'lutea', 'folicular', 'ovulacao']) {
      const diasFase = faseMap[fase] ?? [];
      if (diasFase.length < 3) continue;
      const faseInfo = FASES[fase];
      for (const c of checks) {
        const pct = Math.round((diasFase.filter(c.fn).length / diasFase.length) * 100);
        if (pct >= 50) {
          result.push({
            fase: faseInfo.label,
            corFase: faseInfo.cor,
            sintoma: c.label,
            pct,
          });
        }
      }
    }

    return result.sort((a, b) => b.pct - a.pct).slice(0, 6);
  }, [periodos, sintomas]);

  return (
    <>
      {estagioPeri && (() => {
        const info = ESTAGIO_PERI_INFO[estagioPeri];
        return (
          <div style={{
            padding: '11px 13px', borderRadius: 10, marginBottom: 10,
            background: '#f0ecf5', border: '0.5px solid #7a6b84',
            display: 'flex', gap: 10, alignItems: 'flex-start',
          }}>
            <i className="ti ti-moon-stars" style={{ fontSize: 16, color: '#7a6b84', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)', marginBottom: 2 }}>
                {info.label}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', lineHeight: 1.5 }}>
                {info.desc}
              </div>
            </div>
          </div>
        );
      })()}

      {padroes.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {padroes.map((p, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 13px', borderRadius: 10,
              background: 'var(--white)', border: '0.5px solid var(--border)',
            }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%', flexShrink: 0,
                background: p.corFase,
              }} />
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--dark)' }}>
                  {p.fase}
                </span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}> → {p.sintoma}</span>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20,
                background: p.pct >= 75 ? 'var(--red-bg)' : 'var(--orange-bg)',
                color: p.pct >= 75 ? 'var(--red)' : 'var(--orange)',
              }}>{p.pct}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--text3)', padding: '8px 0' }}>
          Dados insuficientes para identificar padrões. São necessários ao menos 10 registros diários.
        </div>
      )}
    </>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

const SITUACAO_LABEL = {
  menstrua_regularmente: 'Ciclo regular',
  ciclo_irregular:       'Ciclo irregular',
  ciclo_suprimido:       'Ciclo suprimido (anticoncepcional)',
  nao_menstrua:          'Não menstrua',
  outro:                 'Outra situação',
};
const ESTADO_LABEL = {
  nenhum:       null,
  perimenopausa:'Perimenopausa',
  menopausa:    'Menopausa',
  gestante:     'Gestante',
  pos_parto:    'Pós-parto',
  outro:        'Outra condição',
};
const CONTRAC_LABEL = {
  pilula:'Pílula', diu_hormonal:'DIU hormonal', implante:'Implante',
  injetavel:'Injetável', adesivo:'Adesivo', anel_vaginal:'Anel vaginal', outro:'Outro',
};
const TRH_LABEL = {
  'estrogênio':'Estrogênio', progesterona:'Progesterona', combinada:'Combinada',
  testosterona:'Testosterona', outro:'Outro',
};
const TRH_VIA_LABEL = {
  oral:'Oral', transdermica:'Transdérmica', gel:'Gel',
  adesivo:'Adesivo', implante:'Implante', outro:'Outro',
};

function CardPerfilHormonal({ perfil }) {
  if (!perfil) return (
    <div style={{
      padding: '10px 14px', borderRadius: 10, marginBottom: 14,
      background: 'var(--bg2)', border: '0.5px solid var(--border)',
      fontSize: 12, color: 'var(--text3)', fontStyle: 'italic',
    }}>
      Perfil hormonal não configurado — peça à paciente para preencher no app.
    </div>
  );

  const estadoLabel = ESTADO_LABEL[perfil.estado_reprodutivo];
  const tags = [
    SITUACAO_LABEL[perfil.situacao_ciclo],
    estadoLabel,
    perfil.amamentando && 'Amamentando',
    perfil.usa_contraceptivo && (CONTRAC_LABEL[perfil.contraceptivo_tipo] || 'Anticoncepcional'),
    perfil.usa_trh && `TRH: ${TRH_LABEL[perfil.trh_tipo] ?? ''}${perfil.trh_via ? ` (${TRH_VIA_LABEL[perfil.trh_via]})` : ''}`,
  ].filter(Boolean);

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10, marginBottom: 14,
      background: 'var(--bg2)', border: '0.5px solid var(--border)',
    }}>
      <div style={{ fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 500, marginBottom: 8 }}>
        Perfil hormonal
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {tags.map((t, i) => (
          <span key={i} style={{
            fontSize: 11, padding: '3px 10px', borderRadius: 99,
            background: 'var(--white)', border: '0.5px solid var(--border)',
            color: 'var(--text2)', fontWeight: 500,
          }}>{t}</span>
        ))}
      </div>
      {perfil.contraceptivo_nome && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          Anticoncepcional: {perfil.contraceptivo_nome}
          {perfil.contraceptivo_menstrua === true  && ' · menstrua com ele'}
          {perfil.contraceptivo_menstrua === false && ' · não menstrua com ele'}
        </div>
      )}
      {perfil.obs_geral && (
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, fontStyle: 'italic' }}>
          {perfil.obs_geral}
        </div>
      )}
    </div>
  );
}

export default function CicloHormonios({ pacienteId, pacienteNome }) {
  const [periodos, setPeriodos] = useState(null);
  const [sintomas, setSintomas] = useState([]);
  const [perfil, setPerfil]     = useState(undefined);

  useEffect(() => {
    let active = true;
    async function carregar() {
      const [pRes, sRes, prRes] = await Promise.all([
        supabase.from('ciclo_periodos').select('*').eq('paciente_id', pacienteId).order('inicio', { ascending: false }),
        supabase.from('ciclo_sintomas_diarios').select('*').eq('paciente_id', pacienteId).order('data', { ascending: false }).limit(120),
        supabase.from('ciclo_perfil').select('*').eq('paciente_id', pacienteId).maybeSingle(),
      ]);
      if (!active) return;
      setPeriodos(pRes.data ?? []);
      setSintomas(sRes.data ?? []);
      setPerfil(prRes.data ?? null);
    }
    carregar();
    return () => { active = false; };
  }, [pacienteId]);

  const metricas = useMemo(() => {
    if (!periodos) return null;
    const hoje = isoHoje();
    const infoHoje = calcularFaseDoCiclo(periodos, hoje);
    const media    = duracaoMediaCiclo(periodos);

    const comSang  = periodos.filter(p => p.inicio && p.fim);
    const mediaSang = comSang.length
      ? Math.round(comSang.map(p => diasEntre(p.inicio, p.fim) + 1).reduce((a, b) => a + b, 0) / comSang.length)
      : null;

    // Regularidade: % de ciclos entre 21-35 dias
    const sorted = [...periodos].sort((a, b) => new Date(b.inicio) - new Date(a.inicio));
    const durs = [];
    for (let i = 1; i < sorted.length; i++) {
      const d = diasEntre(sorted[i].inicio, sorted[i - 1].inicio);
      if (d > 0) durs.push(d);
    }
    const regularidade = durs.length
      ? Math.round((durs.filter(d => d >= 21 && d <= 35).length / durs.length) * 100)
      : null;

    // Scores médios dos últimos 30 dias
    const ultimos30   = sintomas.slice(0, 30);
    const estagioPeri = classificarEstagioPeri(periodos);
    const scoresMedias = { glicemico: 0, adrenal: 0, estrogenico: 0, progesterona: 0, androgenico: 0, intestinal: 0, inflamatorio: 0, perimenopausa: 0 };
    if (ultimos30.length > 0) {
      for (const s of ultimos30) {
        const { fase } = calcularFaseDoCiclo(periodos, s.data);
        const sc = calcularScoresHormonais(s, fase, estagioPeri);
        if (sc) {
          for (const k of Object.keys(scoresMedias)) {
            scoresMedias[k] += (sc[k] ?? 0) / ultimos30.length;
          }
        }
      }
      for (const k of Object.keys(scoresMedias)) {
        scoresMedias[k] = Math.round(scoresMedias[k]);
      }
    }

    const alertas      = gerarAlertas(scoresMedias);
    const correlacoes  = detectarCorrelacoes(scoresMedias);

    // Alertas de ciclo
    const alertasCiclo = [];
    if (durs.length >= 2 && media < 21) {
      alertasCiclo.push({ icon: 'calendar-x', tipo: 'alerta', titulo: 'Ciclo curto', descricao: `Média de ${media} dias (normal: 21–35).`, sugestao: 'Avaliar fase lútea curta, hipotireoidismo ou deficiência de progesterona.' });
    }
    if (durs.length >= 2 && media > 35) {
      alertasCiclo.push({ icon: 'calendar-time', tipo: 'aviso', titulo: 'Ciclo longo', descricao: `Média de ${media} dias (normal: 21–35).`, sugestao: 'Investigar SOP, hipotireoidismo, hiperprolactinemia ou estresse crônico.' });
    }
    if (periodos.filter(p => !p.fim).length >= 2) {
      alertasCiclo.push({ icon: 'droplet', tipo: 'aviso', titulo: 'Fluxo prolongado (sem fim registrado)', descricao: 'Múltiplos períodos sem data de fim marcada.', sugestao: 'Solicitar hemograma + ferritina. Avaliar causas de sangramento prolongado.' });
    }

    return { infoHoje, media, mediaSang, regularidade, scoresMedias, alertas, alertasCiclo, correlacoes, estagioPeri };
  }, [periodos, sintomas]);

  if (periodos === null) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  if (periodos.length === 0 && sintomas.length === 0) {
    return (
      <div className="card empty-card">
        <i className="ti ti-moon" style={{ fontSize: 28, color: 'var(--text4)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
        <div className="empty-sub">
          {pacienteNome?.split(' ')[0] ?? 'A paciente'} ainda não registrou nenhum dado de ciclo pelo app.
        </div>
      </div>
    );
  }

  const { infoHoje, media, mediaSang, regularidade, scoresMedias, alertas, alertasCiclo, correlacoes, estagioPeri } = metricas;
  const faseHoje = FASES[infoHoje?.fase ?? 'desconhecida'] ?? FASES.desconhecida;
  const todosAlertas = [...alertasCiclo, ...alertas];

  return (
    <>
      <CardPerfilHormonal perfil={perfil} />

      {/* Visão geral */}
      <div className="g3">
        <div className="stat">
          <div className="stat-lbl">Fase atual</div>
          <div className="stat-val" style={{ fontSize: 16 }}>{faseHoje.icone} {faseHoje.label}</div>
          {infoHoje?.diaDociclo && (
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>Dia {infoHoje.diaDociclo}</div>
          )}
        </div>
        <div className="stat">
          <div className="stat-lbl">Ciclo médio</div>
          <div className="stat-val">{periodos.length >= 2 ? `${media}d` : '—'}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Sangramento</div>
          <div className="stat-val">{mediaSang ? `${mediaSang}d` : '—'}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Regularidade</div>
          <div className="stat-val">
            {regularidade !== null ? (
              <span style={{ color: regularidade >= 70 ? 'var(--green)' : 'var(--orange)' }}>
                {regularidade}%
              </span>
            ) : '—'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Períodos reg.</div>
          <div className="stat-val">{periodos.length}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Logs de sintomas</div>
          <div className="stat-val">{sintomas.length}</div>
        </div>
      </div>

      {/* Scores hormonais (média 30 dias) */}
      {sintomas.length >= 3 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Scores hormonais</div>
              <div className="card-sub">Média dos últimos {Math.min(30, sintomas.length)} dias de registro</div>
            </div>
          </div>
          <div className="card-body">
            {Object.entries(EIXOS).map(([k, e]) => (
              <BarraScore key={k} label={e.label} valor={scoresMedias[k] ?? 0} suave={k === 'perimenopausa'} />
            ))}
          </div>
        </div>
      )}

      {/* Alertas */}
      {todosAlertas.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Alertas clínicos</div>
              <div className="card-sub">Baseados no histórico de ciclos e sintomas</div>
            </div>
            <span style={{
              width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
              background: 'var(--red-bg)', color: 'var(--red)',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{todosAlertas.length}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {todosAlertas.map((a, i) => (
              <CardAlerta key={i} {...a} score={a.score} />
            ))}
          </div>
        </div>
      )}

      {/* Correlações funcionais */}
      {correlacoes.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Correlações funcionais</div>
              <div className="card-sub">Padrões que se potencializam mutuamente — Biblioteca Clínica Útera</div>
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

      {/* Timeline de sintomas */}
      {sintomas.length >= 5 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Timeline hormonal</div>
              <div className="card-sub">Últimos 30 dias — intensidade por categoria</div>
            </div>
          </div>
          <div className="card-body" style={{ overflowX: 'auto' }}>
            <Timeline sintomas={sintomas} periodos={periodos} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
              {Object.entries(FASES).filter(([k]) => !['desconhecida', 'atrasada'].includes(k)).map(([k, f]) => (
                <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: f.cor + '60' }} />
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{f.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Padrões e recorrências */}
      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-header">
          <div>
            <div className="card-title">Padrões e recorrências</div>
            <div className="card-sub">Sintomas que se repetem em determinada fase</div>
          </div>
        </div>
        <div className="card-body">
          <PadroesRecorrencias periodos={periodos} sintomas={sintomas} estagioPeri={estagioPeri} />
        </div>
      </div>

      {/* Histórico de períodos */}
      <div className="section-label" style={{ marginTop: 14 }}>
        Histórico de períodos ({periodos.length})
      </div>
      <HistoricoPeriodos periodos={periodos} />
    </>
  );
}
