const express = require('express');
const router = express.Router();
const https = require('https');

// Simple in-memory cache (60s TTL)
const cache = {};
function fromCache(key) {
  const e = cache[key];
  return e && Date.now() - e.ts < 60000 ? e.data : null;
}
function toCache(key, data) { cache[key] = { ts: Date.now(), data }; }

function httpsGet(url, headers = {}) {
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)', ...headers }
    }, (res) => {
      // Follow redirects
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return httpsGet(res.headers.location, headers).then(resolve);
      }
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => resolve({ status: res.statusCode, body: raw }));
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

// HG Brasil Finance — free, no key required, has IBOVESPA, IFIX, NASDAQ, DOWJONES
async function hgFetch() {
  const result = await httpsGet('https://api.hgbrasil.com/finance?format=json-cors');
  if (!result || result.status !== 200) return null;
  try {
    const d = JSON.parse(result.body);
    const stocks = d.results?.stocks || {};
    function toCard(key, label) {
      const s = stocks[key];
      if (!s) return null;
      return {
        symbol: key,
        name:      label || s.name,
        price:     s.points,
        change:    null,
        changePct: s.variation,
        currency:  'BRL',
      };
    }
    return {
      ibov:     toCard('IBOVESPA', 'IBOVESPA'),
      ifix:     toCard('IFIX',     'IFIX'),
      nasdaq:   toCard('NASDAQ',   'NASDAQ'),
      dowjones: toCard('DOWJONES', 'Dow Jones'),
    };
  } catch { return null; }
}

// Yahoo Finance — for S&P 500 and NYSE (not available on HG Brasil)
function yhFetch(symbol) {
  return new Promise((resolve) => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=2d`;
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' }
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(raw);
          const meta = parsed.chart?.result?.[0]?.meta;
          if (!meta) return resolve(null);
          const price = meta.regularMarketPrice;
          const prev  = meta.chartPreviousClose || meta.previousClose;
          const changePct = prev ? ((price - prev) / prev) * 100 : 0;
          const change    = prev ? price - prev : 0;
          resolve({
            symbol,
            name:      meta.shortName || meta.longName || symbol,
            price,
            change:    parseFloat(change.toFixed(2)),
            changePct: parseFloat(changePct.toFixed(2)),
            currency:  meta.currency || '',
          });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

// FRED (St. Louis Fed) — FEDFUNDS official rate, updated monthly
async function fredFetch() {
  const result = await httpsGet('https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS');
  if (!result || result.status !== 200) return null;
  try {
    const lines = result.body.trim().split('\n').filter(l => !l.startsWith('DATE') && l.includes(','));
    const last = lines[lines.length - 1];
    const [date, val] = last.split(',');
    return { date, rate: parseFloat(val) };
  } catch { return null; }
}

// GET /api/market-data/indices
// Returns: ibov, ifix, sp500, nasdaq, nyse, dowjones
router.get('/indices', async (req, res) => {
  const cached = fromCache('indices');
  if (cached) return res.json(cached);

  // Parallel: HG Brasil (BR + NASDAQ + DowJones) + Yahoo Finance (S&P500 + NYSE)
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
    sp500:    sp500Res.status  === 'fulfilled' ? sp500Res.value  : null,
    nyse:     nyseRes.status   === 'fulfilled' ? nyseRes.value   : null,
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
