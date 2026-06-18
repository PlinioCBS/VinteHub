import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, ReferenceLine, CartesianGrid,
} from 'recharts';

const STORAGE_KEY = 'eco_folders_v1';
const DEFAULT_FOLDERS = [{ id: 'default', name: 'Meus Favoritos', symbols: [] }];
const GREEN = '#355641';
// Embeds whatever is currently live on the channel — avoids broken links when a specific video ends
const YOUTUBE_CHANNEL_ID = 'UCIALMKvObZNtJ6AmdCLP7Lg'; // Bloomberg Television
const API_BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api';

function loadFolders() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_FOLDERS; }
  catch { return DEFAULT_FOLDERS; }
}

const fmt2 = v => v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtBig = v => v == null ? '—' : Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

async function fetchBCB(seriesId) {
  const res = await fetch(`https://api.bcb.gov.br/dados/serie/bcdata.sgs.${seriesId}/dados/ultimos/1?formato=json`);
  const data = await res.json();
  if (!data[0]) return null;
  return { valor: parseFloat(String(data[0].valor).replace(',', '.')), data: data[0].data };
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────
function Panel({ title, children, badge }) {
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-card)',
      borderRadius: 10, overflow: 'hidden', marginBottom: 10,
      boxShadow: 'var(--shadow-card)',
    }}>
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '9px 14px', borderBottom: '1px solid var(--border-card)',
          fontSize: 9, fontWeight: 700, letterSpacing: '0.10em',
          textTransform: 'uppercase', color: 'var(--text-muted)',
        }}>
          <span>{title}</span>
          {badge && <span style={{ fontSize: 8, color: 'var(--text-hint)' }}>{badge}</span>}
        </div>
      )}
      <div>{children}</div>
    </div>
  );
}

// ── Market data row ───────────────────────────────────────────────────────────
function MktRow({ label, price, changePct, prefix = '', isLast = false }) {
  const [hov, setHov] = useState(false);
  const loading = price == null && changePct == null;
  const up = (changePct || 0) >= 0;
  const isLargeNum = price && price > 500;

  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '6px 12px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-card)',
        background: hov ? 'rgba(53,86,65,0.04)' : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {label}
      </span>
      {loading ? (
        <>
          <div style={{ height: 11, width: 64, background: 'var(--border-card)', borderRadius: 3, opacity: 0.5 }} />
          <div style={{ height: 11, width: 52, background: 'var(--border-card)', borderRadius: 3, opacity: 0.5 }} />
        </>
      ) : (
        <>
          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', letterSpacing: '0.01em', flexShrink: 0 }}>
            {prefix}{isLargeNum ? fmtBig(price) : fmt2(price)}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, width: 62, textAlign: 'right', flexShrink: 0,
            color: changePct == null ? 'var(--text-hint)' : (up ? '#16a34a' : '#dc2626'),
            fontVariantNumeric: 'tabular-nums',
          }}>
            {changePct == null ? '—' : `${up ? '▲' : '▼'} ${Math.abs(changePct).toFixed(2)}%`}
          </span>
        </>
      )}
    </div>
  );
}

// ── Macro indicator pill ──────────────────────────────────────────────────────
function MacroPill({ label, value, suffix = '% a.a.', sublabel }) {
  return (
    <div style={{
      flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border-card)',
      borderRadius: 10, padding: '14px 16px', textAlign: 'center',
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 4 }}>
        {label}
      </div>
      {value == null ? (
        <div style={{ height: 24, background: 'var(--border-card)', borderRadius: 4, width: 64, margin: '0 auto', opacity: 0.5 }} />
      ) : (
        <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'Libre Baskerville, serif', color: 'var(--text-primary)', letterSpacing: '-0.02em', lineHeight: 1 }}>
          {fmt2(value)}<span style={{ fontSize: 11, fontFamily: 'Lato, sans-serif', fontWeight: 600, marginLeft: 3, opacity: 0.75 }}>{suffix}</span>
        </div>
      )}
      {sublabel && (
        <div style={{ fontSize: 9, color: 'var(--text-hint)', marginTop: 3 }}>{sublabel}</div>
      )}
    </div>
  );
}

