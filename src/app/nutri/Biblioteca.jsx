import { useState } from 'react';
import { useSession } from '../../lib/session.jsx';
import BibliotecaEbooks from './_BibliotecaEbooks.jsx';
import BibliotecaOrientacoes from './_BibliotecaOrientacoes.jsx';

const TABS = [
  { id: 'ebooks',      label: 'E-books' },
  { id: 'orientacoes', label: 'Orientações' },
];

export default function Biblioteca() {
  const { user } = useSession();
  const [tab, setTab] = useState('ebooks');

  if (!user) return null;

  return (
    <>
      <div className="page-title">Biblioteca</div>
      <div className="page-sub">Conteúdo reutilizável para suas pacientes</div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '0.5px solid var(--border)', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              padding: '8px 16px', fontSize: 13, fontWeight: 500,
              fontFamily: 'var(--font-sans)',
              color: tab === t.id ? 'var(--dark)' : 'var(--text3)',
              borderBottom: tab === t.id ? '2px solid var(--dark)' : '2px solid transparent',
              marginBottom: -1,
            }}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'ebooks'      && <BibliotecaEbooks nutriId={user.id} />}
      {tab === 'orientacoes' && <BibliotecaOrientacoes nutriId={user.id} />}
    </>
  );
}
