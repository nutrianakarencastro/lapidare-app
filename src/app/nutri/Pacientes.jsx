import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase.js';
import { useSession } from '../../lib/session.jsx';
import { dataBR, iniciais } from '../../lib/utils.js';
import { PLANOS, OBJETIVOS, MODALIDADES } from '../../lib/opcoesClinicas.js';
import ImportarCsv from './_ImportarCsv.jsx';

export default function Pacientes() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [pacientes, setPacientes] = useState(null);
  const [pendentes, setPendentes] = useState([]);
  const [busca, setBusca] = useState('');
  const [importerOpen, setImporterOpen] = useState(false);
  const [showPendentes, setShowPendentes] = useState(false);
  const [editandoPendente,  setEditandoPendente]  = useState(null);
  const [salvandoPendente,  setSalvandoPendente]  = useState(false);

  async function carregar() {
    const [pacRes, pendRes] = await Promise.all([
      supabase
        .from('pacientes')
        .select('id, nome, email, objetivo, tipo_plano, modalidade, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('pacientes_pendentes')
        .select('*')
        .in('status', ['pendente', 'enviado'])
        .order('created_at', { ascending: false }),
    ]);
    setPacientes(pacRes.data ?? []);
    setPendentes(pendRes.data ?? []);
  }

  useEffect(() => { if (user) carregar(); }, [user]);

  async function copiarLinkSignup(p) {
    const link = p.token
      ? `${window.location.origin}/signup-paciente/${user.id}/${p.token}`
      : `${window.location.origin}/signup-paciente/${user.id}`;
    try {
      await navigator.clipboard.writeText(link);
      alert(`Link copiado! Envie pra ${p.nome.split(' ')[0]} por WhatsApp ou email.`);
    } catch {
      prompt('Copie o link abaixo:', link);
    }
    await supabase.from('pacientes_pendentes').update({ status: 'enviado' }).eq('id', p.id);
    carregar();
  }

  async function removerPendente(p) {
    if (!window.confirm(`Remover "${p.nome}" da lista de pendentes?`)) return;
    await supabase.from('pacientes_pendentes').delete().eq('id', p.id);
    carregar();
  }

  function perfilPreparado(p) {
    return !!(p.objetivo && p.tipo_plano && p.modalidade);
  }

  async function salvarPendente(form) {
    setSalvandoPendente(true);
    await supabase.from('pacientes_pendentes').update({
      nome:       form.nome?.trim()     || null,
      objetivo:   form.objetivo         || null,
      tipo_plano: form.tipo_plano       || null,
      modalidade: form.modalidade       || null,
      whatsapp:   form.whatsapp?.trim() || null,
      cpf:        form.cpf?.trim()      || null,
      nascimento: form.nascimento       || null,
      obs:        form.obs?.trim()      || null,
    }).eq('id', form.id);
    setSalvandoPendente(false);
    setEditandoPendente(null);
    carregar();
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

      {/* Banner de pendentes */}
      {pendentes.length > 0 && (
        <div className="al-b" style={{
          marginBottom: 14, background: 'var(--orange-bg)',
          borderLeftColor: 'var(--orange)',
          cursor: 'pointer',
        }} onClick={() => setShowPendentes(v => !v)}>
          <i className="ti ti-user-plus" style={{ fontSize: 16, color: 'var(--orange)', marginTop: 1 }} aria-hidden="true"></i>
          <div style={{ flex: 1 }}>
            <div className="al-t" style={{ color: 'var(--orange)' }}>
              {pendentes.length} paciente{pendentes.length === 1 ? '' : 's'} pendente{pendentes.length === 1 ? '' : 's'} de cadastro
            </div>
            <div className="al-d">
              Foram importadas mas ainda não criaram conta. Envie o link de cadastro pra ativar.
              {showPendentes ? ' Toque pra esconder.' : ' Toque pra ver.'}
            </div>
          </div>
          <i className={`ti ti-chevron-${showPendentes ? 'up' : 'down'}`} style={{ fontSize: 16, color: 'var(--orange)' }} aria-hidden="true"></i>
        </div>
      )}

      {showPendentes && pendentes.length > 0 && (
        <div className="card" style={{ padding: 0, marginBottom: 14 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>Email</th>
                <th>Objetivo</th>
                <th style={{ textAlign: 'right' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map(p => {
                const preparado = perfilPreparado(p);
                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{p.nome}</div>
                      <span style={{
                        fontSize: 9, fontWeight: 600, letterSpacing: '.08em',
                        textTransform: 'uppercase',
                        color: preparado ? 'var(--green)' : 'var(--text4)',
                      }}>
                        {preparado ? 'Perfil preparado' : 'Perfil incompleto'}
                      </span>
                    </td>
                    <td>{p.email}</td>
                    <td>{p.objetivo ?? '—'}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        <button
                          className="btn-outline"
                          style={{ fontSize: 10, padding: '4px 10px' }}
                          onClick={() => setEditandoPendente(p)}>
                          <i className="ti ti-edit" aria-hidden="true"></i> Preparar perfil
                        </button>
                        <button className="btn" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => copiarLinkSignup(p)}>
                          <i className="ti ti-link" aria-hidden="true"></i> Copiar link
                        </button>
                        <button onClick={() => removerPendente(p)}
                          style={{
                            background: 'none', border: '0.5px solid var(--red)',
                            borderRadius: 6, padding: '4px 8px',
                            color: 'var(--red)', cursor: 'pointer',
                          }}>
                          <i className="ti ti-trash" aria-hidden="true"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {importerOpen && (
        <ImportarCsv
          onClose={() => setImporterOpen(false)}
          onImported={() => { carregar(); setShowPendentes(true); }}
        />
      )}

      {editandoPendente && (
        <ModalEditarPendente
          p={editandoPendente}
          onClose={() => setEditandoPendente(null)}
          onSave={salvarPendente}
          salvando={salvandoPendente}
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
                <th>Cadastro</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/nutri/pacientes/${p.id}`)}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: 'var(--bg2)', display: 'flex',
                        alignItems: 'center', justifyContent: 'center',
                        fontSize: 12, fontWeight: 600, color: 'var(--dark)'
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
                  <td>{dataBR(p.created_at)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <i className="ti ti-chevron-right" style={{ color: 'var(--text3)' }} aria-hidden="true"></i>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function ModalEditarPendente({ p, onClose, onSave, salvando }) {
  const [form, setForm] = useState({ ...p });
  const sv = (k, v) => setForm(f => ({ ...f, [k]: v }));

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, background: 'rgba(28,23,18,.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 100, padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: 'var(--white)', borderRadius: 14, padding: 24,
        maxWidth: 480, width: '100%', maxHeight: '90vh', overflowY: 'auto',
        border: '0.5px solid var(--border)',
        boxShadow: '0 8px 32px rgba(28,23,18,.12)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--dark)' }}>Preparar perfil</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text3)', padding: 4 }}>
            <i className="ti ti-x" aria-hidden="true"></i>
          </button>
        </div>

        {/* Email — não editável */}
        <div style={{
          marginBottom: 14, padding: '8px 10px', borderRadius: 7,
          background: 'var(--bg2)', border: '0.5px solid var(--border)',
        }}>
          <div style={{ fontSize: 10, color: 'var(--text4)', marginBottom: 2 }}>
            Email — não editável (identifica o convite)
          </div>
          <div style={{ fontSize: 13, color: 'var(--text2)' }}>{p.email}</div>
        </div>

        {/* Nome */}
        <div style={{ marginBottom: 10 }}>
          <label className="form-lbl">Nome</label>
          <input value={form.nome ?? ''} onChange={e => sv('nome', e.target.value)} />
        </div>

        {/* Objetivo + Plano */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="form-lbl">Objetivo</label>
            <select value={form.objetivo ?? ''} onChange={e => sv('objetivo', e.target.value)}>
              <option value="">— Selecionar —</option>
              {OBJETIVOS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
          <div>
            <label className="form-lbl">Plano</label>
            <select value={form.tipo_plano ?? ''} onChange={e => sv('tipo_plano', e.target.value)}>
              <option value="">— Selecionar —</option>
              {PLANOS.filter(pl => pl.v !== 'outro_livre').map(pl => (
                <option key={pl.v} value={pl.v}>{pl.l}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Modalidade + Nascimento */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="form-lbl">Modalidade</label>
            <select value={form.modalidade ?? ''} onChange={e => sv('modalidade', e.target.value)}>
              <option value="">— Selecionar —</option>
              {MODALIDADES.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="form-lbl">Nascimento</label>
            <input type="date" value={form.nascimento ?? ''} onChange={e => sv('nascimento', e.target.value)} />
          </div>
        </div>

        {/* Telefone + CPF */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
          <div>
            <label className="form-lbl">Telefone / WhatsApp</label>
            <input value={form.whatsapp ?? ''} onChange={e => sv('whatsapp', e.target.value)} placeholder="(11) 99999-9999" />
          </div>
          <div>
            <label className="form-lbl">CPF</label>
            <input value={form.cpf ?? ''} onChange={e => sv('cpf', e.target.value)} placeholder="000.000.000-00" />
          </div>
        </div>

        {/* Observações */}
        <div style={{ marginBottom: 16 }}>
          <label className="form-lbl">Observações internas</label>
          <textarea
            value={form.obs ?? ''}
            onChange={e => sv('obs', e.target.value)}
            rows={2}
            placeholder="Anotações sobre a paciente..."
            style={{ width: '100%', resize: 'vertical', minHeight: 52, boxSizing: 'border-box' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn-outline" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Cancelar
          </button>
          <button className="btn" style={{ flex: 1, justifyContent: 'center' }} onClick={() => onSave(form)} disabled={salvando}>
            <i className="ti ti-check" aria-hidden="true"></i> {salvando ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </div>
    </div>
  );
}
