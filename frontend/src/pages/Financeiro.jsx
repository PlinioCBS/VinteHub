import React, { useState, useEffect } from 'react';
import api from '../api.js';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import { CRM_CONFIG } from '../contexts/CRMContext.jsx';

function fmt(v) {
  if (!v || v === 0) return 'R$ 0';
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function fmtShort(v) {
  if (!v || v === 0) return 'R$ 0';
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(1)}K`;
  return Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function Avatar({ user }) {
  const initials = user.name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();
  if (user.photo_url) {
    return <img src={user.photo_url} className="w-12 h-12 rounded-xl object-cover" alt={user.name} />;
  }
  return (
    <div
      className="w-12 h-12 rounded-xl flex items-center justify-center font-serif font-bold text-lg text-white flex-shrink-0"
      style={{ backgroundColor: '#dd7752' }}
    >
      {initials}
    </div>
  );
}

const CRM_DISPLAY = {
  investimento: { label: 'Investimento', icon: '📈', color: '#355641' },
  cambio: { label: 'Câmbio', icon: '💱', color: '#7c3aed' },
  credito: { label: 'Crédito', icon: '💳', color: '#dd7752' },
  seguro: { label: 'Seguro', icon: '🛡️', color: '#10b981' },
};

function SummaryCard({ label, value, icon, color }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: color + '15' }}>
          {icon}
        </div>
        <p className="font-sans text-xs text-gray-500 uppercase tracking-wider leading-tight">{label}</p>
      </div>
      <p className="font-serif font-bold text-2xl" style={{ color }}>{fmtShort(value)}</p>
    </div>
  );
}

function EmployeeCard({ emp }) {
  const [expanded, setExpanded] = useState(false);
  const crm_types = Object.keys(emp.crm_commissions || {});

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors text-left"
      >
        <Avatar user={emp} />
        <div className="flex-1 min-w-0">
          <p className="font-serif font-bold text-gray-900">{emp.name}</p>
          <p className="font-sans text-xs text-gray-400">Salário base: {fmt(emp.base_salary)}</p>
        </div>
        <div className="text-right">
          <p className="font-sans text-xs text-gray-400 mb-0.5">Total do mês</p>
          <p className="font-serif font-bold text-xl" style={{ color: '#355641' }}>{fmt(emp.total_monthly)}</p>
        </div>
        <svg
          className="w-4 h-4 text-gray-400 transition-transform duration-200 flex-shrink-0"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* CRM Commissions */}
          {crm_types.length > 0 && (
            <div className="px-6 py-4 border-b border-gray-50">
              <p className="font-sans text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Comissão por CRM</p>
              <div className="space-y-2">
                {crm_types.map(crm => {
                  const cfg = CRM_DISPLAY[crm] || { label: crm, icon: '📄', color: '#6b7280' };
                  const revenue = emp.crm_revenue[crm] || 0;
                  const earned = emp.crm_earned[crm] || 0;
                  const pct = emp.crm_commissions[crm] || 0;
                  return (
                    <div
                      key={crm}
                      className="flex items-center gap-3 p-3 rounded-xl"
                      style={{ backgroundColor: cfg.color + '08' }}
                    >
                      <span className="text-lg">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="font-sans text-sm font-medium" style={{ color: cfg.color }}>{cfg.label}</span>
                        <span className="font-sans text-xs text-gray-400 ml-2">
                          {fmtShort(revenue)} {crm === 'investimento' ? 'AUM' : 'Produção'}
                        </span>
                      </div>
                      <span className="font-sans text-xs text-gray-400 mx-2">{pct}%</span>
                      <span className="font-serif text-sm font-bold" style={{ color: cfg.color }}>{fmt(earned)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Total breakdown */}
          <div className="px-6 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-xl bg-gray-50">
                <p className="font-sans text-xs text-gray-400 mb-1">Salário</p>
                <p className="font-serif font-bold text-gray-800">{fmt(emp.base_salary)}</p>
              </div>
              <div className="text-center p-3 rounded-xl" style={{ backgroundColor: '#f0f4f1' }}>
                <p className="font-sans text-xs text-gray-400 mb-1">Comissão CRM</p>
                <p className="font-serif font-bold" style={{ color: '#355641' }}>{fmt(emp.total_commission)}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MONTHS = [
  { v: 1, l: 'Janeiro' }, { v: 2, l: 'Fevereiro' }, { v: 3, l: 'Março' },
  { v: 4, l: 'Abril' }, { v: 5, l: 'Maio' }, { v: 6, l: 'Junho' },
  { v: 7, l: 'Julho' }, { v: 8, l: 'Agosto' }, { v: 9, l: 'Setembro' },
  { v: 10, l: 'Outubro' }, { v: 11, l: 'Novembro' }, { v: 12, l: 'Dezembro' },
];

const PRODUCT_LABELS = {
  consorcio_porto: 'Consórcio Porto', consorcio_bancorbras: 'Consórcio BancorBras',
  carta_contemplada: 'Carta Contemplada', financiamento: 'Financiamento',
};

function PdfImportPanel() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const fileRef = React.useRef();

  async function handleUpload() {
    if (!file) return;
    setUploading(true); setError(''); setResult(null);
    try {
      const form = new FormData();
      form.append('pdf', file);
      const res = await fetch('/api/financeiro/import-pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('vinte_token')}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao processar PDF');
      setResult(data);
    } catch (e) { setError(e.message); }
    finally { setUploading(false); }
  }

  return (
    <div className="mt-8 bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3" style={{ backgroundColor: '#faf9ff' }}>
        <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl" style={{ backgroundColor: '#7c3aed15' }}>📄</div>
        <div>
          <h3 className="font-serif font-bold text-gray-900">Importar Extrato PDF</h3>
          <p className="font-sans text-xs text-gray-400">Cruza os Nº Contrato do PDF com os produtos cadastrados e calcula comissões (desconto de 12% de imposto)</p>
        </div>
      </div>

      <div className="p-6">
        {/* Upload area */}
        <div
          onClick={() => fileRef.current?.click()}
          className="border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all hover:border-purple-300"
          style={{ borderColor: file ? '#7c3aed' : '#e5e7eb', backgroundColor: file ? '#f5f3ff' : '#fafafa' }}
        >
          <input ref={fileRef} type="file" accept=".pdf" className="hidden"
            onChange={e => { setFile(e.target.files[0]); setResult(null); setError(''); }} />
          <div className="text-3xl mb-2">{file ? '📄' : '⬆️'}</div>
          <p className="font-sans text-sm font-semibold" style={{ color: file ? '#7c3aed' : '#6b7280' }}>
            {file ? file.name : 'Clique para selecionar o PDF'}
          </p>
          {file && <p className="font-sans text-xs text-gray-400 mt-1">{(file.size / 1024).toFixed(0)} KB</p>}
          {!file && <p className="font-sans text-xs text-gray-400 mt-1">Extratos Porto, BancorBras e outros</p>}
        </div>

        <div className="flex gap-3 mt-4">
          {file && (
            <button onClick={() => { setFile(null); setResult(null); setError(''); fileRef.current.value = ''; }}
              className="px-4 py-2 rounded-xl border border-gray-200 font-sans text-sm font-medium text-gray-600 hover:bg-gray-50 transition-all">
              Limpar
            </button>
          )}
          <button onClick={handleUpload} disabled={!file || uploading}
            className="flex-1 py-2 rounded-xl font-sans text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ backgroundColor: '#7c3aed' }}>
            {uploading ? <><svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/></svg>Processando...</> : '🔍 Processar e Cruzar Dados'}
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200">
            <p className="font-sans text-sm text-red-600">⚠️ {error}</p>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className="mt-6 space-y-5">
            {/* Resumo geral */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Contratos lidos', value: result.extracted_count, color: '#355641', suffix: '' },
                { label: 'Cruzados', value: result.matched_count, color: '#7c3aed', suffix: '' },
                { label: 'Não encontrados', value: result.unmatched_count, color: '#f97316', suffix: '' },
                { label: 'Imposto (12%)', value: result.totals.tax, color: '#dc2626', isCurrency: true },
              ].map((s, i) => (
                <div key={i} className="rounded-xl p-3 text-center" style={{ backgroundColor: s.color + '10', border: `1px solid ${s.color}20` }}>
                  <p className="font-sans text-xs text-gray-500 mb-1">{s.label}</p>
                  <p className="font-serif font-bold text-lg" style={{ color: s.color }}>
                    {s.isCurrency ? fmt(s.value) : s.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Totais financeiros */}
            <div className="rounded-2xl overflow-hidden border border-gray-100">
              <div className="px-4 py-3 border-b border-gray-100" style={{ backgroundColor: '#f5f3ff' }}>
                <p className="font-sans text-xs font-bold uppercase tracking-wider" style={{ color: '#7c3aed' }}>Resumo Financeiro</p>
              </div>
              <div className="divide-y divide-gray-50">
                {[
                  { label: 'Total Bruto (PDF)', value: result.totals.raw, color: '#353535' },
                  { label: `Desconto Imposto (${(result.tax_rate * 100).toFixed(0)}%)`, value: -result.totals.tax, color: '#dc2626' },
                  { label: 'Líquido após imposto', value: result.totals.net, color: '#355641' },
                  { label: 'Total Comissões Funcionários', value: result.totals.employee_commission, color: '#7c3aed', bold: true },
                ].map((row, i) => (
                  <div key={i} className="flex justify-between items-center px-4 py-3">
                    <span className="font-sans text-sm text-gray-600">{row.label}</span>
                    <span className={`font-${row.bold ? 'serif font-bold text-lg' : 'sans text-sm font-semibold'}`} style={{ color: row.color }}>
                      {row.value < 0 ? `- ${fmt(-row.value)}` : fmt(row.value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Por funcionário */}
            {result.by_employee.length > 0 && (
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-wider text-gray-500 mb-3">Comissão por Funcionário</p>
                <div className="space-y-3">
                  {result.by_employee.map((emp, i) => (
                    <div key={i} className="rounded-xl border border-gray-100 overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-3" style={{ backgroundColor: '#f5f3ff' }}>
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center font-serif font-bold text-sm text-white flex-shrink-0" style={{ backgroundColor: '#7c3aed' }}>
                            {emp.employee_name?.[0]?.toUpperCase() || '?'}
                          </div>
                          <span className="font-sans text-sm font-semibold text-gray-800">{emp.employee_name}</span>
                          <span className="font-sans text-xs text-gray-400">({emp.items.length} contrato{emp.items.length !== 1 ? 's' : ''})</span>
                        </div>
                        <span className="font-serif font-bold text-lg" style={{ color: '#7c3aed' }}>{fmt(emp.total_commission)}</span>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {emp.items.map((item, j) => (
                          <div key={j} className="flex items-center justify-between px-4 py-2.5 text-xs font-sans">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono font-semibold text-gray-700">#{item.contract_number}</span>
                              <span className="text-gray-400">{item.client_name}</span>
                              {item.group_number && <span className="text-gray-400">Gr.{item.group_number}</span>}
                              {item.quota_number && <span className="text-gray-400">Ct.{item.quota_number}</span>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className="text-gray-500 line-through mr-2">{fmt(item.raw_commission)}</span>
                              <span className="font-semibold" style={{ color: '#7c3aed' }}>{fmt(item.employee_commission)}</span>
                              <span className="text-gray-400 ml-1">({item.employee_commission_pct}%)</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Não encontrados */}
            {result.unmatched.length > 0 && (
              <div>
                <p className="font-sans text-xs font-bold uppercase tracking-wider text-orange-500 mb-2">
                  ⚠️ {result.unmatched.length} contrato{result.unmatched.length !== 1 ? 's' : ''} não encontrado{result.unmatched.length !== 1 ? 's' : ''} no cadastro
                </p>
                <div className="rounded-xl border border-orange-100 bg-orange-50 divide-y divide-orange-100">
                  {result.unmatched.map((u, i) => (
                    <div key={i} className="flex items-center justify-between px-4 py-2.5 text-xs font-sans">
                      <span className="font-mono font-semibold text-orange-700">#{u.contract_number}</span>
                      <span className="font-semibold text-orange-600">{fmt(u.raw_commission)}</span>
                    </div>
                  ))}
                </div>
                <p className="font-sans text-xs text-gray-400 mt-1.5">Cadastre esses Nº Contrato em Clientes → CRM Crédito → Produtos</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function Financeiro() {
  const { isMaster } = useAuth();
  const navigate = useNavigate();

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isMaster) { navigate('/'); return; }
    loadData();
  }, [month, year]);

  async function loadData() {
    setLoading(true);
    try {
      const result = await api.getFinanceiroOverview({ month, year });
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="p-8 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-8">
        <div>
          <h1 className="font-serif font-bold text-3xl text-gray-900">Financeiro</h1>
          <p className="font-sans text-sm text-gray-400 mt-1">Visão consolidada de remuneração da equipe</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={month}
            onChange={e => setMonth(parseInt(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none"
            style={{ color: '#111827' }}
          >
            {MONTHS.map(m => <option key={m.v} value={m.v}>{m.l}</option>)}
          </select>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            className="px-3 py-2 rounded-xl border border-gray-200 font-sans text-sm outline-none"
            style={{ color: '#111827' }}
          >
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
          <div className="h-48 bg-gray-100 rounded-2xl animate-pulse" />
        </div>
      ) : data ? (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <SummaryCard label="Total Folha" value={data.totals.total_salaries} icon="👥" color="#355641" />
            <SummaryCard label="Comissão CRM" value={data.totals.total_crm_commissions} icon="📈" color="#7c3aed" />
            <SummaryCard label="Total Geral" value={data.totals.grand_total} icon="💵" color="#10b981" />
          </div>

          {/* Employee cards */}
          <div className="space-y-4">
            {data.employees.map(emp => (
              <EmployeeCard key={emp.id} emp={emp} />
            ))}
          </div>

          {/* PDF Import Panel */}
          <PdfImportPanel />

          {/* Grand total banner */}
          <div
            className="mt-8 rounded-2xl p-6 flex items-center justify-between"
            style={{ background: 'linear-gradient(135deg, #355641 0%, #2a4533 100%)' }}
          >
            <div>
              <p className="font-sans text-white/70 text-sm">Total da folha —</p>
              <p className="font-sans text-white/70 text-xs mt-0.5">
                {MONTHS.find(m => m.v === month)?.l} {year} · {data.employees.length} funcionário{data.employees.length !== 1 ? 's' : ''}
              </p>
            </div>
            <div className="text-right">
              <p className="font-sans text-white/60 text-xs uppercase tracking-wider mb-1">Total Geral</p>
              <p className="font-serif font-bold text-3xl text-white">{fmt(data.totals.grand_total)}</p>
            </div>
          </div>
        </>
      ) : (
        <div className="text-center py-20 text-gray-400">
          <p className="font-sans text-sm">Erro ao carregar dados financeiros</p>
        </div>
      )}
    </div>
  );
}
