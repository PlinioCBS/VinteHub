import React, { useState, useRef, useMemo } from 'react';
import { useCRM } from '../contexts/CRMContext.jsx';
import {
  ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts';

// ─── Formatters ───────────────────────────────────────────────────────────────
const fmtBRL = (v) => {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2 });
};
const fmtPct = (v) => {
  if (v == null || isNaN(v) || !isFinite(v)) return '—';
  return (v * 100).toFixed(2) + '%';
};

// ─── Simulation configs for each vertical ─────────────────────────────────────
const CONFIGS = {
  imovel: {
    label: 'Imóvel',
    provider: 'Porto Seguro Bank — Imóvel',
    color: '#7c3aed',
    maxEmbutidoPct: 0.30,
    lancePcts: [0.30, 0.40],
    defaults: {
      credito: 280000, tipo: 'Física', prazo: 200,
      redutor: 50, usarCampanha: false, primeirasParcelas: 12,
      taxaAdm: 9.5, fundoReserva: 2, seguroVida: 0, adesaoPercent: 0,
      recursosProprios: 0, fgts: 0, lanceEmbutido: 0, contemplacaoParcela: 0,
    },
  },
  auto: {
    label: 'Auto',
    provider: 'Porto Seguro Bank — Auto',
    color: '#4f46e5',
    maxEmbutidoPct: 0.20,
    lancePcts: [0.30, 0.40],
    defaults: {
      credito: 50000, tipo: 'Física', prazo: 72,
      redutor: 50, usarCampanha: false, primeirasParcelas: 12,
      taxaAdm: 9, fundoReserva: 2, seguroVida: 0.038, adesaoPercent: 0,
      recursosProprios: 0, fgts: 0, lanceEmbutido: 0, contemplacaoParcela: 0,
    },
  },
  pesados: {
    label: 'Pesados',
    provider: 'Porto Seguro Bank — Pesados',
    color: '#0891b2',
    maxEmbutidoPct: 0.30,
    lancePcts: [0.30, 0.40],
    defaults: {
      credito: 180000, tipo: 'Física', prazo: 120,
      redutor: 50, usarCampanha: false, primeirasParcelas: 12,
      taxaAdm: 7, fundoReserva: 2, seguroVida: 0.038, adesaoPercent: 0,
      recursosProprios: 0, fgts: 0, lanceEmbutido: 0, contemplacaoParcela: 0,
    },
  },
};

// ─── Core engine (shared for all three verticals) ─────────────────────────────
function calcConsoricio(form, config) {
  const { credito, tipo, prazo, redutor, primeirasParcelas, taxaAdm,
    fundoReserva, seguroVida, adesaoPercent = 0,
    recursosProprios, fgts, lanceEmbutido, contemplacaoParcela } = form;
  if (!credito || !prazo) return null;

  const txAdm  = taxaAdm / 100;
  const fndRes = fundoReserva / 100;
  const segVid = seguroVida / 100;
  const adesao = (adesaoPercent || 0) / 100;
  const redPct = form.usarCampanha ? 'campanha' : redutor / 100;

  // Base de cálculo
  const P50 = credito * (1 + txAdm + fndRes);
  // Seguro
  const P51 = P50 * segVid;
  // Parcelas normais
  const P52_PF = (P50 / prazo) + P51;
  const P53_PJ = P50 / prazo;
  // Parcelas reduzidas
  const P55_PJ_red = redPct === 'campanha'
    ? P50 / 200
    : (P50 / prazo) * (1 - redPct);
  const P54_PF_red = P55_PJ_red + P51;

  // Base integral c/ adesão (para lance fixo)
  const L54 = credito * (1 + adesao + txAdm + fndRes);
  // Adesão
  const P57 = credito * adesao;
  const adesao_parc = primeirasParcelas > 0 ? P57 / primeirasParcelas : 0;

  const parcela_reduzida = tipo === 'Jurídica' ? P55_PJ_red : P54_PF_red;
  const parcela_normal   = tipo === 'Jurídica' ? P53_PJ    : P52_PF;
  const parcela_fase1    = adesao_parc + parcela_reduzida;
  const parcela_fase2    = parcela_normal;

  // Lance
  const totalLance = recursosProprios + fgts + lanceEmbutido;
  const representatividade = L54 > 0 ? totalLance / L54 : 0;
  const max_embutido = credito * config.maxEmbutidoPct;
  const lance_fixos  = config.lancePcts.map(p => ({ pct: p, valor: L54 * p }));

  // Pós-contemplação
  const contemp = contemplacaoParcela || 0;
  const P70 = P50 - (P53_PJ * contemp) - totalLance;
  const P71 = P50 - (P55_PJ_red * contemp) - totalLance;
  const P72 = (redPct !== 0 && redPct !== 'campanha') ? P71 * segVid : P70 * segVid;
  const parc_rest = prazo - contemp;
  const P73 = parc_rest > 0
    ? ((redPct !== 0 && redPct !== 'campanha') ? P71 / parc_rest : P70 / parc_rest)
    : 0;
  const P74 = P73 < (P53_PJ / 2) ? P53_PJ / 2 : P73;
  const P75 = P74 + P72;
  const P76 = P74 > 0
    ? ((redPct !== 0 && redPct !== 'campanha') ? P71 / P74 : P70 / P74)
    : 0;

  // Taxas antecipadas
  const taxa_mes = prazo > 0 ? txAdm / prazo : 0;
  const taxa_ano = taxa_mes * 12;

  return {
    P50, L54,
    parcela_normal_PF: P52_PF, parcela_normal_PJ: P53_PJ,
    parcela_reduzida_PF: P54_PF_red, parcela_reduzida_PJ: P55_PJ_red,
    parcela_fase1, parcela_fase2, parcela_reduzida, parcela_normal,
    primeirasParcelas, adesao_total: P57, adesao_parc,
    totalLance, representatividade, lance_fixos, max_embutido,
    saldo_dev_normal: P70, saldo_dev_reduzida: P71,
    nova_parcela_PJ: P74, nova_parcela_PF: P75, novo_prazo: Math.round(P76),
    taxa_mes, taxa_ano,
  };
}

