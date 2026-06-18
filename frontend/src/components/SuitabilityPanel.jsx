import React, { useState } from 'react';
import useAPI from '../hooks/useAPI.js';
import InlineField from './InlineField.jsx';

const PROFILES = [
  { key: 'conservador', label: 'Conservador', color: 'bg-blue-100 text-blue-700 border-blue-300' },
  { key: 'moderado', label: 'Moderado', color: 'bg-yellow-100 text-yellow-700 border-yellow-300' },
  { key: 'arrojado', label: 'Arrojado', color: 'bg-orange-100 text-orange-700 border-orange-300' },
  { key: 'muito_arrojado', label: 'Muito Arrojado', color: 'bg-red-100 text-red-700 border-red-300' }
];

export default function SuitabilityPanel({ contact, onUpdate }) {
  const api = useAPI();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function updateField(field, value) {
    setSaving(true);
    try {
      const updated = await api.updateSuitability(contact.id, { [field]: value });
      if (onUpdate) onUpdate(updated);
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
          📊 Suitability & Perfil
        </span>
        <svg className={`w-4 h-4 text-charcoal/50 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="p-4 border-t border-brand-gray space-y-4">
          {/* Profile buttons */}
          <div>
            <p className="label mb-2">Perfil do Investidor</p>
            <div className="grid grid-cols-2 gap-2">
              {PROFILES.map(p => (
                <button
                  key={p.key}
                  onClick={() => updateField('investor_profile', p.key)}
                  className={`px-3 py-2 rounded-lg border text-sm font-sans font-bold transition-all ${
                    contact.investor_profile === p.key
                      ? p.color + ' border-2'
                      : 'bg-white border-brand-gray text-charcoal/50 hover:border-charcoal/40'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="label">Carteira</p>
              <InlineField
                value={contact.portfolio}
                onSave={v => updateField('portfolio', v)}
                placeholder="ex: Renda Fixa + FII"
              />
            </div>
            <div>
              <p className="label">Horizonte de Liquidez</p>
              <InlineField
                value={contact.liquidity_horizon}
                onSave={v => updateField('liquidity_horizon', v)}
                placeholder="ex: 5 anos"
              />
            </div>
            <div>
              <p className="label">Banco</p>
              <InlineField
                value={contact.bank_name}
                onSave={v => updateField('bank_name', v)}
                placeholder="Nome do banco"
              />
            </div>
            <div>
              <p className="label">Agência</p>
              <InlineField
                value={contact.bank_agency}
                onSave={v => updateField('bank_agency', v)}
                placeholder="0000"
              />
            </div>
            <div>
              <p className="label">Conta</p>
              <InlineField
                value={contact.bank_account}
                onSave={v => updateField('bank_account', v)}
                placeholder="000000-0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
