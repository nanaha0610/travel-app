import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import PageShell from '../components/PageShell.jsx';
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

// 位置情報の取得に失敗したときの説明文
const locationErrorMessages = {
  1: '位置情報の利用が許可されていません。ブラウザのアドレスバー左側のアイコンから、位置情報を「許可」に変更してください。',
  2: '現在地を取得できませんでした。電波の良い場所で、もう一度お試しください。',
  3: '現在地の取得に時間がかかりすぎました。もう一度お試しください。',
};

export default function MapPage() {
  const mapElementRef = useRef(null);
  const mapRef = useRef(null); // 作成した地図を保存しておく場所
  const locationLayerRef = useRef(null); // 現在地の点と誤差の円をまとめる場所
  const [location, setLocation] = useState({ status: 'idle', message: '' });

  useEffect(() => {
    // 地図を作成
    const map = L.map(mapElementRef.current);
    mapRef.current = map;
    locationLayerRef.current = L.layerGroup().addTo(map);

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
    };
  }, []);

  // 「現在地を表示」ボタンを押したときの処理
  function showCurrentLocation() {
    // 位置情報は HTTPS（または localhost）でしか使えない
    if (!window.isSecureContext) {
      setLocation({
        status: 'error',
        message: '位置情報は HTTPS のページでしか使えません。PC では http://localhost:5173 で開いてください。',
      });
      return;
    }
    if (!('geolocation' in navigator)) {
      setLocation({ status: 'error', message: 'このブラウザは位置情報に対応していません。' });
      return;
    }

    setLocation({ status: 'locating', message: '現在地を取得しています…' });

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const map = mapRef.current;
        const layer = locationLayerRef.current;
        if (!map || !layer) return; // 取得中に別の画面へ移動した場合は何もしない

        const { latitude, longitude, accuracy } = position.coords;
        const latlng = [latitude, longitude];

        // 前回の現在地を消してから、新しく描く
        layer.clearLayers();
        const accuracyCircle = L.circle(latlng, {
          radius: accuracy,
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

        // 誤差の円が全部見えるように移動（近づきすぎない）
        map.fitBounds(accuracyCircle.getBounds(), { maxZoom: 17 });

        setLocation({
          status: 'success',
          message: `現在地を表示しました（誤差 約${Math.round(accuracy)}m）。`,
        });
      },
      (error) => {
        setLocation({
          status: 'error',
          message: locationErrorMessages[error.code] ?? '現在地を取得できませんでした。',
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <PageShell title="旅の地図" description="目的地までの道中に、新しい発見を。">
      <div className="map-toolbar">
        <button
          type="button"
          className="location-button"
          onClick={showCurrentLocation}
          disabled={location.status === 'locating'}
        >
          {location.status === 'locating' ? '取得中…' : '現在地を表示'}
        </button>
        <p className={`location-message ${location.status}`} role="status" aria-live="polite">
          {location.message}
        </p>
      </div>
      <div ref={mapElementRef} className="map-view" role="region" aria-label="観光スポットの地図" />
      <p className="status-note">
        現在地はこの画面での表示にだけ使い、保存や送信はしません。経路検索は準備中です。
      </p>
    </PageShell>
  );
}
