import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import api from '../api.js';
import { CRM_CONFIG } from '../contexts/CRMContext.jsx';

function fmt(v) {
  if (!v) return 'R$ 0';
  if (v >= 1e9) return `R$ ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}K`;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

function fmtPct(v) {
  return (v || 0).toFixed(2) + '%';
}

function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded-lg ${className}`} />;
}

const CRM_COLORS = Object.fromEntries(
  Object.entries(CRM_CONFIG).map(([k, v]) => [k, v.color])
);

const RANKING_TABS = [
  { key: 'all', label: 'Geral', icon: '🏆' },
  { key: 'investimento', label: 'Investimento', icon: '📈' },
  { key: 'credito', label: 'Crédito', icon: '💳' },
  { key: 'cambio', label: 'Câmbio', icon: '💱' },
  { key: 'seguro', label: 'Seguro', icon: '🛡️' },
];

const RANK_STYLES = [
  { bg: '#fef3c7', color: '#92400e', label: '#1', border: '#f59e0b' },
  { bg: '#f1f5f9', color: '#475569', label: '#2', border: '#94a3b8' },
  { bg: '#fdf4ec', color: '#9a3412', label: '#3', border: '#f97316' },
];

function getRankStyle(rank) {
  return RANK_STYLES[rank] || { bg: '#f9fafb', color: '#6b7280', label: `#${rank + 1}`, border: '#e5e7eb' };
}

function EmployeeAvatar({ name, photoUrl, size = 36 }) {
  const initials = name ? name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase() : '??';
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center flex-shrink-0 font-sans font-bold text-white"
      style={{ width: size, height: size, backgroundColor: '#7c3aed', fontSize: size * 0.35 }}
    >
      {initials}
    </div>
  );
}

function RankingColumns({ tab }) {
  if (tab === 'all') {
    return (
      <>
        <th className="px-3 py-3 text-right text-xs font-semibold uppercase" style={{ color: '#355641' }}>📈 AUM</th>
        <th className="px-3 py-3 text-right text-xs font-semibold uppercase" style={{ color: '#7c3aed' }}>💳 Crédito</th>
        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">💱 Câmbio</th>
        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">🛡️ Seguro</th>
        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Clientes</th>
      </>
    );
  }
  if (tab === 'investimento') {
    return (
      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">AUM</th>
    );
  }
  if (tab === 'credito') {
    return (
      <>
        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Porto Seguro</th>
        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">BancorBras</th>
        <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Total Produção</th>
      </>
    );
  }
  // cambio, seguro
  return (
    <>
      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Clientes Ativos</th>
      <th className="px-3 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Negócios Abertos</th>
    </>
  );
}

function RankingCells({ emp, tab, rankingAllData }) {
  if (tab === 'all') {
    // Para o geral, busca os dados do funcionário na aba de crédito também
    const porto = emp.credit_by_type?.consorcio_porto || 0;
    const bancorbras = emp.credit_by_type?.consorcio_bancorbras || 0;
    const creditTotal = emp.credit_volume || 0;
    return (
      <>
        <td className="px-3 py-3 text-right font-semibold text-sm" style={{ color: '#355641' }}>{fmt(emp.total_aum)}</td>
        <td className="px-3 py-3 text-right text-sm font-semibold" style={{ color: '#7c3aed' }}>{fmt(creditTotal)}</td>
        <td className="px-3 py-3 text-right text-sm text-gray-400">—</td>
        <td className="px-3 py-3 text-right text-sm text-gray-400">—</td>
        <td className="px-3 py-3 text-right text-sm text-gray-700">{emp.active_clients}</td>
      </>
    );
  }
  if (tab === 'investimento') {
    return (
      <td className="px-3 py-3 text-right font-bold text-base" style={{ color: '#355641' }}>{fmt(emp.total_aum)}</td>
    );
  }
  if (tab === 'credito') {
    const porto = emp.credit_by_type?.consorcio_porto || 0;
    const bancorbras = emp.credit_by_type?.consorcio_bancorbras || 0;
    return (
      <>
        <td className="px-3 py-3 text-right font-semibold text-sm" style={{ color: '#7c3aed' }}>{fmt(porto)}</td>
        <td className="px-3 py-3 text-right font-semibold text-sm" style={{ color: '#4f46e5' }}>{fmt(bancorbras)}</td>
        <td className="px-3 py-3 text-right font-bold text-sm" style={{ color: '#7c3aed' }}>{fmt(emp.credit_volume)}</td>
      </>
    );
  }
  return (
    <>
      <td className="px-3 py-3 text-right font-semibold text-sm text-gray-800">{emp.active_clients}</td>
      <td className="px-3 py-3 text-right text-sm text-gray-700">{emp.open_deals}</td>
    </>
  );
}

