import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR } from '../../lib/utils.js';

const PREVIEW_LEN = 200;

const CAT_EMOJI = {
  sangue:     '🩸',
  urina:      '💧',
  saliva:     '🫧',
  fezes:      '🔬',
  intestinal: '🦠',
  genetico:   '🧬',
  hormonal:   '⚡',
  microbiota: '🦠',
  toxicidade: '🧪',
  imagem:     '🖼️',
  outro:      '📄',
};

const STATUS_BADGE = {
  solicitado:           { label: 'Solicitado',           bg: '#f3f4f6', color: '#6b7280' },
  aguardando_resultado: { label: 'Aguardando resultado', bg: '#fef9c3', color: '#854d0e' },
  recebido:             { label: 'Recebido',             bg: '#dbeafe', color: '#1d4ed8' },
  avaliado:             { label: 'Avaliado',             bg: '#dcfce7', color: '#166534' },
};

function StatusPill({ status }) {
  const s = STATUS_BADGE[status] ?? STATUS_BADGE.solicitado;
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: '.08em',
      padding: '2px 8px', borderRadius: 99,
      background: s.bg, color: s.color,
      whiteSpace: 'nowrap',
    }}>
      {s.label.toUpperCase()}
    </span>
  );
}

function TextoSecao({ titulo, conteudo, cor, bgCor, icone }) {
  if (!conteudo) return null;
  return (
    <div style={{
      margin: '0 16px 12px',
      padding: '14px 16px',
      background: bgCor,
      border: `0.5px solid ${cor}`,
      borderRadius: 14,
    }}>
      <div style={{
        fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
        color: cor, fontWeight: 600, marginBottom: 8,
      }}>
        {icone}  {titulo}
      </div>
      <div style={{
        fontSize: 13, color: 'var(--ink)', lineHeight: 1.65,
        whiteSpace: 'pre-wrap',
      }}>
        {conteudo}
      </div>
    </div>
  );
}

