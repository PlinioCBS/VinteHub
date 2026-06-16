const express = require('express');
const router = express.Router();

const TIMEOUT_MS = 10000;
function signal() { return AbortSignal.timeout(TIMEOUT_MS); }

const cache = {};
function fromCache(key) {
  const e = cache[key];
  return e && Date.now() - e.ts < 60000 ? e.data : null;
}
function toCache(key, data) { cache[key] = { ts: Date.now(), data }; }

// HG Brasil Finance — free, IBOVESPA, IFIX, NASDAQ, DOWJONES
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

// Yahoo Finance — basic quote (price + pct change)
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

// Yahoo Finance — full quote for favorites (includes day high/low, brapi-compatible shape)
async function yhFetchFull(symbol) {
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
      symbol:                     meta.symbol || symbol,
      shortName:                  meta.shortName || meta.longName || symbol,
      regularMarketPrice:         price,
      regularMarketChange:        parseFloat((price - (prev || price)).toFixed(4)),
      regularMarketChangePercent: parseFloat(changePct.toFixed(4)),
      regularMarketDayHigh:       meta.regularMarketDayHigh || null,
      regularMarketDayLow:        meta.regularMarketDayLow  || null,
      currency:                   meta.currency || '',
    };
  } catch { return null; }
}

// Yahoo Finance — historical closes for performance chart
async function yhHistoryFetch(symbol, range = '3mo') {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=${range}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' },
      signal: signal(),
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
        date:  new Date(ts * 1000).toISOString().split('T')[0],
        close: closes[i],
        pct:   closes[i] != null ? parseFloat(((closes[i] - firstClose) / firstClose * 100).toFixed(2)) : null,
      }))
      .filter(p => p.close != null);
  } catch { return null; }
}

// FRED — Federal Reserve FEDFUNDS
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
// Yahoo Finance is the primary source for all indices (proven reliable from Render's network).
// HG Brasil is kept only as a fallback for IBOVESPA/IFIX, since some hosts/IPs get throttled by it.
router.get('/indices', async (req, res) => {
  const cached = fromCache('indices');
  if (cached) return res.json(cached);

  const [ibovRes, ifixRes, nasdaqRes, dowRes, sp500Res, nyseRes, hg] = await Promise.allSettled([
    yhFetch('^BVSP'),
    yhFetch('XFIX11.SA'), // ETF that tracks IFIX (Yahoo has no native IFIX index ticker)
    yhFetch('^IXIC'),
    yhFetch('^DJI'),
    yhFetch('^GSPC'),
    yhFetch('^NYA'),
    hgFetch(),
  ]);

  const hgData = hg.status === 'fulfilled' ? hg.value : null;
  const pick = (settled, hgField) => (settled.status === 'fulfilled' && settled.value) || hgData?.[hgField] || null;

  const data = {
    ibov:     pick(ibovRes,   'ibov'),
    ifix:     pick(ifixRes,   'ifix'),
    nasdaq:   pick(nasdaqRes, 'nasdaq'),
    dowjones: pick(dowRes,    'dowjones'),
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

// GET /api/market-data/commodities
router.get('/commodities', async (req, res) => {
  const cached = fromCache('commodities');
  if (cached) return res.json(cached);

  const [wtiRes, brentRes, goldRes] = await Promise.allSettled([
    yhFetch('CL=F'),
    yhFetch('BZ=F'),
    yhFetch('GC=F'),
  ]);

  const data = {
    wti:   wtiRes.status   === 'fulfilled' ? wtiRes.value   : null,
    brent: brentRes.status === 'fulfilled' ? brentRes.value : null,
    gold:  goldRes.status  === 'fulfilled' ? goldRes.value  : null,
  };

  toCache('commodities', data);
  res.json(data);
});

// GET /api/market-data/history?symbols=^BVSP,^GSPC&range=3mo
router.get('/history', async (req, res) => {
  const symbolsParam = (req.query.symbols || '^BVSP,^GSPC').slice(0, 60);
  const range = ['1mo', '3mo', '6mo', '1y'].includes(req.query.range) ? req.query.range : '3mo';
  const symbols = symbolsParam.split(',').slice(0, 4);
  const cacheKey = `hist_${symbolsParam}_${range}`;

  const cached = fromCache(cacheKey);
  if (cached) return res.json(cached);

  const results = await Promise.allSettled(symbols.map(s => yhHistoryFetch(s, range)));
  const data = {};
  symbols.forEach((s, i) => {
    data[s] = results[i].status === 'fulfilled' ? results[i].value : null;
  });

  toCache(cacheKey, data);
  res.json(data);
});

// GET /api/market-data/quote/:symbol  (for favorites — replaces brapi)
router.get('/quote/:symbol', async (req, res) => {
  const { symbol } = req.params;
  if (!symbol || symbol.length > 20) return res.json({ notFound: true, symbol: symbol || '' });

  const cacheKey = `quote_${symbol}`;
  const cached = fromCache(cacheKey);
  if (cached) return res.json(cached);

  // Try B3 (.SA) and plain in parallel; take first non-null
  const [saData, plainData] = await Promise.all([
    !symbol.includes('.') ? yhFetchFull(`${symbol}.SA`) : Promise.resolve(null),
    yhFetchFull(symbol),
  ]);

  const data = saData || plainData;
  if (!data) return res.json({ notFound: true, symbol });

  toCache(cacheKey, data);
  res.json(data);
});

module.exports = router;
