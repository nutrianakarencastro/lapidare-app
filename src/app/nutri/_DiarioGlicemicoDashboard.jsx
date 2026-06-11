import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase.js';
import { classificar, metaLabel } from '../../lib/glicemiaUtils.js';

const PERIODOS = [7, 14, 30];

const LABEL_TIPO = {
  jejum:      'Jejum',
  cafe_manha: 'Café',
  almoco:     'Almoço',
  jantar:     'Jantar',
  extra:      'Extras',
};

function dataBR(iso) {
  if (!iso) return '';
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}

// ─── Célula da tabela ─────────────────────────────────────────────────────────
function CelulaValor({ tipo, regs }) {
  const r = (regs ?? []).find(x => x.tipo_refeicao === tipo && x.seq_extra == null);
  if (!r) return <span style={{ color: 'var(--text4)', fontSize: 12 }}>—</span>;

  const cls = classificar(r.valor_mg_dl, r.tipo_refeicao, r.protocolo);
  const corMap = {
    meta:         { bg: 'var(--green-bg)',           cor: 'var(--green)'  },
    fora_meta:    { bg: 'var(--red-bg)',             cor: 'var(--red)'    },
    hipoglicemia: { bg: 'var(--orange-bg, #fff7ed)', cor: 'var(--orange)' },
  };
  const { bg, cor } = corMap[cls];
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, padding: '2px 7px',
      borderRadius: 5, background: bg, color: cor,
    }}>
      {cls === 'hipoglicemia' ? '⚠ ' : ''}{r.valor_mg_dl}
    </span>
  );
}

