import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import BrandFooter from '../../components/BrandFooter.jsx';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Mensagens de erro do trigger mapeadas para texto amigável
function mensagemAmigavel(erroMsg) {
  if (!erroMsg) return 'Ocorreu um erro. Tente novamente.';
  if (erroMsg.includes('já foi ativada'))        return 'Esta conta já foi ativada. Acesse pelo login.';
  if (erroMsg.includes('inválido ou expirado'))   return 'Link de convite inválido ou expirado. Solicite um novo link à sua nutricionista.';
  if (erroMsg.includes('não corresponde'))        return 'O email informado não corresponde ao convite. Use o email para o qual o convite foi enviado.';
  if (erroMsg.includes('não fornecido'))          return 'Link de convite incompleto. Use o link enviado pela sua nutricionista.';
  if (erroMsg.includes('User already registered')) return 'Este email já possui uma conta. Acesse pelo login.';
  return erroMsg;
}

export default function SignupPaciente() {
  const { nutriId, token } = useParams();
  const navigate           = useNavigate();
  const { session, role, loading: sessionLoading } = useSession();

  // Estado da paciente pré-cadastrada, encontrada pelo token
  const [estado,    setEstado]    = useState('carregando'); // carregando | valido | invalido | ja_ativa
  const [paciente,  setPaciente]  = useState(null);         // { nome, email, nutri_nome }

  const [senha,          setSenha]          = useState('');
  const [confirmaSenha,  setConfirmaSenha]  = useState('');
  const [busy,           setBusy]           = useState(false);
  const [erro,           setErro]           = useState(null);
  const [aviso,          setAviso]          = useState(null);

  // Busca a paciente pelo token do convite
  useEffect(() => {
    let active = true;
    async function validar() {
      // Token obrigatório — sem token, link é inválido
      if (!token || !UUID_RE.test(token)) {
        if (active) setEstado('invalido');
        return;
      }

      const { data, error } = await supabase
        .rpc('buscar_paciente_por_token', { p_token: token });

      if (!active) return;

      if (error || !data?.length) {
        setEstado('invalido');
        return;
      }

      const p = data[0];

      if (p.status_app === 'ativa') {
        setEstado('ja_ativa');
        return;
      }

      setPaciente({ nome: p.nome, email: p.email, nutriNome: p.nutri_nome });
      setEstado('valido');
    }
    validar();
    return () => { active = false; };
  }, [token]);

  // Paciente já logada → vai direto pro app
  useEffect(() => {
    if (sessionLoading || !session) return;
    if (role === 'paciente') navigate('/paciente/inicio', { replace: true });
  }, [session, role, sessionLoading, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null); setAviso(null);
    if (senha.length < 6)          return setErro('A senha precisa de pelo menos 6 caracteres.');
    if (senha !== confirmaSenha)   return setErro('As senhas não conferem.');

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email:    paciente.email,
      password: senha,
      options: {
        data: {
          role:  'paciente',
          token,            // usado pelo trigger para localizar e ativar o prontuário
        },
      },
    });
    setBusy(false);

    if (error) {
      setErro(mensagemAmigavel(error.message));
      return;
    }

    if (data.session) {
      // Email confirmation desligado → sessão imediata
      // Nota: session.jsx ainda usa eq('id') — redirecionamento funciona
      // plenamente após B.4. Até lá, a paciente vê tela de loading
      // e deve fazer login manualmente.
      navigate('/paciente/inicio', { replace: true });
    } else {
      setAviso('Conta criada! Verifique seu email para confirmar e depois faça login.');
    }
  }

  // ── Estados de carregamento e erro ───────────────────────────────────────

  if (estado === 'carregando') {
    return <CenterWrap><Box><Brand /><div style={{ color: 'var(--muted)', fontSize: 13 }}>Validando link…</div></Box></CenterWrap>;
  }

  if (estado === 'invalido') {
    return (
      <CenterWrap>
        <Box>
          <Brand />
          <h1 style={H1}>Link inválido</h1>
          <p style={P}>
            Este link de convite não está mais ativo ou foi digitado incorretamente.
            Peça à sua nutricionista um novo link de convite.
          </p>
        </Box>
      </CenterWrap>
    );
  }

  if (estado === 'ja_ativa') {
    return (
      <CenterWrap>
        <Box>
          <Brand />
          <h1 style={H1}>Conta já ativada</h1>
          <p style={P}>
            Este convite já foi utilizado. Acesse normalmente pelo login.
          </p>
          <button onClick={() => navigate('/paciente/login')} style={BtnStyle}>
            Ir para o login
          </button>
        </Box>
      </CenterWrap>
    );
  }

  // Nutri logada abrindo o link da paciente — mostra aviso útil
  if (role === 'nutri') {
    return (
      <CenterWrap>
        <Box>
          <Brand />
          <h1 style={H1}>Link da paciente</h1>
          <p style={P}>
            Este é o link de convite de <strong>{paciente?.nome || 'sua paciente'}</strong>.
            Você está logada como nutri.
          </p>
          <div style={CodeBox}>{window.location.href}</div>
          <div style={AvisoBox}>
            Para testar o fluxo como paciente, copie o link acima e abra em uma{' '}
            <strong>janela anônima</strong> (Cmd+Shift+N) ou em outro navegador.
          </div>
          <button onClick={() => navigate('/nutri/cadastrar', { replace: true })} style={BtnStyle}>
            ← Voltar ao painel
          </button>
        </Box>
      </CenterWrap>
    );
  }

  // ── Formulário principal ──────────────────────────────────────────────────

  return (
    <CenterWrap>
      <Box>
        <Brand />
        <h1 style={H1}>Bem-vinda, {paciente.nome.split(' ')[0]}!</h1>
        <p style={P}>{paciente.nutriNome} preparou seu prontuário. Só falta criar uma senha.</p>

        <form onSubmit={handleSubmit} style={{ marginTop: 20 }}>

          {/* Dados somente leitura — confirma identidade da paciente */}
          <div style={{
            background: 'var(--bg-soft, #faf7f2)',
            border: '0.5px solid var(--hair, #d9d3c9)',
            borderRadius: 10, padding: 12, marginBottom: 18,
            fontSize: 12, lineHeight: 1.7, textAlign: 'left',
          }}>
            <div><strong>Nome:</strong> {paciente.nome}</div>
            <div><strong>Email:</strong> {paciente.email}</div>
            <div style={{ marginTop: 6, color: 'var(--muted)', fontSize: 11 }}>
              Se algum dado estiver errado, fale com {paciente.nutriNome.split(' ')[0]} antes de continuar.
            </div>
          </div>

          {/* Apenas senha */}
          <Field
            label="Crie uma senha"
            type="password"
            value={senha}
            onChange={setSenha}
            required
            minLength={6}
            autoFocus
          />
          <Field
            label="Confirme a senha"
            type="password"
            value={confirmaSenha}
            onChange={setConfirmaSenha}
            required
            minLength={6}
          />

          {erro && <div style={{ ...AlertCss, background: 'var(--red-soft)', color: 'var(--red)' }}>{erro}</div>}
          {aviso && <div style={{ ...AlertCss, background: 'var(--green-soft)', color: 'var(--green)' }}>{aviso}</div>}

          <button type="submit" disabled={busy} style={{ ...BtnStyle, opacity: busy ? .6 : 1, marginTop: 4 }}>
            {busy ? 'Criando conta…' : 'Criar senha e entrar'}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 11, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>
          Já tem conta?{' '}
          <a href="/paciente/login" style={{ color: 'var(--gold-deep)', textDecoration: 'none' }}>Entrar</a>
        </p>
      </Box>
    </CenterWrap>
  );
}

