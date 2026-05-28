import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';

function dataBR(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function novoForm() {
  return {
    ultima_menstruacao: '',
    inicio_sangramento: '',
    fim_sangramento: '',
    intensidade_fluxo: '',
    status_ciclo: '',
    anticoncepcional: false,
    diu: false,
    reposicao_hormonal: false,
    tentando_engravidar: false,
    colica: 0,
    coagulos: false,
    escape: false,
    muco_cervical: '',
    dor_mamas: 0,
    acne: 0,
    inchaco: 0,
    dor_cabeca: false,
    compulsao_doces: 0,
    intestino: '',
    ondas_calor: false,
    suor_noturno: false,
    secura_vaginal: false,
    humor: 0,
    ansiedade: 0,
    irritabilidade: 0,
    sono: 0,
    energia: 0,
    libido: 0,
    observacoes: '',
  };
}

const INTENSIDADE = [
  { v: 'leve',        label: 'Leve' },
  { v: 'moderado',    label: 'Moderado' },
  { v: 'intenso',     label: 'Intenso' },
  { v: 'muito_intenso', label: 'Muito intenso' },
];

const STATUS_CICLO = [
  { v: 'regular',       label: 'Regular' },
  { v: 'irregular',     label: 'Irregular' },
  { v: 'amenorreia',    label: 'Amenorreia' },
  { v: 'perimenopausa', label: 'Perimenopausa' },
  { v: 'menopausa',     label: 'Menopausa' },
];

const MUCO = [
  { v: 'ausente',  label: 'Ausente' },
  { v: 'seco',     label: 'Seco' },
  { v: 'cremoso',  label: 'Cremoso' },
  { v: 'aquoso',   label: 'Aquoso' },
  { v: 'elastico', label: 'Elástico' },
];

const INTESTINO = [
  { v: 'normal',   label: 'Normal' },
  { v: 'preso',    label: 'Preso' },
  { v: 'solto',    label: 'Solto' },
  { v: 'alternado', label: 'Alternado' },
];

const ESCALA3 = ['Sem', 'Leve', 'Moderada', 'Forte'];
const ESCALA5_HUMOR    = ['😞', '😕', '😐', '🙂', '😄'];
const ESCALA5_ENERGIA  = ['😴', '🥱', '😐', '⚡', '🚀'];
const ESCALA5_SONO     = ['😫', '😕', '😐', '😴', '🌙'];
const ESCALA5_LIBIDO   = ['Sem', 'Baixa', 'Média', 'Alta', 'Muito alta'];

// ── Componentes de controle ─────────────────────────────────────────────────

function BotaoToggle({ ativo, onClick, label, icon }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '8px 12px', borderRadius: 10,
        background: ativo ? 'var(--ink)' : 'var(--bg-soft)',
        color: ativo ? 'var(--bg-soft)' : 'var(--muted)',
        border: `0.5px solid ${ativo ? 'var(--ink)' : 'var(--hair)'}`,
        fontSize: 12, fontWeight: 500, cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'all .15s ease',
      }}>
      {icon && <i className={`ti ti-${icon}`} style={{ fontSize: 13 }} aria-hidden="true"></i>}
      {label}
      {ativo && <i className="ti ti-check" style={{ fontSize: 11, opacity: .8 }} aria-hidden="true"></i>}
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
              padding: '8px 6px', borderRadius: 9,
              background: ativo ? 'var(--gold-soft)' : 'var(--bg-soft)',
              color: ativo ? 'var(--ink)' : 'var(--muted)',
              border: `0.5px solid ${ativo ? 'var(--gold-deep)' : 'var(--hair)'}`,
              fontSize: 12, fontWeight: ativo ? 600 : 400, cursor: 'pointer',
              fontFamily: 'var(--font-sans)',
              transition: 'all .15s ease',
            }}>
            {op.label}
          </button>
        );
      })}
    </div>
  );
}

