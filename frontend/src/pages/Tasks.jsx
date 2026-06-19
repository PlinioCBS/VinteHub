import React, { useState, useEffect } from 'react';
import useAPI from '../hooks/useAPI.js';
import { useTasks, useContacts } from '../hooks/useConvexData.js';
import Modal from '../components/Modal.jsx';
import ConfirmDialog from '../components/ConfirmDialog.jsx';
import { useToast } from '../contexts/ToastContext.jsx';

const PRIORITIES = ['high', 'medium', 'low'];
const PRIORITY_LABELS = { high: 'Alta', medium: 'Média', low: 'Baixa' };
const PRIORITY_COLORS = { high: '#ef4444', medium: '#eab308', low: '#355641' };
const PRIORITY_BG = { high: 'rgba(220,38,38,0.08)', medium: 'rgba(234,179,8,0.08)', low: 'rgba(22,163,74,0.08)' };
const STATUSES = ['pending', 'in_progress', 'completed'];
const STATUS_LABELS = { pending: 'Pendente', in_progress: 'Em andamento', completed: 'Concluída' };

const emptyForm = { title: '', description: '', contactId: '', dueDate: '', priority: 'medium', status: 'pending' };

function PriorityDot({ priority }) {
  return <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[priority] }} />;
}

function PriorityBadge({ priority }) {
  return (
    <span
      className="font-sans text-xs px-2 py-0.5 rounded-full font-bold"
      style={{ backgroundColor: PRIORITY_BG[priority], color: PRIORITY_COLORS[priority] }}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

function TaskFormModal({ open, onClose, initial, contacts, onSuccess }) {
  const api = useAPI();
  const { toast } = useToast();
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(initial ? {
        ...emptyForm,
        ...initial,
        contactId: initial.contactId || '',
        dueDate: initial.dueDate || '',
        description: initial.description || '',
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
        title: form.title,
        description: form.description || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
        status: form.status,
        contactId: form.contactId || undefined,
      };
      if (initial?._id) {
        await api.updateTask(initial._id, payload);
        toast.success('Tarefa atualizada');
      } else {
        await api.createTask(payload);
        toast.success('Tarefa criada');
      }
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Erro ao salvar tarefa');
    } finally {
      setSaving(false);
    }
  }

  const inputStyle = (hasError) => ({
    borderColor: hasError ? '#ef4444' : '#d9d9d6',
    color: 'var(--text-primary)'
  });
  const focusHandler = (e) => { e.target.style.borderColor = '#355641'; e.target.style.boxShadow = '0 0 0 3px #35564115'; };
  const blurHandler = (hasError) => (e) => { e.target.style.borderColor = hasError ? '#ef4444' : '#d9d9d6'; e.target.style.boxShadow = 'none'; };

  return (
    <Modal open={open} onClose={onClose} title={initial?._id ? 'Editar Tarefa' : 'Nova Tarefa'} size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Título <span className="text-red-500">*</span></label>
          <input
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border font-sans text-sm outline-none transition-all"
            style={inputStyle(errors.title)}
            onFocus={focusHandler}
            onBlur={blurHandler(errors.title)}
          />
          {errors.title && <p className="text-xs text-red-500 mt-1">{errors.title}</p>}
        </div>

        <div>
          <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Descrição</label>
          <textarea
            rows={2}
            value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none resize-none transition-all"
            style={{ color: 'var(--text-primary)' }}
            onFocus={focusHandler}
            onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Contato</label>
            <select
              value={form.contactId}
              onChange={e => setForm(f => ({ ...f, contactId: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
              style={{ color: 'var(--text-primary)' }}
            >
              <option value="">Nenhum</option>
              {contacts.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Prazo</label>
            <input
              type="date"
              value={form.dueDate}
              onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all"
              style={{ color: 'var(--text-primary)' }}
              onFocus={focusHandler}
              onBlur={e => { e.target.style.borderColor = '#d9d9d6'; e.target.style.boxShadow = 'none'; }}
            />
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Prioridade</label>
            <div className="flex gap-2">
              {PRIORITIES.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, priority: p }))}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl border font-sans text-xs font-medium transition-all"
                  style={{
                    borderColor: form.priority === p ? PRIORITY_COLORS[p] : '#d9d9d6',
                    backgroundColor: form.priority === p ? PRIORITY_BG[p] : 'var(--bg-card)',
                    color: form.priority === p ? PRIORITY_COLORS[p] : '#9ca3af',
                  }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIORITY_COLORS[p] }} />
                  {PRIORITY_LABELS[p]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">Status</label>
            <select
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
              style={{ color: 'var(--text-primary)' }}
            >
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <button type="button" onClick={onClose} className="px-5 py-2 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">Cancelar</button>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-2"
            style={{ backgroundColor: '#355641' }}
          >
            {saving ? (
              <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Salvando...</>
            ) : (initial?.id ? 'Salvar alterações' : 'Criar tarefa')}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function Tasks() {
  const api = useAPI();
  const { toast } = useToast();
  const allTasks = useTasks();
  const contacts = useContacts();
  const loading = allTasks === undefined;
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [formModal, setFormModal] = useState({ open: false, task: null });
  const [confirmDelete, setConfirmDelete] = useState({ open: false, id: null, title: '' });
  const [toggling, setToggling] = useState(null);

  const today = new Date().toISOString().split('T')[0];

  const tasks = (allTasks ?? []).filter(t => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  async function handleToggle(task) {
    setToggling(task._id);
    try {
      const newStatus = task.status === 'completed' ? 'pending' : 'completed';
      await api.updateTask(task._id, { status: newStatus });
    } catch (e) { console.error(e); } finally { setToggling(null); }
  }

  async function handleDelete() {
    try {
      await api.deleteTask(confirmDelete.id);
      toast.success('Tarefa excluída');
      setConfirmDelete({ open: false, id: null, title: '' });
    } catch (err) {
      toast.error(err.message || 'Erro ao excluir');
    }
  }

  const pending = tasks.filter(t => t.status === 'pending' || t.status === 'in_progress');
  const completed = tasks.filter(t => t.status === 'completed');
  const overdue = pending.filter(t => t.dueDate && t.dueDate < today);

  const filterButtons = [
    { value: '', label: 'Todas' },
    { value: 'pending', label: 'Pendentes' },
    { value: 'completed', label: 'Concluídas' },
  ];

  return (
    <div className="p-8" style={{ backgroundColor: 'var(--bg-page)', minHeight: '100vh' }}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Tarefas</h1>
          <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>
            {pending.length} pendentes
            {overdue.length > 0 && <span className="text-red-500 font-bold"> · {overdue.length} atrasadas</span>}
            {' '}· {completed.length} concluídas
          </p>
        </div>
        <button
          onClick={() => setFormModal({ open: true, task: null })}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 transition-all"
          style={{ backgroundColor: '#355641' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Nova Tarefa
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6 flex-wrap">
        <div className="flex rounded-xl border overflow-hidden" style={{ borderColor: '#d9d9d6' }}>
          {filterButtons.map(btn => (
            <button
              key={btn.value}
              onClick={() => setFilterStatus(btn.value)}
              className="px-4 py-2 font-sans text-sm font-medium transition-all"
              style={{
                backgroundColor: filterStatus === btn.value ? '#355641' : 'var(--bg-card)',
                color: filterStatus === btn.value ? 'white' : '#353535',
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <select
          value={filterPriority}
          onChange={e => setFilterPriority(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none bg-white"
          style={{ color: 'var(--text-primary)' }}
        >
          <option value="">Todas as prioridades</option>
          {PRIORITIES.map(p => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-white rounded-xl h-16 animate-pulse" />)}</div>
      ) : tasks.length === 0 ? (
        <div className="bg-white rounded-2xl border p-12 text-center" style={{ borderColor: '#d9d9d6' }}>
          <svg className="w-10 h-10 text-gray-200 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
          <p className="font-sans text-sm text-gray-400">Nenhuma tarefa encontrada</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map(task => {
            const isOverdue = (task.status === 'pending' || task.status === 'in_progress') && task.dueDate && task.dueDate < today;
            const isDone = task.status === 'completed';
            return (
              <div
                key={task._id}
                className="bg-white rounded-xl border flex items-center gap-4 p-4 transition-all"
                style={{
                  borderColor: isOverdue ? '#fca5a5' : '#d9d9d6',
                  backgroundColor: isOverdue ? 'rgba(220,38,38,0.06)' : isDone ? 'var(--bg-page)' : 'var(--bg-card)',
                  opacity: isDone ? 0.7 : 1
                }}
              >
                {/* Toggle circle */}
                <button
                  onClick={() => handleToggle(task)}
                  disabled={toggling === task._id}
                  className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: isDone ? '#355641' : 'transparent',
                    borderColor: isDone ? '#355641' : '#d9d9d6',
                  }}
                >
                  {isDone && (
                    <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                  )}
                </button>

                <PriorityDot priority={task.priority} />

                <div className="flex-1 min-w-0">
                  <p className={`font-sans font-bold text-sm ${isDone ? 'line-through text-gray-400' : ''}`} style={{ color: isDone ? undefined : 'var(--text-primary)' }}>
                    {task.title}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {task.description && <span className="font-sans text-xs text-gray-400 truncate max-w-xs">{task.description}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3 flex-shrink-0">
                  {task.dueDate && (
                    <p className={`font-sans text-xs font-bold ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                      {isOverdue && '⚠ '}
                      {new Date(task.dueDate + 'T00:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </p>
                  )}
                  <PriorityBadge priority={task.priority} />
                </div>

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => setFormModal({ open: true, task })}
                    className="p-1.5 rounded-lg transition-colors hover:bg-gray-100"
                    title="Editar"
                  >
                    <svg className="w-4 h-4 text-gray-300 hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  </button>
                  <button
                    onClick={() => setConfirmDelete({ open: true, id: task._id, title: task.title })}
                    className="p-1.5 rounded-lg transition-colors hover:bg-red-50"
                    title="Excluir"
                  >
                    <svg className="w-4 h-4 text-gray-300 hover:text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <TaskFormModal
        open={formModal.open}
        onClose={() => setFormModal({ open: false, task: null })}
        initial={formModal.task}
        contacts={contacts}
        onSuccess={() => {}}
      />

      <ConfirmDialog
        open={confirmDelete.open}
        title="Excluir tarefa"
        message={`Tem certeza que deseja excluir "${confirmDelete.title}"? Esta ação não pode ser desfeita.`}
        confirmText="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete({ open: false, id: null, title: '' })}
      />
    </div>
  );
}
