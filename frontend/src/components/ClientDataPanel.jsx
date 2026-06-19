import React, { useState } from 'react';
import useAPI from '../hooks/useAPI.js';
import InlineField from './InlineField.jsx';

export default function ClientDataPanel({ contact, onUpdate }) {
  const api = useAPI();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function savePersonal(field, value) {
    setSaving(true);
    try {
      const data = {
        address: contact.address,
        profession: contact.profession,
        monthlyIncome: contact.monthlyIncome,
        maritalStatus: contact.maritalStatus,
        birthDate: contact.birthDate,
        age: contact.age,
        [field]: value
      };
      const updated = await api.updatePersonal(contact._id, data);
      if (onUpdate) onUpdate(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  }

  const formatCurrency = (v) => v ? `R$ ${Number(v).toLocaleString('pt-BR')}` : '—';

  return (
    <div className="border border-brand-gray rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-3 bg-cream hover:bg-brand-gray/30 transition-colors"
      >
        <span className="font-sans font-bold text-sm text-charcoal flex items-center gap-2">
          👤 Dados Pessoais
        </span>
        <svg className={`w-4 h-4 text-charcoal/50 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="p-4 border-t border-brand-gray grid grid-cols-2 gap-4">
          <div>
            <p className="label">E-mail</p>
            <p className="text-sm text-charcoal">{contact.email || '—'}</p>
          </div>
          <div>
            <p className="label">Telefone</p>
            <p className="text-sm text-charcoal">{contact.phone || '—'}</p>
          </div>
          <div>
            <p className="label">Data de Nascimento</p>
            <InlineField value={contact.birthDate} onSave={v => savePersonal('birthDate', v)} type="date" />
          </div>
          <div>
            <p className="label">Idade</p>
            <InlineField value={contact.age} onSave={v => savePersonal('age', parseInt(v))} type="number" suffix=" anos" />
          </div>
          <div>
            <p className="label">Estado Civil</p>
            <InlineField value={contact.maritalStatus} onSave={v => savePersonal('maritalStatus', v)} placeholder="Não informado" />
          </div>
          <div>
            <p className="label">Profissão</p>
            <InlineField value={contact.profession} onSave={v => savePersonal('profession', v)} placeholder="Não informado" />
          </div>
          <div>
            <p className="label">Renda Mensal</p>
            <InlineField value={contact.monthlyIncome} onSave={v => savePersonal('monthlyIncome', parseFloat(v))} type="number" prefix="R$ " placeholder="0" />
          </div>
          <div className="col-span-2">
            <p className="label">Endereço</p>
            <InlineField value={contact.address} onSave={v => savePersonal('address', v)} className="w-full" placeholder="Não informado" />
          </div>
        </div>
      )}
    </div>
  );
}
