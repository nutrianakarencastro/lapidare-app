import { useState, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import BrandFooter from './BrandFooter.jsx';
import { useSession, signOut } from '../lib/session.jsx';
import { useTheme } from '../lib/theme.jsx';
import { iniciais } from '../lib/utils.js';
import '../styles/paciente.css';

const WHATSAPP_URL = 'https://wa.me/5535999614602';

const TABS = [
  { id: 'inicio',    path: '/paciente/inicio',    label: 'Início',    icon: 'home' },
  { id: 'plano',     path: '/paciente/plano',     label: 'Plano',     icon: 'salad' },
  { id: 'feed',      path: '/paciente/feed',      label: 'Pratos',    icon: 'camera' },
  { id: 'progresso', path: '/paciente/progresso', label: 'Progresso', icon: 'trending-up' },
  { id: 'mais',                                    label: 'Mais',      icon: 'menu-2' },
];

const MAIS_ITEMS = [
  { path: '/paciente/compras',     icon: 'shopping-cart',  label: 'Lista de compras',      sub: 'Lista da semana' },
  { path: '/paciente/suplementos', icon: 'pill',           label: 'Suplementos',           sub: 'Lista do dia' },
  { path: '/paciente/habitos',     icon: 'checklist',      label: 'Hábitos',               sub: 'Tracker diário' },
  // Prescrições desativada — pedidos/resultados → Exames; laudos → futura aba Documentos
  // { path: '/paciente/prescricoes', icon: 'file-text', label: 'Prescrições', sub: 'Documentos da Dra.' },
  { path: '/paciente/ebooks',      icon: 'book-2',         label: 'E-books',               sub: 'Materiais da Dra.' },
  { path: '/paciente/ciclo',       icon: 'moon',           label: 'Ciclo & Hormônios',     sub: 'Acompanhe seu ciclo' },
  { path: '/paciente/jornada',     icon: 'route',          label: 'Minha jornada',         sub: 'Fases e evolução' },
  // CHAT DESATIVADO — canal oficial é WhatsApp. Reativar: descomentar linha abaixo e remover o item whatsapp.
  // { path: '/paciente/chat', icon: 'message-circle', label: 'Chat com a Dra.', sub: 'Conversa direta' },
  { path: '/paciente/exames',        icon: 'flask',          label: 'Exames & Análises',          sub: 'Resultados e avaliações' },
  { path: '/paciente/orientacoes',   icon: 'notebook',       label: 'Orientações',                sub: 'Conteúdo da Dra.' },
  { href: WHATSAPP_URL,              icon: 'brand-whatsapp', label: 'Falar com a Dra. Ana Karen', sub: 'Abre o WhatsApp' },
];

const HEADERS = {
  '/paciente/inicio':       (nome) =>           ({ eyebrow: 'Meu plano',         title: `Bom dia, ${nome}` }),
  '/paciente/plano':        () =>                ({ eyebrow: 'Plano alimentar',  title: 'Meu plano',         subtitle: '' }),
  '/paciente/feed':         () =>                ({ eyebrow: 'Diário alimentar', title: 'Pratos',            subtitle: 'Registre o que você comeu' }),
  '/paciente/progresso':    () =>                ({ eyebrow: 'Minha evolução',   title: 'Progresso' }),
  '/paciente/compras':      () =>                ({ eyebrow: 'Lista',            title: 'Compras',           subtitle: 'Para a semana' }),
  // '/paciente/prescricoes':  () => ({ eyebrow: 'Documentos', title: 'Prescrições' }),
  '/paciente/ebooks':       () =>                ({ eyebrow: 'Materiais',        title: 'E-books',           subtitle: 'Compartilhados pela sua nutri' }),
  '/paciente/suplementos':  () =>                ({ eyebrow: 'Habit tracker',    title: 'Meus suplementos',  subtitle: 'Marque diariamente' }),
  '/paciente/habitos':      () =>                ({ eyebrow: 'Hábitos do dia',   title: 'Meus hábitos',      subtitle: 'Acompanhe sua rotina' }),
  '/paciente/ciclo':        () =>                ({ eyebrow: 'Saúde hormonal',   title: 'Ciclo & Hormônios',     subtitle: 'Acompanhe seu ciclo menstrual' }),
  '/paciente/jornada':      () =>                ({ eyebrow: 'Minha evolução',   title: 'Minha jornada',         subtitle: 'Fases e marcos do acompanhamento' }),
  '/paciente/exames':       () =>                ({ eyebrow: 'Saúde & Exames',   title: 'Meus Exames',           subtitle: 'Análises e resultados' }),
  '/paciente/orientacoes':  () =>                ({ eyebrow: 'Meu conteúdo',     title: 'Orientações',           subtitle: 'Enviadas pela sua nutri' }),
  // '/paciente/chat':      (_nome, nutriNome) => ({ eyebrow: 'Conversa', title: nutriNome || 'Sua nutri', subtitle: 'Online' }),
};

export default function PacienteLayout() {
  const { profile } = useSession();
  const tema = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  const primeiroNome = profile?.nome?.split(' ')[0] ?? '';

  const header = useMemo(() => {
    const factory = HEADERS[location.pathname];
    return factory ? factory(primeiroNome, tema.nutri_nome) : { eyebrow: '', title: '' };
  }, [location.pathname, primeiroNome, tema.nutri_nome]);

  const handleSignOut = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="paciente-app">
      <header className="app-header">
        <div style={{ flex: 1, minWidth: 0 }}>
          {header.eyebrow && <div className="eyebrow">{header.eyebrow}</div>}
          <div className="app-title">{header.title}</div>
          {header.subtitle && <div className="app-subtitle">{header.subtitle}</div>}
        </div>
        <div className="header-right">
          <div className="header-avatar">{iniciais(profile?.nome)}</div>
        </div>
      </header>

      <div className="body">
        <Outlet />
        <BrandFooter compact />
      </div>

      <nav className="tabbar" role="tablist">
        {TABS.map(t => {
          const active = t.path
            ? location.pathname === t.path
            : ['/paciente/compras', '/paciente/suplementos', '/paciente/habitos', '/paciente/ebooks', '/paciente/ciclo', '/paciente/jornada', '/paciente/exames', '/paciente/orientacoes'].includes(location.pathname);

          if (!t.path) {
            return (
              <button
                key={t.id}
                className={`tab ${active ? 'active' : ''}`}
                onClick={() => setMoreOpen(true)}
                role="tab"
              >
                <i className={`ti ti-${t.icon}`} aria-hidden="true"></i>
                <span>{t.label}</span>
              </button>
            );
          }

          return (
            <NavLink
              key={t.id}
              to={t.path}
              className={({ isActive }) => 'tab' + (isActive ? ' active' : '')}
              role="tab"
            >
              <i className={`ti ti-${t.icon}`} aria-hidden="true"></i>
              <span>{t.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {moreOpen && (
        <div className="sheet-backdrop" onClick={() => setMoreOpen(false)}>
          <div className="sheet" onClick={e => e.stopPropagation()}>
            <div className="grabber"></div>
            <div className="serif" style={{ fontSize: 22, marginBottom: 14 }}>Mais</div>
            {MAIS_ITEMS.map(item => (
              <button
                key={item.path ?? item.href}
                className="sheet-item"
                onClick={() => {
                  setMoreOpen(false);
                  if (item.href) {
                    window.open(item.href, '_blank', 'noopener,noreferrer');
                  } else {
                    navigate(item.path);
                  }
                }}>
                <div className="icon-wrap">
                  <i className={`ti ti-${item.icon}`} aria-hidden="true"></i>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="label">{item.label}</div>
                  <div className="sub">{item.sub}</div>
                </div>
                <i className="ti ti-chevron-right" style={{ color: 'var(--muted)' }} aria-hidden="true"></i>
              </button>
            ))}

            <div style={{ height: 1, background: 'var(--hair)', margin: '12px 0 8px' }}></div>

            <button
              className="sheet-item"
              onClick={async () => {
                if (window.confirm('Tem certeza que deseja sair?')) {
                  setMoreOpen(false);
                  await handleSignOut();
                }
              }}>
              <div className="icon-wrap" style={{ background: 'var(--red-soft)' }}>
                <i className="ti ti-logout" style={{ color: 'var(--red)' }} aria-hidden="true"></i>
              </div>
              <div style={{ flex: 1 }}>
                <div className="label" style={{ color: 'var(--red)' }}>Sair</div>
                <div className="sub">Encerrar sessão</div>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
