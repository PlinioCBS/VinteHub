import React, { useState, useEffect, useCallback } from 'react';
import useAPI from '../hooks/useAPI.js';
import { useToast } from '../contexts/ToastContext.jsx';
import InlineField from '../components/InlineField.jsx';

const fmtUSD = (v) => {
  if (!v) return '$ 0,00';
  return '$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};
const fmtBRL = (v) => (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });

function EditableUSD({ value, onSave }) {
  const api = useAPI();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState('');

  function startEdit() {
    setInput(value != null ? String(value) : '0');
    setEditing(true);
  }

  function handleBlur() {
    const parsed = parseFloat(String(input).replace(',', '.'));
    if (!isNaN(parsed) && parsed !== value) {
      onSave(parsed);
    }
    setEditing(false);
  }

  if (editing) {
    return (
      <input
        autoFocus
        type="number"
        step="100"
        value={input}
        onChange={e => setInput(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') setEditing(false); }}
        className="w-36 px-2 py-1 rounded-lg border font-sans text-sm outline-none text-right"
        style={{ borderColor: '#2563eb', boxShadow: '0 0 0 3px #2563eb20', color: 'var(--text-primary)' }}
      />
    );
  }

  return (
    <button
      onClick={startEdit}
      className="font-serif font-bold text-sm hover:opacity-70 transition-opacity group flex items-center gap-1"
      style={{ color: 'var(--text-primary)' }}
      title="Clique para editar"
    >
      {fmtUSD(value)}
      <svg className="w-3 h-3 opacity-0 group-hover:opacity-50 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
      </svg>
    </button>
  );
}

export default function Dolar() {
  const { toast } = useToast();
  const [clients, setClients] = useState([]);
  const [totalUSD, setTotalUSD] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cotacao, setCotacao] = useState(() => parseFloat(localStorage.getItem('dolar_cotacao')) || 5.7);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getDolarClients();
      setClients(data.clients || []);
      setTotalUSD(data.totalUSD || 0);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSaveUSD(clientId, aum_usd) {
    try {
      await api.updateAumUsd(clientId, aum_usd);
      toast.success('AUM USD atualizado');
      load();
    } catch (e) { toast.error('Erro ao salvar'); }
  }

  function handleCotacaoChange(val) {
    const n = parseFloat(val) || 5.7;
    setCotacao(n);
    localStorage.setItem('dolar_cotacao', String(n));
  }

  const filtered = search.trim()
    ? clients.filter(c =>
        c.name?.toLowerCase().includes(search.toLowerCase()) ||
        c.company?.toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  const totalBRL = totalUSD * cotacao;

  return (
    <div className="p-8" style={{ backgroundColor: 'var(--bg-page)', minHeight: '100vh' }}>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full" style={{ backgroundColor: '#2563eb' }} />
            <h1 className="font-serif font-bold text-2xl" style={{ color: 'var(--text-primary)' }}>Carteira Dólar</h1>
          </div>
          <p className="font-sans text-sm mt-1 ml-4" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>
            Portfólio USD — CRM Investimento
          </p>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="card p-5 flex flex-col gap-1">
          <p className="label">AUM Total (USD)</p>
          <p className="font-serif text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{fmtUSD(totalUSD)}</p>
          <p className="text-xs text-charcoal/40">{clients.filter(c => (c.aumUsd || 0) > 0).length} clientes com posição</p>
        </div>
        <div className="card p-5 flex flex-col gap-1">
          <p className="label">Equivalente BRL</p>
          <p className="font-serif text-2xl text-green">{fmtBRL(totalBRL)}</p>
          <p className="text-xs text-charcoal/40">Cotação × AUM USD</p>
        </div>
        <div className="card p-5 flex flex-col gap-1">
          <p className="label">Cotação USD/BRL</p>
          <div className="flex items-baseline gap-1">
            <span className="text-xs text-charcoal/50 font-sans mt-1">R$</span>
            <InlineField
              value={cotacao}
              onSave={handleCotacaoChange}
              type="number"
              className="font-serif text-2xl text-charcoal"
            />
          </div>
          <p className="text-xs text-charcoal/40">Clique para editar</p>
        </div>
        <div className="card p-5 flex flex-col gap-1">
          <p className="label">Total Clientes</p>
          <p className="font-serif text-2xl text-charcoal">{clients.length}</p>
          <p className="text-xs text-charcoal/40">Investimento ativo</p>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente ou empresa..."
            className="pl-9 pr-4 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none w-72 bg-white"
            style={{ color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border overflow-hidden shadow-sm" style={{ borderColor: '#d9d9d6' }}>
        <table className="w-full">
          <thead style={{ backgroundColor: 'var(--bg-page)', borderBottom: '1px solid #d9d9d6' }}>
            <tr>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Cliente</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Telefone</th>
              <th className="text-left px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Empresa</th>
              <th className="text-right px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>AUM (USD)</th>
              <th className="text-right px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-primary)', opacity: 0.5 }}>Equiv. BRL</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="text-center py-12 font-sans text-sm text-gray-400">Carregando...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16 font-sans text-sm text-gray-400">
                  <div className="flex flex-col items-center gap-2">
                    <svg className="w-10 h-10 text-gray-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p>Nenhum cliente encontrado</p>
                  </div>
                </td>
              </tr>
            ) : filtered.map((c, i) => {
              const aumUsd = c.aumUsd || 0;
              const equivBRL = aumUsd * cotacao;
              return (
                <tr
                  key={c._id}
                  className="border-t hover:bg-gray-50/60 transition-colors"
                  style={{ borderColor: '#f0eeeb' }}
                >
                  <td className="px-5 py-3">
                    <p className="font-sans font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{c.name}</p>
                  </td>
                  <td className="px-5 py-3 font-sans text-sm text-gray-500">{c.phone || '—'}</td>
                  <td className="px-5 py-3 font-sans text-sm text-gray-500">{c.company || '—'}</td>
                  <td className="px-5 py-3 text-right">
                    <EditableUSD value={aumUsd} onSave={(v) => handleSaveUSD(c._id, v)} />
                  </td>
                  <td className="px-5 py-3 text-right font-sans text-sm font-semibold" style={{ color: aumUsd > 0 ? 'var(--text-primary)' : 'var(--text-hint)' }}>
                    {aumUsd > 0 ? fmtBRL(equivBRL) : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {!loading && filtered.length > 0 && (
            <tfoot style={{ backgroundColor: 'var(--bg-page)', borderTop: '2px solid #d9d9d6' }}>
              <tr>
                <td colSpan={3} className="px-5 py-3 font-sans text-xs font-bold uppercase tracking-wide text-gray-500">Total</td>
                <td className="px-5 py-3 text-right font-serif font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                  {fmtUSD(filtered.reduce((s, c) => s + (c.aumUsd || 0), 0))}
                </td>
                <td className="px-5 py-3 text-right font-serif font-bold text-base text-green">
                  {fmtBRL(filtered.reduce((s, c) => s + ((c.aumUsd || 0) * cotacao), 0))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <p className="font-sans text-xs text-gray-400 mt-4 text-center">
        Clique no valor USD de qualquer cliente para editar · Cotação configurável acima
      </p>
    </div>
  );
}
