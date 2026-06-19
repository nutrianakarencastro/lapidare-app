/**
 * Rodapé de assinatura fixo — não pode ser editado pela personalização.
 * Aparece em todas as telas (nutri, paciente, login).
 *
 * Variante `compact` é pra ficar logo acima da tab bar do app da paciente.
 */
export default function BrandFooter({ compact = false }) {
  return (
    <div style={{
      textAlign: 'center',
      fontSize: compact ? 9 : 10,
      color: 'var(--muted, #999)',
      padding: compact ? '6px 8px 4px' : '20px 8px 14px',
      letterSpacing: '.06em',
      opacity: 0.6,
      fontFamily: 'var(--font-sans)',
      userSelect: 'none',
    }}>
      <strong style={{ fontWeight: 600 }}>Útera™</strong>
      <br />
      Metodologia e Sistema de Acompanhamento Nutricional Longitudinal Feminino
      <br />
      © AKC
    </div>
  );
}
