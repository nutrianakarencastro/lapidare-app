import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import {
  BRISTOL_LABELS, GATILHOS_OPCOES, COR_FEZES_OPCOES, CHEIRO_FEZES_OPCOES,
  SENSACAO_APOS_OPCOES, MOMENTO_ESTUFAMENTO_OPCOES,
  LOCALIZACAO_DOR_OPCOES, RELACAO_CICLO_OPCOES,
  bristolMaisFrequente, mediaEvacuacoesPorSemana, detectarSinaisAtencao,
} from '../../lib/intestinoUtils.js';

const DISCLAIMER = 'Este registro é uma ferramenta de acompanhamento funcional e não substitui avaliação médica.';

const hoje = () => new Date().toISOString().slice(0, 10);

// ─── SVG Bristol ─────────────────────────────────────────────────────────────

function BristolSVG({ tipo, size = 38 }) {
  const verde  = '#7ea85a';
  const ambar  = '#c4a882';
  const rosa   = '#c4616e';
  const cor    = (tipo === 4 || tipo === 5) ? verde : (tipo <= 2 || tipo === 7) ? rosa : ambar;

  const conteudo = {
    1: (
      <g>
        {[[9,10],[21,10],[9,22],[21,22],[15,16]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={4} fill={cor} />
        ))}
      </g>
    ),
    2: (
      <g>
        <ellipse cx={15} cy={16} rx={11} ry={6} fill={cor} />
        <circle cx={8} cy={14} r={4} fill={cor} />
        <circle cx={22} cy={18} r={3} fill={cor} />
      </g>
    ),
    3: (
      <g>
        <rect x={5} y={12} width={20} height={8} rx={4} fill={cor} />
        {[9, 14, 19].map(x => (
          <line key={x} x1={x} y1={12} x2={x - 1} y2={20} stroke="white" strokeWidth={1.5} />
        ))}
      </g>
    ),
    4: (
      <rect x={4} y={13} width={22} height={6} rx={3} fill={cor} />
    ),
    5: (
      <g>
        {[[7,13,5],[16,15,5],[22,12,4]].map(([cx, cy, r], i) => (
          <ellipse key={i} cx={cx} cy={cy} rx={r} ry={r - 1} fill={cor} />
        ))}
      </g>
    ),
    6: (
      <g>
        {[[8,12,4],[17,16,5],[12,22,3],[22,21,4]].map(([cx, cy, r], i) => (
          <circle key={i} cx={cx} cy={cy} r={r} fill={cor} opacity={0.85} />
        ))}
      </g>
    ),
    7: (
      <path d="M4,16 Q8,10 15,13 Q22,10 26,16 Q22,22 15,19 Q8,22 4,16Z" fill={cor} opacity={0.75} />
    ),
  };

  return (
    <svg viewBox="0 0 30 30" width={size} height={size} aria-hidden="true">
      {conteudo[tipo] ?? null}
    </svg>
  );
}

// ─── Escala de Bristol ───────────────────────────────────────────────────────