function ArquivoCard({ arq, onAbrir, abrindo }) {
  const temPdf = !!arq.storage_path;
  const abrindoEste = abrindo.has(arq.id);
  return (
    <div style={{
      margin: '0 16px 8px', padding: '12px 14px',
      background: 'var(--white)', border: '0.5px solid var(--hair)',
      borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <span style={{ fontSize: 20, flexShrink: 0 }}>{CAT_EMOJI[arq.categoria] ?? '📄'}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
          {arq.titulo || arq.nome_arquivo}
        </div>
        <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <StatusPill status={arq.status} />
          {arq.data_recebimento && <span>Recebido em {dataBR(arq.data_recebimento)}</span>}
        </div>
      </div>
      {temPdf && (
        <button
          onClick={() => onAbrir(arq)}
          disabled={abrindoEste}
          style={{
            background: 'var(--bg-soft)', border: 'none', borderRadius: 8,
            padding: '6px 10px', cursor: abrindoEste ? 'default' : 'pointer',
            fontSize: 11, color: 'var(--ink)', fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0,
            opacity: abrindoEste ? 0.6 : 1,
          }}>
          <i className="ti ti-file-type-pdf" style={{ color: '#e05252', fontSize: 14 }} aria-hidden="true" />
          {abrindoEste ? 'Abrindo…' : 'PDF'}
        </button>
      )}
    </div>
  );
}

function AvaliacaoView({ avaliacao, user, isHistorico }) {
  const [analiseFull, setAnaliseFull] = useState(false);
  const [abrindo, setAbrindo] = useState(new Set());

  const arquivos = (avaliacao.exames_arquivos ?? []).slice()
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const pedidos   = arquivos.filter(a => a.tipo === 'pedido');
  const resultados = arquivos.filter(a => a.tipo === 'resultado');

  const analise = avaliacao.avaliacao_funcional ?? '';
  const analisePreview = analise.length > PREVIEW_LEN
    ? analise.slice(0, PREVIEW_LEN) + '…'
    : analise;

  async function abrirArquivo(arq) {
    if (!arq.storage_path?.startsWith(user.id + '/')) return;
    setAbrindo(s => new Set(s).add(arq.id));
    const win = window.open('', '_blank');
    const { data: signed, error } = await supabase.storage
      .from('exames').createSignedUrl(arq.storage_path, 120);
    setAbrindo(s => { const n = new Set(s); n.delete(arq.id); return n; });
    if (error || !signed?.signedUrl) { win?.close(); return; }
    if (win) win.location.href = signed.signedUrl;
    else window.location.href = signed.signedUrl;
  }

  return (
    <>
      {/* Card header */}
      <div className="card dark" style={{ padding: '16px 18px', margin: '0 16px 14px' }}>
        <div style={{
          fontSize: 9, letterSpacing: '.22em', textTransform: 'uppercase',
          color: 'rgba(255,255,255,.5)', marginBottom: 4,
        }}>
          {isHistorico ? 'Análise anterior' : 'Análise mais recente'}
        </div>
        <div className="serif" style={{ fontSize: 20, color: 'var(--bg-soft)', lineHeight: 1.1, marginBottom: 4 }}>
          {avaliacao.titulo || 'Análise de Exames'}
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.5)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {avaliacao.data_avaliacao && <span>Avaliação: {dataBR(avaliacao.data_avaliacao)}</span>}
          {avaliacao.data_coleta    && <span>Coleta: {dataBR(avaliacao.data_coleta)}</span>}
        </div>
      </div>

      {/* Conquistas */}
      <TextoSecao
        titulo="Conquistas da sua saúde"
        icone="✨"
        conteudo={avaliacao.conquistas}
        bgCor="var(--green-soft, #f0fdf4)"
        cor="var(--green, #16a34a)"
      />

      {/* Impacto nos sintomas */}
      <TextoSecao
        titulo="Impacto nos sintomas"
        icone="💬"
        conteudo={avaliacao.impacto_nos_sintomas}
        bgCor="#eff6ff"
        cor="#3b82f6"
      />

      {/* Evolução */}
      <TextoSecao
        titulo="Evolução"
        icone="📈"
        conteudo={avaliacao.evolucao_resumida}
        bgCor="var(--white)"
        cor="var(--hair)"
      />

      {/* Pontos de atenção */}
      <TextoSecao
        titulo="Pontos de atenção"
        icone="⚠️"
        conteudo={avaliacao.pontos_atencao}
        bgCor="var(--gold-soft)"
        cor="var(--gold-deep)"
      />

      {/* Próximos passos */}
      {avaliacao.proximos_passos && (
        <div style={{
          margin: '0 16px 12px', padding: '14px 16px',
          background: 'var(--bg-soft)', border: '0.5px solid var(--hair)',
          borderRadius: 14,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 600, marginBottom: 10,
          }}>
            →  Próximos passos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {avaliacao.proximos_passos.split('\n').filter(l => l.trim()).map((linha, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: 'var(--muted)', marginTop: 5,
                }} />
                <span style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.5 }}>
                  {linha.replace(/^[•\-○]\s*/, '')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Análise da nutricionista com preview */}
      {analise && (
        <div style={{
          margin: '0 16px 12px', padding: '14px 16px',
          background: 'var(--white)', border: '0.5px solid var(--hair)',
          borderRadius: 14,
        }}>
          <div style={{
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 600, marginBottom: 8,
          }}>
            Análise da sua nutricionista
          </div>
          <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.65, whiteSpace: 'pre-wrap' }}>
            {analiseFull ? analise : analisePreview}
          </div>
          {analise.length > PREVIEW_LEN && (
            <button
              onClick={() => setAnaliseFull(v => !v)}
              style={{
                marginTop: 8, background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--gold-deep)', fontFamily: 'var(--font-sans)',
                padding: 0, fontWeight: 500,
              }}>
              {analiseFull ? 'Ver menos' : 'Continuar lendo ›'}
            </button>
          )}
        </div>
      )}

      {/* Pedidos */}
      {pedidos.length > 0 && (
        <div style={{ margin: '0 0 4px' }}>
          <div style={{
            margin: '0 16px 8px',
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 500,
          }}>
            Pedidos · {pedidos.length}
          </div>
          {pedidos.map(arq => (
            <ArquivoCard key={arq.id} arq={arq} onAbrir={abrirArquivo} abrindo={abrindo} />
          ))}
        </div>
      )}

      {/* Resultados */}
      {resultados.length > 0 && (
        <div style={{ margin: '8px 0 4px' }}>
          <div style={{
            margin: '0 16px 8px',
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 500,
          }}>
            Resultados · {resultados.length}
          </div>
          {resultados.map(arq => (
            <ArquivoCard key={arq.id} arq={arq} onAbrir={abrirArquivo} abrindo={abrindo} />
          ))}
        </div>
      )}
    </>
  );
}

