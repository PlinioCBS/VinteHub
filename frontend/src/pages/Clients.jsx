import React, { useState, useEffect, useCallback, useMemo } from 'react';
import useAPI from '../hooks/useAPI.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import RevenuePanel from '../components/RevenuePanel.jsx';
import RevenuePanelCredito from '../components/RevenuePanelCredito.jsx';
import InlineField from '../components/InlineField.jsx';
import BriefingPanel from '../components/BriefingPanel.jsx';
import CalendarWidget from '../components/CalendarWidget.jsx';
import ClientDataPanel from '../components/ClientDataPanel.jsx';
import SuitabilityPanel from '../components/SuitabilityPanel.jsx';
import RevenueClientPanel from '../components/RevenueClientPanel.jsx';
import CurrencyInput from '../components/CurrencyInput.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useCRM } from '../contexts/CRMContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { maskPhone, maskCPF, TAX_REGIMES } from '../utils/masks.js';
import { BRAZIL_STATES } from '../utils/brazilStates.js';
import TeamLocationMap from '../components/TeamLocationMap.jsx';

const PROFILE_COLORS = {
  conservador: '#3b82f6', moderado: '#eab308', arrojado: '#f97316', agressivo: '#ef4444'
};
const PROFILE_LABELS = {
  conservador: 'Conservador', moderado: 'Moderado', arrojado: 'Arrojado', agressivo: 'Agressivo'
};
const INVESTOR_PROFILES = [
  { value: 'conservador', label: 'Conservador' },
  { value: 'moderado',    label: 'Moderado' },
  { value: 'arrojado',    label: 'Arrojado' },
  { value: 'agressivo',   label: 'Agressivo' },
];
const PRODUCT_TYPES = [
  { value: 'consorcio_porto',    label: 'Consórcio Porto' },
  { value: 'consorcio_bancorbras', label: 'Consórcio BancorBras' },
  { value: 'carta_contemplada',  label: 'Carta Contemplada' },
  { value: 'financiamento',      label: 'Financiamento' },
];
const PRODUCT_LABELS = {
  consorcio_porto:    'Consórcio Porto',
  consorcio_bancorbras: 'Consórcio BancorBras',
  carta_contemplada:  'Carta Contemplada',
  financiamento:      'Financiamento',
};

const PRODUCT_TYPES_BY_CRM = {
  credito: [
    { value: 'consorcio_porto',      label: 'Consórcio Porto' },
    { value: 'consorcio_bancorbras', label: 'Consórcio BancorBras' },
    { value: 'carta_contemplada',    label: 'Carta Contemplada' },
    { value: 'financiamento',        label: 'Financiamento' },
  ],
  cambio: [
    { value: 'cambio_comercial',       label: 'Câmbio Comercial' },
    { value: 'cambio_turismo',         label: 'Câmbio Turismo' },
    { value: 'remessa_internacional',  label: 'Remessa Internacional' },
    { value: 'cambio_importacao',      label: 'Câmbio Importação' },
  ],
  seguro: [
    { value: 'seguro_vida',        label: 'Seguro de Vida' },
    { value: 'seguro_auto',        label: 'Seguro Auto' },
    { value: 'seguro_residencial', label: 'Seguro Residencial' },
    { value: 'seguro_empresarial', label: 'Seguro Empresarial' },
  ],
};

const CRM_HAS_PRODUCTS = ['credito', 'cambio', 'seguro'];

const fmtCur = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const fmtNum = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtUSD = (v) => '$ ' + fmtNum(v);

function EditableUSD({ value, onSave }) {
  const api = useAPI();
  const [editing, setEditing] = React.useState(false);
  const [input, setInput] = React.useState('');
  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="100"
        value={input}
        onChange={e => setInput(e.target.value)}
        onBlur={() => {
          const v = parseFloat(String(input).replace(',', '.'));
          if (!isNaN(v) && v !== value) onSave(v);
          setEditing(false);
        }}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
        className="w-28 px-2 py-0.5 rounded-lg border font-sans text-sm outline-none text-right"
        style={{ borderColor: '#2563eb', boxShadow: '0 0 0 3px #2563eb20', color: '#1e3a5f' }}
        onClick={e => e.stopPropagation()}
      />
    );
  }
  return (
    <button
      onClick={e => { e.stopPropagation(); setInput(value != null ? String(value) : '0'); setEditing(true); }}
      className="font-sans text-sm font-semibold hover:opacity-70 transition-opacity"
      style={{ color: (value || 0) > 0 ? 'var(--text-primary)' : 'var(--text-hint)' }}
      title="Clique para editar AUM USD"
    >
      {(value || 0) > 0 ? fmtUSD(value) : '—'}
    </button>
  );
}

