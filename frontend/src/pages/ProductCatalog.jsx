import React, { useState, useEffect, useCallback } from 'react';
import useAPI from '../hooks/useAPI.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

const CRM_OPTIONS = [
  { value: 'credito', label: 'Crédito', color: '#7c3aed', icon: '💳' },
  { value: 'cambio',  label: 'Câmbio',  color: '#7c3aed', icon: '💱' },
  { value: 'seguro',  label: 'Seguro',  color: '#10b981', icon: '🛡️' },
];

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

// ─── FEE inline editable ──────────────────────────────────────────────────────
function FeeCell({ product, onSaved }) {
  const api = useAPI();
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(product.fee_percent != null ? String(product.fee_percent) : '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const fee = val === '' ? null : parseFloat(val);
      await api.updateProductCatalog(product.id, { fee_percent: fee === null ? '' : fee });
      toast.success('FEE atualizado');
      onSaved();
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <div className="relative">
          <input
            autoFocus
            type="number"
            step="0.01"
            min="0"
            max="100"
            value={val}
            onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            placeholder="0.00"
            className="w-20 px-2 pr-6 py-1 rounded-lg border font-sans text-sm outline-none text-right"
            style={{ borderColor: '#355641', boxShadow: '0 0 0 3px #35564115', color: 'var(--text-primary)' }}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 font-sans text-xs text-gray-400">%</span>
        </div>
        <button onClick={save} disabled={saving}
          className="p-1.5 rounded-lg transition-colors hover:bg-green-50" title="Salvar">
          <svg className="w-3.5 h-3.5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <button onClick={() => setEditing(false)}
          className="p-1.5 rounded-lg transition-colors hover:bg-gray-100" title="Cancelar">
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setVal(product.fee_percent != null ? String(product.fee_percent) : ''); setEditing(true); }}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border transition-all hover:border-green-400 hover:bg-green-50 group"
      style={{ borderColor: product.fee_percent != null ? '#35564140' : '#e5e7eb' }}
      title="Clique para editar o FEE deste produto"
    >
      {product.fee_percent != null ? (
        <span className="font-sans text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{product.fee_percent}%</span>
      ) : (
        <span className="font-sans text-xs text-gray-400 group-hover:text-green-600">+ FEE</span>
      )}
      <svg className="w-3 h-3 text-gray-300 group-hover:text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  );
}

