import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import { useAuth } from '../../auth/AuthProvider.jsx';
import { isApiConfigured } from '../../api/client.js';
import SavedVideo from '../../components/SavedVideo.jsx';
import { groupRecordingPlaces } from './recordingPlaces.js';
import './RecordedPlaces.css';

function RecordingContent({ map }) {
  const { authRequest } = useAuth();
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState('');
  const [videos, setVideos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [clipsLoading, setClipsLoading] = useState(false);
  const [clipsError, setClipsError] = useState('');
  const detail = useRef(null);
  const groups = useMemo(() => groupRecordingPlaces(videos), [videos]);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    authRequest('/api/trips').then(data => { if (active) setTrips(data.trips); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authRequest, retry]);
  useEffect(() => {
    let active = true;
    setVideos([]); setSelected(null); setClipsError('');
    if (!tripId) { setClipsLoading(false); return; }
    setClipsLoading(true);
    authRequest(`/api/trips/${tripId}/videos`).then(data => { if (active) setVideos(data.videos); })
      .catch(e => { if (active) setClipsError(e.message); })
      .finally(() => { if (active) setClipsLoading(false); });
    return () => { active = false; };
  }, [tripId, authRequest, retry]);
  useEffect(() => {
    if (!map) return;
    const layer = L.layerGroup().addTo(map);
    const points = groups.filter(place => place.located);
    const icon = L.divIcon({ className: 'recorded-place-pin', html: '<span aria-hidden="true">▶</span>', iconSize: [36,36], iconAnchor: [18,18] });
    for (const place of points) {
      const label = document.createElement('span');
      label.textContent = `${place.name} · ${place.videos.length}本`;
      L.marker([place.lat, place.lng], { icon, title: `${place.name}の動画を見る`, alt: `${place.name}の動画を見る`, keyboard: true })
        .bindTooltip(label).on('click', () => setSelected(place.key)).addTo(layer);
    }
    // Do not move the existing route until a trip with recordings is explicitly selected.
    if (points.length) map.fitBounds(points.map(place => [place.lat, place.lng]), { padding: [48,48], maxZoom: 16 });
    return () => { layer.clearLayers(); layer.remove(); };
  }, [map, groups]);
  useEffect(() => { if (selected) detail.current?.focus({ preventScroll: true }); }, [selected]);
  const place = groups.find(group => group.key === selected);
  return <>
    <div className="recorded-controls"><label>撮影場所を表示する旅行<select value={tripId} disabled={loading} onChange={e => { setTripId(e.target.value); setVideos([]); setSelected(null); }}><option value="">旅行を選択（非表示）</option>{trips.map(trip => <option key={trip.id} value={String(trip.id)}>{trip.title}</option>)}</select></label><button disabled={loading || clipsLoading} onClick={() => setRetry(n => n+1)}>記録を更新</button></div>
    {loading && <p role="status">旅行を読み込んでいます…</p>}
    {error && <p role="alert">{error}</p>}
    {!loading && !error && !trips.length && <p>まだ旅行がありません。<a href="#create">撮影画面で旅行を作る</a></p>}
    {clipsLoading && <p role="status">撮影場所を読み込んでいます…</p>}
    {clipsError && <p role="alert">{clipsError}</p>}
    {tripId && !clipsLoading && !clipsError && !videos.length && <p>この旅行にはまだ保存動画がありません。</p>}
    {groups.length > 0 && <><p>緑の▶ピン、または下の場所名から動画を開けます。</p><div className="recorded-place-list">{groups.map(group => <button key={group.key} aria-pressed={group.key === selected} onClick={() => { setSelected(group.key); if (group.located && map) map.setView([group.lat,group.lng],16); }}>{group.name} · {group.videos.length}本{!group.located && '（位置情報なし）'}</button>)}</div></>}
    {place && <div className="recorded-place-detail" key={`${tripId}-${place.key}`}><h3 ref={detail} tabIndex={-1}>{place.name}の動画</h3><button onClick={() => setSelected(null)}>動画を閉じる</button><div className="trip-video-list">{place.videos.map(video => <SavedVideo key={video.id} item={video} />)}</div></div>}
    <p className="recorded-note">自分の旅行のみ表示します。位置情報がない動画も場所名から再生できます。撮影地点の地図を表示すると、その周辺の地図画像をOpenStreetMapから取得します。</p>
  </>;
}
export default function RecordedPlaces({ map }) {
  const { user } = useAuth();
  return <section className="recorded-places" aria-labelledby="recorded-heading"><h2 id="recorded-heading">地図で思い出を振り返る</h2>{!isApiConfigured ? <p>保存動画を見るにはサーバーへの接続設定が必要です。</p> : user ? <RecordingContent key={user.id} map={map} /> : <p><a href="#profile">ログイン</a>すると、自分の旅行の撮影場所と動画を表示できます。</p>}</section>;
}
