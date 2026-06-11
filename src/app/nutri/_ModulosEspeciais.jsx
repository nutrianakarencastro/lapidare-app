import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';

/* ─── Catálogo de módulos ────────────────────────────────────────────────── */
const MODULOS_CATALOG = [
  {
    id: 'diario_glicemico_dmg',
    label: 'Diário Glicêmico (DMG)',
    descricao: 'Monitorização glicêmica gestacional com metas, semáforo semanal e alertas.',
    icon: 'droplet',
    configFields: [
      {
        key: 'protocolo',
        label: 'Protocolo de monitorização',
        tipo: 'select',
        obrigatorio: true,
        opcoes: [
          { v: '1h', l: '1 hora após o início das refeições (meta <140 mg/dL)' },
          { v: '2h', l: '2 horas após o início das refeições (meta <120 mg/dL)' },
        ],
      },
    ],
  },
  {
    id: 'diario_intestinal',
    label: 'Diário Intestinal Recorrente',
    descricao: 'Registro periódico de sintomas intestinais com escala de Bristol e alertas.',
    icon: 'leaf',
    configFields: [
      {
        key: 'periodicidade',
        label: 'Periodicidade',
        tipo: 'select',
        obrigatorio: true,
        opcoes: [
          { v: 'diario',      l: 'Diário' },
          { v: 'semanal',     l: 'Semanal' },
          { v: 'quinzenal',   l: 'Quinzenal' },
          { v: 'sob_demanda', l: 'Sob demanda' },
        ],
      },
    ],
  },
  {
    id: 'fertilidade',
    label: 'Módulo Fertilidade',
    descricao: 'Recursos específicos para acompanhamento pré-concepcional.',
    icon: 'heart',
    configFields: [],
  },
  {
    id: 'pos_parto',
    label: 'Módulo Pós-parto',
    descricao: 'Recursos específicos para o período pós-parto e recuperação.',
    icon: 'baby-carriage',
    configFields: [],
  },
];

/* ─── Helpers ────────────────────────────────────────────────────────────── */

function labelConfig(modulo, config) {
  if (!config || Object.keys(config).length === 0) return null;
  const catalog = MODULOS_CATALOG.find(m => m.id === modulo);
  if (!catalog) return null;
  return catalog.configFields.map(f => {
    const opc = f.opcoes?.find(o => o.v === config[f.key]);
    return opc?.l ?? config[f.key] ?? '—';
  }).filter(Boolean).join(' · ');
}