// ── Chart tooltip ─────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const fmt = str => new Date(str + 'T12:00:00Z')
    .toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border-card)',
      borderRadius: 6, padding: '8px 12px', fontSize: 11,
      boxShadow: 'var(--shadow-card)',
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4, fontSize: 10 }}>{fmt(label)}</div>
      {payload.map(p => p.value != null && (
        <div key={p.dataKey} style={{ color: p.stroke, fontWeight: 700, margin: '1px 0', fontVariantNumeric: 'tabular-nums' }}>
          {p.name}: {p.value >= 0 ? '+' : ''}{p.value.toFixed(2)}%
        </div>
      ))}
    </div>
  );
}

// ── Normalized performance chart ──────────────────────────────────────────────
function PerformanceChart({ history }) {
  if (!history) {
    return (
      <div style={{ height: 168, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="animate-spin" style={{ width: 22, height: 22, border: '2px solid var(--border-card)', borderTopColor: GREEN, borderRadius: '50%' }} />
      </div>
    );
  }

  const ibovMap = {}, sp500Map = {};
  (history['^BVSP'] || []).forEach(p => { ibovMap[p.date] = p.pct; });
  (history['^GSPC'] || []).forEach(p => { sp500Map[p.date] = p.pct; });

  const dates = [...new Set([...Object.keys(ibovMap), ...Object.keys(sp500Map)])].sort();
  const data = dates.map(date => ({
    date,
    ibov:  ibovMap[date]  ?? null,
    sp500: sp500Map[date] ?? null,
  }));

  const fmtDate  = str => new Date(str + 'T12:00:00Z').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }).replace('.', '');
  const fmtYAxis = v  => `${v >= 0 ? '+' : ''}${v.toFixed(0)}%`;

  return (
    <div style={{ padding: '8px 4px 4px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 12, marginBottom: 6 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          <span style={{ width: 14, height: 2, background: GREEN, display: 'inline-block', borderRadius: 1 }} />
          IBOVESPA
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--text-muted)' }}>
          <span style={{ width: 14, height: 2, background: '#2563eb', display: 'inline-block', borderRadius: 1 }} />
          S&amp;P 500
        </span>
      </div>
      <ResponsiveContainer width="100%" height={152}>
        <LineChart data={data} margin={{ top: 4, right: 10, bottom: 0, left: -6 }}>
          <CartesianGrid strokeDasharray="2 4" stroke="var(--border-card)" vertical={false} />
          <XAxis
            dataKey="date"
            tickFormatter={fmtDate}
            tick={{ fontSize: 9, fill: 'var(--text-hint)' }}
            tickLine={false} axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tickFormatter={fmtYAxis}
            tick={{ fontSize: 9, fill: 'var(--text-hint)' }}
            tickLine={false} axisLine={false}
            width={38}
          />
          <Tooltip content={<ChartTooltip />} />
          <ReferenceLine y={0} stroke="var(--text-hint)" strokeWidth={0.5} />
          <Line type="monotone" dataKey="ibov"  name="IBOVESPA" stroke={GREEN}    strokeWidth={1.5} dot={false} connectNulls />
          <Line type="monotone" dataKey="sp500" name="S&P 500"  stroke="#2563eb" strokeWidth={1.5} dot={false} connectNulls />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── FX row ────────────────────────────────────────────────────────────────────
function FXRow({ label, bid, pct, isLast }) {
  const [hov, setHov] = useState(false);
  const up = parseFloat(pct || 0) >= 0;
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        borderBottom: isLast ? 'none' : '1px solid var(--border-card)',
        background: hov ? 'rgba(53,86,65,0.04)' : 'transparent', transition: 'background 0.1s',
      }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <span style={{ flex: 1, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}>{label}</span>
      {bid ? (
        <>
          <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)', flexShrink: 0 }}>
            R$ {fmt2(bid)}
          </span>
          <span style={{
            fontSize: 11, fontWeight: 700, width: 62, textAlign: 'right', flexShrink: 0,
            color: up ? '#16a34a' : '#dc2626', fontVariantNumeric: 'tabular-nums',
          }}>
            {up ? '▲' : '▼'} {Math.abs(parseFloat(pct || 0)).toFixed(2)}%
          </span>
        </>
      ) : (
        <div style={{ height: 11, width: 100, background: 'var(--border-card)', borderRadius: 3, opacity: 0.5 }} />
      )}
    </div>
  );
}

// ── Favorites: stock card ─────────────────────────────────────────────────────
function StockCard({ symbol, data, onRemove }) {
  const [hov, setHov] = useState(false);
  const loading = !data;
  const notFound = data?.notFound;
  const up = data && !notFound && parseFloat(data.regularMarketChangePercent || 0) >= 0;
  const prefix = data?.currency === 'USD' ? '$ ' : 'R$ ';

  return (
    <div
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-card)', borderRadius: 10, position: 'relative', overflow: 'hidden' }}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
    >
      <div style={{ height: 3, background: notFound ? 'var(--border-card)' : GREEN }} />
      <div style={{ padding: '10px 12px' }}>
        <button
          onClick={onRemove}
          style={{
            position: 'absolute', top: 10, right: 8,
            opacity: hov ? 1 : 0, transition: 'opacity 0.15s',
            width: 18, height: 18, borderRadius: '50%',
            border: 'none', background: '#fee2e2', color: '#dc2626',
            cursor: 'pointer', fontSize: 12, fontWeight: 900,
            display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
          }}
          title="Remover"
        >×</button>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ height: 12, background: 'var(--border-card)', borderRadius: 4, width: '50%', opacity: 0.5 }} />
            <div style={{ height: 20, background: 'var(--border-card)', borderRadius: 4, width: '80%', opacity: 0.5 }} />
          </div>
        ) : notFound ? (
          <>
            <p style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: 'var(--text-muted)' }}>{symbol}</p>
            <p style={{ fontSize: 10, color: 'var(--text-hint)', marginTop: 4 }}>Não encontrado</p>
          </>
        ) : (
          <>
            <div style={{ marginBottom: 6, paddingRight: 22 }}>
              <div style={{ fontSize: 11, fontWeight: 700, fontFamily: 'monospace', color: GREEN }}>{data.symbol}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 130 }}>
                {data.shortName || data.longName || ''}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Libre Baskerville, serif', color: 'var(--text-primary)' }}>
                {prefix}{fmt2(data.regularMarketPrice)}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: up ? '#16a34a' : '#dc2626' }}>
                {up ? '▲' : '▼'} {Math.abs(parseFloat(data.regularMarketChangePercent || 0)).toFixed(2)}%
              </div>
            </div>
            {(data.regularMarketDayHigh != null || data.regularMarketDayLow != null) && (
              <div style={{ display: 'flex', gap: 12, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--border-card)' }}>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Mín</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#dc2626', fontVariantNumeric: 'tabular-nums' }}>{prefix}{fmt2(data.regularMarketDayLow)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 9, color: 'var(--text-hint)', textTransform: 'uppercase' }}>Máx</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#16a34a', fontVariantNumeric: 'tabular-nums' }}>{prefix}{fmt2(data.regularMarketDayHigh)}</div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Add symbol input ──────────────────────────────────────────────────────────
