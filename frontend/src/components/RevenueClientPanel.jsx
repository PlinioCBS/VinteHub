import React from 'react';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function RevenueClientPanel({ aum, fee }) {
  const annual = (aum || 0) * ((fee || 0.55) / 100);
  const monthly = annual / 12;

  return (
    <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'rgba(53,86,65,0.06)' }}>
      <p className="text-xs font-bold uppercase tracking-wide text-green">Receita (Fee {fee || 0.55}% )</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-charcoal/50">Anual</p>
          <p className="font-serif text-base text-green font-bold">R$ {fmt(annual)}</p>
        </div>
        <div>
          <p className="text-xs text-charcoal/50">Mensal</p>
          <p className="font-serif text-base text-copper font-bold">R$ {fmt(monthly)}</p>
        </div>
      </div>
    </div>
  );
}
