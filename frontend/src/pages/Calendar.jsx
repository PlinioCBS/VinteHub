import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import api from '../api.js';
import Modal from '../components/Modal.jsx';

const MONTHS = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
const DAYS_HEADER = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
const DURATIONS = [
  { label: '30 min', minutes: 30 },
  { label: '1 hora', minutes: 60 },
  { label: '1h30', minutes: 90 },
  { label: '2 horas', minutes: 120 }
];

export default function Calendar() {
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [calStatus, setCalStatus] = useState({ connected: false, configured: false });
  const [today] = useState(new Date());
  const [current, setCurrent] = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [selectedDay, setSelectedDay] = useState(null);
  const [creating, setCreating] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState({ title:'', description:'', date:'', time:'09:00', duration:60, contact_id:'' });

  useEffect(() => {
    loadStatus();
    loadEvents();
    api.getContacts().then(setContacts).catch(() => {});
    if (searchParams.get('calendar') === 'connected') {
      alert('Google Calendar conectado com sucesso!');
    }
  }, []);

  async function loadStatus() {
    try { setCalStatus(await api.getCalendarStatus()); } catch {}
  }

  async function loadEvents() {
    try {
      const evs = await api.getEvents();
      setEvents(evs);
    } catch {}
  }

  async function connectGoogle() {
    try {
      const { url } = await api.getCalendarAuthUrl();
      window.location.href = url;
    } catch (e) { alert('Erro ao gerar URL: ' + e.message); }
  }

  async function disconnectGoogle() {
    if (!confirm('Desconectar Google Calendar?')) return;
    await api.disconnectCalendar();
    setCalStatus(s => ({ ...s, connected: false }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    try {
      const start = new Date(`${form.date}T${form.time}:00`);
      const end = new Date(start.getTime() + form.duration * 60000);
      await api.createEvent({
        title: form.title,
        description: form.description,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        contact_id: form.contact_id || null
      });
      setCreating(false);
      setForm({ title:'', description:'', date:'', time:'09:00', duration:60, contact_id:'' });
      loadEvents();
    } catch (err) { alert('Erro ao criar evento: ' + err.message); }
  }

  async function handleDeleteEvent(id) {
    if (!confirm('Excluir evento?')) return;
    await api.deleteEvent(id);
    loadEvents();
  }

  // Build calendar cells
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

  function openCreateForDay(day) {
    const dateStr = `${current.year}-${String(current.month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    setForm(f => ({ ...f, date: dateStr }));
    setCreating(true);
  }

  const selectedEvents = selectedDay ? getEventsForDay(selectedDay) : [];
  const upcomingEvents = events
    .filter(e => e.start_time >= new Date().toISOString())
    .slice(0, 10);

  return (
    <div className="p-8 h-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Calendário</h1>
          <p className="text-sm text-charcoal/50 font-sans mt-1">{MONTHS[current.month]} {current.year}</p>
        </div>
        <div className="flex items-center gap-3">
          {calStatus.connected ? (
            <div className="flex items-center gap-2">
              <span className="text-sm bg-green/10 text-green px-3 py-1.5 rounded-full font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-green" />
                Google conectado
              </span>
              <button onClick={disconnectGoogle} className="btn-secondary text-sm">Desconectar</button>
            </div>
          ) : calStatus.configured ? (
            <button onClick={connectGoogle} className="btn-secondary text-sm flex items-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Conectar Google Calendar
            </button>
          ) : (
            <span className="text-xs text-charcoal/40">Configure as credenciais Google no .env</span>
          )}
          <button onClick={() => { setForm(f => ({ ...f, date: today.toISOString().split('T')[0] })); setCreating(true); }} className="btn-primary text-sm">
            + Novo Evento
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Main calendar */}
        <div className="col-span-2 card p-5">
          {/* Month navigation */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => setCurrent(c => { const d = new Date(c.year, c.month - 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="p-2 rounded-lg hover:bg-cream transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            </button>
            <h2 className="font-serif text-lg">{MONTHS[current.month]} {current.year}</h2>
            <button onClick={() => setCurrent(c => { const d = new Date(c.year, c.month + 1); return { year: d.getFullYear(), month: d.getMonth() }; })} className="p-2 rounded-lg hover:bg-cream transition-colors">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_HEADER.map(d => <div key={d} className="text-center text-xs font-bold text-charcoal/40 py-2">{d}</div>)}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, i) => {
              const dayEvents = getEventsForDay(day);
              const isToday = day && current.year === today.getFullYear() && current.month === today.getMonth() && day === today.getDate();
              const isSelected = day && selectedDay === day;
              return (
                <div
                  key={i}
                  onDoubleClick={() => day && openCreateForDay(day)}
                  onClick={() => day && setSelectedDay(day)}
                  className={`calendar-cell p-1.5 rounded-lg cursor-pointer border transition-colors ${
                    isSelected ? 'border-copper bg-copper/5' :
                    isToday ? 'border-green bg-green/5' :
                    day ? 'border-transparent hover:border-brand-gray hover:bg-cream' : 'border-transparent'
                  }`}
                >
                  {day && (
                    <>
                      <span className={`text-xs font-bold block mb-1 ${isToday ? 'text-green' : isSelected ? 'text-copper' : 'text-charcoal/70'}`}>{day}</span>
                      {dayEvents.slice(0,3).map(ev => (
                        <div key={ev.id} className="text-xs bg-green text-white rounded px-1 py-0.5 mb-0.5 truncate">{ev.title}</div>
                      ))}
                      {dayEvents.length > 3 && <div className="text-xs text-charcoal/40">+{dayEvents.length - 3}</div>}
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <p className="text-xs text-charcoal/30 mt-3 text-center">Duplo clique em um dia para criar evento</p>
        </div>

        {/* Right panel */}
        <div className="space-y-4">
          {/* Selected day events */}
          {selectedDay && (
            <div className="card p-4">
              <p className="font-serif text-sm mb-3">
                {selectedDay} de {MONTHS[current.month]}
              </p>
              {selectedEvents.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-xs text-charcoal/40">Nenhum evento</p>
                  <button onClick={() => openCreateForDay(selectedDay)} className="text-xs text-copper hover:text-brown mt-2 font-bold">+ Criar evento</button>
                </div>
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map(ev => (
                    <div key={ev.id} className="border border-brand-gray rounded-lg p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-bold text-charcoal">{ev.title}</p>
                          {ev.contact_name && <p className="text-xs text-charcoal/50">{ev.contact_name}</p>}
                          {ev.start_time && (
                            <p className="text-xs text-charcoal/40">
                              {new Date(ev.start_time).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}
                              {ev.end_time && ` – ${new Date(ev.end_time).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' })}`}
                            </p>
                          )}
                          {ev.description && <p className="text-xs text-charcoal/60 mt-1">{ev.description}</p>}
                        </div>
                        <button onClick={() => handleDeleteEvent(ev.id)} className="text-red-400 hover:text-red-600 text-xs p-1">✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Upcoming events */}
          <div className="card p-4">
            <p className="font-serif text-sm mb-3">Próximos Eventos</p>
            {upcomingEvents.length === 0 ? (
              <p className="text-xs text-charcoal/40">Nenhum evento próximo</p>
            ) : (
              <div className="space-y-2">
                {upcomingEvents.map(ev => (
                  <div key={ev.id} className="flex items-start gap-2 text-xs border-b border-brand-gray pb-2 last:border-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-copper mt-1.5 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-charcoal">{ev.title}</p>
                      <p className="text-charcoal/40">
                        {ev.start_time ? new Date(ev.start_time).toLocaleDateString('pt-BR', { day:'2-digit', month:'2-digit' }) + ' às ' + new Date(ev.start_time).toLocaleTimeString('pt-BR', { hour:'2-digit', minute:'2-digit' }) : '—'}
                      </p>
                      {ev.contact_name && <p className="text-charcoal/40">{ev.contact_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Create event modal */}
      <Modal open={creating} onClose={() => setCreating(false)} title="Novo Evento" size="md">
        <form onSubmit={handleCreate} className="space-y-4">
          <div><label className="label">Título *</label><input required value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="input-field" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="label">Data *</label><input required type="date" value={form.date} onChange={e => setForm(f => ({...f, date: e.target.value}))} className="input-field" /></div>
            <div><label className="label">Horário</label><input type="time" value={form.time} onChange={e => setForm(f => ({...f, time: e.target.value}))} className="input-field" /></div>
          </div>
          <div>
            <label className="label">Duração</label>
            <div className="flex gap-2">
              {DURATIONS.map(d => (
                <button key={d.minutes} type="button" onClick={() => setForm(f => ({...f, duration: d.minutes}))}
                  className={`flex-1 py-2 rounded-lg text-sm border transition-all ${form.duration === d.minutes ? 'bg-green text-white border-green' : 'bg-white border-brand-gray text-charcoal/70 hover:border-green'}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="label">Contato vinculado</label>
            <select value={form.contact_id} onChange={e => setForm(f => ({...f, contact_id: e.target.value}))} className="input-field">
              <option value="">Nenhum</option>
              {contacts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="label">Descrição</label><textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="input-field resize-none" /></div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setCreating(false)} className="btn-secondary flex-1">Cancelar</button>
            <button type="submit" className="btn-primary flex-1">
              Criar {calStatus.connected ? '(+ Google)' : 'evento'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
