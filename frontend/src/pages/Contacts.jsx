import React, { useState, useEffect } from 'react';
import useAPI from '../hooks/useAPI.js';
import { useContacts } from '../hooks/useConvexData.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import BriefingPanel from '../components/BriefingPanel.jsx';
import CalendarWidget from '../components/CalendarWidget.jsx';
import ImportModal from '../components/ImportModal.jsx';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useCRM } from '../contexts/CRMContext.jsx';

const STATUSES = ['prospecting', 'qualificacao', 'proposta', 'negociacao', 'cliente', 'inativo'];
const STATUS_LABELS = {
  prospecting: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta',
  negociacao: 'Negociação', cliente: 'Cliente', inativo: 'Inativo'
};
const STATUS_COLORS = {
  prospecting: '#9ca3af', qualificacao: '#3b82f6', proposta: '#eab308',
  negociacao: '#f97316', cliente: '#22c55e', inativo: '#ef4444'
};
const STATUS_BG = {
  prospecting: 'rgba(156,163,175,0.12)', qualificacao: 'rgba(59,130,246,0.08)', proposta: 'rgba(234,179,8,0.08)',
  negociacao: 'rgba(249,115,22,0.08)', cliente: 'rgba(22,163,74,0.08)', inativo: 'rgba(220,38,38,0.08)'
};

const INVESTOR_PROFILES = [
  { value: 'conservador', label: 'Conservador' },
  { value: 'moderado', label: 'Moderado' },
  { value: 'arrojado', label: 'Arrojado' },
  { value: 'agressivo', label: 'Agressivo' },
];

const emptyForm = {
  name: '', email: '', phone: '', company: '', status: 'prospecting',
  aum: '', investorProfile: '', monthlyIncome: '', profession: '', notes: ''
};

