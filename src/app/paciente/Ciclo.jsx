import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { podeAcessar } from '../../lib/modelos.js';
import BloqueioModelo from '../../components/BloqueioModelo.jsx';
import {
  FASES, EIXOS,
  calcularFaseDoCiclo, calcularScoresHormonais, gerarAlertas, detectarCorrelacoes,
  classificarEstagioPeri,
  isDiaPeriodo, diasDoMes, formatMesAno, isoHoje, dataBR, dataBRCurta,
  duracaoMediaCiclo,
} from '../../lib/cicloUtils.js';

// ─── helpers de UI ───────────────────────────────────────────────────────────

const SL = ({ children, style = {} }) => (
  <div style={{
    fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
    color: 'var(--gold-deep)', fontWeight: 600,
    margin: '16px 0 8px',
    display: 'flex', alignItems: 'center', gap: 7,
    ...style,
  }}>
    <div style={{ flex: 1, height: '0.5px', background: 'var(--hair)' }} />
    {children}
    <div style={{ flex: 1, height: '0.5px', background: 'var(--hair)' }} />
  </div>
);

const FL = ({ children }) => (
  <div style={{ fontSize: 11, color: 'var(--ink-soft)', fontWeight: 500, marginBottom: 5, marginTop: 12 }}>
    {children}
  </div>
);

function Escala3({ valor, onChange, labels = ['Sem', 'Leve', 'Moderada', 'Forte'] }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
      {labels.map((l, i) => {
        const ativo = valor === i;
        return (
          <button key={i} onClick={() => onChange(ativo ? 0 : i)}
            style={{
              padding: '7px 4px', borderRadius: 8, cursor: 'pointer',
              background: ativo ? 'var(--ink)' : 'var(--bg-soft)',
              color: ativo ? 'var(--bg-soft)' : 'var(--muted)',
              border: `0.5px solid ${ativo ? 'var(--ink)' : 'var(--hair)'}`,
              fontSize: 11, fontWeight: ativo ? 600 : 400,
              fontFamily: 'var(--font-sans)', transition: 'all .15s',
            }}>
            {l}
          </button>
        );
      })}
    </div>
  );
}

function Escala5({ valor, onChange, emojis }) {
  return (
    <div style={{ display: 'flex', gap: 6 }}>
      {emojis.map((e, i) => {
        const v = i + 1;
        const ativo = valor === v;
        const isEmoji = e.length <= 2;
        return (
          <button key={v} onClick={() => onChange(ativo ? 0 : v)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 9, cursor: 'pointer',
              background: ativo ? 'var(--gold-soft)' : 'var(--bg-soft)',
              border: `0.5px solid ${ativo ? 'var(--gold-deep)' : 'var(--hair)'}`,
              fontSize: isEmoji ? 18 : 10,
              fontFamily: 'var(--font-sans)',
              color: ativo ? 'var(--ink)' : 'var(--muted)',
              fontWeight: ativo ? 600 : 400, transition: 'all .15s',
            }}>
            {e}
          </button>
        );
      })}
    </div>
  );
}

function BtnToggle({ ativo, onClick, label, icon }) {
  return (
    <button onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '7px 12px', borderRadius: 9, cursor: 'pointer',
      background: ativo ? 'var(--ink)' : 'var(--bg-soft)',
      color: ativo ? 'var(--bg-soft)' : 'var(--muted)',
      border: `0.5px solid ${ativo ? 'var(--ink)' : 'var(--hair)'}`,
      fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
      transition: 'all .15s',
    }}>
      {icon && <i className={`ti ti-${icon}`} style={{ fontSize: 13 }} aria-hidden="true" />}
      {label}
      {ativo && <i className="ti ti-check" style={{ fontSize: 11, opacity: .8 }} aria-hidden="true" />}
    </button>
  );
}

