import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { EIXOS } from '../../lib/cicloUtils.js';

// ── Filtros explícitos ─────────────────────────────────────────────────────
const FILTROS = [
  { id: 'todos',     label: 'Tudo'        },
  { id: 'conduta',   label: 'Condutas'    },
  { id: 'meta',      label: 'Metas'       },
  { id: 'consulta',  label: 'Consultas'   },
  { id: 'exame',     label: 'Exames'      },
  { id: 'ciclo',     label: 'Ciclo'       },
  { id: 'intestino', label: 'Intestino'   },
  { id: 'checkin',   label: 'Check-ins'   },
  { id: 'documento', label: 'Documentos'  },
  { id: 'mapa',      label: 'Mapa'        },
];

const TIPOS_POR_FILTRO = {
  conduta:   ['conduta'],
  meta:      ['meta_criada', 'meta_concluida', 'meta_pausada'],
  consulta:  ['consulta'],
  exame:     ['exame'],
  ciclo:     ['ciclo', 'ciclo_padrao'],
  intestino: ['intestino'],
  checkin:   ['checkin'],
  documento: ['documento'],
  mapa:      ['mapa', 'mapa_melhora'],
};

// ── Helpers ────────────────────────────────────────────────────────────────
const MESES_PT = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho',
                  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

function mesAnoLabel(yyyyMM) {
  const [y, m] = yyyyMM.split('-');
  return `${MESES_PT[parseInt(m, 10) - 1]} ${y}`;
}

function dataShort(iso) {
  const d = new Date(iso + 'T12:00:00');
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
}

function tipoConsultaLabel(tipo) {
  if (!tipo) return null;
  if (tipo === 'primeira') return '1ª consulta';
  if (tipo === 'avaliacao') return 'Avaliação';
  const m = tipo.match(/^consulta_(\d+)$/);
  if (m) return `Consulta ${String(m[1]).padStart(2, '0')}`;
  return tipo;
}

// ── Detecção automática: padrão de fluxo intenso ──────────────────────────
// Regra: ≥2 dos últimos 3 períodos com intensidade_fluxo in ['intenso','muito_intenso']
function detectarPadraoFluxo(periodos) {
  const INTENSOS = new Set(['intenso', 'muito_intenso']);
  const comFluxo = periodos.filter(p => p.intensidade_fluxo);
  const ultimos3 = comFluxo.slice(0, 3);
  if (ultimos3.length < 3) return null;
  const nIntensas = ultimos3.filter(p => INTENSOS.has(p.intensidade_fluxo)).length;
  if (nIntensas < 2) return null;
  return {
    id: 'auto-padrao-fluxo',
    tipo: 'ciclo_padrao',
    icone: '✨',
    cor: 'var(--purple, #8b5cf6)',
    titulo: 'Padrão de fluxo intenso identificado',
    descricao: `${nIntensas} dos últimos 3 ciclos com fluxo intenso — avaliação automática`,
    data: ultimos3[0].inicio,
    automatico: true,
  };
}

// ── Detecção automática: melhora de eixo metabólico ───────────────────────
// Regra: dois marcos consecutivos com queda ≥10 pts no mesmo eixo
function detectarMelhorasEixo(marcos) {
  const milestones = [];
  for (let i = 0; i < marcos.length - 1; i++) {
    const atual    = marcos[i];
    const anterior = marcos[i + 1];
    if (!atual.scores || !anterior.scores) continue;
    for (const eixo of Object.keys(atual.scores)) {
      const sa = anterior.scores[eixo];
      const sb = atual.scores[eixo];
      if (typeof sa !== 'number' || typeof sb !== 'number') continue;
      const delta = sa - sb; // positivo = melhora
      if (delta >= 10) {
        milestones.push({
          id: `auto-melhora-${atual.id}-${eixo}`,
          tipo: 'mapa_melhora',
          icone: '✨',
          cor: 'var(--green)',
          titulo: `Melhora do eixo ${EIXOS[eixo]?.label ?? eixo}`,
          descricao: `${sa} → ${sb} (−${delta} pts)  ·  marco: ${atual.nome} — avaliação automática`,
          data: (atual.criado_em ?? atual.created_at).slice(0, 10),
          automatico: true,
        });
      }
    }
  }
  return milestones;
}

