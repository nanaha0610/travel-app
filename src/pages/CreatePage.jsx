import { useEffect, useRef, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import CameraCapture from './CameraCapture.jsx';
import './CreatePage.css';

import LoginPanel from '../components/LoginPanel.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { isApiConfigured } from '../api/client.js';

function SavedVideo({ item }) {
  const { authRequest } = useAuth();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const source = useRef('');
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (source.current) URL.revokeObjectURL(source.current); }; }, []);
  async function play() {
    setLoading(true); setError('');
    try {
      const blob = await authRequest(`/api/videos/${item.id}/content`, { responseType: 'blob' });
      if (!mounted.current) return;
      source.current = URL.createObjectURL(blob);
      setUrl(source.current);
    } catch (e) { if (mounted.current) setError(e.message); }
    finally { if (mounted.current) setLoading(false); }
  }
  return <article className="trip-video-card">
    <p>{new Date(item.captured_at).toLocaleString('ja-JP')}</p><strong>{item.place_name}</strong>
    {url ? <video src={url} controls autoPlay playsInline aria-label={`${item.place_name}の保存動画`} /> : <button type="button" onClick={play} disabled={loading}>{loading ? '読込中…' : '▶ 動画を再生'}</button>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
function CreateContent() {
  const { user, authRequest } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(true);
  const [tripLoadFailed, setTripLoadFailed] = useState(false);
  const [tripReloadKey, setTripReloadKey] = useState(0);
  const [tripId, setTripId] = useState('');
  const [videos, setVideos] = useState([]);
  const [place, setPlace] = useState('');
  const [draft, setDraft] = useState(null);
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
  const locked = loadingTrips || busy || pending || !!draft;
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
    if (!draft || pending) return;
    if (draft.blob.size > 2 * 1024 * 1024) { setError('2MBを超えています。撮り直してください。'); return; }
    setPending(true); setError(''); setNotice('');
    try {
      const params = new URLSearchParams({ uploadId: draft.uploadId, capturedAt: draft.capturedAt, place: place.trim() || '場所未設定' });
      await authRequest(`/api/trips/${tripId}/videos?${params}`, { method: 'POST', rawBody: draft.blob, contentType: draft.blob.type.split(';')[0] });
      // Clear only after the server has committed. Retry keeps the same upload ID.
      setDraft(null); setCameraKey(key => key + 1); setBusy(false); setNotice('この旅行に保存しました。');
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
        <label>記録する旅行<select value={tripId} disabled={locked} onChange={e => { setError(''); setTripId(e.target.value); }}><option value="" disabled>旅行を作成してください</option>{trips.map(trip => <option key={trip.id} value={String(trip.id)}>{trip.title}</option>)}</select></label>
        <form onSubmit={addTrip}><label>新しい旅行名<input name="title" maxLength={100} required disabled={locked} placeholder="例：京都旅行" /></label><button disabled={locked}>旅行を作成</button></form>
      </div>
      {tripId && <>
        <h2>{trips.find(trip => String(trip.id) === tripId)?.title}の動画（{videos.length}/20本）</h2>
        <label className="trip-day-filter"><input type="checkbox" checked={onlyToday} onChange={e => setOnlyToday(e.target.checked)} />今日の動画だけ表示</label>
        {loadFailed && <button type="button" onClick={() => { setError(''); setReloadKey(key => key + 1); }}>動画一覧を再読み込み</button>}
        {loadingVideos ? <p role="status">動画一覧を読み込んでいます…</p> : loadFailed ? <p>動画一覧を取得できませんでした。再読み込みしてください。</p> : visibleVideos.length ? <div className="trip-video-list">{visibleVideos.map(item => <SavedVideo key={`${tripId}-${item.id}`} item={item} />)}</div> : <p>{onlyToday ? '今日の動画はまだありません。過去の動画はチェックを外すと見られます。' : 'まだ動画はありません。最初の思い出を撮影しましょう。'}</p>}
        <p role="status">{notice}</p>
        <label className="trip-place">撮影場所（任意）<input value={place} onChange={e => setPlace(e.target.value)} maxLength={100} disabled={locked} placeholder="例：清水寺" /></label>
        {videos.length < 20 && !loadingVideos && !loadFailed ? <>
          <div inert={pending ? true : undefined}><CameraCapture key={`${tripId}-${cameraKey}`} onCapture={setDraft} onBusy={setBusy} /></div>
          {draft && <div className="capture-actions"><button onClick={save} disabled={pending || busy}>{pending ? '保存中…' : 'この旅行に保存'}</button><button disabled={pending || busy} onClick={() => { setDraft(null); setCameraKey(key => key + 1); setBusy(false); }}>破棄する</button></div>}
        </> : videos.length >= 20 && <p>この旅行の保存上限（20本）に達しました。</p>}
      </>}
      <p className="status-note">1本2MB・1旅行20本まで。保存済み動画は再ログイン後も見られます。現在は本人のみ再生できます。</p>
  </>;
}

export default function CreatePage() {
  const { user } = useAuth();
  return <PageShell title="旅を記録する" description="3秒の思い出を、旅行ごとに残そう。">
    {!isApiConfigured ? <p role="status">サーバーへの接続設定が必要です。チームのセットアップ手順を確認してください。</p>
      : user ? <CreateContent key={user.id} /> : <LoginPanel />}
  </PageShell>;
}
