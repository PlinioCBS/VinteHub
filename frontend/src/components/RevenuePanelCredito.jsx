import React, { useState, useEffect } from 'react';
import useAPI from '../hooks/useAPI.js';

const fmtShort = (v) => {
  if (!v) return 'R$ 0';
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}K`;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

function CreditCard({ title, totalCredit, clients, products, accentColor }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-1" style={{ backgroundColor: accentColor }} />
      <div className="p-5">
        <div className="flex items-center mb-4">
          <span className="font-serif font-bold text-base" style={{ color: 'var(--text-primary)' }}>{title}</span>
        </div>
        <div className="space-y-2">
          <div>
            <p className="font-sans text-xs text-gray-500 mb-0.5">Volume Total</p>
            <p className="font-serif text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{fmtShort(totalCredit)}</p>
          </div>
          <div className="flex gap-4 pt-2 border-t border-gray-100">
            <div>
              <p className="font-sans text-xs text-gray-500">Clientes</p>
              <p className="font-serif text-lg font-bold text-gray-800">{clients}</p>
            </div>
            <div>
              <p className="font-sans text-xs text-gray-500">Produtos</p>
              <p className="font-serif text-lg font-bold text-gray-800">{products}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function RevenuePanelCredito() {
  const api = useAPI();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const d = await api.getCreditSummary();
      setData(d);
    } catch {} finally { setLoading(false); }
  }

  if (loading) return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl h-40 animate-pulse border border-gray-100" />)}
    </div>
  );

  const porto       = data?.porto             || { total_credit: 0, clients: 0, products: 0 };
  const bancorbras  = data?.bancorbras         || { total_credit: 0, clients: 0, products: 0 };
  const carta       = data?.carta_contemplada  || { total_credit: 0, clients: 0, products: 0 };
  const financiamento = data?.financiamento    || { total_credit: 0, clients: 0, products: 0 };

  return (
    <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
      <CreditCard title="Porto Seguro Bank"  totalCredit={porto.total_credit}        clients={porto.clients}        products={porto.products}        accentColor="#7c3aed" />
      <CreditCard title="BancorBras"         totalCredit={bancorbras.total_credit}   clients={bancorbras.clients}   products={bancorbras.products}   accentColor="#4f46e5" />
      <CreditCard title="Carta Contemplada"  totalCredit={carta.total_credit}        clients={carta.clients}        products={carta.products}        accentColor="#0891b2" />
      <CreditCard title="Financiamento"      totalCredit={financiamento.total_credit} clients={financiamento.clients} products={financiamento.products} accentColor="#059669" />
    </div>
  );
}
