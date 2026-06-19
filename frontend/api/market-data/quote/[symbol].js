const { fromCache, toCache, yhFetchFull } = require('../_helpers');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { symbol } = req.query;
  if (!symbol || symbol.length > 20) return res.json({ notFound: true, symbol: symbol || '' });

  const cacheKey = `quote_${symbol}`;
  const cached = fromCache(cacheKey);
  if (cached) return res.json(cached);

  const [saData, plainData] = await Promise.all([
    !symbol.includes('.') ? yhFetchFull(`${symbol}.SA`) : Promise.resolve(null),
    yhFetchFull(symbol),
  ]);

  const data = saData || plainData;
  if (!data) return res.json({ notFound: true, symbol });

  toCache(cacheKey, data);
  res.json(data);
};
