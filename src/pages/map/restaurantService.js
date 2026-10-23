// ルート沿いの飲食店を探す処理です。
//
// ■ データ：OpenStreetMap に登録されたお店（Overpass API で検索）
//   利用の目安 https://dev.overpass-api.de/overpass-doc/en/preface/commons.html
//   ・1日1万回・1GB程度まで ・大量に使わない
//   ・データは OpenStreetMap（ODbL）なので出典を表示する
import { MapServiceError, fetchJson, waitForTurn } from './routeServices.js';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const MAX_RESULTS = 50; // 地図が見えなくならないよう最大50件

// 移動手段ごとの設定
const searchSettings = {
  foot: { radius: 100, maxRouteMeters: 10000, stepMeters: 100 }, // 道から約100m・ルート10kmまで
  car: { radius: 300, maxRouteMeters: 40000, stepMeters: 250 }, // 道から約300m・ルート40kmまで
};
const MAX_POINTS = 200; // サーバーに送るルートの点の数の上限

const kindLabels = {
  restaurant: 'レストラン',
  cafe: 'カフェ',
  fast_food: 'ファストフード',
};

// よく使われる料理ジャンルだけ日本語にする（それ以外は登録された文字のまま）
const cuisineLabels = {
  japanese: '和食', sushi: '寿司', ramen: 'ラーメン', soba: 'そば', udon: 'うどん',
  noodle: '麺類', tempura: '天ぷら', yakiniku: '焼肉', yakitori: '焼き鳥', curry: 'カレー',
  chinese: '中華', korean: '韓国料理', italian: 'イタリアン', french: 'フレンチ',
  indian: 'インド料理', thai: 'タイ料理', pizza: 'ピザ', burger: 'ハンバーガー',
  coffee_shop: 'コーヒー', cake: 'ケーキ', donut: 'ドーナツ', sandwich: 'サンドイッチ',
  steak_house: 'ステーキ', beef_bowl: '牛丼', okonomiyaki: 'お好み焼き', chicken: 'チキン',
};

// 2点間の距離（メートル）
function distanceMeters(a, b) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.asin(Math.sqrt(h));
}

// ルートの点が多すぎるとサーバーの負担になるので、一定間隔ごとに間引く
function thinOutPath(path, routeMeters, stepMeters) {
  const step = Math.max(stepMeters, routeMeters / MAX_POINTS);
  const points = [path[0]];
  let sinceLast = 0;
  for (let i = 1; i < path.length; i += 1) {
    sinceLast += distanceMeters(path[i - 1], path[i]);
    if (sinceLast >= step) {
      points.push(path[i]);
      sinceLast = 0;
    }
  }
  if (points[points.length - 1] !== path[path.length - 1]) points.push(path[path.length - 1]);
  return points;
}

function buildAddress(tags) {
  if (tags['addr:full']) return tags['addr:full'];
  const parts = [
    tags['addr:province'], tags['addr:city'], tags['addr:suburb'], tags['addr:quarter'],
    tags['addr:neighbourhood'], tags['addr:street'], tags['addr:block_number'], tags['addr:housenumber'],
  ].filter(Boolean);
  return parts.join('');
}

// http(s) で始まる安全なURLだけ使う
function safeUrl(value) {
  if (!value) return '';
  const url = value.startsWith('http') ? value : `https://${value}`;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

function toRestaurant(element) {
  const tags = element.tags ?? {};
  const lat = element.lat ?? element.center?.lat;
  const lng = element.lon ?? element.center?.lon;
  const name = tags['name:ja'] || tags.name;
  if (!name || lat == null || lng == null) return null; // 名前や位置がないものは表示しない

  const cuisine = (tags.cuisine ?? '')
    .split(';')
    .map((c) => c.trim())
    .filter(Boolean)
    .map((c) => cuisineLabels[c] ?? c)
    .join('・');

  return {
    id: `${element.type}/${element.id}`,
    name,
    lat,
    lng,
    kind: kindLabels[tags.amenity] ?? '飲食店',
    cuisine,
    openingHours: tags.opening_hours ?? '',
    address: buildAddress(tags),
    phone: tags.phone || tags['contact:phone'] || '',
    website: safeUrl(tags.website || tags['contact:website']),
    osmUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
  };
}

const restaurantCache = new Map(); // 同じルートで何度も問い合わせないための保存場所

// path はルートの点の並び [[緯度, 経度], ...]、routeMeters はルートの長さ
export async function fetchRestaurantsAlongRoute(path, routeMeters, mode) {
  const settings = searchSettings[mode];
  if (routeMeters > settings.maxRouteMeters) {
    throw new MapServiceError(
      `ルートが長いため、飲食店は表示していません（${mode === 'foot' ? '徒歩は10km' : '車は40km'}まで）。`,
    );
  }

  const points = thinOutPath(path, routeMeters, settings.stepMeters);
  const pointText = points.map(([lat, lng]) => `${lat.toFixed(5)},${lng.toFixed(5)}`).join(',');
  const cacheKey = `${mode}:${pointText}`;
  if (restaurantCache.has(cacheKey)) return restaurantCache.get(cacheKey);

  // ルートの線から radius メートル以内のレストラン・カフェ・ファストフードを探す
  const query = `[out:json][timeout:25];
nwr["amenity"~"^(restaurant|cafe|fast_food)$"](around:${settings.radius},${pointText});
out center ${MAX_RESULTS * 2};`;

  await waitForTurn('restaurants');
  const data = await fetchJson(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query }),
  });

  const restaurants = (data.elements ?? [])
    .map(toRestaurant)
    .filter(Boolean)
    .slice(0, MAX_RESULTS);
  restaurantCache.set(cacheKey, restaurants);
  return restaurants;
}