function Escala3({ valor, onChange, labels = ESCALA3 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 5 }}>
      {labels.map((l, i) => {
        const ativo = valor === i;
        return (
          <button key={i} onClick={() => onChange(ativo ? 0 : i)}
            style={{
              padding: '7px 4px', borderRadius: 8,
              background: ativo ? 'var(--ink)' : 'var(--bg-soft)',
              color: ativo ? 'var(--bg-soft)' : 'var(--muted)',
              border: `0.5px solid ${ativo ? 'var(--ink)' : 'var(--hair)'}`,
              fontSize: 11, fontWeight: ativo ? 600 : 400, cursor: 'pointer',
              fontFamily: 'var(--font-sans)', transition: 'all .15s ease',
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
        return (
          <button key={v} onClick={() => onChange(ativo ? 0 : v)}
            style={{
              flex: 1, padding: '8px 4px', borderRadius: 9,
              background: ativo ? 'var(--gold-soft)' : 'var(--bg-soft)',
              border: `0.5px solid ${ativo ? 'var(--gold-deep)' : 'var(--hair)'}`,
              fontSize: emojis[0].length > 2 ? 11 : 18,
              cursor: 'pointer', transition: 'all .15s ease',
              fontFamily: 'var(--font-sans)',
              color: ativo ? 'var(--ink)' : 'var(--muted)',
              fontWeight: ativo ? 600 : 400,
            }}>
            {e}
          </button>
        );
      })}
    </div>
  );
}

function SectionLabel({ children }) {
  return (
    <div style={{
      fontSize: 9, letterSpacing: '.2em', textTransform: 'uppercase',
      color: 'var(--gold-deep)', fontWeight: 600,
      margin: '18px 0 10px', display: 'flex', alignItems: 'center', gap: 7,
    }}>
      <div style={{ flex: 1, height: '0.5px', background: 'var(--hair)' }} />
      {children}
      <div style={{ flex: 1, height: '0.5px', background: 'var(--hair)' }} />
    </div>
  );
}

function FieldLabel({ children }) {
  return (
    <div style={{
      fontSize: 11, color: 'var(--ink-soft)', fontWeight: 500,
      marginBottom: 6, marginTop: 12,
    }}>
      {children}
    </div>
  );
}

// ── Formulário ───────────────────────────────────────────────────────────────

function FormRegistro({ form, setF, busy, feedback, onSalvar, onCancelar }) {
  const toggle = (k) => setF(f => ({ ...f, [k]: !f[k] }));
  const setV   = (k, v) => setF(f => ({ ...f, [k]: v }));

  return (
    <div style={{
      background: 'var(--paper)', border: '0.5px solid var(--hair)',
      borderRadius: 16, padding: '16px 16px 20px', marginBottom: 14,
      boxShadow: '0 2px 12px rgba(28,23,18,.05)',
    }}>
      {/* ── Ciclo ── */}
      <SectionLabel>Ciclo</SectionLabel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          <FieldLabel>Última menstruação</FieldLabel>
          <input
            type="date"
            value={form.ultima_menstruacao}
            onChange={e => setV('ultima_menstruacao', e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <FieldLabel>Início do sangramento</FieldLabel>
          <input
            type="date"
            value={form.inicio_sangramento}
            onChange={e => setV('inicio_sangramento', e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <FieldLabel>Fim do sangramento</FieldLabel>
          <input
            type="date"
            value={form.fim_sangramento}
            onChange={e => setV('fim_sangramento', e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      <FieldLabel>Intensidade do fluxo</FieldLabel>
      <GrupoOpcoes
        valor={form.intensidade_fluxo}
        opcoes={INTENSIDADE}
        onChange={v => setV('intensidade_fluxo', v)}
        cols={4}
      />

      <FieldLabel>Status do ciclo</FieldLabel>
      <GrupoOpcoes
        valor={form.status_ciclo}
        opcoes={STATUS_CICLO}
        onChange={v => setV('status_ciclo', v)}
        cols={3}
      />

      {/* ── Contexto hormonal ── */}
      <SectionLabel>Contexto hormonal</SectionLabel>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <BotaoToggle ativo={form.anticoncepcional} onClick={() => toggle('anticoncepcional')} label="Anticoncepcional" icon="pill" />
        <BotaoToggle ativo={form.diu} onClick={() => toggle('diu')} label="DIU" icon="circle-dot" />
        <BotaoToggle ativo={form.reposicao_hormonal} onClick={() => toggle('reposicao_hormonal')} label="Reposição hormonal" icon="heart-rate-monitor" />
        <BotaoToggle ativo={form.tentando_engravidar} onClick={() => toggle('tentando_engravidar')} label="Tentando engravidar" icon="baby-carriage" />
      </div>

      {/* ── Sintomas físicos ── */}
      <SectionLabel>Sintomas físicos</SectionLabel>

      <FieldLabel>Cólica</FieldLabel>
      <Escala3 valor={form.colica} onChange={v => setV('colica', v)} />

      <FieldLabel>Dor nas mamas</FieldLabel>
      <Escala3 valor={form.dor_mamas} onChange={v => setV('dor_mamas', v)} />

      <FieldLabel>Acne</FieldLabel>
      <Escala3 valor={form.acne} onChange={v => setV('acne', v)} />

      <FieldLabel>Inchaço</FieldLabel>
      <Escala3 valor={form.inchaco} onChange={v => setV('inchaco', v)} />

      <FieldLabel>Compulsão por doces</FieldLabel>
      <Escala3 valor={form.compulsao_doces} onChange={v => setV('compulsao_doces', v)} />

      <FieldLabel>Muco cervical</FieldLabel>
      <GrupoOpcoes
        valor={form.muco_cervical}
        opcoes={MUCO}
        onChange={v => setV('muco_cervical', v)}
        cols={5}
      />

      <FieldLabel>Intestino</FieldLabel>
      <GrupoOpcoes
        valor={form.intestino}
        opcoes={INTESTINO}
        onChange={v => setV('intestino', v)}
        cols={4}
      />

      <div style={{ marginTop: 12 }}>
        <FieldLabel>Outros sintomas</FieldLabel>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <BotaoToggle ativo={form.coagulos}     onClick={() => toggle('coagulos')}     label="Coágulos"      icon="droplet" />
          <BotaoToggle ativo={form.escape}       onClick={() => toggle('escape')}       label="Escape"        icon="wave-saw-tool" />
          <BotaoToggle ativo={form.dor_cabeca}   onClick={() => toggle('dor_cabeca')}   label="Dor de cabeça" icon="brain" />
          <BotaoToggle ativo={form.ondas_calor}  onClick={() => toggle('ondas_calor')}  label="Ondas de calor" icon="flame" />
          <BotaoToggle ativo={form.suor_noturno} onClick={() => toggle('suor_noturno')} label="Suor noturno"  icon="moon" />
          <BotaoToggle ativo={form.secura_vaginal} onClick={() => toggle('secura_vaginal')} label="Secura vaginal" icon="droplet-off" />
        </div>
      </div>

      {/* ── Bem-estar ── */}
      <SectionLabel>Bem-estar</SectionLabel>

      <FieldLabel>Humor</FieldLabel>
      <Escala5 valor={form.humor} onChange={v => setV('humor', v)} emojis={ESCALA5_HUMOR} />

      <FieldLabel>Energia</FieldLabel>
      <Escala5 valor={form.energia} onChange={v => setV('energia', v)} emojis={ESCALA5_ENERGIA} />

      <FieldLabel>Sono</FieldLabel>
      <Escala5 valor={form.sono} onChange={v => setV('sono', v)} emojis={ESCALA5_SONO} />

      <FieldLabel>Ansiedade</FieldLabel>
      <Escala3 valor={form.ansiedade} onChange={v => setV('ansiedade', v)} />

      <FieldLabel>Irritabilidade</FieldLabel>
      <Escala3 valor={form.irritabilidade} onChange={v => setV('irritabilidade', v)} />

      <FieldLabel>Libido</FieldLabel>
      <Escala5 valor={form.libido} onChange={v => setV('libido', v)} emojis={ESCALA5_LIBIDO} />

      {/* ── Observações ── */}
      <SectionLabel>Observações</SectionLabel>
      <textarea
        value={form.observacoes}
        onChange={e => setF(f => ({ ...f, observacoes: e.target.value }))}
        placeholder="Anote algo relevante sobre este período — qualquer detalhe que queira compartilhar com sua nutri..."
        rows={3}
        style={{
          ...inputStyle,
          resize: 'vertical',
          minHeight: 72,
          lineHeight: 1.5,
        }}
      />

      {feedback && (
        <div style={{
          marginTop: 12, padding: '9px 12px', borderRadius: 9, fontSize: 12,
          background: feedback.tipo === 'ok' ? 'var(--green-soft)' : 'var(--red-soft)',
          color: feedback.tipo === 'ok' ? 'var(--green)' : 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`} aria-hidden="true"></i>
          {feedback.msg}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <button
          onClick={onCancelar}
          style={{
            flex: 1, padding: '11px 0', borderRadius: 11,
            background: 'var(--bg-soft)', color: 'var(--muted)',
            border: '0.5px solid var(--hair)', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}>
          Cancelar
        </button>
        <button
          onClick={onSalvar}
          disabled={busy}
          style={{
            flex: 2, padding: '11px 0', borderRadius: 11,
            background: busy ? 'var(--muted-2)' : 'var(--ink)',
            color: 'var(--bg-soft)', border: 'none',
            fontSize: 13, fontWeight: 500, cursor: busy ? 'default' : 'pointer',
            fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <i className="ti ti-check" aria-hidden="true"></i>
          {busy ? 'Salvando…' : 'Salvar registro'}
        </button>
      </div>
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '9px 11px', borderRadius: 9,
  border: '0.5px solid var(--hair)', background: 'var(--bg-soft)',
  fontSize: 13, color: 'var(--ink)', fontFamily: 'var(--font-sans)',
  boxSizing: 'border-box', outline: 'none',
};

// ── Card de histórico ────────────────────────────────────────────────────────

function PillSintoma({ label, cor }) {
  const cores = {
    gold:  { bg: 'var(--gold-soft)', color: 'var(--gold-deep)' },
    red:   { bg: 'var(--red-soft)',  color: 'var(--red)' },
    green: { bg: 'var(--green-soft)', color: 'var(--green)' },
    muted: { bg: 'var(--bg-deep)', color: 'var(--muted)' },
  };
  const c = cores[cor] ?? cores.muted;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 20,
      fontSize: 10, fontWeight: 500,
      background: c.bg, color: c.color,
    }}>
      {label}
    </span>
  );
}

function CardRegistro({ r }) {
  const [aberto, setAberto] = useState(false);

  const duracaoSangramento = r.inicio_sangramento && r.fim_sangramento
    ? Math.round((new Date(r.fim_sangramento) - new Date(r.inicio_sangramento)) / 86400000) + 1
    : null;

  const sintomas = [];
  if (r.colica >= 2) sintomas.push({ label: `Cólica ${r.colica === 3 ? 'forte' : 'moderada'}`, cor: 'red' });
  if (r.coagulos) sintomas.push({ label: 'Coágulos', cor: 'red' });
  if (r.escape) sintomas.push({ label: 'Escape', cor: 'gold' });
  if (r.ondas_calor) sintomas.push({ label: 'Ondas de calor', cor: 'red' });
  if (r.suor_noturno) sintomas.push({ label: 'Suor noturno', cor: 'gold' });
  if (r.dor_mamas >= 2) sintomas.push({ label: 'Dor nas mamas', cor: 'gold' });
  if (r.acne >= 2) sintomas.push({ label: 'Acne', cor: 'gold' });
  if (r.inchaco >= 2) sintomas.push({ label: 'Inchaço', cor: 'gold' });
  if (r.dor_cabeca) sintomas.push({ label: 'Dor de cabeça', cor: 'muted' });
  if (r.humor && r.humor <= 2) sintomas.push({ label: 'Humor baixo', cor: 'muted' });
  if (r.energia && r.energia <= 2) sintomas.push({ label: 'Energia baixa', cor: 'muted' });

  const INTENSIDADE_LABEL = {
    leve: 'Leve', moderado: 'Moderado',
    intenso: 'Intenso', muito_intenso: 'Muito intenso',
  };
  const STATUS_LABEL = {
    regular: 'Regular', irregular: 'Irregular', amenorreia: 'Amenorreia',
    perimenopausa: 'Perimenopausa', menopausa: 'Menopausa',
  };
  const HUMOR_EMOJI  = ['', '😞', '😕', '😐', '🙂', '😄'];
  const ENERGIA_EMOJI = ['', '😴', '🥱', '😐', '⚡', '🚀'];
  const SONO_EMOJI   = ['', '😫', '😕', '😐', '😴', '🌙'];

  return (
    <div style={{
      background: 'var(--paper)', border: '0.5px solid var(--hair)',
      borderRadius: 14, overflow: 'hidden',
    }}>
      <button
        onClick={() => setAberto(a => !a)}
        style={{
          width: '100%', padding: '13px 14px',
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', textAlign: 'left',
        }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: 'var(--gold-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className="ti ti-moon" style={{ fontSize: 17, color: 'var(--gold-deep)' }} aria-hidden="true"></i>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
            {r.ultima_menstruacao
              ? `Última menstruação: ${dataBR(r.ultima_menstruacao)}`
              : r.inicio_sangramento
                ? `Sangramento: ${dataBR(r.inicio_sangramento)}`
                : `Registro de ${dataBR(r.created_at?.slice(0, 10))}`}
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {r.intensidade_fluxo && (
              <span>{INTENSIDADE_LABEL[r.intensidade_fluxo]}</span>
            )}
            {duracaoSangramento && (
              <span>· {duracaoSangramento} dia{duracaoSangramento !== 1 ? 's' : ''} de sangramento</span>
            )}
            {r.status_ciclo && (
              <span>· {STATUS_LABEL[r.status_ciclo]}</span>
            )}
          </div>
        </div>
        <i
          className={`ti ti-chevron-${aberto ? 'up' : 'down'}`}
          style={{ fontSize: 16, color: 'var(--muted)', flexShrink: 0 }}
          aria-hidden="true"
        />
      </button>

      {aberto && (
        <div style={{
          borderTop: '0.5px solid var(--hair-soft)',
          padding: '12px 14px 14px',
          background: 'var(--bg-soft)',
        }}>
          {sintomas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
              {sintomas.map((s, i) => <PillSintoma key={i} {...s} />)}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {r.humor > 0 && (
              <InfoItem icon="mood-smile" label="Humor" value={`${HUMOR_EMOJI[r.humor]} ${['', 'Muito ruim', 'Ruim', 'Neutro', 'Bom', 'Ótimo'][r.humor]}`} />
            )}
            {r.energia > 0 && (
              <InfoItem icon="bolt" label="Energia" value={`${ENERGIA_EMOJI[r.energia]} ${['', 'Muito baixa', 'Baixa', 'Normal', 'Boa', 'Alta'][r.energia]}`} />
            )}
            {r.sono > 0 && (
              <InfoItem icon="zzz" label="Sono" value={`${SONO_EMOJI[r.sono]} ${['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo'][r.sono]}`} />
            )}
            {r.muco_cervical && (
              <InfoItem icon="droplet" label="Muco cervical" value={r.muco_cervical} />
            )}
            {r.intestino && (
              <InfoItem icon="activity" label="Intestino" value={r.intestino} />
            )}
            {(r.anticoncepcional || r.diu || r.reposicao_hormonal || r.tentando_engravidar) && (
              <InfoItem icon="pill" label="Contexto" value={[
                r.anticoncepcional && 'Anticoncepcional',
                r.diu && 'DIU',
                r.reposicao_hormonal && 'Reposição',
                r.tentando_engravidar && 'TTC',
              ].filter(Boolean).join(', ')} />
            )}
          </div>

          {r.observacoes && (
            <div style={{
              marginTop: 10, padding: '9px 11px', borderRadius: 9,
              background: 'var(--paper)', border: '0.5px solid var(--hair)',
              fontSize: 12, color: 'var(--ink-soft)', lineHeight: 1.55,
              fontStyle: 'italic',
            }}>
              "{r.observacoes}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 7 }}>
      <i className={`ti ti-${icon}`} style={{ fontSize: 13, color: 'var(--gold-deep)', marginTop: 2, flexShrink: 0 }} aria-hidden="true" />
      <div>
        <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '.05em' }}>{label}</div>
        <div style={{ fontSize: 12, color: 'var(--ink)', fontWeight: 500, marginTop: 1 }}>{value}</div>
      </div>
    </div>
  );
}

// ── Tela principal ───────────────────────────────────────────────────────────

export default function Ciclo() {
  const { user } = useSession();
  const [registros, setRegistros] = useState(null);
  const [form, setForm] = useState(novoForm());
  const [aberto, setAberto] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function carregar() {
    if (!user) return;
    const { data } = await supabase
      .from('ciclo_registros')
      .select('*')
      .eq('paciente_id', user.id)
      .order('created_at', { ascending: false })
      .limit(24);
    setRegistros(data ?? []);
  }

  useEffect(() => { carregar(); }, [user]);

  async function salvar() {
    setFeedback(null);
    if (!form.ultima_menstruacao && !form.inicio_sangramento) {
      setFeedback({ tipo: 'erro', msg: 'Informe ao menos a data da última menstruação ou início do sangramento.' });
      return;
    }
    setBusy(true);
    const payload = {
      paciente_id: user.id,
      ultima_menstruacao:  form.ultima_menstruacao  || null,
      inicio_sangramento:  form.inicio_sangramento  || null,
      fim_sangramento:     form.fim_sangramento     || null,
      intensidade_fluxo:   form.intensidade_fluxo   || null,
      status_ciclo:        form.status_ciclo        || null,
      anticoncepcional:    form.anticoncepcional,
      diu:                 form.diu,
      reposicao_hormonal:  form.reposicao_hormonal,
      tentando_engravidar: form.tentando_engravidar,
      colica:              form.colica  || null,
      coagulos:            form.coagulos,
      escape:              form.escape,
      muco_cervical:       form.muco_cervical || null,
      dor_mamas:           form.dor_mamas || null,
      acne:                form.acne     || null,
      inchaco:             form.inchaco  || null,
      dor_cabeca:          form.dor_cabeca,
      compulsao_doces:     form.compulsao_doces || null,
      intestino:           form.intestino || null,
      ondas_calor:         form.ondas_calor,
      suor_noturno:        form.suor_noturno,
      secura_vaginal:      form.secura_vaginal,
      humor:               form.humor  || null,
      ansiedade:           form.ansiedade || null,
      irritabilidade:      form.irritabilidade || null,
      sono:                form.sono   || null,
      energia:             form.energia || null,
      libido:              form.libido  || null,
      observacoes:         form.observacoes.trim() || null,
    };
    const { error } = await supabase.from('ciclo_registros').insert(payload);
    setBusy(false);
    if (error) {
      setFeedback({ tipo: 'erro', msg: error.message });
      return;
    }
    setFeedback({ tipo: 'ok', msg: 'Registro salvo!' });
    setForm(novoForm());
    setAberto(false);
    carregar();
  }

  if (registros === null) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--muted)' }}>
        Carregando…
      </div>
    );
  }

  return (
    <div style={{ padding: '0 16px 8px' }}>
      {/* Hero card */}
      <div style={{
        background: 'linear-gradient(135deg, var(--gold-soft) 0%, var(--paper) 100%)',
        border: '0.5px solid var(--gold)',
        borderRadius: 16, padding: '16px 18px', marginBottom: 14,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
            color: 'var(--gold-deep)', fontWeight: 600, marginBottom: 4,
          }}>Ciclo &amp; Hormônios</div>
          <div style={{
            fontFamily: 'var(--font-serif)', fontSize: 20,
            color: 'var(--ink)', lineHeight: 1.1, marginBottom: 3,
          }}>
            Meu ciclo menstrual
          </div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {registros.length > 0
              ? `${registros.length} registro${registros.length !== 1 ? 's' : ''} — último em ${dataBR(registros[0].created_at?.slice(0, 10))}`
              : 'Nenhum registro ainda'}
          </div>
        </div>
        <button
          onClick={() => { setAberto(a => !a); setFeedback(null); }}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '9px 14px', borderRadius: 11, flexShrink: 0,
            background: aberto ? 'var(--bg-soft)' : 'var(--ink)',
            color: aberto ? 'var(--muted)' : 'var(--bg-soft)',
            border: `0.5px solid ${aberto ? 'var(--hair)' : 'transparent'}`,
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
          }}>
          <i className={`ti ti-${aberto ? 'x' : 'plus'}`} aria-hidden="true"></i>
          {aberto ? 'Cancelar' : 'Novo registro'}
        </button>
      </div>

      {/* Formulário */}
      {aberto && (
        <FormRegistro
          form={form}
          setF={setForm}
          busy={busy}
          feedback={feedback}
          onSalvar={salvar}
          onCancelar={() => { setAberto(false); setFeedback(null); setForm(novoForm()); }}
        />
      )}

      {/* Feedback pós-salvar */}
      {feedback && !aberto && (
        <div style={{
          margin: '0 0 12px', padding: '10px 14px', borderRadius: 10, fontSize: 13,
          background: feedback.tipo === 'ok' ? 'var(--green-soft)' : 'var(--red-soft)',
          color: feedback.tipo === 'ok' ? 'var(--green)' : 'var(--red)',
          display: 'flex', alignItems: 'center', gap: 7,
        }}>
          <i className={`ti ti-${feedback.tipo === 'ok' ? 'check' : 'alert-circle'}`} aria-hidden="true"></i>
          {feedback.msg}
        </div>
      )}

      {/* Histórico */}
      {registros.length === 0 && !aberto ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <i className="ti ti-moon-stars" style={{ fontSize: 38, color: 'var(--muted-2)', display: 'block', marginBottom: 10 }} aria-hidden="true"></i>
          <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink-soft)', marginBottom: 4 }}>
            Nenhum registro ainda
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.5, maxWidth: 260, margin: '0 auto' }}>
            Toque em "Novo registro" para começar a acompanhar seu ciclo menstrual.
          </div>
        </div>
      ) : registros.length > 0 && (
        <>
          <div style={{
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 500, margin: '4px 2px 8px',
          }}>
            Histórico
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
            {registros.map(r => <CardRegistro key={r.id} r={r} />)}
          </div>
        </>
      )}
    </div>
  );
}
