import React, { useState } from 'react';
import useAPI from '../hooks/useAPI.js';
import { useFinders } from '../hooks/useConvexData.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../contexts/ToastContext.jsx';
import { useAuth } from '../contexts/AuthContext.jsx';
import { maskPhone } from '../utils/masks.js';
import { BRAZIL_STATES } from '../utils/brazilStates.js';

function StateSelect({ value, onChange }) {
  return (
    <div>
      <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Estado (localização)</label>
      <select value={value || ''} onChange={e => onChange(e.target.value)}
        className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        onFocus={e => { e.target.style.borderColor = '#dd7752'; e.target.style.boxShadow = '0 0 0 3px rgba(221,119,82,0.12)'; }}
        onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}>
        <option value="">Não definido</option>
        {BRAZIL_STATES.map(s => <option key={s.uf} value={s.uf}>{s.name} ({s.uf})</option>)}
      </select>
    </div>
  );
}

const KPI_OPTIONS = [
  { value: 'credito_producao', label: 'Produção de Crédito (R$)', unit: 'R$' },
  { value: 'reunioes_agendadas', label: 'Reuniões / Leads indicados', unit: 'un.' },
];

const emptyForm = { name: '', email: '', phone: '', company: '', notes: '', password: '', state: '' };
const emptyCampaign = { month: new Date().toISOString().slice(0, 7), kpi_type: 'credito_producao', kpi_target: '', prize_description: '', prize_value: '', description: '' };

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
        style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
        onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
        onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
      />
    </div>
  );
}

function FinderCard({ finder, isMaster, onEdit, onDelete, onResetPw, onToggleActive }) {
  const initials = finder.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

  return (
    <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
      <div className="p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center font-serif font-bold text-lg text-white flex-shrink-0 overflow-hidden"
          style={{ backgroundColor: finder.active ? '#355641' : '#9ca3af' }}>
          {finder.photoUrl
            ? <img src={finder.photoUrl} alt={finder.name} className="w-full h-full object-cover" />
            : initials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-serif font-bold" style={{ color: 'var(--text-primary)' }}>{finder.name}</p>
            {!finder.active && (
              <span className="px-2 py-0.5 rounded-full text-xs font-sans font-bold" style={{ backgroundColor: 'rgba(156,163,175,0.12)', color: '#9ca3af' }}>
                Inativo
              </span>
            )}
          </div>
          <p className="font-sans text-xs" style={{ color: 'var(--text-muted)' }}>{finder.email}</p>
          {finder.phone && <p className="font-sans text-xs" style={{ color: 'var(--text-hint)' }}>{finder.phone}</p>}
          {isMaster && finder.consultant_name && (
            <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Consultor: {finder.consultant_name}</p>
          )}
        </div>
        <div className="text-center flex-shrink-0">
          <p className="font-serif font-bold text-xl" style={{ color: 'var(--text-primary)' }}>{finder.lead_count || 0}</p>
          <p className="font-sans text-xs" style={{ color: 'var(--text-muted)' }}>leads</p>
        </div>
      </div>

      {!isMaster && (
        <div className="px-5 pb-4 flex flex-wrap gap-2">
          <button onClick={onEdit} className="px-3 py-1.5 rounded-lg font-sans text-xs font-semibold transition-all"
            style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}>
            ✏️ Editar
          </button>
          <button onClick={onResetPw} className="px-3 py-1.5 rounded-lg font-sans text-xs font-semibold transition-all"
            style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}>
            🔑 Senha
          </button>
          <button onClick={onToggleActive} className="px-3 py-1.5 rounded-lg font-sans text-xs font-semibold transition-all"
            style={{
              backgroundColor: finder.active ? 'rgba(220,38,38,0.08)' : 'rgba(22,163,74,0.08)',
              color: finder.active ? '#dc2626' : '#16a34a',
              border: `1px solid ${finder.active ? '#fca5a5' : '#86efac'}`,
            }}>
            {finder.active ? 'Desativar' : 'Ativar'}
          </button>
          <button onClick={onDelete} className="px-3 py-1.5 rounded-lg font-sans text-xs font-semibold transition-all"
            style={{ backgroundColor: 'rgba(220,38,38,0.08)', color: '#dc2626', border: '1px solid #fca5a5' }}>
            🗑️ Excluir
          </button>
        </div>
      )}
    </div>
  );
}