function CelulaExtras({ regs }) {
  const extras = (regs ?? []).filter(r => r.tipo_refeicao === 'extra');
  if (extras.length === 0) return <span style={{ color: 'var(--text4)', fontSize: 12 }}>—</span>;
  const temFora = extras.some(r => classificar(r.valor_mg_dl, r.tipo_refeicao, r.protocolo) !== 'meta');
  return (
    <span style={{
      fontSize: 12, fontWeight: 600, padding: '2px 7px', borderRadius: 5,
      background: temFora ? 'var(--red-bg)' : 'var(--green-bg)',
      color: temFora ? 'var(--red)' : 'var(--green)',
    }}>
      {extras.length}×
    </span>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
export default function DiarioGlicemicoDashboard({ pacienteId }) {
  const [periodo, setPeriodo]     = useState(14);
  const [registros, setRegistros] = useState([]);
  const [modulo, setModulo]       = useState(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    async function carregar() {
      setCarregando(true);

      // Estado atual do módulo
      const { data: modData } = await supabase
        .from('paciente_modulos')
        .select('modulo, ativo, config, ativado_em')
        .eq('paciente_id', pacienteId)
        .order('ativado_em', { ascending: false });

      const moduloRow = (modData ?? []).find(r => r.modulo === 'diario_glicemico_dmg');
      setModulo(moduloRow ?? null);

      // Registros do período
      const desde = new Date();
      desde.setDate(desde.getDate() - periodo + 1);
      const desdeStr = desde.toISOString().slice(0, 10);

      const { data: regData } = await supabase
        .from('diario_glicemico')
        .select('*')
        .eq('paciente_id', pacienteId)
        .gte('data', desdeStr)
        .order('data', { ascending: false })
        .order('tipo_refeicao')
        .order('seq_extra', { ascending: true, nullsFirst: true });

      setRegistros(regData ?? []);
      setCarregando(false);
    }
    carregar();
  }, [pacienteId, periodo]);

  // Registros agrupados por data
  const porData = useMemo(() => {
    const map = new Map();
    for (const r of registros) {
      if (!map.has(r.data)) map.set(r.data, []);
      map.get(r.data).push(r);
    }
    return map;
  }, [registros]);

  // Datas do período com registros (ordenadas do mais recente)
  const datasComRegistro = useMemo(() =>
    [...porData.keys()].sort((a, b) => b.localeCompare(a)),
    [porData],
  );

  // Estatísticas resumidas
  const stats = useMemo(() => {
    if (registros.length === 0) return null;
    const classes = registros.map(r => classificar(r.valor_mg_dl, r.tipo_refeicao, r.protocolo));
    const total   = classes.length;
    const meta    = classes.filter(c => c === 'meta').length;
    const fora    = classes.filter(c => c === 'fora_meta').length;
    const hipo    = classes.filter(c => c === 'hipoglicemia').length;

    const porTipo = {};
    for (const r of registros) {
      const cls = classificar(r.valor_mg_dl, r.tipo_refeicao, r.protocolo);
      if (!porTipo[r.tipo_refeicao]) porTipo[r.tipo_refeicao] = { total: 0, fora: 0 };
      porTipo[r.tipo_refeicao].total++;
      if (cls !== 'meta') porTipo[r.tipo_refeicao].fora++;
    }

    return { total, meta, fora, hipo, porTipo };
  }, [registros]);

  // Alertas automáticos
  const alertas = useMemo(() => {
    if (!stats) return [];
    const list = [];

    if (stats.hipo === 1) {
      list.push({ tipo: 'hipo', msg: `1 episódio de hipoglicemia nos últimos ${periodo} dias.` });
    } else if (stats.hipo > 1) {
      list.push({ tipo: 'hipo', msg: `${stats.hipo} episódios de hipoglicemia nos últimos ${periodo} dias.` });
    }

    for (const [tipo, dados] of Object.entries(stats.porTipo ?? {})) {
      if (dados.total >= 3 && dados.fora / dados.total > 0.5) {
        list.push({
          tipo: 'fora',
          msg: `${LABEL_TIPO[tipo] ?? tipo}: ${Math.round(dados.fora / dados.total * 100)}% dos registros fora da meta.`,
        });
      }
    }

    return list;
  }, [stats, periodo]);

  // ─── Módulo inativo ──────────────────────────────────────────────────────────
  if (!carregando && (!modulo || !modulo.ativo)) {
    return (
      <div className="card empty-card">
        <i className="ti ti-droplet-off empty-icon" style={{ fontSize: 24 }} aria-hidden="true" />
        <div className="empty-sub">Módulo Diário Glicêmico não está ativo para esta paciente.</div>
      </div>
    );
  }

  const protocolo = modulo?.config?.protocolo ?? '1h';

  return (
    <>
      {/* Header + seletor de período */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div className="section-label" style={{ marginBottom: 4 }}>Diário Glicêmico — DMG</div>
          <div style={{ fontSize: 12, color: 'var(--text3)' }}>
            Protocolo ativo: <strong>{protocolo} pós-refeição</strong>
            {' · '} Jejum &lt;95{' · '}
            Pós-prandial {protocolo === '1h' ? '<140' : '<120'} mg/dL
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODOS.map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              style={{
                fontSize: 11, padding: '4px 10px', borderRadius: 6,
                border: '0.5px solid ' + (periodo === p ? 'var(--dark)' : 'var(--border)'),
                background: periodo === p ? 'var(--dark)' : 'transparent',
                color: periodo === p ? 'var(--white)' : 'var(--text3)',
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
              }}
            >
              {p}d
            </button>
          ))}
        </div>
      </div>

      {carregando ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', padding: '24px 0', textAlign: 'center' }}>
          Carregando…
        </div>
      ) : (
        <>
          {/* Estatísticas */}
          {stats ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'Registros',    val: stats.total, cor: 'var(--dark)'   },
                { label: 'Na meta',      val: `${Math.round(stats.meta / stats.total * 100)}%`, cor: 'var(--green)'  },
                { label: 'Fora da meta', val: `${Math.round(stats.fora / stats.total * 100)}%`, cor: 'var(--red)'    },
                { label: 'Hipoglicemia', val: stats.hipo, cor: 'var(--orange)'  },
              ].map(s => (
                <div key={s.label} className="card" style={{ padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.cor }}>{s.val}</div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          ) : null}

          {/* Alertas */}
          {alertas.length > 0 && (
            <div style={{ marginBottom: 14 }}>
              {alertas.map((a, i) => (
                <div key={i} style={{
                  padding: '9px 12px', borderRadius: 8, marginBottom: 6,
                  background: a.tipo === 'hipo' ? 'var(--orange-bg, #fff7ed)' : 'var(--red-bg)',
                  border: '0.5px solid ' + (a.tipo === 'hipo' ? 'var(--orange)' : 'var(--red)'),
                  fontSize: 12, color: 'var(--dark)',
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}>
                  <i className="ti ti-alert-triangle" style={{
                    color: a.tipo === 'hipo' ? 'var(--orange)' : 'var(--red)',
                    fontSize: 14, marginTop: 1, flexShrink: 0,
                  }} aria-hidden="true" />
                  {a.msg}
                </div>
              ))}
            </div>
          )}

          {/* Tabela */}
          {datasComRegistro.length === 0 ? (
            <div className="card empty-card">
              <div className="empty-sub">Nenhum registro nos últimos {periodo} dias.</div>
            </div>
          ) : (
            <div className="card" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="table" style={{ minWidth: 440 }}>
                <thead>
                  <tr>
                    <th style={{ whiteSpace: 'nowrap' }}>Data</th>
                    <th>
                      Jejum<br />
                      <span style={{ fontWeight: 400, fontSize: 10 }}>&lt;95</span>
                    </th>
                    <th>
                      Café<br />
                      <span style={{ fontWeight: 400, fontSize: 10 }}>
                        {protocolo === '1h' ? '<140' : '<120'}
                      </span>
                    </th>
                    <th>
                      Almoço<br />
                      <span style={{ fontWeight: 400, fontSize: 10 }}>
                        {protocolo === '1h' ? '<140' : '<120'}
                      </span>
                    </th>
                    <th>
                      Jantar<br />
                      <span style={{ fontWeight: 400, fontSize: 10 }}>
                        {protocolo === '1h' ? '<140' : '<120'}
                      </span>
                    </th>
                    <th>Extras</th>
                  </tr>
                </thead>
                <tbody>
                  {datasComRegistro.map(d => (
                    <tr key={d}>
                      <td style={{ whiteSpace: 'nowrap', fontSize: 12, color: 'var(--text2)' }}>
                        {dataBR(d)}
                      </td>
                      <td><CelulaValor tipo="jejum"      regs={porData.get(d)} /></td>
                      <td><CelulaValor tipo="cafe_manha" regs={porData.get(d)} /></td>
                      <td><CelulaValor tipo="almoco"     regs={porData.get(d)} /></td>
                      <td><CelulaValor tipo="jantar"     regs={porData.get(d)} /></td>
                      <td><CelulaExtras                  regs={porData.get(d)} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 10, lineHeight: 1.5 }}>
            Registros feitos pela paciente no aplicativo. Para alterar o protocolo, acesse a aba Módulos.
          </div>
        </>
      )}
    </>
  );
}
