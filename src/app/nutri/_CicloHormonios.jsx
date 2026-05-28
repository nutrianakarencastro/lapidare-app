import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

function dataBR(iso) {
  if (!iso) return '—';
  return new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  });
}

function diasEntre(a, b) {
  if (!a || !b) return null;
  return Math.round(Math.abs(new Date(b) - new Date(a)) / 86400000);
}

// ── Cards de alerta ──────────────────────────────────────────────────────────

function CardAlerta({ icon, titulo, descricao, tipo = 'aviso' }) {
  const cores = {
    aviso:   { bg: 'var(--orange-bg)', border: 'var(--orange)', color: 'var(--orange)' },
    alerta:  { bg: 'var(--red-bg)',    border: 'var(--red)',    color: 'var(--red)' },
    info:    { bg: 'var(--blue-bg)',   border: 'var(--blue)',   color: 'var(--blue)' },
  };
  const c = cores[tipo] ?? cores.aviso;
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 10,
      padding: '11px 13px', borderRadius: 10,
      background: c.bg,
      border: `0.5px solid ${c.border}`,
    }}>
      <i className={`ti ti-${icon}`} style={{ fontSize: 16, color: c.color, flexShrink: 0, marginTop: 1 }} aria-hidden="true"></i>
      <div>
        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--dark)' }}>{titulo}</div>
        <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 2, lineHeight: 1.45 }}>{descricao}</div>
      </div>
    </div>
  );
}

// ── Linha de sintoma frequente ────────────────────────────────────────────────

function LinhaFrequencia({ label, contagem, total }) {
  const pct = total > 0 ? Math.round((contagem / total) * 100) : 0;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 12, color: 'var(--dark)' }}>{label}</span>
        <span style={{ fontSize: 11, color: 'var(--text3)' }}>{contagem}/{total} ({pct}%)</span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
        <div style={{
          height: '100%', borderRadius: 3,
          width: `${pct}%`,
          background: pct >= 60 ? 'var(--red)' : pct >= 30 ? 'var(--orange)' : 'var(--amber)',
          transition: 'width .4s ease',
        }} />
      </div>
    </div>
  );
}

// ── Card de registro expandível ───────────────────────────────────────────────