function EscalaBristol({ value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {[1, 2, 3, 4, 5, 6, 7].map(tipo => {
        const info = BRISTOL_LABELS[tipo];
        const sel  = value === tipo;
        const ideal = tipo === 4 || tipo === 5;
        return (
          <button
            key={tipo}
            onClick={() => onChange(tipo)}
            style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 14px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: sel ? (ideal ? '#eef5e3' : '#fdedef') : 'var(--bg2)',
              outline: sel ? `2px solid ${ideal ? '#7ea85a' : '#c4616e'}` : 'none',
              textAlign: 'left', width: '100%', fontFamily: 'var(--font-sans)',
            }}
          >
            <BristolSVG tipo={tipo} size={38} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)', display: 'flex', alignItems: 'center', gap: 6 }}>
                {info.label}
                {info.ideal && <span style={{ fontSize: 10, color: '#7ea85a', fontWeight: 700, background: '#eef5e3', padding: '2px 6px', borderRadius: 99 }}>ideal</span>}
                {info.aceitavel && <span style={{ fontSize: 10, color: '#7ea85a', background: '#eef5e3', padding: '2px 6px', borderRadius: 99 }}>bom</span>}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{info.desc}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Seletor de escala 0-3 ───────────────────────────────────────────────────

function Escala03({ value, onChange, labels = ['Nenhum', 'Leve', 'Moderado', 'Forte'] }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[0, 1, 2, 3].map(v => (
        <button
          key={v}
          onClick={() => onChange(v)}
          style={{
            flex: 1, padding: '10px 4px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 500, fontFamily: 'var(--font-sans)',
            background: value === v ? 'var(--dark)' : 'var(--bg2)',
            color: value === v ? 'white' : 'var(--text3)',
          }}
        >
          {labels[v]}
        </button>
      ))}
    </div>
  );
}

// ─── Seletor Sim/Não ─────────────────────────────────────────────────────────

function SimNao({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[true, false].map(v => (
        <button
          key={String(v)}
          onClick={() => onChange(v)}
          style={{
            flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-sans)',
            background: value === v ? 'var(--dark)' : 'var(--bg2)',
            color: value === v ? 'white' : 'var(--text3)',
          }}
        >
          {v ? 'Sim' : 'Não'}
        </button>
      ))}
    </div>
  );
}

// ─── Chips de seleção múltipla ───────────────────────────────────────────────

function Chips({ opcoes, value = [], onChange }) {
  function toggle(op) {
    const atual = value ?? [];
    onChange(atual.includes(op) ? atual.filter(x => x !== op) : [...atual, op]);
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {opcoes.map(op => {
        const sel = (value ?? []).includes(op);
        return (
          <button
            key={op}
            onClick={() => toggle(op)}
            style={{
              padding: '7px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: sel ? 600 : 400,
              background: sel ? 'var(--dark)' : 'var(--bg2)',
              color: sel ? 'white' : 'var(--text3)',
            }}
          >
            {op}
          </button>
        );
      })}
    </div>
  );
}

// ─── Chips de seleção única ──────────────────────────────────────────────────

function ChipsSingle({ opcoes, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {opcoes.map(op => {
        const sel = value === op;
        return (
          <button
            key={op}
            onClick={() => onChange(sel ? null : op)}
            style={{
              padding: '7px 12px', borderRadius: 99, border: 'none', cursor: 'pointer',
              fontSize: 13, fontFamily: 'var(--font-sans)', fontWeight: sel ? 600 : 400,
              background: sel ? 'var(--dark)' : 'var(--bg2)',
              color: sel ? 'white' : 'var(--text3)',
            }}
          >
            {op}
          </button>
        );
      })}
    </div>
  );
}

// ─── Sheet: Registro Diário ───────────────────────────────────────────────────

const FORM_DIARIO_VAZIO = {
  evacuou: null, frequencia_dia: null, bristol: null,
  gases: null, estufamento: null, dor_abdominal: null,
  esforco: null, urgencia: null, esvaziamento_incompleto: null,
  muco: null, gatilhos: [],
};