function CampaignSection({ isMaster }) {
  const api = useAPI();
  const { toast } = useToast();
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyCampaign);
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const currentMonth = new Date().toISOString().slice(0, 7);

  useEffect(() => { loadCampaigns(); }, []);

  async function loadCampaigns() {
    try {
      setCampaigns(await api.getFinderCampaigns());
    } catch { } finally { setLoading(false); }
  }

  function openModal(existing) {
    if (existing) {
      setForm({ month: existing.month, kpi_type: existing.kpi_type, kpi_target: existing.kpi_target, prize_description: existing.prize_description, prize_value: existing.prize_value || '', description: existing.description || '' });
    } else {
      setForm({ ...emptyCampaign, month: currentMonth });
    }
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await api.createFinderCampaign(form);
      toast.success('Campanha salva');
      setShowModal(false);
      loadCampaigns();
    } catch (err) { toast.error(err.message || 'Erro'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    try {
      await api.deleteFinderCampaign(confirmDel.id);
      toast.success('Campanha excluída');
      setConfirmDel(null);
      loadCampaigns();
    } catch (err) { toast.error(err.message || 'Erro'); }
  }

  const cf = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const currentKpi = KPI_OPTIONS.find(k => k.value === form.kpi_type) || KPI_OPTIONS[0];
  const currentCampaign = campaigns.find(c => c.month === currentMonth);
  const pastCampaigns = campaigns.filter(c => c.month !== currentMonth);

  const fmtMonth = (m) => {
    const [y, mo] = m.split('-');
    return new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const fmtPrize = (c) => c.prize_value > 0
    ? `R$ ${Number(c.prize_value).toLocaleString('pt-BR')} — ${c.prize_description}`
    : c.prize_description;

  return (
    <div className="mb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <h2 className="font-serif font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Campanha de Premiação</h2>
        </div>
        {!isMaster && (
          <button onClick={() => openModal(currentCampaign)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-sans text-xs font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#355641' }}>
            {currentCampaign ? '✏️ Editar mês atual' : '+ Nova campanha'}
          </button>
        )}
      </div>

      {/* Current month campaign card */}
      {loading ? (
        <div className="h-24 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--bg-card)' }} />
      ) : currentCampaign ? (
        <div className="rounded-2xl border p-5 mb-4 relative overflow-hidden"
          style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
          <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-5" style={{ backgroundColor: '#f59e0b', transform: 'translate(25%,-25%)' }} />
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xl">🏆</span>
                <span className="font-sans text-xs font-bold uppercase tracking-wider" style={{ color: '#f59e0b' }}>
                  {fmtMonth(currentCampaign.month)} — Campanha Ativa
                </span>
              </div>
              <p className="font-serif font-bold text-xl mb-1" style={{ color: 'var(--text-primary)' }}>{currentCampaign.prize_description}</p>
              {currentCampaign.prize_value > 0 && (
                <p className="font-sans text-sm font-semibold" style={{ color: '#355641' }}>
                  Valor: R$ {Number(currentCampaign.prize_value).toLocaleString('pt-BR')}
                </p>
              )}
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="px-2.5 py-1 rounded-full font-sans text-xs font-bold"
                  style={{ backgroundColor: 'rgba(37,99,235,0.10)', color: '#2563eb' }}>
                  {KPI_OPTIONS.find(k => k.value === currentCampaign.kpi_type)?.label}
                </span>
                {currentCampaign.kpi_target > 0 && (
                  <span className="font-sans text-xs" style={{ color: 'var(--text-muted)' }}>
                    Meta: {currentCampaign.kpi_type === 'credito_producao'
                      ? `R$ ${Number(currentCampaign.kpi_target).toLocaleString('pt-BR')}`
                      : `${currentCampaign.kpi_target} leads`}
                  </span>
                )}
              </div>
              {currentCampaign.description && (
                <p className="font-sans text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{currentCampaign.description}</p>
              )}
            </div>
            {!isMaster && (
              <button onClick={() => setConfirmDel(currentCampaign)}
                className="text-xs font-sans text-gray-400 hover:text-red-500 transition-colors flex-shrink-0">
                🗑️
              </button>
            )}
          </div>
        </div>
      ) : !isMaster ? (
        <button onClick={() => openModal(null)}
          className="w-full rounded-2xl border-2 border-dashed p-6 text-center transition-all hover:opacity-80"
          style={{ borderColor: 'var(--border-card)' }}>
          <p className="font-sans text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma campanha em {fmtMonth(currentMonth)}</p>
          <p className="font-sans text-xs mt-1" style={{ color: 'var(--text-hint)' }}>Clique para criar uma premiação para seus finders</p>
        </button>
      ) : (
        <div className="rounded-2xl border p-6 text-center" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
          <p className="font-sans text-sm" style={{ color: 'var(--text-muted)' }}>Nenhuma campanha ativa este mês</p>
        </div>
      )}

      {/* Past campaigns */}
      {pastCampaigns.length > 0 && (
        <div>
          <p className="font-sans text-xs font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Histórico</p>
          <div className="space-y-2">
            {pastCampaigns.slice(0, 3).map(c => (
              <div key={c._id} className="rounded-xl border px-4 py-3 flex items-center justify-between gap-3"
                style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
                <div>
                  <span className="font-sans text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>{fmtMonth(c.month)}</span>
                  <span className="font-sans text-xs mx-2" style={{ color: 'var(--text-hint)' }}>•</span>
                  <span className="font-sans text-xs" style={{ color: 'var(--text-primary)' }}>{fmtPrize(c)}</span>
                </div>
                {!isMaster && (
                  <button onClick={() => setConfirmDel(c)} className="text-xs text-gray-300 hover:text-red-500 transition-colors">🗑️</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Campanha de Premiação">
        <form onSubmit={handleSave} className="space-y-4">
          {/* Month */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
              Mês da campanha <span className="text-red-500">*</span>
            </label>
            <input type="month" value={form.month} onChange={e => cf('month', e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* KPI type */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
              Métrica / KPI <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {KPI_OPTIONS.map(opt => (
                <button key={opt.value} type="button" onClick={() => cf('kpi_type', opt.value)}
                  className="px-3 py-3 rounded-xl border font-sans text-xs font-semibold text-left transition-all"
                  style={{
                    backgroundColor: form.kpi_type === opt.value ? 'rgba(53,86,65,0.08)' : 'var(--bg-page)',
                    borderColor: form.kpi_type === opt.value ? '#355641' : 'var(--border-card)',
                    color: form.kpi_type === opt.value ? '#355641' : 'var(--text-muted)',
                  }}>
                  <span className="block font-bold">{opt.unit === 'R$' ? '💰' : '🤝'} {opt.unit}</span>
                  <span className="block text-xs mt-0.5 opacity-70">{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* KPI target */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
              Meta ({currentKpi.unit})
            </label>
            <input type="number" value={form.kpi_target} onChange={e => cf('kpi_target', e.target.value)}
              placeholder={currentKpi.unit === 'R$' ? 'Ex: 500000' : 'Ex: 10'}
              min="0" step={currentKpi.unit === 'R$' ? '1000' : '1'}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
              onFocus={e => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; }}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>

          {/* Prize */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
                Premiação <span className="text-red-500">*</span>
              </label>
              <input type="text" value={form.prize_description} onChange={e => cf('prize_description', e.target.value)}
                placeholder="Ex: Viagem para Cancún, iPhone 16, R$ 2.000..."
                className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
                style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
                onFocus={e => { e.target.style.borderColor = '#dd7752'; e.target.style.boxShadow = '0 0 0 3px rgba(221,119,82,0.12)'; }}
                onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <InputField label="Valor da premiação (R$)" type="number" value={form.prize_value}
              onChange={v => cf('prize_value', v)} placeholder="Ex: 8000" />
          </div>

          {/* Description */}
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Descrição</label>
            <textarea rows={2} value={form.description} onChange={e => cf('description', e.target.value)}
              placeholder="Regras, detalhes ou mensagem motivacional..."
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }}
            />
          </div>

          {/* Preview */}
          {form.prize_description && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
              <p className="font-sans text-xs font-bold uppercase tracking-wider mb-1" style={{ color: '#f59e0b' }}>Preview do card</p>
              <p className="font-serif font-bold" style={{ color: 'var(--text-primary)' }}>🏆 {form.prize_description}</p>
              {form.prize_value && <p className="font-sans text-xs mt-0.5" style={{ color: '#355641' }}>R$ {Number(form.prize_value).toLocaleString('pt-BR')}</p>}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-xl font-sans text-sm font-semibold"
              style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 transition-all"
              style={{ backgroundColor: '#dd7752' }}>
              {saving ? 'Salvando...' : 'Salvar Campanha'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDel}
        title="Excluir Campanha"
        message={`Excluir campanha de ${confirmDel ? fmtMonth(confirmDel.month) : ''}?`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDel(null)}
      />
    </div>
  );
}

export default function Finder() {
  const api = useAPI();
  const { user, isMaster } = useAuth();
  const { toast } = useToast();
  const finders = useFinders();
  const loading = finders === undefined;
  const [showCreate, setShowCreate] = useState(false);
  const [editFinder, setEditFinder] = useState(null);
  const [resetPwFinder, setResetPwFinder] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);

  function openCreate() { setForm(emptyForm); setShowCreate(true); }
  function openEdit(f) { setForm({ name: f.name, email: f.email, phone: f.phone || '', company: f.company || '', notes: f.notes || '', password: '', state: f.state || '' }); setEditFinder(f); }

  async function handleCreate(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.password) return;
    setSaving(true);
    try {
      await api.createFinder(form);
      toast.success('Finder criado com sucesso');
      setShowCreate(false);
    } catch (err) { toast.error(err.message || 'Erro'); }
    finally { setSaving(false); }
  }

  async function handleEdit(e) {
    e.preventDefault();
    if (!editFinder) return;
    setSaving(true);
    try {
      await api.updateFinder(editFinder._id, { name: form.name, email: form.email, phone: form.phone, company: form.company, notes: form.notes, state: form.state });
      toast.success('Finder atualizado');
      setEditFinder(null);
    } catch (err) { toast.error(err.message || 'Erro'); }
    finally { setSaving(false); }
  }

  async function handleResetPw(e) {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) { toast.error('Senha deve ter ao menos 6 caracteres'); return; }
    setSaving(true);
    try {
      await api.resetFinderPassword(resetPwFinder._id, newPassword);
      toast.success('Senha redefinida');
      setResetPwFinder(null);
      setNewPassword('');
    } catch (err) { toast.error(err.message || 'Erro'); }
    finally { setSaving(false); }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await api.deleteFinder(confirmDelete._id);
      toast.success('Finder excluído');
      setConfirmDelete(null);
    } catch (err) { toast.error(err.message || 'Erro'); }
  }

  async function handleToggleActive(finder) {
    try {
      await api.updateFinder(finder._id, { active: finder.active ? 0 : 1 });
      toast.success(finder.active ? 'Finder desativado' : 'Finder ativado');
    } catch (err) { toast.error(err.message || 'Erro'); }
  }

  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const myFinders = isMaster ? finders : finders.filter(fi => fi.consultantId === user?._id);

  return (
    <div className="p-8" style={{ backgroundColor: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full" style={{ backgroundColor: '#dd7752' }} />
            <h1 className="font-serif font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>
              {isMaster ? 'Finders — Visão Geral' : 'Meus Finders'}
            </h1>
          </div>
          <p className="font-sans text-sm ml-4" style={{ color: 'var(--text-muted)' }}>
            {isMaster ? 'Parceiros indicadores de todos os consultores' : 'Gerencie seus parceiros indicadores de leads'}
          </p>
        </div>
        {!isMaster && (
          <button onClick={openCreate}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90"
            style={{ backgroundColor: '#dd7752' }}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Finder
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Total de Finders', value: myFinders.length, color: '#dd7752' },
          { label: 'Finders Ativos', value: myFinders.filter(fi => fi.active).length, color: '#355641' },
          { label: 'Leads Indicados', value: myFinders.reduce((s, fi) => s + parseInt(fi.lead_count || 0), 0), color: '#7c3aed' },
        ].map(stat => (
          <div key={stat.label} className="rounded-2xl border p-5 flex items-center gap-4" style={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-card)' }}>
            <div className="w-1.5 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: stat.color }} />
            <div>
              <p className="font-serif font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>{stat.value}</p>
              <p className="font-sans text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Campaign section */}
      {!isMaster && <CampaignSection isMaster={isMaster} />}

      {/* Portal link info */}
      {!isMaster && (
        <div className="rounded-xl border p-4 mb-6 flex items-start gap-3" style={{ backgroundColor: 'rgba(221,119,82,0.06)', borderColor: 'rgba(221,119,82,0.25)' }}>
          <span className="text-xl flex-shrink-0">🔗</span>
          <div>
            <p className="font-sans text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Portal do Finder</p>
            <p className="font-sans text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              Compartilhe o link abaixo com seus parceiros para que eles façam login e indiquem leads:
            </p>
            <code className="text-xs mt-1 inline-block px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)' }}>
              {window.location.origin}/finder-login
            </code>
          </div>
        </div>
      )}

      {/* Finders grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-36 rounded-2xl animate-pulse" style={{ backgroundColor: 'var(--bg-card)' }} />)}
        </div>
      ) : myFinders.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🤝</div>
          <p className="font-serif font-bold text-lg" style={{ color: 'var(--text-primary)' }}>Nenhum finder cadastrado</p>
          <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {isMaster ? 'Os consultores ainda não cadastraram finders.' : 'Cadastre seu primeiro parceiro indicador.'}
          </p>
          {!isMaster && (
            <button onClick={openCreate} className="mt-4 px-5 py-2.5 rounded-xl font-sans text-sm font-semibold text-white" style={{ backgroundColor: '#dd7752' }}>
              Criar Finder
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {myFinders.map(finder => (
            <FinderCard
              key={finder._id}
              finder={finder}
              isMaster={isMaster}
              onEdit={() => openEdit(finder)}
              onDelete={() => setConfirmDelete(finder)}
              onResetPw={() => { setResetPwFinder(finder); setNewPassword(''); }}
              onToggleActive={() => handleToggleActive(finder)}
            />
          ))}
        </div>
      )}

      {/* Modal criar */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Novo Finder">
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Nome" value={form.name} onChange={v => f('name', v)} required />
            <InputField label="Email" type="email" value={form.email} onChange={v => f('email', v)} required />
            <InputField label="Telefone" value={form.phone} onChange={v => f('phone', maskPhone(v))} placeholder="(11) 91234-5678" />
            <InputField label="Empresa" value={form.company} onChange={v => f('company', v)} />
            <StateSelect value={form.state} onChange={v => f('state', v)} />
          </div>
          <InputField label="Senha inicial" type="password" value={form.password} onChange={v => f('password', v)} required placeholder="Mínimo 6 caracteres" />
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Observações</label>
            <textarea value={form.notes || ''} onChange={e => f('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-xl font-sans text-sm font-semibold"
              style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white" style={{ backgroundColor: '#dd7752' }}>
              {saving ? 'Criando...' : 'Criar Finder'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal editar */}
      <Modal open={!!editFinder} onClose={() => setEditFinder(null)} title="Editar Finder">
        <form onSubmit={handleEdit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <InputField label="Nome" value={form.name} onChange={v => f('name', v)} required />
            <InputField label="Email" type="email" value={form.email} onChange={v => f('email', v)} required />
            <InputField label="Telefone" value={form.phone} onChange={v => f('phone', maskPhone(v))} placeholder="(11) 91234-5678" />
            <InputField label="Empresa" value={form.company} onChange={v => f('company', v)} />
            <StateSelect value={form.state} onChange={v => f('state', v)} />
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Observações</label>
            <textarea value={form.notes || ''} onChange={e => f('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none"
              style={{ color: 'var(--text-primary)', backgroundColor: 'var(--bg-card)' }} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setEditFinder(null)} className="px-4 py-2 rounded-xl font-sans text-sm font-semibold"
              style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white" style={{ backgroundColor: '#355641' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal redefinir senha */}
      <Modal open={!!resetPwFinder} onClose={() => setResetPwFinder(null)} title={`Redefinir senha — ${resetPwFinder?.name}`}>
        <form onSubmit={handleResetPw} className="space-y-4">
          <InputField label="Nova Senha" type="password" value={newPassword} onChange={setNewPassword} required placeholder="Mínimo 6 caracteres" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setResetPwFinder(null)} className="px-4 py-2 rounded-xl font-sans text-sm font-semibold"
              style={{ backgroundColor: 'var(--bg-page)', color: 'var(--text-primary)', border: '1px solid var(--border-card)' }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white" style={{ backgroundColor: '#355641' }}>
              {saving ? 'Salvando...' : 'Redefinir Senha'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!confirmDelete}
        title="Excluir Finder"
        message={`Excluir "${confirmDelete?.name}"? Esta ação não pode ser desfeita.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