function RegistroRow({ r, idx, total }) {
  const [aberto, setAberto] = useState(false);

  const INTENSIDADE_LABEL = {
    leve: 'Leve', moderado: 'Moderado',
    intenso: 'Intenso', muito_intenso: 'Muito intenso',
  };
  const STATUS_LABEL = {
    regular: 'Regular', irregular: 'Irregular', amenorreia: 'Amenorreia',
    perimenopausa: 'Perimenopausa', menopausa: 'Menopausa',
  };
  const ESCALA3_LABEL = ['—', 'Leve', 'Moderada', 'Forte'];
  const HUMOR_LABEL  = ['', 'Muito ruim', 'Ruim', 'Neutro', 'Bom', 'Ótimo'];
  const ENERGIA_LABEL = ['', 'Muito baixa', 'Baixa', 'Normal', 'Boa', 'Alta'];
  const SONO_LABEL   = ['', 'Péssimo', 'Ruim', 'Regular', 'Bom', 'Ótimo'];

  const duracaoSangramento = r.inicio_sangramento && r.fim_sangramento
    ? diasEntre(r.inicio_sangramento, r.fim_sangramento) + 1
    : null;

  const alertas = [];
  if (r.colica >= 3) alertas.push('Cólica forte');
  if (r.coagulos) alertas.push('Coágulos');
  if (r.escape) alertas.push('Escape');
  if (r.intensidade_fluxo === 'muito_intenso') alertas.push('Fluxo muito intenso');
  if (r.ondas_calor) alertas.push('Ondas de calor');
  if (r.suor_noturno) alertas.push('Suor noturno');
  if (r.secura_vaginal) alertas.push('Secura vaginal');

  return (
    <div style={{
      borderBottom: idx < total - 1 ? '0.5px solid #f5f0e8' : 'none',
    }}>
      <button
        onClick={() => setAberto(a => !a)}
        style={{
          width: '100%', padding: '11px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-sans)', textAlign: 'left',
        }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)' }}>
              {r.ultima_menstruacao ? dataBR(r.ultima_menstruacao) : dataBR(r.created_at?.slice(0, 10))}
            </span>
            {r.status_ciclo && (
              <span style={{
                fontSize: 10, padding: '2px 7px', borderRadius: 20, fontWeight: 500,
                background: r.status_ciclo === 'regular' ? 'var(--green-bg)' : 'var(--orange-bg)',
                color: r.status_ciclo === 'regular' ? 'var(--green)' : 'var(--orange)',
              }}>
                {STATUS_LABEL[r.status_ciclo]}
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            {[
              r.intensidade_fluxo && INTENSIDADE_LABEL[r.intensidade_fluxo],
              duracaoSangramento && `${duracaoSangramento}d sangramento`,
              alertas.length > 0 && `${alertas.length} alerta${alertas.length > 1 ? 's' : ''}`,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        {alertas.length > 0 && (
          <span style={{
            width: 20, height: 20, borderRadius: '50%',
            background: 'var(--red-bg)', color: 'var(--red)',
            fontSize: 10, fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            {alertas.length}
          </span>
        )}
        <i
          className={`ti ti-chevron-${aberto ? 'up' : 'down'}`}
          style={{ fontSize: 14, color: 'var(--text3)', flexShrink: 0 }}
          aria-hidden="true"
        />
      </button>

      {aberto && (
        <div style={{
          padding: '0 16px 14px',
          background: '#faf8f5',
          borderTop: '0.5px solid #f0ebe3',
        }}>
          {alertas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, margin: '10px 0 8px' }}>
              {alertas.map((a, i) => (
                <span key={i} style={{
                  fontSize: 10, padding: '2px 8px', borderRadius: 20, fontWeight: 500,
                  background: 'var(--red-bg)', color: 'var(--red)',
                }}>{a}</span>
              ))}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginTop: 10 }}>
            {r.colica > 0 && <MiniStat label="Cólica" value={ESCALA3_LABEL[r.colica]} />}
            {r.dor_mamas > 0 && <MiniStat label="Dor mamas" value={ESCALA3_LABEL[r.dor_mamas]} />}
            {r.acne > 0 && <MiniStat label="Acne" value={ESCALA3_LABEL[r.acne]} />}
            {r.inchaco > 0 && <MiniStat label="Inchaço" value={ESCALA3_LABEL[r.inchaco]} />}
            {r.compulsao_doces > 0 && <MiniStat label="Compulsão" value={ESCALA3_LABEL[r.compulsao_doces]} />}
            {r.humor > 0 && <MiniStat label="Humor" value={HUMOR_LABEL[r.humor]} />}
            {r.energia > 0 && <MiniStat label="Energia" value={ENERGIA_LABEL[r.energia]} />}
            {r.sono > 0 && <MiniStat label="Sono" value={SONO_LABEL[r.sono]} />}
            {r.muco_cervical && <MiniStat label="Muco" value={r.muco_cervical} />}
            {r.intestino && <MiniStat label="Intestino" value={r.intestino} />}
          </div>

          {(r.anticoncepcional || r.diu || r.reposicao_hormonal || r.tentando_engravidar) && (
            <div style={{ marginTop: 8, fontSize: 11, color: 'var(--text3)' }}>
              <strong style={{ color: 'var(--text2)' }}>Contexto:</strong>{' '}
              {[
                r.anticoncepcional && 'Anticoncepcional',
                r.diu && 'DIU',
                r.reposicao_hormonal && 'Reposição hormonal',
                r.tentando_engravidar && 'Tentando engravidar',
              ].filter(Boolean).join(', ')}
            </div>
          )}

          {r.observacoes && (
            <div style={{
              marginTop: 8, padding: '8px 11px', borderRadius: 8,
              background: 'var(--white)', border: '0.5px solid var(--border)',
              fontSize: 11, color: 'var(--text2)', lineHeight: 1.5, fontStyle: 'italic',
            }}>
              "{r.observacoes}"
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{
      padding: '7px 10px', borderRadius: 8,
      background: 'var(--white)', border: '0.5px solid var(--border)',
    }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>
      <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--dark)', marginTop: 2 }}>{value}</div>
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────

export default function CicloHormonios({ pacienteId, pacienteNome }) {
  const [registros, setRegistros] = useState(null);

  useEffect(() => {
    let active = true;
    async function carregar() {
      const { data } = await supabase
        .from('ciclo_registros')
        .select('*')
        .eq('paciente_id', pacienteId)
        .order('created_at', { ascending: false })
        .limit(36);
      if (!active) return;
      setRegistros(data ?? []);
    }
    carregar();
    return () => { active = false; };
  }, [pacienteId]);

  const metricas = useMemo(() => {
    if (!registros || registros.length === 0) return null;

    const nome = pacienteNome?.split(' ')[0] ?? 'ela';
    const total = registros.length;

    // Duração média do ciclo (distância entre últimas menstruações consecutivas)
    const comData = registros
      .filter(r => r.ultima_menstruacao)
      .map(r => r.ultima_menstruacao)
      .sort();
    let mediaciClo = null;
    if (comData.length >= 2) {
      const diffs = [];
      for (let i = 1; i < comData.length; i++) {
        diffs.push(diasEntre(comData[i - 1], comData[i]));
      }
      mediaciClo = Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length);
    }

    // Duração média do sangramento
    const comSangramento = registros.filter(r => r.inicio_sangramento && r.fim_sangramento);
    let mediaSangramento = null;
    if (comSangramento.length > 0) {
      const somas = comSangramento.map(r => diasEntre(r.inicio_sangramento, r.fim_sangramento) + 1);
      mediaSangramento = Math.round(somas.reduce((a, b) => a + b, 0) / somas.length);
    }

    // Frequência de sintomas (por registro)
    const freq = (campo, valor = true) => {
      if (typeof valor === 'boolean') {
        return registros.filter(r => r[campo] === true).length;
      }
      if (typeof valor === 'number') {
        return registros.filter(r => (r[campo] ?? 0) >= valor).length;
      }
      return 0;
    };

    const sintomas = [
      { label: 'Cólica (moderada/forte)',  contagem: freq('colica', 2) },
      { label: 'Dor nas mamas',            contagem: freq('dor_mamas', 2) },
      { label: 'Inchaço',                  contagem: freq('inchaco', 2) },
      { label: 'Acne',                     contagem: freq('acne', 2) },
      { label: 'Compulsão por doces',      contagem: freq('compulsao_doces', 2) },
      { label: 'Irritabilidade (mod/forte)', contagem: freq('irritabilidade', 2) },
      { label: 'Ansiedade (mod/forte)',    contagem: freq('ansiedade', 2) },
      { label: 'Coágulos',                 contagem: freq('coagulos') },
      { label: 'Escape',                   contagem: freq('escape') },
      { label: 'Dor de cabeça',            contagem: freq('dor_cabeca') },
      { label: 'Ondas de calor',           contagem: freq('ondas_calor') },
      { label: 'Suor noturno',             contagem: freq('suor_noturno') },
      { label: 'Secura vaginal',           contagem: freq('secura_vaginal') },
    ]
      .filter(s => s.contagem > 0)
      .sort((a, b) => b.contagem - a.contagem)
      .slice(0, 6);

    // Alertas
    const alertas = [];
    const recente = registros[0];

    if (mediaciClo !== null && mediaciClo < 21) {
      alertas.push({
        icon: 'calendar-x',
        tipo: 'alerta',
        titulo: 'Ciclo curto',
        descricao: `Média de ${mediaciClo} dias entre os ciclos (normal: 21–35 dias). Pode indicar fase lútea curta ou desequilíbrio hormonal.`,
      });
    }
    if (mediaciClo !== null && mediaciClo > 35) {
      alertas.push({
        icon: 'calendar-time',
        tipo: 'aviso',
        titulo: 'Ciclo longo',
        descricao: `Média de ${mediaciClo} dias entre os ciclos (normal: 21–35 dias). Pode indicar hipotireoidismo, SOP ou outros desequilíbrios.`,
      });
    }
    if (registros.filter(r => r.intensidade_fluxo === 'muito_intenso').length >= 2) {
      alertas.push({
        icon: 'droplet',
        tipo: 'alerta',
        titulo: 'Fluxo intenso recorrente',
        descricao: 'Fluxo muito intenso registrado em 2 ou mais ciclos. Avaliar ferro sérico, ferritina e possíveis causas ginecológicas.',
      });
    }
    if (registros.filter(r => r.escape).length >= 2) {
      alertas.push({
        icon: 'wave-saw-tool',
        tipo: 'aviso',
        titulo: 'Escapes recorrentes',
        descricao: 'Sangramento fora do período em 2 ou mais registros. Pode estar relacionado a método contraceptivo, estresse ou alterações hormonais.',
      });
    }
    if (registros.filter(r => (r.colica ?? 0) >= 3).length >= 2) {
      alertas.push({
        icon: 'first-aid-kit',
        tipo: 'alerta',
        titulo: 'Cólica forte recorrente',
        descricao: 'Cólica forte em 2 ou mais ciclos. Investigar endometriose, adenomiose ou deficiências nutricionais (magnésio, ômega-3).',
      });
    }
    if (recente && (recente.ondas_calor || recente.suor_noturno) &&
        registros.filter(r => r.ondas_calor || r.suor_noturno).length >= 2) {
      alertas.push({
        icon: 'flame',
        tipo: 'aviso',
        titulo: 'Sintomas vasomotores',
        descricao: 'Ondas de calor e/ou suor noturno em múltiplos registros. Avaliar estrogênio, FSH e suporte nutricional para a transição.',
      });
    }
    const statusTransicao = ['perimenopausa', 'menopausa'];
    if (registros.some(r => statusTransicao.includes(r.status_ciclo)) ||
        (recente && recente.secura_vaginal &&
          registros.filter(r => r.secura_vaginal).length >= 2)) {
      alertas.push({
        icon: 'moon-stars',
        tipo: 'info',
        titulo: 'Sinais de transição menopausal',
        descricao: 'Status ou sintomas compatíveis com perimenopausa/menopausa registrados. Considerar suporte para saúde óssea, cardiovascular e composição corporal.',
      });
    }

    return { total, mediaciClo, mediaSangramento, sintomas, alertas };
  }, [registros, pacienteNome]);

  if (registros === null) {
    return (
      <div className="card empty-card">
        <div className="empty-sub">Carregando dados…</div>
      </div>
    );
  }

  if (registros.length === 0) {
    return (
      <div className="card empty-card">
        <i className="ti ti-moon" style={{ fontSize: 28, color: 'var(--text4)', display: 'block', marginBottom: 8 }} aria-hidden="true"></i>
        <div className="empty-sub">
          Nenhum registro de ciclo ainda. {pacienteNome?.split(' ')[0] ?? 'A paciente'} ainda não adicionou dados pelo app.
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Métricas resumo */}
      <div className="g3" style={{ marginBottom: 0 }}>
        <div className="stat">
          <div className="stat-lbl">Registros</div>
          <div className="stat-val">{metricas.total}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Ciclo médio</div>
          <div className="stat-val">
            {metricas.mediaciClo !== null ? `${metricas.mediaciClo}d` : '—'}
          </div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Sangramento</div>
          <div className="stat-val">
            {metricas.mediaSangramento !== null ? `${metricas.mediaSangramento}d` : '—'}
          </div>
        </div>
      </div>

      {/* Cards de alerta */}
      {metricas.alertas.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Alertas clínicos</div>
              <div className="card-sub">Com base no histórico de registros</div>
            </div>
            <span style={{
              width: 22, height: 22, borderRadius: '50%',
              background: 'var(--red-bg)', color: 'var(--red)',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>{metricas.alertas.length}</span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {metricas.alertas.map((a, i) => (
              <CardAlerta key={i} {...a} />
            ))}
          </div>
        </div>
      )}

      {/* Sintomas mais frequentes */}
      {metricas.sintomas.length > 0 && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="card-header">
            <div>
              <div className="card-title">Sintomas frequentes</div>
              <div className="card-sub">Presença em {metricas.total} registro{metricas.total > 1 ? 's' : ''}</div>
            </div>
          </div>
          <div className="card-body">
            {metricas.sintomas.map((s, i) => (
              <LinhaFrequencia key={i} label={s.label} contagem={s.contagem} total={metricas.total} />
            ))}
          </div>
        </div>
      )}

      {/* Histórico de registros */}
      <div className="section-label">Histórico ({registros.length})</div>
      <div className="card" style={{ padding: 0 }}>
        {registros.map((r, i) => (
          <RegistroRow key={r.id} r={r} idx={i} total={registros.length} />
        ))}
      </div>
    </>
  );
}
