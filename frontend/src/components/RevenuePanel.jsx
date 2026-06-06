import React, { useState, useEffect } from 'react';
import api from '../api.js';
import InlineField from './InlineField.jsx';

const fmt = (v) => v?.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RevenuePanel() {
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const data = await api.getClientsRevenue();
      setRevenue(data);
    } catch {} finally { setLoading(false); }
  }

  async function saveFee(val) {
    try {
      await api.updateClientsFee(parseFloat(val));
      load();
    } catch (e) { console.error(e); }
  }

  if (loading) return <div className="card p-4 animate-pulse h-24" />;
  if (!revenue) return null;

  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      <div className="card p-5 flex flex-col gap-1">
        <p className="label">Receita Anual</p>
        <p className="font-serif text-2xl text-green">R$ {fmt(revenue.totalAnnual)}</p>
        <p className="text-xs text-charcoal/40">Fee {revenue.fee}% × AUM total</p>
      </div>
      <div className="card p-5 flex flex-col gap-1">
        <p className="label">Receita Mensal</p>
        <p className="font-serif text-2xl text-copper">R$ {fmt(revenue.totalMonthly)}</p>
        <p className="text-xs text-charcoal/40">Anual ÷ 12</p>
      </div>
      <div className="card p-5 flex flex-col gap-1">
        <p className="label">Fee de Gestão</p>
        <div className="flex items-baseline gap-1">
          <InlineField value={revenue.fee} onSave={saveFee} type="number" suffix="% a.a." className="font-serif text-2xl text-brown" />
        </div>
        <p className="text-xs text-charcoal/40">Clique para editar</p>
      </div>
      <div className="card p-5 flex flex-col gap-1">
        <p className="label">AUM Total</p>
        <p className="font-serif text-2xl text-charcoal">R$ {fmt(revenue.totalAUM)}</p>
        <p className="text-xs text-charcoal/40">{revenue.perClient?.length || 0} clientes ativos</p>
      </div>
    </div>
  );
}
