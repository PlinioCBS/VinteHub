import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import useAPI from '../hooks/useAPI.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { CRM_CONFIG } from '../contexts/CRMContext.jsx';

const CRM_OPTIONS = Object.entries(CRM_CONFIG).map(([key, cfg]) => ({ key, ...cfg }));

function fmt(v) {
  if (!v || v === 0) return 'R$ 0,00';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Section({ title, icon, children, defaultOpen = true }) {
  const api = useAPI();
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="text-lg">{icon}</span>
          <h3 className="font-serif font-bold text-gray-900">{title}</h3>
        </div>
        <svg
          className="w-4 h-4 text-gray-400 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="px-6 pb-6">{children}</div>}
    </div>
  );
}

function Field({ label, value, onChange, type = 'text', disabled = false, suffix, error }) {
  const [focused, setFocused] = useState(false);
  return (
    <div>
      <label className="block font-sans text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">{label}</label>
      <div className="relative">
        <input
          type={type}
          value={value}
          onChange={e => onChange && onChange(e.target.value)}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="w-full px-3 py-2.5 rounded-xl border font-sans text-sm transition-all outline-none"
          style={{
            borderColor: error ? '#dc2626' : focused ? '#355641' : '#e5e7eb',
            boxShadow: focused && !disabled ? '0 0 0 3px #35564115' : 'none',
            backgroundColor: disabled ? 'var(--bg-page)' : 'var(--bg-card)',
            color: disabled ? '#9ca3af' : 'var(--text-primary)',
            paddingRight: suffix ? '2.5rem' : undefined
          }}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-xs text-gray-400">{suffix}</span>
        )}
      </div>
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: currentUser, isMaster, refreshUser } = useAuth();
  const { toast } = useToast();

  const [user, setUser] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwError, setPwError] = useState('');

  // Form state
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: 'employee',
    commission_percent: 0,
    crm_access: 'all',
    active: true,
  });
  const [crmCommissions, setCrmCommissions] = useState({});
  const [savingCRM, setSavingCRM] = useState({});
  const [baseSalary, setBaseSalary] = useState(0);
  const [savingSalary, setSavingSalary] = useState(false);
  const photoInputRef = useRef();

  useEffect(() => {
    if (!isMaster) { navigate('/'); return; }
    loadData();
  }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [usersData, revData] = await Promise.all([
        api.getUsers(),
        api.getClientsRevenue({})
      ]);
      const found = usersData.find(u => String(u.id) === String(id));
      if (!found) { navigate('/admin'); return; }
      setUser(found);
      setRevenue(revData);
      setBaseSalary(found.base_salary ?? 0);
      setForm({
        name: found.name || '',
        email: found.email || '',
        role: found.role || 'employee',
        commission_percent: found.commission_percent ?? 0,
        crm_access: found.crm_access === 'all'
          ? 'all'
          : (() => { try { return JSON.parse(found.crm_access); } catch { return 'all'; } })(),
        active: Boolean(found.active),
      });
      setCrmCommissions(found.crm_commissions || {});
    } catch (e) {
      toast.error('Erro ao carregar consultor');
      navigate('/admin');
    } finally {
      setLoading(false);
    }
  }

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Nome obrigatório';
    if (!form.email.trim()) e.email = 'Email obrigatório';
    if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido';
    if (form.commission_percent < 0 || form.commission_percent > 100) e.commission_percent = 'Entre 0 e 100';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSave() {
    if (!validate()) return;
    setSaving(true);
    try {
      await api.updateUser(id, {
        ...form,
        crm_access: form.crm_access === 'all' ? 'all' : JSON.stringify(form.crm_access),
        commission_percent: parseFloat(form.commission_percent) || 0,
        active: form.active ? 1 : 0,
      });
      toast.success('Perfil atualizado com sucesso');
      // Se editou o próprio usuário logado, atualiza o contexto de auth
      if (String(currentUser?.id) === String(id)) {
        await refreshUser();
      }
      loadData();
    } catch (e) {
      toast.error(e.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveCRMCommission(crm_type) {
    setSavingCRM(s => ({ ...s, [crm_type]: true }));
    try {
      await api.updateCRMCommission(id, crm_type, crmCommissions[crm_type] ?? 0);
      toast.success(`Comissão de ${CRM_CONFIG[crm_type]?.label} salva`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingCRM(s => ({ ...s, [crm_type]: false }));
    }
  }

  async function handleSaveSalary() {
    setSavingSalary(true);
    try {
      await api.updateUserSalary(id, parseFloat(baseSalary) || 0);
      toast.success('Salário base salvo');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSavingSalary(false);
    }
  }

  async function handlePhotoUpload(file) {
    try {
      const result = await api.uploadUserPhoto(id, file);
      if (result.error) throw new Error(result.error);
      toast.success('Foto atualizada');
      loadData();
    } catch (e) {
      toast.error(e.message || 'Erro ao enviar foto');
    }
  }

  async function handlePasswordReset() {
    setPwError('');
    if (!newPassword || newPassword.length < 6) { setPwError('Mínimo 6 caracteres'); return; }
    if (newPassword !== confirmPassword) { setPwError('Senhas não conferem'); return; }
    setSaving(true);
    try {
      await api.updateUser(id, { password: newPassword });
      toast.success('Senha redefinida com sucesso');
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCRMToggle(key) {
    if (form.crm_access === 'all') {
      setForm(f => ({ ...f, crm_access: [key] }));
    } else {
      const arr = Array.isArray(form.crm_access) ? form.crm_access : [];
      const next = arr.includes(key) ? arr.filter(k => k !== key) : [...arr, key];
      setForm(f => ({ ...f, crm_access: next.length === 0 ? ['investimento'] : next }));
    }
  }

  if (loading) {
    return (
      <div className="p-8 max-w-5xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-4 bg-gray-200 rounded w-1/4" />
          <div className="h-48 bg-gray-200 rounded-2xl mt-6" />
        </div>
      </div>
    );
  }

  const totalMonthly = revenue?.totalMonthly || 0;
  const commission = totalMonthly * ((parseFloat(form.commission_percent) || 0) / 100);
  const initials = form.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div className="p-8 max-w-5xl mx-auto pb-16">

      {/* Back + breadcrumb */}
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-2 font-sans text-sm text-gray-500 hover:text-gray-800 transition-colors mb-6 group"
      >
        <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Voltar para Gestão de Equipe
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="flex items-center gap-5">
            <div className="relative">
              <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files[0]; if (f) handlePhotoUpload(f); e.target.value = ''; }} />
              <button
                onClick={() => photoInputRef.current?.click()}
                className="relative block"
                title="Clique para alterar foto"
              >
                {user?.photo_url ? (
                  <img src={user.photo_url} className="w-16 h-16 rounded-2xl object-cover shadow-md" alt={form.name} />
                ) : (
                  <div
                    className="w-16 h-16 rounded-2xl flex items-center justify-center font-serif font-bold text-2xl text-white shadow-md"
                    style={{ backgroundColor: form.role === 'master' ? '#355641' : '#dd7752' }}
                  >
                    {initials || '?'}
                  </div>
                )}
                <div className="absolute inset-0 rounded-2xl bg-black/0 hover:bg-black/20 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><circle cx="12" cy="13" r="3" />
                  </svg>
                </div>
              </button>
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-serif font-bold text-2xl text-gray-900">{form.name || 'Consultor'}</h1>
                <span
                  className="px-3 py-0.5 rounded-full text-xs font-sans font-bold"
                  style={{
                    backgroundColor: form.role === 'master' ? 'rgba(53,86,65,0.08)' : 'rgba(221,119,82,0.08)',
                    color: form.role === 'master' ? '#355641' : '#dd7752'
                  }}
                >
                  {form.role === 'master' ? 'MASTER' : 'CONSULTOR'}
                </span>
                <span
                  className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-sans font-medium"
                  style={{
                    backgroundColor: form.active ? 'rgba(22,163,74,0.08)' : 'var(--bg-page)',
                    color: form.active ? '#16a34a' : '#6b7280'
                  }}
                >
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: form.active ? '#16a34a' : '#9ca3af' }} />
                  {form.active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <p className="font-sans text-sm text-gray-400 mt-0.5">{form.email}</p>
              <p className="font-sans text-xs text-gray-300 mt-0.5">
                Cadastrado em {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }) : '—'}
              </p>
            </div>
          </div>

          {/* Comissão destaque */}
          <div className="text-right p-4 rounded-xl" style={{ backgroundColor: 'rgba(53,86,65,0.08)', minWidth: 160 }}>
            <p className="font-sans text-xs text-gray-500 mb-1 uppercase tracking-wider">Ganho mensal estimado</p>
            <p className="font-serif font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>{fmt(commission)}</p>
            <p className="font-sans text-xs text-gray-400 mt-0.5">{form.commission_percent}% sobre {fmt(totalMonthly)}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Coluna principal */}
        <div className="lg:col-span-2 space-y-5">

          {/* Dados pessoais */}
          <Section title="Dados Pessoais" icon="👤">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field
                label="Nome completo"
                value={form.name}
                onChange={v => setForm(f => ({ ...f, name: v }))}
                error={errors.name}
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={v => setForm(f => ({ ...f, email: v }))}
                error={errors.email}
              />
            </div>
            <div className="mt-4">
              <label className="block font-sans text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Perfil de acesso</label>
              <div className="flex gap-2">
                {['master', 'employee'].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, role: r }))}
                    className="flex-1 py-2 rounded-xl border font-sans text-sm font-medium transition-all"
                    style={{
                      backgroundColor: form.role === r ? (r === 'master' ? '#355641' : '#dd7752') : 'var(--bg-page)',
                      borderColor: form.role === r ? (r === 'master' ? '#355641' : '#dd7752') : '#e5e7eb',
                      color: form.role === r ? 'white' : '#6b7280',
                    }}
                  >
                    {r === 'master' ? '⭐ Master' : '👤 Consultor'}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between p-4 rounded-xl" style={{ backgroundColor: 'var(--bg-page)' }}>
              <div>
                <p className="font-sans text-sm font-medium text-gray-800">Conta ativa</p>
                <p className="font-sans text-xs text-gray-400">Permite login no sistema</p>
              </div>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, active: !f.active }))}
                className="relative w-12 h-6 rounded-full transition-all duration-300"
                style={{ backgroundColor: form.active ? '#355641' : '#d1d5db' }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300"
                  style={{ transform: form.active ? 'translateX(24px)' : 'translateX(0)' }}
                />
              </button>
            </div>
          </Section>

          {/* Salário Base */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">💰</span>
                <h3 className="font-serif font-bold text-gray-900">Salário Base</h3>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-sm text-gray-400">R$</span>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={baseSalary}
                  onChange={e => setBaseSalary(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border font-serif text-lg font-bold outline-none transition-all"
                  style={{ borderColor: '#e5e7eb', color: '#355641' }}
                  onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <button
                onClick={handleSaveSalary}
                disabled={savingSalary}
                className="px-4 py-2.5 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                style={{ backgroundColor: '#355641' }}
              >
                {savingSalary ? '...' : 'Salvar'}
              </button>
            </div>
          </div>

          {/* Acesso aos CRMs */}
          <Section title="Acesso aos CRMs" icon="🗂️">
            <div className="flex gap-2 mb-4">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, crm_access: 'all' }))}
                className="px-4 py-2 rounded-xl font-sans text-sm font-medium transition-all border"
                style={{
                  backgroundColor: form.crm_access === 'all' ? '#355641' : 'var(--bg-page)',
                  borderColor: form.crm_access === 'all' ? '#355641' : '#e5e7eb',
                  color: form.crm_access === 'all' ? 'white' : '#6b7280',
                }}
              >
                🌐 Todos os CRMs
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, crm_access: Array.isArray(f.crm_access) ? f.crm_access : ['investimento'] }))}
                className="px-4 py-2 rounded-xl font-sans text-sm font-medium transition-all border"
                style={{
                  backgroundColor: form.crm_access !== 'all' ? 'rgba(221,119,82,0.08)' : 'var(--bg-page)',
                  borderColor: form.crm_access !== 'all' ? '#dd7752' : '#e5e7eb',
                  color: form.crm_access !== 'all' ? '#dd7752' : '#6b7280',
                }}
              >
                🎯 Personalizado
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {CRM_OPTIONS.map(crm => {
                const arr = Array.isArray(form.crm_access) ? form.crm_access : [];
                const selected = form.crm_access === 'all' || arr.includes(crm.key);
                const locked = form.crm_access === 'all';
                return (
                  <button
                    key={crm.key}
                    type="button"
                    onClick={() => !locked && handleCRMToggle(crm.key)}
                    className="flex items-center gap-3 p-3 rounded-xl border font-sans text-sm font-medium transition-all text-left"
                    style={{
                      backgroundColor: selected ? crm.bgLight : 'var(--bg-page)',
                      borderColor: selected ? crm.color + '50' : '#e5e7eb',
                      color: selected ? crm.color : '#9ca3af',
                      cursor: locked ? 'default' : 'pointer',
                    }}
                  >
                    <span className="text-xl">{crm.icon}</span>
                    <div className="flex-1">
                      <p className="font-medium">{crm.label}</p>
                    </div>
                    <div
                      className="w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                      style={{
                        borderColor: selected ? crm.color : '#d1d5db',
                        backgroundColor: selected ? crm.color : 'transparent',
                      }}
                    >
                      {selected && (
                        <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Section>

        </div>

        {/* Coluna lateral */}
        <div className="space-y-5">

          {/* Comissão por CRM */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="text-lg">💰</span>
              <h3 className="font-serif font-bold text-gray-900">Comissão por CRM</h3>
            </div>
            <div className="p-5 space-y-3">
              {/* Quais CRMs esse user tem acesso */}
              {(() => {
                const accessList = form.crm_access === 'all'
                  ? CRM_OPTIONS
                  : CRM_OPTIONS.filter(c => Array.isArray(form.crm_access) && form.crm_access.includes(c.key));

                if (accessList.length === 0) return (
                  <p className="font-sans text-xs text-gray-400 text-center py-4">
                    Nenhum CRM atribuído ainda
                  </p>
                );

                return accessList.map(crm => {
                  const pct = crmCommissions[crm.key] ?? 0;
                  const saving = savingCRM[crm.key];
                  return (
                    <div
                      key={crm.key}
                      className="rounded-xl p-4 border transition-all"
                      style={{ backgroundColor: crm.bgLight, borderColor: crm.color + '30' }}
                    >
                      {/* Header do CRM */}
                      <div className="flex items-center gap-2 mb-3">
                        <span className="text-base">{crm.icon}</span>
                        <span className="font-sans text-sm font-semibold" style={{ color: crm.color }}>
                          {crm.label}
                        </span>
                      </div>

                      {/* Input + botão salvar */}
                      <div className="flex items-center gap-2">
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
                            className="w-full pl-3 pr-7 py-2 rounded-lg border font-serif text-lg font-bold outline-none transition-all"
                            style={{ borderColor: crm.color + '40', color: crm.color, backgroundColor: 'var(--bg-card)' }}
                            onFocus={e => { e.target.style.borderColor = crm.color; e.target.style.boxShadow = `0 0 0 3px ${crm.color}20`; }}
                            onBlur={e => { e.target.style.borderColor = crm.color + '40'; e.target.style.boxShadow = 'none'; }}
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 font-sans text-xs text-gray-400">%</span>
                        </div>
                        <button
                          onClick={() => handleSaveCRMCommission(crm.key)}
                          disabled={saving}
                          className="px-3 py-2 rounded-lg font-sans text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex-shrink-0"
                          style={{ backgroundColor: crm.color }}
                        >
                          {saving ? '...' : 'Salvar'}
                        </button>
                      </div>

                      {/* Preview ganho */}
                      <div className="mt-2 flex justify-between items-center">
                        <span className="font-sans text-xs" style={{ color: crm.color, opacity: 0.7 }}>
                          Ganho mensal estimado
                        </span>
                        <span className="font-sans text-xs font-bold" style={{ color: crm.color }}>
                          {fmt(totalMonthly * (parseFloat(pct) || 0) / 100)}
                        </span>
                      </div>

                      {/* Barra */}
                      <div className="mt-2 h-1.5 rounded-full bg-white/60 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${Math.min(parseFloat(pct) || 0, 5) * 20}%`, backgroundColor: crm.color }}
                        />
                      </div>
                    </div>
                  );
                });
              })()}

              {/* Total consolidado */}
              <div className="pt-3 border-t border-gray-100 space-y-1.5">
                {(() => {
                  const accessList = form.crm_access === 'all'
                    ? CRM_OPTIONS
                    : CRM_OPTIONS.filter(c => Array.isArray(form.crm_access) && form.crm_access.includes(c.key));
                  const totalEarning = accessList.reduce((sum, crm) => {
                    return sum + totalMonthly * (parseFloat(crmCommissions[crm.key] || 0)) / 100;
                  }, 0);
                  return (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="font-sans text-xs text-gray-400">Total mensal</span>
                        <span className="font-sans text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{fmt(totalEarning)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-sans text-xs text-gray-400">Total anual</span>
                        <span className="font-sans text-xs font-medium text-gray-600">{fmt(totalEarning * 12)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          </div>

          {/* Segurança */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <h3 className="font-serif font-bold text-gray-900">Segurança</h3>
            </div>
            <div className="p-6">
              <p className="font-sans text-xs text-gray-400 mb-3">Redefina a senha de acesso do consultor ao sistema.</p>
              <button
                onClick={() => setShowPasswordModal(true)}
                className="w-full py-2.5 rounded-xl border font-sans text-sm font-medium transition-all hover:bg-gray-50"
                style={{ borderColor: '#e5e7eb', color: 'var(--text-muted)' }}
              >
                🔑 Redefinir Senha
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Save bar */}
      <div
        className="fixed bottom-0 left-60 right-0 z-20 px-8 py-4 border-t border-gray-200 bg-white flex items-center justify-between"
      >
        <p className="font-sans text-sm text-gray-400">
          Alterações não salvas serão perdidas
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/admin')}
            className="px-5 py-2.5 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2.5 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            style={{ backgroundColor: '#355641' }}
          >
            {saving ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Salvando...
              </>
            ) : '✓ Salvar Alterações'}
          </button>
        </div>
      </div>

      {/* Password modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-serif font-bold text-lg text-gray-900">Redefinir Senha</h2>
              <button onClick={() => { setShowPasswordModal(false); setNewPassword(''); setConfirmPassword(''); setPwError(''); }}
                className="text-gray-400 hover:text-gray-600">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block font-sans text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Nova Senha</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
                  onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label className="block font-sans text-xs font-medium text-gray-500 mb-1 uppercase tracking-wider">Confirmar Senha</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Repita a senha"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
                  onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
                  onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              {pwError && <p className="text-xs text-red-500">{pwError}</p>}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowPasswordModal(false); setNewPassword(''); setConfirmPassword(''); setPwError(''); }}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handlePasswordReset}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: '#355641' }}
              >
                {saving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