// ── Normalização central ───────────────────────────────────────────────────
function normalizarEventos({ consultas, exames, periodos, rastreios, checkins, documentos, marcos, condutas, metas }) {
  const ev = [];

  // Consultas realizadas
  for (const c of consultas) {
    const subtipo = tipoConsultaLabel(c.tipo);
    const descResumo = c.resumo
      ? (c.resumo.length > 70 ? c.resumo.slice(0, 70) + '…' : c.resumo)
      : null;
    ev.push({
      id: `consulta-${c.id}`,
      tipo: 'consulta',
      icone: '🩺',
      cor: 'var(--blue)',
      titulo: 'Consulta realizada',
      descricao: [subtipo, descResumo ?? (c.obs ? `"${c.obs}"` : null)].filter(Boolean).join('  ·  ') || null,
      data: c.data_hora.slice(0, 10),
      automatico: false,
    });
  }

  // Exames (um evento por registro, título reflete status atual)
  const TITULO_EXAME = {
    solicitado:           'Exame solicitado',
    aguardando_resultado: 'Exame aguardando resultado',
    resultado_disponivel: 'Nova análise disponível',
  };
  for (const e of exames) {
    const titulo = TITULO_EXAME[e.status];
    if (!titulo) continue;
    ev.push({
      id: `exame-${e.id}`,
      tipo: 'exame',
      icone: '🧪',
      cor: 'var(--green)',
      titulo,
      descricao: [e.titulo, e.categoria].filter(Boolean).join(' · ') || null,
      data: e.created_at.slice(0, 10),
      automatico: false,
    });
  }

  // Ciclo — menstruação registrada (sem ovulação estimada)
  for (const p of periodos) {
    ev.push({
      id: `ciclo-${p.id}`,
      tipo: 'ciclo',
      icone: '🌙',
      cor: 'var(--purple, #8b5cf6)',
      titulo: 'Menstruação registrada',
      descricao: p.fim
        ? `Término: ${dataShort(p.fim)}${p.intensidade_fluxo ? `  ·  Fluxo: ${p.intensidade_fluxo.replace('_', ' ')}` : ''}`
        : (p.intensidade_fluxo ? `Fluxo: ${p.intensidade_fluxo.replace('_', ' ')}` : null),
      data: p.inicio,
      automatico: false,
    });
  }

  // Padrão de fluxo intenso (automático)
  const padraoFluxo = detectarPadraoFluxo(periodos);
  if (padraoFluxo) ev.push(padraoFluxo);

  // Intestino — rastreios respondidos
  for (const r of rastreios) {
    ev.push({
      id: `rastreio-${r.id}`,
      tipo: 'intestino',
      icone: '💩',
      cor: 'var(--orange)',
      titulo: 'Rastreio intestinal respondido',
      descricao: null,
      data: r.respondido_em.slice(0, 10),
      automatico: false,
    });
  }

  // Check-ins respondidos — enriquecidos com contagem
  for (const c of checkins) {
    const nPerguntas = c.perguntas?.length ?? 0;
    const nRespostas = c.respostas
      ? (Array.isArray(c.respostas) ? c.respostas.length : Object.keys(c.respostas).length)
      : 0;
    ev.push({
      id: `checkin-${c.id}`,
      tipo: 'checkin',
      icone: '📋',
      cor: 'var(--gold-deep, #a08456)',
      titulo: 'Check-in respondido',
      descricao: nPerguntas > 0 ? `${nRespostas} de ${nPerguntas} perguntas respondidas` : null,
      data: c.respondido_em.slice(0, 10),
      automatico: false,
    });
  }

  // Documentos
  const TITULO_DOC = { enviado: 'Documento enviado', assinado: 'Documento assinado' };
  for (const d of documentos) {
    const titulo = TITULO_DOC[d.status];
    if (!titulo) continue;
    ev.push({
      id: `doc-${d.id}`,
      tipo: 'documento',
      icone: '📄',
      cor: 'var(--text2)',
      titulo,
      descricao: d.titulo || null,
      data: d.created_at.slice(0, 10),
      automatico: false,
    });
  }

  // Mapa metabólico — marcos salvos
  for (const m of marcos) {
    const scores = m.scores ?? {};
    const top2 = Object.entries(scores)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([k, v]) => `${EIXOS[k]?.label ?? k}: ${v}`)
      .join('  ·  ');
    ev.push({
      id: `marco-${m.id}`,
      tipo: 'mapa',
      icone: '🧬',
      cor: 'var(--amber)',
      titulo: 'Marco metabólico salvo',
      descricao: [m.nome, top2].filter(Boolean).join('  ·  ') || null,
      data: (m.criado_em ?? m.created_at).slice(0, 10),
      automatico: false,
    });
  }

  // Melhora de eixo metabólico (automático) — usa TODOS os marcos para comparação
  for (const ms of detectarMelhorasEixo(marcos)) ev.push(ms);

  // Metas terapêuticas
  for (const m of metas) {
    ev.push({
      id: `meta-criada-${m.id}`,
      tipo: 'meta_criada',
      icone: '🎯',
      cor: 'var(--blue)',
      titulo: `Meta criada — ${m.titulo}`,
      descricao: m.eixo || null,
      data: m.criado_em,
      automatico: false,
    });
    if (m.status === 'concluida' && m.concluido_em) {
      ev.push({
        id: `meta-concluida-${m.id}`,
        tipo: 'meta_concluida',
        icone: '✅',
        cor: 'var(--green)',
        titulo: `Meta concluída — ${m.titulo}`,
        descricao: m.eixo || null,
        data: m.concluido_em,
        automatico: false,
      });
    }
    if (m.status === 'pausada' && m.pausado_em) {
      ev.push({
        id: `meta-pausada-${m.id}`,
        tipo: 'meta_pausada',
        icone: '⏸',
        cor: 'var(--text3)',
        titulo: `Meta pausada — ${m.titulo}`,
        descricao: m.eixo || null,
        data: m.pausado_em,
        automatico: false,
      });
    }
  }

  // Condutas registradas
  for (const c of condutas) {
    const partes = [];
    if (c.objetivo_principal) partes.push(c.objetivo_principal);
    const nItens = c.condutas?.length ?? 0;
    if (nItens > 0) partes.push(`${nItens} conduta${nItens === 1 ? '' : 's'}`);
    ev.push({
      id: `conduta-${c.id}`,
      tipo: 'conduta',
      icone: '🎯',
      cor: 'var(--blue)',
      titulo: `Conduta registrada — ${c.titulo}`,
      descricao: partes.join('  ·  ') || null,
      data: c.data,
      automatico: false,
    });
  }

  return ev.sort((a, b) => b.data.localeCompare(a.data));
}

