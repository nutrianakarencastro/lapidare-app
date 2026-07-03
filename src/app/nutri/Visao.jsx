import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { brl, dataBR, iniciais, statusParcela } from '../../lib/utils.js';
import { calcularMapaVivo, dataInicioMapaVivo, EIXOS_ORDEM } from '../../lib/mapaUtils.js';
import { EIXOS } from '../../lib/cicloUtils.js';

function saudacao() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia';
  if (h >= 12 && h < 18) return 'Boa tarde';
  return 'Boa noite';
}

const CONSULTAS_POR_PLANO = {
  trimestral:  6,
  semestral:   12,
  consultoria: 1,
};

const STORAGE_OCULTAR_META = 'lapidare:ocultarMeta';
const LIMIAR_ATENCAO   = 55;
const DIAS_SEM_REGISTRO = 14;
const MIN_CONFIANCA     = 30;

export default function Visao() {
  const navigate = useNavigate();
  const { user, profile } = useSession();
  const [carregando, setCarregando]                     = useState(true);
  const [pacientes, setPacientes]                       = useState([]);
  const [consultasSemana, setConsultasSemana]           = useState([]);
  const [parcelasSemana, setParcelasSemana]             = useState([]);
  const [checkinsPendentes, setCheckinsPendentes]       = useState([]);
  const [planosTerminando, setPlanosTerminando]         = useState([]);
  const [alertasRelacionais, setAlertasRelacionais]     = useState([]);
  const [orientacoesTotal,      setOrientacoesTotal]      = useState(0);
  const [orientacoesAtribuidas, setOrientacoesAtribuidas] = useState(0);
  const [orientacoesNaoVistas,  setOrientacoesNaoVistas]  = useState(0);
  const [orientacoesConcluidas, setOrientacoesConcluidas] = useState(0);
  const [receitaMes, setReceitaMes]                     = useState(0);
  const [metaMensal, setMetaMensal]                     = useState(null);
  const [ocultarMeta, setOcultarMeta]                   = useState(() => {
    return localStorage.getItem(STORAGE_OCULTAR_META) === '1';
  });

  // ── Clínica ──
  const [examesSolicitados,      setExamesSolicitados]      = useState([]);
  const [examesAguardando,       setExamesAguardando]       = useState([]);
  const [rastreiosPendentes,     setRastreiosPendentes]     = useState([]);
  const [documentosSemAssinatura, setDocumentosSemAssinatura] = useState([]);
  const [sintomasPorPac,         setSintomasPorPac]         = useState({});
  const [ultimoRegPorPac,        setUltimoRegPorPac]        = useState({});

  // ── Agenda como gatilho ──
  const [checkinsRespondidos,   setCheckinsRespondidos]    = useState([]);
  const [ultimoFollowupPorPac,  setUltimoFollowupPorPac]  = useState({});

  function toggleOcultarMeta() {
    const novo = !ocultarMeta;
    setOcultarMeta(novo);
    localStorage.setItem(STORAGE_OCULTAR_META, novo ? '1' : '0');
  }

  useEffect(() => {
    if (!user) return;
    let active = true;
    async function carregar() {
      const hoje = new Date();
      const dow = (hoje.getDay() + 6) % 7;
      const segunda = new Date(hoje); segunda.setDate(hoje.getDate() - dow); segunda.setHours(0, 0, 0, 0);
      const domingo = new Date(segunda); domingo.setDate(segunda.getDate() + 6); domingo.setHours(23, 59, 59, 999);
      const inicioMes  = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0, 10);
      const fimMes     = new Date(hoje.getFullYear(), hoje.getMonth() + 1, 0).toISOString().slice(0, 10);
      const isoSegunda = segunda.toISOString();
      const isoDomingo = domingo.toISOString();
      const dataSegunda = segunda.toISOString().slice(0, 10);
      const dataDomingo = domingo.toISOString().slice(0, 10);
      const dias30atras = new Date(Date.now() - 30 * 86_400_000).toISOString();
      const dias7atras  = new Date(Date.now() - 7  * 86_400_000).toISOString().slice(0, 10);
      const dias3atras  = new Date(Date.now() - 3  * 86_400_000).toISOString();

      // ── Fase 1: queries independentes de IDs de pacientes ──────────────────
      const [
        pacRes, agSemanaRes, parcRes, checkRes,
        parcelasMesRes, allConsultasRes, nutriRes,
        msgRes, feedRes, supRes, supLogRes,
        orientTotalRes, orientAssignRes,
        examesSolRes, examesAguRes, rastreiosRes, documentosRes,
        checkinsRecentesRes, followupsDataRes,
      ] = await Promise.all([
        supabase.from('pacientes').select('id, nome, tipo_plano, nascimento').eq('nutri_id', user.id),
        supabase.from('consultas').select('id, data_hora, tipo, duracao_min, paciente:pacientes(id, nome)')
          .eq('nutri_id', user.id).neq('status', 'cancelada')
          .gte('data_hora', isoSegunda).lte('data_hora', isoDomingo)
          .order('data_hora'),
        supabase.from('parcelas').select('id, valor, vencimento, status, venda:vendas(servico, paciente:pacientes(id, nome))')
          .eq('nutri_id', user.id).neq('status', 'pago')
          .lte('vencimento', dataDomingo)
          .order('vencimento'),
        supabase.from('checkin_envios').select('id, enviado_em, paciente:pacientes(id, nome)')
          .eq('nutri_id', user.id).is('respondido_em', null).is('cancelado_em', null)
          .order('enviado_em'),
        supabase.from('parcelas').select('valor, data_pgto')
          .eq('nutri_id', user.id).eq('status', 'pago')
          .gte('data_pgto', inicioMes).lte('data_pgto', fimMes),
        supabase.from('consultas').select('paciente_id, status')
          .eq('nutri_id', user.id).neq('status', 'cancelada'),
        supabase.from('nutris').select('meta_mensal').eq('id', user.id).maybeSingle(),
        supabase.from('mensagens').select('paciente_id, created_at')
          .eq('nutri_id', user.id).eq('de', 'paciente')
          .gte('created_at', dias30atras)
          .order('created_at', { ascending: false }),
        supabase.from('feed_pratos').select('paciente_id, created_at')
          .gte('created_at', dias30atras)
          .order('created_at', { ascending: false }),
        supabase.from('suplementos').select('id, paciente_id')
          .eq('nutri_id', user.id).eq('ativo', true),
        supabase.from('suplementos_logs').select('suplemento_id, paciente_id, data, tomado')
          .gte('data', dias7atras),
        supabase.from('orientacoes').select('id', { count: 'exact', head: true })
          .eq('nutri_id', user.id).eq('ativo', true),
        supabase.from('orientacoes_pacientes').select('status')
          .eq('nutri_id', user.id),
        // clínica — pendências
        supabase.from('exames_pedidos').select('id, titulo, categoria, paciente_id')
          .eq('nutri_id', user.id).eq('status', 'solicitado'),
        supabase.from('exames_pedidos').select('id, titulo, categoria, paciente_id')
          .eq('nutri_id', user.id).eq('status', 'recebido').is('avaliacao_id', null),
        supabase.from('intestino_rastreio_solicitacoes').select('id, paciente_id, solicitado_em')
          .eq('nutri_id', user.id).is('respondido_em', null),
        supabase.from('documentos').select('id, titulo, tipo, paciente_id')
          .eq('nutri_id', user.id).eq('status', 'enviado'),
        supabase.from('checkin_envios')
          .select('id, respondido_em, paciente:pacientes(id, nome)')
          .eq('nutri_id', user.id).not('respondido_em', 'is', null)
          .gte('respondido_em', dias3atras).order('respondido_em', { ascending: false }),
        supabase.from('followups')
          .select('paciente_id, data, created_at')
          .eq('nutri_id', user.id)
          .order('data', { ascending: false }).order('created_at', { ascending: false }),
      ]);

      if (!active) return;

      // ── Processar dados existentes ──────────────────────────────────────────
      setPacientes(pacRes.data ?? []);
      setConsultasSemana(agSemanaRes.data ?? []);
      setParcelasSemana(parcRes.data ?? []);
      setCheckinsPendentes(checkRes.data ?? []);

      const receita = (parcelasMesRes.data ?? []).reduce((a, p) => a + Number(p.valor ?? 0), 0);
      setReceitaMes(receita);
      setMetaMensal(nutriRes.data?.meta_mensal ?? null);

      const contagem = {};
      for (const c of allConsultasRes.data ?? []) {
        contagem[c.paciente_id] = (contagem[c.paciente_id] ?? 0) + 1;
      }
      const terminando = (pacRes.data ?? [])
        .map(p => {
          const esperado = CONSULTAS_POR_PLANO[p.tipo_plano];
          if (!esperado) return null;
          const feitas = contagem[p.id] ?? 0;
          const restam = esperado - feitas;
          if (restam > 2) return null;
          return { id: p.id, nome: p.nome, tipo_plano: p.tipo_plano, feitas, esperado, restam, vencido: restam <= 0 };
        })
        .filter(Boolean);
      setPlanosTerminando(terminando);

      const todasPacientes    = pacRes.data ?? [];
      const ultimaMsgPorPac   = {};
      for (const m of msgRes.data ?? []) {
        if (!ultimaMsgPorPac[m.paciente_id]) ultimaMsgPorPac[m.paciente_id] = m.created_at;
      }
      const ultimoFeedPorPac  = {};
      for (const f of feedRes.data ?? []) {
        if (!ultimoFeedPorPac[f.paciente_id]) ultimoFeedPorPac[f.paciente_id] = f.created_at;
      }
      const supAtivosPorPac   = {};
      for (const s of supRes.data ?? []) {
        supAtivosPorPac[s.paciente_id] = (supAtivosPorPac[s.paciente_id] ?? 0) + 1;
      }
      const supTomadosPorPac  = {};
      for (const l of supLogRes.data ?? []) {
        if (l.tomado) supTomadosPorPac[l.paciente_id] = (supTomadosPorPac[l.paciente_id] ?? 0) + 1;
      }

      const hojeMD  = new Date();
      const hojeMes = hojeMD.getMonth() + 1;
      const hojeDia = hojeMD.getDate();

      const alertas = [];
      for (const p of todasPacientes) {
        if (p.nascimento) {
          const n = new Date(p.nascimento + 'T12:00:00');
          if (n.getMonth() + 1 === hojeMes && n.getDate() === hojeDia) {
            const idade = hojeMD.getFullYear() - n.getFullYear();
            alertas.push({
              tipo: 'aniversario', paciente_id: p.id, nome: p.nome,
              emoji: '🎂', cor: 'var(--gold-deep, #a08456)',
              titulo: `Aniversário de ${p.nome.split(' ')[0]}`,
              descricao: `Faz ${idade} anos hoje — mande uma mensagem!`,
              prioridade: 1,
            });
          }
        }
        const ultMsg     = ultimaMsgPorPac[p.id];
        const diasSemMsg = ultMsg ? Math.floor((Date.now() - new Date(ultMsg).getTime()) / 86_400_000) : null;
        if (diasSemMsg !== null && diasSemMsg >= 7) {
          alertas.push({
            tipo: 'chat', paciente_id: p.id, nome: p.nome,
            emoji: '🔕', cor: 'var(--orange)',
            titulo: `${p.nome.split(' ')[0]} sumiu do chat`,
            descricao: `Não responde há ${diasSemMsg} dias`,
            prioridade: 3,
          });
        }
        const ultFeed      = ultimoFeedPorPac[p.id];
        const diasSemFeed  = ultFeed ? Math.floor((Date.now() - new Date(ultFeed).getTime()) / 86_400_000) : null;
        if (diasSemFeed !== null && diasSemFeed >= 14) {
          alertas.push({
            tipo: 'feed', paciente_id: p.id, nome: p.nome,
            emoji: '📷', cor: 'var(--blue)',
            titulo: `${p.nome.split(' ')[0]} parou de postar pratos`,
            descricao: `Último post há ${diasSemFeed} dias`,
            prioridade: 4,
          });
        }
        const ativos = supAtivosPorPac[p.id] ?? 0;
        if (ativos > 0) {
          const esperado = ativos * 7;
          const cumprido = supTomadosPorPac[p.id] ?? 0;
          const pct = Math.round((cumprido / esperado) * 100);
          if (pct < 40) {
            alertas.push({
              tipo: 'suplementos', paciente_id: p.id, nome: p.nome,
              emoji: '💊', cor: 'var(--red)',
              titulo: `${p.nome.split(' ')[0]} com baixa aderência`,
              descricao: `${pct}% nos suplementos (últimos 7 dias)`,
              prioridade: 2,
            });
          }
        }
      }
      alertas.sort((a, b) => a.prioridade - b.prioridade);
      setAlertasRelacionais(alertas);

      setOrientacoesTotal(orientTotalRes.count ?? 0);
      const assigns = orientAssignRes.data ?? [];
      setOrientacoesAtribuidas(assigns.length);
      setOrientacoesNaoVistas(assigns.filter(a => a.status === 'nao_visualizada').length);
      setOrientacoesConcluidas(assigns.filter(a => a.status === 'concluida').length);

      // ── Clínica — pendências ─────────────────────────────────────────────────
      setExamesSolicitados(examesSolRes.data ?? []);
      setExamesAguardando(examesAguRes.data ?? []);
      setRastreiosPendentes(rastreiosRes.data ?? []);
      setDocumentosSemAssinatura(documentosRes.data ?? []);

      setCheckinsRespondidos(checkinsRecentesRes.data ?? []);

      const ultFup = {};
      for (const f of followupsDataRes.data ?? []) {
        if (!ultFup[f.paciente_id]) {
          ultFup[f.paciente_id] = f.data ?? f.created_at.slice(0, 10);
        }
      }
      setUltimoFollowupPorPac(ultFup);

      // ── Fase 2: dados clínicos que precisam dos IDs de pacientes ────────────
      const ids = (pacRes.data ?? []).map(p => p.id);
      if (ids.length > 0) {
        const dataMapa = dataInicioMapaVivo();
        const data60   = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);

        const [sintomasRes, intestinoRes] = await Promise.all([
          supabase.from('ciclo_sintomas_diarios')
            .select('*')
            .in('paciente_id', ids)
            .gte('data', dataMapa)
            .order('data', { ascending: false }),
          supabase.from('intestino_logs')
            .select('paciente_id, data')
            .in('paciente_id', ids)
            .gte('data', data60)
            .order('data', { ascending: false }),
        ]);

        if (!active) return;

        const sintPorPac = {};
        for (const s of sintomasRes.data ?? []) {
          if (!sintPorPac[s.paciente_id]) sintPorPac[s.paciente_id] = [];
          sintPorPac[s.paciente_id].push(s);
        }

        const ultimoReg = {};
        for (const pid of ids) ultimoReg[pid] = sintPorPac[pid]?.[0]?.data ?? null;
        for (const log of intestinoRes.data ?? []) {
          const cur = ultimoReg[log.paciente_id];
          if (!cur || log.data > cur) ultimoReg[log.paciente_id] = log.data;
        }

        setSintomasPorPac(sintPorPac);
        setUltimoRegPorPac(ultimoReg);
      }

      setCarregando(false);
    }
    carregar();
    return () => { active = false; };
  }, [user]);

  // ── Cálculos derivados — visão geral ──────────────────────────────────────
  const totalParcelas = parcelasSemana.reduce((a, p) => a + Number(p.valor ?? 0), 0);
  const atrasadas     = parcelasSemana.filter(p => statusParcela(p) === 'atrasado').length;
  const semNome       = profile?.nome?.split(' ')[0] ?? '';
  const pctMeta       = metaMensal && metaMensal > 0 ? Math.min(100, (receitaMes / metaMensal) * 100) : 0;
  const faltaMeta     = metaMensal ? Math.max(0, metaMensal - receitaMes) : 0;

  // ── Cálculos derivados — clínica ─────────────────────────────────────────
  const hojeStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const amanhaStr = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  }, []);

  const nomePorPac = useMemo(
    () => Object.fromEntries(pacientes.map(p => [p.id, p.nome])),
    [pacientes],
  );

  const mapasPorPac = useMemo(() => {
    const result = {};
    for (const p of pacientes) {
      const sintomas = sintomasPorPac[p.id] ?? [];
      result[p.id] = sintomas.length > 0 ? calcularMapaVivo(sintomas, []) : null;
    }
    return result;
  }, [pacientes, sintomasPorPac]);

  const dadosClinicos = useMemo(() => {
    return pacientes.map(p => {
      const mapa   = mapasPorPac[p.id];
      const scores = mapa?.scores ?? null;

      const eixosElevados = scores
        ? EIXOS_ORDEM
            .filter(k => (scores[k] ?? 0) >= LIMIAR_ATENCAO)
            .sort((a, b) => (scores[b] ?? 0) - (scores[a] ?? 0))
        : [];

      const maxScore = scores ? Math.max(...Object.values(scores)) : 0;

      const ultimoReg       = ultimoRegPorPac[p.id] ?? null;
      const diasSemRegistro = ultimoReg
        ? Math.floor(
            (new Date(hojeStr + 'T00:00:00') - new Date(ultimoReg + 'T00:00:00')) / 86_400_000,
          )
        : null;

      return {
        ...p,
        mapa,
        scores,
        eixosElevados,
        maxScore,
        ultimoReg,
        diasSemRegistro,
        temDados:  !!mapa,
        confianca: mapa?.confianca ?? 0,
      };
    });
  }, [pacientes, mapasPorPac, ultimoRegPorPac, hojeStr]);

  const precisamAtencao = useMemo(
    () => dadosClinicos
      .filter(p => p.temDados && p.eixosElevados.length > 0)
      .sort((a, b) => b.maxScore - a.maxScore),
    [dadosClinicos],
  );

  const semRegistroRecente = useMemo(
    () => dadosClinicos
      .filter(p => p.diasSemRegistro === null || p.diasSemRegistro >= DIAS_SEM_REGISTRO)
      .sort((a, b) => {
        if (a.diasSemRegistro === null && b.diasSemRegistro === null) return 0;
        if (a.diasSemRegistro === null) return -1;
        if (b.diasSemRegistro === null) return 1;
        return b.diasSemRegistro - a.diasSemRegistro;
      }),
    [dadosClinicos],
  );

  const semDadosSuficientes = useMemo(
    () => dadosClinicos
      .filter(p => p.temDados && p.confianca < MIN_CONFIANCA)
      .sort((a, b) => a.confianca - b.confianca),
    [dadosClinicos],
  );

  // ── P1: pacientes com consulta hoje ou amanhã ─────────────────────────────
  const pacientesHojeAmanha = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const c of consultasSemana) {
      const dc = new Date(c.data_hora).toISOString().slice(0, 10);
      if ((dc === hojeStr || dc === amanhaStr) && c.paciente?.id && !seen.has(c.paciente.id)) {
        seen.add(c.paciente.id);
        result.push({ id: c.paciente.id, nome: c.paciente.nome, consultaData: c.data_hora, consultaTipo: c.tipo });
      }
    }
    return result.sort((a, b) => new Date(a.consultaData) - new Date(b.consultaData));
  }, [consultasSemana, hojeStr, amanhaStr]);

  // ── P2: pacientes com check-in pendente ou respondido ≤3 dias ────────────
  const pacientesCheckinRecente = useMemo(() => {
    const seen = new Set();
    const result = [];
    for (const c of checkinsPendentes) {
      if (c.paciente?.id && !seen.has(c.paciente.id)) {
        seen.add(c.paciente.id);
        result.push({ id: c.paciente.id, nome: c.paciente.nome, checkinStatus: 'pendente', checkinData: c.enviado_em });
      }
    }
    for (const c of checkinsRespondidos) {
      if (c.paciente?.id && !seen.has(c.paciente.id)) {
        seen.add(c.paciente.id);
        result.push({ id: c.paciente.id, nome: c.paciente.nome, checkinStatus: 'respondido', checkinData: c.respondido_em });
      }
    }
    return result;
  }, [checkinsPendentes, checkinsRespondidos]);

  // ── P3: revisão periódica — pacientes não em P1/P2 sem followup há >15 dias ──
  const pacientesRevisaoPendente = useMemo(() => {
    const p1Ids = new Set(pacientesHojeAmanha.map(p => p.id));
    const p2Ids = new Set(pacientesCheckinRecente.map(p => p.id));
    return pacientes
      .filter(p => !p1Ids.has(p.id) && !p2Ids.has(p.id))
      .map(p => {
        const ultimo = ultimoFollowupPorPac[p.id] ?? null;
        const dias = ultimo
          ? Math.floor((Date.now() - new Date(ultimo + 'T00:00:00').getTime()) / 86_400_000)
          : null;
        return { ...p, ultimaRevisao: ultimo, diasSemRevisao: dias };
      })
      .filter(p => p.diasSemRevisao === null || p.diasSemRevisao > 15)
      .sort((a, b) => {
        if (a.diasSemRevisao === null && b.diasSemRevisao === null) return 0;
        if (a.diasSemRevisao === null) return -1;
        if (b.diasSemRevisao === null) return 1;
        return b.diasSemRevisao - a.diasSemRevisao;
      });
  }, [pacientes, pacientesHojeAmanha, pacientesCheckinRecente, ultimoFollowupPorPac]);

  return (
    <>
      <div className="page-title">{semNome ? `${saudacao()}, ${semNome}.` : 'Visão geral'}</div>
      <div className="page-sub">O que está acontecendo no seu consultório hoje</div>

      {/* ─── STATS RÁPIDAS ─── */}
      <div className="g3">
        <div className="stat">
          <div className="stat-lbl">Pacientes ativas</div>
          <div className="stat-val">{pacientes.length}</div>
          <div className="stat-diff">{pacientes.length === 0 ? 'nenhuma ainda' : 'no total'}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Consultas esta semana</div>
          <div className="stat-val">{consultasSemana.length}</div>
          <div className="stat-diff">{consultasSemana.length === 0 ? 'agenda livre' : 'agendadas'}</div>
        </div>
        <div className="stat">
          <div className="stat-lbl">Receita do mês</div>
          <div className="stat-val">{ocultarMeta ? '••••' : brl(receitaMes)}</div>
          <div className="stat-diff">
            {metaMensal
              ? (ocultarMeta ? '—' : `de ${brl(metaMensal)} de meta`)
              : 'registre no financeiro'}
          </div>
        </div>
      </div>

      {/* ─── BARRA DE META ─── */}
      <div className="card" style={{ padding: '16px 18px', marginBottom: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 500 }}>
              Meta financeira do mês
            </span>
            <button onClick={toggleOcultarMeta}
              title={ocultarMeta ? 'Mostrar valores' : 'Ocultar valores'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text3)', padding: 2, display: 'inline-flex' }}>
              <i className={`ti ti-${ocultarMeta ? 'eye-off' : 'eye'}`} style={{ fontSize: 15 }} aria-hidden="true"></i>
            </button>
          </div>
          <button onClick={() => navigate('/nutri/previsibilidade')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: 'var(--gold-deep, #a08456)', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <i className="ti ti-calculator" style={{ fontSize: 13 }} aria-hidden="true"></i>
            {metaMensal ? 'Ajustar em Previsibilidade →' : 'Definir em Previsibilidade →'}
          </button>
        </div>

        {metaMensal ? (
          <>
            <div style={{ height: 12, borderRadius: 6, background: 'var(--bg3, #eae4dc)', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%', width: `${pctMeta}%`,
                background: pctMeta >= 100
                  ? 'linear-gradient(90deg, var(--green) 0%, #5a8f30 100%)'
                  : 'linear-gradient(90deg, var(--amber) 0%, var(--gold-deep, #a08456) 100%)',
                borderRadius: 6, transition: 'width .4s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 13, color: 'var(--text2)' }}>
              {ocultarMeta ? (
                <><span>•••• de ••••</span><span style={{ color: 'var(--text3)' }}>—</span></>
              ) : (
                <>
                  <span><strong>{brl(receitaMes)}</strong> de {brl(metaMensal)}</span>
                  <span style={{ color: pctMeta >= 100 ? 'var(--green)' : 'var(--text3)' }}>
                    {pctMeta >= 100
                      ? `✓ meta superada em ${brl(receitaMes - metaMensal)}`
                      : `faltam ${brl(faltaMeta)} · ${Math.round(pctMeta)}%`}
                  </span>
                </>
              )}
            </div>
          </>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text3)' }}>
            Calcule sua meta mensal em <strong>Previsibilidade</strong> — a partir de gastos fixos,
            ticket médio e horas disponíveis. Aqui mostramos o progresso real.
          </div>
        )}
      </div>

      {/* ─── ALERTAS DA SEMANA ─── */}
      <div className="section-label" style={{ marginTop: 8 }}>Atenção esta semana</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 18 }}>
        <NotifCard
          icon="clipboard-check"
          color="var(--orange)"
          titulo="Check-ins pendentes"
          count={checkinsPendentes.length}
          descricao={checkinsPendentes.length === 0
            ? 'Tudo respondido ✓'
            : `${checkinsPendentes.length} paciente${checkinsPendentes.length === 1 ? '' : 's'} ainda não respondeu`}
          itens={checkinsPendentes.slice(0, 3).map(c => ({ label: c.paciente?.nome ?? '—', sub: `enviado ${dataBR(c.enviado_em)}` }))}
          onClick={() => navigate('/nutri/checkins')}
        />
        <NotifCard
          icon="calendar"
          color="var(--blue)"
          titulo="Consultas da semana"
          count={consultasSemana.length}
          descricao={consultasSemana.length === 0 ? 'Agenda livre' : `${consultasSemana.length} agendada${consultasSemana.length === 1 ? '' : 's'}`}
          itens={consultasSemana.slice(0, 3).map(c => ({
            label: c.paciente?.nome ?? '—',
            sub: new Date(c.data_hora).toLocaleString('pt-BR', { weekday: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', ''),
          }))}
          onClick={() => navigate('/nutri/agenda')}
        />
        <NotifCard
          icon="cash"
          color={atrasadas > 0 ? 'var(--red)' : 'var(--green)'}
          titulo="Cobranças até domingo"
          count={parcelasSemana.length}
          descricao={parcelasSemana.length === 0
            ? 'Sem cobranças pendentes'
            : `${brl(totalParcelas)} a receber${atrasadas > 0 ? ` · ${atrasadas} em atraso` : ''}`}
          itens={parcelasSemana.slice(0, 3).map(p => ({
            label: p.venda?.paciente?.nome ?? 'Avulso',
            sub: `${brl(p.valor)} · venc. ${dataBR(p.vencimento)}${statusParcela(p) === 'atrasado' ? ' ⚠️' : ''}`,
          }))}
          onClick={() => navigate('/nutri/financeiro')}
        />
        <NotifCard
          icon="notebook"
          color="var(--gold-deep, #a08456)"
          titulo="Orientações"
          count={orientacoesNaoVistas}
          descricao={
            orientacoesTotal === 0
              ? 'Nenhuma criada ainda'
              : orientacoesNaoVistas === 0
                ? 'Tudo visualizado ✓'
                : `${orientacoesNaoVistas} aguardam visualização`
          }
          itens={orientacoesTotal > 0 ? [{
            label: `${orientacoesTotal} criada${orientacoesTotal === 1 ? '' : 's'}`,
            sub: `${orientacoesAtribuidas} atribuída${orientacoesAtribuidas === 1 ? '' : 's'} · ${orientacoesConcluidas} concluída${orientacoesConcluidas === 1 ? '' : 's'}`,
          }] : []}
          onClick={() => navigate('/nutri/biblioteca')}
        />
        <NotifCard
          icon="alert-triangle"
          color="var(--gold-deep, #a08456)"
          titulo="Planos terminando"
          count={planosTerminando.length}
          descricao={planosTerminando.length === 0
            ? 'Nenhum plano próximo do fim'
            : `${planosTerminando.length} paciente${planosTerminando.length === 1 ? '' : 's'} para renovar`}
          itens={planosTerminando.slice(0, 3).map(p => ({
            label: p.nome,
            sub: p.vencido
              ? `Plano ${p.tipo_plano} vencido (${p.feitas}/${p.esperado})`
              : `${p.feitas}/${p.esperado} consultas · faltam ${p.restam}`,
          }))}
          onClick={() => navigate('/nutri/pacientes')}
        />
      </div>

      {/* ─── P1: PARA REVISAR HOJE / AMANHÃ ─── */}
      {pacientesHojeAmanha.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 8 }}>Para revisar hoje / amanhã</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 14 }}>
            {pacientesHojeAmanha.map(p => (
              <PacienteAgendaCard key={p.id} paciente={p} tipo="consulta" hojeStr={hojeStr}
                onClick={() => navigate(`/nutri/pacientes/${p.id}`)} />
            ))}
          </div>
        </>
      )}

      {/* ─── P2: CHECK-IN RECENTE ─── */}
      {pacientesCheckinRecente.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 8 }}>Check-in recente</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 14 }}>
            {pacientesCheckinRecente.map(p => (
              <PacienteAgendaCard key={p.id} paciente={p} tipo="checkin"
                onClick={() => navigate(`/nutri/pacientes/${p.id}`)} />
            ))}
          </div>
        </>
      )}

      {/* ─── P3: REVISÃO PERIÓDICA ─── */}
      {pacientesRevisaoPendente.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 8 }}>Revisão periódica</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: 18 }}>
            {pacientesRevisaoPendente.map(p => (
              <PacienteAgendaCard key={p.id} paciente={p} tipo="revisao"
                onClick={() => navigate(`/nutri/pacientes/${p.id}`)} />
            ))}
          </div>
        </>
      )}

      {/* ─── ALERTAS RELACIONAIS ─── */}
      {alertasRelacionais.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 8 }}>Acompanhamento das pacientes</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10, marginBottom: 18 }}>
            {alertasRelacionais.map((a, i) => (
              <button key={i}
                onClick={() => navigate(`/nutri/pacientes/${a.paciente_id}`)}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12,
                  padding: 14, borderRadius: 12,
                  background: 'var(--white)', border: `0.5px solid var(--border)`,
                  borderLeft: `3px solid ${a.cor}`,
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
                  transition: 'all .15s ease',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}>
                <span style={{ fontSize: 22, lineHeight: 1 }}>{a.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)', marginBottom: 2 }}>{a.titulo}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{a.descricao}</div>
                </div>
                <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4 }} aria-hidden="true"></i>
              </button>
            ))}
          </div>
        </>
      )}

      {/* ─── CLÍNICA — PENDÊNCIAS ─── */}
      {pacientes.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 8 }}>Clínica — pendências</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10, marginBottom: 18 }}>
            <NotifCard
              icon="test-pipe"
              color="var(--blue)"
              titulo="Exames solicitados"
              count={examesSolicitados.length}
              descricao={examesSolicitados.length === 0
                ? 'Nenhum aguardando coleta'
                : `${examesSolicitados.length} exame${examesSolicitados.length === 1 ? '' : 's'} aguardando coleta`}
              itens={examesSolicitados.slice(0, 3).map(e => ({ label: nomePorPac[e.paciente_id] ?? '—', sub: e.titulo || e.categoria || '—' }))}
              onClick={() => navigate('/nutri/pacientes')}
            />
            <NotifCard
              icon="clock-hour-4"
              color="var(--orange)"
              titulo="Resultados sem avaliação"
              count={examesAguardando.length}
              descricao={examesAguardando.length === 0
                ? 'Todos avaliados'
                : `${examesAguardando.length} resultado${examesAguardando.length === 1 ? '' : 's'} sem avaliação`}
              itens={examesAguardando.slice(0, 3).map(e => ({ label: nomePorPac[e.paciente_id] ?? '—', sub: e.titulo || e.categoria || '—' }))}
              onClick={() => navigate('/nutri/pacientes')}
            />
            <NotifCard
              icon="microscope"
              color="var(--green)"
              titulo="Rastreios intestinais"
              count={rastreiosPendentes.length}
              descricao={rastreiosPendentes.length === 0
                ? 'Nenhum rastreio pendente'
                : `${rastreiosPendentes.length} rastreio${rastreiosPendentes.length === 1 ? '' : 's'} sem resposta`}
              itens={rastreiosPendentes.slice(0, 3).map(r => ({ label: nomePorPac[r.paciente_id] ?? '—', sub: `Solicitado ${dataBR(r.solicitado_em)}` }))}
              onClick={() => navigate('/nutri/pacientes')}
            />
            <NotifCard
              icon="writing"
              color="var(--red)"
              titulo="Documentos sem assinatura"
              count={documentosSemAssinatura.length}
              descricao={documentosSemAssinatura.length === 0
                ? 'Tudo assinado ✓'
                : `${documentosSemAssinatura.length} documento${documentosSemAssinatura.length === 1 ? '' : 's'} aguardando`}
              itens={documentosSemAssinatura.slice(0, 3).map(d => ({ label: nomePorPac[d.paciente_id] ?? '—', sub: d.titulo || d.tipo || '—' }))}
              onClick={() => navigate('/nutri/pacientes')}
            />
            <NotifCard
              icon="chart-radar"
              color="var(--gold-deep, #a08456)"
              titulo="Mapa sem dados suficientes"
              count={semDadosSuficientes.length}
              descricao={semDadosSuficientes.length === 0
                ? 'Todas com dados suficientes ✓'
                : `${semDadosSuficientes.length} paciente${semDadosSuficientes.length === 1 ? '' : 's'} com Mapa incompleto`}
              itens={semDadosSuficientes.slice(0, 3).map(p => ({ label: p.nome.split(' ')[0], sub: `${p.confianca}% de dados (mín. ${MIN_CONFIANCA}%)` }))}
              onClick={() => navigate('/nutri/pacientes')}
            />
          </div>
        </>
      )}

      {/* ─── PACIENTES QUE PRECISAM DE ATENÇÃO ─── */}
      {pacientes.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 8 }}>Pacientes que precisam de atenção</div>
          {precisamAtencao.length === 0 ? (
            <div className="card" style={{ padding: '16px 18px', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, color: 'var(--green)', lineHeight: 1.5 }}>✓</span>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--dark)', marginBottom: 3 }}>
                    Todas as pacientes estão em acompanhamento.
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>
                    Nenhuma paciente exige ação imediata.
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10, marginBottom: 18 }}>
              {precisamAtencao.map(p => (
                <button key={p.id}
                  onClick={() => navigate(`/nutri/pacientes/${p.id}`)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: 14, borderRadius: 12,
                    background: 'var(--white)', border: '0.5px solid var(--border)',
                    borderLeft: `3px solid ${EIXOS[p.eixosElevados[0]]?.cor ?? 'var(--orange)'}`,
                    cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
                    transition: 'background .15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}>
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%',
                    background: 'var(--bg2)', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 600, color: 'var(--dark)',
                  }}>
                    {iniciais(p.nome)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)', marginBottom: 5 }}>
                      {p.nome.split(' ')[0]}
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {p.eixosElevados.slice(0, 3).map(k => (
                        <span key={k} style={{
                          fontSize: 10, padding: '2px 7px', borderRadius: 4,
                          background: EIXOS[k]?.corSoft ?? 'var(--bg2)',
                          color: EIXOS[k]?.cor ?? 'var(--text2)',
                          fontWeight: 500,
                        }}>
                          {EIXOS[k]?.label ?? k}
                        </span>
                      ))}
                    </div>
                  </div>
                  <i className="ti ti-chevron-right"
                    style={{ fontSize: 14, color: 'var(--text3)', marginTop: 4, flexShrink: 0 }}
                    aria-hidden="true" />
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {/* ─── PACIENTES SEM REGISTROS CLÍNICOS RECENTES ─── */}
      {semRegistroRecente.length > 0 && (
        <>
          <div className="section-label" style={{ marginTop: 8 }}>Pacientes sem registros clínicos recentes</div>
          <div className="card" style={{ padding: 0, marginBottom: 18 }}>
            {semRegistroRecente.map((p, i) => (
              <button key={p.id}
                onClick={() => navigate(`/nutri/pacientes/${p.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', width: '100%',
                  borderBottom: i < semRegistroRecente.length - 1
                    ? '0.5px solid var(--border)' : 'none',
                  background: 'none', cursor: 'pointer', textAlign: 'left',
                  fontFamily: 'var(--font-sans)', transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'var(--bg2)', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: 'var(--dark)',
                }}>
                  {iniciais(p.nome)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)' }}>
                    {p.nome.split(' ')[0]}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--text3)', margin: '0 5px' }}>—</span>
                  <span style={{ fontSize: 13, color: 'var(--text3)' }}>
                    {p.diasSemRegistro === null
                      ? 'nunca registrou'
                      : `último registro há ${p.diasSemRegistro} dia${p.diasSemRegistro === 1 ? '' : 's'}`}
                  </span>
                </div>
                <i className="ti ti-chevron-right"
                  style={{ fontSize: 14, color: 'var(--text3)', flexShrink: 0 }}
                  aria-hidden="true" />
              </button>
            ))}
          </div>
        </>
      )}

      {/* ─── EMPTY STATE — zero pacientes ─── */}
      {!carregando && pacientes.length === 0 && (
        <div className="card empty-card">
          <i className="ti ti-sparkles empty-icon" style={{ color: 'var(--amber)' }} aria-hidden="true"></i>
          <div className="empty-title">Bem-vinda ao seu painel</div>
          <div className="empty-sub">
            Comece cadastrando seus serviços e suas primeiras pacientes. Tudo o que você registrar
            aparecerá aqui como um resumo do seu consultório.
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button className="btn-outline" onClick={() => navigate('/nutri/servicos')}>
              <i className="ti ti-settings" aria-hidden="true"></i> Cadastrar serviços
            </button>
            <button className="btn" onClick={() => navigate('/nutri/cadastrar')}>
              <i className="ti ti-user-plus" aria-hidden="true"></i> Cadastrar paciente
            </button>
          </div>
        </div>
      )}
    </>
  );
}

/* ============================================================
   CARD DE PACIENTE — AGENDA COMO GATILHO
   ============================================================ */
function tipoConsultaLabel(tipo) {
  if (!tipo) return '—';
  if (tipo === 'primeira') return '1ª consulta';
  if (tipo === 'avaliacao') return 'Avaliação';
  const m = tipo.match(/^consulta_(\d+)$/);
  if (m) return `Consulta ${m[1]}`;
  return tipo;
}

function PacienteAgendaCard({ paciente, tipo, hojeStr, onClick }) {
  let iconColor, sub;

  if (tipo === 'consulta') {
    const dc = new Date(paciente.consultaData).toISOString().slice(0, 10);
    const isHoje = dc === hojeStr;
    iconColor = 'var(--blue)';
    const hora = new Date(paciente.consultaData).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    sub = `${isHoje ? 'Hoje' : 'Amanhã'} · ${hora} · ${tipoConsultaLabel(paciente.consultaTipo)}`;
  } else if (tipo === 'checkin') {
    iconColor = paciente.checkinStatus === 'pendente' ? 'var(--orange)' : 'var(--green)';
    sub = paciente.checkinStatus === 'pendente'
      ? `Pendente · enviado ${dataBR(paciente.checkinData)}`
      : `Respondido em ${dataBR(paciente.checkinData)}`;
  } else {
    iconColor = 'var(--gold-deep, #a08456)';
    sub = paciente.diasSemRevisao === null
      ? 'Nunca revisada'
      : `Último follow-up há ${paciente.diasSemRevisao} dia${paciente.diasSemRevisao === 1 ? '' : 's'}`;
  }

  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '11px 14px', borderRadius: 10,
        background: 'var(--white)', border: '0.5px solid var(--border)',
        borderLeft: `3px solid ${iconColor}`,
        cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)',
        transition: 'background .15s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg2)'}
      onMouseLeave={e => e.currentTarget.style.background = 'var(--white)'}>
      <div style={{
        width: 30, height: 30, borderRadius: '50%',
        background: iconColor + '1a', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 600, color: 'var(--dark)',
      }}>
        {iniciais(paciente.nome)}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--dark)', marginBottom: 1 }}>
          {paciente.nome.split(' ')[0]}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {sub}
        </div>
      </div>
      <i className="ti ti-chevron-right" style={{ fontSize: 14, color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true"></i>
    </button>
  );
}

/* ============================================================
   CARD DE NOTIFICAÇÃO
   ============================================================ */
function NotifCard({ icon, color, titulo, count, descricao, itens, onClick }) {
  const ativo = count > 0;
  return (
    <button onClick={onClick}
      style={{
        background: 'var(--white)',
        border: '0.5px solid ' + (ativo ? color : 'var(--border)'),
        borderRadius: 8, padding: '14px 16px',
        textAlign: 'left', cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        transition: 'transform .15s, box-shadow .15s',
        boxShadow: ativo ? `0 1px 0 ${color}` : 'none',
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = `0 4px 12px rgba(0,0,0,.04)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = ativo ? `0 1px 0 ${color}` : 'none'; }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: ativo ? color + '15' : 'var(--bg2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`ti ti-${icon}`} style={{ fontSize: 18, color: ativo ? color : 'var(--text3)' }} aria-hidden="true"></i>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', color: 'var(--text3)', fontWeight: 500 }}>
            {titulo}
          </div>
          <div style={{ fontFamily: 'var(--font-serif)', fontSize: 22, color: ativo ? color : 'var(--text3)', lineHeight: 1, marginTop: 2 }}>
            {count}
          </div>
        </div>
        <i className="ti ti-chevron-right" style={{ fontSize: 16, color: 'var(--text3)' }} aria-hidden="true"></i>
      </div>
      <div style={{ fontSize: 13, color: ativo ? 'var(--text2)' : 'var(--text3)', marginBottom: itens.length > 0 ? 8 : 0 }}>
        {descricao}
      </div>
      {itens.length > 0 && (
        <div style={{ borderTop: '0.5px solid #f5f0e8', paddingTop: 8 }}>
          {itens.map((it, i) => (
            <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '3px 0', display: 'flex', justifyContent: 'space-between', gap: 6 }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.label}</span>
              <span style={{ color: 'var(--text3)', flexShrink: 0 }}>{it.sub}</span>
            </div>
          ))}
        </div>
      )}
    </button>
  );
}
