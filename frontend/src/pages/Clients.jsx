import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import RevenuePanel from '../components/RevenuePanel.jsx';
import InlineField from '../components/InlineField.jsx';
import BriefingPanel from '../components/BriefingPanel.jsx';
import CalendarWidget from '../components/CalendarWidget.jsx';
import ClientDataPanel from '../components/ClientDataPanel.jsx';
import SuitabilityPanel from '../components/SuitabilityPanel.jsx';
import RevenueClientPanel from '../components/RevenueClientPanel.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useCRM } from '../contexts/CRMContext.jsx';

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

const fmtCur = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

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
        style={{ color: '#353535' }}
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
      await api.updateContact(client.id, {
        ...form,
        aum: form.aum ? parseFloat(form.aum) : 0,
        monthly_income: form.monthly_income ? parseFloat(form.monthly_income) : null,
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
          <InputField label="Telefone" value={form.phone} onChange={v => f('phone', v)} />
          <InputField label="Empresa" value={form.company} onChange={v => f('company', v)} />

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
                  style={{ color: '#353535' }}
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
              value={form.investor_profile || ''}
              onChange={e => f('investor_profile', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
              style={{ color: '#353535' }}
            >
              <option value="">Não definido</option>
              {INVESTOR_PROFILES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
          <InputField label="Profissão" value={form.profession} onChange={v => f('profession', v)} />
          <InputField label="Renda Mensal (R$)" type="number" value={form.monthly_income} onChange={v => f('monthly_income', v)} />
          <InputField label="Estado Civil" value={form.marital_status} onChange={v => f('marital_status', v)} />
          <InputField label="Data de Nascimento" type="date" value={form.birth_date} onChange={v => f('birth_date', v)} />
          <InputField label="Banco" value={form.bank_name} onChange={v => f('bank_name', v)} />
          <InputField label="Agência" value={form.bank_agency} onChange={v => f('bank_agency', v)} />
          <div className="col-span-2">
            <InputField label="Endereço" value={form.address} onChange={v => f('address', v)} />
          </div>
        </div>
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Notas</label>
          <textarea rows={3} value={form.notes || ''} onChange={e => f('notes', e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all" style={{ color: '#353535' }}
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

// ─── Modal Produto (Crédito) ──────────────────────────────────────────────────
const emptyProduct = { product_type: 'consorcio_porto', credit_value: '', contract_date: '', contract_number: '', group_number: '', quota_number: '', notes: '' };

function ProductModal({ open, onClose, contactId, product, onSuccess }) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const isEdit = !!product;

  useEffect(() => {
    if (open) setForm(isEdit ? { ...product } : emptyProduct);
  }, [open, product]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.product_type) return;
    setSaving(true);
    try {
      const payload = {
        contact_id: contactId,
        crm_type: 'credito',
        product_type: form.product_type,
        credit_value: form.credit_value ? parseFloat(String(form.credit_value).replace(/\./g, '').replace(',', '.')) : 0,
        contract_date: form.contract_date || null,
        contract_number: form.contract_number || null,
        group_number: form.group_number || null,
        quota_number: form.quota_number || null,
        notes: form.notes || null,
      };
      if (isEdit) await api.updateProduct(product.id, payload);
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
  const PURPLE = '#7c3aed';

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Produto' : 'Adicionar Produto'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">

        {/* Tipo de produto */}
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Tipo de Produto <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_TYPES.map(pt => (
              <button key={pt.value} type="button"
                onClick={() => f('product_type', pt.value)}
                className="px-3 py-2.5 rounded-xl border font-sans text-sm font-medium transition-all text-left"
                style={{
                  backgroundColor: form.product_type === pt.value ? '#f5f3ff' : '#fafafa',
                  borderColor: form.product_type === pt.value ? PURPLE : '#e5e7eb',
                  color: form.product_type === pt.value ? PURPLE : '#6b7280',
                  fontWeight: form.product_type === pt.value ? 700 : 400,
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
              value={form.credit_value || ''}
              onChange={e => f('credit_value', e.target.value)}
              placeholder="0,00"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: '#353535' }}
              onFocus={e => { e.target.style.borderColor = PURPLE; e.target.style.boxShadow = `0 0 0 3px ${PURPLE}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Nº Contrato */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Nº Contrato</label>
            <input type="text" value={form.contract_number || ''} onChange={e => f('contract_number', e.target.value)}
              placeholder="Ex: 100215363"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all font-mono"
              style={{ color: '#353535' }}
              onFocus={e => { e.target.style.borderColor = PURPLE; e.target.style.boxShadow = `0 0 0 3px ${PURPLE}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
            <p className="font-sans text-xs text-gray-400 mt-1">Usado para cruzar dados do financeiro</p>
          </div>

          {/* Data do Contrato */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Data do Contrato</label>
            <input type="date" value={form.contract_date || ''} onChange={e => f('contract_date', e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: '#353535' }}
              onFocus={e => { e.target.style.borderColor = PURPLE; e.target.style.boxShadow = `0 0 0 3px ${PURPLE}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Grupo */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Grupo</label>
            <input type="text" value={form.group_number || ''} onChange={e => f('group_number', e.target.value)}
              placeholder="Ex: AF350"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all font-mono"
              style={{ color: '#353535' }}
              onFocus={e => { e.target.style.borderColor = PURPLE; e.target.style.boxShadow = `0 0 0 3px ${PURPLE}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Cota */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Cota</label>
            <input type="text" value={form.quota_number || ''} onChange={e => f('quota_number', e.target.value)}
              placeholder="Ex: 281"
              className="w-full px-3 py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all font-mono"
              style={{ color: '#353535' }}
              onFocus={e => { e.target.style.borderColor = PURPLE; e.target.style.boxShadow = `0 0 0 3px ${PURPLE}15`; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        {/* Notas */}
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Observações</label>
          <textarea rows={2} value={form.notes || ''} onChange={e => f('notes', e.target.value)}
            placeholder="Informações adicionais..."
            className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all" style={{ color: '#353535' }}
            onFocus={e => { e.target.style.borderColor = PURPLE; e.target.style.boxShadow = `0 0 0 3px ${PURPLE}15`; }}
            onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">Cancelar</button>
          <button type="submit" disabled={saving}
            className="px-6 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ backgroundColor: PURPLE }}
          >
            {saving ? 'Salvando...' : (isEdit ? 'Salvar alterações' : 'Adicionar produto')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Painel de Produtos (inline no card) ──────────────────────────────────────
function ProductsPanel({ contactId, onProductChange }) {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productModal, setProductModal] = useState({ open: false, product: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null });
  const PURPLE = '#7c3aed';

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getProducts({ contact_id: contactId, crm_type: 'credito' });
      setProducts(data);
      if (onProductChange) onProductChange(data.length);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [contactId]);

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
        <p className="font-sans text-xs font-semibold uppercase tracking-wider" style={{ color: PURPLE }}>
          📋 Produtos Contratados
        </p>
        <button
          onClick={() => setProductModal({ open: true, product: null })}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg font-sans text-xs font-semibold text-white transition-all hover:opacity-90"
          style={{ backgroundColor: PURPLE }}
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
        <div className="text-center py-3 rounded-xl border border-dashed" style={{ borderColor: PURPLE + '40' }}>
          <p className="font-sans text-xs text-gray-400">Nenhum produto contratado</p>
          <button onClick={() => setProductModal({ open: true, product: null })}
            className="font-sans text-xs font-semibold mt-1 hover:underline" style={{ color: PURPLE }}>
            + Adicionar primeiro produto
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {products.map(p => (
            <div key={p.id} className="rounded-xl border p-3" style={{ backgroundColor: '#f5f3ff', borderColor: PURPLE + '30' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-sans text-xs font-bold" style={{ color: PURPLE }}>
                      {PRODUCT_LABELS[p.product_type] || p.product_type}
                    </span>
                    {p.contract_number && (
                      <span className="font-mono text-xs px-2 py-0.5 rounded bg-white border font-semibold" style={{ borderColor: PURPLE + '30', color: PURPLE }}>
                        #{p.contract_number}
                      </span>
                    )}
                  </div>
                  {(p.group_number || p.quota_number) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {p.group_number && <span className="font-sans text-xs text-gray-500">Grupo: <b>{p.group_number}</b></span>}
                      {p.quota_number && <span className="font-sans text-xs text-gray-500">Cota: <b>{p.quota_number}</b></span>}
                    </div>
                  )}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {p.credit_value > 0 && (
                      <span className="font-serif text-sm font-bold" style={{ color: '#355641' }}>
                        {fmtCur(p.credit_value)}
                      </span>
                    )}
                    {p.contract_date && (
                      <span className="font-sans text-xs text-gray-400">
                        {new Date(p.contract_date + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </span>
                    )}
                  </div>
                  {p.notes && <p className="font-sans text-xs text-gray-500 mt-0.5 truncate">{p.notes}</p>}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <button onClick={() => setProductModal({ open: true, product: p })}
                    className="p-1.5 rounded-lg hover:bg-white/70 transition-colors" title="Editar">
                    <svg className="w-3.5 h-3.5" style={{ color: PURPLE }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                  </button>
                  <button onClick={() => setConfirmDelete({ open: true, id: p.id })}
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

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Clients() {
  const { toast } = useToast();
  const { activeCRM } = useCRM();
  const isCredito = activeCRM === 'credito';
  const ACCENT = isCredito ? '#7c3aed' : '#355641';

  const [clients, setClients] = useState([]);
  const [fee, setFee] = useState(0.55);
  const [loading, setLoading] = useState(true);
  const [journey, setJourney] = useState(null);
  const [activityForm, setActivityForm] = useState({ show: false, clientId: null, description: '', type: 'reuniao' });
  const [renewalLoading, setRenewalLoading] = useState(null);
  const [editModal, setEditModal] = useState({ open: false, client: null });
  const [confirmInactivate, setConfirmInactivate] = useState({ open: false, id: null, name: '' });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [{ clients: c }, feeData] = await Promise.all([
        api.getClients(),
        api.getClientsFee()
      ]);
      setClients(c);
      setFee(feeData.fee);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [activeCRM]); // recarrega quando o CRM muda

  useEffect(() => { load(); }, [load]);

  async function loadJourney(id) {
    try {
      const client = await api.getClient(id);
      setJourney({ ...client, fee });
    } catch (e) { console.error(e); }
  }

  async function handleUpdateAUM(clientId, aum) {
    await api.updateAUM(clientId, parseFloat(aum));
    load();
    if (journey?.id === clientId) loadJourney(clientId);
  }

  async function handleUpdateSuitability(clientId, data) {
    await api.updateSuitability(clientId, data);
    load();
    if (journey?.id === clientId) loadJourney(clientId);
  }

  async function handleLogActivity(e) {
    e.preventDefault();
    try {
      await api.logActivity(activityForm.clientId, { type: activityForm.type, description: activityForm.description });
      toast.success('Atividade registrada');
      setActivityForm({ show: false, clientId: null, description: '', type: 'reuniao' });
      load();
      if (journey?.id === activityForm.clientId) loadJourney(activityForm.clientId);
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
    <div className="p-8" style={{ backgroundColor: '#f5f4f2', minHeight: '100vh' }}>
      <div className="animate-pulse h-32 bg-white rounded-2xl mb-6" />
      <div className="grid grid-cols-3 gap-4">{[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-64 animate-pulse" />)}</div>
    </div>
  );

  return (
    <div className="p-8" style={{ backgroundColor: '#f5f4f2', minHeight: '100vh' }}>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-serif font-bold text-2xl" style={{ color: '#353535' }}>
            {isCredito ? 'Clientes — Crédito' : 'Clientes Ativos'}
          </h1>
          <p className="font-sans text-sm mt-1" style={{ color: '#353535', opacity: 0.5 }}>{clients.length} clientes</p>
        </div>
        {isCredito && (
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl font-sans text-xs font-bold" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
            💳 Gestão de Crédito
          </span>
        )}
      </div>

      <RevenuePanel />

      {clients.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#d9d9d6' }}>
          <p className="font-sans text-gray-400">Nenhum cliente ativo ainda. Avance contatos para o status "Cliente".</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {clients.map(c => {
            const profileColor = PROFILE_COLORS[c.investor_profile] || '#d9d9d6';
            const annualRevenue = (c.aum || 0) * (fee / 100);
            return (
              <div key={c.id} className="bg-white rounded-2xl border flex flex-col overflow-hidden shadow-sm" style={{ borderColor: '#d9d9d6' }}>
                {/* Faixa de cor no topo */}
                <div className="h-1.5 w-full" style={{ backgroundColor: isCredito ? '#7c3aed' : profileColor }} />
                <div className="p-5 flex-1 flex flex-col">

                  {/* Header do card */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-bold truncate" style={{ color: '#353535' }}>{c.name}</h3>
                      {c.company && <p className="font-sans text-xs text-gray-400 truncate">{c.company}</p>}
                      {c.investor_profile && !isCredito && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-bold font-sans" style={{ backgroundColor: profileColor + '20', color: profileColor }}>
                          {PROFILE_LABELS[c.investor_profile]}
                        </span>
                      )}
                    </div>
                    <div className="text-right ml-3 flex-shrink-0">
                      {/* Crédito: label diferente */}
                      {isCredito ? (
                        <div>
                          <p className="font-sans text-xs text-gray-400 mb-0.5">Tipo de Crédito</p>
                          <p className="font-sans text-xs font-semibold" style={{ color: '#7c3aed', maxWidth: 120, textAlign: 'right' }}>
                            {c.aum || '—'}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="font-sans text-xs text-gray-400">AUM</p>
                          <InlineField value={c.aum} onSave={v => handleUpdateAUM(c.id, v)} type="number" prefix="R$ "
                            className="font-serif text-lg font-bold" style={{ color: '#355641' }} placeholder="0" />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Dados pessoais */}
                  <div className="grid grid-cols-2 gap-1 text-xs text-gray-500 mb-3 font-sans">
                    {c.age && <span>{c.age} anos</span>}
                    {c.marital_status && <span>{c.marital_status}</span>}
                    {c.profession && <span className="col-span-2">{c.profession}</span>}
                    {c.phone && <span className="col-span-2">{c.phone}</span>}
                  </div>

                  {/* Campos de carteira (apenas não-crédito) */}
                  {!isCredito && (
                    <div className="space-y-1 mb-3">
                      <div className="flex items-center gap-1">
                        <span className="font-sans text-xs text-gray-400 w-16 flex-shrink-0">Carteira:</span>
                        <InlineField value={c.portfolio} onSave={v => handleUpdateSuitability(c.id, { portfolio: v })} className="font-sans text-xs" placeholder="Não definido" />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="font-sans text-xs text-gray-400 w-16 flex-shrink-0">Horizonte:</span>
                        <InlineField value={c.liquidity_horizon} onSave={v => handleUpdateSuitability(c.id, { liquidity_horizon: v })} className="font-sans text-xs" placeholder="Não definido" />
                      </div>
                    </div>
                  )}

                  {/* Receita (apenas não-crédito) */}
                  {!isCredito && (
                    <div className="rounded-xl p-3 mb-3" style={{ backgroundColor: '#f0f4f1' }}>
                      <div className="flex justify-between text-xs font-sans">
                        <span className="text-gray-500">Receita Anual</span>
                        <span className="font-bold" style={{ color: '#355641' }}>{fmtCur(annualRevenue)}</span>
                      </div>
                      <div className="flex justify-between text-xs font-sans mt-1">
                        <span className="text-gray-500">Receita Mensal</span>
                        <span className="font-bold" style={{ color: '#dd7752' }}>{fmtCur(annualRevenue / 12)}</span>
                      </div>
                    </div>
                  )}

                  {/* Painel de produtos — APENAS CRÉDITO */}
                  {isCredito && <ProductsPanel contactId={c.id} />}

                  <div className="flex gap-3 text-xs text-gray-400 mb-4 font-sans">
                    <span>{c.wonDeals || 0} negócios ganhos</span>
                    <span>{c.openTasks || 0} tarefas abertas</span>
                  </div>

                  {/* Ações */}
                  <div className="mt-auto grid grid-cols-2 gap-2">
                    <button onClick={() => loadJourney(c.id)}
                      className="py-2 rounded-xl font-sans text-xs font-semibold text-white hover:opacity-90 transition-all"
                      style={{ backgroundColor: ACCENT }}>
                      Ver Jornada
                    </button>
                    <button onClick={() => setActivityForm({ show: true, clientId: c.id, description: '', type: 'reuniao' })}
                      className="py-2 rounded-xl font-sans text-xs font-medium border transition-all hover:bg-gray-50"
                      style={{ borderColor: '#d9d9d6', color: '#353535' }}>
                      + Atividade
                    </button>
                    <button onClick={() => setEditModal({ open: true, client: c })}
                      className="py-2 rounded-xl font-sans text-xs font-medium border transition-all hover:bg-gray-50"
                      style={{ borderColor: '#d9d9d6', color: '#353535' }}>
                      Editar
                    </button>
                    <button onClick={() => handleRenewal(c.id)} disabled={renewalLoading === c.id}
                      className="py-2 rounded-xl font-sans text-xs font-medium border transition-all hover:bg-gray-50 disabled:opacity-50"
                      style={{ borderColor: '#d9d9d6', color: '#353535' }}>
                      {renewalLoading === c.id ? '...' : '↩ Renovar'}
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => setConfirmInactivate({ open: true, id: c.id, name: c.name })}
                      className="flex-1 py-1.5 rounded-xl font-sans text-xs font-medium border border-orange-200 text-orange-600 hover:bg-orange-50 transition-all">
                      Inativar
                    </button>
                    <button onClick={() => setConfirmDelete({ open: true, id: c.id, name: c.name })}
                      className="flex-1 py-1.5 rounded-xl font-sans text-xs font-medium border border-red-200 text-red-500 hover:bg-red-50 transition-all">
                      Excluir
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Journey Modal */}
      {journey && (
        <Modal open={!!journey} onClose={() => setJourney(null)} title={`Jornada — ${journey.name}`} size="xl">
          <div className="space-y-4">
            {isCredito ? (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f5f3ff' }}>
                <p className="font-sans text-xs font-semibold mb-1 uppercase tracking-wider" style={{ color: '#7c3aed' }}>Tipo de Crédito Contratado</p>
                <InlineField value={journey.aum}
                  onSave={async v => { await handleUpdateAUM(journey.id, v); loadJourney(journey.id); }}
                  className="font-sans text-base font-bold" style={{ color: '#7c3aed' }} placeholder="Ex: Consórcio" />
              </div>
            ) : (
              <div className="rounded-xl p-4" style={{ backgroundColor: '#f0f4f1' }}>
                <p className="font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">AUM do Cliente</p>
                <InlineField value={journey.aum}
                  onSave={async v => { await handleUpdateAUM(journey.id, v); loadJourney(journey.id); }}
                  type="number" prefix="R$ " className="font-serif text-3xl font-bold" style={{ color: '#355641' }} placeholder="0" />
              </div>
            )}
            {!isCredito && <RevenueClientPanel aum={journey.aum} fee={journey.fee || fee} />}
            {isCredito && (
              <div className="rounded-xl border p-4" style={{ borderColor: '#7c3aed30' }}>
                <ProductsPanel contactId={journey.id} />
              </div>
            )}
            <ClientDataPanel contact={journey} onUpdate={updated => setJourney(j => ({ ...j, ...updated }))} />
            <SuitabilityPanel contact={journey} onUpdate={updated => setJourney(j => ({ ...j, ...updated }))} />
            <BriefingPanel contact={journey} onUpdate={updated => setJourney(j => ({ ...j, ...updated }))} />
            {journey.activities?.length > 0 && (
              <div className="border border-gray-100 rounded-xl p-4">
                <p className="font-sans font-bold text-sm mb-3" style={{ color: '#353535' }}>Histórico da Jornada</p>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {journey.activities.map(a => (
                    <div key={a.id} className="flex gap-3">
                      <div className="w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0" style={{ backgroundColor: '#dd7752' }} />
                      <div>
                        <p className="font-sans text-sm" style={{ color: '#353535' }}>{a.description}</p>
                        <p className="font-sans text-xs text-gray-400">
                          {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <CalendarWidget contactId={journey.id} />
          </div>
        </Modal>
      )}

      {/* Activity Modal */}
      <Modal open={activityForm.show} onClose={() => setActivityForm(f => ({ ...f, show: false }))} title="Registrar Atividade" size="sm">
        <form onSubmit={handleLogActivity} className="space-y-4">
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Tipo</label>
            <select value={activityForm.type} onChange={e => setActivityForm(f => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white" style={{ color: '#353535' }}>
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
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all" style={{ color: '#353535' }}
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
