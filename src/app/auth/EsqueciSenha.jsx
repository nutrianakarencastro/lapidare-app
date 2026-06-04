import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useTheme } from '../../lib/theme.jsx';
import BrandFooter from '../../components/BrandFooter.jsx';

export default function EsqueciSenha() {
  const tema = useTheme();
  const [email, setEmail]   = useState('');
  const [busy, setBusy]     = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro]     = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    if (!email.trim()) return setErro('Informe seu email.');

    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: window.location.origin + '/auth/redefinir-senha',
    });
    setBusy(false);

    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (msg.includes('rate limit') || msg.includes('too many')) {
        setErro('Muitas tentativas. Aguarde alguns minutos e tente novamente.');
      } else {
        setErro('Não foi possível enviar o link. Tente novamente.');
      }
      return;
    }

    setEnviado(true);
  }

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
            fontFamily: 'var(--font-serif)', fontWeight: 500, fontSize: 26,
            letterSpacing: '-0.02em', color: 'var(--ink)', margin: 0,
          }}>
            Recuperar senha
          </h1>
        </div>

        {enviado ? (
          <>
            <div style={{
              background: 'var(--green-soft, #e8f5e9)', color: 'var(--green)',
              padding: '12px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
              marginBottom: 20,
            }}>
              Se esse email estiver cadastrado, você receberá um link em instantes.
              Verifique sua caixa de entrada e a pasta de spam.
            </div>
            <Link to="/login" style={{
              display: 'block', textAlign: 'center',
              fontSize: 13, color: 'var(--muted)', textDecoration: 'none',
            }}>
              ← Voltar ao login
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <p style={{
              fontSize: 13, color: 'var(--muted)', lineHeight: 1.6,
              marginBottom: 20, textAlign: 'center',
            }}>
              Informe o email da sua conta. Se ele estiver cadastrado,
              você receberá um link de redefinição.
            </p>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{
                display: 'block', fontSize: 11, letterSpacing: '.04em',
                color: 'var(--ink-soft)', marginBottom: 5, fontWeight: 500,
              }}>Email</span>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required autoFocus
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13,
                  background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
                  borderRadius: 10, outline: 'none', color: 'var(--ink)',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            {erro && (
              <div style={{
                fontSize: 12, color: 'var(--red)', background: 'var(--red-soft)',
                padding: '8px 12px', borderRadius: 8, marginBottom: 12,
              }}>
                {erro}
              </div>
            )}

            <button type="submit" disabled={busy} style={{
              width: '100%', padding: '11px 18px',
              background: 'var(--ink)', color: 'var(--bg-soft)',
              borderRadius: 12, fontSize: 13, fontWeight: 500, border: 'none',
              cursor: busy ? 'default' : 'pointer', opacity: busy ? .6 : 1,
              transition: 'opacity .15s', marginBottom: 14,
            }}>
              {busy ? '...' : 'Enviar link de acesso'}
            </button>

            <Link to="/login" style={{
              display: 'block', textAlign: 'center',
              fontSize: 13, color: 'var(--muted)', textDecoration: 'none',
            }}>
              ← Voltar ao login
            </Link>
          </form>
        )}

        <BrandFooter />
      </div>
    </div>
  );
}
