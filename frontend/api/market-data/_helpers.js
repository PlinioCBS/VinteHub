const TIMEOUT_MS = 10000;
const cache = {};

function fromCache(key) {
  const e = cache[key];
  return e && Date.now() - e.ts < 60000 ? e.data : null;
}
function toCache(key, data) { cache[key] = { ts: Date.now(), data }; }

async function yhFetch(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = await res.json();
    const meta = parsed.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose || meta.previousClose;
    const changePct = prev ? ((price - prev) / prev) * 100 : 0;
    return {
      symbol,
      name: meta.shortName || meta.longName || symbol,
      price,
      change: parseFloat((price - (prev || price)).toFixed(2)),
      changePct: parseFloat(changePct.toFixed(2)),
      currency: meta.currency || '',
    };
  } catch { return null; }
}

async function yhFetchFull(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = await res.json();
    const meta = parsed.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev = meta.chartPreviousClose || meta.previousClose;
    const changePct = prev ? ((price - prev) / prev) * 100 : 0;
    return {
      symbol: meta.symbol || symbol,
      shortName: meta.shortName || meta.longName || symbol,
      regularMarketPrice: price,
      regularMarketChange: parseFloat((price - (prev || price)).toFixed(4)),
      regularMarketChangePercent: parseFloat(changePct.toFixed(4)),
      regularMarketDayHigh: meta.regularMarketDayHigh || null,
      regularMarketDayLow: meta.regularMarketDayLow || null,
      currency: meta.currency || '',
    };
  } catch { return null; }
}

async function yhHistoryFetch(symbol, range = '3mo') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const parsed = await res.json();
    const result = parsed.chart?.result?.[0];
    if (!result) return null;
    const timestamps = result.timestamp || [];
    const closes = result.indicators?.quote?.[0]?.close || [];
    const firstClose = closes.find(c => c != null);
    if (!firstClose) return null;
    return timestamps
      .map((ts, i) => ({
        date: new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i],
        pct: closes[i] != null ? parseFloat(((closes[i] - firstClose) / firstClose * 100).toFixed(2)) : null,
      }))
      .filter(p => p.close != null);
  } catch { return null; }
}

async function hgFetch() {
  try {
    const res = await fetch('https://api.hgbrasil.com/finance?format=json-cors', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const d = await res.json();
    const stocks = d.results?.stocks || {};
    function toCard(key, label) {
      const s = stocks[key];
      if (!s) return null;
      return { symbol: key, name: label, price: s.points, change: null, changePct: s.variation, currency: 'BRL' };
    }
    return {
      ibov: toCard('IBOVESPA', 'IBOVESPA'),
      ifix: toCard('IFIX', 'IFIX'),
      nasdaq: toCard('NASDAQ', 'NASDAQ'),
      dowjones: toCard('DOWJONES', 'Dow Jones'),
    };
  } catch { return null; }
}

async function fredFetch() {
  try {
    const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const txt = await res.text();
    const lines = txt.trim().split('\n').filter(l => !l.startsWith('DATE') && l.includes(','));
    const [date, val] = lines[lines.length - 1].split(',');
    return { date, rate: parseFloat(val) };
  } catch { return null; }
}

module.exports = { fromCache, toCache, yhFetch, yhFetchFull, yhHistoryFetch, hgFetch, fredFetch };
