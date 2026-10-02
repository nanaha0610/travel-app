import { useEffect, useRef } from 'react';
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

export default function MapPage() {
  const mapElementRef = useRef(null);

  useEffect(() => {
    // 地図を作成
    const map = L.map(mapElementRef.current);

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
    return () => map.remove();
  }, []);

  return (
    <PageShell title="旅の地図" description="目的地までの道中に、新しい発見を。">
      <div ref={mapElementRef} className="map-view" role="region" aria-label="観光スポットの地図" />
      <p className="status-note">サンプルの観光スポットを表示しています。経路検索・現在地は準備中です。</p>
    </PageShell>
  );
}