function Badge({ status }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold font-sans"
      style={{ backgroundColor: STATUS_BG[status], color: STATUS_COLORS[status] }}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

function FunnelDots({ status }) {
  const stages = ['prospecting', 'qualificacao', 'proposta', 'negociacao', 'cliente'];
  return (
    <div className="flex items-center gap-1">
      {stages.map(s => (
        <span
          key={s}
          className="w-2 h-2 rounded-full transition-colors"
          style={{ backgroundColor: STATUSES.indexOf(status) >= STATUSES.indexOf(s) ? STATUS_COLORS[s] : '#d9d9d6' }}
          title={STATUS_LABELS[s]}
        />
      ))}
    </div>
  );
}

function PhoneInput({ value, onChange }) {
  function mask(v) {
    const digits = v.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits.length ? `(${digits}` : '';
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return (
    <input
      type="tel"
      value={value}
      onChange={e => onChange(mask(e.target.value))}
      placeholder="(XX) XXXXX-XXXX"
      className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
      style={{ color: 'var(--text-primary)' }}
      onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
      onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function FormField({ label, required, error, children }) {
  return (
    <div>
      <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}

function TextInput({ value, onChange, error, type = 'text', placeholder = '' }) {
  return (
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full px-3 py-2 rounded-xl border font-sans text-sm outline-none transition-all"
      style={{
        borderColor: error ? '#ef4444' : '#d9d9d6',
        color: 'var(--text-primary)',
        backgroundColor: 'var(--bg-card)'
      }}
      onFocus={e => { e.target.style.borderColor = error ? '#ef4444' : '#355641'; e.target.style.boxShadow = `0 0 0 3px ${error ? '#ef444415' : '#35564115'}`; }}
      onBlur={e => { e.target.style.borderColor = error ? '#ef4444' : '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
    />
  );
}

function ContactFormModal({ open, onClose, initial, onSuccess }) {
  const api = useAPI();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? { ...emptyForm, ...initial, aum: initial.aum || '', monthlyIncome: initial.monthlyIncome || '' } : emptyForm);
      setErrors({});
    }
  }, [open, initial]);

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Nome é obrigatório';
    if (form.email && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Email inválido';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        status: form.status,
        notes: form.notes || undefined,
        aum: form.aum ? Number(form.aum) : 0,
        investorProfile: form.investorProfile || undefined,
        monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
        profession: form.profession || undefined,
      };
      if (initial?._id) {
        await api.updateContact(initial._id, payload);
        toast.success('Contato atualizado');
      } else {
        await api.createContact(payload);
        toast.success('Contato criado');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar contato');
    } finally {
      setSaving(false);
    }
  }

  const isCliente = form.status === 'cliente';

  return (
    <Modal open={open} onClose={onClose} title={initial?._id ? 'Editar Contato' : 'Novo Contato'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Nome" required error={errors.name}>
            <TextInput value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} error={errors.name} />
          </FormField>
          <FormField label="Email" error={errors.email}>
            <TextInput type="email" value={form.email} onChange={v => setForm(f => ({ ...f, email: v }))} error={errors.email} />
          </FormField>
          <FormField label="Telefone">
            <PhoneInput value={form.phone} onChange={v => setForm(f => ({ ...f, phone: v }))} />
          </FormField>
          <FormField label="Empresa">
            <TextInput value={form.company} onChange={v => setForm(f => ({ ...f, company: v }))} />
          </FormField>
          <FormField label="Status">
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: 'var(--text-primary)' }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </FormField>
          <FormField label="Profissão">
            <TextInput value={form.profession} onChange={v => setForm(f => ({ ...f, profession: v }))} />
          </FormField>
          <FormField label="Renda Mensal (R$)">
            <CurrencyInput value={form.monthlyIncome} onChange={v => setForm(f => ({ ...f, monthlyIncome: v }))} placeholder="R$ 0,00" />
          </FormField>
          {isCliente && (
            <>
              <FormField label="AUM (R$)">
                <CurrencyInput value={form.aum} onChange={v => setForm(f => ({ ...f, aum: v }))} placeholder="R$ 0,00" />
              </FormField>
              <FormField label="Perfil do Investidor">
                <select
                  value={form.investorProfile}
                  onChange={e => setForm(f => ({ ...f, investorProfile: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <option value="">Não definido</option>
                  {INVESTOR_PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </FormField>
            </>
          )}
        </div>
        <FormField label="Notas">
          <textarea
            rows={3}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all"
            style={{ color: 'var(--text-primary)' }}
            onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
            onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
          />
        </FormField>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            style={{ backgroundColor: '#355641' }}
          >
            {saving ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg> Salvando...</>
            ) : (initial?.id ? 'Salvar alterações' : 'Criar contato')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Contacts() {
  const api = useAPI();
  const { toast } = useToast();
  const { activeCRM } = useCRM();
  const allContacts = useContacts();
  const loading = allContacts === undefined;
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [viewContact, setViewContact] = useState(null);
  const [formModal, setFormModal] = useState({ open: false, contact: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' });
  const [showImport, setShowImport] = useState(false);
  const [advancing, setAdvancing] = useState(null);

  // Filter client-side for real-time reactivity
  const contacts = (allContacts ?? []).filter(c => {
    if (c.status === 'cliente' && !filterStatus) return false;
    if (filterStatus && c.status !== filterStatus) return false;
    if (search) {
      const s = search.toLowerCase();
      return (c.name ?? '').toLowerCase().includes(s) ||
             (c.email ?? '').toLowerCase().includes(s) ||
             (c.phone ?? '').includes(s);
    }
    return true;
  });

  async function loadContact(id) {
    try {
      const c = await api.getContact(id);
      setViewContact(c);
    } catch (e) { console.error(e); }
  }

  async function handleAdvance(id, e) {
    e?.stopPropagation();
    setAdvancing(id);
    try {
      await api.advanceContact(id);
      toast.success('Contato avançado de etapa');
    } catch (err) { toast.error(err.message); } finally { setAdvancing(null); }
  }

  async function handleDelete() {
    const { id } = confirmDelete;
    try {
      await api.deleteContact(id);
      toast.success('Contato excluído');
      setConfirmDelete({ open: false, id: null, name: '' });
      if (viewContact?._id === id) setViewContact(null);
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir');
    }
  }

  const nextStatus = (s) => {
    const idx = STATUSES.indexOf(s);
    return idx >= 0 && idx < STATUSES.length - 2 ? STATUSES[idx + 1] : null;
  };

  const fmtAUM = (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR')}` : '—';
  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('pt-BR') : '—';

  return (
    <div className="p-8" style={{ backgroundColor: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Prospecção</h1>
          <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>{contacts.length} contatos</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border font-sans text-sm font-medium transition-all hover:bg-white"
            style={{ borderColor: '#d9d9d6', color: 'var(--text-primary)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Importar CSV
          </button>
          <button
            onClick={() => setFormModal({ open: true, contact: null })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#355641' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Novo Contato
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, e-mail, empresa..."
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none w-72 bg-white"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
        <select
          value={filterStatus}
          onChange={e => setFilterStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Todos (exceto Clientes)</option>
          {STATUSES.filter(s => s !== 'cliente').map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          <option value="cliente">Cliente</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: '#d9d9d6' }}>
        <table className="w-full">
          <thead style={{ backgroundColor: 'var(--bg-page)', borderBottom: `1px solid #d9d9d6` }}>
            <tr>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Nome</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Empresa</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Telefone</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Status</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>AUM</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Cadastro</th>
              <th className="text-right px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-12 font-sans text-sm text-gray-400">Carregando...</td></tr>
            ) : contacts.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-16 font-sans text-sm text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <p>Nenhum contato encontrado</p>
                </div>
              </td></tr>
            ) : contacts.map(c => (
              <tr
                key={c._id}
                className="border-b cursor-pointer transition-colors hover:bg-gray-50"
                style={{ borderColor: '#d9d9d6' }}
                onClick={() => loadContact(c._id)}
              >
                <td className="px-5 py-3">
                  <p className="font-sans font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                  {c.email && <p className="font-sans text-xs text-gray-400">{c.email}</p>}
                  {c.finder_name && (
                    <span className="inline-flex items-center gap-1 mt-0.5 px-1.5 py-0.5 rounded-full font-sans text-xs font-semibold" style={{ backgroundColor: 'rgba(37,99,235,0.10)', color: '#2563eb' }}>
                      🤝 {c.finder_name}
                    </span>
                  )}
                </td>
                <td className="px-5 py-3 font-sans text-sm text-gray-600">{c.company || '—'}</td>
                <td className="px-5 py-3 font-sans text-sm text-gray-600">{c.phone || '—'}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge status={c.status} />
                    {nextStatus(c.status) && c.status !== 'cliente' && (
                      <button
                        onClick={e => handleAdvance(c._id, e)}
                        disabled={advancing === c._id}
                        className="text-xs font-bold transition-colors hover:opacity-70"
                        style={{ color: '#dd7752' }}
                      >
                        {advancing === c._id ? '...' : `→ ${STATUS_LABELS[nextStatus(c.status)]}`}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3 font-sans text-sm" style={{ color: c.aum ? 'var(--text-primary)' : 'var(--text-hint)', fontWeight: c.aum ? 'bold' : 'normal' }}>
                  {fmtAUM(c.aum)}
                </td>
                <td className="px-5 py-3 font-sans text-xs text-gray-400">{fmtDate(c._creationTime)}</td>
                <td className="px-5 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      onClick={e => { e.stopPropagation(); setFormModal({ open: true, contact: c }); }}
                      className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                      title="Editar"
                    >
                      <svg className="w-4 h-4 text-gray-400 hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDelete({ open: true, id: c._id, name: c.name }); }}
                      className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                      title="Excluir"
                    >
                      <svg className="w-4 h-4 text-gray-300 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* View Contact Modal */}
      {viewContact && (
        <Modal open={!!viewContact} onClose={() => setViewContact(null)} title={viewContact.name} size="lg">
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pb-5 border-b border-gray-100">
              <div><p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">E-mail</p><p className="font-sans text-sm" style={{ color: 'var(--text-primary)' }}>{viewContact.email || '—'}</p></div>
              <div><p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Telefone</p><p className="font-sans text-sm" style={{ color: 'var(--text-primary)' }}>{viewContact.phone || '—'}</p></div>
              <div><p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Empresa</p><p className="font-sans text-sm" style={{ color: 'var(--text-primary)' }}>{viewContact.company || '—'}</p></div>
              <div>
                <p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">AUM</p>
                <p className="font-serif font-bold" style={{ color: 'var(--text-primary)' }}>{fmtAUM(viewContact.aum)}</p>
              </div>
              <div><p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Perfil</p><p className="font-sans text-sm capitalize" style={{ color: 'var(--text-primary)' }}>{viewContact.investorProfile || '—'}</p></div>
              <div>
                <p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Status</p>
                <div className="flex items-center gap-2">
                  <FunnelDots status={viewContact.status} />
                  <Badge status={viewContact.status} />
                </div>
              </div>
              {viewContact.profession && <div><p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Profissão</p><p className="font-sans text-sm" style={{ color: 'var(--text-primary)' }}>{viewContact.profession}</p></div>}
              {viewContact.monthlyIncome && <div><p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">Renda Mensal</p><p className="font-sans text-sm" style={{ color: 'var(--text-primary)' }}>{fmtAUM(viewContact.monthlyIncome)}</p></div>}
            </div>

            {viewContact.deals?.length > 0 && (
              <div>
                <p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Negócios</p>
                <div className="space-y-1">
                  {viewContact.deals.map(d => (
                    <div key={d._id} className="flex items-center justify-between text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-page)' }}>
                      <span className="font-sans" style={{ color: 'var(--text-primary)' }}>{d.title}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-sans text-xs text-gray-400">{STATUS_LABELS[d.stage] || d.stage}</span>
                        <span className="font-serif font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{fmtAUM(d.value)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {nextStatus(viewContact.status) && viewContact.status !== 'cliente' && (
              <button
                onClick={e => handleAdvance(viewContact._id, e)}
                disabled={advancing === viewContact._id}
                className="w-full py-2.5 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
                style={{ backgroundColor: '#dd7752' }}
              >
                {advancing === viewContact._id ? 'Avançando...' : `→ Avançar para ${STATUS_LABELS[nextStatus(viewContact.status)]}`}
              </button>
            )}

            <BriefingPanel contact={viewContact} onUpdate={c => setViewContact(c)} />
            <CalendarWidget contactId={viewContact._id} />

            <div className="flex justify-between items-center pt-2">
              <button
                onClick={() => { setConfirmDelete({ open: true, id: viewContact._id, name: viewContact.name }); setViewContact(null); }}
                className="px-4 py-2 rounded-xl border font-sans text-sm font-medium text-red-500 border-red-200 hover:bg-red-50 transition-all"
              >
                Excluir contato
              </button>
              <button
                onClick={() => { setFormModal({ open: true, contact: viewContact }); setViewContact(null); }}
                className="px-5 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 transition-all"
                style={{ backgroundColor: '#355641' }}
              >
                Editar contato
              </button>
            </div>
          </div>
        </Modal>
      )}

      <ContactFormModal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, contact: null })}
        initial={formModal.contact}
        onSuccess={() => {}}
      />

      <ConfirmDialog
        open={confirmDelete.open}
        title="Excluir contato"
        message={`Tem certeza que deseja excluir "${confirmDelete.name}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ open: false, id: null, name: '' })}
      />

      <ImportModal open={showImport} onClose={() => setShowImport(false)} onSuccess={() => {}} />
    </div>
  );
}
