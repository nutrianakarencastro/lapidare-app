export default function Protocolos() {
  return (
    <div style={{ maxWidth: 560, margin: '48px auto', padding: '0 24px', textAlign: 'center' }}>
      <div style={{
        width: 56, height: 56, borderRadius: 16,
        background: 'var(--bg2)', border: '0.5px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto 20px',
      }}>
        <i className="ti ti-clipboard-heart" style={{ fontSize: 26, color: 'var(--text3)' }} aria-hidden="true" />
      </div>

      <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--dark)', marginBottom: 12 }}>
        Protocolos Terapêuticos
      </div>

      <div style={{
        fontSize: 14, color: 'var(--text2)', lineHeight: 1.75,
        marginBottom: 28,
      }}>
        Em breve, você poderá estruturar, documentar e reutilizar caminhos
        terapêuticos desenvolvidos ao longo da prática clínica.
        <br /><br />
        Os protocolos não substituem o cuidado individualizado —
        eles organizam o raciocínio clínico.
      </div>

      <button
        disabled
        style={{
          padding: '9px 20px', borderRadius: 8,
          background: 'var(--bg2)', border: '0.5px solid var(--border)',
          fontSize: 13, color: 'var(--text3)',
          cursor: 'default', fontFamily: 'var(--font-sans)',
        }}
      >
        Em desenvolvimento
      </button>
    </div>
  );
}
