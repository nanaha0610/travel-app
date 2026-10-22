import { useEffect, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import LoginPanel from '../components/LoginPanel.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { isApiConfigured } from '../api/client.js';
import FeedPlayer from './feed/FeedPlayer.jsx';
import './FeedPage.css';

function TripPlayback({ trip, onBack }) {
  const { authRequest } = useAuth();
  const [videos, setVideos] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setVideos([]); setIndex(0); setFinished(false);
    authRequest(`/api/trips/${trip.id}/videos`).then(data => { if (active) setVideos(data.videos); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [trip.id, authRequest, retry]);
  function select(next) { setIndex(next); setFinished(false); }
  const item = videos[index];
  return <section aria-label={`${trip.title}の動画`}>
    <div className="feed-toolbar"><button onClick={onBack}>← 旅行一覧へ</button><span>{videos.length}本の思い出</span></div>
    <h2>{trip.title}</h2>
    {loading ? <p role="status">旅行の動画を読み込んでいます…</p> : error ? <div className="feed-feedback"><p role="alert">{error}</p><button onClick={() => setRetry(n => n + 1)}>再読み込み</button></div> : !item ? <div className="trip-feed-empty"><p>この旅行にはまだ動画がありません。</p><a href="#create">撮影画面で旅行を選んで記録する →</a></div> : <>
      <p className="feed-hint">撮影した順に連続再生します。最初は消音です。プレイヤーで音声を切り替えられます。</p>
      <div className="trip-playback">
        <FeedPlayer key={item.id} item={{ ...item, trip_title: trip.title }} onEnded={() => { if (index < videos.length - 1) select(index + 1); else setFinished(true); }} />
        <div className="feed-caption"><h3>{item.place_name}</h3><p>{index + 1} / {videos.length}本</p><time>{new Date(item.captured_at).toLocaleString('ja-JP')}</time>{item.latitude != null && item.longitude != null && <p>位置情報付き</p>}</div>
      </div>
      <div className="feed-navigation"><button disabled={index === 0} onClick={() => select(index - 1)}>前の動画</button><button disabled={index === videos.length - 1} onClick={() => select(index + 1)}>次の動画</button></div>
      {finished && <p role="status">旅の最後まで再生しました。</p>}
      <ol className="trip-clip-list">{videos.map((video, n) => <li key={video.id}><button aria-current={n === index ? 'true' : undefined} onClick={() => select(n)}><span>{String(n + 1).padStart(2, '0')}</span><strong>{video.place_name}</strong><time>{new Date(video.captured_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</time></button></li>)}</ol>
    </>}
  </section>;
}

function FeedContent() {
  const { authRequest } = useAuth();
  const [trips, setTrips] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    authRequest('/api/trips').then(data => { if (active) setTrips(data.trips); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [authRequest, retry]);
  if (selected) return <TripPlayback key={selected.id} trip={selected} onBack={() => setSelected(null)} />;
  return <>
    <div className="feed-toolbar"><p>あなたの旅行 · {trips.length}件</p><button disabled={loading} onClick={() => setRetry(n => n + 1)}>一覧を更新</button></div>
    {loading ? <p role="status">旅行を読み込んでいます…</p> : error ? <p role="alert">{error}</p> : trips.length ? <div className="trip-feed-grid">{trips.map((trip, n) => <button className="trip-feed-card" key={trip.id} onClick={() => setSelected(trip)}><span className="trip-feed-number">TRIP {String(n + 1).padStart(2, '0')}</span><h2>{trip.title}</h2><time>{new Date(trip.created_at).toLocaleDateString('ja-JP')}</time><span className="trip-feed-open">旅の動画を見る →</span></button>)}</div> : <div className="trip-feed-empty"><h2>最初の旅を残そう</h2><p>撮影画面で旅行を作ると、ここにまとまります。</p><a href="#create">旅を記録する →</a></div>}
    <p className="feed-private-note">自分の旅行のみ表示します。新しい旅行から最大100件。動画は旅行内で撮影順に再生されます。</p>
  </>;
}

export default function FeedPage() {
  const { user } = useAuth();
  return <PageShell title="旅の思い出" description="小さな動画をつないで、ひとつの旅を振り返ろう。">
    {!isApiConfigured ? <p>サーバーへの接続設定が必要です。</p> : user ? <FeedContent key={user.id} /> : <LoginPanel />}
  </PageShell>;
}