function agruparPorMes(eventos) {
  const grupos = {};
  for (const e of eventos) {
    const key = e.data.slice(0, 7);
    if (!grupos[key]) grupos[key] = [];
    grupos[key].push(e);
  }
  return Object.entries(grupos)
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, evs]) => ({ key, label: mesAnoLabel(key), eventos: evs }));
}

// ── Componente principal ───────────────────────────────────────────────────
export default function LinhaTempo({ pacienteId, nutriId }) {
  const [dados, setDados] = useState(null);
  const [filtro, setFiltro] = useState('todos');

  useEffect(() => {
    let active = true;
    async function load() {
      const corte = new Date();
      corte.setMonth(corte.getMonth() - 24);
      const corteIso = corte.toISOString().slice(0, 10);

      const [
        consultasRes, examesRes, periodosRes,
        rastreiosRes, checkinsRes, documentosRes, marcosRes, condutasRes, metasRes,
      ] = await Promise.all([
        supabase.from('consultas')
          .select('id, data_hora, tipo, obs, resumo')
          .eq('paciente_id', pacienteId).eq('status', 'realizada')
          .gte('data_hora', corteIso + 'T00:00:00')
          .order('data_hora', { ascending: false }),
        supabase.from('exames_arquivos')
          .select('id, titulo, categoria, status, created_at')
          .eq('paciente_id', pacienteId)
          .gte('created_at', corteIso + 'T00:00:00')
          .order('created_at', { ascending: false }),
        supabase.from('ciclo_periodos')
          .select('id, inicio, fim, intensidade_fluxo')
          .eq('paciente_id', pacienteId)
          .gte('inicio', corteIso)
          .order('inicio', { ascending: false }),
        supabase.from('intestino_rastreio_solicitacoes')
          .select('id, respondido_em')
          .eq('paciente_id', pacienteId)
          .not('respondido_em', 'is', null)
          .gte('respondido_em', corteIso + 'T00:00:00')
          .order('respondido_em', { ascending: false }),
        supabase.from('checkin_envios')
          .select('id, respondido_em, perguntas, respostas')
          .eq('paciente_id', pacienteId)
          .not('respondido_em', 'is', null)
          .gte('respondido_em', corteIso + 'T00:00:00')
          .order('respondido_em', { ascending: false }),
        supabase.from('documentos')
          .select('id, titulo, tipo, status, created_at')
          .eq('paciente_id', pacienteId)
          .gte('created_at', corteIso + 'T00:00:00')
          .order('created_at', { ascending: false }),
        // Marcos: sem limite de data — necessário para detecção de melhora entre marcos
        supabase.from('mapa_marcos')
          .select('id, nome, scores, obs, criado_em, created_at')
          .eq('paciente_id', pacienteId)
          .order('criado_em', { ascending: false }),
        supabase.from('condutas')
          .select('id, titulo, objetivo_principal, condutas, data')
          .eq('paciente_id', pacienteId)
          .gte('data', corteIso)
          .order('data', { ascending: false }),
        // Metas: sem filtro de data — concluido_em/pausado_em podem ser recentes
        // mesmo que criado_em seja antigo
        supabase.from('metas_terapeuticas')
          .select('id, titulo, eixo, status, criado_em, concluido_em, pausado_em')
          .eq('paciente_id', pacienteId)
          .order('criado_em', { ascending: false }),
      ]);

      if (!active) return;
      setDados({
        consultas:  consultasRes.data  ?? [],
        exames:     examesRes.data     ?? [],
        periodos:   periodosRes.data   ?? [],
        rastreios:  rastreiosRes.data  ?? [],
        checkins:   checkinsRes.data   ?? [],
        documentos: documentosRes.data ?? [],
        marcos:     marcosRes.data     ?? [],
        condutas:   condutasRes.data   ?? [],
        metas:      metasRes.data      ?? [],
      });
    }
    load();
    return () => { active = false; };
  }, [pacienteId, nutriId]);

  const eventos = useMemo(() => dados ? normalizarEventos(dados) : [], [dados]);

  const eventosFiltrados = useMemo(() => {
    if (filtro === 'todos') return eventos;
    const tipos = TIPOS_POR_FILTRO[filtro] ?? [filtro];
    return eventos.filter(e => tipos.includes(e.tipo));
  }, [eventos, filtro]);

  const grupos = useMemo(() => agruparPorMes(eventosFiltrados), [eventosFiltrados]);

  const totalPorFiltro = useMemo(() => {
    const result = { todos: eventos.length };
    for (const f of FILTROS.slice(1)) {
      const tipos = TIPOS_POR_FILTRO[f.id] ?? [f.id];
      result[f.id] = eventos.filter(e => tipos.includes(e.tipo)).length;
    }
    return result;
  }, [eventos]);

  if (dados === null) {
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;
  }

  return (
    <>
      {/* ── Filtros ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
        {FILTROS.map(f => {
          const count = totalPorFiltro[f.id] ?? 0;
          const ativo = filtro === f.id;
          return (
            <button key={f.id} onClick={() => setFiltro(f.id)}
              style={{
                padding: '5px 12px', borderRadius: 20,
                fontSize: 12, fontWeight: 500,
                border: '0.5px solid ' + (ativo ? 'var(--dark)' : 'var(--border)'),
                background: ativo ? 'var(--dark)' : 'var(--white)',
                color: ativo ? '#fff' : (count === 0 && f.id !== 'todos' ? 'var(--text4)' : 'var(--text2)'),
                cursor: 'pointer', fontFamily: 'var(--font-sans)',
                transition: 'all .15s',
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}>
              {f.label}
              {count > 0 && (
                <span style={{
                  fontSize: 10, fontWeight: 600,
                  background: ativo ? 'rgba(255,255,255,.2)' : 'var(--bg3, #eae4dc)',
                  color: ativo ? '#fff' : 'var(--text3)',
                  borderRadius: 10, padding: '1px 5px',
                }}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Timeline ── */}
      {grupos.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-sub">
            {filtro === 'todos'
              ? 'Nenhum evento clínico registrado nos últimos 24 meses.'
              : `Nenhum evento de "${FILTROS.find(f => f.id === filtro)?.label}" nos últimos 24 meses.`}
          </div>
        </div>
      ) : (
        grupos.map(grupo => (
          <div key={grupo.key} style={{ marginBottom: 28 }}>
            {/* Cabeçalho do mês */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              marginBottom: 14,
            }}>
              <span style={{
                fontSize: 11, fontWeight: 600, letterSpacing: 1.5,
                textTransform: 'uppercase', color: 'var(--text3)',
                whiteSpace: 'nowrap',
              }}>
                {grupo.label}
              </span>
              <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
            </div>

            {/* Eventos */}
            <div style={{ paddingLeft: 4 }}>
              {grupo.eventos.map((ev, idx) => (
                <EventoRow
                  key={ev.id}
                  evento={ev}
                  isLast={idx === grupo.eventos.length - 1}
                />
              ))}
            </div>
          </div>
        ))
      )}
    </>
  );
}