// ─── PDF Export (in-page DOM injection — sem popup) ───────────────────────────
function exportPDF(form, result, config) {
  if (!result) return;

  const totalLance = form.recursosProprios + form.fgts + form.lanceEmbutido;
  const temReductor = form.redutor > 0 || form.usarCampanha;
  const temLance = totalLance > 0;
  const temContemplacao = form.contemplacaoParcela > 0;
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const logoUrl = window.location.origin + '/Logo_Vinte_green.png';

  const row = (label, value, accent = false, indent = false) => `
    <tr style="background:${accent ? 'rgba(124,58,237,0.08)' : '#ffffff'}">
      <td style="padding:7px 14px;font-size:12.5px;color:${indent ? '#9ca3af' : '#374151'};padding-left:${indent ? '28px' : '14px'};">${label}</td>
      <td style="padding:7px 14px;text-align:right;font-weight:700;font-size:12.5px;color:${accent ? config.color : '#111827'};">${value}</td>
    </tr>`;

  const section = (title, color, rows) => `
    <div style="margin-bottom:16px;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
      <div style="background:${color};padding:9px 14px;">
        <span style="color:white;font-weight:700;font-size:12.5px;letter-spacing:.4px;">${title}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:white;">${rows}</table>
    </div>`;

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;color:#111827;background:white;padding:28px 32px;max-width:780px;margin:0 auto;">

      <div style="display:flex;align-items:center;justify-content:space-between;padding-bottom:16px;border-bottom:3px solid ${config.color};margin-bottom:22px;">
        <img src="${logoUrl}" alt="Vinte Hub" style="height:52px;object-fit:contain;" crossorigin="anonymous"/>
        <div style="text-align:right;">
          <p style="font-size:17px;font-weight:700;color:#1f2937;margin:0;">Simulação de Consórcio</p>
          <p style="font-size:12px;color:#6b7280;margin:3px 0 0;">${config.provider}</p>
          <p style="font-size:11px;color:#9ca3af;margin:2px 0 0;">${dataHoje}</p>
        </div>
      </div>

      ${section('Parâmetros da Simulação', '#374151', `
        ${row('Crédito Contratado', fmtBRL(form.credito))}
        ${row('Tipo de Contratação', form.tipo)}
        ${row('Prazo Total', `${form.prazo} parcelas`)}
        ${row('Taxa Administrativa', `${form.taxaAdm}%`)}
        ${row('Fundo de Reserva', `${form.fundoReserva}%`)}
        ${form.seguroVida > 0 ? row('Seguro de Vida PF', `${form.seguroVida}%`) : ''}
        ${(form.adesaoPercent || 0) > 0 ? row('Taxa de Adesão', `${form.adesaoPercent}%`) : ''}
        ${temReductor ? row('Redutor', form.usarCampanha ? 'Campanha Parcela Original' : `${form.redutor}%`) : ''}
        ${temReductor ? row('Parcelas com Redutor', `${form.primeirasParcelas} parcelas`) : ''}
      `)}

      ${section('Resumo do Crédito', config.color, `
        ${row('Crédito Contratado', fmtBRL(form.credito))}
        ${row('Base de Cálculo (com taxas)', fmtBRL(result.P50))}
        ${(form.adesaoPercent || 0) > 0 ? row('Taxa de Adesão (total)', fmtBRL(result.adesao_total)) : ''}
      `)}

      ${section('Parcelas', '#4f46e5', `
        ${temReductor
          ? row(`Parcelas 1 a ${result.primeirasParcelas}${(form.adesaoPercent || 0) > 0 ? ' (com redutor + adesão)' : ' (com redutor)'}`, fmtBRL(result.parcela_fase1))
            + row(`Parcelas ${result.primeirasParcelas + 1} em diante`, fmtBRL(result.parcela_fase2), true)
          : row('Parcela', fmtBRL(result.parcela_normal), true)
        }
        ${row('Parcela PF — Normal', fmtBRL(result.parcela_normal_PF))}
        ${row('Parcela PJ — Normal', fmtBRL(result.parcela_normal_PJ))}
        ${temReductor ? row('Parcela PF — Reduzida', fmtBRL(result.parcela_reduzida_PF)) : ''}
        ${temReductor ? row('Parcela PJ — Reduzida', fmtBRL(result.parcela_reduzida_PJ)) : ''}
      `)}

      ${section('Oferta de Lance', '#0891b2', `
        ${result.lance_fixos.map(lf => row(`Lance Fixo ${(lf.pct * 100).toFixed(0)}%`, fmtBRL(lf.valor))).join('')}
        ${row('Máx. Lance Embutido', fmtBRL(result.max_embutido))}
        ${temLance ? row('Total do Lance Ofertado', fmtBRL(totalLance), true) : ''}
        ${temLance ? row('Representatividade', fmtPct(result.representatividade)) : ''}
        ${form.recursosProprios > 0 ? row('Recurso Próprio', fmtBRL(form.recursosProprios), false, true) : ''}
        ${form.fgts > 0 ? row('FGTS', fmtBRL(form.fgts), false, true) : ''}
        ${form.lanceEmbutido > 0 ? row('Lance Embutido', fmtBRL(form.lanceEmbutido), false, true) : ''}
      `)}

      ${temContemplacao ? section(`Estimativa Pós-Contemplação (parcela ${form.contemplacaoParcela})`, '#059669', `
        ${row('Saldo Devedor', fmtBRL(form.tipo === 'Física' || form.redutor > 0 ? result.saldo_dev_reduzida : result.saldo_dev_normal))}
        ${row('Nova Parcela PF', fmtBRL(result.nova_parcela_PF), true)}
        ${row('Nova Parcela PJ', fmtBRL(result.nova_parcela_PJ))}
        ${row('Novo Prazo Estimado', `${result.novo_prazo} parcelas`)}
      `) : ''}

      ${section('Demonstrativo de Taxas', '#dd7752', `
        ${row('Taxa Adm. Diluída (total)', fmtPct((form.taxaAdm || 0) / 100))}
        ${row('Taxa Antecipada Mensal', fmtPct(result.taxa_mes))}
        ${row('Taxa Antecipada Anual', fmtPct(result.taxa_ano))}
        ${row('Fundo de Reserva', fmtPct((form.fundoReserva || 0) / 100))}
      `)}

      <div style="margin-top:20px;padding:12px 14px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
        <p style="font-size:10.5px;color:#6b7280;line-height:1.6;margin:0;">
          * Os valores da simulação são mera referência e buscam refletir o cenário mais próximo da realidade possível.
          Sujeito à disponibilidade de vagas no grupo. As parcelas, taxas e condições podem variar conforme o grupo disponível.
          Consulte seu consultor para informações atualizadas.
        </p>
      </div>

      <div style="margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;display:flex;justify-content:space-between;align-items:center;">
        <p style="font-size:10.5px;color:#9ca3af;margin:0;">Gerado pelo VinteHub CRM</p>
        <p style="font-size:10.5px;color:#9ca3af;margin:0;">${dataHoje}</p>
      </div>
    </div>`;

  // Inject print style and a sibling div to #root
  const styleEl = document.createElement('style');
  styleEl.id = 'vinte-print-style';
  styleEl.textContent = `
    @media print {
      @page { margin: 10mm 8mm; size: A4 portrait; }
      body > *:not(#vinte-print-root) { display: none !important; }
      #vinte-print-root { display: block !important; }
    }
    #vinte-print-root { display: none; }
  `;
  document.head.appendChild(styleEl);

  const printRoot = document.createElement('div');
  printRoot.id = 'vinte-print-root';
  printRoot.innerHTML = html;
  document.body.appendChild(printRoot);

  const cleanup = () => {
    document.head.removeChild(styleEl);
    document.body.removeChild(printRoot);
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  // Safari fallback: if afterprint doesn't fire
  setTimeout(() => {
    if (document.getElementById('vinte-print-root')) cleanup();
  }, 3000);

  window.print();
}

// ─── UI Components ────────────────────────────────────────────────────────────
function Label({ children }) {
  return (
    <label className="block font-sans text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wider">
      {children}
    </label>
  );
}

function NumInput({ label, value, onChange, prefix, suffix, step = '0.01', min = '0' }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{prefix}</span>}
        <input
          type="number" step={step} min={min} value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className={`w-full py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all bg-white ${prefix ? 'pl-9 pr-3' : suffix ? 'pl-3 pr-8' : 'px-3'}`}
          style={{ color: 'var(--text-primary)' }}
          onFocus={e => { e.target.style.borderColor = '#7c3aed'; e.target.style.boxShadow = '0 0 0 3px #7c3aed15'; }}
          onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
      </div>
    </div>
  );
}

function ResultRow({ label, value, accent = false, sub, indented }) {
  return (
    <div className={`flex items-center justify-between py-2 ${accent ? 'border-t border-gray-100 mt-1 pt-3' : ''}`}>
      <div>
        <span className={`font-sans text-sm ${indented ? 'pl-4 text-gray-400 text-xs' : 'text-gray-600'}`}>{label}</span>
        {sub && <p className="font-sans text-xs text-gray-400">{sub}</p>}
      </div>
      <span className={`font-sans font-bold ${accent ? 'text-base' : 'text-sm'}`}
        style={{ color: accent ? '#7c3aed' : 'var(--text-primary)' }}>{value}</span>
    </div>
  );
}

function Card({ title, color = '#7c3aed', children }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="h-1 w-full" style={{ backgroundColor: color }} />
      <div className="p-5">
        <h3 className="font-serif font-bold text-sm mb-3" style={{ color }}>{title}</h3>
        <div className="divide-y divide-gray-50">{children}</div>
      </div>
    </div>
  );
}

// ─── Shared Simulator Component ───────────────────────────────────────────────
function Simulador({ configKey }) {
  const config = CONFIGS[configKey];
  const [form, setForm] = useState({ ...config.defaults });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const result = calcConsoricio(form, config);
  const totalLance = form.recursosProprios + form.fgts + form.lanceEmbutido;
  const temReductor = form.redutor > 0 || form.usarCampanha;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

      {/* ── FORMULÁRIO ── */}
      <div className="space-y-5">

        {/* Dados do Crédito */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-serif font-bold text-sm text-gray-700 mb-4 pb-2 border-b border-gray-100">Dados do Crédito</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <NumInput label="Crédito Contratado (R$)" value={form.credito} onChange={v => f('credito', v)} prefix="R$" step="1000" />
            </div>
            <div>
              <Label>Tipo de Contratação</Label>
              <div className="flex gap-2">
                {['Física', 'Jurídica'].map(t => (
                  <button key={t} type="button" onClick={() => f('tipo', t)}
                    className="flex-1 py-2.5 rounded-xl border font-sans text-sm font-medium transition-all"
                    style={{
                      backgroundColor: form.tipo === t ? config.color + '18' : 'var(--bg-page)',
                      borderColor: form.tipo === t ? config.color : '#e5e7eb',
                      color: form.tipo === t ? config.color : '#6b7280',
                      fontWeight: form.tipo === t ? 700 : 400,
                    }}>{t}</button>
                ))}
              </div>
            </div>
            <NumInput label="Prazo (parcelas)" value={form.prazo} onChange={v => f('prazo', v)} step="1" min="1" />
          </div>
        </div>

        {/* Taxas */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-serif font-bold text-sm text-gray-700 mb-4 pb-2 border-b border-gray-100">Taxas do Grupo</h3>
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Taxa Administrativa (%)" value={form.taxaAdm} onChange={v => f('taxaAdm', v)} suffix="%" step="0.01" />
            <NumInput label="Fundo de Reserva (%)" value={form.fundoReserva} onChange={v => f('fundoReserva', v)} suffix="%" step="0.01" />
            <NumInput label="Seguro de Vida PF (%)" value={form.seguroVida} onChange={v => f('seguroVida', v)} suffix="%" step="0.001" />
            <NumInput label="Taxa de Adesão (%)" value={form.adesaoPercent || 0} onChange={v => f('adesaoPercent', v)} suffix="%" step="0.01" />
          </div>
        </div>

        {/* Redutor */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-serif font-bold text-sm text-gray-700 mb-4 pb-2 border-b border-gray-100">Redutor da Parcela</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <button type="button" onClick={() => f('usarCampanha', !form.usarCampanha)}
                className="flex items-center gap-2 text-sm font-sans font-medium"
                style={{ color: form.usarCampanha ? config.color : '#6b7280' }}>
                <div className="w-9 h-5 rounded-full relative transition-colors"
                  style={{ backgroundColor: form.usarCampanha ? config.color : '#d1d5db' }}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-0.5 transition-all shadow-sm ${form.usarCampanha ? 'left-4' : 'left-0.5'}`} />
                </div>
                Campanha Parcela Original
              </button>
            </div>
            {!form.usarCampanha && (
              <NumInput label="Redutor (%)" value={form.redutor}
                onChange={v => f('redutor', Math.min(100, Math.max(0, v)))} suffix="%" step="5" min="0" />
            )}
            <NumInput label="Parcelas com redutor" value={form.primeirasParcelas}
              onChange={v => f('primeirasParcelas', v)} step="1" min="1" />
          </div>
        </div>

        {/* Lance */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-serif font-bold text-sm text-gray-700 mb-4 pb-2 border-b border-gray-100">Oferta de Lance</h3>
          <div className="space-y-4">
            <NumInput label="Recurso Próprio (R$)" value={form.recursosProprios} onChange={v => f('recursosProprios', v)} prefix="R$" step="1000" />
            <NumInput label="FGTS (R$)" value={form.fgts} onChange={v => f('fgts', v)} prefix="R$" step="1000" />
            <NumInput label="Lance Embutido (R$)" value={form.lanceEmbutido} onChange={v => f('lanceEmbutido', v)} prefix="R$" step="1000" />
          </div>
          {result && totalLance > 0 && (
            <div className="mt-4 p-3 rounded-xl text-center" style={{ backgroundColor: config.color + '12', border: `1px solid ${config.color}30` }}>
              <p className="font-sans text-xs text-gray-500 mb-0.5">Representatividade do Lance</p>
              <p className="font-serif font-bold text-2xl" style={{ color: config.color }}>{fmtPct(result.representatividade)}</p>
            </div>
          )}
        </div>

        {/* Contemplação */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-serif font-bold text-sm text-gray-700 mb-4 pb-2 border-b border-gray-100">Pós-Contemplação</h3>
          <NumInput label="Contemplação na parcela nº" value={form.contemplacaoParcela}
            onChange={v => f('contemplacaoParcela', v)} step="1" min="0" />
        </div>
      </div>

      {/* ── RESULTADOS ── */}
      {result ? (
        <div className="space-y-4">

          <Card title="Resumo do Crédito" color={config.color}>
            <ResultRow label="Crédito Contratado" value={fmtBRL(form.credito)} />
            <ResultRow label="Base de Cálculo (com taxas)" value={fmtBRL(result.P50)} />
            {(form.adesaoPercent || 0) > 0 && <ResultRow label="Taxa de Adesão" value={fmtBRL(result.adesao_total)} />}
            <ResultRow label="Taxa Administrativa" value={`${form.taxaAdm}%`} />
            <ResultRow label="Fundo de Reserva" value={`${form.fundoReserva}%`} />
          </Card>

          <Card title="Parcelas" color="#4f46e5">
            {temReductor ? (
              <>
                <ResultRow label={`Parcelas 1 a ${result.primeirasParcelas} (com redutor)`} value={fmtBRL(result.parcela_fase1)} />
                <ResultRow label={`Parcelas ${result.primeirasParcelas + 1} em diante`} value={fmtBRL(result.parcela_fase2)} accent />
              </>
            ) : (
              <ResultRow label="Parcela" value={fmtBRL(result.parcela_normal)} accent />
            )}
            <div className="pt-3 mt-2 grid grid-cols-2 gap-2">
              {[
                { label: 'PF Normal', value: fmtBRL(result.parcela_normal_PF) },
                { label: 'PJ Normal', value: fmtBRL(result.parcela_normal_PJ) },
                ...(temReductor ? [
                  { label: 'PF Reduzida', value: fmtBRL(result.parcela_reduzida_PF), hl: true },
                  { label: 'PJ Reduzida', value: fmtBRL(result.parcela_reduzida_PJ), hl: true },
                ] : [])
              ].map(({ label, value, hl }) => (
                <div key={label} className="rounded-xl p-3 text-center"
                  style={{ backgroundColor: hl ? config.color + '12' : 'var(--bg-page)' }}>
                  <p className="font-sans text-xs text-gray-400 mb-0.5">{label}</p>
                  <p className="font-sans font-bold text-sm" style={{ color: hl ? config.color : 'var(--text-primary)' }}>{value}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Oferta de Lance" color="#0891b2">
            {result.lance_fixos.map(lf => (
              <ResultRow key={lf.pct} label={`Lance Fixo ${(lf.pct * 100).toFixed(0)}%`} value={fmtBRL(lf.valor)} />
            ))}
            <ResultRow label={`Máx. Embutido (${(config.maxEmbutidoPct * 100).toFixed(0)}% do crédito)`} value={fmtBRL(result.max_embutido)} />
            {totalLance > 0 && <>
              <ResultRow label="Total do Lance" value={fmtBRL(totalLance)} accent />
              <ResultRow label="Representatividade" value={fmtPct(result.representatividade)} />
            </>}
          </Card>

          {form.contemplacaoParcela > 0 && (
            <Card title={`Pós-Contemplação (parcela ${form.contemplacaoParcela})`} color="#059669">
              <ResultRow label="Saldo Devedor"
                value={fmtBRL(form.tipo === 'Física' || form.redutor > 0 ? result.saldo_dev_reduzida : result.saldo_dev_normal)} />
              <ResultRow label="Nova Parcela PF" value={fmtBRL(result.nova_parcela_PF)} accent />
              <ResultRow label="Nova Parcela PJ" value={fmtBRL(result.nova_parcela_PJ)} />
              <ResultRow label="Novo Prazo" value={`${result.novo_prazo} parcelas`} />
            </Card>
          )}

          <Card title="Demonstrativo de Taxas" color="#dd7752">
            <ResultRow label="Taxa Adm. Diluída (total)" value={`${form.taxaAdm}%`} />
            <ResultRow label="Taxa Antecipada Mensal" value={fmtPct(result.taxa_mes)} />
            <ResultRow label="Taxa Antecipada Anual" value={fmtPct(result.taxa_ano)} />
            <ResultRow label="Fundo de Reserva" value={`${form.fundoReserva}%`} />
          </Card>

          {/* BOTÃO PDF */}
          <button
            onClick={() => exportPDF(form, result, config)}
            className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-sans font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
            style={{ backgroundColor: '#355641' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v6m-3-3l3 3 3-3" />
            </svg>
            Exportar Relatório em PDF
          </button>

          <p className="font-sans text-xs text-gray-400 text-center leading-relaxed px-2">
            * Valores de referência. Sujeito à disponibilidade de vagas no grupo.
          </p>
        </div>
      ) : (
        <div className="flex items-center justify-center h-48 rounded-2xl border border-dashed border-gray-200">
          <p className="font-sans text-sm text-gray-400">Preencha os dados para ver a simulação</p>
        </div>
      )}
    </div>
  );
}

// ─── Simulador de Investimentos (juros compostos + projeção) ─────────────────
const INV_COLOR = '#355641';

// Campo numérico com tema verde (investimento)
function InvField({ label, value, onChange, prefix, suffix, step = '1', min = '0', hint }) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{prefix}</span>}
        <input
          type="number" step={step} min={min} value={value}
          onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))}
          className={`w-full py-2.5 rounded-xl border border-gray-200 font-sans text-sm outline-none transition-all bg-white ${prefix ? 'pl-9 pr-3' : suffix ? 'pl-3 pr-9' : 'px-3'}`}
          style={{ color: 'var(--text-primary)' }}
          onFocus={e => { e.target.style.borderColor = INV_COLOR; e.target.style.boxShadow = `0 0 0 3px ${INV_COLOR}15`; }}
          onBlur={e => { e.target.style.borderColor = '#e5e7eb'; e.target.style.boxShadow = 'none'; }}
        />
        {suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{suffix}</span>}
      </div>
      {hint && <p className="font-sans text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  );
}

// Gera a série anual de acúmulo com juros compostos (capitalização mensal).
function buildProjection({ aporteUnico, aporteMensal, anos, rateAnual }) {
  const m = Math.pow(1 + rateAnual, 1 / 12) - 1; // taxa mensal equivalente
  const months = Math.round(anos * 12);
  let bal = aporteUnico;
  const out = [bal];
  for (let i = 1; i <= months; i++) {
    bal = bal * (1 + m) + aporteMensal;
    if (i % 12 === 0) out.push(bal);
  }
  return out; // índice = ano (0..anos)
}

// Paleta da marca 20B (guia de rebranding)
const BRAND = {
  green:     '#355641',
  greenDark: '#2d4a38',
  copper:    '#dd7752',
  charcoal:  '#353535',
  brown:     '#7A5137',
  gray:      '#d9d9d6',
};

// Texto de disclaimer ("Sobre este material") — parágrafos sem espaçamento entre eles.
const INV_DISCLAIMER = [
  'Este material é um breve resumo de cunho meramente informativo, não configurando análise de valores mobiliários nos termos da regulamentação aplicável da Comissão de Valores Mobiliários (CVM), nem tendo como objetivo a oferta, solicitação de oferta ou recomendação para compra ou venda de qualquer investimento ou produto específico.',
  'Trata-se de uma ferramenta de simulação com utilização de algoritmos, não configurando abertura ou compromisso de início de relacionamento comercial, tampouco oferta de qualquer produto e/ou serviço.',
  'Embora as informações e opiniões expressas neste documento tenham sido obtidas de fontes consideradas confiáveis e fidedignas, nenhuma garantia ou responsabilidade, expressa ou implícita, é feita quanto à exatidão, fidelidade e/ou integralidade das informações. Todas as informações, opiniões e valores eventualmente indicados estão sujeitos a alterações sem aviso prévio.',
  { b: true, t: 'RENTABILIDADE PASSADA NÃO REPRESENTA GARANTIA DE RENTABILIDADE FUTURA.' },
  { b: true, t: 'LEIA O FORMULÁRIO DE INFORMAÇÕES COMPLEMENTARES, A LÂMINA DE INFORMAÇÕES ESSENCIAIS E O REGULAMENTO ANTES DE INVESTIR.' },
  { b: true, t: 'FUNDOS DE INVESTIMENTO NÃO CONTAM COM GARANTIA DO ADMINISTRADOR, DO GESTOR, DE QUALQUER MECANISMO DE SEGURO OU DO FUNDO GARANTIDOR DE CRÉDITOS (FGC).' },
  'Este material não deve ser utilizado como única fonte de informações no processo decisório do investidor, que, antes de tomar qualquer decisão, deverá realizar avaliação minuciosa do produto e de seus respectivos riscos, considerando seus objetivos pessoais e perfil de risco (Suitability).',
  'É importante ressaltar que a rentabilidade passada não representa garantia de desempenho futuro. Dessa forma, não é possível prever o desempenho futuro de um investimento com base na variação histórica de seu valor de mercado.',
  'A rentabilidade divulgada não é líquida de impostos.',
  'Os cenários de investimento aqui apresentados consideram projeções calculadas com base em metodologia interna, levando em conta, dentre outras variáveis, a rentabilidade histórica dos produtos e/ou o tempo mínimo de investimento, não constituindo, sob qualquer hipótese, promessa ou garantia da rentabilidade aqui demonstrada.',
  'Quando não utilizados dados históricos do(s) fundo(s) mencionado(s), poderão ser consideradas, para fins de simulação, informações de portfólios de mesma classe e nível de risco, e/ou geridos pelo mesmo gestor de recursos, e/ou dados referenciados em fundo espelho, quando aplicável.',
  'Existem riscos inerentes aos diversos mercados financeiros, podendo ocorrer variações no patrimônio investido, inclusive perda total do capital investido.',
  'Embora este material reflita as condições econômicas existentes à época de sua elaboração, não há garantia de que uma transação possa ser efetivamente realizada nos níveis aqui especificados, estando sujeita às condições vigentes na data da aplicação.',
  'Não há qualquer garantia de obtenção de lucros, tampouco responsabilidade por eventuais perdas decorrentes das decisões de investimento tomadas com base neste material.',
  'As opiniões e projeções aqui apresentadas não representam necessariamente posicionamento institucional, podendo instituições financeiras, seus controladores, subsidiárias, coligadas e colaboradores, eventualmente, possuir posições compradas ou vendidas, atuar em nome próprio e/ou participar como coordenadores ou agentes em operações envolvendo ações ou outros investimentos relevantes.',
  'Este material é de uso exclusivo para fins informativos e não poderá ser reproduzido, distribuído ou ter suas cópias circuladas sem autorização prévia e expressa do respectivo titular de seus direitos.',
];

// PDF da projeção de investimento (injeção no DOM + print — sem popup)
// Layout inspirado no relatório de referência, com a identidade da marca 20B.
function exportInvestimentoPDF(form, calc, chartSvgHtml) {
  const dataHoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const logoUrl = window.location.origin + '/Logo_Vinte_green.png';
  const periodo = `${calc.anos} ${calc.anos > 1 ? 'anos' : 'ano'}`;
  const serif = "'Libre Baskerville', Georgia, 'Times New Roman', serif";
  const sans  = "'Lato', 'Helvetica Neue', Arial, sans-serif";

  // Linha "rótulo → valor" de uma tabela limpa
  const kvRow = (label, value, accent = false) => `
    <tr style="border-bottom:1px solid #eceae7;">
      <td style="padding:10px 2px;font-size:12px;color:${BRAND.charcoal};">${label}</td>
      <td style="padding:10px 2px;text-align:right;font-weight:700;font-size:12px;color:${accent ? BRAND.green : BRAND.charcoal};">${value}</td>
    </tr>`;

  // Seção no estilo do relatório de referência: título serif + descrição + régua + conteúdo
  // page-break-inside:avoid impede que o título fique órfão (separado do conteúdo).
  const section = (title, desc, inner) => `
    <div style="margin-bottom:28px;page-break-inside:avoid;break-inside:avoid;">
      <h2 style="font-family:${serif};font-size:21px;color:${BRAND.green};font-weight:700;margin:0 0 4px;">${title}</h2>
      ${desc ? `<p style="font-size:11.5px;color:#8a8a87;margin:0;font-family:${sans};">${desc}</p>` : ''}
      <div style="border-top:1px solid ${BRAND.gray};margin:12px 0 14px;"></div>
      ${inner}
    </div>`;

  const kvTable = (rows) => `<table style="width:100%;border-collapse:collapse;">${rows}</table>`;

  // Item de legenda do gráfico (swatch colorido + rótulo)
  const legendItem = (color, label) => `
    <span style="display:inline-flex;align-items:center;gap:7px;font-size:10.5px;color:${BRAND.charcoal};font-family:${sans};">
      <span style="width:16px;height:3px;border-radius:2px;background:${color};display:inline-block;"></span>${label}
    </span>`;

  const yearRows = calc.data.map(d => `
    <tr style="border-bottom:1px solid #eceae7;">
      <td style="padding:7px 12px;font-size:11px;color:${BRAND.charcoal};">Ano ${d.year}</td>
      <td style="padding:7px 12px;text-align:right;font-size:11px;color:#8a8a87;">${fmtBRL(d.investido)}</td>
      <td style="padding:7px 12px;text-align:right;font-size:11px;font-weight:700;color:${BRAND.green};">${fmtBRL(d.nominal)}</td>
      <td style="padding:7px 12px;text-align:right;font-size:11px;color:${BRAND.brown};">${fmtBRL(d.benchmark)}</td>
      <td style="padding:7px 12px;text-align:right;font-size:11px;color:${BRAND.copper};">${fmtBRL(d.real)}</td>
    </tr>`).join('');

  const footer = `
    <div style="position:absolute;left:14mm;right:14mm;bottom:10mm;display:flex;justify-content:space-between;align-items:center;border-top:1px solid ${BRAND.gray};padding-top:7px;">
      <span style="font-size:9px;color:#9a9a97;font-family:${sans};">VinteHub · Soluções Financeiras 20B</span>
      <span style="font-size:9px;color:#9a9a97;font-family:${sans};">Gerado em ${dataHoje}</span>
    </div>`;

  // Cabeçalho de página no estilo da referência: texto discreto à esquerda + logo à direita
  const pageHeader = (label) => `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
      <span style="font-size:10px;color:#9a9a97;font-family:${sans};">${label}</span>
      <img src="${logoUrl}" alt="20B" style="height:26px;object-fit:contain;" crossorigin="anonymous"/>
    </div>`;

  const disclaimerHtml = INV_DISCLAIMER.map(p => {
    const bold = typeof p === 'object' && p.b;
    const text = typeof p === 'object' ? p.t : p;
    return `<p style="margin:0;text-align:justify;font-size:8.6px;line-height:1.42;color:${BRAND.charcoal};font-family:${sans};${bold ? 'font-weight:700;' : ''}">${text}</p>`;
  }).join('');

  const html = `
    <div style="font-family:${sans};color:${BRAND.charcoal};background:#fff;">

      <!-- CAPA -->
      <section style="position:relative;height:285mm;overflow:hidden;page-break-after:always;">
        <div style="position:absolute;top:0;right:0;bottom:0;width:54px;display:flex;flex-direction:column;">
          <div style="flex:1;background:${BRAND.gray};"></div>
          <div style="flex:1;background:${BRAND.copper};"></div>
          <div style="flex:1.4;background:${BRAND.green};"></div>
          <div style="flex:1;background:${BRAND.greenDark};"></div>
        </div>
        <!-- Linha vertical no lado direito, com margem da borda (à esquerda da faixa de cores) -->
        <div style="position:absolute;top:24mm;bottom:24mm;right:24mm;width:1px;background:${BRAND.gray};"></div>
        <div style="padding:24mm 24mm 0;">
          <img src="${logoUrl}" alt="Vinte 20B" style="height:60px;object-fit:contain;" crossorigin="anonymous"/>
          <h1 style="font-family:${serif};font-size:42px;line-height:1.12;color:${BRAND.green};font-weight:700;margin:78mm 0 0;max-width:150mm;">
            Projeção de<br/>Investimento
          </h1>
          <div style="margin-top:14mm;">
            <p style="font-size:13px;color:${BRAND.charcoal};margin:0 0 3px;">Simulação de juros compostos com aportes</p>
            <p style="font-size:13px;color:${BRAND.charcoal};margin:0 0 14px;">Período de projeção: ${periodo}</p>
            <p style="font-size:12px;color:${BRAND.brown};margin:0;">Gerado em ${dataHoje}</p>
          </div>
        </div>
        ${footer}
      </section>

      <!-- CONTEÚDO -->
      <section style="position:relative;min-height:285mm;padding:16mm 14mm 24mm;page-break-after:always;">
        ${pageHeader(`Projeção de Investimento · ${periodo}`)}

        ${section('Parâmetros da simulação', 'Premissas utilizadas no cálculo da projeção.',
          kvTable(`
            ${kvRow('Aporte único inicial', fmtBRL(form.aporteUnico || 0))}
            ${kvRow('Aporte mensal', fmtBRL(form.aporteMensal || 0))}
            ${kvRow('Período', periodo)}
            ${kvRow('Rentabilidade do investimento', `${form.rentabilidade || 0}% a.a.`)}
            ${kvRow('Taxa de juros (Selic / CDI)', `${form.taxaJuros || 0}% a.a.`)}
            ${kvRow('IPCA (inflação)', `${form.ipca || 0}% a.a.`)}
          `))}

        ${section('Resultado ao final do período', 'Valor estimado acumulado ao término da projeção.',
          kvTable(`
            ${kvRow('Total investido', fmtBRL(calc.totalInvestido))}
            ${kvRow('Montante final (nominal)', fmtBRL(calc.montante), true)}
            ${kvRow('Rendimento (juros)', fmtBRL(calc.rendimento))}
            ${kvRow('Valor real (poder de compra hoje)', fmtBRL(calc.valorReal))}
            ${kvRow('Rentabilidade acumulada', `${calc.rentTotalPct.toFixed(1)}%`)}
          `))}
        ${footer}
      </section>

      ${chartSvgHtml ? `
      <!-- PROJEÇÃO DE ACÚMULO (página própria — título + gráfico juntos) -->
      <section style="position:relative;min-height:285mm;padding:16mm 14mm 24mm;page-break-before:always;page-break-after:always;">
        ${pageHeader(`Projeção de Investimento · ${periodo}`)}
        ${section('Projeção de acúmulo', 'Evolução do patrimônio ao longo do tempo, com capitalização mensal.',
          `<div style="border:1px solid ${BRAND.gray};border-radius:6px;padding:18px 18px 14px;">
            <div style="width:100%;">${chartSvgHtml}</div>
            <div style="display:flex;flex-wrap:wrap;gap:20px;justify-content:center;margin-top:16px;padding-top:14px;border-top:1px solid #eceae7;">
              ${legendItem('#9ca3af', 'Total investido')}
              ${legendItem(BRAND.green, 'Rentabilidade')}
              ${legendItem(BRAND.brown, 'Taxa de juros (CDI)')}
              ${legendItem(BRAND.copper, 'Valor real (IPCA)')}
            </div>
          </div>`)}
        ${footer}
      </section>` : ''}

      <!-- EVOLUÇÃO ANO A ANO (página própria) -->
      <section style="position:relative;min-height:285mm;padding:16mm 14mm 24mm;page-break-before:always;page-break-after:always;">
        ${pageHeader(`Projeção de Investimento · ${periodo}`)}
        ${section('Evolução ano a ano', 'Patrimônio estimado ao final de cada ano.',
          `<table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:${BRAND.green};">
                <th style="padding:8px 12px;text-align:left;font-size:10px;color:#fff;font-weight:700;font-family:${sans};">Período</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;color:#fff;font-weight:700;font-family:${sans};">Investido</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;color:#fff;font-weight:700;font-family:${sans};">Rentabilidade</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;color:#fff;font-weight:700;font-family:${sans};">CDI</th>
                <th style="padding:8px 12px;text-align:right;font-size:10px;color:#fff;font-weight:700;font-family:${sans};">Valor real</th>
              </tr>
            </thead>
            <tbody>${yearRows}</tbody>
          </table>`)}
        ${footer}
      </section>

      <!-- SOBRE ESTE MATERIAL -->
      <section style="position:relative;min-height:285mm;padding:16mm 14mm 24mm;">
        ${pageHeader('Sobre este material')}
        <h2 style="font-family:${serif};font-size:22px;color:${BRAND.green};font-weight:700;margin:0 0 12px;">Sobre este material</h2>
        <div>${disclaimerHtml}</div>
        ${footer}
      </section>
    </div>`;

  const styleEl = document.createElement('style');
  styleEl.id = 'vinte-print-style';
  styleEl.textContent = `
    @media print {
      @page { margin: 0; size: A4 portrait; }
      body > *:not(#vinte-print-root) { display: none !important; }
      #vinte-print-root { display: block !important; }
    }
    #vinte-print-root { display: none; }
  `;
  document.head.appendChild(styleEl);

  const printRoot = document.createElement('div');
  printRoot.id = 'vinte-print-root';
  printRoot.innerHTML = html;
  document.body.appendChild(printRoot);

  const cleanup = () => {
    if (styleEl.parentNode) document.head.removeChild(styleEl);
    if (printRoot.parentNode) document.body.removeChild(printRoot);
  };
  window.addEventListener('afterprint', cleanup, { once: true });
  setTimeout(() => { if (document.getElementById('vinte-print-root')) cleanup(); }, 3000);

  window.print();
}

function SimuladorInvestimento() {
  const chartRef = useRef(null);
  const [form, setForm] = useState({
    aporteUnico: 10000,
    aporteMensal: 1000,
    anos: 10,
    rentabilidade: 10,   // % a.a. — retorno do investimento
    taxaJuros: 11,       // % a.a. — benchmark (Selic/CDI)
    ipca: 4.5,           // % a.a. — inflação
  });
  const f = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const n = (v) => (v === '' || v == null || isNaN(v) ? 0 : Number(v));

  const calc = useMemo(() => {
    const aporteUnico = n(form.aporteUnico);
    const aporteMensal = n(form.aporteMensal);
    const anos = Math.max(1, Math.min(50, Math.round(n(form.anos)) || 1));
    const rent = n(form.rentabilidade) / 100;
    const juros = n(form.taxaJuros) / 100;
    const ipca = n(form.ipca) / 100;

    const nominalSeries = buildProjection({ aporteUnico, aporteMensal, anos, rateAnual: rent });
    const benchSeries = buildProjection({ aporteUnico, aporteMensal, anos, rateAnual: juros });

    const data = [];
    for (let y = 0; y <= anos; y++) {
      const investido = aporteUnico + aporteMensal * 12 * y;
      const nominal = nominalSeries[y] ?? null;
      const benchmark = benchSeries[y] ?? null;
      const real = nominal != null ? nominal / Math.pow(1 + ipca, y) : null; // poder de compra de hoje
      data.push({
        year: y,
        investido: Math.round(investido),
        nominal: nominal != null ? Math.round(nominal) : null,
        benchmark: benchmark != null ? Math.round(benchmark) : null,
        real: real != null ? Math.round(real) : null,
      });
    }

    const last = data[data.length - 1];
    const totalInvestido = last.investido;
    const montante = last.nominal || 0;
    const rendimento = montante - totalInvestido;
    const valorReal = last.real || 0;
    const rentTotalPct = totalInvestido > 0 ? ((montante / totalInvestido) - 1) * 100 : 0;

    return { data, anos, totalInvestido, montante, rendimento, valorReal, rentTotalPct };
  }, [form]);

  const fmtCompact = (v) => {
    if (v == null) return '';
    const abs = Math.abs(v);
    if (abs >= 1e6) return `R$ ${(v / 1e6).toFixed(1)}M`;
    if (abs >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}k`;
    return `R$ ${v}`;
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[380px_1fr] gap-6">
      {/* ── FORMULÁRIO ── */}
      <div className="space-y-5">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-serif font-bold text-sm text-gray-700 mb-4 pb-2 border-b border-gray-100">Aportes</h3>
          <div className="grid grid-cols-1 gap-4">
            <InvField label="Aporte Único Inicial (R$)" value={form.aporteUnico} onChange={v => f('aporteUnico', v)} prefix="R$" step="1000" />
            <InvField label="Aporte Mensal (R$)" value={form.aporteMensal} onChange={v => f('aporteMensal', v)} prefix="R$" step="100" />
            <InvField label="Período (anos)" value={form.anos} onChange={v => f('anos', v)} step="1" min="1" />
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-serif font-bold text-sm text-gray-700 mb-4 pb-2 border-b border-gray-100">Premissas (% ao ano)</h3>
          <div className="grid grid-cols-1 gap-4">
            <InvField label="Rentabilidade do Investimento" value={form.rentabilidade} onChange={v => f('rentabilidade', v)} suffix="%" step="0.1" hint="Retorno anual esperado da carteira" />
            <InvField label="Taxa de Juros (Selic / CDI)" value={form.taxaJuros} onChange={v => f('taxaJuros', v)} suffix="%" step="0.1" hint="Benchmark de comparação" />
            <InvField label="IPCA (Inflação)" value={form.ipca} onChange={v => f('ipca', v)} suffix="%" step="0.1" hint="Desconta o poder de compra (valor real)" />
          </div>
        </div>
      </div>

      {/* ── RESULTADO ── */}
      <div className="space-y-4">
        {/* Cards resumo */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Total Investido', value: fmtBRL(calc.totalInvestido), color: '#6b7280' },
            { label: 'Montante Final', value: fmtBRL(calc.montante), color: INV_COLOR },
            { label: 'Rendimento (juros)', value: fmtBRL(calc.rendimento), color: '#0891b2' },
            { label: 'Valor Real (hoje)', value: fmtBRL(calc.valorReal), color: '#dd7752' },
          ].map(c => (
            <div key={c.label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
              <p className="font-sans text-xs text-gray-400 mb-1">{c.label}</p>
              <p className="font-serif font-bold text-lg" style={{ color: c.color }}>{c.value}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 flex items-center justify-center gap-2">
          <span className="font-sans text-xs text-gray-400">Rentabilidade acumulada no período:</span>
          <span className="font-serif font-bold text-base" style={{ color: INV_COLOR }}>
            {calc.rentTotalPct.toFixed(1)}%
          </span>
        </div>

        {/* Gráfico */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-serif font-bold text-sm text-gray-700 mb-4">Projeção de Acúmulo — {calc.anos} {calc.anos > 1 ? 'anos' : 'ano'}</h3>
          <div ref={chartRef} style={{ width: '100%', height: 360 }}>
            <ResponsiveContainer>
              <ComposedChart data={calc.data} margin={{ top: 10, right: 12, left: 4, bottom: 4 }}>
                <defs>
                  <linearGradient id="gradInvestido" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#9ca3af" stopOpacity={0.18} />
                    <stop offset="100%" stopColor="#9ca3af" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="year" tickFormatter={y => `${y}a`} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={{ stroke: '#e5e7eb' }} tickLine={false} />
                <YAxis tickFormatter={fmtCompact} tick={{ fontSize: 11, fill: '#9ca3af' }} axisLine={false} tickLine={false} width={56} />
                <Tooltip
                  formatter={(v, name) => [fmtBRL(v), name]}
                  labelFormatter={y => `Ano ${y}`}
                  contentStyle={{ borderRadius: 12, border: '1px solid #e5e7eb', fontSize: 12, fontFamily: 'sans-serif' }}
                />
                <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                <Area type="monotone" dataKey="investido" name="Total investido" stroke="#9ca3af" strokeWidth={1.5} fill="url(#gradInvestido)" dot={false} />
                <Line type="monotone" dataKey="nominal" name="Rentabilidade" stroke={INV_COLOR} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="benchmark" name="Taxa de juros (CDI)" stroke="#7A5137" strokeWidth={2} strokeDasharray="5 4" dot={false} />
                <Line type="monotone" dataKey="real" name="Valor real (IPCA)" stroke="#dd7752" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="font-sans text-xs text-gray-400 text-center mt-3 leading-relaxed">
            Capitalização mensal de juros compostos. O <b>valor real</b> desconta o IPCA, mostrando o poder de compra equivalente de hoje.
          </p>
        </div>

        {/* BOTÃO PDF */}
        <button
          onClick={() => {
            const svgEl = chartRef.current?.querySelector('svg');
            let chartHtml = '';
            if (svgEl) {
              const clone = svgEl.cloneNode(true);
              const w = svgEl.getAttribute('width') || svgEl.clientWidth;
              const h = svgEl.getAttribute('height') || svgEl.clientHeight;
              if (w && h && !clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${w} ${h}`);
              clone.setAttribute('width', '100%');
              clone.removeAttribute('height');
              clone.setAttribute('preserveAspectRatio', 'xMidYMid meet');
              chartHtml = clone.outerHTML;
            }
            exportInvestimentoPDF(form, calc, chartHtml);
          }}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-sans font-semibold text-sm text-white transition-all hover:opacity-90 active:scale-[0.98] shadow-lg"
          style={{ backgroundColor: INV_COLOR }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11v6m-3-3l3 3 3-3" />
          </svg>
          Exportar Relatório em PDF
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
const TABS = [
  { key: 'imovel',  label: 'Imóvel',   sub: 'Porto Seguro Bank' },
  { key: 'auto',    label: 'Auto',     sub: 'Porto Seguro Bank' },
  { key: 'pesados', label: 'Pesados',  sub: 'Porto Seguro Bank' },
];

const CRM_LABELS = {
  investimento: 'Investimento',
  cambio: 'Câmbio',
  seguro: 'Seguro',
};

function EmDesenvolvimento({ crmLabel, color }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-2"
        style={{ backgroundColor: color + '18' }}>
        <svg className="w-8 h-8" style={{ color }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      </div>
      <h2 className="font-serif font-bold text-xl text-gray-700">Simulador em Desenvolvimento</h2>
      <p className="font-sans text-sm text-gray-400 text-center max-w-sm">
        O simulador para o vertical <span className="font-semibold" style={{ color }}>{crmLabel}</span> estará disponível em breve.
      </p>
      <div className="mt-2 px-4 py-2 rounded-full font-sans text-xs font-semibold"
        style={{ backgroundColor: color + '12', color }}>
        Em breve
      </div>
    </div>
  );
}

export default function Simuladores() {
  const { activeCRM, currentCRM } = useCRM();
  const [activeTab, setActiveTab] = useState('imovel');
  const config = CONFIGS[activeTab];

  // Investimento: calculadora de juros compostos com projeção
  if (activeCRM === 'investimento') {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full" style={{ backgroundColor: INV_COLOR }} />
            <h1 className="font-serif text-2xl font-bold text-gray-900">Calculadora de Investimentos</h1>
          </div>
          <p className="font-sans text-sm text-gray-500 ml-4">Projeção de juros compostos · aportes, rentabilidade, IPCA e taxa de juros</p>
        </div>
        <SimuladorInvestimento />
      </div>
    );
  }

  // Demais CRMs (Câmbio, Seguro): em desenvolvimento
  if (activeCRM !== 'credito') {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-1 h-7 rounded-full" style={{ backgroundColor: currentCRM.color }} />
            <h1 className="font-serif text-2xl font-bold text-gray-900">
              Simuladores — {currentCRM.label}
            </h1>
          </div>
        </div>
        <EmDesenvolvimento crmLabel={currentCRM.label} color={currentCRM.color} />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-1 h-7 rounded-full" style={{ backgroundColor: config.color }} />
          <h1 className="font-serif text-2xl font-bold text-gray-900">Simuladores — Crédito</h1>
        </div>
        <p className="font-sans text-sm text-gray-500 ml-4">Consórcios Porto Seguro Bank · Imóvel, Auto e Pesados</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-6 flex-wrap">
        {TABS.map(tab => {
          const cfg = CONFIGS[tab.key];
          const active = activeTab === tab.key;
          return (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className="flex flex-col items-start px-5 py-3 rounded-xl border-2 transition-all font-sans"
              style={{
                backgroundColor: active ? cfg.color + '12' : 'var(--bg-card)',
                borderColor: active ? cfg.color : '#e5e7eb',
              }}>
              <span className="text-sm font-semibold" style={{ color: active ? cfg.color : 'var(--text-primary)' }}>{tab.label}</span>
              <span className="text-xs mt-0.5" style={{ color: active ? cfg.color + 'aa' : '#9ca3af' }}>{tab.sub}</span>
            </button>
          );
        })}
      </div>

      {/* Simulator */}
      <Simulador key={activeTab} configKey={activeTab} />
    </div>
  );
}
