const { fromCache, toCache, yhHistoryFetch } = require('./_helpers');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

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
};
