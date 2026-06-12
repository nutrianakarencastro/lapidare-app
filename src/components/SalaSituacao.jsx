const COR_PRIORIDADE = {
  alta:     { dot: 'var(--red)',    fundo: 'var(--red-bg, #fff5f5)',  borda: '0.5px solid var(--red-soft, #fcd5d5)' },
  observar: { dot: 'var(--orange)', fundo: 'transparent',             borda: 'none' },
  contexto: { dot: 'var(--text3)',  fundo: 'transparent',             borda: 'none' },
};

export default function SalaSituacao({ sinais, onIrParaTab }) {
  if (!sinais) return null;

  const temModuloEspecial = sinais.some(s => s.acao === 'glicemia' || s.acao === 'intestino');

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>
      <div style={{ marginBottom: sinais.length === 0 ? 8 : 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--dark)' }}>
          🚨 Hoje merece atenção
        </div>
        {temModuloEspecial && (
          <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
            Baseado nos últimos 14 dias.
          </div>
        )}
      </div>

      {sinais.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.55 }}>
          Nenhum sinal demanda atenção agora — acompanhamento em dia.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {sinais.map(s => {
            const cor      = COR_PRIORIDADE[s.prioridade];
            const clicavel = s.acao && onIrParaTab;
            return (
              <div
                key={s.id}
                onClick={clicavel ? () => onIrParaTab(s.acao) : undefined}
                style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '7px 10px', borderRadius: 8,
                  background: cor.fundo,
                  border: cor.borda,
                  cursor: clicavel ? 'pointer' : 'default',
                }}
              >
                <div style={{
                  width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                  background: cor.dot,
                }} />
                <div style={{ flex: 1, fontSize: 12, color: 'var(--text1)', lineHeight: 1.45 }}>
                  {s.texto}
                </div>
                {clicavel && (
                  <i className="ti ti-chevron-right" style={{ fontSize: 12, color: 'var(--text3)', flexShrink: 0 }} aria-hidden="true" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
