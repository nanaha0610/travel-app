import { rateLimit } from 'express-rate-limit';
import { fetchSpotsFromProvider } from '../../src/pages/map/restaurantService.js';

export function validRoute(body) {
  if (!body || !['foot','car'].includes(body.mode) || !Number.isFinite(body.routeMeters) || body.routeMeters <= 0 || body.routeMeters > (body.mode === 'foot' ? 10000 : 40000)) return false;
  if (!Array.isArray(body.path) || body.path.length < 2 || body.path.length > 202) return false;
  if (!body.path.every(p => Array.isArray(p) && p.length === 2 && p.every(Number.isFinite) && Math.abs(p[0]) <= 90 && Math.abs(p[1]) <= 180)) return false;
  // 広域の無制限検索に使われないよう、座標列の総距離も制限する。
  let distance = 0;
  for (let i = 1; i < body.path.length; i++) {
    const a = body.path[i-1], b = body.path[i], rad = Math.PI / 180;
    const h = Math.sin((b[0]-a[0])*rad/2)**2 + Math.cos(a[0]*rad)*Math.cos(b[0]*rad)*Math.sin((b[1]-a[1])*rad/2)**2;
    distance += 12742000*Math.asin(Math.sqrt(Math.min(1,h)));
  }
  return distance <= (body.mode === 'foot' ? 10500 : 40500);
}

async function providerRequest(url, options) {
  for (const endpoint of [url, 'https://overpass.kumi.systems/api/interpreter']) {
    try {
      const response = await fetch(endpoint, { ...options, headers: { ...options.headers, 'User-Agent': 'TravelAppStudentPrototype/0.1 (https://github.com/nanaha0610/travel-app)', Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
      if (!response.ok) continue;
      const data = await response.json();
      if (data.remark || !Array.isArray(data.elements)) continue;
      return data;
    } catch { /* 次の取得先で1回だけ試す */ }
  }
  throw new Error('SPOTS_UNAVAILABLE');
}

export function routeSpotRoutes(app) {
  let busy = false;
  app.post('/api/map/route-spots', rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false, message: { error: '少し時間をおいて再試行してください。' } }), async (req, res) => {
    if (!validRoute(req.body)) return res.status(400).json({ error: 'スポット検索は徒歩10km・車40km以内のルートを指定してください。' });
    if (busy) return res.status(503).json({ error: '周辺スポットを検索中です。少し待って再試行してください。' });
    busy = true;
    try {
      const { path, routeMeters, mode } = req.body;
      const spots = await fetchSpotsFromProvider(path, routeMeters, mode, providerRequest);
      res.json({ spots });
    } catch {
      res.status(503).json({ error: '外部のスポット検索サービスが応答しませんでした。ルートは利用できます。少し待って再試行してください。' });
    } finally { busy = false; }
  });
}