/* ─── Card de Módulo ─────────────────────────────────────────────────────── */
function ModuloCard({ catalogo, estadoAtual, onAtivar, onDesativar }) {
  const ativo = estadoAtual?.ativo === true;
  const [expandindoConfig, setExpandindoConfig] = useState(false);
  const [configLocal, setConfigLocal] = useState({});
  const [salvando, setSalvando] = useState(false);

  function abrirConfig() {
    const defaultConfig = {};
    for (const f of catalogo.configFields) {
      defaultConfig[f.key] = estadoAtual?.config?.[f.key] ?? f.opcoes?.[0]?.v ?? '';
    }
    setConfigLocal(defaultConfig);
    setExpandindoConfig(true);
  }

  async function confirmarAtivacao() {
    for (const f of catalogo.configFields) {
      if (f.obrigatorio && !configLocal[f.key]) return;
    }
    setSalvando(true);
    await onAtivar(catalogo.id, configLocal);
    setSalvando(false);
    setExpandindoConfig(false);
  }

  const configLabel = ativo ? labelConfig(catalogo.id, estadoAtual?.config) : null;

  return (
    <div style={{
      borderBottom: '0.5px solid var(--border)',
      padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Ícone */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: ativo ? 'var(--dark)' : 'var(--bg2)',
          border: '0.5px solid ' + (ativo ? 'var(--dark)' : 'var(--border)'),
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <i className={`ti ti-${catalogo.icon}`} style={{
            fontSize: 17,
            color: ativo ? 'var(--white)' : 'var(--text3)',
          }} aria-hidden="true" />
        </div>

        {/* Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--dark)' }}>
              {catalogo.label}
            </span>
            {ativo && (
              <span style={{
                fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999,
                background: 'var(--green-bg, #f0fdf4)', color: 'var(--green)',
                textTransform: 'uppercase', letterSpacing: '.05em',
              }}>Ativo</span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>
            {catalogo.descricao}
          </div>
          {ativo && configLabel && (
            <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 4, fontStyle: 'italic' }}>
              {configLabel}
            </div>
          )}
        </div>

        {/* Toggle */}
        <button
          onClick={ativo ? onDesativar : (catalogo.configFields.length > 0 ? abrirConfig : () => onAtivar(catalogo.id, {}))}
          style={{
            fontSize: 12, padding: '5px 12px', borderRadius: 7, flexShrink: 0,
            border: '0.5px solid ' + (ativo ? 'var(--red)' : 'var(--dark)'),
            background: ativo ? 'transparent' : 'var(--dark)',
            color: ativo ? 'var(--red)' : 'var(--white)',
            cursor: 'pointer', fontFamily: 'var(--font-sans)',
          }}
        >
          {ativo ? 'Desativar' : 'Ativar'}
        </button>
      </div>

      {/* Config expandida */}
      {expandindoConfig && (
        <div style={{
          marginTop: 12, padding: '12px 14px', borderRadius: 8,
          background: 'var(--bg2)', border: '0.5px solid var(--border)',
        }}>
          {catalogo.configFields.map(f => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{f.label}</div>
              {f.tipo === 'select' && (
                <select
                  value={configLocal[f.key] ?? ''}
                  onChange={e => setConfigLocal(c => ({ ...c, [f.key]: e.target.value }))}
                  style={{ width: '100%', boxSizing: 'border-box', margin: 0 }}
                >
                  {f.opcoes.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
                </select>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
            <button
              onClick={() => setExpandindoConfig(false)}
              className="btn-outline"
              style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
            >
              Cancelar
            </button>
            <button
              onClick={confirmarAtivacao}
              disabled={salvando}
              className="btn"
              style={{ flex: 1, justifyContent: 'center', fontSize: 12 }}
            >
              {salvando ? '…' : 'Confirmar'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Componente principal ───────────────────────────────────────────────── */
export default function ModulosEspeciais({ pacienteId, nutriId }) {
  const [linhas, setLinhas] = useState(null);
  const [erro, setErro] = useState(null);

  async function carregar() {
    const { data, error } = await supabase
      .from('paciente_modulos')
      .select('*')
      .eq('paciente_id', pacienteId)
      .order('ativado_em', { ascending: false });
    if (error) { setErro(error.message); return; }
    setLinhas(data ?? []);
  }

  useEffect(() => { carregar(); }, [pacienteId]);

  // Estado atual por módulo: a linha mais recente determina se está ativo
  const estadoAtual = {};
  for (const row of linhas ?? []) {
    if (!estadoAtual[row.modulo]) estadoAtual[row.modulo] = row;
  }

  async function ativar(modulo, config) {
    setErro(null);
    const { error } = await supabase.from('paciente_modulos').insert({
      paciente_id: pacienteId,
      nutri_id: nutriId,
      modulo,
      config,
      ativo: true,
    });
    if (error) { setErro(error.message); return; }
    await carregar();
  }

  async function desativar(modulo) {
    setErro(null);
    const atual = estadoAtual[modulo];
    if (!atual) return;
    const { error } = await supabase
      .from('paciente_modulos')
      .update({ ativo: false, desativado_em: new Date().toISOString() })
      .eq('id', atual.id);
    if (error) { setErro(error.message); return; }
    await carregar();
  }

  const modulosAtivos = MODULOS_CATALOG.filter(m => estadoAtual[m.id]?.ativo === true);

  return (
    <>
      <div className="section-label">Módulos Especiais</div>

      {erro && (
        <div style={{
          background: 'var(--red-bg)', color: 'var(--red)',
          padding: '8px 12px', borderRadius: 7, fontSize: 13, marginBottom: 12,
        }}>{erro}</div>
      )}

      {/* Resumo ativo */}
      {modulosAtivos.length > 0 && (
        <div className="al-b" style={{ marginBottom: 14 }}>
          <i className="ti ti-circle-check" style={{ fontSize: 16, color: 'var(--green)', marginTop: 1 }} aria-hidden="true" />
          <div>
            <div className="al-t" style={{ color: 'var(--green)' }}>
              {modulosAtivos.length} módulo{modulosAtivos.length > 1 ? 's' : ''} ativo{modulosAtivos.length > 1 ? 's' : ''}
            </div>
            <div className="al-d">{modulosAtivos.map(m => m.label).join(' · ')}</div>
          </div>
        </div>
      )}

      {linhas === null ? (
        <div className="card" style={{ padding: '16px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>
          Carregando…
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {MODULOS_CATALOG.map((m, i) => (
            <ModuloCard
              key={m.id}
              catalogo={m}
              estadoAtual={estadoAtual[m.id] ?? null}
              onAtivar={ativar}
              onDesativar={() => desativar(m.id)}
            />
          ))}
          {/* Espaço visual no último item */}
          <div style={{ height: 0, borderBottom: 'none' }} />
        </div>
      )}

      <div style={{ fontSize: 11, color: 'var(--text4)', marginTop: 12, lineHeight: 1.5 }}>
        Cada módulo ativado libera funcionalidades específicas no aplicativo da paciente.
        O histórico de ativações é preservado automaticamente.
      </div>
    </>
  );
}
