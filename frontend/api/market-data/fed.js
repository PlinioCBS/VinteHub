const { fromCache, toCache, fredFetch } = require('./_helpers');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cached = fromCache('fed');
  if (cached) return res.json(cached);

  const data = await fredFetch();
  if (!data) return res.status(502).json({ error: 'FRED unavailable' });

  toCache('fed', data);
  res.json(data);
};
