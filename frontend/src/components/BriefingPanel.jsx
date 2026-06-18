import React, { useState, useEffect } from 'react';
import useAPI from '../hooks/useAPI.js';

export default function BriefingPanel({ contact, onUpdate }) {
  const api = useAPI();
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(contact?.notes || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setNotes(contact?.notes || ''); }, [contact]);

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateBriefing(contact.id, notes);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      if (onUpdate) onUpdate({ ...contact, notes });
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="border border-brand-gray rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-cream hover:bg-brand-gray/30 transition-colors"
      >
        <span className="font-sans font-bold text-sm text-charcoal flex items-center gap-2">
          📋 Briefing & Notas
        </span>
        <svg className={`w-4 h-4 text-charcoal/50 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="p-4 border-t border-brand-gray">
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={5}
            placeholder="Adicione notas, briefing e observações sobre o contato..."
            className="input-field resize-none"
          />
          <div className="flex items-center justify-between mt-2">
            <span className="text-xs text-charcoal/40">{notes.length} caracteres</span>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary text-sm px-3 py-1.5"
            >
              {saving ? 'Salvando...' : saved ? '✓ Salvo' : 'Salvar'}
            </button>
          </div>

          {/* Activity History */}
          {contact?.activities?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-brand-gray">
              <p className="text-xs font-bold uppercase tracking-wide text-charcoal/50 mb-3">Histórico</p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {contact.activities.map(a => (
                  <div key={a.id} className="flex gap-2 text-xs">
                    <span className="text-charcoal/40 whitespace-nowrap">
                      {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-charcoal">{a.description}</span>
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
