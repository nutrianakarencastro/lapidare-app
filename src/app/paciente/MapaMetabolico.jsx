import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { podeAcessar } from '../../lib/modelos.js';
import BloqueioModelo from '../../components/BloqueioModelo.jsx';
import {
  calcularMapaVivo, dataInicioMapaVivo,
  EIXOS_PACIENTE, EIXOS_ORDEM,
  intensidadeKey, intensidadeTexto, intensidadeCor, intensidadeCorBg,
  DISCLAIMER,
} from '../../lib/mapaUtils.js';

// ─── Card de eixo (visão paciente) ────────────────────────────────────────────

function CardEixo({ eixoKey, score }) {
  const [aberto, setAberto] = useState(false);
  const info      = EIXOS_PACIENTE[eixoKey];
  const intKey    = intensidadeKey(score);
  const intTexto  = intensidadeTexto(score);
  const corTexto  = intensidadeCor(score);
  const corBg     = intensidadeCorBg(score);
  const explicacao = info?.intensidades?.[intKey] ?? '';

  return (
    <button
      onClick={() => setAberto(a => !a)}
      style={{
        width: '100%', textAlign: 'left', background: 'var(--white)',
        border: '0.5px solid var(--border)', borderRadius: 14,
        padding: '14px 16px', cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        display: 'flex', flexDirection: 'column', gap: 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          background: info?.corSoft ?? 'var(--bg2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <i className={`ti ti-${info?.icon ?? 'chart-bar'}`}
            style={{ fontSize: 18, color: info?.cor ?? 'var(--text3)' }} aria-hidden="true" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dark)' }}>
            {info?.labelAmigavel ?? eixoKey}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
            {info?.descricao ?? ''}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
          <span style={{
            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
            background: corBg, color: corTexto,
          }}>{intTexto}</span>
          <i className={`ti ti-chevron-${aberto ? 'up' : 'down'}`}
            style={{ fontSize: 12, color: 'var(--text4)' }} aria-hidden="true" />
        </div>
      </div>

      {/* barra de intensidade */}
      <div style={{ marginTop: 12, height: 5, borderRadius: 3, background: 'var(--bg3)', overflow: 'hidden' }}>
        <div style={{
          width: `${score}%`, height: '100%',
          background: corTexto, borderRadius: 3, transition: 'width .5s ease',
        }} />
      </div>

      {/* explicação expandida */}
      {aberto && (
        <div style={{
          marginTop: 12, padding: '10px 12px', borderRadius: 9,
          background: 'var(--bg2)', fontSize: 13, color: 'var(--text2)', lineHeight: 1.6,
          textAlign: 'left',
        }}>
          {explicacao}
        </div>
      )}
    </button>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export default function MapaMetabolico() {
  const { user, profile } = useSession();
  const pacienteId = profile?.id;
  const [sintomas, setSintomas] = useState(null);
  const [periodos, setPeriodos] = useState([]);
  const [intestinoLogs, setIntestinoLogs] = useState([]);

  useEffect(() => {
    if (!pacienteId) return;
    let active = true;
    async function carregar() {
      const [sRes, pRes, iRes] = await Promise.all([
        supabase.from('ciclo_sintomas_diarios')
          .select('*').eq('paciente_id', pacienteId)
          .gte('data', dataInicioMapaVivo())
          .order('data', { ascending: false }),
        supabase.from('ciclo_periodos')
          .select('id, inicio, fim').eq('paciente_id', pacienteId)
          .order('inicio', { ascending: false }),
        supabase.from('intestino_logs')
          .select('*').eq('paciente_id', pacienteId)
          .gte('data', dataInicioMapaVivo())
          .order('data', { ascending: false }),
      ]);
      if (!active) return;
      setSintomas(sRes.data ?? []);
      setPeriodos(pRes.data ?? []);
      setIntestinoLogs(iRes.data ?? []);
    }
    carregar();
    return () => { active = false; };
  }, [user?.id]);

  const mapa = useMemo(() => {
    if (sintomas === null) return null;
    return calcularMapaVivo(sintomas, periodos, intestinoLogs);
  }, [sintomas, periodos, intestinoLogs]);

  if (sintomas === null) {
    return (
      <div className="card empty-card" style={{ marginTop: 8 }}>
        <div className="empty-sub">Carregando seu mapa…</div>
      </div>
    );
  }

  if (!sintomas.length) {
    return (
      <div style={{ padding: '0 0 24px' }}>
        <div className="card empty-card" style={{ marginTop: 8 }}>
          <i className="ti ti-map" style={{ fontSize: 32, color: 'var(--text4)', display: 'block', marginBottom: 10 }} aria-hidden="true" />
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--dark)', marginBottom: 6 }}>
            Seu mapa ainda está vazio
          </div>
          <div className="empty-sub" style={{ fontSize: 13 }}>
            Registre seus sintomas diariamente em <strong>Ciclo & Hormônios</strong> para
            que seu Mapa Metabólico seja calculado automaticamente.
          </div>
        </div>
      </div>
    );
  }

  const eixosAtivos = EIXOS_ORDEM.filter(k => (mapa.scores[k] ?? 0) >= 26);
  const eixosCalmos = EIXOS_ORDEM.filter(k => (mapa.scores[k] ?? 0) < 26);

  if (!podeAcessar(profile?.acesso_utera, 'mapa')) {
    return <BloqueioModelo modulo="Mapa Metabólico" tierMinimo={3} />;
  }

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Confiança dos dados */}
      <div style={{
        padding: '12px 16px', borderRadius: 12, marginBottom: 16,
        background: 'var(--bg2)', border: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
      }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          Baseado em {mapa.diasComDados} {mapa.diasComDados === 1 ? 'dia' : 'dias'} de registros
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ height: 4, width: 60, borderRadius: 2, background: 'var(--bg3)', overflow: 'hidden' }}>
            <div style={{ width: `${mapa.confianca}%`, height: '100%', background: mapa.confianca >= 70 ? 'var(--green)' : 'var(--amber)' }} />
          </div>
          <span style={{ fontSize: 11, color: 'var(--text3)' }}>{mapa.confianca}%</span>
        </div>
      </div>

      {/* Eixos com sinais */}
      {eixosAtivos.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 10 }}>Eixos com sinais ativos</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
            {eixosAtivos.map(k => (
              <CardEixo key={k} eixoKey={k} score={mapa.scores[k] ?? 0} />
            ))}
          </div>
        </>
      )}

      {/* Eixos equilibrados */}
      {eixosCalmos.length > 0 && (
        <>
          <div className="section-label" style={{ marginBottom: 10 }}>Eixos equilibrados</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
            {eixosCalmos.map(k => (
              <CardEixo key={k} eixoKey={k} score={mapa.scores[k] ?? 0} />
            ))}
          </div>
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
    </div>
  );
}