function SheetDiario({ inicial, onSalvar, onFechar, salvando }) {
  const [form, setForm] = useState({ ...FORM_DIARIO_VAZIO, ...inicial });

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  const podeEnviar = form.evacuou !== null;

  return (
    <div className="sheet-backdrop" onClick={onFechar}>
      <div className="sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        <div className="serif" style={{ fontSize: 20, marginBottom: 4 }}>Registro do dia</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          Como seu intestino se comportou hoje?
        </div>

        {/* Evacuou */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Você evacuou hoje?</div>
          <SimNao value={form.evacuou} onChange={v => set('evacuou', v)} />
        </div>

        {form.evacuou && (
          <>
            {/* Frequência */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Quantas vezes?</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map(v => (
                  <button
                    key={v}
                    onClick={() => set('frequencia_dia', v)}
                    style={{
                      flex: 1, padding: '10px', borderRadius: 10, border: 'none', cursor: 'pointer',
                      fontSize: 14, fontWeight: 500, fontFamily: 'var(--font-sans)',
                      background: form.frequencia_dia === v ? 'var(--dark)' : 'var(--bg2)',
                      color: form.frequencia_dia === v ? 'white' : 'var(--text3)',
                    }}
                  >
                    {v === 3 ? '3+' : v}×
                  </button>
                ))}
              </div>
            </div>

            {/* Bristol */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 10 }}>Como foram as fezes?</div>
              <EscalaBristol value={form.bristol} onChange={v => set('bristol', v)} />
            </div>
          </>
        )}

        {/* Estufamento */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Inchaço / estufamento</div>
          <Escala03 value={form.estufamento} onChange={v => set('estufamento', v)} />
        </div>

        {/* Gases */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Gases</div>
          <Escala03 value={form.gases} onChange={v => set('gases', v)} />
        </div>

        {/* Dor abdominal */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Dor abdominal</div>
          <Escala03 value={form.dor_abdominal} onChange={v => set('dor_abdominal', v)} />
        </div>

        {/* Esforço */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Precisou fazer força para evacuar?</div>
          <SimNao value={form.esforco} onChange={v => set('esforco', v)} />
        </div>

        {/* Urgência */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Sentiu urgência (precisou ir correndo ao banheiro)?</div>
          <SimNao value={form.urgencia} onChange={v => set('urgencia', v)} />
        </div>

        {/* Esvaziamento incompleto */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Ficou a sensação de que não saiu tudo?</div>
          <SimNao value={form.esvaziamento_incompleto} onChange={v => set('esvaziamento_incompleto', v)} />
        </div>

        {/* Muco */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Percebeu muco (catarro) nas fezes?</div>
          <SimNao value={form.muco} onChange={v => set('muco', v)} />
        </div>

        {/* Gatilhos */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Percebeu algum gatilho hoje?</div>
          <Chips opcoes={GATILHOS_OPCOES} value={form.gatilhos} onChange={v => set('gatilhos', v)} />
        </div>

        <button
          onClick={() => onSalvar(form)}
          disabled={!podeEnviar || salvando}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: podeEnviar ? 'pointer' : 'not-allowed',
            fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)',
            background: podeEnviar ? 'var(--dark)' : 'var(--bg3)',
            color: podeEnviar ? 'white' : 'var(--text4)',
          }}
        >
          {salvando ? 'Salvando…' : 'Salvar registro'}
        </button>
      </div>
    </div>
  );
}

// ─── Sheet: Rastreio Aprofundado ──────────────────────────────────────────────

const FORM_RASTREIO_VAZIO = {
  cor_fezes: null, cheiro_fezes: null, momento_estufamento: null,
  localizacao_dor: null, sensacao_apos_evacuar: null,
  relacao_refeicoes: null, relacao_ciclo: null, observacoes: '',
};

function SheetRastreio({ onSalvar, onFechar, salvando }) {
  const [form, setForm] = useState(FORM_RASTREIO_VAZIO);

  function set(campo, valor) {
    setForm(f => ({ ...f, [campo]: valor }));
  }

  return (
    <div className="sheet-backdrop" onClick={onFechar}>
      <div className="sheet" style={{ maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
        <div className="grabber" />
        <div className="serif" style={{ fontSize: 20, marginBottom: 4 }}>Rastreio intestinal</div>
        <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
          Sua nutricionista pediu este rastreio. Responda com calma — não precisa fazer tudo de uma vez.
        </div>

        {/* Cor das fezes */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Cor das fezes (nos últimos dias)</div>
          <ChipsSingle opcoes={COR_FEZES_OPCOES} value={form.cor_fezes} onChange={v => set('cor_fezes', v)} />
        </div>

        {/* Cheiro */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Cheiro das fezes</div>
          <ChipsSingle opcoes={CHEIRO_FEZES_OPCOES} value={form.cheiro_fezes} onChange={v => set('cheiro_fezes', v)} />
        </div>

        {/* Momento do estufamento */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Quando você costuma sentir mais inchaço?</div>
          <ChipsSingle opcoes={MOMENTO_ESTUFAMENTO_OPCOES} value={form.momento_estufamento} onChange={v => set('momento_estufamento', v)} />
        </div>

        {/* Localização da dor */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Onde você sente desconforto ou dor abdominal?</div>
          <ChipsSingle opcoes={LOCALIZACAO_DOR_OPCOES} value={form.localizacao_dor} onChange={v => set('localizacao_dor', v)} />
        </div>

        {/* Sensação após evacuar */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Depois de evacuar, como você se sente?</div>
          <ChipsSingle opcoes={SENSACAO_APOS_OPCOES} value={form.sensacao_apos_evacuar} onChange={v => set('sensacao_apos_evacuar', v)} />
        </div>

        {/* Relação com refeições */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Os sintomas têm relação com as refeições?</div>
          <ChipsSingle
            opcoes={['Sim, piora logo após comer', 'Sim, piora horas depois', 'Piora com certos alimentos', 'Não percebo relação']}
            value={form.relacao_refeicoes}
            onChange={v => set('relacao_refeicoes', v)}
          />
        </div>

        {/* Relação com ciclo */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Tem relação com o ciclo menstrual ou fase hormonal?</div>
          <ChipsSingle opcoes={RELACAO_CICLO_OPCOES} value={form.relacao_ciclo} onChange={v => set('relacao_ciclo', v)} />
        </div>

        {/* Observações livres */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)', marginBottom: 8 }}>Algo mais que queira registrar?</div>
          <textarea
            value={form.observacoes}
            onChange={e => set('observacoes', e.target.value)}
            placeholder="Observações, padrões que percebeu, dúvidas…"
            rows={3}
            style={{
              width: '100%', borderRadius: 10, border: '1px solid var(--border)',
              padding: '10px 12px', fontSize: 13, fontFamily: 'var(--font-sans)',
              resize: 'none', background: 'var(--bg2)', color: 'var(--dark)',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <button
          onClick={() => onSalvar(form)}
          disabled={salvando}
          style={{
            width: '100%', padding: '14px', borderRadius: 12, border: 'none', cursor: 'pointer',
            fontSize: 15, fontWeight: 600, fontFamily: 'var(--font-sans)',
            background: 'var(--dark)', color: 'white',
          }}
        >
          {salvando ? 'Enviando…' : 'Enviar rastreio'}
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function Intestino() {
  const { user, profile } = useSession();
  const pacienteId = profile?.id;
  const [logs, setLogs] = useState(null);
  const [logHoje, setLogHoje] = useState(null);
  const [solicitacaoPendente, setSolicitacaoPendente] = useState(null);
  const [sheet, setSheet] = useState(null); // 'diario' | 'rastreio' | null
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  const dataInicio30 = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  })();

  const carregar = useCallback(async () => {
    if (!user?.id) return;
    const [logsRes, solRes] = await Promise.all([
      supabase.from('intestino_logs')
        .select('*')
        .eq('paciente_id', pacienteId)
        .gte('data', dataInicio30)
        .order('data', { ascending: false }),
      supabase.from('intestino_rastreio_solicitacoes')
        .select('*')
        .eq('paciente_id', pacienteId)
        .is('respondido_em', null)
        .order('solicitado_em', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const todosLogs = logsRes.data ?? [];
    setLogs(todosLogs);
    setLogHoje(todosLogs.find(l => l.data === hoje() && l.tipo === 'diario') ?? null);
    setSolicitacaoPendente(solRes.data ?? null);
  }, [user?.id]);

  useEffect(() => { carregar(); }, [carregar]);

  async function salvarDiario(form) {
    setSalvando(true);
    const payload = {
      paciente_id: pacienteId,
      data: hoje(),
      tipo: 'diario',
      ...form,
    };
    const { error } = logHoje
      ? await supabase.from('intestino_logs').update(payload).eq('id', logHoje.id)
      : await supabase.from('intestino_logs').upsert(payload, { onConflict: 'paciente_id,data,tipo' });

    setSalvando(false);
    if (error) { setAviso('Erro ao salvar. Tente novamente.'); return; }
    setSheet(null);
    await carregar();
    setAviso('Registro salvo!');
    setTimeout(() => setAviso(null), 2500);
  }

  async function salvarRastreio(form) {
    if (!solicitacaoPendente) return;
    setSalvando(true);
    const payload = {
      paciente_id: pacienteId,
      data: hoje(),
      tipo: 'rastreio',
      ...form,
    };
    const [, atualRes] = await Promise.all([
      supabase.from('intestino_logs').upsert(payload, { onConflict: 'paciente_id,data,tipo' }),
      supabase.from('intestino_rastreio_solicitacoes')
        .update({ respondido_em: new Date().toISOString() })
        .eq('id', solicitacaoPendente.id),
    ]);
    setSalvando(false);
    setSheet(null);
    await carregar();
    setAviso('Rastreio enviado!');
    setTimeout(() => setAviso(null), 2500);
  }

  // ── Estados de carregamento ──────────────────────────────────────────────

  if (logs === null) {
    return (
      <div className="card empty-card" style={{ marginTop: 8 }}>
        <div className="empty-sub">Carregando…</div>
      </div>
    );
  }

  // ── Resumo 30 dias ───────────────────────────────────────────────────────

  const diarios = logs.filter(l => l.tipo === 'diario');
  const bristolFreq = bristolMaisFrequente(diarios);
  const mediaEvac = mediaEvacuacoesPorSemana(diarios);
  const sinais = detectarSinaisAtencao(logs);
  const sinaisVisiveis = sinais.filter(s => s.nivel === 'atencao');

  return (
    <div style={{ paddingBottom: 32 }}>

      {/* Aviso toast */}
      {aviso && (
        <div style={{
          position: 'fixed', top: 20, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--dark)', color: 'white', padding: '10px 20px',
          borderRadius: 99, fontSize: 14, fontWeight: 500, zIndex: 9999,
          fontFamily: 'var(--font-sans)', boxShadow: '0 4px 16px rgba(0,0,0,.2)',
        }}>
          {aviso}
        </div>
      )}

      {/* Banner: rastreio solicitado pela nutri */}
      {solicitacaoPendente && (
        <div style={{
          background: '#eef5e3', border: '1.5px solid #7ea85a',
          borderRadius: 14, padding: '14px 16px', marginBottom: 16,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <i className="ti ti-clipboard-list" style={{ fontSize: 20, color: '#7ea85a', marginTop: 1 }} aria-hidden="true" />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#3d6b27', marginBottom: 4 }}>
              Sua nutricionista pediu um rastreio intestinal
            </div>
            <div style={{ fontSize: 13, color: '#4a7a30', marginBottom: 10, lineHeight: 1.5 }}>
              São algumas perguntas sobre seu padrão intestinal. Leva cerca de 3 minutos.
            </div>
            <button
              onClick={() => setSheet('rastreio')}
              style={{
                padding: '9px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-sans)',
                background: '#7ea85a', color: 'white',
              }}
            >
              Responder rastreio
            </button>
          </div>
        </div>
      )}

      {/* Botão principal: registro do dia */}
      <button
        onClick={() => setSheet('diario')}
        style={{
          width: '100%', padding: '16px', borderRadius: 14, border: 'none', cursor: 'pointer',
          background: logHoje ? 'var(--bg2)' : 'var(--dark)', color: logHoje ? 'var(--dark)' : 'white',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          fontFamily: 'var(--font-sans)', marginBottom: 20,
          boxShadow: '0 2px 8px rgba(0,0,0,.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, flexShrink: 0,
            background: logHoje ? '#eef5e3' : 'rgba(255,255,255,.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <i className="ti ti-pencil-check" style={{ fontSize: 20, color: logHoje ? '#7ea85a' : 'white' }} aria-hidden="true" />
          </div>
          <div style={{ textAlign: 'left' }}>
            <div style={{ fontSize: 15, fontWeight: 600 }}>
              {logHoje ? 'Editar registro de hoje' : 'Registrar hoje'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
              {logHoje ? 'Já registrado ✓' : 'Como seu intestino se comportou?'}
            </div>
          </div>
        </div>
        <i className="ti ti-chevron-right" style={{ opacity: 0.6 }} aria-hidden="true" />
      </button>

      {/* Resumo: sem dados */}
      {!diarios.length && (
        <div className="card empty-card">
          <i className="ti ti-leaf" style={{ fontSize: 32, color: 'var(--text4)', display: 'block', marginBottom: 10 }} aria-hidden="true" />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)', marginBottom: 6 }}>
            Comece registrando hoje
          </div>
          <div className="empty-sub" style={{ fontSize: 13 }}>
            Com alguns dias de registro você vai ver seu padrão intestinal aqui.
          </div>
        </div>
      )}

      {/* Resumo 30 dias */}
      {diarios.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 10 }}>Últimos 30 dias</div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div className="card" style={{ padding: '14px 16px', borderRadius: 12 }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--dark)' }}>{diarios.length}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>dias registrados</div>
            </div>
            {mediaEvac !== null && (
              <div className="card" style={{ padding: '14px 16px', borderRadius: 12 }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--dark)' }}>{mediaEvac}×</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>evacuações / semana</div>
              </div>
            )}
          </div>

          {bristolFreq && (
            <div style={{
              background: 'var(--bg2)', borderRadius: 12, padding: '14px 16px',
              marginBottom: 16, display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <BristolSVG tipo={bristolFreq} size={44} />
              <div>
                <div style={{ fontSize: 13, color: 'var(--text3)' }}>Padrão mais comum</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)', marginTop: 2 }}>
                  {BRISTOL_LABELS[bristolFreq].label}
                  {(bristolFreq === 4 || bristolFreq === 5) && (
                    <span style={{ marginLeft: 8, fontSize: 11, color: '#7ea85a', fontWeight: 700 }}>ótimo</span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Sinais de atenção — apenas para a paciente ver em linguagem simples */}
          {sinaisVisiveis.length > 0 && (
            <div style={{
              background: '#fdedef', borderRadius: 12, padding: '14px 16px',
              marginBottom: 16, border: '1px solid #f0c0c8',
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#b04060', marginBottom: 8 }}>
                Pontos para conversar com sua nutri
              </div>
              {sinaisVisiveis.map(s => (
                <div key={s.id} style={{ fontSize: 13, color: '#b04060', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <i className="ti ti-point-filled" style={{ fontSize: 8 }} aria-hidden="true" />
                  {s.label} — {s.count} {s.count === 1 ? 'vez' : 'vezes'} nos últimos 30 dias
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Disclaimer */}
      <div style={{
        padding: '12px 14px', borderRadius: 10, marginTop: 4,
        background: 'var(--bg2)', border: '0.5px solid var(--border)',
        fontSize: 11, color: 'var(--text3)', lineHeight: 1.6,
        display: 'flex', gap: 8, alignItems: 'flex-start',
      }}>
        <i className="ti ti-info-circle" style={{ fontSize: 14, color: 'var(--text4)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
        {DISCLAIMER}
      </div>

      {/* Sheets */}
      {sheet === 'diario' && (
        <SheetDiario
          inicial={logHoje ?? {}}
          onSalvar={salvarDiario}
          onFechar={() => setSheet(null)}
          salvando={salvando}
        />
      )}
      {sheet === 'rastreio' && (
        <SheetRastreio
          onSalvar={salvarRastreio}
          onFechar={() => setSheet(null)}
          salvando={salvando}
        />
      )}
    </div>
  );
}
