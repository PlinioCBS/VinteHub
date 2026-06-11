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
            name:        meta.shortName || meta.longName || symbol,
            price,
            change:      parseFloat(change.toFixed(2)),
            changePct:   parseFloat(changePct.toFixed(2)),
            currency:    meta.currency || '',
          });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

function fredFetch() {
  return new Promise((resolve) => {
    const url = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=FEDFUNDS';
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; VinteHub/1.0)' }
    }, (res) => {
      let raw = '';
      res.on('data', d => raw += d);
      res.on('end', () => {
        try {
          const lines = raw.trim().split('\n').filter(l => !l.startsWith('DATE') && l.includes(','));
          const last = lines[lines.length - 1];
          const [date, val] = last.split(',');
          resolve({ date, rate: parseFloat(val) });
        } catch { resolve(null); }
      });
    });
    req.on('error', () => resolve(null));
    req.setTimeout(8000, () => { req.destroy(); resolve(null); });
  });
}

// GET /api/market-data/indices
router.get('/indices', async (req, res) => {
  const cached = fromCache('indices');
  if (cached) return res.json(cached);

  const symbols = [
    { key: 'ibov',   sym: '^BVSP'   },
    { key: 'ifix',   sym: 'IFIX.SA' },
    { key: 'sp500',  sym: '^GSPC'   },
    { key: 'nasdaq', sym: '^IXIC'   },
    { key: 'nyse',   sym: '^NYA'    },
  ];

  const results = await Promise.allSettled(symbols.map(s => yhFetch(s.sym)));
  const data = {};
  symbols.forEach((s, i) => {
    data[s.key] = results[i].status === 'fulfilled' ? results[i].value : null;
  });

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
