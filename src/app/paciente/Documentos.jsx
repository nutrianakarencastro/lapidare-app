import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';

const TIPO_LABEL = {
  contrato:          'Contrato',
  recibo:            'Recibo',
  declaracao:        'Declaração',
  termo:             'Termo',
  encaminhamento:    'Encaminhamento',
  relatorio_clinico: 'Relatório clínico',
  laudo:             'Laudo',
  outro:             'Outro',
};

const STATUS_CFG = {
  enviado:   { label: 'Enviado',   bg: '#f3f4f6', color: '#6b7280' },
  assinado:  { label: 'Assinado',  bg: '#dbeafe', color: '#1d4ed8' },
  arquivado: { label: 'Arquivado', bg: '#f1f5f9', color: '#94a3b8' },
};

function fmtData(d) {
  if (!d) return '';
  const [y, m, dia] = String(d).split('-');
  return `${dia}/${m}/${y}`;
}

export default function DocumentosPaciente() {
  const { user } = useSession();
  const [documentos, setDocumentos] = useState(null);
  const [erro,       setErro]       = useState(null);
  const [pdfUrls,    setPdfUrls]    = useState({});

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data, error } = await supabase
        .from('documentos')
        .select('id, titulo, tipo, descricao, status, data_documento, pdf_path, pdf_nome, link_externo')
        .eq('paciente_id', user.id)
        .order('data_documento', { ascending: false });

      if (error) { setErro(error.message); setDocumentos([]); return; }
      const lista = data ?? [];
      setDocumentos(lista);

      const paths = lista.filter(d => d.pdf_path).map(d => d.pdf_path);
      if (paths.length > 0) {
        const { data: signed } = await supabase.storage
          .from('documentos').createSignedUrls(paths, 3600);
        const map = {};
        for (const s of signed ?? []) {
          const d = lista.find(x => x.pdf_path === s.path);
          if (d && s.signedUrl) map[d.id] = s.signedUrl;
        }
        setPdfUrls(map);
      }
    })();
  }, [user]);

  if (documentos === null)
    return <div className="card empty-card"><div className="empty-sub">Carregando…</div></div>;

  if (erro)
    return (
      <div className="card empty-card">
        <i className="ti ti-alert-circle empty-icon" style={{ color: 'var(--red)' }} aria-hidden="true" />
        <div className="empty-title">Não foi possível carregar</div>
        <div className="empty-sub">{erro}</div>
      </div>
    );

  if (documentos.length === 0)
    return (
      <div className="card empty-card">
        <i className="ti ti-files empty-icon" aria-hidden="true" />
        <div className="empty-title">Nenhum documento ainda</div>
        <div className="empty-sub">
          Sua nutricionista enviará contratos, recibos e outros documentos aqui.
        </div>
      </div>
    );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 16 }}>
      {documentos.map(doc => {
        const stCfg    = STATUS_CFG[doc.status] ?? STATUS_CFG.enviado;
        const tipoLabel = TIPO_LABEL[doc.tipo] ?? doc.tipo;
        const pdfUrl   = pdfUrls[doc.id];
        const hasLink  = !!(pdfUrl || doc.link_externo);

        return (
          <div key={doc.id} style={{
            border: '0.5px solid var(--hair)',
            borderRadius: 14,
            background: 'var(--white)',
            padding: '14px 16px',
            opacity: doc.status === 'arquivado' ? 0.7 : 1,
          }}>
            {/* Badges */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 99,
                background: 'var(--bg-soft)', color: 'var(--muted)', fontWeight: 500,
              }}>{tipoLabel}</span>
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 99,
                background: stCfg.bg, color: stCfg.color, fontWeight: 500,
              }}>{stCfg.label}</span>
            </div>

            {/* Título */}
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--ink)', marginBottom: 4 }}>
              {doc.titulo}
            </div>

            {/* Descrição */}
            {doc.descricao && (
              <div style={{ fontSize: 12, color: 'var(--muted)', lineHeight: 1.4, marginBottom: 6 }}>
                {doc.descricao}
              </div>
            )}

            {/* Data */}
            {doc.data_documento && (
              <div style={{ fontSize: 11, color: 'var(--muted)', marginBottom: hasLink ? 12 : 0 }}>
                {fmtData(doc.data_documento)}
              </div>
            )}

            {/* Botões de abertura — <a> tag para compatibilidade com iOS Safari */}
            {hasLink && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {pdfUrl && (
                  <a href={pdfUrl} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, fontSize: 13,
                      background: 'var(--dark)', color: '#fff',
                      textDecoration: 'none', fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                    }}>
                    <i className="ti ti-file-type-pdf" style={{ fontSize: 14 }} aria-hidden="true" />
                    Abrir PDF
                  </a>
                )}
                {doc.link_externo && (
                  <a href={doc.link_externo} target="_blank" rel="noopener noreferrer"
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                      padding: '8px 16px', borderRadius: 8, fontSize: 13,
                      background: 'var(--white)', color: 'var(--dark)',
                      border: '0.5px solid var(--hair)',
                      textDecoration: 'none', fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                    }}>
                    <i className="ti ti-external-link" style={{ fontSize: 14 }} aria-hidden="true" />
                    Abrir link
                  </a>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
