import React, { useState, useEffect } from 'react';
import useAPI from '../hooks/useAPI.js';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];

export default function CalendarWidget({ contactId }) {
  const api = useAPI();
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState([]);
  const [calStatus, setCalStatus] = useState({ connected: false });
  const [today] = useState(new Date());
  const [current, setCurrent] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [creating, setCreating] = useState(null); // date string
  const [form, setForm] = useState({ title: '', description: '', start_time: '', end_time: '' });

  useEffect(() => {
    if (!open) return;
    api.getCalendarStatus().then(setCalStatus).catch(() => {});
    loadEvents();
  }, [open, contactId]);

  async function loadEvents() {
    try {
      const params = contactId ? { contact_id: contactId } : {};
      const evs = await api.getEvents(params);
      setEvents(evs);
    } catch {}
  }

  const firstDay = new Date(current.year, current.month, 1).getDay();
  const daysInMonth = new Date(current.year, current.month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function getEventsForDay(day) {
    if (!day) return [];
    const dateStr = `${current.year}-${String(current.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return events.filter(e => e.start_time && e.start_time.startsWith(dateStr));
  }

  function startCreating(day) {
    const dateStr = `${current.year}-${String(current.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    setCreating(dateStr);
    setForm({ title: '', description: '', start_time: `${dateStr}T09:00`, end_time: `${dateStr}T10:00` });
  }

  async function submitEvent(e) {
    e.preventDefault();
    try {
      await api.createEvent({ ...form, contact_id: contactId });
      setCreating(null);
      loadEvents();
    } catch (err) {
      alert('Erro ao criar evento: ' + err.message);
    }
  }

  return (
    <div className="border border-brand-gray rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-cream hover:bg-brand-gray/30 transition-colors"
      >
        <span className="font-sans font-bold text-sm text-charcoal flex items-center gap-2">
          📅 Agenda
          {calStatus.connected && <span className="text-xs bg-green/10 text-green px-2 py-0.5 rounded-full">Google conectado</span>}
        </span>
        <svg className={`w-4 h-4 text-charcoal/50 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="p-4 border-t border-brand-gray">
          {/* Navigation */}
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCurrent(c => { const d = new Date(c.year, c.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
              className="p-1 rounded hover:bg-cream">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <span className="font-serif text-sm">{MONTHS[current.month]} {current.year}</span>
            <button onClick={() => setCurrent(c => { const d = new Date(c.year, c.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })}
              className="p-1 rounded hover:bg-cream">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS.map(d => <div key={d} className="text-center text-xs text-charcoal/40 py-1">{d}</div>)}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isToday = day && current.year === today.getFullYear() && current.month === today.getMonth() && day === today.getDate();
              return (
                <div
                  key={i}
                  onClick={() => day && startCreating(day)}
                  className={`min-h-[40px] p-1 rounded text-center cursor-pointer transition-colors ${
                    day ? 'hover:bg-cream' : ''
                  } ${isToday ? 'bg-copper/10 font-bold' : ''}`}
                >
                  {day && (
                    <>
                      <span className={`text-xs ${isToday ? 'text-copper' : 'text-charcoal/70'}`}>{day}</span>
                      {dayEvents.slice(0,2).map(ev => (
                        <div key={ev.id} className="text-xs bg-green/20 text-green rounded px-0.5 truncate mt-0.5">{ev.title}</div>
                      ))}
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Create event form */}
          {creating && (
            <form onSubmit={submitEvent} className="mt-4 pt-4 border-t border-brand-gray space-y-2">
              <p className="text-xs font-bold text-charcoal/60 uppercase">Novo evento — {creating}</p>
              <input
                required
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Título do evento"
                className="input-field text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Início</label>
                  <input type="datetime-local" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} className="input-field text-sm" />
                </div>
                <div>
                  <label className="label">Fim</label>
                  <input type="datetime-local" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} className="input-field text-sm" />
                </div>
              </div>
              <textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Descrição (opcional)"
                rows={2}
                className="input-field text-sm resize-none"
              />
              <div className="flex gap-2">
                <button type="submit" className="btn-primary text-sm flex-1">Criar evento</button>
                <button type="button" onClick={() => setCreating(null)} className="btn-secondary text-sm flex-1">Cancelar</button>
              </div>
            </form>
          )}

          {/* Upcoming events */}
          {events.length > 0 && (
            <div className="mt-4 pt-4 border-t border-brand-gray">
              <p className="text-xs font-bold uppercase tracking-wide text-charcoal/50 mb-2">Próximos eventos</p>
              <div className="space-y-1">
                {events.slice(0, 5).map(ev => (
                  <div key={ev.id} className="flex items-start gap-2 text-xs">
                    <span className="text-charcoal/40 whitespace-nowrap">
                      {ev.start_time ? new Date(ev.start_time).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : ''}
                    </span>
                    <span className="text-charcoal truncate">{ev.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