// ── Linha de evento ────────────────────────────────────────────────────────
function EventoRow({ evento, isLast }) {
  const { icone, cor, titulo, descricao, data, automatico } = evento;

  return (
    <div style={{ display: 'flex', gap: 0, position: 'relative', minHeight: 36 }}>
      {/* Trilho vertical + dot */}
      <div style={{
        width: 24, flexShrink: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
      }}>
        <div style={{
          width: automatico ? 8 : 10,
          height: automatico ? 8 : 10,
          borderRadius: '50%', marginTop: 5, flexShrink: 0,
          background: automatico ? 'transparent' : cor,
          border: automatico ? `1.5px dashed ${cor}` : 'none',
          zIndex: 1,
        }} />
        {!isLast && (
          <div style={{
            flex: 1, width: '0.5px', background: 'var(--border)',
            marginTop: 3, marginBottom: 3,
          }} />
        )}
      </div>

      {/* Conteúdo */}
      <div style={{
        flex: 1, paddingBottom: isLast ? 6 : 14, paddingLeft: 10,
      }}>
        <div style={{
          ...(automatico ? {
            background: 'var(--bg2)',
            border: '0.5px dashed var(--border)',
            borderRadius: 8, padding: '7px 10px',
          } : {}),
        }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{icone}</span>
            <span style={{
              fontSize: 11, color: 'var(--text3)',
              flexShrink: 0, lineHeight: 1.6,
            }}>
              {dataShort(data)}
            </span>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)', lineHeight: 1.5 }}>
              {titulo}
            </span>
          </div>
          {descricao && (
            <div style={{
              fontSize: 12, color: 'var(--text3)',
              marginTop: 3, marginLeft: 22,
              lineHeight: 1.5,
            }}>
              {descricao}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
