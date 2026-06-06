import React, { useState, useEffect, useCallback } from 'react';
import api from '../api.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

const STAGES = ['prospecting', 'qualificacao', 'proposta', 'negociacao', 'fechado_ganho'];
const STAGE_LABELS = {
  prospecting: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta',
  negociacao: 'Negociação', fechado_ganho: 'Ganho'
};
const STAGE_COLORS = {
  prospecting: '#9ca3af', qualificacao: '#dd7752', proposta: '#7A5137',
  negociacao: '#355641', fechado_ganho: '#22c55e'
};
const STAGE_PROB = { prospecting: 10, qualificacao: 25, proposta: 50, negociacao: 75, fechado_ganho: 100 };

const fmtCur = (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR')}` : 'R$ 0';

const emptyForm = { title: '', contact_id: '', value: '', stage: 'prospecting', probability: 10, expected_close: '', notes: '' };

function ProbBar({ prob }) {
  const color = prob >= 75 ? '#355641' : prob >= 50 ? '#dd7752' : '#7A5137';
  return (
    <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1">
      <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${prob}%`, backgroundColor: color }} />
    </div>
  );
}

function DealCard({ deal, onDragStart, onAdvance, onReopen, onClick, onDelete }) {
  const isWon = deal.stage === 'fechado_ganho';
  return (
    <div
      draggable={!isWon}
      onDragStart={!isWon ? onDragStart : undefined}
      onClick={onClick}
      className={`bg-white rounded-xl border p-3 cursor-pointer hover:shadow-md transition-all mb-2 group ${isWon ? 'border-green-200 bg-green-50/30' : ''}`}
      style={{ borderColor: isWon ? '#bbf7d0' : '#d9d9d6' }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="font-sans font-bold text-sm truncate flex-1" style={{ color: '#353535' }}>{deal.title}</p>
        <button
          onClick={e => { e.stopPropagation(); onDelete(); }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded transition-all flex-shrink-0"
          title="Excluir"
        >
          <svg className="w-3.5 h-3.5 text-gray-300 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
      </div>
      {deal.contact_name && <p className="font-sans text-xs text-gray-400 mt-0.5 truncate">{deal.contact_name}</p>}
      <div className="flex items-center justify-between mt-2">
        <span className="font-serif text-sm font-bold" style={{ color: '#355641' }}>{fmtCur(deal.value)}</span>
        <span className="font-sans text-xs text-gray-400">{deal.probability}%</span>
      </div>
      <ProbBar prob={deal.probability} />
      {deal.expected_close && (
        <p className="font-sans text-xs text-gray-400 mt-1.5">
          Fechamento: {new Date(deal.expected_close + 'T00:00:00').toLocaleDateString('pt-BR')}
        </p>
      )}
      <div className="mt-2">
        {isWon ? (
          <button
            onClick={e => { e.stopPropagation(); onReopen(); }}
            className="font-sans text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            ↩ Reabrir
          </button>
        ) : (
          <button
            onClick={e => { e.stopPropagation(); onAdvance(); }}
            className="font-sans text-xs font-bold transition-colors hover:opacity-70"
            style={{ color: '#dd7752' }}
          >
            → Avançar
          </button>
        )}
      </div>
    </div>
  );
}

function DealFormModal({ open, onClose, initial, contacts, onSuccess }) {
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        ...emptyForm,
        ...initial,
        value: initial.value || '',
        contact_id: initial.contact_id || '',
      } : emptyForm);
      setErrors({});
    }
  }, [open, initial]);

  function validate() {
    const e = {};
    if (!form.title.trim()) e.title = 'Título é obrigatório';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev) {
    ev.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        value: form.value ? parseFloat(form.value) : 0,
        probability: parseInt(form.probability) || STAGE_PROB[form.stage] || 10,
        contact_id: form.contact_id || null,
      };
      if (initial?.id) {
        await api.updateDeal(initial.id, payload);
        toast.success('Negócio atualizado');
      } else {
        await api.createDeal(payload);
        toast.success('Negócio criado');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar negócio');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={initial?.id ? 'Editar Negócio' : 'Novo Negócio'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
            Título <span className="text-red-500">*</span>
          </label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border font-sans text-sm outline-none transition-all"
            style={{ borderColor: errors.title ? '#ef4444' : '#d9d9d6', color: '#353535' }}
            onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
            onBlur={e => { e.target.style.borderColor = errors.title ? '#ef4444' : '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Contato</label>
            <select
              value={form.contact_id}
              onChange={e => setForm(f => ({ ...f, contact_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
              style={{ color: '#353535' }}
            >
              <option value="">Nenhum</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Valor (R$)</label>
            <input
              type="number"
              min="0"
              value={form.value}
              onChange={e => setForm(f => ({ ...f, value: e.target.value }))}
              placeholder="0"
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: '#353535' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Etapa</label>
            <select
              value={form.stage}
              onChange={e => setForm(f => ({ ...f, stage: e.target.value, probability: STAGE_PROB[e.target.value] || f.probability }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
              style={{ color: '#353535' }}
            >
              {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Probabilidade (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              value={form.probability}
              onChange={e => setForm(f => ({ ...f, probability: parseInt(e.target.value) || 0 }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: '#353535' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div className="col-span-2">
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Data de Fechamento</label>
            <input
              type="date"
              value={form.expected_close}
              onChange={e => setForm(f => ({ ...f, expected_close: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: '#353535' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
        </div>

        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Notas</label>
          <textarea
            rows={2}
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all"
            style={{ color: '#353535' }}
            onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
            onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

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
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Salvando...</>
            ) : (initial?.id ? 'Salvar alterações' : 'Criar negócio')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Pipeline() {
  const { toast } = useToast();
  const [byStage, setByStage] = useState({});
  const [loading, setLoading] = useState(true);
  const [dragDeal, setDragDeal] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [formModal, setFormModal] = useState({ open: false, deal: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, title: '' });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDealsByStage();
      setByStage(data);
    } catch (e) { console.error(e); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); api.getContacts().then(setContacts).catch(() => {}); }, [load]);

  async function handleDrop(stage) {
    if (!dragDeal || dragDeal.stage === stage) { setDragDeal(null); setDragOver(null); return; }
    const updated = { ...dragDeal, stage, probability: STAGE_PROB[stage] || dragDeal.probability };
    setByStage(prev => {
      const next = { ...prev };
      next[dragDeal.stage] = (next[dragDeal.stage] || []).filter(d => d.id !== dragDeal.id);
      next[stage] = [updated, ...(next[stage] || [])];
      return next;
    });
    try {
      await api.updateDeal(dragDeal.id, updated);
      toast.success('Negócio movido');
    } catch (e) {
      toast.error('Erro ao mover negócio');
      load();
    }
    setDragDeal(null); setDragOver(null);
  }

  async function handleAdvance(deal) {
    const idx = STAGES.indexOf(deal.stage);
    if (idx >= STAGES.length - 1) return;
    const nextStage = STAGES[idx + 1];
    try {
      await api.updateDeal(deal.id, { ...deal, stage: nextStage, probability: STAGE_PROB[nextStage] });
      toast.success(`Negócio avançado para ${STAGE_LABELS[nextStage]}`);
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleReopen(deal) {
    try {
      await api.updateDeal(deal.id, { ...deal, stage: 'negociacao', probability: 75 });
      toast.success('Negócio reaberto');
      load();
    } catch (e) { toast.error(e.message); }
  }

  async function handleDelete() {
    try {
      await api.deleteDeal(confirmDelete.id);
      toast.success('Negócio excluído');
      setConfirmDelete({ open: false, id: null, title: '' });
      load();
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir');
    }
  }

  const colTotal = (stage) => (byStage[stage] || []).reduce((s, d) => s + (d.value || 0), 0);

  if (loading) return (
    <div className="p-8" style={{ backgroundColor: '#f5f4f2', minHeight: '100vh' }}>
      <div className="grid grid-cols-5 gap-3">
        {STAGES.map(s => <div key={s} className="h-64 bg-white rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="p-8 h-full" style={{ backgroundColor: '#f5f4f2', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif font-bold text-2xl" style={{ color: '#353535' }}>Pipeline</h1>
          <p className="font-sans text-sm mt-1" style={{ color: '#353535', opacity: 0.5 }}>Kanban de negócios</p>
        </div>
        <button
          onClick={() => setFormModal({ open: true, deal: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ backgroundColor: '#355641' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Novo Negócio
        </button>
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-5 gap-3" style={{ minHeight: 'calc(100vh - 200px)' }}>
        {STAGES.map(stage => {
          const deals = byStage[stage] || [];
          const isWon = stage === 'fechado_ganho';
          return (
            <div
              key={stage}
              className="flex flex-col rounded-xl border-2 transition-colors"
              style={{ borderColor: dragOver === stage && !isWon ? '#355641' : 'transparent', backgroundColor: dragOver === stage && !isWon ? '#35564108' : 'transparent' }}
              onDragOver={!isWon ? (e) => { e.preventDefault(); setDragOver(stage); } : undefined}
              onDragLeave={() => setDragOver(null)}
              onDrop={!isWon ? () => handleDrop(stage) : undefined}
            >
              {/* Column header */}
              <div
                className="px-3 py-3 rounded-t-xl mb-2"
                style={{ backgroundColor: STAGE_COLORS[stage] + '18', borderTop: `3px solid ${STAGE_COLORS[stage]}` }}
              >
                <div className="flex items-center justify-between">
                  <p className="font-sans font-bold text-sm" style={{ color: '#353535' }}>{STAGE_LABELS[stage]}</p>
                  <span className="font-sans text-xs bg-white rounded-full px-2 py-0.5 font-bold text-gray-500">{deals.length}</span>
                </div>
                <p className="font-sans text-xs text-gray-500 mt-0.5">{fmtCur(colTotal(stage))}</p>
              </div>

              {/* Cards */}
              <div className="flex-1 overflow-y-auto px-2 pb-2">
                {deals.map(deal => (
                  <DealCard
                    key={deal.id}
                    deal={deal}
                    onDragStart={() => setDragDeal(deal)}
                    onAdvance={() => handleAdvance(deal)}
                    onReopen={() => handleReopen(deal)}
                    onClick={() => setFormModal({ open: true, deal })}
                    onDelete={() => setConfirmDelete({ open: true, id: deal.id, title: deal.title })}
                  />
                ))}
                {deals.length === 0 && (
                  <div className="text-center py-8 font-sans text-sm text-gray-300">Vazio</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <DealFormModal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, deal: null })}
        initial={formModal.deal}
        contacts={contacts}
        onSuccess={load}
      />

      <ConfirmDialog
        open={confirmDelete.open}
        title="Excluir negócio"
        message={`Tem certeza que deseja excluir "${confirmDelete.title}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ open: false, id: null, title: '' })}
      />
    </div>
  );
}
