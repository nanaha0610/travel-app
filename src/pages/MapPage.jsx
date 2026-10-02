import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import PageShell from '../components/PageShell.jsx';
import {
  MapServiceError,
  fetchRoute,
  formatDistance,
  formatDuration,
  searchPlaces,
} from './map/routeServices.js';
import { fetchRestaurantsAlongRoute } from './map/restaurantService.js';
import './MapPage.css';

// 動作確認用の仮のサンプルスポットです。
// 本番のデータ形式（動画との紐付けなど）はチームで決めてから置き換えます。
const sampleSpots = [
  { id: 'sensoji', name: '浅草寺', lat: 35.7148, lng: 139.7967 },
  { id: 'skytree', name: '東京スカイツリー', lat: 35.7101, lng: 139.8107 },
  { id: 'ueno-park', name: '上野恩賜公園', lat: 35.7156, lng: 139.7745 },
];

// Vite では Leaflet 標準のピン画像の場所が自動で見つからないため、明示的に指定します。
const spotIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  tooltipAnchor: [0, -36],
  shadowSize: [41, 41],
});

const travelModes = [
  { id: 'foot', label: '徒歩' },
  { id: 'car', label: '車' },
];

// 位置情報の取得に失敗したときの説明文
const locationErrorMessages = {
  1: '位置情報の利用が許可されていません。ブラウザのアドレスバー左側のアイコンから、位置情報を「許可」に変更してください。',
  2: '現在地を取得できませんでした。電波の良い場所で、もう一度お試しください。',
  3: '現在地の取得に時間がかかりすぎました。もう一度お試しください。',
};

// 現在地を1回取得する（成功したら座標、失敗したら説明文つきのエラー）
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    // 位置情報は HTTPS（または localhost）でしか使えない
    if (!window.isSecureContext) {
      reject(new MapServiceError('位置情報は HTTPS のページでしか使えません。PC では http://localhost:5173 で開いてください。'));
      return;
    }
    if (!('geolocation' in navigator)) {
      reject(new MapServiceError('このブラウザは位置情報に対応していません。'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        resolve({ lat: latitude, lng: longitude, accuracy });
      },
      (error) => {
        reject(new MapServiceError(locationErrorMessages[error.code] ?? '現在地を取得できませんでした。'));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  });
}

// 外部から来た文字（店名・地名）を、HTML として解釈させずに表示するための部品
// （文字をそのまま渡すと、悪意のある名前が登録されていた場合にプログラムとして動いてしまう）
function textElement(text) {
  const span = document.createElement('span');
  span.textContent = text;
  return span;
}

// 飲食店のピンを押したときの吹き出しの中身を作る
// （お店の情報は外部のデータなので、innerHTML は使わず文字として安全に入れる）
function createRestaurantPopup(restaurant) {
  const box = document.createElement('div');
  box.className = 'restaurant-popup';

  const title = document.createElement('strong');
  title.textContent = restaurant.name;
  box.append(title);

  const kind = document.createElement('p');
  kind.className = 'restaurant-kind';
  kind.textContent = [restaurant.kind, restaurant.cuisine].filter(Boolean).join('／');
  box.append(kind);

  const rows = [
    ['営業時間', restaurant.openingHours],
    ['住所', restaurant.address],
    ['電話', restaurant.phone],
  ];
  const list = document.createElement('dl');
  rows.filter(([, value]) => value).forEach(([label, value]) => {
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.textContent = value;
    list.append(dt, dd);
  });
  if (list.childElementCount > 0) box.append(list);

  const links = document.createElement('p');
  links.className = 'restaurant-links';
  if (restaurant.website) {
    const site = document.createElement('a');
    site.href = restaurant.website;
    site.target = '_blank';
    site.rel = 'noreferrer';
    site.textContent = 'Webサイト';
    links.append(site, ' ');
  }
  const osm = document.createElement('a');
  osm.href = restaurant.osmUrl;
  osm.target = '_blank';
  osm.rel = 'noreferrer';
  osm.textContent = 'OpenStreetMapで見る';
  links.append(osm);
  box.append(links);

  const note = document.createElement('p');
  note.className = 'restaurant-note';
  note.textContent = '情報は古い場合があります。';
  box.append(note);
  return box;
}

