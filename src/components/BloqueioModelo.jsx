import { tierNome } from '../lib/modelos.js';

const WHATSAPP_URL = 'https://wa.me/5535999614602';

export default function BloqueioModelo({ modulo, tierMinimo }) {
  const nivel = tierNome(tierMinimo);
  const msg = tierMinimo === 3
    ? `Este módulo faz parte da Experiência Útera ${nivel}.`
    : `Este módulo faz parte das Experiências Útera ${nivel} e Completo.`;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '56px 32px', textAlign: 'center',
      minHeight: 320,
    }}>
      <div style={{ fontSize: 36, marginBottom: 18, opacity: .7 }}>🔒</div>
      <div style={{
        fontFamily: 'var(--font-serif)', fontSize: 22,
        color: 'var(--ink)', marginBottom: 12,
      }}>
        {modulo}
      </div>
      <div style={{
        fontSize: 14, color: 'var(--muted)', lineHeight: 1.65,
        marginBottom: 28, maxWidth: 280,
      }}>
        {msg} Fale com sua nutricionista para saber mais sobre as opções de cuidado disponíveis.
      </div>
      <a
        href={WHATSAPP_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 22px', borderRadius: 12,
          background: '#25d366', color: '#fff',
          fontSize: 14, fontWeight: 500,
          textDecoration: 'none', fontFamily: 'var(--font-sans)',
        }}
      >
        <i className="ti ti-brand-whatsapp" aria-hidden="true"></i>
        Falar com a nutricionista
      </a>
    </div>
  );
}
