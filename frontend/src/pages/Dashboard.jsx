import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area, CartesianGrid } from 'recharts';
import useAPI from '../hooks/useAPI.js';
import { useDashboardStats, useClientsGoal, useClientsRevenue, useClients } from '../hooks/useConvexData.js';
import InlineField from '../components/InlineField.jsx';
import { useCRM } from '../contexts/CRMContext.jsx';

const fmt = (v) => (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtCur = (v) => 'R$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtShort = (v) => {
  if (!v) return 'R$ 0';
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}K`;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
};

const STAGE_LABELS = { prospecting: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta', negociacao: 'Negociação', fechado_ganho: 'Ganho' };
const STATUS_LABELS = { prospecting: 'Prospecção', qualificacao: 'Qualificação', proposta: 'Proposta', negociacao: 'Negociação', cliente: 'Cliente', inativo: 'Inativo' };
const PIE_COLORS = ['#355641','#dd7752','#7A5137','#d9d9d6','#353535','#6B8F71'];
const BAR_COLOR = '#355641';

const PRODUCT_LABELS = {
  consorcio_porto: 'Porto Seguro',
  consorcio_bancorbras: 'BancorBras',
  carta_contemplada: 'Carta Contemplada',
  financiamento: 'Financiamento'
};

function ProgressBar({ percent }) {
  const color = percent < 40 ? '#ef4444' : percent < 70 ? '#eab308' : percent < 100 ? '#dd7752' : '#355641';
  return (
    <div className="w-full bg-brand-gray rounded-full h-3 overflow-hidden">
      <div className="h-3 rounded-full progress-bar transition-all" style={{ width: `${Math.min(100, percent)}%`, backgroundColor: color }} />
    </div>
  );
}

function MetricCard({ label, value, sub, stripe }) {
  return (
    <div className="card flex overflow-hidden">
      <div className="w-1.5 flex-shrink-0 rounded-l-xl" style={{ backgroundColor: stripe }} />
      <div className="p-5 flex flex-col gap-1 flex-1">
        <p className="label">{label}</p>
        <p className="font-serif text-2xl text-charcoal">{value}</p>
        {sub && <p className="text-xs text-charcoal/40">{sub}</p>}
      </div>
    </div>
  );
}

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

function CreditDashboard() {
  const api = useAPI();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getCreditSummary()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="p-8">
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[1,2,3].map(i => <div key={i} className="bg-white rounded-2xl h-40 animate-pulse border border-gray-100" />)}
      </div>
    </div>
  );

  const porto = data?.porto || { total_credit: 0, clients: 0, products: 0 };
  const bancorbras = data?.bancorbras || { total_credit: 0, clients: 0, products: 0 };
  const carta = data?.carta_contemplada || { total_credit: 0, clients: 0, products: 0 };
  const financiamento = data?.financiamento || { total_credit: 0, clients: 0, products: 0 };
  const outrosTotal = carta.total_credit + financiamento.total_credit;
  const outrosClients = carta.clients + financiamento.clients;
  const outrosProducts = carta.products + financiamento.products;

  const topClients = data?.top_clients || [];

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="w-1 h-8 rounded-full" style={{ backgroundColor: '#7c3aed' }} />
        <div>
          <h1 className="font-serif text-2xl text-charcoal">Dashboard — Crédito</h1>
          <p className="text-sm text-charcoal/50 font-sans mt-0.5">Consórcios e financiamentos intermediados</p>
        </div>
      </div>

      {/* Top row: 4 product type cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <CreditCard
          title="Porto Seguro Bank"
          totalCredit={porto.total_credit}
          clients={porto.clients}
          products={porto.products}
          accentColor="#7c3aed"
        />
        <CreditCard
          title="BancorBras"
          totalCredit={bancorbras.total_credit}
          clients={bancorbras.clients}
          products={bancorbras.products}
          accentColor="#4f46e5"
        />
        <CreditCard
          title="Carta Contemplada"
          totalCredit={carta.total_credit}
          clients={carta.clients}
          products={carta.products}
          accentColor="#0891b2"
        />
        <CreditCard
          title="Financiamento"
          totalCredit={financiamento.total_credit}
          clients={financiamento.clients}
          products={financiamento.products}
          accentColor="#059669"
        />
      </div>

      {/* Second row: 2 summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <p className="font-sans text-sm text-gray-500 mb-2">Total de Crédito Intermediado</p>
          <p className="font-serif text-4xl font-bold" style={{ color: 'var(--text-primary)' }}>
            {fmtShort(data?.grand_total || 0)}
          </p>
          <p className="font-sans text-xs text-gray-400 mt-2">Soma de todos os tipos de produto</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-sans text-xs text-gray-500 mb-1">Clientes Ativos em Crédito</p>
              <p className="font-serif text-3xl font-bold text-gray-900">{data?.total_clients || 0}</p>
            </div>
            <div>
              <p className="font-sans text-xs text-gray-500 mb-1">Produtos Cadastrados</p>
              <p className="font-serif text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{data?.total_products || 0}</p>
            </div>
            <div className="col-span-2 pt-2 border-t border-gray-100">
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Porto:</span>
                <span className="font-semibold text-gray-700">{fmtShort(porto.total_credit)}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span className="text-gray-500">BancorBras:</span>
                <span className="font-semibold text-gray-700">{fmtShort(bancorbras.total_credit)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Third section: top clients table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-serif font-bold text-base text-gray-900">Clientes por Volume de Crédito</h2>
        </div>
        {topClients.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <span className="text-4xl mb-3">💳</span>
            <p className="font-sans text-sm">Nenhum produto cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="bg-gray-50">
                  {['Cliente', 'Produto', 'Valor', 'Nº Contrato', 'Grupo', 'Cota', 'Data'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {topClients.map((row, i) => (
                  <tr key={row.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-4 py-3 font-medium text-gray-900">{row.client_name}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: row.product_type === 'consorcio_porto' ? 'rgba(124,58,237,0.08)' : row.product_type === 'consorcio_bancorbras' ? 'rgba(79,70,229,0.08)' : 'var(--bg-page)',
                          color: 'var(--text-muted)'
                        }}>
                        {PRODUCT_LABELS[row.product_type] || row.product_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: 'var(--text-primary)' }}>{fmtShort(row.credit_value)}</td>
                    <td className="px-4 py-3 text-gray-600">{row.contract_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{row.group_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{row.quota_number || '—'}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {row.contract_date ? new Date(row.contract_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Câmbio Dashboard ─────────────────────────────────────────────────────────
const CURRENCIES = [
  { key: 'USDBRL', name: 'Dólar',          symbol: '$',  flag: '🇺🇸', color: '#0f766e', bg: '#f0fdfa' },
  { key: 'EURBRL', name: 'Euro',           symbol: '€',  flag: '🇪🇺', color: '#0f766e', bg: '#f0fdfa' },
  { key: 'GBPBRL', name: 'Libra Esterlina', symbol: '£', flag: '🇬🇧', color: '#0f766e', bg: '#f0fdfa' },
  { key: 'CHFBRL', name: 'Franco Suíço',   symbol: '₣',  flag: '🇨🇭', color: '#0f766e', bg: '#f0fdfa' },
];

const PERIODS = ['1D','5D','1M','6M','YTD','1Y'];

function periodToDays(period) {
  if (period === '1D')  return 2;
  if (period === '5D')  return 5;
  if (period === '1M')  return 30;
  if (period === '6M')  return 180;
  if (period === 'YTD') {
    const jan1 = new Date(new Date().getFullYear(), 0, 1);
    return Math.ceil((Date.now() - jan1) / 86400000) + 1;
  }
  if (period === '1Y')  return 365;
  if (period === '5Y')  return 1825;
  return 3650; // MAX
}

const _MONTHS = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function fmtAxisDate(ts, period) {
  const d = new Date(ts);
  if (period === '5Y' || period === 'MAX' || period === '1Y' || period === '6M' || period === 'YTD') {
    return _MONTHS[d.getMonth()] + '/' + String(d.getFullYear()).slice(2);
  }
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function CurrencyChart({ currency }) {
  const [period, setPeriod] = useState('1M');
  const [chartData, setChartData] = useState([]);
  const [chartLoading, setChartLoading] = useState(true);
  const [chartError, setChartError] = useState(null);

  const histPair = currency.key.replace('BRL', '-BRL'); // USDBRL → USD-BRL

  const fetchHistory = useCallback(async () => {
    setChartLoading(true);
    setChartError(null);
    try {
      const days = periodToDays(period);
      const res = await fetch(
        `https://economia.awesomeapi.com.br/json/daily/${histPair}/${days}`
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const raw = await res.json();
      if (!Array.isArray(raw) || raw.length === 0) throw new Error('Sem dados');

      const parsed = raw
        .map(d => ({
          ts: parseInt(d.timestamp) * 1000,
          value: parseFloat(d.bid),
          high: parseFloat(d.high),
          low: parseFloat(d.low),
        }))
        .sort((a, b) => a.ts - b.ts);

      setChartData(parsed);
    } catch (e) {
      setChartError('Não foi possível carregar o histórico');
    } finally {
      setChartLoading(false);
    }
  }, [period, histPair]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const min = chartData.length ? Math.min(...chartData.map(d => d.low))  * 0.999 : 'auto';
  const max = chartData.length ? Math.max(...chartData.map(d => d.high)) * 1.001 : 'auto';
  const first = chartData[0]?.value;
  const last  = chartData[chartData.length - 1]?.value;
  const trending = last != null && first != null ? (last >= first ? 'up' : 'down') : 'up';
  const lineColor = trending === 'up' ? '#16a34a' : '#dc2626';

  const tickCount = period === '1D' ? 4 : period === '5D' ? 5 : 6;

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-white border border-gray-200 rounded-xl shadow-lg px-3 py-2 text-xs font-sans">
        <p className="text-gray-500 mb-1">{new Date(d.ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>R$ {d.value.toFixed(4)}</p>
        <p className="text-emerald-600">↑ R$ {d.high.toFixed(4)}</p>
        <p className="text-red-500">↓ R$ {d.low.toFixed(4)}</p>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: currency.color }} />
      <div className="px-6 pt-5 pb-4">
        {/* Chart header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-3">
            <span className="text-xl">{currency.flag}</span>
            <div>
              <p className="font-serif font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                {currency.name} / Real Brasileiro
              </p>
              <p className="font-mono text-xs text-gray-400">{currency.key.replace('BRL','')} / BRL · histórico</p>
            </div>
          </div>
          {/* Period selector */}
          <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
            {PERIODS.map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-2.5 py-1.5 rounded-lg font-sans text-xs font-semibold transition-all"
                style={{
                  backgroundColor: period === p ? currency.color : 'transparent',
                  color: period === p ? 'white' : '#6b7280',
                }}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Chart body */}
        {chartLoading ? (
          <div className="h-52 flex items-center justify-center gap-3">
            <div className="w-5 h-5 border-2 rounded-full animate-spin"
              style={{ borderColor: currency.color + '30', borderTopColor: currency.color }} />
            <span className="font-sans text-sm text-gray-400">Carregando histórico...</span>
          </div>
        ) : chartError ? (
          <div className="h-52 flex items-center justify-center">
            <p className="font-sans text-sm text-red-400">{chartError}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={`grad-${currency.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={lineColor} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={lineColor} stopOpacity={0.01} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="ts"
                tickCount={tickCount}
                tickFormatter={ts => fmtAxisDate(ts, period)}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[min, max]}
                tickFormatter={v => `R$${v.toFixed(2)}`}
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false}
                tickLine={false}
                width={62}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="value"
                stroke={lineColor}
                strokeWidth={2}
                fill={`url(#grad-${currency.key})`}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 0, fill: lineColor }}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function CurrencyCard({ currency, data, loading, active, onToggle }) {
  const bid  = data ? parseFloat(data.bid)  : null;
  const high = data ? parseFloat(data.high) : null;
  const low  = data ? parseFloat(data.low)  : null;
  const pct  = data ? parseFloat(data.pctChange) : null;
  const up   = pct >= 0;
  const fmtR = (v) => v != null ? `R$ ${v.toFixed(4)}` : '—';

  return (
    <div
      className="bg-white rounded-2xl shadow-sm border overflow-hidden transition-all duration-200"
      style={{ borderColor: active ? currency.color + '60' : '#f3f4f6', boxShadow: active ? `0 0 0 2px ${currency.color}30` : undefined }}
    >
      <div className="h-1.5 w-full" style={{ backgroundColor: currency.color }} />
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-12 h-12 flex-shrink-0 rounded-xl flex items-center justify-center text-2xl"
              style={{ backgroundColor: currency.bg }}>
              {currency.flag}
            </div>
            <div className="min-w-0">
              <p className="font-serif font-bold text-base leading-tight" style={{ color: 'var(--text-primary)' }}>
                {currency.name}
              </p>
              <p className="font-mono text-xs font-semibold mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {currency.key.replace('BRL', '')} / BRL
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {!loading && pct != null && (
              <div className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold whitespace-nowrap"
                style={{
                  backgroundColor: up ? '#dcfce7' : '#fee2e2',
                  color: up ? '#16a34a' : '#dc2626',
                }}>
                {up ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%
              </div>
            )}
            {/* Chart toggle arrow */}
            <button
              onClick={onToggle}
              title={active ? 'Ocultar gráfico' : 'Ver gráfico'}
              className="flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:opacity-80"
              style={{ backgroundColor: active ? currency.color : currency.bg }}
            >
              <svg
                className="w-3.5 h-3.5 transition-transform duration-200"
                style={{ color: active ? 'white' : currency.color, transform: active ? 'rotate(180deg)' : 'none' }}
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Main rate */}
        {loading ? (
          <div className="h-10 bg-gray-100 rounded-xl animate-pulse mb-4" />
        ) : (
          <div className="mb-4">
            <p className="font-sans text-xs text-gray-400 mb-0.5">Cotação Atual</p>
            <p className="font-serif font-bold" style={{ fontSize: '2.2rem', lineHeight: 1, color: 'var(--text-primary)' }}>
              {bid != null ? `R$ ${bid.toFixed(4)}` : '—'}
            </p>
            <p className="font-sans text-xs text-gray-400 mt-1">
              {currency.symbol} 1,00 = {bid != null ? `R$ ${bid.toFixed(4)}` : '—'}
            </p>
          </div>
        )}

        {/* High / Low */}
        <div className="grid grid-cols-2 gap-3 pt-4 border-t border-gray-100">
          <div>
            <p className="font-sans text-xs text-gray-400 mb-0.5">Mínima</p>
            {loading
              ? <div className="h-5 bg-gray-100 rounded animate-pulse" />
              : <p className="font-sans text-sm font-semibold text-red-500">{fmtR(low)}</p>
            }
          </div>
          <div>
            <p className="font-sans text-xs text-gray-400 mb-0.5">Máxima</p>
            {loading
              ? <div className="h-5 bg-gray-100 rounded animate-pulse" />
              : <p className="font-sans text-sm font-semibold text-emerald-600">{fmtR(high)}</p>
            }
          </div>
        </div>
      </div>
    </div>
  );
}

function CambioDashboard() {
  const [rates, setRates] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [error, setError] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);

  async function fetchRates() {
    try {
      const res = await fetch(
        'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL,CHF-BRL'
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      setRates(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError('Não foi possível carregar as cotações');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRates();
    const id = setInterval(fetchRates, 60000);
    return () => clearInterval(id);
  }, []);

  const fmtTime = (d) => d ? d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '';
  const selectedCurrency = CURRENCIES.find(c => c.key === selectedKey);

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-1 h-8 rounded-full bg-blue-600" />
          <div>
            <h1 className="font-serif text-2xl text-charcoal">Dashboard — Câmbio</h1>
            <p className="text-sm text-charcoal/50 font-sans mt-0.5">Cotações do mercado em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {error && (
            <span className="font-sans text-xs text-red-500 bg-red-50 px-3 py-1.5 rounded-lg">
              {error}
            </span>
          )}
          {lastUpdate && !error && (
            <span className="font-sans text-xs text-gray-400 bg-gray-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Atualizado às {fmtTime(lastUpdate)}
            </span>
          )}
          <button
            onClick={fetchRates}
            className="flex items-center gap-2 px-4 py-2 rounded-xl font-sans text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: '#2563eb' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Atualizar
          </button>
        </div>
      </div>

      {/* 4 Currency cards */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
        {CURRENCIES.map(cur => (
          <CurrencyCard
            key={cur.key}
            currency={cur}
            data={rates?.[cur.key]}
            loading={loading}
            active={selectedKey === cur.key}
            onToggle={() => setSelectedKey(prev => prev === cur.key ? null : cur.key)}
          />
        ))}
      </div>

      {/* Chart panel — full width, below the cards */}
      {selectedCurrency && (
        <div className="mt-5">
          <CurrencyChart key={selectedKey} currency={selectedCurrency} />
        </div>
      )}

      <p className="font-sans text-xs text-gray-400 mt-5 text-center">
        Fonte: AwesomeAPI · Dados do mercado financeiro · Atualização automática a cada 60s
      </p>
    </div>
  );
}

const fmtUSD = (v) => {
  if (!v) return '$ 0';
  if (v >= 1e9) return `$ ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$ ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$ ${(v / 1e3).toFixed(1)}K`;
  return '$ ' + (v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function Dashboard() {
  const api = useAPI();
  const { activeCRM } = useCRM();
  const stats = useDashboardStats();
  const goal = useClientsGoal();
  const revenue = useClientsRevenue();
  const { clients: clientsList, totalAUM } = useClients();
  const clientsData = { clients: clientsList, totalAUM };
  const loading = stats === undefined;

  const aumUSD = {
    total: (clientsList ?? []).reduce((s, c) => s + (c.aumUsd ?? 0), 0),
    count: (clientsList ?? []).filter(c => (c.aumUsd ?? 0) > 0).length,
  };

  async function saveGoal(val) {
    try {
      await api.updateClientsGoal(parseFloat(val));
    } catch (e) { console.error(e); }
  }

  if (activeCRM === 'cambio') return <CambioDashboard />;
  if (activeCRM === 'credito') return <CreditDashboard />;

  if (loading) return (
    <div className="p-8">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => <div key={i} className="card h-28 animate-pulse" />)}
      </div>
    </div>
  );

  // Todas as etapas do pipeline, sempre presentes mesmo se vazias
  const ALL_PIPELINE_STAGES = [
    { stage: 'prospecting', name: 'Prospecção' },
    { stage: 'qualificacao', name: 'Qualificação' },
    { stage: 'proposta', name: 'Proposta' },
    { stage: 'negociacao', name: 'Negociação' },
    { stage: 'fechado_ganho', name: 'Ganho' },
    { stage: 'cliente_ativo', name: 'Cliente Ativo' },
  ];
  const stageMap = {};
  (stats?.dealsByStage || []).forEach(d => {
    stageMap[d.stage] = { count: parseInt(d.count) || 0, total: parseFloat(d.total) || 0 };
  });
  const dealsByStage = ALL_PIPELINE_STAGES.map(s => ({
    name: s.name,
    count: stageMap[s.stage]?.count || 0,
    total: stageMap[s.stage]?.total || 0,
  }));

  const contactsByStatus = (stats?.contactsByStatus || []).map(d => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: parseInt(d.count) || 0
  })).filter(d => d.value > 0);

  // Fallback: build contactsByStatus from clientsData if stats is empty
  const contactsChartData = contactsByStatus.length > 0
    ? contactsByStatus
    : clientsData?.clients?.length > 0
      ? [{ name: 'Cliente', value: clientsData.clients.length }]
      : [];

  const aumData = (stats?.aumByClient || clientsData?.clients || [])
    .map(c => ({ name: c.name, value: parseFloat(c.aum) || 0 }))
    .filter(c => c.value > 0);

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">Dashboard</h1>
        <p className="text-sm text-charcoal/50 font-sans mt-1">Visão geral do seu portfólio</p>
      </div>

      {/* Revenue metrics */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        <MetricCard label="Receita Anual" value={fmtCur(revenue?.totalAnnual)} sub={`Fee ${revenue?.fee || 0.55}% `} stripe="#355641" />
        <MetricCard label="Receita Mensal" value={fmtCur(revenue?.totalMonthly)} sub="Anual ÷ 12" stripe="#dd7752" />
        <MetricCard label="AUM Total" value={fmtCur(revenue?.totalAUM ?? clientsData?.totalAUM)} sub={`${revenue?.perClient?.length ?? clientsData?.clients?.length ?? 0} clientes`} stripe="#7A5137" />
        <MetricCard label="AUM Dólar" value={fmtUSD(aumUSD?.total ?? 0)} sub={aumUSD != null ? `${aumUSD.count} clientes USD` : 'Carteira USD'} stripe="#2563eb" />
        <MetricCard label="Clientes Ativos" value={revenue?.perClient?.length ?? clientsData?.clients?.length ?? 0} sub="Status: cliente" stripe="#353535" />
      </div>

      {/* Captação Goals */}
      {goal && (
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="label">Meta de Captação Anual</p>
              <span className="text-xs font-bold text-charcoal/50">{goal.progress.toFixed(1)}%</span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <p className="font-serif text-xl text-charcoal">{fmtCur(goal.totalAUM)}</p>
              <span className="text-charcoal/40 text-sm">de</span>
              <InlineField value={goal.goal} onSave={saveGoal} type="number" prefix="R$ " className="font-serif text-xl text-green" />
            </div>
            <ProgressBar percent={goal.progress} />
            <p className="text-xs text-charcoal/40 mt-2">
              Faltam {fmtCur(goal.remaining)} para a meta
            </p>
          </div>
          <div className="card p-5">
            <p className="label mb-3">Meta Mensal</p>
            <p className="font-serif text-xl text-charcoal mb-2">{fmtCur(goal.totalAUM / 12)}</p>
            <ProgressBar percent={goal.progress} />
            <p className="text-xs text-charcoal/40 mt-2">
              Meta mensal: {fmtCur(goal.goal / 12)}
            </p>
          </div>
        </div>
      )}

      {/* Operational KPIs */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label: 'Prospects', value: stats?.newLeads, color: '#355641' },
          { label: 'Em Negociação', value: stats?.openDeals, color: '#dd7752' },
          { label: 'Clientes Ativos', value: clientsData?.clients?.length ?? 0, color: '#22c55e' },
          { label: 'Negócios Ganhos', value: stats?.wonDeals, color: '#7A5137' },
          { label: 'Tarefas Pendentes', value: stats?.pendingTasks, color: stats?.overdueTasks > 0 ? '#ef4444' : '#353535' }
        ].map(kpi => (
          <div key={kpi.label} className="card p-4 flex items-center gap-3">
            <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: kpi.color }} />
            <div>
              <p className="font-serif text-2xl text-charcoal">{kpi.value ?? 0}</p>
              <p className="text-xs text-charcoal/50 font-sans">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="card p-5 col-span-2">
          <p className="font-serif text-sm mb-4">Pipeline por Etapa</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dealsByStage} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#353535' }} />
              <YAxis tick={{ fontSize: 11, fill: '#353535' }} />
              <Tooltip formatter={(v, n) => n === 'total' ? fmtCur(v) : v} />
              <Bar dataKey="count" fill={BAR_COLOR} radius={[4,4,0,0]} name="Negócios" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="card p-5">
          <p className="font-serif text-sm mb-4">Prospects por Status</p>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={contactsChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {contactsChartData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tasks + Activities + AUM distribution */}
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5">
          <p className="font-serif text-sm mb-4">Próximas Tarefas</p>
          {stats?.upcomingTasks?.length === 0 && <p className="text-sm text-charcoal/40">Nenhuma tarefa pendente</p>}
          <div className="space-y-2">
            {stats?.upcomingTasks?.map(t => (
              <div key={t.id} className="flex items-start gap-2 text-sm">
                <span className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${t.priority === 'high' ? 'bg-red-500' : t.priority === 'medium' ? 'bg-yellow-500' : 'bg-green'}`} />
                <div>
                  <p className="text-charcoal font-sans text-xs">{t.title}</p>
                  <p className="text-charcoal/40 text-xs">{t.contact_name} · {t.due_date ? new Date(t.due_date + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-serif text-sm mb-4">Atividades Recentes</p>
          {stats?.recentActivities?.length === 0 && <p className="text-sm text-charcoal/40">Nenhuma atividade</p>}
          <div className="space-y-2">
            {stats?.recentActivities?.map(a => (
              <div key={a.id} className="text-xs">
                <p className="text-charcoal">{a.description}</p>
                <p className="text-charcoal/40">{a.contact_name} · {new Date(a.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5">
          <p className="font-serif text-sm mb-4">Ranking AUM por Cliente</p>
          {aumData.length === 0 ? (
            <p className="text-sm text-charcoal/40">Nenhum cliente com AUM</p>
          ) : (
            <div className="space-y-2 overflow-y-auto" style={{ maxHeight: 220 }}>
              {aumData.map((c, i) => {
                const maxAum = aumData[0]?.value || 1;
                const pct = Math.round((c.value / maxAum) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="font-sans text-xs font-medium text-charcoal truncate flex-1 mr-2">
                        <span className="text-charcoal/40 mr-1">#{i + 1}</span>{c.name}
                      </span>
                      <span className="font-sans text-xs font-bold flex-shrink-0" style={{ color: 'var(--text-primary)' }}>{fmtCur(c.value)}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1">
                      <div className="h-1 rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