export default function Exames() {
  const { user } = useSession();
  const [avaliacoes, setAvaliacoes] = useState(undefined); // undefined=loading
  const [selectedId, setSelectedId] = useState(null);

  const carregar = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('exames_avaliacoes')
      .select('*, exames_arquivos(*)')
      .eq('paciente_id', user.id)
      .order('data_avaliacao', { ascending: false });
    setAvaliacoes(data ?? []);

    // Marca a mais recente como vista via RPC (paciente só tem SELECT na tabela)
    if (data?.[0] && (!data[0].visto_pela_paciente_em ||
      new Date(data[0].atualizado_em) > new Date(data[0].visto_pela_paciente_em))) {
      supabase.rpc('marcar_exame_visto', { p_avaliacao_id: data[0].id });
    }
  }, [user]);

  useEffect(() => { carregar(); }, [carregar]);

  if (avaliacoes === undefined) {
    return <div className="empty-state"><div className="empty-sub">Carregando…</div></div>;
  }

  if (avaliacoes.length === 0) {
    return (
      <div className="empty-state">
        <i className="ti ti-flask empty-icon" aria-hidden="true"></i>
        <div className="empty-title">Nenhum exame ainda</div>
        <div className="empty-sub">
          Seus exames e análises aparecerão aqui quando sua nutricionista publicar.
        </div>
      </div>
    );
  }

  const avaliacao = selectedId
    ? avaliacoes.find(a => a.id === selectedId) ?? avaliacoes[0]
    : avaliacoes[0];

  const historico = avaliacoes.filter(a => a.id !== avaliacao.id);

  return (
    <>
      {/* Botão voltar quando em avaliação histórica */}
      {selectedId && (
        <button
          onClick={() => setSelectedId(null)}
          style={{
            margin: '0 16px 10px',
            background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--muted)', fontFamily: 'var(--font-sans)',
            display: 'flex', alignItems: 'center', gap: 4, padding: 0,
          }}>
          <i className="ti ti-chevron-left" style={{ fontSize: 14 }} aria-hidden="true" />
          Análise mais recente
        </button>
      )}

      <AvaliacaoView avaliacao={avaliacao} user={user} isHistorico={!!selectedId} />

      {/* Histórico — só na view principal */}
      {!selectedId && historico.length > 0 && (
        <div style={{ margin: '16px 0 0' }}>
          <div style={{
            margin: '0 16px 8px',
            fontSize: 10, letterSpacing: '.18em', textTransform: 'uppercase',
            color: 'var(--muted)', fontWeight: 500,
          }}>
            Análises anteriores
          </div>
          {historico.map(av => {
            const total = av.exames_arquivos?.length ?? 0;
            const conquistas = av.conquistas ? 1 : 0;
            return (
              <div
                key={av.id}
                onClick={() => setSelectedId(av.id)}
                style={{
                  margin: '0 16px 8px', padding: '12px 14px',
                  background: 'var(--white)', border: '0.5px solid var(--hair)',
                  borderRadius: 12, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
                    {av.titulo || 'Análise de Exames'}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                    {av.data_avaliacao && dataBR(av.data_avaliacao)}
                    {total > 0 && ` · ${total} arquivo${total !== 1 ? 's' : ''}`}
                    {conquistas > 0 && ' · conquistas'}
                  </div>
                </div>
                <i className="ti ti-chevron-right" style={{ fontSize: 15, color: 'var(--muted)', flexShrink: 0 }} aria-hidden="true" />
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
