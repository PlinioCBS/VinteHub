import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useAPI from '../hooks/useAPI.js';
import { useUsers, useClientsRevenue } from '../hooks/useConvexData.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { CRM_CONFIG } from '../contexts/CRMContext.jsx';
import { BRAZIL_STATES } from '../utils/brazilStates.js';

const CRM_OPTIONS = Object.entries(CRM_CONFIG).map(([key, cfg]) => ({ key, ...cfg }));

function fmt(v) {
  if (!v) return 'R$ 0';
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}K`;
  return `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function UserModal({ user, onClose, onSave }) {
  // Parse crmAccess (camelCase from Convex)
  const parsedAccess = user
    ? (user.crmAccess === 'all' ? 'all' : (() => { try { return JSON.parse(user.crmAccess); } catch { return 'all'; } })())
    : 'all';

  const [form, setForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'employee',
    crmAccess: parsedAccess,
    active: user?.active !== undefined ? Boolean(user.active) : true,
    state: user?.state || '',
  });

  // comissões por CRM vindas do objeto enriquecido: { investimento: 0.18, ... }
  const [crmCommissions, setCrmCommissions] = useState(user?.crm_commissions || {});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const isEdit = !!user;

  // CRMs ativos (acesso)
  const activeCRMs = form.crmAccess === 'all'
    ? CRM_OPTIONS.map(c => c.key)
    : (Array.isArray(form.crmAccess) ? form.crmAccess : []);

  const handleCRMToggle = (key) => {
    if (form.crmAccess === 'all') {
      setForm(f => ({ ...f, crmAccess: [key] }));
    } else {
      const arr = Array.isArray(form.crmAccess) ? form.crmAccess : [];
      if (arr.includes(key)) {
        const next = arr.filter(k => k !== key);
        setForm(f => ({ ...f, crmAccess: next.length === 0 ? ['investimento'] : next }));
      } else {
        setForm(f => ({ ...f, crmAccess: [...arr, key] }));
      }
    }
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Nome obrigatório';
    if (!form.email.trim()) e.email = 'Email obrigatório';
    if (!isEdit && !form.password) e.password = 'Senha obrigatória';
    if (form.password && form.password.length < 6) e.password = 'Mínimo 6 caracteres';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      // Comissões filtradas pelos CRMs com acesso
      const filteredCommissions = {};
      activeCRMs.forEach(k => { filteredCommissions[k] = parseFloat(crmCommissions[k] || 0); });

      // Payload limpo com camelCase — apenas os campos que o Convex aceita
      const payload = {
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        crmAccess: form.crmAccess === 'all' ? 'all' : JSON.stringify(form.crmAccess),
        active: form.active ? 1 : 0,
        state: form.state || undefined,
      };
      if (form.password) payload.password = form.password;

      // commissions são salvas separadamente pelo handleSave do pai
      await onSave(payload, filteredCommissions);
    } finally {
      setLoading(false);
    }
  };

  // CRMs visíveis para seleção de comissão
  const crmsForCommission = form.crmAccess === 'all' ? CRM_OPTIONS : CRM_OPTIONS.filter(c => activeCRMs.includes(c.key));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10 rounded-t-2xl">
          <h2 className="font-serif font-bold text-xl text-gray-900">
            {isEdit ? 'Editar Consultor' : 'Novo Consultor'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-5">

          {/* Nome */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Nome *</label>
            <input
              type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Nome completo"
              className="w-full px-4 py-2.5 rounded-xl border font-sans text-sm outline-none transition-all"
              style={{ borderColor: errors.name ? '#dc2626' : '#e5e7eb' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = errors.name ? '#dc2626' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Email *</label>
            <input
              type="email" value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="email@empresa.com"
              className="w-full px-4 py-2.5 rounded-xl border font-sans text-sm outline-none transition-all"
              style={{ borderColor: errors.email ? '#dc2626' : '#e5e7eb' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = errors.email ? '#dc2626' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          {/* Senha */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              {isEdit ? 'Nova Senha (deixar em branco para manter)' : 'Senha *'}
            </label>
            <input
              type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder={isEdit ? '••••••' : 'Mínimo 6 caracteres'}
              className="w-full px-4 py-2.5 rounded-xl border font-sans text-sm outline-none transition-all"
              style={{ borderColor: errors.password ? '#dc2626' : '#e5e7eb' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = errors.password ? '#dc2626' : '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
            />
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          {/* Estado (localização no mapa da equipe) */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Estado (localização)</label>
            <select
              value={form.state}
              onChange={e => setForm(f => ({ ...f, state: e.target.value }))}
              className="w-full px-4 py-2.5 rounded-xl border font-sans text-sm outline-none transition-all bg-white"
              style={{ borderColor: '#e5e7eb' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
            >
              <option value="">Não definido</option>
              {BRAZIL_STATES.map(s => (
                <option key={s.uf} value={s.uf}>{s.name} ({s.uf})</option>
              ))}
            </select>
            <p className="font-sans text-xs text-gray-400 mt-1">Define onde o consultor aparece no mapa da equipe</p>
          </div>

          {/* Perfil */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">Perfil de acesso</label>
            <div className="grid grid-cols-2 gap-2">
              {[{ value: 'employee', label: '👤 Consultor', color: '#dd7752' }, { value: 'master', label: '⭐ Master', color: '#355641' }].map(r => (
                <button key={r.value} type="button"
                  onClick={() => setForm(f => ({ ...f, role: r.value }))}
                  className="py-2.5 rounded-xl border font-sans text-sm font-medium transition-all"
                  style={{
                    backgroundColor: form.role === r.value ? r.color : 'var(--bg-page)',
                    borderColor: form.role === r.value ? r.color : '#e5e7eb',
                    color: form.role === r.value ? 'white' : '#6b7280'
                  }}
                >{r.label}</button>
              ))}
            </div>
          </div>

          {/* Acesso + Comissão por CRM */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider">Acesso e Comissão por CRM</label>
              <div className="flex gap-1.5">
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, crmAccess: 'all' }))}
                  className="px-2.5 py-1 rounded-lg text-xs font-sans font-semibold transition-all"
                  style={{ backgroundColor: form.crmAccess === 'all' ? '#355641' : 'var(--bg-page)', color: form.crmAccess === 'all' ? 'white' : '#6b7280' }}
                >Todos</button>
                <button type="button"
                  onClick={() => { if (form.crmAccess === 'all') setForm(f => ({ ...f, crmAccess: ['investimento'] })); }}
                  className="px-2.5 py-1 rounded-lg text-xs font-sans font-semibold transition-all"
                  style={{ backgroundColor: form.crmAccess !== 'all' ? '#dd7752' : 'var(--bg-page)', color: form.crmAccess !== 'all' ? 'white' : '#6b7280' }}
                >Personalizado</button>
              </div>
            </div>

            <div className="space-y-2">
              {CRM_OPTIONS.map(crm => {
                const arr = Array.isArray(form.crmAccess) ? form.crmAccess : [];
                const selected = form.crmAccess === 'all' || arr.includes(crm.key);
                const locked = form.crmAccess === 'all';
                const pct = crmCommissions[crm.key] ?? '';

                return (
                  <div
                    key={crm.key}
                    className="rounded-xl border overflow-hidden transition-all duration-200"
                    style={{
                      borderColor: selected ? crm.color + '40' : '#e5e7eb',
                      backgroundColor: selected ? crm.bgLight : 'var(--bg-page)',
                      opacity: selected ? 1 : 0.5
                    }}
                  >
                    {/* Linha de seleção do CRM */}
                    <button
                      type="button"
                      disabled={locked}
                      onClick={() => !locked && handleCRMToggle(crm.key)}
                      className="w-full flex items-center gap-3 px-4 py-3 transition-all"
                      style={{ cursor: locked ? 'default' : 'pointer' }}
                    >
                      <div
                        className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                        style={{ borderColor: selected ? crm.color : '#d1d5db', backgroundColor: selected ? crm.color : 'transparent' }}
                      >
                        {selected && (
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span className="text-lg">{crm.icon}</span>
                      <span className="font-sans text-sm font-semibold flex-1 text-left" style={{ color: selected ? crm.color : '#9ca3af' }}>
                        {crm.label}
                      </span>
                      {selected && (
                        <span className="font-sans text-xs text-gray-400">Definir comissão →</span>
                      )}
                    </button>

                    {/* Campo de comissão — só aparece se selecionado */}
                    {selected && (
                      <div className="px-4 pb-3 flex items-center gap-3 border-t" style={{ borderColor: crm.color + '20' }}>
                        <span className="font-sans text-xs text-gray-500 whitespace-nowrap">Comissão:</span>
                        <div className="relative flex-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={pct}
                            onChange={e => setCrmCommissions(c => ({ ...c, [crm.key]: e.target.value }))}
                            placeholder="ex: 0.25"
                            title="Digite em % — ex: 0.25 para 0,25% ou 1.5 para 1,5%"
                            className="w-full pl-3 pr-7 py-2 rounded-lg border font-serif text-base font-bold outline-none transition-all"
                            style={{ borderColor: crm.color + '30', color: crm.color, backgroundColor: 'var(--bg-card)' }}
                            onFocus={e => { e.target.style.borderColor = crm.color; e.target.style.boxShadow = `0 0 0 3px ${crm.color}15`; }}
                            onBlur={e => { e.target.style.borderColor = crm.color + '30'; e.target.style.boxShadow = 'none'; }}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-sans text-xs font-bold" style={{ color: crm.color }}>%</span>
                        </div>
                        {/* Preview */}
                        {parseFloat(pct) > 0 && (
                          <span className="font-sans text-xs font-medium whitespace-nowrap" style={{ color: crm.color }}>
                            ≈ {(parseFloat(pct)).toFixed(2)}% 
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Resumo de comissões */}
            {crmsForCommission.some(c => parseFloat(crmCommissions[c.key] || 0) > 0) && (
              <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <p className="font-sans text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Resumo das comissões</p>
                <div className="space-y-1">
                  {crmsForCommission.filter(c => parseFloat(crmCommissions[c.key] || 0) > 0).map(crm => (
                    <div key={crm.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{crm.icon}</span>
                        <span className="font-sans text-xs text-gray-600">{crm.label}</span>
                      </div>
                      <span className="font-sans text-xs font-bold" style={{ color: crm.color }}>
                        {parseFloat(crmCommissions[crm.key] || 0).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Conta ativa */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-gray-50 border border-gray-100">
            <div>
              <p className="font-sans text-sm font-semibold text-gray-800">Conta ativa</p>
              <p className="font-sans text-xs text-gray-400">Usuário pode fazer login no sistema</p>
            </div>
            <button
              type="button"
              onClick={() => setForm(f => ({ ...f, active: !f.active }))}
              className="relative w-12 h-6 rounded-full transition-all duration-300 flex-shrink-0"
              style={{ backgroundColor: form.active ? '#355641' : '#d1d5db' }}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300"
                style={{ transform: form.active ? 'translateX(24px)' : 'translateX(0)' }}
              />
            </button>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 py-3 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
            >Cancelar</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-3 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: '#355641' }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Salvando...
                </span>
              ) : (isEdit ? 'Salvar Alterações' : 'Criar Consultor')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const api = useAPI();
  const { isMaster, user: currentUser, refreshUser } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const users = useUsers();
  const revenue = useClientsRevenue();
  const loading = users === undefined;
  const [modalUser, setModalUser] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (!isMaster) { window.location.href = '/'; }
  }, [isMaster]);

  const handleSave = async (data, commissions = {}) => {
    try {
      let userId;
      if (modalUser) {
        await api.updateUser(modalUser._id, data);
        userId = modalUser._id;
        toast.success('Consultor atualizado com sucesso');
        if (String(currentUser?._id) === String(modalUser._id)) await refreshUser();
      } else {
        userId = await api.createUser(data);
        toast.success('Consultor criado com sucesso');
      }
      // Salvar comissões por CRM separadamente
      if (userId && commissions) {
        for (const [crmType, commissionPercent] of Object.entries(commissions)) {
          await api.updateCRMCommission(userId, crmType, commissionPercent);
        }
      }
      setShowModal(false);
      setModalUser(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteUser(id);
      toast.success('Consultor excluído');
      setConfirmDelete(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleToggle = async (id) => {
    try {
      await api.toggleUser(id);
      toast.success('Status atualizado');
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handlePhotoUpload = async (userId, file) => {
    try {
      const result = await api.uploadUserPhoto(userId, file);
      if (result.error) throw new Error(result.error);
      toast.success('Foto atualizada');
    } catch (e) {
      toast.error(e.message || 'Erro ao enviar foto');
    }
  };

  const getCRMAccessLabel = (crmAccess) => {
    if (!crmAccess || crmAccess === 'all') return ['Todos'];
    try {
      const arr = JSON.parse(crmAccess);
      return arr.map(k => CRM_CONFIG[k]?.label || k);
    } catch {
      return ['Todos'];
    }
  };

  const totalMonthlyRevenue = revenue?.totalMonthly || 0;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-3xl font-bold text-gray-900 mb-1">Gestão de Equipe</h1>
          <p className="font-sans text-sm text-gray-500">Gerencie consultores, acessos e comissões</p>
        </div>
        <button
          onClick={() => { setModalUser(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: '#355641' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Consultor
        </button>
      </div>

      {/* Commission Overview */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-8">
        <h2 className="font-serif font-bold text-lg text-gray-900 mb-4">Visão de Comissões</h2>
        <div className="mb-4 flex items-center gap-3 p-3 rounded-xl" style={{ backgroundColor: 'rgba(53,86,65,0.08)' }}>
          <span className="font-sans text-sm text-gray-600">Receita Mensal Total (base):</span>
          <span className="font-serif font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{fmt(totalMonthlyRevenue)}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left font-sans text-xs font-medium text-gray-500 uppercase tracking-wider py-2 pr-4">Consultor</th>
                <th className="text-center font-sans text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-3">Clientes</th>
                <th className="text-center font-sans text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-3">Prospecção</th>
                {Object.entries(CRM_CONFIG).map(([key, cfg]) => (
                  <th key={key} className="text-center font-sans text-xs font-medium uppercase tracking-wider py-2 px-3 text-gray-500">
                    {cfg.icon} {cfg.label}
                  </th>
                ))}
                <th className="text-right font-sans text-xs font-medium text-gray-500 uppercase tracking-wider py-2 px-3">Ganho Mensal</th>
                <th className="text-right font-sans text-xs font-medium text-gray-500 uppercase tracking-wider py-2 pl-4">Ganho Anual</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="py-4 text-center font-sans text-sm text-gray-400">Carregando...</td></tr>
              ) : users.length === 0 ? (
                <tr><td colSpan={7} className="py-4 text-center font-sans text-sm text-gray-400">Nenhum consultor</td></tr>
              ) : users.filter(u => u.role !== 'master').map(u => {
                const commissions = u.crm_commissions || {};
                const crmAccess = u.crmAccess === 'all'
                  ? Object.keys(CRM_CONFIG)
                  : (() => { try { return JSON.parse(u.crmAccess); } catch { return []; } })();
                const totalMonthly = Object.entries(CRM_CONFIG).reduce((sum, [key]) => {
                  if (!crmAccess.includes(key)) return sum;
                  return sum + totalMonthlyRevenue * ((commissions[key] || 0) / 100);
                }, 0);
                return (
                  <tr key={u._id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        {u.photoUrl ? (
                          <img src={u.photoUrl} className="w-8 h-8 rounded-full object-cover flex-shrink-0" alt={u.name} />
                        ) : (
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-serif font-bold text-sm text-white flex-shrink-0"
                            style={{ backgroundColor: u.role === 'master' ? '#355641' : '#dd7752' }}>
                            {u.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div>
                          <p className="font-sans text-sm font-medium text-gray-800">{u.name}</p>
                          <p className="font-sans text-xs text-gray-400">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="inline-flex items-center gap-1 font-serif font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                        {u.active_clients ?? 0}
                        <span className="font-sans text-xs text-gray-400 font-normal">cli.</span>
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className="font-serif font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                        {u.total_prospects ?? 0}
                      </span>
                    </td>
                    {Object.entries(CRM_CONFIG).map(([key, cfg]) => {
                      const hasAccess = crmAccess.includes(key);
                      const pct = commissions[key];
                      return (
                        <td key={key} className="py-3 px-3 text-center">
                          {hasAccess ? (
                            <span className="inline-block px-2 py-0.5 rounded-lg font-sans text-xs font-bold"
                              style={{ backgroundColor: cfg.bgLight, color: cfg.color }}>
                              {pct ?? 0}%
                            </span>
                          ) : (
                            <span className="text-gray-200 text-xs">—</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="py-3 px-3 text-right">
                      <span className="font-sans text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{fmt(totalMonthly)}</span>
                    </td>
                    <td className="py-3 pl-4 text-right">
                      <span className="font-sans text-sm font-medium text-gray-700">{fmt(totalMonthly * 12)}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Employee Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-gray-200" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-gray-200 rounded mb-2" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
          <span className="text-5xl mb-4 block">👥</span>
          <p className="font-serif font-bold text-gray-700 text-lg mb-1">Nenhum consultor cadastrado</p>
          <p className="font-sans text-sm text-gray-400 mb-4">Adicione o primeiro membro da equipe</p>
          <button
            onClick={() => { setModalUser(null); setShowModal(true); }}
            className="px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white"
            style={{ backgroundColor: '#355641' }}
          >
            Adicionar Consultor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.filter(u => u.role !== 'master').map(u => {
            const crmLabels = getCRMAccessLabel(u.crmAccess);
            return (
              <div key={u._id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden hover:shadow-md transition-all duration-200">
                <div className="p-5">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="relative flex-shrink-0">
                      {u.photoUrl ? (
                        <img src={u.photoUrl} className="w-12 h-12 rounded-xl object-cover" alt={u.name} />
                      ) : (
                        <div
                          className="w-12 h-12 rounded-xl flex items-center justify-center font-serif font-bold text-xl text-white"
                          style={{ backgroundColor: u.role === 'master' ? '#355641' : '#dd7752' }}
                        >
                          {u.name[0]?.toUpperCase()}
                        </div>
                      )}
                      <label
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-white rounded-full border border-gray-200 flex items-center justify-center cursor-pointer shadow-sm hover:bg-gray-50 transition-colors"
                        title="Alterar foto"
                      >
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) handlePhotoUpload(u._id, f); e.target.value = ''; }} />
                        <svg className="w-2.5 h-2.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" />
                        </svg>
                      </label>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-sans font-semibold text-gray-900 truncate">{u.name}</p>
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-sans font-bold"
                          style={{
                            backgroundColor: u.role === 'master' ? 'rgba(53,86,65,0.08)' : 'rgba(221,119,82,0.08)',
                            color: u.role === 'master' ? '#355641' : '#dd7752'
                          }}
                        >
                          {u.role === 'master' ? 'MASTER' : 'CONSULTOR'}
                        </span>
                      </div>
                      <p className="font-sans text-xs text-gray-400 truncate">{u.email}</p>
                    </div>
                  </div>

                  {/* Stats de carteira */}
                  <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-page)' }}>
                    <div className="text-center">
                      <p className="font-serif font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
                        {u.active_clients ?? 0}
                      </p>
                      <p className="font-sans text-xs text-gray-400 leading-tight mt-0.5">Clientes<br/>Ativos</p>
                    </div>
                    <div className="text-center border-x border-gray-200">
                      <p className="font-serif font-bold text-xl" style={{ color: 'var(--text-primary)' }}>
                        {u.total_prospects ?? 0}
                      </p>
                      <p className="font-sans text-xs text-gray-400 leading-tight mt-0.5">Em<br/>Prospecção</p>
                    </div>
                    <div className="text-center">
                      <p className="font-serif font-bold text-xl text-gray-700">
                        {u.open_deals ?? 0}
                      </p>
                      <p className="font-sans text-xs text-gray-400 leading-tight mt-0.5">Negócios<br/>Abertos</p>
                    </div>
                  </div>

                  {/* Clientes por CRM */}
                  {(() => {
                    const crmAccess = u.crmAccess === 'all'
                      ? Object.keys(CRM_CONFIG)
                      : (() => { try { return JSON.parse(u.crmAccess); } catch { return []; } })();
                    const clientsByCRM = u.clients_by_crm || {};
                    const commissions = u.crm_commissions || {};
                    return (
                      <div className="mb-3 space-y-1.5">
                        {crmAccess.map(key => {
                          const cfg = CRM_CONFIG[key];
                          if (!cfg) return null;
                          const pct = commissions[key] ?? 0;
                          const clientCount = clientsByCRM[key] ?? 0;
                          return (
                            <div key={key} className="flex items-center justify-between px-3 py-2 rounded-lg"
                              style={{ backgroundColor: cfg.bgLight }}>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm">{cfg.icon}</span>
                                <span className="font-sans text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{cfg.label}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                {clientCount > 0 && (
                                  <span className="flex items-center gap-1 font-sans text-xs text-gray-500">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    {clientCount}
                                  </span>
                                )}
                                <span className="font-serif text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{pct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  {/* CRM Access */}
                  <div className="mb-3">
                    <p className="font-sans text-xs text-gray-400 mb-1.5">Acesso</p>
                    <div className="flex flex-wrap gap-1">
                      {crmLabels.map((label, i) => {
                        const cfg = Object.values(CRM_CONFIG).find(c => c.label === label);
                        return (
                          <span
                            key={i}
                            className="px-2 py-0.5 rounded-lg text-xs font-sans font-medium"
                            style={{
                              backgroundColor: cfg ? cfg.bgLight : 'var(--bg-page)',
                              color: cfg ? cfg.color : '#6b7280'
                            }}
                          >
                            {label === 'Todos' ? '🌐 Todos' : label}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center justify-between">
                    <span
                      className="flex items-center gap-1.5 text-xs font-sans font-medium"
                      style={{ color: u.active ? '#355641' : '#6b7280' }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: u.active ? '#355641' : '#9ca3af' }} />
                      {u.active ? 'Ativo' : 'Inativo'}
                    </span>
                    <p className="font-sans text-xs text-gray-400">
                      Desde {new Date(u._creationTime).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-2">
                  <button
                    onClick={() => navigate(`/admin/consultor/${u._id}`)}
                    className="flex-1 py-1.5 rounded-lg font-sans text-xs font-semibold text-white hover:opacity-90 transition-all"
                    style={{ backgroundColor: '#355641' }}
                  >
                    Ver Perfil
                  </button>
                  <button
                    onClick={() => { setModalUser(u); setShowModal(true); }}
                    className="py-1.5 px-3 rounded-lg font-sans text-xs font-medium text-gray-600 hover:bg-gray-100 transition-all border border-gray-200"
                  >
                    Edição Rápida
                  </button>
                  <button
                    onClick={() => handleToggle(u._id)}
                    className="py-1.5 px-3 rounded-lg font-sans text-xs font-medium transition-all border"
                    style={{
                      borderColor: u.active ? '#fca5a5' : '#86efac',
                      color: u.active ? '#dc2626' : '#16a34a',
                      backgroundColor: u.active ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)'
                    }}
                  >
                    {u.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    onClick={() => setConfirmDelete(u)}
                    className="py-1.5 px-3 rounded-lg font-sans text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {showModal && (
        <UserModal
          user={modalUser}
          onClose={() => { setShowModal(false); setModalUser(null); }}
          onSave={handleSave}
        />
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir Consultor"
        message={`Tem certeza que deseja excluir "${confirmDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={() => handleDelete(confirmDelete._id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