function errorText(error) {
  return error instanceof MapServiceError ? error.message : '予期しないエラーが起きました。もう一度お試しください。';
}

export default function MapPage() {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null); // 作成した地図を保存しておく場所
  const locationLayerRef = useRef(null); // 現在地の点と誤差の円
  const routeLayerRef = useRef(null); // ルートの線と目的地のピン
  const restaurantLayerRef = useRef(null); // ルート沿いの飲食店のピン
  const routeRequestRef = useRef(0); // 古いルート結果で上書きしないための番号

  const [location, setLocation] = useState({ status: 'idle', message: '' });
  const [keyword, setKeyword] = useState('');
  const [search, setSearch] = useState({ status: 'idle', message: '', results: [] });
  const [mode, setMode] = useState('foot');
  const [destination, setDestination] = useState(null);
  const [route, setRoute] = useState({ status: 'idle', message: '', summary: null });
  const [restaurants, setRestaurants] = useState({ status: 'idle', message: '', count: 0 });
  const [showRestaurants, setShowRestaurants] = useState(true);

  useEffect(() => {
    // 地図を作成
    const map = L.map(mapElementRef.current);
    mapRef.current = map;
    locationLayerRef.current = L.layerGroup().addTo(map);
    routeLayerRef.current = L.layerGroup().addTo(map);
    restaurantLayerRef.current = L.layerGroup().addTo(map);

    // OpenStreetMap の地図画像（出典表示は利用条件なので消さないこと）
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors',
    }).addTo(map);

    // サンプルスポットにピンと名前を表示
    sampleSpots.forEach((spot) => {
      L.marker([spot.lat, spot.lng], { icon: spotIcon, alt: spot.name })
        .bindTooltip(spot.name, { permanent: true, direction: 'top', className: 'spot-label' })
        .addTo(map);
    });

    // すべてのピンが入るように表示範囲を調整
    map.fitBounds(
      sampleSpots.map((spot) => [spot.lat, spot.lng]),
      { padding: [48, 48] },
    );

    // 画面を離れるときに地図を片付ける（二重作成のエラー防止）
    return () => {
      map.remove();
      mapRef.current = null;
      locationLayerRef.current = null;
      routeLayerRef.current = null;
      restaurantLayerRef.current = null;
    };
  }, []);

  // 現在地（青い点と誤差の円）を描く。誤差の円を返す
  function drawCurrentLocation(position) {
    const layer = locationLayerRef.current;
    if (!layer) return null;
    const latlng = [position.lat, position.lng];
    layer.clearLayers();
    const accuracyCircle = L.circle(latlng, {
      radius: position.accuracy,
      color: '#1f6feb',
      weight: 1,
      fillOpacity: 0.12,
      interactive: false,
    }).addTo(layer);
    L.circleMarker(latlng, {
      radius: 8,
      color: '#ffffff',
      weight: 3,
      fillColor: '#1f6feb',
      fillOpacity: 1,
    })
      .bindTooltip('現在地', { direction: 'top', offset: [0, -8] })
      .addTo(layer);
    return accuracyCircle;
  }

  // 「現在地を表示」ボタン
  async function showCurrentLocation() {
    setLocation({ status: 'locating', message: '現在地を取得しています…' });
    try {
      const position = await getCurrentPosition();
      const accuracyCircle = drawCurrentLocation(position);
      if (!accuracyCircle) return; // 取得中に別の画面へ移動した
      mapRef.current.fitBounds(accuracyCircle.getBounds(), { maxZoom: 17 });
      setLocation({
        status: 'success',
        message: `現在地を表示しました（誤差 約${Math.round(position.accuracy)}m）。`,
      });
    } catch (error) {
      setLocation({ status: 'error', message: errorText(error) });
    }
  }

  // 検索フォーム（ボタンを押したときだけ検索する。入力中の自動検索は利用条件で禁止）
  async function handleSearch(event) {
    event.preventDefault();
    if (!keyword.trim() || search.status === 'searching') return;
    setSearch({ status: 'searching', message: '検索しています…', results: [] });
    try {
      const results = await searchPlaces(keyword);
      setSearch({
        status: results.length ? 'success' : 'error',
        message: results.length ? '目的地を選んでください。' : '見つかりませんでした。別の言葉でお試しください。',
        results,
      });
    } catch (error) {
      setSearch({ status: 'error', message: errorText(error), results: [] });
    }
  }

  // 現在地から目的地までのルートを出す
  async function showRoute(place, travelMode) {
    const requestId = ++routeRequestRef.current;
    const isLatest = () => requestId === routeRequestRef.current && mapRef.current;

    setRoute({ status: 'loading', message: '現在地を取得しています…', summary: null });
    try {
      const position = await getCurrentPosition();
      if (!isLatest()) return;
      drawCurrentLocation(position);

      setRoute({ status: 'loading', message: 'ルートを検索しています…', summary: null });
      const result = await fetchRoute(position, place, travelMode);
      if (!isLatest()) return;

      // 前のルートを消して、新しいルートと目的地のピンを描く
      const layer = routeLayerRef.current;
      layer.clearLayers();
      const line = L.polyline(result.path, {
        color: travelMode === 'foot' ? '#1a7f37' : '#1f6feb',
        weight: 6,
        opacity: 0.85,
      }).addTo(layer);
      L.marker([place.lat, place.lng], { icon: spotIcon, alt: place.name })
        .bindTooltip(textElement(place.name), { permanent: true, direction: 'top', className: 'spot-label destination-label' })
        .addTo(layer);
      mapRef.current.fitBounds(line.getBounds(), { padding: [40, 40] });

      const modeLabel = travelModes.find((m) => m.id === travelMode).label;
      setRoute({
        status: 'success',
        message: '',
        summary: `${modeLabel} ${formatDistance(result.distance)}・${formatDuration(result.duration)}`,
      });

      await showRestaurantsAlongRoute(result, travelMode, isLatest);
    } catch (error) {
      if (!isLatest()) return;
      setRoute({ status: 'error', message: errorText(error), summary: null });
    }
  }

  // ルート沿いの飲食店にピンを立てる
  async function showRestaurantsAlongRoute(result, travelMode, isLatest) {
    restaurantLayerRef.current?.clearLayers();
    setRestaurants({ status: 'loading', message: '近くの飲食店を探しています…', count: 0 });
    try {
      const found = await fetchRestaurantsAlongRoute(result.path, result.distance, travelMode);
      if (!isLatest()) return;
      const layer = restaurantLayerRef.current;
      found.forEach((restaurant) => {
        L.circleMarker([restaurant.lat, restaurant.lng], {
          radius: 9,
          color: '#ffffff',
          weight: 2,
          fillColor: '#e8590c',
          fillOpacity: 0.95,
        })
          .bindPopup(() => createRestaurantPopup(restaurant), { maxWidth: 260 })
          .bindTooltip(textElement(restaurant.name), { direction: 'top', offset: [0, -8] })
          .addTo(layer);
      });
      setRestaurants({
        status: 'success',
        message: found.length ? '' : 'ルートの近くに飲食店の登録が見つかりませんでした。',
        count: found.length,
      });
    } catch (error) {
      if (!isLatest()) return;
      setRestaurants({ status: 'error', message: errorText(error), count: 0 });
    }
  }

  // 飲食店のピンの表示／非表示
  function toggleRestaurants() {
    const map = mapRef.current;
    const layer = restaurantLayerRef.current;
    if (!map || !layer) return;
    if (showRestaurants) {
      map.removeLayer(layer);
    } else {
      layer.addTo(map);
    }
    setShowRestaurants(!showRestaurants);
  }

  function selectDestination(place) {
    setDestination(place);
    setSearch((current) => ({ ...current, status: 'idle', message: '', results: [] }));
    showRoute(place, mode);
  }

  function changeMode(nextMode) {
    if (nextMode === mode) return;
    setMode(nextMode);
    if (destination) showRoute(destination, nextMode);
  }

  function clearRoute() {
    routeRequestRef.current += 1; // 途中のルート検索結果を無視する
    routeLayerRef.current?.clearLayers();
    restaurantLayerRef.current?.clearLayers();
    setRestaurants({ status: 'idle', message: '', count: 0 });
    if (!showRestaurants && mapRef.current && restaurantLayerRef.current) {
      restaurantLayerRef.current.addTo(mapRef.current);
      setShowRestaurants(true);
    }
    setDestination(null);
    setRoute({ status: 'idle', message: '', summary: null });
  }

  return (
    <PageShell title="旅の地図" description="目的地までの道中に、新しい発見を。">
      <form className="route-search" onSubmit={handleSearch} role="search">
        <label htmlFor="destination-input" className="visually-hidden">目的地</label>
        <input
          id="destination-input"
          type="search"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          placeholder="目的地を入力（例：東京タワー）"
          autoComplete="off"
          enterKeyHint="search"
        />
        <button type="submit" disabled={!keyword.trim() || search.status === 'searching'}>
          {search.status === 'searching' ? '検索中…' : '検索'}
        </button>
      </form>

      <div className="mode-switch" role="group" aria-label="移動手段">
        {travelModes.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => changeMode(m.id)}
            disabled={route.status === 'loading'}
          >
            {m.label}
          </button>
        ))}
      </div>

      <p className={`map-message ${search.status}`} role="status" aria-live="polite">{search.message}</p>
      {search.results.length > 0 && (
        <ul className="search-results">
          {search.results.map((place) => (
            <li key={place.id}>
              <button type="button" onClick={() => selectDestination(place)}>
                <strong>{place.name}</strong>
                <span>{place.address}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(destination || route.status !== 'idle') && (
        <div className={`route-summary ${route.status}`} role="status" aria-live="polite">
          {destination && <p className="route-destination">目的地：{destination.name}</p>}
          {route.summary && <p className="route-result">{route.summary}</p>}
          {route.message && <p className="route-message">{route.message}</p>}
          {restaurants.status !== 'idle' && (
            <div className={`restaurant-status ${restaurants.status}`}>
              {restaurants.status === 'success' && restaurants.count > 0 && (
                <>
                  <span className="restaurant-count">
                    <span className="restaurant-dot" aria-hidden="true" />飲食店 {restaurants.count}件
                  </span>
                  <button type="button" className="text-button" onClick={toggleRestaurants} aria-pressed={showRestaurants}>
                    {showRestaurants ? '非表示にする' : '表示する'}
                  </button>
                </>
              )}
              {restaurants.message && <span>{restaurants.message}</span>}
            </div>
          )}
          {destination && (
            <button type="button" className="text-button" onClick={clearRoute}>ルートを消す</button>
          )}
        </div>
      )}

      <div className="map-toolbar">
        <button
          type="button"
          className="location-button"
          onClick={showCurrentLocation}
          disabled={location.status === 'locating'}
        >
          {location.status === 'locating' ? '取得中…' : '現在地を表示'}
        </button>
        <p className={`map-message ${location.status}`} role="status" aria-live="polite">
          {location.message}
        </p>
      </div>

      <div ref={mapElementRef} className="map-view" role="region" aria-label="観光スポットの地図" />

      <p className="map-credits">
        場所の検索：<a href="https://nominatim.org/" target="_blank" rel="noreferrer">Nominatim</a>
        ／ 経路：<a href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noreferrer">FOSSGIS（OSRM）</a>
        ／ 店舗情報：<a href="https://overpass-api.de/" target="_blank" rel="noreferrer">Overpass API</a>
        ／ 地図データ © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap contributors</a>
        ／ <a href="https://www.openstreetmap.org/fixthemap" target="_blank" rel="noreferrer">地図の誤りを報告</a>
      </p>
      <p className="status-note">
        ルート検索では、現在地と目的地を外部の経路サービス（FOSSGIS）に、検索した言葉を Nominatim に、ルート周辺の範囲を Overpass API に送信します。
        アプリ内には保存しません。所要時間は目安です。
      </p>
    </PageShell>
  );
}
