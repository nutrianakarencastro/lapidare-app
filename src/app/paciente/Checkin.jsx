import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { respostasIniciais } from '../../lib/checkinDefault.js';
import { dataBR } from '../../lib/utils.js';
import CheckinForm from '../../components/CheckinForm.jsx';

export default function Checkin() {
  const { envioId } = useParams();
  const navigate = useNavigate();
  const { user, profile } = useSession();
  const pacienteId = profile?.id;
  const [envio, setEnvio] = useState(undefined);
  const [respostas, setRespostas] = useState({});
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);
  const [sucesso, setSucesso] = useState(false);
  const [invalidas, setInvalidas] = useState([]);

  // Marca feedback como lido assim que a paciente abre a tela
  useEffect(() => {
    if (!envio?.feedback) return;
    const precisaMarcar = !envio.feedback_lido_em ||
      (envio.feedback_atualizado_em &&
       new Date(envio.feedback_atualizado_em) > new Date(envio.feedback_lido_em));
    if (precisaMarcar) {
      supabase.rpc('marcar_feedback_lido', { p_envio_id: envio.id }); // fire-and-forget
    }
  }, [envio?.id, envio?.feedback_atualizado_em]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!user) return;
      const { data, error } = await supabase
        .from('checkin_envios')
        .select('*')
        .eq('id', envioId)
        .eq('paciente_id', pacienteId)
        .maybeSingle();
      if (!active) return;
      if (error) { setErro(error.message); setEnvio(null); return; }
      setEnvio(data ?? null);
      if (data) {
        // se já respondeu, mostra as respostas em modo read-only
        setRespostas(data.respostas ?? respostasIniciais(data.perguntas));
      }
    }
    load();
    return () => { active = false; };
  }, [envioId, user]);

  if (envio === undefined) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--muted)', fontSize: 13 }}>
        Carregando…
      </div>
    );
  }

  if (envio === null) {
    return (
      <div className="empty-state">
        <i className="ti ti-file-off empty-icon" aria-hidden="true"></i>
        <div className="empty-title">Check-in não encontrado</div>
        <div className="empty-sub">Pode ter sido removido ou o link está incorreto.</div>
        <button className="btn primary sm" style={{ marginTop: 14 }}
          onClick={() => navigate('/paciente/inicio')}>
          Voltar ao início
        </button>
      </div>
    );
  }

  const jaRespondido = !!envio.respondido_em;

  function validarRespostas() {
    const ids = [];
    for (const p of (envio?.perguntas ?? [])) {
      if (p.obrigatorio === false) continue;
      if (p.tipo === 'slider') continue; // slider sempre tem valor numérico
      const v = respostas[p.id];
      if (p.tipo === 'texto') {
        if (v == null || String(v).trim() === '') ids.push(p.id);
      } else if (p.tipo === 'multi' || p.tipo === 'habitos') {
        if (!Array.isArray(v) || v.length === 0) ids.push(p.id);
      } else {
        // single, emoji_scale
        if (v == null) ids.push(p.id);
      }
    }
    return ids;
  }

  async function enviar() {
    setErro(null);
    const ids = validarRespostas();
    if (ids.length > 0) {
      setInvalidas(ids);
      setTimeout(() => {
        document.querySelector(`[data-pergunta-id="${ids[0]}"]`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }
    setInvalidas([]);
    setBusy(true);
    const { error } = await supabase
      .from('checkin_envios')
      .update({
        respostas,
        respondido_em: new Date().toISOString(),
      })
      .eq('id', envio.id);
    setBusy(false);
    if (error) return setErro(error.message);
    setSucesso(true);
    setTimeout(() => navigate('/paciente/inicio', { replace: true }), 2500);
  }

  if (sucesso) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px', textAlign: 'center', minHeight: 'calc(100vh - 200px)',
      }}>
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'var(--green-soft)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 36, marginBottom: 24,
          animation: 'view-in .4s cubic-bezier(.175,.885,.32,1.275)',
        }}>✨</div>
        <div className="serif" style={{ fontSize: 28, marginBottom: 8 }}>Check-in enviado!</div>
        <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6, maxWidth: 280 }}>
          Obrigada por compartilhar como está se sentindo.<br />
          A Dra. vai analisar suas respostas em breve.
        </div>
      </div>
    );
  }

  return (
    <>
      <div style={{
        background: 'var(--ink)', color: 'var(--bg-soft)',
        padding: '18px 22px',
        margin: '-18px -16px 16px',
      }}>
        <div style={{
          fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase',
          color: 'var(--gold)', marginBottom: 4,
        }}>
          {envio.tipo === 'pre_consulta' ? 'Check-in pré-consulta' : 'Check-in'}
        </div>
        <div className="serif" style={{ fontSize: 22, lineHeight: 1.1, marginBottom: 2 }}>
          {jaRespondido
            ? 'Suas respostas'
            : envio.tipo === 'pre_consulta'
              ? 'Antes da primeira consulta'
              : (envio.nome || 'Como você está esta semana?')}
        </div>
        <div style={{ fontSize: 11, opacity: .55 }}>
          {jaRespondido
            ? `Respondido em ${new Date(envio.respondido_em).toLocaleDateString('pt-BR')}`
            : `Enviado em ${new Date(envio.enviado_em).toLocaleDateString('pt-BR')}`}
        </div>
      </div>

      <CheckinForm
        perguntas={envio.perguntas}
        valores={respostas}
        onChange={(id, v) => {
          setRespostas(r => ({ ...r, [id]: v }));
          setInvalidas(prev => prev.filter(x => x !== id));
        }}
        disabled={jaRespondido}
        invalidas={invalidas}
      />

      {jaRespondido && envio.feedback && (
        <div style={{ padding: '4px 20px 28px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--gold-soft, #fdf8f0), var(--white))',
            border: '1px solid var(--gold, #c9a96e)',
            borderRadius: 16, padding: '18px 18px',
          }}>
            <div style={{
              fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
              color: 'var(--gold-deep)', fontWeight: 600, marginBottom: 4,
            }}>
              Feedback da Nutricionista
            </div>
            <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: 14 }}>
              {envio.feedback_atualizado_em && envio.feedback_atualizado_em !== envio.feedback_em
                ? `Atualizado em ${dataBR(envio.feedback_atualizado_em)}`
                : `Enviado em ${dataBR(envio.feedback_em)}`}
            </div>
            <div style={{
              fontSize: 14, color: 'var(--ink)', lineHeight: 1.75,
              whiteSpace: 'pre-wrap',
            }}>
              {envio.feedback}
            </div>
          </div>
        </div>
      )}

      {!jaRespondido && (
        <div style={{ padding: '16px 20px 40px' }}>
          {invalidas.length > 0 && (
            <div style={{
              background: 'var(--red-soft, #fff0f0)', color: 'var(--red, #e05252)',
              border: '1px solid var(--red, #e05252)',
              padding: '10px 14px', borderRadius: 8, fontSize: 13,
              marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <i className="ti ti-alert-circle" style={{ fontSize: 16, flexShrink: 0 }} aria-hidden="true"></i>
              Existem perguntas sem resposta. Revise antes de enviar.
            </div>
          )}
          {erro && (
            <div style={{
              background: 'var(--red-soft)', color: 'var(--red)',
              padding: '8px 12px', borderRadius: 8, fontSize: 12, marginBottom: 12,
            }}>{erro}</div>
          )}
          <button className="btn primary full" onClick={enviar} disabled={busy}
            style={{ padding: 16, fontSize: 14, fontWeight: 600 }}>
            {busy ? 'Enviando...' : 'Enviar check-in ✨'}
          </button>
        </div>
      )}
    </>
  );
}