// ─── helpers ─────────────────────────────────────────────────────────────────
function InputField({ label, value, onChange, type = 'text', placeholder = '', required = false }) {
  return (
    <div>
      <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
        {label}{required && <span className="text-red-500 ml-1">*</span>}
      </label>
      <input
        type={type}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
        style={{ color: 'var(--text-primary)' }}
        onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
        onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

// ─── Modal Editar Cliente ─────────────────────────────────────────────────────
function EditClientModal({ open, onClose, client, onSuccess, isCredito }) {
  const { toast } = useToast();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && client) setForm({ ...client, aum: client.aum || '' });
  }, [open, client]);

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!form.name?.trim()) return;
    setSaving(true);
    try {
      await api.updateContact(client._id, {
        ...form,
        aum: form.aum ? parseFloat(form.aum) : 0,
        monthlyIncome: form.monthlyIncome ? parseFloat(form.monthlyIncome) : undefined,
        investorProfile: form.investorProfile || undefined,
        maritalStatus: form.maritalStatus || undefined,
        birthDate: form.birthDate || undefined,
        bankName: form.bankName || undefined,
        bankAgency: form.bankAgency || undefined,
        taxRegime: form.taxRegime || undefined,
      });
      toast.success('Cliente atualizado');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Editar Cliente" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <InputField label="Nome" value={form.name} onChange={v => f('name', v)} required />
          <InputField label="Email" type="email" value={form.email} onChange={v => f('email', v)} />
          <InputField label="Telefone" value={form.phone} onChange={v => f('phone', maskPhone(v))} placeholder="(11) 91234-5678" />
          <InputField label="Empresa" value={form.company} onChange={v => f('company', v)} />
          <InputField label="CPF" value={form.cpf} onChange={v => f('cpf', maskCPF(v))} placeholder="000.000.000-00" />
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Regime Tributário</label>
            <select
              value={form.taxRegime || ''}
              onChange={e => f('taxRegime', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="">Não definido</option>
              {TAX_REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Estado (UF)</label>
            <select
              value={form.state || ''}
              onChange={e => f('state', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="">Não definido</option>
              {BRAZIL_STATES.map(s => <option key={s.uf} value={s.uf}>{s.name} ({s.uf})</option>)}
            </select>
          </div>

          {/* Crédito: campo de "Tipo de crédito" / outros: AUM */}
          {isCredito ? (
            <>
              <div>
                <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Tipo de Crédito Contratado</label>
                <input
                  type="text"
                  value={form.aum || ''}
                  onChange={e => f('aum', e.target.value)}
                  placeholder="Ex: Consórcio, Financiamento..."
                  className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
                  style={{ color: 'var(--text-primary)' }}
                  onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px #7c3aed15'; }}
                  onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
            </>
          ) : (
            <InputField label="AUM (R$)" type="number" value={form.aum} onChange={v => f('aum', v)} placeholder="0" />
          )}

          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Perfil do Investidor</label>
            <select
              value={form.investorProfile || ''}
              onChange={e => f('investorProfile', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="">Não definido</option>
              {INVESTOR_PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <InputField label="Profissão" value={form.profession} onChange={v => f('profession', v)} />
          <InputField label="Renda Mensal (R$)" type="number" value={form.monthlyIncome} onChange={v => f('monthlyIncome', v)} />
          <InputField label="Estado Civil" value={form.maritalStatus} onChange={v => f('maritalStatus', v)} />
          <InputField label="Data de Nascimento" type="date" value={form.birthDate} onChange={v => f('birthDate', v)} />
          <InputField label="Banco" value={form.bankName} onChange={v => f('bankName', v)} />
          <InputField label="Agência" value={form.bankAgency} onChange={v => f('bankAgency', v)} />
          <div className="col-span-2">
            <InputField label="Endereço" value={form.address} onChange={v => f('address', v)} />
          </div>
        </div>
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Notas</label>
          <textarea rows={3} value={form.notes || ''} onChange={e => f('notes', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all" style={{ color: 'var(--text-primary)' }}
            onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
            onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">Cancelar</button>
          <button type="submit" disabled={saving}
            className="px-6 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            style={{ backgroundColor: '#355641' }}
          >
            {saving ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Salvando...</> : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Modal Produto (genérico para Crédito, Câmbio, Seguro) ───────────────────
function ProductModal({ open, onClose, contactId, product, onSuccess, crmType = 'credito' }) {
  const { toast } = useToast();
  const productTypes = PRODUCT_TYPES_BY_CRM[crmType] || PRODUCT_TYPES;
  const emptyProduct = { productType: productTypes[0]?.value || '', creditValue: '', contractDate: '', contractNumber: '', groupNumber: '', quotaNumber: '', notes: '', taxaPercent: '' };
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const isEdit = !!product;

  useEffect(() => {
    if (open) setForm(isEdit ? { ...product, taxaPercent: product.taxaPercent ?? '' } : { ...emptyProduct, productType: productTypes[0]?.value || '' });
  }, [open, product, crmType]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.productType) return;
    setSaving(true);
    try {
      const payload = {
        contactId,
        crmType,
        productType: form.productType,
        creditValue: form.creditValue ? parseFloat(String(form.creditValue).replace(/\./g, '').replace(',', '.')) : 0,
        contractDate: form.contractDate || undefined,
        contractNumber: form.contractNumber || undefined,
        groupNumber: form.groupNumber || undefined,
        quotaNumber: form.quotaNumber || undefined,
        notes: form.notes || undefined,
        taxaPercent: form.taxaPercent !== '' && form.taxaPercent != null ? parseFloat(form.taxaPercent) : undefined,
      };
      if (isEdit) await api.updateProduct(product._id, payload);
      else await api.createProduct(payload);
      toast.success(isEdit ? 'Produto atualizado' : 'Produto adicionado');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const ACCENT_COLORS = { credito: '#7c3aed', cambio: '#7c3aed', seguro: '#10b981' };
  const ACCENT = ACCENT_COLORS[crmType] || '#7c3aed';

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Produto' : 'Adicionar Produto'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Tipo de produto */}
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Tipo de Produto <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {productTypes.map(pt => (
              <button key={pt.value} type="button"
                onClick={() => f('productType', pt.value)}
                className="px-3 py-2.5 rounded-xl border font-sans text-sm font-medium transition-all text-left"
                style={{
                  backgroundColor: form.productType === pt.value ? ACCENT + '15' : 'var(--bg-page)',
                  borderColor: form.productType === pt.value ? ACCENT : '#e5e7eb',
                  color: form.productType === pt.value ? ACCENT : '#6b7280',
                  fontWeight: form.productType === pt.value ? 700 : 400,
                }}
              >
                {pt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Valor do crédito */}
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Valor do Crédito Contratado (R$)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 font-sans text-sm text-gray-400">R$</span>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.creditValue || ''}
              onChange={e => f('creditValue', e.target.value)}
              placeholder="0,00"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: 'var(--text-primary)' }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Nº Contrato */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Nº Contrato</label>
            <input type="text" value={form.contractNumber || ''} onChange={e => f('contractNumber', e.target.value)}
              placeholder="Ex: 100215363"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all font-mono"
              style={{ color: 'var(--text-primary)' }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
            <p className="font-sans text-xs text-gray-400 mt-1">Usado para cruzar dados do financeiro</p>
          </div>

          {/* Data do Contrato */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Data do Contrato</label>
            <input type="date" value={form.contractDate || ''} onChange={e => f('contractDate', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: 'var(--text-primary)' }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Grupo */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Grupo</label>
            <input type="text" value={form.groupNumber || ''} onChange={e => f('groupNumber', e.target.value)}
              placeholder="Ex: AF350"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all font-mono"
              style={{ color: 'var(--text-primary)' }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Cota */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Cota</label>
            <input type="text" value={form.quotaNumber || ''} onChange={e => f('quotaNumber', e.target.value)}
              placeholder="Ex: 281"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all font-mono"
              style={{ color: 'var(--text-primary)' }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Taxa do consultor */}
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
            Taxa do Consultor (%)
            <span className="ml-1 font-normal normal-case text-gray-400">— sua comissão neste produto</span>
          </label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={form.taxaPercent ?? ''}
              onChange={e => f('taxaPercent', e.target.value)}
              placeholder="Ex: 1.5"
              className="w-full pr-8 pl-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: 'var(--text-primary)' }}
              onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-sm text-gray-400">%</span>
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Observações</label>
          <textarea rows={2} value={form.notes || ''} onChange={e => f('notes', e.target.value)}
            placeholder="Informações adicionais..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all" style={{ color: 'var(--text-primary)' }}
            onFocus={e => { e.target.style.borderColor = ACCENT; e.target.style.boxShadow = `0 0 0 3px ${ACCENT}15`; }}
            onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">Cancelar</button>
          <button type="submit" disabled={saving}
            className="px-6 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ backgroundColor: ACCENT }}
          >
            {saving ? 'Salvando...' : (isEdit ? 'Salvar alterações' : 'Adicionar produto')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Painel de Produtos (genérico para Crédito, Câmbio, Seguro) ───────────────
function ProductsPanel({ contactId, onProductChange, crmType = 'credito' }) {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productModal, setProductModal] = useState({ open: false, product: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
  const ACCENT_COLORS = { credito: '#7c3aed', cambio: '#7c3aed', seguro: '#10b981' };
  const ACCENT = ACCENT_COLORS[crmType] || '#7c3aed';
  const productLabels = Object.fromEntries((PRODUCT_TYPES_BY_CRM[crmType] || PRODUCT_TYPES).map(p => [p.value, p.label]));

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProducts({ contact_id: contactId, crm_type: crmType });
      setProducts(data);
      if (onProductChange) onProductChange(data.length);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [contactId, crmType]);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  async function handleDelete() {
    try {
      await api.deleteProduct(confirmDelete.id);
      toast.success('Produto removido');
      setConfirmDelete({ open: false, id: null });
      loadProducts();
    } catch (err) { toast.error(err.message); }
  }

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-2">
        <p className="font-sans text-xs font-semibold uppercase tracking-wider" style={{ color: ACCENT }}>
          📋 Produtos Contratados
        </p>
        <button
          onClick={() => setProductModal({ open: true, product: null })}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-sans text-xs font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: ACCENT }}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Produto
        </button>
      </div>

      {loading ? (
        <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
      ) : products.length === 0 ? (
        <div className="text-center py-3 rounded-xl border border-dashed" style={{ borderColor: ACCENT + '40' }}>
          <p className="font-sans text-xs text-gray-400">Nenhum produto contratado</p>
          <button onClick={() => setProductModal({ open: true, product: null })}
            className="font-sans text-xs font-semibold mt-1 hover:underline" style={{ color: ACCENT }}>
            + Adicionar primeiro produto
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p._id} className="rounded-xl border p-3" style={{ backgroundColor: ACCENT + '08', borderColor: ACCENT + '30' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans text-xs font-bold" style={{ color: ACCENT }}>
                      {productLabels[p.productType] || PRODUCT_LABELS[p.productType] || p.productType}
                    </span>
                    {p.contractNumber && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border font-semibold" style={{ borderColor: ACCENT + '30', color: ACCENT }}>
                        #{p.contractNumber}
                      </span>
                    )}
                  </div>
                  {(p.groupNumber || p.quotaNumber) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.groupNumber && <span className="font-sans text-xs text-gray-500">Grupo: <b>{p.groupNumber}</b></span>}
                      {p.quotaNumber && <span className="font-sans text-xs text-gray-500">Cota: <b>{p.quotaNumber}</b></span>}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {p.creditValue > 0 && (
                      <span className="font-serif text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                        {fmtCur(p.creditValue)}
                      </span>
                    )}
                    {p.contractDate && (
                      <span className="font-sans text-xs text-gray-400">
                        {new Date(p.contractDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  {p.notes && <p className="font-sans text-xs text-gray-500 mt-0.5 truncate">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setProductModal({ open: true, product: p })}
                    className="p-1.5 rounded-lg hover:bg-white/70 transition-colors" title="Editar">
                    <svg className="w-3.5 h-3.5" style={{ color: ACCENT }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => setConfirmDelete({ open: true, id: p._id })}
                    className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Excluir">
                    <svg className="w-3.5 h-3.5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ProductModal
        open={productModal.open}
        onClose={() => setProductModal({ open: false, product: null })}
        contactId={contactId}
        product={productModal.product}
        onSuccess={loadProducts}
        crmType={crmType}
      />
      <ConfirmDialog
        open={confirmDelete.open}
        title="Remover produto"
        message="Tem certeza que deseja remover este produto?"
        confirmText="Remover"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ open: false, id: null })}
      />
    </div>
  );
}

// ─── Modal Criar Cliente ──────────────────────────────────────────────────────
const emptyClientForm = {
  name: '', email: '', phone: '', company: '', aum: '', investorProfile: '',
  monthlyIncome: '', profession: '', notes: '', status: 'cliente',
  cpf: '', taxRegime: '', state: ''
};

function CreateClientModal({ open, onClose, onSuccess, activeCRM }) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyClientForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const isCredito = activeCRM === 'credito';

  useEffect(() => {
    if (open) { setForm(emptyClientForm); setErrors({}); }
  }, [open]);

  function validate() {
    const e = {};
    if (!form.name.trim()) e.name = 'Nome é obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      await api.createContact({
        name: form.name,
        email: form.email || undefined,
        phone: form.phone || undefined,
        company: form.company || undefined,
        notes: form.notes || undefined,
        profession: form.profession || undefined,
        cpf: form.cpf || undefined,
        state: form.state || undefined,
        status: 'cliente',
        aum: form.aum ? Number(form.aum) : 0,
        investorProfile: form.investorProfile || undefined,
        monthlyIncome: form.monthlyIncome ? Number(form.monthlyIncome) : undefined,
        taxRegime: form.taxRegime || undefined,
      });
      toast.success('Cliente criado');
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <Modal open={open} onClose={onClose} title="Novo Cliente" size="lg">
      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Nome <span className="text-red-500">*</span></label>
            <input value={form.name} onChange={e => f('name', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border font-sans text-sm outline-none transition-all"
              style={{ borderColor: errors.name ? '#ef4444' : '#d9d9d6', color: 'var(--text-primary)' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = errors.name ? '#ef4444' : '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>
          <InputField label="Email" type="email" value={form.email} onChange={v => f('email', v)} />
          <InputField label="Telefone" value={form.phone} onChange={v => f('phone', maskPhone(v))} placeholder="(11) 91234-5678" />
          <InputField label="Empresa" value={form.company} onChange={v => f('company', v)} />
          <InputField label="CPF" value={form.cpf} onChange={v => f('cpf', maskCPF(v))} placeholder="000.000.000-00" />
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Regime Tributário</label>
            <select value={form.taxRegime || ''} onChange={e => f('taxRegime', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white" style={{ color: 'var(--text-primary)' }}>
              <option value="">Não definido</option>
              {TAX_REGIMES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Estado (UF)</label>
            <select value={form.state || ''} onChange={e => f('state', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white" style={{ color: 'var(--text-primary)' }}>
              <option value="">Não definido</option>
              {BRAZIL_STATES.map(s => <option key={s.uf} value={s.uf}>{s.name} ({s.uf})</option>)}
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">AUM (R$)</label>
            <CurrencyInput value={form.aum} onChange={v => f('aum', v)} placeholder="R$ 0,00" />
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Perfil do Investidor</label>
            <select value={form.investorProfile} onChange={e => f('investorProfile', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white" style={{ color: 'var(--text-primary)' }}>
              <option value="">Não definido</option>
              {INVESTOR_PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Renda Mensal (R$)</label>
            <CurrencyInput value={form.monthlyIncome} onChange={v => f('monthlyIncome', v)} placeholder="R$ 0,00" />
          </div>
          <InputField label="Profissão" value={form.profession} onChange={v => f('profession', v)} />
        </div>
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Notas</label>
          <textarea rows={3} value={form.notes} onChange={e => f('notes', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all" style={{ color: 'var(--text-primary)' }}
            onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
            onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
          />
        </div>
        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">Cancelar</button>
          <button type="submit" disabled={saving}
            className="px-6 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            style={{ backgroundColor: '#355641' }}>
            {saving ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Salvando...</> : 'Criar cliente'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Clients() {
  const api = useAPI();
  const { toast } = useToast();
  const { activeCRM } = useCRM();
  const { isMaster } = useAuth();
  const isCredito = activeCRM === 'credito';
  const isCambio = activeCRM === 'cambio';
  const isSeguro = activeCRM === 'seguro';
  const isInvestimento = activeCRM === 'investimento';
  const hasProducts = CRM_HAS_PRODUCTS.includes(activeCRM);
  const ACCENT = isCredito ? '#7c3aed' : isSeguro ? '#10b981' : '#355641';


  const [clients, setClients] = useState([]);
  const [fee, setFee] = useState(0.55);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [journey, setJourney] = useState(null);
  const [activityForm, setActivityForm] = useState({ show: false, clientId: null, description: '', type: 'reuniao' });
  const [renewalLoading, setRenewalLoading] = useState(null);
  const [editModal, setEditModal] = useState({ open: false, client: null });
  const [createModal, setCreateModal] = useState(false);
  const [confirmInactivate, setConfirmInactivate] = useState({ open: false, id: null, name: '' });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' });
  const [mapOpen, setMapOpen] = useState(() => localStorage.getItem('clients_map_open') !== '0');

  function toggleMap() {
    setMapOpen(o => { const next = !o; localStorage.setItem('clients_map_open', next ? '1' : '0'); return next; });
  }

  const filteredClients = useMemo(() => {
    if (!search.trim()) return clients;
    const q = search.toLowerCase();
    return clients.filter(c =>
      c.name?.toLowerCase().includes(q) ||
      c.phone?.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [clientsData, feeData] = await Promise.all([
        // No Crédito: busca todos clientes (todos CRMs) para poder adicionar produtos a qualquer um
        isCredito ? api.getAllClients() : api.getClients(),
        api.getClientsFee()
      ]);
      setClients(clientsData.clients || []);
      setFee(feeData.fee);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeCRM, isCredito]); // recarrega quando o CRM muda

  useEffect(() => { load(); }, [load]);

  async function loadJourney(id) {
    try {
      const client = await api.getClient(id);
      setJourney({ ...client, fee });
    } catch (e) { console.error(e); }
  }

  const totalUSD = isInvestimento ? clients.reduce((s, c) => s + (parseFloat(c.aumUsd) || 0), 0) : 0;

  async function handleSaveFee(val) {
    try {
      await api.updateClientsFee(parseFloat(val));
      setFee(parseFloat(val));
    } catch (e) { toast.error('Erro ao salvar fee'); }
  }

  async function handleSaveAumUsd(clientId, aum_usd) {
    try {
      await api.updateAumUsd(clientId, aum_usd);
      toast.success('AUM USD atualizado');
      load();
    } catch (e) { toast.error('Erro ao salvar'); }
  }

  async function handleUpdateAUM(clientId, aum) {
    await api.updateAUM(clientId, parseFloat(aum));
    load();
    if (journey?._id === clientId) loadJourney(clientId);
  }

  async function handleUpdateSuitability(clientId, data) {
    await api.updateSuitability(clientId, data);
    load();
    if (journey?._id === clientId) loadJourney(clientId);
  }

  async function handleLogActivity(e) {
    e.preventDefault();
    try {
      await api.logActivity(activityForm.clientId, { type: activityForm.type, description: activityForm.description });
      toast.success('Atividade registrada');
      setActivityForm({ show: false, clientId: null, description: '', type: 'reuniao' });
      load();
      if (journey?._id === activityForm.clientId) loadJourney(activityForm.clientId);
    } catch (err) { toast.error(err.message); }
  }

  async function handleRenewal(clientId) {
    setRenewalLoading(clientId);
    try {
      await api.renewalClient(clientId);
      toast.success('Cliente retornou ao funil de negociação');
      load();
    } catch (e) { toast.error(e.message); }
    finally { setRenewalLoading(null); }
  }

  async function handleInactivate() {
    try {
      await api.updateContact(confirmInactivate.id, { status: 'inativo' });
      toast.success('Cliente inativado');
      setConfirmInactivate({ open: false, id: null, name: '' });
      load();
    } catch (err) { toast.error(err.message); }
  }

  async function handleDelete() {
    try {
      await api.deleteContact(confirmDelete.id);
      toast.success('Cliente excluído');
      setConfirmDelete({ open: false, id: null, name: '' });
      load();
    } catch (err) { toast.error(err.message); }
  }

  if (loading) return (
    <div className="p-8" style={{ backgroundColor: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="animate-pulse h-32 bg-white rounded-2xl mb-6" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-64 animate-pulse" />)}</div>
    </div>
  );

  return (
    <div className="p-8" style={{ backgroundColor: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>
            {isCredito ? 'Clientes — Crédito' : 'Clientes Ativos'}
          </h1>
          <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>{filteredClients.length} clientes</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {isCredito && (
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-sans text-xs font-bold" style={{ backgroundColor: 'rgba(124,58,237,0.08)', color: 'var(--text-muted)' }}>
              💳 Gestão de Crédito
            </span>
          )}
          <button
            onClick={() => setCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: ACCENT }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
            Novo Cliente
          </button>
        </div>
      </div>

      {isCredito ? <RevenuePanelCredito /> : <RevenuePanel />}

      {/* USD Dashboard — investimento only (espelho da linha BRL) */}
      {isInvestimento && (
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="card p-5 flex flex-col gap-1">
            <p className="label">Receita Anual USD</p>
            <p className="font-serif text-2xl text-green">$ {fmtNum(totalUSD * fee / 100)}</p>
            <p className="text-xs text-charcoal/40">Fee {fee}% × AUM USD</p>
          </div>
          <div className="card p-5 flex flex-col gap-1">
            <p className="label">Receita Mensal USD</p>
            <p className="font-serif text-2xl text-copper">$ {fmtNum(totalUSD * fee / 100 / 12)}</p>
            <p className="text-xs text-charcoal/40">Anual ÷ 12</p>
          </div>
          <div className="card p-5 flex flex-col gap-1">
            <p className="label">Fee de Gestão</p>
            <div className="flex items-baseline gap-1">
              <InlineField value={fee} onSave={handleSaveFee} type="number" suffix="% " className="font-serif text-2xl text-brown" />
            </div>
            <p className="text-xs text-charcoal/40">Clique para editar</p>
          </div>
          <div className="card p-5 flex flex-col gap-1">
            <p className="label">AUM Total USD</p>
            <p className="font-serif text-2xl text-charcoal">$ {fmtNum(totalUSD)}</p>
            <p className="text-xs text-charcoal/40">{clients.filter(c => (c.aumUsd || 0) > 0).length} clientes com posição</p>
          </div>
        </div>
      )}

      {/* Mapa de clientes ativos (minimizável) — abaixo dos cards, acima da lista */}
      {!loading && clients.length > 0 && (
        <div className="mt-6 bg-white rounded-2xl border shadow-sm overflow-hidden" style={{ borderColor: '#d9d9d6' }}>
          <button
            onClick={toggleMap}
            className="w-full flex items-center justify-between px-5 py-3 transition-colors hover:bg-gray-50"
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" style={{ color: ACCENT }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span className="font-serif font-bold text-base" style={{ color: 'var(--text-primary)' }}>Mapa de Clientes Ativos</span>
              <span className="font-sans text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: ACCENT + '14', color: ACCENT }}>
                {clients.filter(c => c.state).length}
              </span>
            </div>
            <svg className="w-5 h-5 transition-transform" style={{ color: 'var(--text-muted)', transform: mapOpen ? 'rotate(180deg)' : 'none' }}
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {mapOpen && (
            <div className="px-5 pb-5 pt-1 border-t" style={{ borderColor: '#f0eeeb' }}>
              <div className="mt-4">
                <TeamLocationMap
                  people={clients.map(c => ({
                    id: c._id,
                    name: c.name,
                    state: c.state,
                    subtitle: isMaster ? (c.consultantName || c.company || null) : (c.company || null),
                  }))}
                  legendLabel="Cliente localizado"
                  avatarColor={ACCENT}
                  countColor={ACCENT}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search */}
      <div className="flex gap-3 mt-6 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, telefone, empresa..."
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none w-72 bg-white"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: '#d9d9d6' }}>
        <table className="w-full">
          <thead style={{ backgroundColor: 'var(--bg-page)', borderBottom: '1px solid #d9d9d6' }}>
            <tr>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Nome</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Telefone</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>{hasProducts ? 'Produtos' : 'AUM'}</th>
              {isInvestimento && (
                <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>AUM USD</th>
              )}
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Perfil Investidor</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>CRM</th>
              <th className="text-right px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={isInvestimento ? 7 : 6} className="text-center py-12 font-sans text-sm text-gray-400">Carregando...</td></tr>
            ) : filteredClients.length === 0 ? (
              <tr><td colSpan={isInvestimento ? 7 : 6} className="text-center py-16 font-sans text-sm text-gray-400">
                <div className="flex flex-col items-center gap-2">
                  <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                  <p>Nenhum cliente encontrado</p>
                </div>
              </td></tr>
            ) : filteredClients.map(c => {
              const profileColor = PROFILE_COLORS[c.investorProfile] || '#d9d9d6';
              return (
                <tr
                  key={c._id}
                  className="border-b cursor-pointer transition-colors hover:bg-gray-50"
                  style={{ borderColor: '#d9d9d6' }}
                  onClick={() => loadJourney(c._id)}
                >
                  <td className="px-5 py-3">
                    <p className="font-sans font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                    {c.company && <p className="font-sans text-xs text-gray-400">{c.company}</p>}
                  </td>
                  <td className="px-5 py-3 font-sans text-sm text-gray-600">{c.phone || '—'}</td>
                  <td className="px-5 py-3">
                    {hasProducts ? (
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-bold font-sans"
                        style={{ backgroundColor: ACCENT + '15', color: ACCENT }}>
                        {c.productCount > 0 ? `${c.productCount} produto${c.productCount > 1 ? 's' : ''}` : '+ Produto'}
                      </span>
                    ) : (
                      <span className="font-sans text-sm font-bold" style={{ color: c.aum ? 'var(--text-primary)' : 'var(--text-hint)' }}>
                        {c.aum ? fmtCur(c.aum) : '—'}
                      </span>
                    )}
                  </td>
                  {isInvestimento && (
                    <td className="px-5 py-3">
                      <EditableUSD value={c.aumUsd || 0} onSave={v => handleSaveAumUsd(c._id, v)} />
                    </td>
                  )}
                  <td className="px-5 py-3">
                    {c.investorProfile ? (
                      <span className="inline-block text-xs px-2 py-0.5 rounded-full font-bold font-sans" style={{ backgroundColor: profileColor + '20', color: profileColor }}>
                        {PROFILE_LABELS[c.investorProfile]}
                      </span>
                    ) : <span className="text-gray-300 text-sm">—</span>}
                  </td>
                  <td className="px-5 py-3 font-sans text-xs text-gray-500 capitalize">{c.crmType || '—'}</td>
                  <td className="px-5 py-3">
                    <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                      <button
                        onClick={() => setEditModal({ open: true, client: c })}
                        className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                        title="Editar"
                      >
                        <svg className="w-4 h-4 text-gray-400 hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button
                        onClick={() => setConfirmInactivate({ open: true, id: c._id, name: c.name })}
                        className="p-1.5 rounded-lg transition-colors hover:bg-orange-50"
                        title="Inativar"
                      >
                        <svg className="w-4 h-4 text-gray-300 hover:text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>
                      </button>
                      <button
                        onClick={() => setConfirmDelete({ open: true, id: c._id, name: c.name })}
                        className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                        title="Excluir"
                      >
                        <svg className="w-4 h-4 text-gray-300 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Journey Modal */}
      {journey && (
        <Modal open={!!journey} onClose={() => setJourney(null)} title={`Jornada — ${journey.name}`} size="xl">
          <div className="space-y-4">
            {isCredito ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}>
                <p className="font-sans text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>Tipo de Crédito Contratado</p>
                <InlineField value={journey.aum}
                  onSave={async v => { await handleUpdateAUM(journey._id, v); loadJourney(journey._id); }}
                  className="font-sans text-base font-bold" style={{ color: 'var(--text-primary)' }} placeholder="Ex: Consórcio" />
              </div>
            ) : (
              <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(53,86,65,0.08)' }}>
                <p className="font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">AUM do Cliente</p>
                <InlineField value={journey.aum}
                  onSave={async v => { await handleUpdateAUM(journey._id, v); loadJourney(journey._id); }}
                  type="number" prefix="R$ " className="font-serif text-3xl font-bold" style={{ color: 'var(--text-primary)' }} placeholder="0" />
              </div>
            )}
            {!hasProducts && <RevenueClientPanel aum={journey.aum} fee={journey.fee || fee} />}
            {hasProducts && (
              <div className="rounded-xl border p-4" style={{ borderColor: ACCENT + '30' }}>
                <ProductsPanel contactId={journey._id} crmType={activeCRM} />
              </div>
            )}
            <ClientDataPanel contact={journey} onUpdate={updated => setJourney(j => ({ ...j, ...updated }))} />
            <SuitabilityPanel contact={journey} onUpdate={updated => setJourney(j => ({ ...j, ...updated }))} />
            <BriefingPanel contact={journey} onUpdate={updated => setJourney(j => ({ ...j, ...updated }))} />
            {journey.activities?.length > 0 && (
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="font-sans font-bold text-sm mb-3" style={{ color: 'var(--text-primary)' }}>Histórico da Jornada</p>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {journey.activities.map(a => (
                    <div key={a._id} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#dd7752' }} />
                      <div>
                        <p className="font-sans text-sm" style={{ color: 'var(--text-primary)' }}>{a.description}</p>
                        <p className="font-sans text-xs text-gray-400">
                          {new Date(a._creationTime).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <CalendarWidget contactId={journey._id} />

            {/* Ações da jornada */}
            <div className="flex gap-2 flex-wrap pt-2 border-t border-gray-100">
              <button
                onClick={() => setActivityForm({ show: true, clientId: journey._id, description: '', type: 'reuniao' })}
                className="px-4 py-2 rounded-xl font-sans text-sm font-medium border transition-all hover:bg-gray-50"
                style={{ borderColor: '#d9d9d6', color: 'var(--text-primary)' }}>
                + Atividade
              </button>
              <button
                onClick={() => { handleRenewal(journey._id); setJourney(null); }}
                disabled={renewalLoading === journey._id}
                className="px-4 py-2 rounded-xl font-sans text-sm font-medium border transition-all hover:bg-gray-50 disabled:opacity-50"
                style={{ borderColor: '#d9d9d6', color: 'var(--text-primary)' }}>
                {renewalLoading === journey._id ? '...' : '↩ Renovar'}
              </button>
              <button
                onClick={() => { setConfirmInactivate({ open: true, id: journey._id, name: journey.name }); setJourney(null); }}
                className="px-4 py-2 rounded-xl font-sans text-sm font-medium border border-orange-200 text-orange-600 hover:bg-orange-50 transition-all">
                Inativar
              </button>
              <button
                onClick={() => { setConfirmDelete({ open: true, id: journey._id, name: journey.name }); setJourney(null); }}
                className="px-4 py-2 rounded-xl font-sans text-sm font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-all">
                Excluir
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Activity Modal */}
      <Modal open={activityForm.show} onClose={() => setActivityForm(f => ({ ...f, show: false }))} title="Registrar Atividade" size="sm">
        <form onSubmit={handleLogActivity} className="space-y-4">
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Tipo</label>
            <select value={activityForm.type} onChange={e => setActivityForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white" style={{ color: 'var(--text-primary)' }}>
              <option value="reuniao">Reunião</option>
              <option value="ligacao">Ligação</option>
              <option value="email">E-mail</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="note">Nota</option>
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Descrição <span className="text-red-500">*</span></label>
            <textarea required rows={3} value={activityForm.description} onChange={e => setActivityForm(f => ({ ...f, description: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all" style={{ color: 'var(--text-primary)' }}
              placeholder="Descreva o que aconteceu..."
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setActivityForm(f => ({ ...f, show: false }))}
              className="flex-1 py-2 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">Cancelar</button>
            <button type="submit" className="flex-1 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 transition-all" style={{ backgroundColor: ACCENT }}>Registrar</button>
          </div>
        </form>
      </Modal>

      <CreateClientModal
        open={createModal}
        onClose={() => setCreateModal(false)}
        onSuccess={load}
        activeCRM={activeCRM}
      />

      <EditClientModal
        open={editModal.open}
        onClose={() => setEditModal({ open: false, client: null })}
        client={editModal.client}
        onSuccess={load}
        isCredito={isCredito}
      />

      <ConfirmDialog open={confirmInactivate.open} title="Inativar cliente"
        message={`Tem certeza que deseja inativar "${confirmInactivate.name}"?`}
        confirmText="Inativar" confirmColor="#f97316"
        onConfirm={handleInactivate} onCancel={() => setConfirmInactivate({ open: false, id: null, name: '' })} />

      <ConfirmDialog open={confirmDelete.open} title="Excluir cliente"
        message={`Tem certeza que deseja excluir "${confirmDelete.name}" permanentemente?`}
        confirmText="Excluir permanentemente"
        onConfirm={handleDelete} onCancel={() => setConfirmDelete({ open: false, id: null, name: '' })} />
    </div>
  );
}