/* ── Estilos ── */
const H1       = { fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 28, letterSpacing: '-0.02em', color: 'var(--ink)', marginTop: 4 };
const P        = { fontSize: 12, color: 'var(--muted)', marginTop: 6, textAlign: 'center' };
const AlertCss = { fontSize: 12, padding: '8px 12px', borderRadius: 8, marginTop: 10, marginBottom: 10 };
const BtnStyle = {
  width: '100%', padding: '11px 18px',
  background: 'var(--ink)', color: 'var(--bg-soft)',
  borderRadius: 12, fontSize: 13, fontWeight: 500,
  border: 'none', cursor: 'pointer', display: 'block',
  fontFamily: 'var(--font-sans)',
};
const CodeBox  = {
  background: 'var(--bg-soft, #faf7f2)',
  border: '0.5px solid var(--hair, #d9d3c9)',
  borderRadius: 10, padding: 12, margin: '16px 0',
  fontSize: 12, textAlign: 'left', lineHeight: 1.5,
  wordBreak: 'break-all', fontFamily: 'monospace', color: 'var(--ink-soft)',
};
const AvisoBox = {
  background: '#fdf6e3', border: '0.5px solid #e8d9a0',
  borderRadius: 10, padding: '11px 14px', margin: '0 0 16px',
  fontSize: 12, textAlign: 'left', lineHeight: 1.6, color: 'var(--ink-soft)',
};

/* ── Componentes de layout ── */
function CenterWrap({ children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, var(--bg-soft) 0%, var(--bg-deep) 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'var(--font-sans)',
    }}>
      {children}
      <BrandFooter />
    </div>
  );
}

function Box({ children }) {
  return (
    <div style={{
      width: '100%', maxWidth: 420,
      background: 'var(--paper)',
      border: '0.5px solid var(--hair, #d9d3c9)',
      borderRadius: 20,
      boxShadow: '0 4px 12px rgba(28,23,18,.06), 0 2px 4px rgba(28,23,18,.04)',
      padding: 32, textAlign: 'center',
    }}>{children}</div>
  );
}

function Brand() {
  return (
    <div style={{ fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>
      Útera
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, autoFocus, minLength }) {
  return (
    <label style={{ display: 'block', marginBottom: 12, textAlign: 'left' }}>
      <span style={{
        display: 'block', fontSize: 11, letterSpacing: '.04em',
        color: 'var(--ink-soft)', marginBottom: 5, fontWeight: 500,
      }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        minLength={minLength}
        style={{
          width: '100%', padding: '10px 12px', fontSize: 13,
          background: 'var(--bg-soft)',
          border: '0.5px solid var(--hair, #d9d3c9)',
          borderRadius: 10, outline: 'none',
          color: 'var(--ink)', fontFamily: 'var(--font-sans)',
          boxSizing: 'border-box',
        }}
      />
    </label>
  );
}
