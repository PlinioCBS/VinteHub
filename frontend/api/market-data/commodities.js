const { fromCache, toCache, yhFetch } = require('./_helpers');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

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
};
