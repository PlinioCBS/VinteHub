import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useNavigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard.jsx';
import Contacts from './pages/Contacts.jsx';
import Pipeline from './pages/Pipeline.jsx';
import Clients from './pages/Clients.jsx';
import Calendar from './pages/Calendar.jsx';
import Tasks from './pages/Tasks.jsx';
import Login from './pages/Login.jsx';
import GeneralDashboard from './pages/GeneralDashboard.jsx';
import AdminUsers from './pages/AdminUsers.jsx';
import EquipeMapa from './pages/EquipeMapa.jsx';
import EmployeeProfile from './pages/EmployeeProfile.jsx';
import Financeiro from './pages/Financeiro.jsx';
import ProductCatalog from './pages/ProductCatalog.jsx';
import EditProfile from './pages/EditProfile.jsx';
import Simuladores from './pages/Simuladores.jsx';
import DadosEconomicos from './pages/DadosEconomicos.jsx';
import Finder from './pages/Finder.jsx';
import FinderLogin from './pages/FinderLogin.jsx';
import FinderPortal from './pages/FinderPortal.jsx';

import { AuthProvider, useAuth, ProtectedRoute } from './contexts/AuthContext.jsx';
import { CRMProvider, useCRM } from './contexts/CRMContext.jsx';
import { ToastProvider } from './contexts/ToastContext.jsx';
import { ThemeProvider, useTheme } from './contexts/ThemeContext.jsx';
import CRMSelector from './components/CRMSelector.jsx';

function DarkModeToggle() {
  const { dark, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      className="w-9 h-9 flex items-center justify-center rounded-xl transition-all duration-200"
      style={{
        background: dark ? '#1e293b' : '#f5f4f2',
        border: `1px solid ${dark ? '#334155' : '#d9d9d6'}`,
      }}
      title={dark ? 'Modo claro' : 'Modo escuro'}
    >
      {dark ? (
        <svg className="w-4 h-4 text-yellow-400" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.166 17.834a.75.75 0 00-1.06 1.06l1.59 1.591a.75.75 0 001.061-1.06l-1.59-1.591zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.166 6.166a.75.75 0 001.06-1.06L5.635 3.515a.75.75 0 00-1.06 1.06l1.59 1.591z"/>
        </svg>
      ) : (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" style={{ color: '#555' }}>
          <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z"/>
        </svg>
      )}
    </button>
  );
}

// Menu exclusivo do funcionário (operacional)
const EMPLOYEE_NAV = [
  { to: '/', label: 'Dashboard', end: true, icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  )},
  { to: '/dados-economicos', label: 'Painel de Mercado', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    </svg>
  )},
  { to: '/contatos', label: 'Prospecção', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )},
  { to: '/pipeline', label: 'Pipeline', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  )},
  { to: '/clientes', label: 'Clientes', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )},
  { to: '/calendario', label: 'Calendário', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )},
  { to: '/tarefas', label: 'Tarefas', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  )},
  { to: '/simuladores', label: 'Simuladores', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )},
  { to: '/finder', label: 'Finder', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  )}
];

// Menu exclusivo do master (gestão)
const MASTER_NAV = [
  { to: '/dashboard-geral', label: 'Dashboard Geral', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
  { to: '/admin', label: 'Admin', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )},
  { to: '/admin/mapa-equipe', label: 'Mapa da Equipe', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
  )},
  { to: '/financeiro', label: 'Financeiro', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )},
  { to: '/admin/catalogo-produtos', label: 'Catálogo Produtos', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
    </svg>
  )},
  { to: '/simuladores', label: 'Simuladores', icon: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )},
];