function GrupoOpcoes({ valor, opcoes, onChange, cols = 2 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 6 }}>
      {opcoes.map(op => {
        const ativo = valor === op.v;
        return (
          <button key={op.v} onClick={() => onChange(ativo ? '' : op.v)}
            style={{
              padding: '7px 6px', borderRadius: 9, cursor: 'pointer',
              background: ativo ? 'var(--gold-soft)' : 'var(--bg-soft)',
              color: ativo ? 'var(--ink)' : 'var(--muted)',
              border: `0.5px solid ${ativo ? 'var(--gold-deep)' : 'var(--hair)'}`,
              fontSize: 12, fontWeight: ativo ? 600 : 400,
              fontFamily: 'var(--font-sans)', transition: 'all .15s',
            }}>
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

const inputSt = {
  width: '100%', padding: '9px 11px', borderRadius: 9,
  border: '0.5px solid var(--hair)', background: 'var(--bg-soft)',
  fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box', outline: 'none',
};

// ─── Calendário ──────────────────────────────────────────────────────────────

const SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function Calendario({ periodos, sintomas, onDiaTocado, situacaoCiclo = 'menstrua_regularmente' }) {
  const hoje = isoHoje();
  const [ref, setRef] = useState(() => {
    const d = new Date();
    return { ano: d.getFullYear(), mes: d.getMonth() };
  });

  const dias = useMemo(() => diasDoMes(ref.ano, ref.mes), [ref]);

  const fasesPorDia = useMemo(() => {
    const map = {};
    for (const d of dias) {
      if (!d) continue;
      map[d] = calcularFaseDoCiclo(periodos, d, situacaoCiclo);
    }
    return map;
  }, [dias, periodos, situacaoCiclo]);

  const diasPeriodo = useMemo(() => {
    const set = new Set();
    for (const p of periodos) {
      const ini = new Date(p.inicio + 'T12:00:00');
      const fim = p.fim ? new Date(p.fim + 'T12:00:00') : new Date(ini.getTime() + 4 * 86400000);
      let cur = new Date(ini);
      while (cur <= fim) {
        set.add(cur.toISOString().slice(0, 10));
        cur = new Date(cur.getTime() + 86400000);
      }
    }
    return set;
  }, [periodos]);

  const logsDias = useMemo(() => new Set(sintomas.map(s => s.data)), [sintomas]);

  function navMes(delta) {
    setRef(r => {
      let m = r.mes + delta;
      let a = r.ano;
      if (m < 0)  { m = 11; a--; }
      if (m > 11) { m = 0;  a++; }
      return { ano: a, mes: m };
    });
  }

  const infoHoje = calcularFaseDoCiclo(periodos, hoje, situacaoCiclo);
  const faseHoje = FASES[infoHoje.fase] ?? FASES.desconhecida;

  return (
    <div style={{ padding: '0 16px' }}>
      {/* fase atual */}
      <div style={{
        background: faseHoje.corSoft,
        border: `0.5px solid ${faseHoje.cor}30`,
        borderRadius: 14, padding: '12px 16px', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>
            Fase atual
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', marginTop: 1 }}>
            {faseHoje.icone} {faseHoje.label}
          </div>
          {infoHoje.diaDociclo && (
            <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
              Dia {infoHoje.diaDociclo} do ciclo · ciclo médio {infoHoje.duracaoMedia}d
            </div>
          )}
        </div>
        {infoHoje.proximoPeriodo && (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>
              Próximo
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginTop: 1 }}>
              {dataBRCurta(infoHoje.proximoPeriodo.toISOString().slice(0, 10))}
            </div>
          </div>
        )}
      </div>

      {/* nav mês */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 10,
      }}>
        <button onClick={() => navMes(-1)} style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="ti ti-chevron-left" style={{ fontSize: 16, color: 'var(--ink)' }} aria-hidden="true" />
        </button>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 17, color: 'var(--ink)', textTransform: 'capitalize' }}>
          {formatMesAno(ref.ano, ref.mes)}
        </div>
        <button onClick={() => navMes(1)} style={{
          width: 32, height: 32, borderRadius: '50%',
          background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--ink)' }} aria-hidden="true" />
        </button>
      </div>

      {/* grid */}
      <div style={{
        background: 'var(--paper)', border: '0.5px solid var(--hair)',
        borderRadius: 16, padding: '12px 10px',
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 6 }}>
          {SEMANA.map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 10, color: 'var(--muted)', fontWeight: 600, padding: '2px 0' }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {dias.map((dia, i) => {
            if (!dia) return <div key={`p${i}`} />;
            const { fase } = fasesPorDia[dia] ?? { fase: 'desconhecida' };
            const faseInfo  = FASES[fase] ?? FASES.desconhecida;
            const ePeriodo  = diasPeriodo.has(dia);
            const eHoje     = dia === hoje;
            const temLog    = logsDias.has(dia);
            const dNum      = parseInt(dia.slice(8), 10);
            const futuro    = dia > hoje;

            return (
              <button key={dia} onClick={() => onDiaTocado(dia)}
                style={{
                  aspectRatio: '1', borderRadius: '50%',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: eHoje ? 700 : 400,
                  background: ePeriodo ? faseInfo.cor : (futuro ? 'transparent' : faseInfo.corSoft),
                  color: ePeriodo ? '#fff' : (futuro ? 'var(--muted-2)' : 'var(--ink)'),
                  border: eHoje ? '2px solid var(--ink)' : '1px solid transparent',
                  cursor: 'pointer', position: 'relative',
                  fontFamily: 'var(--font-sans)', transition: 'transform .1s',
                  opacity: futuro ? 0.45 : 1,
                }}>
                {dNum}
                {temLog && (
                  <div style={{
                    position: 'absolute', bottom: '10%',
                    width: 4, height: 4, borderRadius: '50%',
                    background: ePeriodo ? 'rgba(255,255,255,.7)' : 'var(--gold-deep)',
                  }} />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* legenda */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
        {Object.entries(FASES).filter(([k]) => k !== 'desconhecida' && k !== 'atrasada').map(([k, f]) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: f.cor }} />
            <span style={{ fontSize: 11, color: 'var(--muted)' }}>{f.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--gold-deep)' }} />
          <span style={{ fontSize: 11, color: 'var(--muted)' }}>Sintoma registrado</span>
        </div>
      </div>

      <p style={{ fontSize: 11, color: 'var(--muted)', marginTop: 14, lineHeight: 1.55, textAlign: 'center' }}>
        Toque em qualquer dia para marcar menstruação ou registrar sintomas.
      </p>
    </div>
  );
}

// ─── Modal de dia ─────────────────────────────────────────────────────────────

const TIPO_SANGRAMENTO_OPS = [
  { v: 'nao',         label: '✗ Sem sangramento' },
  { v: 'escape',      label: '💧 Escape'          },
  { v: 'menstruacao', label: '🩸 Menstruação'     },
];

const COR_SANGUE_OPS    = [
  { v: 'rosado',          label: '🩷 Rosado'           },
  { v: 'vermelho_vivo',   label: '🔴 Vermelho vivo'    },
  { v: 'vermelho_escuro', label: '🩸 Vermelho escuro'  },
  { v: 'marrom',          label: '🟤 Marrom'           },
  { v: 'preto',           label: '⚫ Preto'            },
];
const INTENSIDADE_OPS   = [
  { v: 'leve',         label: 'Leve'         },
  { v: 'moderado',     label: 'Moderado'     },
  { v: 'intenso',      label: 'Intenso'      },
  { v: 'muito_intenso',label: 'Muito intenso'},
];
const COAGULOS_OPS      = [
  { v: 'nao',       label: 'Não'       },
  { v: 'pequenos',  label: 'Pequenos'  },
  { v: 'moderados', label: 'Moderados' },
  { v: 'grandes',   label: 'Grandes'   },
];

function ModalDia({ dia, periodos, sintomaDia, onFechar, onSalvarPeriodo, onAbrirSintomas, pacienteId, podeMarcarMenstruacao }) {
  const hoje = isoHoje();
  const ePeriodo = isDiaPeriodo(periodos, dia);
  const [busy, setBusy] = useState(false);

  // step 1 após marcar início: detalhes do período (ciclo_periodos)
  const [novoPeridoId, setNovoPeridoId] = useState(null);
  const [detalhes, setDetalhes] = useState({ cor_sangue: '', intensidade_fluxo: '', coagulos: 'nao', escape_pre: false, notas_periodo: '' });
  const [salvandoDetalhes, setSalvandoDetalhes] = useState(false);

  // step: sangramento diário (ciclo_sintomas_diarios)
  const [mostrarSangramento, setMostrarSangramento] = useState(false);
  const [tipoSang, setTipoSang] = useState(sintomaDia?.sangramento_dia ?? '');
  const [detSang, setDetSang] = useState({
    cor_sangue_dia:        sintomaDia?.cor_sangue_dia        ?? '',
    intensidade_fluxo_dia: sintomaDia?.intensidade_fluxo_dia ?? '',
    coagulos_dia:          sintomaDia?.coagulos_dia          ?? 'nao',
    absorventes_dia:       sintomaDia?.absorventes_dia       ?? null,
    notas_sangramento_dia: sintomaDia?.notas_sangramento_dia ?? '',
  });
  const [salvandoSang, setSalvandoSang] = useState(false);
  const setDS = (k, v) => setDetSang(d => ({ ...d, [k]: v }));

  async function salvarSangramento() {
    setSalvandoSang(true);
    const tipo = tipoSang || 'nao';
    const payload = { paciente_id: pacienteId, data: dia, sangramento_dia: tipo };
    if (tipo !== 'nao') {
      payload.cor_sangue_dia        = detSang.cor_sangue_dia        || null;
      payload.intensidade_fluxo_dia = detSang.intensidade_fluxo_dia || null;
      payload.coagulos_dia          = detSang.coagulos_dia          || null;
      if (detSang.absorventes_dia !== null) payload.absorventes_dia = detSang.absorventes_dia;
      if (detSang.notas_sangramento_dia) payload.notas_sangramento_dia = detSang.notas_sangramento_dia;
    } else {
      // Limpa explicitamente campos com CHECK constraint quando não há sangramento.
      // Necessário para UPDATEs em rows existentes: Postgres reavalia o CHECK em
      // todos os campos da row, mesmo os não incluídos no SET.
      payload.cor_sangue_dia        = null;
      payload.intensidade_fluxo_dia = null;
      payload.coagulos_dia          = null;
    }
    console.log('payload ciclo_sintomas_diarios [ModalDia]', payload);
    await supabase.from('ciclo_sintomas_diarios').upsert(payload, { onConflict: 'paciente_id,data' });
    setSalvandoSang(false);
    onSalvarPeriodo();
  }

  const periodoExistente = periodos.find(p => {
    const ini = new Date(p.inicio + 'T12:00:00');
    const fim = p.fim ? new Date(p.fim + 'T12:00:00') : new Date(ini.getTime() + 4 * 86400000);
    const alvo = new Date(dia + 'T12:00:00');
    return alvo >= ini && alvo <= fim;
  });

  async function marcarInicio() {
    setBusy(true);
    const { data } = await supabase
      .from('ciclo_periodos')
      .insert({ paciente_id: pacienteId, inicio: dia })
      .select('id').single();
    setBusy(false);
    if (data?.id) setNovoPeridoId(data.id);
    else onSalvarPeriodo();
  }

  async function salvarDetalhes() {
    if (!novoPeridoId) { onSalvarPeriodo(); return; }
    setSalvandoDetalhes(true);
    const payload = {
      coagulos:   detalhes.coagulos,
      escape_pre: detalhes.escape_pre,
    };
    if (detalhes.cor_sangue)        payload.cor_sangue        = detalhes.cor_sangue;
    if (detalhes.intensidade_fluxo) payload.intensidade_fluxo = detalhes.intensidade_fluxo;
    if (detalhes.notas_periodo)     payload.notas_periodo     = detalhes.notas_periodo;
    await supabase.from('ciclo_periodos').update(payload).eq('id', novoPeridoId);
    setSalvandoDetalhes(false);
    onSalvarPeriodo();
  }

  const setD = (k, v) => setDetalhes(d => ({ ...d, [k]: v }));

  async function marcarFim() {
    if (!periodoExistente) return;
    setBusy(true);
    await supabase.from('ciclo_periodos').update({ fim: dia }).eq('id', periodoExistente.id);
    setBusy(false);
    onSalvarPeriodo();
  }

  async function removerPeriodo() {
    if (!periodoExistente) return;
    if (!window.confirm('Remover este período?')) return;
    setBusy(true);
    await supabase.from('ciclo_periodos').delete().eq('id', periodoExistente.id);
    setBusy(false);
    onSalvarPeriodo();
  }

  const dFmt = new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' });
  const futuro = dia > hoje;

  return (
    <div onClick={onFechar} style={{
      position: 'fixed', inset: 0, background: 'rgba(28,23,18,.45)',
      zIndex: 50, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--bg)', width: '100%', maxWidth: 430,
        borderRadius: '24px 24px 0 0', padding: '20px 20px calc(28px + env(safe-area-inset-bottom, 0))',
      }}>
        <div style={{ width: 36, height: 4, background: 'var(--hair)', borderRadius: 2, margin: '0 auto 16px' }} />
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 18, color: 'var(--ink)', marginBottom: 4, textTransform: 'capitalize' }}>
          {dFmt}
        </div>
        {ePeriodo && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 11, padding: '3px 10px', borderRadius: 20,
            background: '#fdedef', color: '#c4616e', fontWeight: 500, marginBottom: 14,
          }}>
            🩸 Menstruação registrada
          </div>
        )}
        {!ePeriodo && (
          <div style={{ marginBottom: 14 }} />
        )}

        {mostrarSangramento ? (
          /* ── Sangramento diário (qualquer dia) ── */
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, marginBottom: 12 }}>
              Sangramento do dia
            </div>

            <FL>Como foi hoje?</FL>
            <GrupoOpcoes valor={tipoSang} opcoes={TIPO_SANGRAMENTO_OPS}
              onChange={v => setTipoSang(v)} cols={3} />

            {['escape', 'menstruacao'].includes(tipoSang) && (
              <>
                <FL>Cor do sangue</FL>
                <GrupoOpcoes valor={detSang.cor_sangue_dia} opcoes={COR_SANGUE_OPS}
                  onChange={v => setDS('cor_sangue_dia', v)} cols={2} />

                <FL>Intensidade do fluxo</FL>
                <GrupoOpcoes valor={detSang.intensidade_fluxo_dia} opcoes={INTENSIDADE_OPS}
                  onChange={v => setDS('intensidade_fluxo_dia', v)} cols={4} />

                <FL>Coágulos</FL>
                <GrupoOpcoes valor={detSang.coagulos_dia} opcoes={COAGULOS_OPS}
                  onChange={v => setDS('coagulos_dia', v)} cols={4} />

                <FL>Absorventes / trocas no dia</FL>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => setDS('absorventes_dia', Math.max(0, (detSang.absorventes_dia ?? 0) - 1))}
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-soft)', border: '0.5px solid var(--hair)', cursor: 'pointer', fontSize: 16 }}>−</button>
                  <span style={{ minWidth: 32, textAlign: 'center', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
                    {detSang.absorventes_dia ?? 0}
                  </span>
                  <button onClick={() => setDS('absorventes_dia', (detSang.absorventes_dia ?? 0) + 1)}
                    style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-soft)', border: '0.5px solid var(--hair)', cursor: 'pointer', fontSize: 16 }}>+</button>
                </div>

                <FL>Observações</FL>
                <textarea
                  value={detSang.notas_sangramento_dia}
                  onChange={e => setDS('notas_sangramento_dia', e.target.value)}
                  placeholder="Cólica, odor, sensação…"
                  rows={2}
                  style={{ ...inputSt, resize: 'vertical', marginTop: 4 }}
                />
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => setMostrarSangramento(false)}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 11,
                  background: 'var(--bg-soft)', color: 'var(--muted)',
                  border: '0.5px solid var(--hair)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                Voltar
              </button>
              <button onClick={salvarSangramento} disabled={salvandoSang || !tipoSang}
                style={{
                  flex: 2, padding: '11px 0', borderRadius: 11,
                  background: (salvandoSang || !tipoSang) ? 'var(--muted-2)' : 'var(--ink)',
                  color: 'var(--bg-soft)', border: 'none',
                  fontSize: 13, fontWeight: 500,
                  cursor: (salvandoSang || !tipoSang) ? 'default' : 'pointer',
                  fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <i className="ti ti-check" aria-hidden="true" />
                {salvandoSang ? 'Salvando…' : 'Salvar sangramento'}
              </button>
            </div>
          </div>
        ) : novoPeridoId ? (
          /* ── Detalhes do sangramento (passo 2, opcional) ── */
          <div>
            <div style={{ fontSize: 13, color: 'var(--ink)', fontWeight: 500, marginBottom: 12 }}>
              🩸 Período registrado! Quer adicionar detalhes do fluxo?
            </div>

            <FL>Cor do sangue</FL>
            <GrupoOpcoes valor={detalhes.cor_sangue} opcoes={COR_SANGUE_OPS}
              onChange={v => setD('cor_sangue', v)} cols={2} />

            <FL>Intensidade do fluxo</FL>
            <GrupoOpcoes valor={detalhes.intensidade_fluxo} opcoes={INTENSIDADE_OPS}
              onChange={v => setD('intensidade_fluxo', v)} cols={4} />

            <FL>Coágulos</FL>
            <GrupoOpcoes valor={detalhes.coagulos} opcoes={COAGULOS_OPS}
              onChange={v => setD('coagulos', v)} cols={4} />

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              <BtnToggle
                ativo={detalhes.escape_pre}
                onClick={() => setD('escape_pre', !detalhes.escape_pre)}
                label="Escape pré-menstrual (spotting)"
                icon="droplet-half"
              />
            </div>

            <FL>Observações</FL>
            <textarea
              value={detalhes.notas_periodo}
              onChange={e => setD('notas_periodo', e.target.value)}
              placeholder="Cólica, odor, sensação…"
              rows={2}
              style={{ ...inputSt, resize: 'vertical' }}
            />

            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={onSalvarPeriodo}
                style={{
                  flex: 1, padding: '11px 0', borderRadius: 11,
                  background: 'var(--bg-soft)', color: 'var(--muted)',
                  border: '0.5px solid var(--hair)', fontSize: 13, fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'var(--font-sans)',
                }}>
                Pular
              </button>
              <button onClick={salvarDetalhes} disabled={salvandoDetalhes}
                style={{
                  flex: 2, padding: '11px 0', borderRadius: 11,
                  background: salvandoDetalhes ? 'var(--muted-2)' : 'var(--ink)',
                  color: 'var(--bg-soft)', border: 'none',
                  fontSize: 13, fontWeight: 500, cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}>
                <i className="ti ti-check" aria-hidden="true" />
                {salvandoDetalhes ? 'Salvando…' : 'Salvar detalhes'}
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {!ePeriodo && !futuro && podeMarcarMenstruacao && (
              <BotaoSheet
                icon="droplet" label="Marcar início de menstruação"
                sub="Registra o início de um novo período"
                onClick={marcarInicio} busy={busy}
                cor="#c4616e"
              />
            )}
            {ePeriodo && periodoExistente && !periodoExistente.fim && !futuro && (
              <BotaoSheet
                icon="droplet-half-2" label="Marcar fim da menstruação"
                sub={`Iniciada em ${dataBRCurta(periodoExistente.inicio)}`}
                onClick={marcarFim} busy={busy}
                cor="#c4a882"
              />
            )}
            {!futuro && (
              <BotaoSheet
                icon="droplet-half-2"
                label={sintomaDia?.sangramento_dia ? 'Editar sangramento do dia' : 'Registrar sangramento do dia'}
                sub={sintomaDia?.sangramento_dia
                  ? `Registrado: ${TIPO_SANGRAMENTO_OPS.find(o => o.v === sintomaDia.sangramento_dia)?.label ?? sintomaDia.sangramento_dia}`
                  : 'Escape, menstruação, coágulos, absorventes'}
                onClick={() => setMostrarSangramento(true)}
                cor="#c4616e"
              />
            )}
            {!futuro && (
              <BotaoSheet
                icon="clipboard-list" label={sintomaDia ? 'Editar sintomas do dia' : 'Registrar sintomas do dia'}
                sub={sintomaDia ? 'Já existe um registro para este dia' : 'Humor, energia, dores e mais'}
                onClick={() => onAbrirSintomas(dia)}
                cor="var(--gold-deep)"
              />
            )}
            {ePeriodo && (
              <button onClick={removerPeriodo} disabled={busy}
                style={{
                  width: '100%', padding: '12px 14px', borderRadius: 12, cursor: 'pointer',
                  background: 'var(--red-soft)', color: 'var(--red)',
                  border: '0.5px solid var(--red)', fontSize: 13, fontWeight: 500,
                  fontFamily: 'var(--font-sans)', display: 'flex', alignItems: 'center', gap: 8,
                }}>
                <i className="ti ti-trash" style={{ fontSize: 15 }} aria-hidden="true" />
                Remover período
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BotaoSheet({ icon, label, sub, onClick, busy, cor }) {
  return (
    <button onClick={onClick} disabled={busy}
      style={{
        width: '100%', padding: '13px 14px', borderRadius: 14, cursor: 'pointer',
        background: 'var(--paper)', border: '0.5px solid var(--hair)',
        textAlign: 'left', fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'var(--bg-soft)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <i className={`ti ti-${icon}`} style={{ fontSize: 17, color: cor ?? 'var(--gold-deep)' }} aria-hidden="true" />
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>{label}</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{sub}</div>
      </div>
    </button>
  );
}

// ─── Formulário de sintomas diários ──────────────────────────────────────────

function novoSintoma() {
  return {
    humor: 0, energia: 0, sono: 0, libido: 0, foco: 0,
    dor_pelvica: 0, dor_mamas: 0, dor_cabeca: 0, enxaqueca: false,
    retencao: 0, inchaco: 0, acne: 0, oleosidade: 0,
    intestino: '', compulsao: 0,
    ansiedade: 0, irritabilidade: 0, choro: false,
    calorons: false, suor_noturno: false,
    despertar_noturno: false, dor_articular: false,
    fluxo_muito_maior: false, fluxo_muito_menor: false,
    secura_vaginal: false, palpitacoes: false, queda_cabelo: false,
    insonia: false, acorda_madrugada: false,
    lentidao: false, frio_excessivo: false, pele_seca: false, queda_sobrancelhas: false,
    sangramento_dia: '', cor_sangue_dia: '',
    intensidade_fluxo_dia: '', coagulos_dia: 'nao',
    absorventes_dia: null, notas_sangramento_dia: '',
    muco_cervical: '',
    notas: '',
  };
}

const MUCO_OPS = [
  { v: 'ausente',  label: 'Ausente'  },
  { v: 'seco',     label: 'Seco'     },
  { v: 'cremoso',  label: 'Cremoso'  },
  { v: 'aquoso',   label: 'Aquoso'   },
  { v: 'elastico', label: 'Elástico' },
];
const INTESTINO_OPS = [
  { v: 'normal',   label: 'Normal'   },
  { v: 'preso',    label: 'Preso'    },
  { v: 'solto',    label: 'Solto'    },
  { v: 'gases',    label: 'Gases'    },
  { v: 'alternado', label: 'Alternado' },
];

function FormSintomas({ dia, existente, periodos, situacaoCiclo, estadoReprodutivo, onSalvo, onCancelar }) {
  const { user, profile } = useSession();
  const pacienteId = profile?.id;

  // Oculta bloco de sangramento para quem não menstrua por razão clínica.
  const exibeSangramento = !['ciclo_suprimido', 'nao_menstrua'].includes(situacaoCiclo)
    && !['menopausa', 'gestante', 'pos_parto'].includes(estadoReprodutivo);
  const [form, setForm] = useState(() => existente ? { ...novoSintoma(), ...existente } : novoSintoma());
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);

  const sv = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const tog = k => setForm(f => ({ ...f, [k]: !f[k] }));

  const { fase }    = calcularFaseDoCiclo(periodos, dia);
  const estagioPeri = classificarEstagioPeri(periodos);
  const scores      = calcularScoresHormonais(form, fase, estagioPeri);
  const alertas     = gerarAlertas(scores);
  const correlacoes = detectarCorrelacoes(scores, form);

  async function salvar() {
    setErro(null);
    setBusy(true);
    // Converte '' → null antes de enviar ao DB.
    // CHECK constraints do Postgres passam com NULL mas falham com '' vazia.
    const sanitized = Object.fromEntries(
      Object.entries(form).map(([k, v]) => [k, v === '' ? null : v])
    );
    // Quando não há sangramento, nulifica campos dependentes para não violar CHECK
    // nem deixar dados semanticamente inválidos em updates de rows existentes.
    const temSangramento = ['escape', 'menstruacao'].includes(sanitized.sangramento_dia);
    if (!temSangramento) {
      sanitized.cor_sangue_dia        = null;
      sanitized.intensidade_fluxo_dia = null;
      sanitized.coagulos_dia          = null;
    }
    console.log('payload ciclo_sintomas_diarios [FormSintomas]', { paciente_id: pacienteId, data: dia, ...sanitized });
    const { error } = await supabase.from('ciclo_sintomas_diarios').upsert(
      { paciente_id: pacienteId, data: dia, ...sanitized },
      { onConflict: 'paciente_id,data' }
    );
    setBusy(false);
    if (error) { setErro(error.message); return; }
    onSalvo();
  }

  const dFmt = new Date(dia + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short' });

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500 }}>
            Registro do dia
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)', textTransform: 'capitalize' }}>
            {dFmt}
          </div>
        </div>
        <button onClick={onCancelar} style={{
          background: 'none', border: '0.5px solid var(--hair)', borderRadius: 9,
          padding: '6px 10px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}>
          <i className="ti ti-x" style={{ fontSize: 13 }} aria-hidden="true" />
        </button>
      </div>

      <div style={{ background: 'var(--paper)', border: '0.5px solid var(--hair)', borderRadius: 16, padding: '4px 16px 18px' }}>
        <SL>Bem-estar</SL>
        <FL>Humor</FL>
        <Escala5 valor={form.humor} onChange={v => sv('humor', v)} emojis={['😞','😕','😐','🙂','😄']} />
        <FL>Energia</FL>
        <Escala5 valor={form.energia} onChange={v => sv('energia', v)} emojis={['😴','🥱','😐','⚡','🚀']} />
        <FL>Sono (qualidade)</FL>
        <Escala5 valor={form.sono} onChange={v => sv('sono', v)} emojis={['😫','😕','😐','😴','🌙']} />
        <FL>Foco / concentração</FL>
        <Escala5 valor={form.foco} onChange={v => sv('foco', v)} emojis={['Nulo','Baixo','Médio','Bom','Excelente']} />
        <FL>Libido</FL>
        <Escala5 valor={form.libido} onChange={v => sv('libido', v)} emojis={['Sem','Baixa','Média','Alta','Muita']} />

        {exibeSangramento && <SL>Sangramento do dia</SL>}
        {exibeSangramento && <FL>Como foi hoje?</FL>}
        {exibeSangramento && (
          <GrupoOpcoes valor={form.sangramento_dia} opcoes={TIPO_SANGRAMENTO_OPS}
            onChange={v => sv('sangramento_dia', v)} cols={3} />
        )}

        {exibeSangramento && ['escape', 'menstruacao'].includes(form.sangramento_dia) && (
          <>
            <FL>Cor do sangue</FL>
            <GrupoOpcoes valor={form.cor_sangue_dia} opcoes={COR_SANGUE_OPS}
              onChange={v => sv('cor_sangue_dia', v)} cols={2} />

            <FL>Intensidade do fluxo</FL>
            <GrupoOpcoes valor={form.intensidade_fluxo_dia} opcoes={INTENSIDADE_OPS}
              onChange={v => sv('intensidade_fluxo_dia', v)} cols={4} />

            <FL>Coágulos</FL>
            <GrupoOpcoes valor={form.coagulos_dia} opcoes={COAGULOS_OPS}
              onChange={v => sv('coagulos_dia', v)} cols={4} />

            <FL>Absorventes / trocas no dia</FL>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button onClick={() => sv('absorventes_dia', Math.max(0, (form.absorventes_dia ?? 0) - 1))}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-soft)', border: '0.5px solid var(--hair)', cursor: 'pointer', fontSize: 16, fontFamily: 'var(--font-sans)' }}>−</button>
              <span style={{ minWidth: 40, textAlign: 'center', fontSize: 16, fontWeight: 600, color: 'var(--ink)' }}>
                {form.absorventes_dia ?? 0}
              </span>
              <button onClick={() => sv('absorventes_dia', (form.absorventes_dia ?? 0) + 1)}
                style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--bg-soft)', border: '0.5px solid var(--hair)', cursor: 'pointer', fontSize: 16, fontFamily: 'var(--font-sans)' }}>+</button>
              <span style={{ fontSize: 11, color: 'var(--muted)' }}>trocas</span>
              {(form.absorventes_dia ?? 0) > 0 && (
                <button onClick={() => sv('absorventes_dia', null)}
                  style={{ fontSize: 11, color: 'var(--muted)', background: 'none', border: 'none', cursor: 'pointer' }}>limpar</button>
              )}
            </div>

            <FL>Observações do sangramento</FL>
            <textarea
              value={form.notas_sangramento_dia}
              onChange={e => sv('notas_sangramento_dia', e.target.value)}
              placeholder="Cólica, odor, sensação, momento do dia…"
              rows={2}
              style={{ ...inputSt, resize: 'vertical', minHeight: 48, lineHeight: 1.5 }}
            />
          </>
        )}

        <SL>Físico</SL>
        <FL>Dor pélvica / cólica</FL>
        <Escala3 valor={form.dor_pelvica} onChange={v => sv('dor_pelvica', v)} />
        <FL>Dor nas mamas</FL>
        <Escala3 valor={form.dor_mamas} onChange={v => sv('dor_mamas', v)} />
        <FL>Dor de cabeça</FL>
        <Escala3 valor={form.dor_cabeca} onChange={v => sv('dor_cabeca', v)} />
        <FL>Retenção hídrica</FL>
        <Escala3 valor={form.retencao} onChange={v => sv('retencao', v)} />
        <FL>Inchaço</FL>
        <Escala3 valor={form.inchaco} onChange={v => sv('inchaco', v)} />
        <FL>Acne</FL>
        <Escala3 valor={form.acne} onChange={v => sv('acne', v)} />
        <FL>Oleosidade da pele</FL>
        <Escala3 valor={form.oleosidade} onChange={v => sv('oleosidade', v)} />
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
          <BtnToggle ativo={form.enxaqueca} onClick={() => tog('enxaqueca')} label="Enxaqueca"   icon="brain"   />
          <BtnToggle ativo={form.choro}     onClick={() => tog('choro')}     label="Choro fácil" icon="droplet" />
        </div>

        <SL>Transição hormonal</SL>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <BtnToggle ativo={form.calorons}          onClick={() => tog('calorons')}          label="Calorões"          icon="flame"        />
          <BtnToggle ativo={form.suor_noturno}      onClick={() => tog('suor_noturno')}      label="Suor noturno"      icon="moon"         />
          <BtnToggle ativo={form.despertar_noturno} onClick={() => tog('despertar_noturno')} label="Despertar noturno" icon="moon-off"      />
          <BtnToggle ativo={form.acorda_madrugada}  onClick={() => tog('acorda_madrugada')}  label="Acorda 3h–5h"      icon="clock"        />
          <BtnToggle ativo={form.dor_articular}     onClick={() => tog('dor_articular')}     label="Dor articular"     icon="bone"         />
          <BtnToggle ativo={form.palpitacoes}       onClick={() => tog('palpitacoes')}       label="Palpitações"       icon="heartbeat"    />
          <BtnToggle ativo={form.secura_vaginal}    onClick={() => tog('secura_vaginal')}    label="Secura vaginal"    icon="droplet-off"  />
          <BtnToggle ativo={form.fluxo_muito_maior} onClick={() => tog('fluxo_muito_maior')} label="Fluxo muito maior" icon="droplets"      />
          <BtnToggle ativo={form.fluxo_muito_menor} onClick={() => tog('fluxo_muito_menor')} label="Fluxo muito menor" icon="droplet-half"  />
        </div>

        <SL>Sono</SL>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <BtnToggle ativo={form.insonia}          onClick={() => tog('insonia')}          label="Insônia (dificuldade em adormecer)" icon="zzz"      />
          <BtnToggle ativo={form.queda_cabelo}     onClick={() => tog('queda_cabelo')}     label="Queda de cabelo notada hoje"        icon="scissors" />
          <BtnToggle ativo={form.queda_sobrancelhas} onClick={() => tog('queda_sobrancelhas')} label="Queda de sobrancelhas (terço externo)" icon="eye"  />
        </div>

        <SL>Sinais metabólicos</SL>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <BtnToggle ativo={form.lentidao}       onClick={() => tog('lentidao')}       label="Lentidão — corpo e raciocínio lentos" icon="hourglass"   />
          <BtnToggle ativo={form.frio_excessivo} onClick={() => tog('frio_excessivo')} label="Frio excessivo — mais frio que o normal" icon="snowflake" />
          <BtnToggle ativo={form.pele_seca}      onClick={() => tog('pele_seca')}      label="Pele muito seca hoje"                 icon="droplet-off" />
        </div>

        <SL>Digestivo &amp; emocional</SL>
        <FL>Intestino</FL>
        <GrupoOpcoes valor={form.intestino} opcoes={INTESTINO_OPS} onChange={v => sv('intestino', v)} cols={5} />
        <FL>Compulsão por doces / carboidratos</FL>
        <Escala3 valor={form.compulsao} onChange={v => sv('compulsao', v)} />
        <FL>Ansiedade</FL>
        <Escala3 valor={form.ansiedade} onChange={v => sv('ansiedade', v)} />
        <FL>Irritabilidade</FL>
        <Escala3 valor={form.irritabilidade} onChange={v => sv('irritabilidade', v)} />

        <SL>Cervical</SL>
        <FL>Muco cervical</FL>
        <GrupoOpcoes valor={form.muco_cervical} opcoes={MUCO_OPS} onChange={v => sv('muco_cervical', v)} cols={5} />

        <SL>Notas livres</SL>
        <textarea
          value={form.notas}
          onChange={e => sv('notas', e.target.value)}
          placeholder="Algo relevante para este dia…"
          rows={3}
          style={{ ...inputSt, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }}
        />
      </div>

      {/* preview de scores */}
      {scores && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, margin: '0 2px 8px' }}>
            Scores hormonais (prévia)
          </div>
          <div style={{ background: 'var(--paper)', border: '0.5px solid var(--hair)', borderRadius: 14, padding: '12px 14px' }}>
            {Object.entries(EIXOS).map(([k, e]) => {
              const v = scores[k] ?? 0;
              const isPeri = k === 'perimenopausa';
              const cor = isPeri
                ? (v >= 70 ? '#854f0b' : v >= 55 ? '#c4a882' : '#7ea85a')
                : (v >= 70 ? '#993556' : v >= 55 ? '#854f0b' : '#7ea85a');
              return (
                <div key={k} style={{ marginBottom: 9 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink)' }}>{e.label}</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)', fontVariantNumeric: 'tabular-nums' }}>{v}%</span>
                  </div>
                  <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                    <div style={{ width: `${v}%`, height: '100%', background: cor, borderRadius: 3, transition: 'width .4s' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* alertas prévia */}
      {alertas.length > 0 && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {alertas.map((a, i) => {
            const corBg     = a.tipo === 'alerta' ? 'var(--red-soft)'    : a.tipo === 'aviso' ? 'var(--orange-soft)' : 'var(--blue-soft)';
            const corBorder = a.tipo === 'alerta' ? 'var(--red)'         : a.tipo === 'aviso' ? 'var(--orange)'      : 'var(--blue)';
            // textoPaciente (em descricao) é acolhedor; microconduta (em sugestao) é prático
            const corpo = a.sugestao || a.descricao;
            return (
              <div key={i} style={{
                padding: '10px 13px', borderRadius: 11,
                background: corBg, border: `0.5px solid ${corBorder}`,
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                  <i className={`ti ti-${a.icon}`} style={{ marginRight: 5 }} aria-hidden="true" />{a.titulo}
                </div>
                {corpo && (
                  <div style={{ fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{corpo}</div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* correlações — versão simplificada para a paciente */}
      {correlacoes.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {correlacoes.map(c => (
            <div key={c.id} style={{
              padding: '9px 12px', borderRadius: 11,
              background: 'var(--blue-soft)', border: '0.5px solid var(--blue)',
            }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink)', marginBottom: 2 }}>
                <i className="ti ti-arrows-join" style={{ marginRight: 5, color: 'var(--blue)' }} aria-hidden="true" />
                {c.nome}
              </div>
              <div style={{ fontSize: 11, color: 'var(--ink-soft)', lineHeight: 1.5 }}>{c.interpretacao}</div>
            </div>
          ))}
        </div>
      )}

      {erro && (
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 12 }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={onCancelar} style={{
          flex: 1, padding: '11px 0', borderRadius: 11,
          background: 'var(--bg-soft)', color: 'var(--muted)',
          border: '0.5px solid var(--hair)', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}>
          Cancelar
        </button>
        <button onClick={salvar} disabled={busy} style={{
          flex: 2, padding: '11px 0', borderRadius: 11,
          background: busy ? 'var(--muted-2)' : 'var(--ink)',
          color: 'var(--bg-soft)', border: 'none',
          fontSize: 13, fontWeight: 500, cursor: busy ? 'default' : 'pointer',
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <i className="ti ti-check" aria-hidden="true" />
          {busy ? 'Salvando…' : 'Salvar registro'}
        </button>
      </div>
    </div>
  );
}

// ─── Formulário de perfil hormonal ───────────────────────────────────────────

const SITUACAO_OPS = [
  { v: 'menstrua_regularmente', label: 'Menstruo regularmente'           },
  { v: 'ciclo_irregular',       label: 'Ciclo irregular'                 },
  { v: 'ciclo_suprimido',       label: 'Anticoncepcional que inibe menstruação' },
  { v: 'nao_menstrua',          label: 'Não menstruo (outro motivo)'     },
  { v: 'outro',                 label: 'Outra situação'                  },
];
const ESTADO_OPS = [
  { v: 'nenhum',       label: 'Nenhuma condição especial' },
  { v: 'perimenopausa',label: 'Perimenopausa (transição)' },
  { v: 'menopausa',    label: 'Menopausa'                 },
  { v: 'gestante',     label: 'Gestante'                  },
  { v: 'pos_parto',    label: 'Pós-parto'                 },
  { v: 'outro',        label: 'Outro'                     },
];
const CONTRAC_TIPO_OPS = [
  { v: 'pilula',       label: 'Pílula'        },
  { v: 'diu_hormonal', label: 'DIU hormonal'  },
  { v: 'implante',     label: 'Implante'      },
  { v: 'injetavel',    label: 'Injetável'     },
  { v: 'adesivo',      label: 'Adesivo'       },
  { v: 'anel_vaginal', label: 'Anel vaginal'  },
  { v: 'outro',        label: 'Outro'         },
];
const CONTRAC_NAO_HORM_OPS = [
  { v: 'nenhum',              label: 'Nenhum'                         },
  { v: 'diu_cobre',           label: 'DIU de cobre'                   },
  { v: 'preservativo',        label: 'Preservativo'                   },
  { v: 'diafragma',           label: 'Diafragma'                      },
  { v: 'tabelinha',           label: 'Tabelinha / percepção de fertilidade' },
  { v: 'coito_interrompido',  label: 'Coito interrompido'             },
  { v: 'laqueadura',          label: 'Laqueadura'                     },
  { v: 'outro',               label: 'Outro'                          },
];
const TRH_TIPO_OPS = [
  { v: 'estrogênio',   label: 'Estrogênio'    },
  { v: 'progesterona', label: 'Progesterona'  },
  { v: 'combinada',    label: 'Combinada'     },
  { v: 'testosterona', label: 'Testosterona'  },
  { v: 'outro',        label: 'Outro'         },
];
const TRH_VIA_OPS = [
  { v: 'oral',         label: 'Oral'          },
  { v: 'transdermica', label: 'Transdérmica'  },
  { v: 'gel',          label: 'Gel'           },
  { v: 'adesivo',      label: 'Adesivo'       },
  { v: 'implante',     label: 'Implante'      },
  { v: 'outro',        label: 'Outro'         },
];

function FormPerfil({ pacienteId, perfil, onSalvo, onCancelar }) {
  const [form, setForm] = useState({
    situacao_ciclo:       perfil?.situacao_ciclo       ?? 'menstrua_regularmente',
    estado_reprodutivo:   perfil?.estado_reprodutivo   ?? 'nenhum',
    amamentando:          perfil?.amamentando          ?? false,
    usa_contraceptivo:    perfil?.usa_contraceptivo    ?? false,
    contraceptivo_tipo:   perfil?.contraceptivo_tipo   ?? '',
    contraceptivo_nome:   perfil?.contraceptivo_nome   ?? '',
    contraceptivo_continuo: perfil?.contraceptivo_continuo ?? false,
    contraceptivo_menstrua: perfil?.contraceptivo_menstrua ?? null,
    contraceptivo_obs:    perfil?.contraceptivo_obs    ?? '',
    usa_contracepcao_nao_hormonal:  perfil?.usa_contracepcao_nao_hormonal ?? false,
    contracepcao_nao_hormonal_tipo: perfil?.contracepcao_nao_hormonal_tipo ?? '',
    contracepcao_nao_hormonal_obs:  perfil?.contracepcao_nao_hormonal_obs  ?? '',
    usa_trh:              perfil?.usa_trh              ?? false,
    trh_tipo:             perfil?.trh_tipo             ?? '',
    trh_via:              perfil?.trh_via              ?? '',
    trh_obs:              perfil?.trh_obs              ?? '',
    obs_geral:            perfil?.obs_geral            ?? '',
  });
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState(null);

  const set  = k => v  => setForm(f => ({ ...f, [k]: v }));
  const setE = k => e  => setForm(f => ({ ...f, [k]: e.target.value }));
  const tog  = k => () => setForm(f => ({ ...f, [k]: !f[k] }));

  async function salvar() {
    setSalvando(true);
    setErro(null);
    // Campos nullable com CHECK constraint devem ser null, nunca ''.
    // trh_tipo e trh_via têm o mesmo padrão — corrigidos preventivamente.
    const payload = {
      paciente_id:            pacienteId,
      situacao_ciclo:         form.situacao_ciclo,
      estado_reprodutivo:     form.estado_reprodutivo,
      amamentando:            form.amamentando,
      usa_contraceptivo:      form.usa_contraceptivo,
      contraceptivo_tipo:     form.contraceptivo_tipo     || null,
      contraceptivo_nome:     form.contraceptivo_nome?.trim()     || null,
      contraceptivo_continuo: form.contraceptivo_continuo,
      contraceptivo_menstrua: form.contraceptivo_menstrua,
      contraceptivo_obs:      form.contraceptivo_obs?.trim()      || null,
      usa_contracepcao_nao_hormonal:  form.usa_contracepcao_nao_hormonal,
      contracepcao_nao_hormonal_tipo: form.contracepcao_nao_hormonal_tipo || null,
      contracepcao_nao_hormonal_obs:  form.contracepcao_nao_hormonal_obs?.trim() || null,
      usa_trh:                form.usa_trh,
      trh_tipo:               form.trh_tipo               || null,
      trh_via:                form.trh_via                || null,
      trh_obs:                form.trh_obs?.trim()                || null,
      obs_geral:              form.obs_geral?.trim()              || null,
    };
    const { error } = await supabase
      .from('ciclo_perfil')
      .upsert(payload, { onConflict: 'paciente_id' });
    setSalvando(false);
    if (error) { setErro(error.message); return; }
    onSalvo();
  }

  return (
    <div style={{ padding: '0 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ fontFamily: 'var(--font-serif)', fontSize: 20, color: 'var(--ink)' }}>
          Meu perfil hormonal
        </div>
        <button onClick={onCancelar} style={{
          background: 'none', border: '0.5px solid var(--hair)', borderRadius: 9,
          padding: '6px 10px', fontSize: 12, color: 'var(--muted)', cursor: 'pointer',
          fontFamily: 'var(--font-sans)',
        }}>
          <i className="ti ti-x" style={{ fontSize: 13 }} aria-hidden="true" />
        </button>
      </div>

      <div style={{ background: 'var(--paper)', border: '0.5px solid var(--hair)', borderRadius: 16, padding: '4px 16px 18px' }}>
        <SL>Como está seu ciclo agora</SL>
        <GrupoOpcoes valor={form.situacao_ciclo} opcoes={SITUACAO_OPS}
          onChange={set('situacao_ciclo')} cols={1} />

        <SL>Estado hormonal / reprodutivo</SL>
        <GrupoOpcoes valor={form.estado_reprodutivo} opcoes={ESTADO_OPS}
          onChange={set('estado_reprodutivo')} cols={2} />
        <div style={{ marginTop: 10 }}>
          <BtnToggle ativo={form.amamentando} onClick={tog('amamentando')} label="Estou amamentando" icon="heart" />
        </div>

        {!['gestante', 'pos_parto'].includes(form.estado_reprodutivo) && (<>
          <SL>Contraceptivo hormonal</SL>
          <BtnToggle ativo={form.usa_contraceptivo} onClick={tog('usa_contraceptivo')}
            label="Uso contraceptivo hormonal" icon="pill" />
          {form.usa_contraceptivo && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <FL>Tipo</FL>
                <GrupoOpcoes valor={form.contraceptivo_tipo} opcoes={CONTRAC_TIPO_OPS}
                  onChange={set('contraceptivo_tipo')} cols={3} />
              </div>
              <div>
                <FL>Nome (opcional)</FL>
                <input style={inputSt} value={form.contraceptivo_nome} onChange={setE('contraceptivo_nome')}
                  placeholder="Ex: Yasmin, Mirena…" />
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <BtnToggle ativo={form.contraceptivo_continuo} onClick={tog('contraceptivo_continuo')}
                  label="Uso contínuo (sem pausa)" icon="refresh" />
                <BtnToggle ativo={form.contraceptivo_menstrua === true}
                  onClick={() => set('contraceptivo_menstrua')(form.contraceptivo_menstrua === true ? null : true)}
                  label="Menstruo com ele" icon="droplet" />
                <BtnToggle ativo={form.contraceptivo_menstrua === false}
                  onClick={() => set('contraceptivo_menstrua')(form.contraceptivo_menstrua === false ? null : false)}
                  label="Não menstruo com ele" icon="droplet-off" />
              </div>
            </div>
          )}

          <SL>Método contraceptivo não hormonal</SL>
          <BtnToggle ativo={form.usa_contracepcao_nao_hormonal} onClick={tog('usa_contracepcao_nao_hormonal')}
            label="Utilizo método contraceptivo não hormonal" icon="shield" />
          {form.usa_contracepcao_nao_hormonal && (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div>
                <FL>Método</FL>
                <GrupoOpcoes valor={form.contracepcao_nao_hormonal_tipo} opcoes={CONTRAC_NAO_HORM_OPS}
                  onChange={set('contracepcao_nao_hormonal_tipo')} cols={2} />
              </div>
              <div>
                <FL>Observações (opcional)</FL>
                <input style={inputSt} value={form.contracepcao_nao_hormonal_obs}
                  onChange={setE('contracepcao_nao_hormonal_obs')}
                  placeholder="Ex: DIU inserido em 2024…" />
              </div>
            </div>
          )}
        </>)}

        <SL>Reposição hormonal (TRH)</SL>
        <BtnToggle ativo={form.usa_trh} onClick={tog('usa_trh')}
          label="Uso terapia de reposição hormonal" icon="activity" />
        {form.usa_trh && (
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <FL>Tipo de hormônio</FL>
              <GrupoOpcoes valor={form.trh_tipo} opcoes={TRH_TIPO_OPS}
                onChange={set('trh_tipo')} cols={3} />
            </div>
            <div>
              <FL>Via de administração</FL>
              <GrupoOpcoes valor={form.trh_via} opcoes={TRH_VIA_OPS}
                onChange={set('trh_via')} cols={3} />
            </div>
            <div>
              <FL>Observações (opcional)</FL>
              <input style={inputSt} value={form.trh_obs} onChange={setE('trh_obs')}
                placeholder="Dose, duração…" />
            </div>
          </div>
        )}

        <SL>Observações gerais</SL>
        <textarea
          value={form.obs_geral} onChange={setE('obs_geral')}
          placeholder="Qualquer informação relevante sobre seu histórico hormonal…"
          rows={3}
          style={{ ...inputSt, resize: 'vertical', minHeight: 64, lineHeight: 1.5 }}
        />
      </div>

      {erro && (
        <div style={{ marginTop: 10, padding: '9px 12px', borderRadius: 9, background: 'var(--red-soft)', color: 'var(--red)', fontSize: 12 }}>
          {erro}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <button onClick={onCancelar} style={{
          flex: 1, padding: '11px 0', borderRadius: 11,
          background: 'var(--bg-soft)', color: 'var(--muted)',
          border: '0.5px solid var(--hair)', fontSize: 13, fontWeight: 500,
          cursor: 'pointer', fontFamily: 'var(--font-sans)',
        }}>
          Cancelar
        </button>
        <button onClick={salvar} disabled={salvando} style={{
          flex: 2, padding: '11px 0', borderRadius: 11,
          background: salvando ? 'var(--muted-2)' : 'var(--ink)',
          color: 'var(--bg-soft)', border: 'none',
          fontSize: 13, fontWeight: 500, cursor: salvando ? 'default' : 'pointer',
          fontFamily: 'var(--font-sans)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}>
          <i className="ti ti-check" aria-hidden="true" />
          {salvando ? 'Salvando…' : 'Salvar perfil'}
        </button>
      </div>
    </div>
  );
}

// ─── Aba Registros (histórico) ────────────────────────────────────────────────

function Registros({ periodos, sintomas }) {
  const mediaC = duracaoMediaCiclo(periodos);

  const ultimosCiclos = useMemo(() => {
    const sorted = [...periodos].sort((a, b) => new Date(b.inicio) - new Date(a.inicio)).slice(0, 6);
    return sorted.map((p, i) => {
      const prox = sorted[i - 1];
      const dur  = prox ? Math.round((new Date(prox.inicio) - new Date(p.inicio)) / 86400000) : null;
      const sang = p.fim ? Math.round((new Date(p.fim) - new Date(p.inicio)) / 86400000) + 1 : null;
      const sintDoCiclo = sintomas.filter(s => {
        const d = new Date(s.data + 'T12:00:00');
        const ini = new Date(p.inicio + 'T12:00:00');
        const fim = prox ? new Date(prox.inicio + 'T12:00:00') : new Date();
        return d >= ini && d < fim;
      });
      return { ...p, durCiclo: dur, durSang: sang, totalSint: sintDoCiclo.length };
    });
  }, [periodos, sintomas]);

  const sintomasFreq = useMemo(() => {
    if (!sintomas.length) return [];
    const total = sintomas.length;
    const checks = [
      { label: 'Dor pélvica / cólica',  fn: s => (s.dor_pelvica ?? 0) >= 2 },
      { label: 'Compulsão',              fn: s => (s.compulsao ?? 0) >= 2 },
      { label: 'Inchaço',               fn: s => (s.inchaco ?? 0) >= 2 },
      { label: 'Irritabilidade',        fn: s => (s.irritabilidade ?? 0) >= 2 },
      { label: 'Ansiedade',             fn: s => (s.ansiedade ?? 0) >= 2 },
      { label: 'Dor de cabeça',         fn: s => (s.dor_cabeca ?? 0) >= 2 },
      { label: 'Acne',                  fn: s => (s.acne ?? 0) >= 2 },
      { label: 'Calorões',              fn: s => s.calorons },
      { label: 'Suor noturno',          fn: s => s.suor_noturno },
      { label: 'Enxaqueca',             fn: s => s.enxaqueca },
    ];
    return checks
      .map(c => ({ label: c.label, pct: Math.round((sintomas.filter(c.fn).length / total) * 100) }))
      .filter(c => c.pct > 0)
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 7);
  }, [sintomas]);

  return (
    <div style={{ padding: '0 16px' }}>
      {/* stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { label: 'Ciclos registrados', val: periodos.length },
          { label: 'Ciclo médio',        val: periodos.length >= 2 ? `${mediaC}d` : '—' },
          { label: 'Logs de sintomas',   val: sintomas.length },
        ].map((s, i) => (
          <div key={i} style={{
            background: 'var(--paper)', border: '0.5px solid var(--hair)',
            borderRadius: 12, padding: '10px 12px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, marginBottom: 4 }}>
              {s.label}
            </div>
            <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: 'var(--ink)', lineHeight: 1 }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      {/* sintomas mais frequentes */}
      {sintomasFreq.length > 0 && (
        <div style={{ background: 'var(--paper)', border: '0.5px solid var(--hair)', borderRadius: 14, padding: '14px 14px', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
            Sintomas mais frequentes
          </div>
          {sintomasFreq.map((s, i) => {
            const cor = s.pct >= 60 ? '#993556' : s.pct >= 35 ? '#854f0b' : 'var(--gold-deep)';
            return (
              <div key={i} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontSize: 12, color: 'var(--ink)' }}>{s.label}</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{s.pct}%</span>
                </div>
                <div style={{ height: 5, borderRadius: 3, background: 'var(--bg-deep)', overflow: 'hidden' }}>
                  <div style={{ width: `${s.pct}%`, height: '100%', background: cor, borderRadius: 3 }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* últimos ciclos */}
      {ultimosCiclos.length === 0 ? (
        <div style={{ padding: '32px 0', textAlign: 'center' }}>
          <i className="ti ti-moon-stars" style={{ fontSize: 34, color: 'var(--muted-2)', display: 'block', marginBottom: 8 }} aria-hidden="true" />
          <div style={{ fontSize: 13, color: 'var(--muted)' }}>Marque um período no Calendário para começar.</div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase', color: 'var(--muted)', fontWeight: 500, margin: '4px 2px 8px' }}>
            Últimos ciclos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {ultimosCiclos.map((c, i) => (
              <div key={c.id} style={{
                background: 'var(--paper)', border: '0.5px solid var(--hair)',
                borderRadius: 13, padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: '#fdedef',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 17,
                }}>🩸</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                    {dataBR(c.inicio)} {c.fim ? `→ ${dataBR(c.fim)}` : '(em aberto)'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {[
                      c.durSang && `${c.durSang}d sangramento`,
                      c.durCiclo && `ciclo: ${c.durCiclo}d`,
                      c.totalSint > 0 && `${c.totalSint} logs`,
                    ].filter(Boolean).join(' · ')}
                  </div>
                </div>
                {c.durCiclo && (
                  <div style={{
                    fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 600, flexShrink: 0,
                    background: (c.durCiclo < 21 || c.durCiclo > 35) ? 'var(--orange-soft)' : 'var(--green-soft)',
                    color: (c.durCiclo < 21 || c.durCiclo > 35) ? 'var(--orange)' : 'var(--green)',
                  }}>
                    {c.durCiclo}d
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

// ─── Tela principal ───────────────────────────────────────────────────────────

export default function Ciclo() {
  const { user, profile } = useSession();
  const pacienteId = profile?.id;
  const [periodos, setPeriodos]       = useState(null);
  const [sintomas, setSintomas]       = useState([]);
  const [perfil, setPerfil]           = useState(null);
  const [aba, setAba]                 = useState('calendario');
  const [diaSel, setDiaSel]           = useState(null);
  const [diaSintoma, setDiaSintoma]   = useState(null);
  const [mostrarPerfil, setMostrarPerfil] = useState(false);

  async function carregar() {
    if (!user) return;
    const [pRes, sRes, prRes] = await Promise.all([
      supabase.from('ciclo_periodos').select('*').eq('paciente_id', pacienteId).order('inicio', { ascending: false }),
      supabase.from('ciclo_sintomas_diarios').select('*').eq('paciente_id', pacienteId).order('data', { ascending: false }).limit(90),
      supabase.from('ciclo_perfil').select('*').eq('paciente_id', pacienteId).maybeSingle(),
    ]);
    setPeriodos(pRes.data ?? []);
    setSintomas(sRes.data ?? []);
    setPerfil(prRes.data ?? null);
  }

  useEffect(() => { carregar(); }, [user]);

  if (!podeAcessar(profile?.acesso_utera, 'ciclo')) {
    return <BloqueioModelo modulo="Ciclo & Hormônios" tierMinimo={2} />;
  }

  async function handleSalvarPeriodo() {
    setDiaSel(null);
    await carregar();
  }

  function handleDiaTocado(dia) {
    setDiaSel(dia);
  }

  function handleAbrirSintomas(dia) {
    setDiaSel(null);
    setDiaSintoma(dia);
  }

  if (periodos === null) {
    return <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>Carregando…</div>;
  }

  const situacaoCiclo        = perfil?.situacao_ciclo    ?? 'menstrua_regularmente';
  const estadoReprodutivo    = perfil?.estado_reprodutivo ?? 'nenhum';
  const podeMarcarMenstruacao = !['ciclo_suprimido', 'nao_menstrua'].includes(situacaoCiclo);
  const sintomaDiaSel        = sintomas.find(s => s.data === diaSel);

  if (mostrarPerfil) {
    return (
      <FormPerfil
        pacienteId={pacienteId}
        perfil={perfil}
        onSalvo={async () => { setMostrarPerfil(false); await carregar(); }}
        onCancelar={() => setMostrarPerfil(false)}
      />
    );
  }

  if (diaSintoma) {
    const existente = sintomas.find(s => s.data === diaSintoma);
    return (
      <FormSintomas
        dia={diaSintoma}
        existente={existente}
        periodos={periodos}
        situacaoCiclo={situacaoCiclo}
        estadoReprodutivo={estadoReprodutivo}
        onSalvo={async () => { setDiaSintoma(null); await carregar(); }}
        onCancelar={() => setDiaSintoma(null)}
      />
    );
  }

  return (
    <div>
      {/* banner de perfil (se não configurado) */}
      {!perfil && (
        <button onClick={() => setMostrarPerfil(true)}
          style={{
            width: '100%', margin: '0 0 8px', padding: '11px 16px',
            background: 'var(--gold-soft, #fffbeb)',
            border: '0.5px solid var(--gold-deep)',
            borderRadius: 0, cursor: 'pointer', textAlign: 'left',
            fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
          <i className="ti ti-sparkles" style={{ fontSize: 16, color: 'var(--gold-deep)', flexShrink: 0 }} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gold-deep)' }}>Configure seu perfil hormonal</div>
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>Análises mais precisas para sua situação</div>
          </div>
          <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--muted)' }} aria-hidden="true" />
        </button>
      )}

      {/* tabs */}
      <div style={{
        display: 'flex', gap: 2, padding: '0 16px 12px',
        background: 'var(--bg)',
      }}>
        {[
          { id: 'calendario', label: 'Calendário', icon: 'calendar' },
          { id: 'hoje',       label: 'Hoje',       icon: 'clipboard-list' },
          { id: 'registros',  label: 'Registros',  icon: 'chart-bar' },
        ].map(t => (
          <button key={t.id} onClick={() => setAba(t.id)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 10, cursor: 'pointer',
              background: aba === t.id ? 'var(--paper)' : 'transparent',
              border: aba === t.id ? '0.5px solid var(--hair)' : '0.5px solid transparent',
              color: aba === t.id ? 'var(--ink)' : 'var(--muted)',
              fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
            }}>
            <i className={`ti ti-${t.icon}`} style={{ fontSize: 14 }} aria-hidden="true" />
            {t.label}
          </button>
        ))}
      </div>

      {aba === 'calendario' && (
        <>
          <Calendario
            periodos={periodos}
            sintomas={sintomas}
            onDiaTocado={handleDiaTocado}
            situacaoCiclo={situacaoCiclo}
          />
          {/* atalho para editar perfil */}
          <div style={{ padding: '8px 16px' }}>
            <button onClick={() => setMostrarPerfil(true)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 11, color: 'var(--muted)', fontFamily: 'var(--font-sans)',
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
              <i className="ti ti-settings" style={{ fontSize: 13 }} aria-hidden="true" />
              {perfil ? 'Editar perfil hormonal' : 'Configurar perfil hormonal'}
            </button>
          </div>
        </>
      )}
      {aba === 'hoje' && (
        <FormSintomas
          dia={isoHoje()}
          existente={sintomas.find(s => s.data === isoHoje())}
          periodos={periodos}
          situacaoCiclo={situacaoCiclo}
          onSalvo={carregar}
          onCancelar={() => setAba('calendario')}
        />
      )}
      {aba === 'registros' && (
        <Registros periodos={periodos} sintomas={sintomas} />
      )}

      {/* modal de dia */}
      {diaSel && (
        <ModalDia
          dia={diaSel}
          periodos={periodos}
          sintomaDia={sintomaDiaSel}
          onFechar={() => setDiaSel(null)}
          onSalvarPeriodo={handleSalvarPeriodo}
          onAbrirSintomas={handleAbrirSintomas}
          pacienteId={pacienteId}
          podeMarcarMenstruacao={podeMarcarMenstruacao}
        />
      )}
    </div>
  );
}