function AddSymbolInput({ onAdd }) {
  const [val, setVal] = useState('');
  const [open, setOpen] = useState(false);
  function submit() {
    const sym = val.trim().toUpperCase();
    if (sym) { onAdd(sym); setVal(''); setOpen(false); }
  }
  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
        border: '1px solid var(--border-card)',
        color: 'var(--text-primary)',
        background: 'var(--bg-card)',
        cursor: 'pointer',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = '0.7'}
      onMouseLeave={e => e.currentTarget.style.opacity = '1'}
    >
      <svg style={{ width: 12, height: 12 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Adicionar ativo
    </button>
  );
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <input
        autoFocus value={val}
        onChange={e => setVal(e.target.value.toUpperCase())}
        onKeyDown={e => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder="Ex: PETR4, AAPL"
        style={{
          padding: '5px 10px', borderRadius: 20, border: `1px solid ${GREEN}`,
          fontFamily: 'monospace', fontSize: 12, outline: 'none', width: 140,
          background: 'var(--bg-input)', color: 'var(--text-primary)',
          boxShadow: `0 0 0 3px ${GREEN}20`,
        }}
      />
      <button onClick={submit} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: GREEN, color: 'white', border: 'none', cursor: 'pointer' }}>OK</button>
      <button onClick={() => setOpen(false)} style={{ padding: '5px 12px', borderRadius: 20, fontSize: 12, border: '1px solid var(--border-card)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancelar</button>
    </div>
  );
}

