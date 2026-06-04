import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { useTheme } from '../../lib/theme.jsx';
import BrandFooter from '../../components/BrandFooter.jsx';

export default function Login({ context = 'generic' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, role, loading: sessionLoading } = useSession();
  const tema = useTheme();

  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');
  const [nome, setNome] = useState('');
  const [crn, setCrn] = useState('');
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(location.state?.aviso ?? null);

  // Sessão existe mas o role não é o esperado neste contexto — mostra aviso em vez de redirecionar
  const isWrongRole = (
    (context === 'nutri'    && role === 'paciente') ||
    (context === 'paciente' && role === 'nutri')
  );

  // Redireciona automaticamente após login bem-sucedido (somente quando role é compatível)
  useEffect(() => {
    if (sessionLoading || !session || isWrongRole) return;
    const from = location.state?.from;
    if (role === 'nutri') {
      navigate(from?.startsWith('/nutri') ? from : '/nutri/visao', { replace: true });
    } else if (role === 'paciente') {
      navigate(from?.startsWith('/paciente') ? from : '/paciente/inicio', { replace: true });
    }
  }, [session, role, sessionLoading, navigate, location.state, isWrongRole]);

  // Traduz erros técnicos em mensagens acionáveis
  function mensagemAmigavel(error) {
    if (!error) return null;
    const msg = (error.message || String(error)).toLowerCase();
    if (msg.includes('failed to fetch') ||
        msg.includes('falha ao buscar') ||
        msg.includes('networkerror') ||
        msg.includes('err_name_not_resolved') ||
        msg.includes('load failed')) {
      return 'Não consegui conectar com o Supabase. Isso geralmente significa:\n\n' +
             '1) Você esqueceu de fazer Trigger Deploy no Netlify depois de adicionar as variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.\n\n' +
             '2) Ou a URL do Supabase está errada (precisa ser https://SEU-PROJECT-ID.supabase.co — confira em Supabase → Settings → General → Reference ID).\n\n' +
             'Detalhes em SETUP.md → Problemas comuns.';
    }
    if (msg.includes('invalid login credentials')) return 'Email ou senha incorretos.';
    if (msg.includes('email rate limit')) return 'Limite de emails atingido. Desligue "Confirm email" em Supabase → Authentication → Sign In / Providers.';
    if (msg.includes('user already registered')) return 'Já existe uma conta com esse email. Tente fazer login.';
    return error.message;
  }

  async function handleSignIn(e) {
    e.preventDefault();
    setErro(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      setBusy(false);
      if (error) setErro(mensagemAmigavel(error));
    } catch (err) {
      setBusy(false);
      setErro(mensagemAmigavel(err));
    }
  }

  async function handleSignUp(e) {
    e.preventDefault();
    setErro(null);
    setAviso(null);
    if (!nome.trim()) return setErro('Informe o nome completo.');
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: { data: { role: 'nutri', nome: nome.trim(), crn: crn.trim() } },
      });
      setBusy(false);
      if (error) return setErro(mensagemAmigavel(error));
      if (!data.session) {
        setAviso('Conta criada. Verifique seu email para confirmar e depois faça login.');
        setMode('signin');
      }
    } catch (err) {
      setBusy(false);
      setErro(mensagemAmigavel(err));
    }
  }

  // ─── Títulos e subtítulos por contexto ─────────────────────────────────────

  const titulo = context === 'nutri'    ? 'Entrar como nutricionista'
    : context === 'paciente' ? 'Entrar no seu app'
    : mode === 'signin'      ? 'Entrar'
    : 'Criar conta';

  const subtitulo = context === 'nutri'    ? 'Acesse seu painel'
    : context === 'paciente' ? 'App da paciente'
    : mode === 'signin'      ? (tema.mensagem_login ?? 'Acesse seu painel ou app')
    : 'Cadastro de nutricionista';

  // ─── Tela de aviso: sessão de role incompatível ────────────────────────────

  const mostrarAviso = !sessionLoading && session && isWrongRole;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, var(--bg-soft) 0%, var(--bg-deep) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'var(--font-sans)',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: 'var(--paper)', border: '0.5px solid var(--hair)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        padding: 32,
      }}>
        {/* Logo / título */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {tema.logo_url ? (
            <img src={tema.logo_url} alt={tema.marca_nome ?? 'Útera'}
              style={{ maxHeight: 48, maxWidth: 200, margin: '0 auto 8px', display: 'block' }} />
          ) : (
            <div style={{
              fontSize: 10, letterSpacing: '.22em', textTransform: 'uppercase',
              color: 'var(--muted)', marginBottom: 4,
            }}>
              {tema.marca_nome ?? 'Útera'}
            </div>
          )}
          <h1 style={{
            fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 28,
            letterSpacing: '-0.02em', color: 'var(--ink)',
          }}>
            {titulo}
          </h1>
          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
            {subtitulo}
          </p>
        </div>

        {/* Aviso: role incompatível */}
        {mostrarAviso ? (
          <div>
            <div style={{
              background: '#fdf6e3', border: '0.5px solid #e8d9a0',
              borderRadius: 10, padding: '13px 16px', marginBottom: 20,
              fontSize: 13, lineHeight: 1.6, color: 'var(--ink-soft)',
            }}>
              {context === 'paciente' && role === 'nutri' ? (
                <>
                  Você está logada como <strong>nutricionista</strong>. Para entrar
                  como paciente neste navegador, saia primeiro ou use janela
                  anônima / outro navegador.
                </>
              ) : (
                <>
                  Você está logada como <strong>paciente</strong>. Para acessar
                  o painel da nutri neste navegador, saia primeiro ou use janela
                  anônima / outro navegador.
                </>
              )}
            </div>
            <button
              onClick={() => navigate(
                context === 'paciente' ? '/nutri/visao' : '/paciente/inicio',
                { replace: true }
              )}
              style={{
                width: '100%', padding: '11px 18px',
                background: 'var(--ink)', color: 'var(--bg-soft)',
                borderRadius: 12, fontSize: 13, fontWeight: 500,
                border: 'none', cursor: 'pointer',
              }}
            >
              {context === 'paciente'
                ? 'Ir para o painel da nutri →'
                : 'Ir para o meu app →'}
            </button>
          </div>
        ) : (
          <>
            {/* Tabs Entrar / Criar conta — ocultas para context=paciente */}
            {context !== 'paciente' && (
              <div style={{
                display: 'flex', gap: 2, background: 'var(--bg-deep)',
                borderRadius: 10, padding: 3, marginBottom: 18,
              }}>
                {[
                  { id: 'signin', label: 'Entrar' },
                  { id: 'signup', label: 'Criar conta' },
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => { setMode(t.id); setErro(null); setAviso(null); }}
                    style={{
                      flex: 1, padding: '7px 4px', fontSize: 12, fontWeight: 500,
                      borderRadius: 8,
                      color: mode === t.id ? 'var(--ink)' : 'var(--muted)',
                      background: mode === t.id ? 'var(--paper)' : 'transparent',
                      boxShadow: mode === t.id ? 'var(--shadow-sm)' : 'none',
                      transition: 'all .2s',
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={context === 'paciente' || mode === 'signin' ? handleSignIn : handleSignUp}>
              {mode === 'signup' && context !== 'paciente' && (
                <>
                  <Field label="Nome completo" value={nome} onChange={setNome} required autoFocus />
                  <Field label="CRN" value={crn} onChange={setCrn} placeholder="opcional" />
                </>
              )}
              <Field label="Email" type="email" value={email} onChange={setEmail} required
                autoFocus={mode === 'signin' || context === 'paciente'} />
              <Field label="Senha" type="password" value={senha} onChange={setSenha} required minLength={6} />

              {/* Link "Esqueci minha senha" — apenas em signin */}
              {(mode === 'signin' || context === 'paciente') && (
                <div style={{ textAlign: 'right', marginTop: -6, marginBottom: 14 }}>
                  <Link to="/auth/esqueci-senha" style={{
                    fontSize: 12, color: 'var(--muted)', textDecoration: 'none',
                  }}>
                    Esqueci minha senha
                  </Link>
                </div>
              )}

              {erro && (
                <div style={{
                  fontSize: 12, color: 'var(--red)', background: 'var(--red-soft)',
                  whiteSpace: 'pre-line', lineHeight: 1.5,
                  padding: '8px 12px', borderRadius: 8, marginBottom: 12,
                }}>
                  {erro}
                </div>
              )}
              {aviso && (
                <div style={{
                  fontSize: 12, color: 'var(--green)', background: 'var(--green-soft)',
                  padding: '8px 12px', borderRadius: 8, marginBottom: 12,
                }}>
                  {aviso}
                </div>
              )}

              <button type="submit" disabled={busy} style={{
                width: '100%', padding: '11px 18px',
                background: 'var(--ink)', color: 'var(--bg-soft)',
                borderRadius: 12, fontSize: 13, fontWeight: 500,
                opacity: busy ? .6 : 1, transition: 'opacity .15s',
              }}>
                {busy ? '...' : (mode === 'signin' || context === 'paciente' ? 'Entrar' : 'Criar conta de nutri')}
              </button>
            </form>

            {/* Mensagem de primeiro acesso — apenas em context=paciente */}
            {context === 'paciente' && (
              <p style={{
                marginTop: 16, fontSize: 12, color: 'var(--muted)',
                textAlign: 'center', lineHeight: 1.5,
              }}>
                Primeiro acesso? Use o link enviado pela sua nutricionista.
              </p>
            )}
          </>
        )}

        <BrandFooter />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', required, placeholder, autoFocus, minLength }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{
        display: 'block', fontSize: 11, letterSpacing: '.04em',
        color: 'var(--ink-soft)', marginBottom: 5, fontWeight: 500,
      }}>
        {label}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
        autoFocus={autoFocus}
        minLength={minLength}
        style={{
          width: '100%', padding: '10px 12px', fontSize: 13,
          background: 'var(--bg-soft)',
          border: '0.5px solid var(--hair)',
          borderRadius: 10, outline: 'none',
          color: 'var(--ink)',
        }}
      />
    </label>
  );
}
