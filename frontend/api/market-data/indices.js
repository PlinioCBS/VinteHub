const { fromCache, toCache, yhFetch, hgFetch } = require('./_helpers');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const cached = fromCache('indices');
  if (cached) return res.json(cached);

  const [ibovRes, ifixRes, nasdaqRes, dowRes, sp500Res, nyseRes, hg] = await Promise.allSettled([
    yhFetch('^BVSP'),
    yhFetch('XFIX11.SA'),
    yhFetch('^IXIC'),
    yhFetch('^DJI'),
    yhFetch('^GSPC'),
    yhFetch('^NYA'),
    hgFetch(),
  ]);

  const hgData = hg.status === 'fulfilled' ? hg.value : null;
  const pick = (settled, hgField) =>
    (settled.status === 'fulfilled' && settled.value) || hgData?.[hgField] || null;

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
};
