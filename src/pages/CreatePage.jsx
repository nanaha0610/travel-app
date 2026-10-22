import { useEffect, useRef, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import CameraCapture from './CameraCapture.jsx';
import SpotPicker from './map/SpotPicker.jsx';
import SavedVideo from '../components/SavedVideo.jsx';
import './CreatePage.css';

import LoginPanel from '../components/LoginPanel.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { isApiConfigured } from '../api/client.js';

function CreateContent() {
  const { user, authRequest } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [tripLoadFailed, setTripLoadFailed] = useState(false);
  const [tripReloadKey, setTripReloadKey] = useState(0);
  const [tripId, setTripId] = useState('');
  const [videos, setVideos] = useState([]);
  const [place, setPlace] = useState('');
  const [location, setLocation] = useState(null);
  const [locating, setLocating] = useState(false);
  const [locationNotice, setLocationNotice] = useState('');
  const locationRequest = useRef(0);
  useEffect(() => () => { locationRequest.current++; }, []);
  function locate() {
    if (!navigator.geolocation) { setLocationNotice('このブラウザーでは現在地を取得できません。場所名だけでも保存できます。'); return; }
    const version = ++locationRequest.current;
    setLocating(true); setLocation(null); setLocationNotice('現在地を取得しています…');
    navigator.geolocation.getCurrentPosition(position => {
      if (version !== locationRequest.current) return;
      setLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      setLocating(false); setLocationNotice(`現在地を取得しました（精度の目安：約${Math.round(position.coords.accuracy)}m）。`);
    }, () => {
      if (version !== locationRequest.current) return;
      setLocating(false); setLocationNotice('現在地を取得できませんでした。場所名だけでも保存できます。');
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
  }
  const [draft, setDraft] = useState(null);
  const [spot, setSpot] = useState(null);
  const [publish, setPublish] = useState(false);
  useEffect(() => {
    setSpot(null); setPublish(false);
    if (!draft) { locationRequest.current++; setLocating(false); }
    else if (!location) locate();
  }, [draft?.uploadId]);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState(false);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [onlyToday, setOnlyToday] = useState(true);
  const [cameraKey, setCameraKey] = useState(0);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const selection = useRef(0);
  const locked = loadingTrips || busy || pending || !!draft || locating;
  useEffect(() => {
    if (!user) return;
    let active = true;
    setLoadingTrips(true); setTripLoadFailed(false);
    authRequest('/api/trips').then(data => { if (active) { setTrips(data.trips); setTripId(String(data.trips[0]?.id || '')); } }).catch(e => { if (active) { setError(e.message); setTripLoadFailed(true); } }).finally(() => { if (active) setLoadingTrips(false); });
    return () => { active = false; };
  }, [authRequest, tripReloadKey]);
  useEffect(() => {
    const version = ++selection.current;
    setVideos([]); setNotice(''); setLoadFailed(false);
    if (!tripId) return;
    setLoadingVideos(true);
    authRequest(`/api/trips/${tripId}/videos`).then(data => { if (version === selection.current) setVideos(data.videos); })
      .catch(e => { if (version === selection.current) { setError(e.message); setLoadFailed(true); } })
      .finally(() => { if (version === selection.current) setLoadingVideos(false); });
    return () => { selection.current++; };
  }, [tripId, authRequest, reloadKey]);
  async function addTrip(event) {
    event.preventDefault(); setPending(true); setError('');
    const form = event.currentTarget;
    try {
      const { trip } = await authRequest('/api/trips', { method: 'POST', body: { title: new FormData(form).get('title').trim() } });
      setTrips(current => [trip, ...current]); setTripId(String(trip.id)); form.reset();
    } catch (e) { setError(e.message); } finally { setPending(false); }
  }
  async function save() {
    if (!draft || pending || locating) return;
    if (location && !place.trim() && !spot) { setError('位置情報を付ける場合は、場所名を入力してください。'); return; }
    if (draft.blob.size > 2 * 1024 * 1024) { setError('2MBを超えています。撮り直してください。'); return; }
    setPending(true); setError(''); setNotice('');
    try {
      const params = new URLSearchParams({ uploadId: draft.uploadId, capturedAt: draft.capturedAt, place: spot ? spot.name.slice(0,100) : place.trim() || '場所未設定' });
      if (spot) { params.set('spotId', String(spot.id)); params.set('publish', String(publish)); }
      if (location) { params.set('latitude', String(location.latitude)); params.set('longitude', String(location.longitude)); }
      await authRequest(`/api/trips/${tripId}/videos?${params}`, { method: 'POST', rawBody: draft.blob, contentType: draft.blob.type.split(';')[0] });
      // Clear only after the server has committed. Retry keeps the same upload ID.
      setDraft(null); setCameraKey(key => key + 1); setBusy(false); setNotice('この旅行に保存しました。');
      setLocation(null); setLocationNotice(''); setPlace('');
      const data = await authRequest(`/api/trips/${tripId}/videos`); setVideos(data.videos);
    } catch (e) { setError(e.message); } finally { setPending(false); }
  }
  const visibleVideos = onlyToday ? videos.filter(item => new Date(item.captured_at).toDateString() === new Date().toDateString()) : videos;
  return <>
    {error && <p className="capture-error" role="alert">{error}</p>}
    <p>{user.display_name}さんの旅の記録</p>
    {loadingTrips && <p role="status">旅行を読み込んでいます…</p>}
    {tripLoadFailed && <button type="button" onClick={() => { setError(''); setTripReloadKey(key => key + 1); }}>旅行一覧を再読み込み</button>}
      <div className="trip-controls">
        <label>記録する旅行<select value={tripId} disabled={locked} onChange={e => { setError(''); setLocation(null); setLocationNotice(''); setPlace(''); setTripId(e.target.value); }}><option value="" disabled>旅行を作成してください</option>{trips.map(trip => <option key={trip.id} value={String(trip.id)}>{trip.title}</option>)}</select></label>
        <form onSubmit={addTrip}><label>新しい旅行名<input name="title" maxLength={100} required disabled={locked} placeholder="例：京都旅行" /></label><button disabled={locked}>旅行を作成</button></form>
      </div>
      {tripId && <>
        <h2>{trips.find(trip => String(trip.id) === tripId)?.title}の動画（{videos.length}/20本）</h2>
        <label className="trip-day-filter"><input type="checkbox" checked={onlyToday} onChange={e => setOnlyToday(e.target.checked)} />今日の動画だけ表示</label>
        {loadFailed && <button type="button" onClick={() => { setError(''); setReloadKey(key => key + 1); }}>動画一覧を再読み込み</button>}
        {loadingVideos ? <p role="status">動画一覧を読み込んでいます…</p> : loadFailed ? <p>動画一覧を取得できませんでした。再読み込みしてください。</p> : visibleVideos.length ? <div className="trip-video-list">{visibleVideos.map(item => <SavedVideo key={`${tripId}-${item.id}`} item={item} />)}</div> : <p>{onlyToday ? '今日の動画はまだありません。過去の動画はチェックを外すと見られます。' : 'まだ動画はありません。最初の思い出を撮影しましょう。'}</p>}
        <p role="status">{notice}</p>
        <label className="trip-place">撮影場所（任意）<input value={place} onChange={e => setPlace(e.target.value)} maxLength={100} disabled={busy || pending || locating} placeholder="例：清水寺" /></label>
        <div className="capture-location">
          <button type="button" disabled={locked} onClick={locate}>{locating ? '現在地を取得中…' : '現在地をこの場所に付ける'}</button>
          {location && <button type="button" disabled={locked} onClick={() => { setLocation(null); setLocationNotice('位置情報を外しました。'); }}>位置情報を外す</button>}
          <p role="status">{locationNotice}</p>
          <p>位置情報は任意です。同じ旅行・同じ場所名は、最初に保存した位置を使います。撮影後にも現在地を取得して近くのスポット候補を探します。検索のため現在地を地図サービスに送ります。</p>
        </div>
        {videos.length < 20 && !loadingVideos && !loadFailed ? <>
          <div inert={pending || locating ? true : undefined}><CameraCapture key={`${tripId}-${cameraKey}`} onCapture={setDraft} onBusy={setBusy} /></div>
          {draft && <>
            <SpotPicker location={location} selected={spot} onSelect={value => { setSpot(value); setPublish(false); }} disabled={pending} />
            {spot && <div className="spot-consent"><label><input type="checkbox" checked={publish} disabled={pending} onChange={e => setPublish(e.target.checked)} />「{spot.name}」の動画として世界に公開することを許可する</label><p>オンにすると、ログインしていない人もこの動画を再生・保存できます。オフなら自分だけが見られます。後から公開を取り消せますが、他の人が保存したコピーは回収できません。</p></div>}
            {!spot && <p>スポットには紐付けず、自分だけの動画として保存します。</p>}
          </>}
          {draft && <div className="capture-actions"><button onClick={save} disabled={pending || busy || locating}>{pending ? '保存中…' : publish && spot ? '公開を許可して保存' : '非公開で保存'}</button><button disabled={pending || busy} onClick={() => { setDraft(null); setCameraKey(key => key + 1); setBusy(false); }}>破棄する</button></div>}
        </> : videos.length >= 20 && <p>この旅行の保存上限（20本）に達しました。</p>}
      </>}
      <p className="status-note">1本2MB・1旅行20本まで。保存済み動画は再ログイン後も見られます。公開を許可した動画だけ、スポットから誰でも再生できます。</p>
  </>;
}

export default function CreatePage() {
  const { user } = useAuth();
  return <PageShell title="旅を記録する" description="3秒の思い出を、旅行ごとに残そう。">
    {!isApiConfigured ? <p role="status">サーバーへの接続設定が必要です。チームのセットアップ手順を確認してください。</p>
      : user ? <CreateContent key={user.id} /> : <LoginPanel />}
  </PageShell>;
}
