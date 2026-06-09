import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR, iniciais } from '../../lib/utils.js';
import ImportarCsv from './_ImportarCsv.jsx';

const BADGE = {
  nao_convidada:   { label: 'Não convidada',   bg: 'var(--orange-bg)', color: 'var(--orange)' },
  convite_enviado: { label: 'Convite enviado',  bg: 'var(--blue-bg)',   color: 'var(--blue)'   },
  ativa:           { label: 'Ativa',            bg: 'var(--green-bg)',  color: 'var(--green)'  },
  arquivada:       { label: 'Arquivada',        bg: 'var(--bg2)',       color: 'var(--text3)'  },
};

export default function Pacientes() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [pacientes, setPacientes] = useState(null);
  const [busca, setBusca] = useState('');
  const [importerOpen, setImporterOpen] = useState(false);

  async function carregar() {
    const { data } = await supabase
      .from('pacientes')
      .select('id, nome, email, objetivo, tipo_plano, modalidade, created_at, status_app, token')
      .order('created_at', { ascending: false });
    setPacientes(data ?? []);
  }

  useEffect(() => { if (user) carregar(); }, [user]);

  async function copiarLink(e, p) {
    e.stopPropagation();
    const temConta = p.status_app === 'ativa' || p.status_app === 'arquivada';
    const link = temConta
      ? `${window.location.origin}/paciente/login`
      : `${window.location.origin}/signup-paciente/${user.id}/${p.token}`;
    const primeiroNome = p.nome?.split(' ')[0] ?? 'paciente';
    try {
      await navigator.clipboard.writeText(link);
      alert(temConta
        ? `Link de login copiado para ${primeiroNome}.`
        : `Link de convite copiado! Envie para ${primeiroNome}.`
      );
    } catch {
      prompt('Copie o link abaixo:', link);
    }
    if (p.status_app === 'nao_convidada') {
      await supabase.from('pacientes').update({ status_app: 'convite_enviado' }).eq('id', p.id);
      carregar();
    }
  }

  const filtradas = useMemo(() => {
    if (!pacientes) return [];
    const q = busca.trim().toLowerCase();
    if (!q) return pacientes;
    return pacientes.filter(p =>
      p.nome?.toLowerCase().includes(q) || p.email?.toLowerCase().includes(q)
    );
  }, [pacientes, busca]);

  return (
    <>
      <div className="page-title">Pacientes</div>
      <div className="page-sub">Gerencie todas as suas pacientes</div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 12, flexWrap: 'wrap' }}>
        <input
          style={{ width: 240, margin: 0 }}
          className="input-field"
          placeholder="Buscar paciente..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" onClick={() => setImporterOpen(true)}>
            <i className="ti ti-file-upload" aria-hidden="true"></i> Importar CSV
          </button>
          <button className="btn" onClick={() => navigate('/nutri/cadastrar')}>
            <i className="ti ti-user-plus" style={{ fontSize: 15 }} aria-hidden="true"></i>
            Nova paciente
          </button>
        </div>
      </div>

      {importerOpen && (
        <ImportarCsv
          onClose={() => setImporterOpen(false)}
          onImported={() => { carregar(); setImporterOpen(false); }}
        />
      )}

      {pacientes === null ? (
        <div className="card empty-card">
          <div className="empty-sub">Carregando…</div>
        </div>
      ) : pacientes.length === 0 ? (
        <div className="card empty-card">
          <i className="ti ti-users empty-icon" aria-hidden="true"></i>
          <div className="empty-title">Nenhuma paciente cadastrada ainda</div>
          <div className="empty-sub">
            Cadastre a primeira paciente para começar a publicar planos, prescrições e acompanhar progresso.
          </div>
          <button className="btn" onClick={() => navigate('/nutri/cadastrar')}>
            <i className="ti ti-user-plus" aria-hidden="true"></i> Cadastrar primeira paciente
          </button>
        </div>
      ) : filtradas.length === 0 ? (
        <div className="card empty-card">
          <div className="empty-sub">Nenhuma paciente encontrada para "{busca}".</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Paciente</th>
                <th>Objetivo</th>
                <th>Plano</th>
                <th>Modalidade</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(p => {
                const badge = BADGE[p.status_app] ?? BADGE.nao_convidada;
                const temConta = p.status_app === 'ativa' || p.status_app === 'arquivada';
                return (
                  <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/nutri/pacientes/${p.id}`)}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: 'var(--bg2)', display: 'flex',
                          alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 600, color: 'var(--dark)',
                        }}>{iniciais(p.nome)}</div>
                        <div>
                          <div style={{ fontWeight: 500 }}>{p.nome}</div>
                          <div style={{ fontSize: 12, color: 'var(--text3)' }}>{p.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>{p.objetivo ?? '—'}</td>
                    <td>{p.tipo_plano ?? '—'}</td>
                    <td>{p.modalidade ?? '—'}</td>
                    <td>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 999,
                        background: badge.bg, color: badge.color,
                        fontWeight: 600, letterSpacing: '.04em',
                        textTransform: 'uppercase', whiteSpace: 'nowrap',
                      }}>
                        {badge.label}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <button
                          className="btn-outline"
                          style={{ fontSize: 10, padding: '3px 9px' }}
                          onClick={(e) => copiarLink(e, p)}
                        >
                          <i className="ti ti-link" aria-hidden="true"></i>{' '}
                          {temConta ? 'Copiar login' : 'Copiar link'}
                        </button>
                        <i className="ti ti-chevron-right" style={{ color: 'var(--text3)' }} aria-hidden="true"></i>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