// ─── Modal criar/editar produto ───────────────────────────────────────────────
function ProductModal({ open, onClose, product, onSuccess }) {
  const { toast } = useToast();
  const [form, setForm] = useState({ crm_type: 'credito', name: '', value_key: '', fee_percent: '' });
  const [saving, setSaving] = useState(false);
  const isEdit = !!product;

  useEffect(() => {
    if (open) {
      setForm(product
        ? { ...product, fee_percent: product.fee_percent != null ? String(product.fee_percent) : '' }
        : { crm_type: 'credito', name: '', value_key: '', fee_percent: '' }
      );
    }
  }, [open, product]);

  const handleNameChange = (v) => {
    setForm(p => ({ ...p, name: v, ...(!isEdit ? { value_key: slugify(v) } : {}) }));
  };

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim() || !form.value_key.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name,
        value_key: form.value_key,
        fee_percent: form.fee_percent === '' ? null : parseFloat(form.fee_percent),
      };
      if (isEdit) {
        await api.updateProductCatalog(product.id, payload);
        toast.success('Produto atualizado');
      } else {
        await api.createProductCatalog({ crm_type: form.crm_type, ...payload });
        toast.success('Produto criado');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all";
  const focusStyle = e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; };
  const blurStyle  = e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; };

  return (
    <Modal open={open} onClose={onClose} title={isEdit ? 'Editar Produto' : 'Novo Produto'} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {!isEdit && (
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">CRM <span className="text-red-500">*</span></label>
            <select value={form.crm_type} onChange={e => setForm(p => ({ ...p, crm_type: e.target.value }))}
              className={inputCls} style={{ color: 'var(--text-primary)' }}>
              {CRM_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.icon} {o.label}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Nome do Produto <span className="text-red-500">*</span></label>
          <input value={form.name} onChange={e => handleNameChange(e.target.value)}
            placeholder="Ex: Consórcio Porto" className={inputCls} style={{ color: 'var(--text-primary)' }}
            onFocus={focusStyle} onBlur={blurStyle} />
        </div>

        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Chave interna <span className="text-red-500">*</span></label>
          <input value={form.value_key} onChange={e => setForm(p => ({ ...p, value_key: e.target.value }))}
            placeholder="consorcio_porto" className={`${inputCls} font-mono`} style={{ color: 'var(--text-primary)' }}
            onFocus={focusStyle} onBlur={blurStyle} />
          <p className="font-sans text-xs text-gray-400 mt-1">Gerado automaticamente pelo nome.</p>
        </div>

        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">FEE do Produto (%)</label>
          <div className="relative">
            <input
              type="number" step="0.01" min="0" max="100"
              value={form.fee_percent}
              onChange={e => setForm(p => ({ ...p, fee_percent: e.target.value }))}
              placeholder="Ex: 1.5 (deixe vazio para usar FEE do CRM)"
              className={`${inputCls} pr-8`} style={{ color: 'var(--text-primary)' }}
              onFocus={focusStyle} onBlur={blurStyle}
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 font-sans text-xs text-gray-400">%</span>
          </div>
          <p className="font-sans text-xs text-gray-400 mt-1">
            Se vazio, usará o FEE geral do CRM configurado em Financeiro → Configurações.
          </p>
        </div>

        <div className="flex gap-3 justify-end pt-1">
          <button type="button" onClick={onClose}
            className="px-5 py-2 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="px-6 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all"
            style={{ backgroundColor: '#355641' }}>
            {saving ? 'Salvando...' : (isEdit ? 'Salvar' : 'Criar produto')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function ProductCatalog() {
  const { toast } = useToast();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterCRM, setFilterCRM] = useState('all');
  const [modal, setModal] = useState({ open: false, product: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, name: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProducts(await api.getProductCatalog());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete() {
    try {
      await api.deleteProductCatalog(confirmDelete.id);
      toast.success('Produto removido');
      setConfirmDelete({ open: false, id: null, name: '' });
      load();
    } catch (err) { toast.error(err.message); }
  }

  const filtered = filterCRM === 'all' ? products : products.filter(p => p.crm_type === filterCRM);
  const grouped = CRM_OPTIONS.reduce((acc, crm) => {
    acc[crm.value] = filtered.filter(p => p.crm_type === crm.value);
    return acc;
  }, {});

  return (
    <div className="p-8" style={{ backgroundColor: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-serif font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Catálogo de Produtos</h1>
          <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>
            Gerencie os tipos de produtos e defina o FEE individual de cada um
          </p>
        </div>
        <button
          onClick={() => setModal({ open: true, product: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ backgroundColor: '#355641' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Produto
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {[{ value: 'all', label: 'Todos', icon: '📦' }, ...CRM_OPTIONS].map(opt => (
          <button key={opt.value} onClick={() => setFilterCRM(opt.value)}
            className="px-3 py-1.5 rounded-xl font-sans text-xs font-semibold transition-all"
            style={{
              backgroundColor: filterCRM === opt.value ? '#355641' : 'var(--bg-card)',
              color: filterCRM === opt.value ? 'white' : '#6b7280',
              border: `1px solid ${filterCRM === opt.value ? '#355641' : '#e5e7eb'}`,
            }}>
            {opt.icon} {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-32 animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-6">
          {CRM_OPTIONS.filter(crm => filterCRM === 'all' || filterCRM === crm.value).map(crm => {
            const items = grouped[crm.value] || [];
            return (
              <div key={crm.value} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                {/* CRM Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between"
                  style={{ backgroundColor: crm.color + '08' }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{crm.icon}</span>
                    <div>
                      <h3 className="font-serif font-bold text-gray-900">{crm.label}</h3>
                      <p className="font-sans text-xs text-gray-400">{items.length} produto{items.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {/* Legend */}
                  <p className="font-sans text-xs text-gray-400 hidden sm:block">
                    Clique no FEE para editar inline
                  </p>
                </div>

                {items.length === 0 ? (
                  <div className="px-6 py-8 text-center">
                    <p className="font-sans text-sm text-gray-400">Nenhum produto cadastrado</p>
                    <button onClick={() => setModal({ open: true, product: null })}
                      className="font-sans text-xs font-semibold mt-1 hover:underline" style={{ color: crm.color }}>
                      + Adicionar produto
                    </button>
                  </div>
                ) : (
                  <>
                    {/* Column headers */}
                    <div className="flex items-center gap-4 px-6 py-2 border-b border-gray-50">
                      <p className="flex-1 font-sans text-xs font-bold uppercase tracking-wider text-gray-400">Produto</p>
                      <p className="w-28 text-center font-sans text-xs font-bold uppercase tracking-wider text-gray-400">FEE Individual</p>
                      <p className="w-16 text-right font-sans text-xs font-bold uppercase tracking-wider text-gray-400">Ações</p>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {items.map(p => (
                        <div key={p.id} className="flex items-center gap-4 px-6 py-3 hover:bg-gray-50 transition-colors">
                          <div className="flex-1 min-w-0">
                            <p className="font-sans font-semibold text-sm text-gray-800">{p.name}</p>
                            <p className="font-mono text-xs text-gray-400 mt-0.5">{p.value_key}</p>
                          </div>

                          {/* FEE inline */}
                          <div className="w-28 flex justify-center">
                            <FeeCell product={p} onSaved={load} />
                          </div>

                          {/* Actions */}
                          <div className="w-16 flex items-center justify-end gap-1 flex-shrink-0">
                            <button onClick={() => setModal({ open: true, product: p })}
                              className="p-1.5 rounded-lg transition-colors hover:bg-gray-100" title="Editar">
                              <svg className="w-4 h-4 text-gray-400 hover:text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button onClick={() => setConfirmDelete({ open: true, id: p.id, name: p.name })}
                              className="p-1.5 rounded-lg transition-colors hover:bg-red-50" title="Excluir">
                              <svg className="w-4 h-4 text-gray-300 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ProductModal
        open={modal.open}
        onClose={() => setModal({ open: false, product: null })}
        product={modal.product}
        onSuccess={load}
      />
      <ConfirmDialog
        open={confirmDelete.open}
        title="Excluir produto"
        message={`Tem certeza que deseja excluir "${confirmDelete.name}"?`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ open: false, id: null, name: '' })}
      />
    </div>
  );
}
