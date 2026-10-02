// 地図画面で使う外部サービス（場所の検索・経路検索）とのやりとりをまとめたファイルです。
//
// ■ 場所の検索：Nominatim（OpenStreetMap）
//   利用条件 https://operations.osmfoundation.org/policies/nominatim/
//   ・1秒に1回まで ・入力中に候補を出す（オートコンプリート）は禁止 ・結果はキャッシュする
// ■ 経路検索：FOSSGIS の OSRM サーバー
//   利用条件 https://routing.openstreetmap.de/about.html
//   ・1秒に1回まで ・大量に使わない ・出典と「地図の誤りを報告」リンクを表示する

const SEARCH_URL = 'https://nominatim.openstreetmap.org/search';
const ROUTING_URL = 'https://routing.openstreetmap.de';

// 移動手段ごとの経路サーバー
const routingProfiles = {
  foot: 'routed-foot',
  car: 'routed-car',
};

// 画面に出すエラー文を持たせるための専用エラー
export class MapServiceError extends Error {}

// ---- 1秒に1回までに抑える仕組み ----
const lastRequestTime = { search: 0, route: 0 };
const MIN_INTERVAL_MS = 1100; // 余裕をもって1.1秒

async function waitForTurn(service) {
  const waitMs = lastRequestTime[service] + MIN_INTERVAL_MS - Date.now();
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  lastRequestTime[service] = Date.now();
}

async function fetchJson(url) {
  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new MapServiceError('通信できませんでした。インターネット接続を確認してください。');
  }
  if (!response.ok) {
    throw new MapServiceError(`サービスが混み合っています（エラー ${response.status}）。少し待ってからお試しください。`);
  }
  return response.json();
}

// ---- 場所の検索 ----
const searchCache = new Map(); // 同じ言葉で何度も問い合わせないための保存場所

export async function searchPlaces(keyword) {
  const query = keyword.trim();
  if (searchCache.has(query)) return searchCache.get(query);

  await waitForTurn('search');
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    limit: '5',
    'accept-language': 'ja',
    countrycodes: 'jp', // 試作品なので日本国内に限定
  });
  const items = await fetchJson(`${SEARCH_URL}?${params}`);

  const places = items.map((item) => ({
    id: String(item.place_id),
    name: item.name || item.display_name.split(',')[0],
    address: item.display_name,
    lat: Number(item.lat),
    lng: Number(item.lon),
  }));
  searchCache.set(query, places);
  return places;
}

// ---- 経路検索 ----
// from / to は { lat, lng }、mode は 'foot' か 'car'
export async function fetchRoute(from, to, mode) {
  await waitForTurn('route');
  const points = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${ROUTING_URL}/${routingProfiles[mode]}/route/v1/driving/${points}?overview=full&geometries=geojson`;
  const data = await fetchJson(url);

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new MapServiceError('この目的地までのルートが見つかりませんでした。');
  }
  const route = data.routes[0];
  return {
    distance: route.distance, // メートル
    duration: route.duration, // 秒
    // サーバーは [経度, 緯度] の順なので、Leaflet 用に [緯度, 経度] へ並べ替える
    path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
  };
}

// ---- 表示用の書式 ----
export function formatDistance(meters) {
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

export function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `約${minutes}分`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `約${hours}時間` : `約${hours}時間${rest}分`;
}