// ── Folder section ────────────────────────────────────────────────────────────
function FolderSection({ folder, quotes, onAddSymbol, onRemoveSymbol, onRename, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [nameVal, setNameVal] = useState(folder.name);
  const [confirmDel, setConfirmDel] = useState(false);
  function saveRename() { if (nameVal.trim()) onRename(nameVal.trim()); setEditing(false); }

  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <svg style={{ width: 15, height: 15, color: GREEN, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
        </svg>
        {editing ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              autoFocus value={nameVal}
              onChange={e => setNameVal(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); if (e.key === 'Escape') setEditing(false); }}
              style={{
                padding: '4px 10px', borderRadius: 8, border: `1px solid ${GREEN}`,
                fontFamily: 'Libre Baskerville, serif', fontWeight: 700, fontSize: 18,
                outline: 'none', background: 'var(--bg-input)', color: 'var(--text-primary)',
                boxShadow: `0 0 0 3px ${GREEN}20`,
              }}
            />
            <button onClick={saveRename} style={{ padding: '4px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: GREEN, color: 'white', border: 'none', cursor: 'pointer' }}>Salvar</button>
            <button onClick={() => setEditing(false)} style={{ fontSize: 12, color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer' }}>Cancelar</button>
          </div>
        ) : (
          <h2 style={{ fontFamily: 'Libre Baskerville, serif', fontWeight: 700, fontSize: 20, color: 'var(--text-primary)', margin: 0 }}>{folder.name}</h2>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 4 }}>
          {!editing && (
            <button onClick={() => { setEditing(true); setNameVal(folder.name); }}
              style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-hint)' }}
              title="Renomear">
              <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {folder.id !== 'default' && (
            confirmDel ? (
              <span style={{ fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Excluir?
                <button onClick={onDelete} style={{ color: '#dc2626', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Sim</button>
                <button onClick={() => setConfirmDel(false)} style={{ color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 12 }}>Não</button>
              </span>
            ) : (
              <button onClick={() => setConfirmDel(true)}
                style={{ padding: 6, borderRadius: 8, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-hint)' }}
                title="Excluir pasta">
                <svg style={{ width: 13, height: 13 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )
          )}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <AddSymbolInput onAdd={sym => onAddSymbol(folder.id, sym)} />
        </div>
      </div>

      {folder.symbols.length === 0 ? (
        <div style={{
          border: '2px dashed var(--border-card)', borderRadius: 12,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          padding: '40px 0', textAlign: 'center',
        }}>
          <svg style={{ width: 36, height: 36, color: 'var(--border-card)', marginBottom: 10 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Pasta vazia — clique em "Adicionar ativo" para começar</p>
          <p style={{ fontSize: 11, color: 'var(--text-hint)', marginTop: 4 }}>Ex: PETR4, VALE3, AAPL, MXRF11</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {folder.symbols.map(sym => (
            <StockCard key={sym} symbol={sym} data={quotes[sym]} onRemove={() => onRemoveSymbol(folder.id, sym)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function PainelMercado() {
  const [folders,     setFolders]     = useState(loadFolders);
  const [quotes,      setQuotes]      = useState({});
  const [indices,     setIndices]     = useState({});
  const [commodities, setCommodities] = useState({});
  const [history,     setHistory]     = useState(null);
  const [macro,       setMacro]       = useState({});
  const [fx,          setFx]          = useState({});
  const [lastUpdate,  setLastUpdate]  = useState(null);
  const [showNewFolder, setShowNewFolder]   = useState(false);
  const [newFolderName, setNewFolderName]   = useState('');

  const allSymbols = [...new Set(folders.flatMap(f => f.symbols))];

  const refreshQuotes = useCallback(async () => {
    if (!allSymbols.length) return;
    try {
      const results = await Promise.allSettled(
        allSymbols.map(sym =>
          fetch(`${API_BASE}/market-data/quote/${sym}`).then(r => r.ok ? r.json() : { notFound: true, symbol: sym })
        )
      );
      const next = {};
      allSymbols.forEach((sym, i) => {
        next[sym] = results[i].status === 'fulfilled' ? results[i].value : { notFound: true };
      });
      setQuotes(next);
    } catch (e) { console.error('Quotes error', e); }
  }, [allSymbols.join(',')]);

  const refreshIndices = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/market-data/indices`);
      if (res.ok) setIndices(await res.json());
    } catch (e) { console.error('Indices error', e); }
  }, []);

  const refreshCommodities = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/market-data/commodities`);
      if (res.ok) setCommodities(await res.json());
    } catch (e) { console.error('Commodities error', e); }
  }, []);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/market-data/history?symbols=^BVSP,^GSPC&range=3mo`);
      if (res.ok) setHistory(await res.json());
    } catch (e) { console.error('History error', e); }
  }, []);

  const refreshMacro = useCallback(async () => {
    const [selicRes, ipcaRes, cdiDailyRes, fedRes] = await Promise.allSettled([
      fetchBCB(432),
      fetchBCB(13522),
      fetchBCB(11),
      fetch(`${API_BASE}/market-data/fed`).then(r => r.ok ? r.json() : null),
    ]);
    let cdiAnnual = null;
    if (cdiDailyRes.status === 'fulfilled' && cdiDailyRes.value) {
      const daily = cdiDailyRes.value.valor;
      cdiAnnual = { valor: ((1 + daily / 100) ** 252 - 1) * 100, data: cdiDailyRes.value.data };
    }
    const fedData = fedRes.status === 'fulfilled' && fedRes.value;
    setMacro({
      selic: selicRes.status === 'fulfilled' ? selicRes.value : null,
      ipca:  ipcaRes.status  === 'fulfilled' ? ipcaRes.value  : null,
      cdi:   cdiAnnual,
      fed:   fedData ? { valor: fedData.rate, data: fedData.date } : null,
    });
  }, []);

  const refreshFx = useCallback(async () => {
    try {
      const res = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL,GBP-BRL');
      setFx(await res.json());
    } catch (e) { console.error('FX error', e); }
  }, []);

  function refreshAll() {
    refreshIndices();
    refreshCommodities();
    refreshMacro();
    refreshFx();
    refreshHistory();
    refreshQuotes();
    setLastUpdate(new Date());
  }

  useEffect(() => {
    refreshAll();
    const t = setInterval(refreshAll, 60000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => { refreshQuotes(); }, [refreshQuotes]);
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(folders)); }, [folders]);

  function addSymbolToFolder(folderId, symbol) {
    const sym = symbol.trim().toUpperCase();
    if (!sym) return;
    setFolders(prev => prev.map(f =>
      f.id === folderId && !f.symbols.includes(sym) ? { ...f, symbols: [...f.symbols, sym] } : f
    ));
    fetch(`${API_BASE}/market-data/quote/${sym}`)
      .then(r => r.ok ? r.json() : { notFound: true })
      .then(data => setQuotes(prev => ({ ...prev, [sym]: data })))
      .catch(() => setQuotes(prev => ({ ...prev, [sym]: { notFound: true } })));
  }

  function removeSymbol(folderId, symbol) {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, symbols: f.symbols.filter(s => s !== symbol) } : f));
  }

  function renameFolder(folderId, name) {
    setFolders(prev => prev.map(f => f.id === folderId ? { ...f, name } : f));
  }

  function deleteFolder(folderId) {
    setFolders(prev => prev.filter(f => f.id !== folderId));
  }

  function createFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    setFolders(prev => [...prev, { id: Date.now().toString(), name, symbols: [] }]);
    setNewFolderName('');
    setShowNewFolder(false);
  }

  const { ibov, ifix, sp500, nasdaq, nyse, dowjones } = indices;
  const { wti, brent, gold } = commodities;
  const usd = fx.USDBRL;
  const eur = fx.EURBRL;
  const gbp = fx.GBPBRL;

  const indicesBR = [
    { label: 'IBOVESPA', price: ibov?.price,     changePct: ibov?.changePct     },
    { label: 'IFIX',     price: ifix?.price,     changePct: ifix?.changePct     },
  ];

  const indicesGlobais = [
    { label: 'S&P 500',   price: sp500?.price,    changePct: sp500?.changePct    },
    { label: 'NASDAQ',    price: nasdaq?.price,   changePct: nasdaq?.changePct   },
    { label: 'NYSE',      price: nyse?.price,     changePct: nyse?.changePct     },
    { label: 'Dow Jones', price: dowjones?.price, changePct: dowjones?.changePct },
  ];

  return (
    <div style={{ padding: '28px 28px 40px', backgroundColor: 'var(--bg-page)', minHeight: '100vh' }}>

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 3 }}>
            <div style={{ width: 3, height: 22, borderRadius: 2, background: GREEN, flexShrink: 0 }} />
            <h1 style={{ fontFamily: 'Libre Baskerville, serif', fontWeight: 700, fontSize: 22, color: 'var(--text-primary)', margin: 0 }}>
              Painel de Mercado
            </h1>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 13 }}>
            {lastUpdate
              ? `Atualizado às ${lastUpdate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
              : 'Carregando dados...'}
            {' · Atualização automática a cada 60s'}
          </p>
        </div>
        <button
          onClick={refreshAll}
          style={{
            display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', borderRadius: 8,
            background: GREEN, color: 'white', border: 'none', cursor: 'pointer',
            fontSize: 12, fontWeight: 700, letterSpacing: '0.02em',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
          onMouseLeave={e => e.currentTarget.style.opacity = '1'}
        >
          <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Atualizar
        </button>
      </div>

      {/* ── Macro strip ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <MacroPill label="SELIC"          value={macro.selic?.valor}
          sublabel={macro.selic?.data ? `BCB · ${macro.selic.data}` : 'Meta BCB'} />
        <MacroPill label="IPCA"           value={macro.ipca?.valor}  suffix="%"
          sublabel="Acumulado 12 meses" />
        <MacroPill label="CDI"            value={macro.cdi?.valor}
          sublabel="SELIC Over anualizado" />
        <MacroPill label="Fed Funds"      value={macro.fed?.valor}
          sublabel={macro.fed?.data ? `FRED · ${macro.fed.data}` : 'Federal Reserve'} />
      </div>

      {/* ── 3-column grid ── */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr_280px] gap-4" style={{ marginBottom: 32 }}>

        {/* LEFT — video + indices */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* YouTube — compact, top of left column */}
          <Panel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '9px 14px', borderBottom: '1px solid var(--border-card)' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0, boxShadow: '0 0 0 3px rgba(239,68,68,0.15)' }} />
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                Notícias ao Vivo
              </span>
            </div>
            <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%' }}>
              <iframe
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
                src={`https://www.youtube.com/embed/live_stream?channel=${YOUTUBE_CHANNEL_ID}&autoplay=0&rel=0`}
                title="Canal de Notícias"
                frameBorder="0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </Panel>

          <Panel title="Índices Brasil">
            {indicesBR.map((r, i) => (
              <MktRow key={r.label} {...r} isLast={false} />
            ))}
            <div style={{
              padding: '6px 12px 3px', fontSize: 8, fontWeight: 700, letterSpacing: '0.10em',
              textTransform: 'uppercase', color: 'var(--text-hint)',
              borderTop: '1px solid var(--border-card)',
            }}>
              Câmbio
            </div>
            <FXRow label="USD / BRL" bid={usd?.bid} pct={usd?.pctChange} />
            <FXRow label="EUR / BRL" bid={eur?.bid} pct={eur?.pctChange} />
            <FXRow label="GBP / BRL" bid={gbp?.bid} pct={gbp?.pctChange} isLast />
          </Panel>
          <Panel title="Índices Globais">
            {indicesGlobais.map((r, i) => (
              <MktRow key={r.label} {...r} isLast={i === indicesGlobais.length - 1} />
            ))}
          </Panel>
        </div>

        {/* CENTER — performance chart (full height) */}
        <div>
          <Panel title="Desempenho Normalizado · 3 meses" badge="IBOVESPA vs S&P 500">
            <PerformanceChart history={history} />
          </Panel>
        </div>

        {/* RIGHT — commodities */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Panel title="Commodities" badge="USD">
            <MktRow label="WTI Petróleo" price={wti?.price}   changePct={wti?.changePct}   prefix="$ " />
            <MktRow label="Brent"        price={brent?.price} changePct={brent?.changePct} prefix="$ " />
            <MktRow label="Ouro (oz)"    price={gold?.price}  changePct={gold?.changePct}  prefix="$ " isLast />
          </Panel>
        </div>
      </div>

      {/* ── Favorites ── */}
      <div style={{ borderTop: '1px solid var(--border-card)', paddingTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 22 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
            Meus Ativos Favoritos
          </span>
          <div style={{ flex: 1, height: 1, background: 'var(--border-card)' }} />
        </div>

        {folders.map(folder => (
          <FolderSection
            key={folder.id}
            folder={folder}
            quotes={quotes}
            onAddSymbol={addSymbolToFolder}
            onRemoveSymbol={removeSymbol}
            onRename={name => renameFolder(folder.id, name)}
            onDelete={() => deleteFolder(folder.id)}
          />
        ))}

        <div style={{ marginTop: 8 }}>
          {showNewFolder ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg style={{ width: 15, height: 15, color: GREEN, flexShrink: 0 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <input
                autoFocus value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createFolder(); if (e.key === 'Escape') setShowNewFolder(false); }}
                placeholder="Nome da nova pasta..."
                style={{
                  padding: '7px 14px', borderRadius: 10, border: `1px solid ${GREEN}`,
                  fontSize: 13, outline: 'none', width: 260,
                  background: 'var(--bg-input)', color: 'var(--text-primary)',
                  boxShadow: `0 0 0 3px ${GREEN}20`,
                }}
              />
              <button onClick={createFolder} style={{ padding: '7px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, background: GREEN, color: 'white', border: 'none', cursor: 'pointer' }}>Criar</button>
              <button onClick={() => setShowNewFolder(false)} style={{ padding: '7px 16px', borderRadius: 10, fontSize: 13, border: '1px solid var(--border-card)', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer' }}>Cancelar</button>
            </div>
          ) : (
            <button
              onClick={() => setShowNewFolder(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px',
                borderRadius: 10, border: '2px dashed var(--border-card)',
                background: 'transparent', color: 'var(--text-muted)',
                fontSize: 13, fontWeight: 600, cursor: 'pointer',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = GREEN; e.currentTarget.style.background = 'rgba(53,86,65,0.03)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-card)'; e.currentTarget.style.background = 'transparent'; }}
            >
              <svg style={{ width: 14, height: 14 }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova pasta
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
