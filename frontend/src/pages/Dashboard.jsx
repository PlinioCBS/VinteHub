import React, { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../api.js';
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

function CreditCard({ icon, title, totalCredit, clients, products, accentColor }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="h-1" style={{ backgroundColor: accentColor }} />
      <div className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-2xl">{icon}</span>
          <span className="font-serif font-bold text-base" style={{ color: accentColor }}>{title}</span>
        </div>
        <div className="space-y-2">
          <div>
            <p className="font-sans text-xs text-gray-500 mb-0.5">Volume Total</p>
            <p className="font-serif text-2xl font-bold" style={{ color: accentColor }}>{fmtShort(totalCredit)}</p>
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
          icon="🏛️"
          title="Porto Seguro Bank"
          totalCredit={porto.total_credit}
          clients={porto.clients}
          products={porto.products}
          accentColor="#7c3aed"
        />
        <CreditCard
          icon="🏦"
          title="BancorBras"
          totalCredit={bancorbras.total_credit}
          clients={bancorbras.clients}
          products={bancorbras.products}
          accentColor="#4f46e5"
        />
        <CreditCard
          icon="📋"
          title="Carta Contemplada"
          totalCredit={carta.total_credit}
          clients={carta.clients}
          products={carta.products}
          accentColor="#0891b2"
        />
        <CreditCard
          icon="🏠"
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
          <p className="font-serif text-4xl font-bold" style={{ color: '#7c3aed' }}>
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
              <p className="font-serif text-3xl font-bold" style={{ color: '#7c3aed' }}>{data?.total_products || 0}</p>
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
                          backgroundColor: row.product_type === 'consorcio_porto' ? '#f5f3ff' : row.product_type === 'consorcio_bancorbras' ? '#eef2ff' : '#f9fafb',
                          color: row.product_type === 'consorcio_porto' ? '#7c3aed' : row.product_type === 'consorcio_bancorbras' ? '#4f46e5' : '#6b7280'
                        }}>
                        {PRODUCT_LABELS[row.product_type] || row.product_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold" style={{ color: '#7c3aed' }}>{fmtShort(row.credit_value)}</td>
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

export default function Dashboard() {
  const { activeCRM } = useCRM();
  const [stats, setStats] = useState(null);
  const [goal, setGoal] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      const [s, g, r] = await Promise.all([
        api.getDashboardStats(),
        api.getClientsGoal(),
        api.getClientsRevenue()
      ]);
      setStats(s);
      setGoal(g);
      setRevenue(r);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function saveGoal(val) {
    try {
      await api.updateClientsGoal(parseFloat(val));
      const g = await api.getClientsGoal();
      setGoal(g);
    } catch (e) { console.error(e); }
  }

  // Show Crédito-specific dashboard
  if (activeCRM === 'credito') {
    return <CreditDashboard />;
  }

  if (loading) return (
    <div className="p-8">
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => <div key={i} className="card h-28 animate-pulse" />)}
      </div>
    </div>
  );

  const dealsByStage = (stats?.dealsByStage || []).map(d => ({
    name: STAGE_LABELS[d.stage] || d.stage,
    count: d.count,
    total: d.total || 0
  }));

  const contactsByStatus = (stats?.contactsByStatus || []).map(d => ({
    name: STATUS_LABELS[d.status] || d.status,
    value: d.count
  }));

  const aumData = (stats?.aumByClient || []).map(c => ({ name: c.name, value: c.aum }));

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl text-charcoal">Dashboard</h1>
        <p className="text-sm text-charcoal/50 font-sans mt-1">Visão geral do seu portfólio</p>
      </div>

      {/* Revenue metrics */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard label="Receita Anual" value={fmtCur(revenue?.totalAnnual)} sub={`Fee ${revenue?.fee || 0.55}% a.a.`} stripe="#355641" />
        <MetricCard label="Receita Mensal" value={fmtCur(revenue?.totalMonthly)} sub="Anual ÷ 12" stripe="#dd7752" />
        <MetricCard label="AUM Total" value={fmtCur(revenue?.totalAUM)} sub={`${revenue?.perClient?.length || 0} clientes`} stripe="#7A5137" />
        <MetricCard label="Clientes Ativos" value={revenue?.perClient?.length || 0} sub="Status: cliente" stripe="#353535" />
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
          { label: 'Prospects', value: stats?.totalContacts, color: '#355641' },
          { label: 'Novos Leads', value: stats?.newLeads, color: '#dd7752' },
          { label: 'Negócios Abertos', value: stats?.openDeals, color: '#7A5137' },
          { label: 'Negócios Ganhos', value: stats?.wonDeals, color: '#22c55e' },
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
              <Pie data={contactsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                {contactsByStatus.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
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
          <p className="font-serif text-sm mb-4">Distribuição AUM por Cliente</p>
          {aumData.length === 0 ? (
            <p className="text-sm text-charcoal/40">Nenhum cliente com AUM</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={aumData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70}>
                  {aumData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={v => fmtCur(v)} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
