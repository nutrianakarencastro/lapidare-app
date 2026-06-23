const MAG_LABEL = { marcante: 'Marcante', moderada: 'Moderada', leve: 'Leve' };

const SETA_CIMA  = { marcante: '↑↑↑', moderada: '↑↑', leve: '↑' };
const SETA_BAIXO = { marcante: '↓↓↓', moderada: '↓↓', leve: '↓' };

const COR = {
  melhorou: 'var(--green, #16a34a)',
  piorou:   'var(--red,   #e05252)',
  estagnou: 'var(--text3)',
};
const BG = {
  melhorou: 'var(--green-bg, #f0fdf4)',
  piorou:   'var(--red-bg,   #fff5f5)',
  estagnou: 'var(--bg2)',
};

const CONFIANCA_CONFIG = {
  consistente: { cor: 'var(--green, #16a34a)', bg: 'var(--green-bg, #f0fdf4)', label: 'Consistente' },
  compatível:  { cor: 'var(--amber, #d97706)', bg: 'var(--yellow-bg, #fffbeb)', label: 'Compatível'  },
  observação:  { cor: 'var(--text3)',           bg: 'var(--bg2)',               label: 'Observação'  },
};

function valorTexto(item) {
  if (item.valorJ1 == null || item.valorJ2 == null) return null;
  return item.unidade === '%'
    ? `${item.valorJ1}% → ${item.valorJ2}%`
    : `${item.valorJ1} → ${item.valorJ2}`;
}

function LinhaMetrica({ item, tipo }) {
  const seta = tipo === 'melhorou'
    ? (SETA_CIMA[item.magnitude]  ?? '↑')
    : tipo === 'piorou'
    ? (SETA_BAIXO[item.magnitude] ?? '↓')
    : '→';
  const cor    = COR[tipo];
  const valTxt = valorTexto(item);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: cor, flexShrink: 0, minWidth: 22 }}>
        {seta}
      </span>
      <span style={{ flex: 1, fontSize: 13, color: 'var(--dark)' }}>
        {item.label}
      </span>
      {item.magnitude && (
        <span style={{
          fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
          color: cor, flexShrink: 0,
        }}>
          {MAG_LABEL[item.magnitude]}
        </span>
      )}
      {valTxt && (
        <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
          {valTxt}
        </span>
      )}
    </div>
  );
}

function SecaoGrupo({ titulo, items, tipo }) {
  if (!items.length) return null;
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{
        fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
        color: COR[tipo], marginBottom: 4,
      }}>
        {titulo}
      </div>
      <div style={{ background: BG[tipo], borderRadius: 8 }}>
        {items.map((item, i) => (
          <div key={item.id}>
            <LinhaMetrica item={item} tipo={tipo} />
            {i < items.length - 1 && (
              <div style={{ height: '0.5px', background: 'var(--border)', margin: '0 10px' }} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const FRAME_LBL = {
  fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
  color: 'var(--text3)', marginBottom: 4,
};

function FrameLeitura({ label, texto, badge }) {
  return (
    <div style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
        <span style={FRAME_LBL}>{label}</span>
        {badge && (
          <span style={{
            fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4,
            padding: '1px 6px', borderRadius: 10,
            background: badge.bg, color: badge.cor,
          }}>
            {badge.label}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--text1)', lineHeight: 1.65 }}>
        {texto}
      </div>
    </div>
  );
}

export default function EvolucaoConsulta({ dados, leituraClinica21 }) {
  if (!dados) return null;

  const { melhorou, piorou, estagnou, diasJ2 } = dados;
  const temDados = melhorou.length > 0 || piorou.length > 0 || estagnou.length > 0;

  const lc = leituraClinica21;
  const temLeitura = lc && (lc.hipotese || lc.investigar || lc.direcional || lc.continua);

  const labelSub = {
    fontSize: 11, letterSpacing: 1, textTransform: 'uppercase',
    color: 'var(--text3)', fontWeight: 500,
  };

  return (
    <div className="card" style={{ padding: '14px 16px', marginBottom: 16 }}>

      {/* Header */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ ...labelSub, marginBottom: 2 }}>Evolução desde a última consulta</div>
        <div style={{ fontSize: 11, color: 'var(--text4)' }}>
          Últimos 14 dias vs. 14 dias anteriores
          {diasJ2 > 0 && (
            <> · <strong style={{ color: 'var(--text3)' }}>{diasJ2}</strong> dia{diasJ2 !== 1 ? 's' : ''} registrado{diasJ2 !== 1 ? 's' : ''}</>
          )}
        </div>
      </div>

      {!temDados ? (
        <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
          Registros insuficientes para comparação — ao menos 5 dias por janela são necessários.
        </div>
      ) : (
        <>
          <SecaoGrupo titulo="▲ Melhorou" items={melhorou} tipo="melhorou" />
          <SecaoGrupo titulo="▼ Piorou"   items={piorou}   tipo="piorou"   />
          <SecaoGrupo titulo="→ Estagnou" items={estagnou} tipo="estagnou" />

          {/* Leitura Clínica 2.1 */}
          {temLeitura && (
            <div style={{
              borderLeft: '3px solid var(--blue, #3b82f6)',
              paddingLeft: 12,
              marginTop: 8,
            }}>
              <div style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                color: 'var(--blue, #3b82f6)', marginBottom: 10,
              }}>
                Leitura Clínica
              </div>

              {lc.hipotese && (
                <FrameLeitura
                  label="O que explica"
                  texto={lc.hipotese.texto}
                  badge={CONFIANCA_CONFIG[lc.hipotese.confianca]}
                />
              )}

              {lc.investigar && (
                <FrameLeitura
                  label="Investigar"
                  texto={lc.investigar}
                  badge={null}
                />
              )}

              {lc.direcional && (
                <FrameLeitura
                  label="Próxima fase"
                  texto={lc.direcional}
                  badge={null}
                />
              )}

              {lc.continua && (
                <div style={{ paddingBottom: 4 }}>
                  <div style={{ ...FRAME_LBL, marginBottom: 4 }}>O que continua verdadeiro</div>
                  <div style={{ fontSize: 13, color: 'var(--text1)', lineHeight: 1.65 }}>
                    {lc.continua}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div style={{ fontSize: 10, color: 'var(--text4)', fontStyle: 'italic', marginTop: 10 }}>
        Comparação automática. Não representa diagnóstico.
      </div>

    </div>
  );
}