function NavItem({ to, label, icon, end, crmColor }) {
  const activeColor = crmColor || '#dd7752';
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-sans transition-all duration-200 ${
          isActive ? 'text-white font-bold shadow-sm' : 'text-white/65 hover:text-white hover:bg-white/10'
        }`
      }
      style={({ isActive }) => isActive ? { backgroundColor: activeColor, boxShadow: `0 2px 8px ${activeColor}50` } : {}}
    >
      {icon}
      {label}
    </NavLink>
  );
}

function Sidebar({ collapsed, onToggle }) {
  const { user, logout, isMaster } = useAuth();
  const { currentCRM, activeCRM } = useCRM();
  const navigate = useNavigate();

  const handleProfileClick = () => navigate('/perfil');

  const navItems = isMaster ? MASTER_NAV : EMPLOYEE_NAV;

  const handleLogout = () => { logout(); navigate('/login'); };

  const initials = user?.name
    ? user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
    : '?';

  // Cor de destaque do CRM ativo (para funcionários)
  const crmAccent = isMaster ? '#dd7752' : currentCRM.color;
  // Sidebar recebe um fundo sutilmente tingido com a cor do CRM
  const sidebarBg = isMaster
    ? '#2d4a38'
    : currentCRM.key === 'investimento' ? '#2d4a38'
    : currentCRM.key === 'cambio'       ? '#1e3a5f'
    : currentCRM.key === 'credito'      ? '#3b1f6b'
    : currentCRM.key === 'seguro'       ? '#0c3d4a'
    : '#2d4a38';

  return (
    <aside
      className="h-screen flex flex-col flex-shrink-0 overflow-y-auto transition-all duration-300"
      style={{ backgroundColor: sidebarBg, width: collapsed ? '64px' : '240px' }}
    >

      {/* Faixa colorida de 4px no topo */}
      <div className="h-1 w-full transition-all duration-500" style={{ backgroundColor: crmAccent }} />

      {/* Logo + toggle button */}
      <div className="px-3 py-4 border-b border-white/10 flex items-center justify-between gap-2">
        {!collapsed && (
          <img
            src="/Logo_Vinte_white.png"
            alt="Vinte Hub"
            className="h-14 w-auto object-contain flex-1 min-w-0"
          />
        )}
        <button
          onClick={onToggle}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200"
          title={collapsed ? 'Expandir menu' : 'Recolher menu'}
        >
          {collapsed ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7M19 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {/* Badge do CRM ativo (funcionário) ou Master */}
      {!collapsed && (
        <div className="mx-3 mt-3 px-3 py-2 rounded-xl flex items-center gap-2.5 transition-all duration-500"
          style={{ backgroundColor: crmAccent + '25', border: `1px solid ${crmAccent}40` }}>
          <div>
            <p className="font-sans text-xs font-bold uppercase tracking-wider leading-none" style={{ color: crmAccent }}>
              {isMaster ? 'Acesso Master' : currentCRM.label}
            </p>
            {!isMaster && (
              <p className="font-sans text-xs mt-0.5 leading-none" style={{ color: 'rgba(255,255,255,0.4)' }}>CRM Ativo</p>
            )}
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-2 py-4 space-y-0.5">
        {navItems.map(item => (
          collapsed ? (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={item.label}
              className={({ isActive }) =>
                `flex items-center justify-center w-10 h-10 mx-auto rounded-xl transition-all duration-200 ${
                  isActive ? 'text-white shadow-sm' : 'text-white/65 hover:text-white hover:bg-white/10'
                }`
              }
              style={({ isActive }) => isActive ? { backgroundColor: crmAccent, boxShadow: `0 2px 8px ${crmAccent}50` } : {}}
            >
              {item.icon}
            </NavLink>
          ) : (
            <NavItem key={item.to} {...item} crmColor={crmAccent} />
          )
        ))}
      </nav>

      {/* Provedores — apenas consultores */}
      {!isMaster && !collapsed && (
        <div className="px-3 pb-2">
          <p className="font-sans text-xs uppercase tracking-wider text-white/30 px-3 mb-1.5">Provedores</p>
          <a
            href="https://corretor.portoseguro.com.br/corretoronline/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl font-sans text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Porto Seguro Bank
          </a>
          <a
            href="https://newcon.bancorbras.com.br/intranet/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl font-sans text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            BancorBras
          </a>
        </div>
      )}
      {!isMaster && collapsed && (
        <div className="px-2 pb-2 space-y-0.5">
          <a
            href="https://corretor.portoseguro.com.br/corretoronline/"
            target="_blank"
            rel="noopener noreferrer"
            title="Porto Seguro Bank"
            className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
          <a
            href="https://newcon.bancorbras.com.br/intranet/"
            target="_blank"
            rel="noopener noreferrer"
            title="BancorBras"
            className="flex items-center justify-center w-10 h-10 mx-auto rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all duration-200"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}

      {/* User footer */}
      <div className="px-3 py-4 border-t border-white/10">
        {!collapsed ? (
          <>
            <button
              onClick={handleProfileClick}
              className="flex items-center gap-3 mb-3 w-full rounded-xl px-2 py-1.5 hover:bg-white/10 transition-all duration-200 text-left"
              title="Editar perfil"
            >
              {user?.photoUrl ? (
                <img src={user.photoUrl} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt={user.name} />
              ) : (
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center font-serif font-bold text-sm flex-shrink-0"
                  style={{ backgroundColor: '#dd7752', color: 'white' }}
                >
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-sans text-white text-sm font-medium truncate">{user?.name || 'Usuário'}</p>
                <p className="font-sans text-white/50 text-xs">
                  {user?.role === 'master' ? 'Master' : 'Consultor'}
                </p>
              </div>
              <svg className="w-3.5 h-3.5 text-white/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg font-sans text-xs text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sair
            </button>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={handleProfileClick}
              title={user?.name || 'Perfil'}
              className="w-10 h-10 rounded-full flex items-center justify-center hover:ring-2 hover:ring-white/30 transition-all"
              style={{ backgroundColor: '#dd7752' }}
            >
              {user?.photoUrl ? (
                <img src={user.photoUrl} className="w-10 h-10 rounded-full object-cover" alt={user.name} />
              ) : (
                <span className="font-serif font-bold text-sm text-white">{initials}</span>
              )}
            </button>
            <button
              onClick={handleLogout}
              title="Sair"
              className="w-10 h-10 flex items-center justify-center rounded-xl text-white/50 hover:text-white hover:bg-white/10 transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}

function Header() {
  const { isMaster } = useAuth();

  return (
    <header
      className="flex items-center justify-between px-6 py-3 sticky top-0 z-30 transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border-header)' }}
    >
      <div />
      <div className="flex items-center gap-3">
        {!isMaster && (
          <>
            <span className="font-sans text-xs hidden sm:block" style={{ color: 'var(--text-muted)' }}>CRM Ativo:</span>
            <CRMSelector />
          </>
        )}
        <DarkModeToggle />
      </div>
    </header>
  );
}

function MasterRedirect() {
  const { isMaster } = useAuth();
  if (isMaster) {
    // Redireciona master que acessa "/" para dashboard-geral
    return <GeneralDashboard />;
  }
  return <Dashboard />;
}

function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(() => {
    return localStorage.getItem('sidebar_collapsed') === 'true';
  });

  const handleToggleSidebar = () => {
    setSidebarCollapsed(prev => {
      localStorage.setItem('sidebar_collapsed', String(!prev));
      return !prev;
    });
  };

  return (
    <ProtectedRoute>
      <div className="flex h-screen overflow-hidden transition-colors duration-200" style={{ backgroundColor: 'var(--bg-page)' }}>
        {/* Sidebar fixo, não acompanha o scroll da página */}
        <div className="h-screen flex-shrink-0 sticky top-0">
          <Sidebar collapsed={sidebarCollapsed} onToggle={handleToggleSidebar} />
        </div>
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header />
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<MasterRedirect />} />
              <Route path="/contatos" element={<Contacts />} />
              <Route path="/pipeline" element={<Pipeline />} />
              <Route path="/clientes" element={<Clients />} />
              <Route path="/calendario" element={<Calendar />} />
              <Route path="/tarefas" element={<Tasks />} />
              <Route path="/dashboard-geral" element={<GeneralDashboard />} />
              <Route path="/admin" element={<AdminUsers />} />
              <Route path="/admin/mapa-equipe" element={<EquipeMapa />} />
              <Route path="/admin/consultor/:id" element={<EmployeeProfile />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/admin/catalogo-produtos" element={<ProductCatalog />} />
              <Route path="/simuladores" element={<Simuladores />} />
              <Route path="/dados-economicos" element={<DadosEconomicos />} />
              <Route path="/perfil" element={<EditProfile />} />
              <Route path="/finder" element={<Finder />} />
            </Routes>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <CRMProvider>
            <ToastProvider>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/finder-login" element={<FinderLogin />} />
                <Route path="/finder-portal" element={<FinderPortal />} />
                <Route path="/*" element={<AppLayout />} />
              </Routes>
            </ToastProvider>
          </CRMProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}
