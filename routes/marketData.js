const express = require('express');
const router = express.Router();

const TIMEOUT_MS = 10000;

function signal() {
  return AbortSignal.timeout(TIMEOUT_MS);
}

// Simple in-memory cache (60s TTL)
const cache = {};
function fromCache(key) {
  const e = cache[key];
  return e && Date.now() - e.ts < 60000 ? e.data : null;
}
function toCache(key, data) { cache[key] = { ts: Date.now(), data }; }

// HG Brasil Finance — free, no key, has IBOVESPA, IFIX, NASDAQ, DOWJONES
async function hgFetch() {
  try {
    const res = await fetch('https://api.hgbrasil.com/finance?format=json-cors', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' },
      signal: signal(),
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
      ibov:     toCard('IBOVESPA', 'IBOVESPA'),
      ifix:     toCard('IFIX',     'IFIX'),
      nasdaq:   toCard('NASDAQ',   'NASDAQ'),
      dowjones: toCard('DOWJONES', 'Dow Jones'),
    };
  } catch { return null; }
}

// Yahoo Finance — for S&P 500 and NYSE (not in HG Brasil)
async function yhFetch(symbol) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' },
      signal: signal(),
    });
    if (!res.ok) return null;
    const parsed = await res.json();
    const meta = parsed.chart?.result?.[0]?.meta;
    if (!meta) return null;
    const price = meta.regularMarketPrice;
    const prev  = meta.chartPreviousClose || meta.previousClose;
    const changePct = prev ? ((price - prev) / prev) * 100 : 0;
    return {
      symbol,
      name:      meta.shortName || meta.longName || symbol,
      price,
      change:    parseFloat((price - (prev || price)).toFixed(2)),
      changePct: parseFloat(changePct.toFixed(2)),
      currency:  meta.currency || '',
    };
  } catch { return null; }
}

// FRED — Federal Reserve FEDFUNDS official rate (Node fetch uses HTTP/2, required by FRED)
async function fredFetch() {
  try {
    const res = await fetch('https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS', {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' },
      signal: signal(),
    });
    if (!res.ok) return null;
    const txt = await res.text();
    const lines = txt.trim().split('\n').filter(l => !l.startsWith('DATE') && l.includes(','));
    const [date, val] = lines[lines.length - 1].split(',');
    return { date, rate: parseFloat(val) };
  } catch { return null; }
}

// GET /api/market-data/indices
router.get('/indices', async (req, res) => {
  const cached = fromCache('indices');
  if (cached) return res.json(cached);

  const [hg, sp500Res, nyseRes] = await Promise.allSettled([
    hgFetch(),
    yhFetch('^GSPC'),
    yhFetch('^NYA'),
  ]);

  const hgData = hg.status === 'fulfilled' ? hg.value : null;

  const data = {
    ibov:     hgData?.ibov     || null,
    ifix:     hgData?.ifix     || null,
    nasdaq:   hgData?.nasdaq   || null,
    dowjones: hgData?.dowjones || null,
    sp500:    sp500Res.status === 'fulfilled' ? sp500Res.value : null,
    nyse:     nyseRes.status  === 'fulfilled' ? nyseRes.value  : null,
  };

  toCache('indices', data);
  res.json(data);
});

// GET /api/market-data/fed
router.get('/fed', async (req, res) => {
  const cached = fromCache('fed');
  if (cached) return res.json(cached);

  const data = await fredFetch();
  if (!data) return res.status(502).json({ error: 'FRED unavailable' });
  toCache('fed', data);
  res.json(data);
});

module.exports = router;