function EmployeeRanking() {
  const [activeTab, setActiveTab] = useState('all');
  const [rankingData, setRankingData] = useState({});
  const [loading, setLoading] = useState(false);

  async function loadTab(tab) {
    if (rankingData[tab]) return;
    setLoading(true);
    try {
      const data = await api.getEmployeeRanking(tab);
      setRankingData(prev => ({ ...prev, [tab]: data }));
    } catch (e) {
      console.error(e);
      setRankingData(prev => ({ ...prev, [tab]: [] }));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTab('all'); }, []);

  function handleTab(tab) {
    setActiveTab(tab);
    loadTab(tab);
  }

  const employees = rankingData[activeTab] || [];
  const tabColor = activeTab === 'investimento' ? '#355641'
    : activeTab === 'credito' ? '#7c3aed'
    : activeTab === 'cambio' ? '#2563eb'
    : activeTab === 'seguro' ? '#0891b2'
    : '#dd7752';

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 pt-5 pb-0">
        <h2 className="font-serif font-bold text-lg text-gray-900 mb-4">Ranking de Colaboradores</h2>
        {/* Tab pills */}
        <div className="flex gap-2 overflow-x-auto pb-3">
          {RANKING_TABS.map(tab => {
            const isActive = activeTab === tab.key;
            const color = tab.key === 'investimento' ? '#355641'
              : tab.key === 'credito' ? '#7c3aed'
              : tab.key === 'cambio' ? '#2563eb'
              : tab.key === 'seguro' ? '#0891b2'
              : '#dd7752';
            return (
              <button
                key={tab.key}
                onClick={() => handleTab(tab.key)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold font-sans transition-all whitespace-nowrap"
                style={{
                  backgroundColor: isActive ? color : '#f3f4f6',
                  color: isActive ? '#fff' : '#6b7280',
                  border: `1.5px solid ${isActive ? color : 'transparent'}`
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {loading ? (
        <div className="p-6 space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
        </div>
      ) : employees.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <span className="text-4xl mb-3">👤</span>
          <p className="font-sans text-sm">Nenhum colaborador cadastrado</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-sans">
            <thead>
              <tr className="bg-gray-50 border-y border-gray-100">
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase w-10">#</th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Colaborador</th>
                <RankingColumns tab={activeTab} />
              </tr>
            </thead>
            <tbody>
              {employees.map((emp, i) => {
                const rs = getRankStyle(i);
                return (
                  <tr key={emp.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                    <td className="px-4 py-3">
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ backgroundColor: rs.bg, color: rs.color, border: `1.5px solid ${rs.border}` }}
                      >
                        {i + 1}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2.5">
                        <EmployeeAvatar name={emp.name} photoUrl={emp.photo_url} size={32} />
                        <span className="font-medium text-gray-900">{emp.name}</span>
                      </div>
                    </td>
                    <RankingCells emp={emp} tab={activeTab} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function GeneralDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getGeneralDashboard()
      .then(setData)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const pieData = data?.perCRM?.map(crm => ({
    name: CRM_CONFIG[crm.crm_type]?.label || crm.label || crm.crm_type,
    value: crm.totalAnnual,
    color: crm.color || CRM_CONFIG[crm.crm_type]?.color || '#888'
  })).filter(d => d.value > 0) || [];

  const creditSummary = data?.credito_summary;

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="font-serif text-3xl font-bold text-gray-900 mb-1">Dashboard Geral</h1>
        <p className="font-sans text-sm text-gray-500">Visão consolidada de todos os CRMs</p>
      </div>

      {error && (
        <div className="mb-6 px-4 py-3 rounded-xl text-sm font-sans text-red-600 bg-red-50 border border-red-200">
          {error}
        </div>
      )}

      {/* Top KPIs — AUM Total + Clientes Ativos */}
      <div className="grid grid-cols-2 gap-4 mb-8 max-w-2xl">
        {[
          { label: 'AUM Total', value: loading ? null : fmt(data?.grandTotalAUM ?? data?.totalAUM), icon: '💰', color: '#355641' },
          { label: 'Clientes Ativos', value: loading ? null : data?.totalClients, icon: '👥', color: '#7c3aed' },
        ].map((kpi, i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{kpi.icon}</span>
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: kpi.color }} />
            </div>
            {loading ? (
              <Skeleton className="h-7 w-3/4 mb-1" />
            ) : (
              <div className="font-serif font-bold text-2xl text-gray-900">{kpi.value}</div>
            )}
            <div className="font-sans text-xs text-gray-500 mt-1">{kpi.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Pie chart */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <h2 className="font-serif font-bold text-lg text-gray-900 mb-6">Distribuição de Receita por Vertical</h2>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={65}
                  outerRadius={100}
                  paddingAngle={3}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [fmt(value), 'Receita Anual']}
                  contentStyle={{ borderRadius: 12, border: 'none', boxShadow: '0 10px 40px rgba(0,0,0,0.15)', fontFamily: 'sans-serif', fontSize: 12 }}
                />
                <Legend
                  formatter={(value) => <span style={{ fontFamily: 'sans-serif', fontSize: 12, color: '#374151' }}>{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-64 flex flex-col items-center justify-center text-gray-400">
              <span className="text-4xl mb-3">📊</span>
              <p className="font-sans text-sm">Nenhum dado de receita ainda</p>
            </div>
          )}
        </div>

        {/* Crédito summary card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center gap-2 mb-5">
            <span className="text-2xl">💳</span>
            <h2 className="font-serif font-bold text-lg" style={{ color: '#7c3aed' }}>Crédito Intermediado</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <>
              <div className="space-y-3 mb-4">
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#f5f3ff' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏛️</span>
                    <span className="font-sans text-sm font-medium text-gray-700">Porto Seguro Bank</span>
                  </div>
                  <span className="font-serif font-bold text-base" style={{ color: '#7c3aed' }}>
                    {fmt(creditSummary?.porto_total || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl" style={{ backgroundColor: '#eef2ff' }}>
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏦</span>
                    <span className="font-sans text-sm font-medium text-gray-700">BancorBras</span>
                  </div>
                  <span className="font-serif font-bold text-base" style={{ color: '#4f46e5' }}>
                    {fmt(creditSummary?.bancorbras_total || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📋</span>
                    <span className="font-sans text-sm font-medium text-gray-700">Carta Contemplada</span>
                  </div>
                  <span className="font-serif font-bold text-base" style={{ color: '#0891b2' }}>
                    {fmt(creditSummary?.carta_total || 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🏠</span>
                    <span className="font-sans text-sm font-medium text-gray-700">Financiamento</span>
                  </div>
                  <span className="font-serif font-bold text-base" style={{ color: '#059669' }}>
                    {fmt(creditSummary?.financiamento_total || 0)}
                  </span>
                </div>
              </div>
              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="font-sans text-sm font-semibold text-gray-600">Total intermediado</span>
                <span className="font-serif text-xl font-bold" style={{ color: '#7c3aed' }}>
                  {fmt(creditSummary?.grand_total || 0)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Employee Ranking */}
      <div className="mb-8">
        <EmployeeRanking />
      </div>

      {/* Per-CRM cards — ordem: Investimento, Crédito, Câmbio, Seguro */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-52 w-full" />)
        ) : (
          [...(data?.perCRM || [])].sort((a, b) => {
            const order = { investimento: 0, credito: 1, cambio: 2, seguro: 3 };
            return (order[a.crm_type] ?? 9) - (order[b.crm_type] ?? 9);
          }).map(crm => {
            const cfg = CRM_CONFIG[crm.crm_type] || CRM_CONFIG.investimento;
            const cardColor = crm.color || cfg.color;
            return (
              <div key={crm.crm_type} className="bg-white rounded-2xl shadow-sm border p-5 overflow-hidden relative"
                style={{ borderColor: cardColor + '30' }}>
                {/* Color accent bar */}
                <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: cardColor }} />
                <div className="mt-2">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-xl">{cfg.icon}</span>
                    <span className="font-serif font-bold text-base" style={{ color: cardColor }}>{crm.label || cfg.label}</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="flex justify-between items-center">
                      <span className="font-sans text-xs text-gray-500">Fee</span>
                      <span className="font-sans text-xs font-semibold text-gray-800">{crm.fee}% a.a.</span>
                    </div>
                    {crm.crm_type === 'credito' ? (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="font-sans text-xs text-gray-500">Porto</span>
                          <span className="font-sans text-xs font-semibold" style={{ color: '#7c3aed' }}>{fmt(creditSummary?.porto_total || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-sans text-xs text-gray-500">BancorBras</span>
                          <span className="font-sans text-xs font-semibold" style={{ color: '#4f46e5' }}>{fmt(creditSummary?.bancorbras_total || 0)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-sans text-xs text-gray-500">Total Crédito</span>
                          <span className="font-sans text-xs font-bold" style={{ color: cardColor }}>{fmt(creditSummary?.grand_total || 0)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="font-sans text-xs text-gray-500">
                            {crm.crm_type === 'investimento' ? 'AUM' : 'Produção'}
                          </span>
                          <span className="font-sans text-xs font-semibold text-gray-800">{fmt(crm.totalAUM)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-sans text-xs text-gray-500">Receita/Ano</span>
                          <span className="font-sans text-xs font-semibold text-gray-800">{fmt(crm.totalAnnual)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="font-sans text-xs text-gray-500">Receita/Mês</span>
                          <span className="font-sans text-xs font-semibold" style={{ color: cardColor }}>{fmt(crm.totalMonthly)}</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between items-center pt-1 border-t border-gray-100">
                      <span className="font-sans text-xs text-gray-500">Clientes</span>
                      <span className="font-sans text-xs font-bold" style={{ color: cardColor }}>{crm.activeClients}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-sans text-xs text-gray-500">Pipeline</span>
                      <span className="font-sans text-xs font-semibold text-gray-700">{fmt(crm.pipelineValue)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="font-sans text-xs text-gray-500">Contatos</span>
                      <span className="font-sans text-xs font-semibold text-gray-700">{crm.contacts}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
