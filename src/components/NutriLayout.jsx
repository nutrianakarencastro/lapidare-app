import { useState, useMemo, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useSession, signOut } from '../lib/session.jsx';
import { useTheme } from '../lib/theme.jsx';
import BrandFooter from './BrandFooter.jsx';
import { iniciais, mesAno } from '../lib/utils.js';
import '../styles/nutri.css';

const NAV_CONFIG = [
  {
    group: 'Atendimento',
    items: [
      { id: 'visao',     path: '/nutri/visao',     label: 'Visão Geral',    icon: 'layout-dashboard' },
      { id: 'pacientes', path: '/nutri/pacientes', label: 'Pacientes',      icon: 'users' },
      { id: 'agenda',    path: '/nutri/agenda',    label: 'Agenda',         icon: 'calendar' },
      { id: 'checkins',  path: '/nutri/checkins',  label: 'Check-ins',      icon: 'clipboard-check' },
      { id: 'feed',      path: '/nutri/feed',      label: 'Feed de pratos', icon: 'camera' },
    ],
  },
  {
    group: 'Recursos Clínicos',
    items: [
      { id: 'biblioteca',    path: '/nutri/biblioteca',    label: 'Biblioteca Clínica', icon: 'book-2' },
      { id: 'protocolos',    path: '/nutri/protocolos',    label: 'Protocolos',         icon: 'clipboard-heart' },
      { id: 'alem-nutricao', path: '/nutri/alem-nutricao', label: 'Além da Nutrição',   icon: 'star' },
    ],
  },
  {
    group: 'Gestão do Consultório',
    items: [
      { id: 'cerebro',         path: '/nutri/cerebro',         label: 'Cérebro do Negócio', icon: 'brain' },
      { id: 'servicos',        path: '/nutri/servicos',        label: 'Meus Serviços',       icon: 'settings' },
      { id: 'previsibilidade', path: '/nutri/previsibilidade', label: 'Previsibilidade',     icon: 'trending-up' },
      { id: 'financeiro',      path: '/nutri/financeiro',      label: 'Financeiro Real',     icon: 'credit-card' },
    ],
  },
  {
    group: 'Configurações',
    items: [
      { id: 'personalizacao', path: '/nutri/personalizacao', label: 'Personalização', icon: 'palette' },
    ],
  },
];

const ROUTE_META = NAV_CONFIG.flatMap(g =>
  g.items.map(it => ({ ...it, zone: g.group }))
).reduce((acc, it) => { acc[it.path] = it; return acc; }, {});

export default function NutriLayout() {
  const { profile, user } = useSession();
  const tema = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  // Fecha drawer ao trocar de rota (mobile)
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const meta = useMemo(() => {
    if (ROUTE_META[location.pathname]) return ROUTE_META[location.pathname];
    if (location.pathname.startsWith('/nutri/pacientes/')) return ROUTE_META['/nutri/pacientes'];
    return { zone: '', label: '' };
  }, [location.pathname]);


  const handleLogout = async () => {
    await signOut();
  };

  return (
    <div className={`nutri-panel ${mobileOpen ? 'mobile-drawer-open' : ''}`}>
      <div className="mobile-overlay" onClick={() => setMobileOpen(false)}></div>
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''} ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-head">
          <button
            className="sidebar-toggle"
            onClick={() => setCollapsed(c => !c)}
            title={collapsed ? 'Expandir menu' : 'Minimizar menu'}
            aria-label="Alternar menu"
          >‹</button>
          {tema.logo_url ? (
            <img src={tema.logo_url} alt={tema.marca_nome}
              className="sidebar-logo"
              style={{ maxHeight: 36, maxWidth: '80%', objectFit: 'contain', marginBottom: 6 }} />
          ) : null}
          <div className="sidebar-brand">{tema.marca_nome}</div>
          <div className="sidebar-title">{tema.marca_subtitulo || 'Painel da Nutri'}</div>
        </div>

        <nav className="sidebar-nav">
          {NAV_CONFIG.map(group => (
            <div key={group.group}>
              <div className="nav-group">{group.group}</div>
              {group.items.map(item => (
                <NavLink
                  key={item.id}
                  to={item.path}
                  className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}
                >
                  <span className="nav-icon"><i className={`ti ti-${item.icon}`} aria-hidden="true"></i></span>
                  <span>{item.label}</span>
                </NavLink>
              ))}

            </div>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-footer-label">Sessão</div>
          <div className="sidebar-footer-val">{profile?.nome ?? '—'}</div>
          <button className="sidebar-logout" onClick={handleLogout}>
            <i className="ti ti-logout" style={{ fontSize: 15 }} aria-hidden="true"></i>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <button
            className="mobile-toggle"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menu"
          >
            <i className="ti ti-menu-2" aria-hidden="true"></i>
          </button>
          <span className="topbar-zone">{meta.zone}</span>
          <span className="topbar-sep">·</span>
          <span className="topbar-page">{meta.label}</span>
          <div className="topbar-right">
            <span className="topbar-date">{mesAno()}</span>
            <div className="topbar-avatar">{iniciais(profile?.nome)}</div>
          </div>
        </header>

        <div className="content">
          <Outlet />
          <BrandFooter />
        </div>
      </main>
    </div>
  );
}
