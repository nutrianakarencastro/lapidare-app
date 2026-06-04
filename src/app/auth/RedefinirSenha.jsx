import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useTheme } from '../../lib/theme.jsx';
import BrandFooter from '../../components/BrandFooter.jsx';

export default function RedefinirSenha() {
  const tema     = useTheme();
  const navigate = useNavigate();

  // 'aguardando' → 'pronto' → 'salvo' | 'invalido'
  const [status, setStatus]   = useState('aguardando');
  const [senha, setSenha]     = useState('');
  const [confirma, setConfirma] = useState('');
  const [busy, setBusy]       = useState(false);
  const [erro, setErro]       = useState(null);

  useEffect(() => {
    // O SDK lê o token da URL automaticamente e dispara PASSWORD_RECOVERY
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('pronto');
    });

    // Se o evento não chegar em 4 s, o link é inválido ou expirado
    const timeout = setTimeout(() => {
      setStatus(prev => prev === 'aguardando' ? 'invalido' : prev);
    }, 4000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setErro(null);
    if (senha.length < 6) return setErro('A senha precisa ter pelo menos 6 caracteres.');
    if (senha !== confirma) return setErro('As senhas não conferem.');

    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: senha });
    setBusy(false);

    if (error) {
      setErro('Não foi possível salvar a nova senha. ' + error.message);
      return;
    }

    // Encerra a sessão de recovery antes de redirecionar
    await supabase.auth.signOut();
    navigate('/login', {
      replace: true,
      state: { aviso: 'Senha redefinida com sucesso! Faça login com sua nova senha.' },
    });
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
            Criar nova senha
          </h1>
        </div>

        {status === 'aguardando' && (
          <p style={{ textAlign: 'center', fontSize: 13, color: 'var(--muted)', padding: '16px 0' }}>
            Verificando link…
          </p>
        )}

        {status === 'invalido' && (
          <>
            <div style={{
              background: 'var(--red-soft)', color: 'var(--red)',
              padding: '12px 14px', borderRadius: 10, fontSize: 13, lineHeight: 1.6,
              marginBottom: 20,
            }}>
              Este link é inválido ou já expirou.
            </div>
            <Link to="/auth/esqueci-senha" style={{
              display: 'block', textAlign: 'center',
              fontSize: 13, color: 'var(--ink)', textDecoration: 'none',
              fontWeight: 500, marginBottom: 12,
            }}>
              Solicitar novo link →
            </Link>
            <Link to="/login" style={{
              display: 'block', textAlign: 'center',
              fontSize: 13, color: 'var(--muted)', textDecoration: 'none',
            }}>
              ← Voltar ao login
            </Link>
          </>
        )}

        {status === 'pronto' && (
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block', marginBottom: 12 }}>
              <span style={{
                display: 'block', fontSize: 11, letterSpacing: '.04em',
                color: 'var(--ink-soft)', marginBottom: 5, fontWeight: 500,
              }}>Nova senha</span>
              <input
                type="password" value={senha} onChange={e => setSenha(e.target.value)}
                required minLength={6} autoFocus
                style={{
                  width: '100%', padding: '10px 12px', fontSize: 13,
                  background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
                  borderRadius: 10, outline: 'none', color: 'var(--ink)',
                  boxSizing: 'border-box',
                }}
              />
            </label>

            <label style={{ display: 'block', marginBottom: 16 }}>
              <span style={{
                display: 'block', fontSize: 11, letterSpacing: '.04em',
                color: 'var(--ink-soft)', marginBottom: 5, fontWeight: 500,
              }}>Confirmar nova senha</span>
              <input
                type="password" value={confirma} onChange={e => setConfirma(e.target.value)}
                required minLength={6}
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
              transition: 'opacity .15s',
            }}>
              {busy ? '...' : 'Salvar nova senha'}
            </button>
          </form>
        )}

        <BrandFooter />
      </div>
    </div>
  );
}
