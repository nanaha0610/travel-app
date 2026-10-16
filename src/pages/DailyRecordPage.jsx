import { useEffect, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import LoginPanel from '../components/LoginPanel.jsx';
import SavedVideo from '../components/SavedVideo.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { isApiConfigured } from '../api/client.js';
import { groupVideosByDay } from './dailyRecords.js';
import './DailyRecordPage.css';

function DailyRecordContent({ initialTripId }) {
  const { authRequest } = useAuth();
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState('');
  const [tripStatus, setTripStatus] = useState('loading');
  const [tripError, setTripError] = useState('');
  const [tripRetry, setTripRetry] = useState(0);
  const [result, setResult] = useState({ tripId: '', loading: true, videos: [], error: '' });
  const [videoRetry, setVideoRetry] = useState(0);
  const [day, setDay] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    let active = true;
    setTripStatus('loading'); setTripError(''); setNotice('');
    authRequest('/api/trips').then(data => {
      if (!active) return;
      setTrips(data.trips);
      const requested = data.trips.find(trip => String(trip.id) === initialTripId);
      setTripId(String(requested?.id || data.trips[0]?.id || ''));
      if (initialTripId && !requested) setNotice('指定された旅行が見つかりません。表示できる旅行を選んでください。');
      setTripStatus('ready');
    }).catch(error => { if (active) { setTripStatus('error'); setTripError(error.message); } });
    return () => { active = false; };
  }, [authRequest, initialTripId, tripRetry]);

  useEffect(() => {
    if (!tripId) return;
    let active = true;
    setDay('');
    setResult({ tripId, loading: true, videos: [], error: '' });
    authRequest(`/api/trips/${tripId}/videos`).then(data => {
      if (!active) return;
      setResult({ tripId, loading: false, videos: data.videos, error: '' });
      const dates = [...groupVideosByDay(data.videos).keys()].sort();
      setDay(dates.at(-1) || '');
    }).catch(error => { if (active) setResult({ tripId, loading: false, videos: [], error: error.message }); });
    return () => { active = false; };
  }, [tripId, authRequest, videoRetry]);

  if (tripStatus === 'loading') return <p role="status">旅行を読み込んでいます…</p>;
  if (tripStatus === 'error') return <div><p role="alert">{tripError}</p>
    <button className="daily-button" onClick={() => setTripRetry(value => value + 1)}>旅行一覧を再読み込み</button></div>;
  if (!trips.length) return <p>まだ旅行がありません。<a href="#create">撮影画面</a>で旅行を作って記録しましょう。</p>;

  const loading = result.tripId !== tripId || result.loading;
  const days = groupVideosByDay(loading ? [] : result.videos);
  const dates = [...days.keys()].sort();
  const videos = days.get(day) || [];
  const title = trips.find(trip => String(trip.id) === tripId)?.title || '';
  return <>
    {notice && <p role="status">{notice}</p>}
    <div className="daily-controls">
      <label>旅行<select value={tripId} onChange={event => { setNotice(''); setTripId(event.target.value); }}>
        {trips.map(trip => <option key={trip.id} value={String(trip.id)}>{trip.title}</option>)}
      </select></label>
      <label>日付<input type="date" value={day} disabled={loading || !!result.error || !dates.length}
        onChange={event => setDay(event.target.value)} /></label>
    </div>
    <h2>{title}</h2>
    {loading ? <p role="status">記録を読み込んでいます…</p>
      : result.error ? <div><p role="alert">{result.error}</p><button className="daily-button" onClick={() => setVideoRetry(value => value + 1)}>記録を再読み込み</button></div>
      : !dates.length ? <p>この旅行にはまだ動画がありません。<a href="#create">撮影画面</a>でこの旅行を選んで記録できます。</p>
      : <>
        <div className="daily-dates" role="group" aria-label="記録のある日付">
          {dates.map(date => <button className="daily-button" key={date} aria-pressed={day === date} onClick={() => setDay(date)}>{date}</button>)}
        </div>
        {!day ? <p>見たい日付を選んでください。</p> : <>
          <p className="daily-summary" role="status">{day} · 動画 {videos.length}本 · 撮影した場所 {new Set(videos.map(video => video.place_name)).size}か所</p>
          {videos.length ? <ol className="daily-timeline" aria-label={`${day}の旅の記録`}>
            {videos.map((video, index) => <li key={`${tripId}-${video.id}`}>
              <div className="daily-stop"><span>{index + 1}</span><time dateTime={video.captured_at}>{new Date(video.captured_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</time></div>
              <SavedVideo item={video} />
            </li>)}
          </ol> : <p>この日の動画はありません。別の日付を選んでください。</p>}
        </>}
      </>}
    <p className="daily-note">撮影した記録を古い順に表示しています。日時はこの端末のタイムゾーンです。撮影していない場所や移動経路は表示されません。</p>
  </>;
}

export default function DailyRecordPage({ initialTripId = '' }) {
  const { user } = useAuth();
  return <PageShell title="1日の旅の記録" description="その日に訪れた場所と動画を、時間の順に振り返ろう。">
    <a className="daily-back" href="#profile">← マイページへ戻る</a>
    {!isApiConfigured ? <p role="status">サーバーへの接続設定が必要です。チームのセットアップ手順を確認してください。</p>
      : user ? <DailyRecordContent key={`${user.id}-${initialTripId}`} initialTripId={initialTripId} /> : <LoginPanel />}
  </PageShell>;
}
