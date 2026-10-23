import { useEffect, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import { dayRoute } from './feed/dayRoute.js';
import { apiRequest, isApiConfigured } from '../api/client.js';
import FeedPlayer from './feed/FeedPlayer.jsx';
import './FeedPage.css';

function TripPlayback({ trip, onBack }) {
  const [videos, setVideos] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [finished, setFinished] = useState(false);
  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setVideos([]); setIndex(0); setFinished(false);
    apiRequest(`/api/public/trips/${trip.id}/videos`).then(data => { if (active) setVideos(data.videos); })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [trip.id, retry]);
  function select(next) { setIndex(next); setFinished(false); }
  const item = videos[index];
  const route = item ? dayRoute(videos, item) : null;
  return <section aria-label={`${trip.title}の動画`}>
    <div className="feed-toolbar"><button onClick={onBack}>← 旅行一覧へ</button><span>{videos.length}本の思い出</span></div>
    <h2>{trip.title}</h2>
    {loading ? <p role="status">旅行の動画を読み込んでいます…</p> : error ? <div className="feed-feedback"><p role="alert">{error}</p><button onClick={() => setRetry(n => n + 1)}>再読み込み</button></div> : !item ? <div className="trip-feed-empty"><p>この旅行にはまだ動画がありません。</p><a href="#create">撮影画面で旅行を選んで記録する →</a></div> : <>
      <p className="feed-hint">撮影した順に連続再生します。最初は消音です。プレイヤーで音声を切り替えられます。</p>
      <div className="trip-playback">
        <FeedPlayer key={item.id} publicTripId={trip.id} item={{ ...item, trip_title: trip.title }} onEnded={() => { if (index < videos.length - 1) select(index + 1); else setFinished(true); }} />
        <div className="feed-caption"><h3>{item.place_name}</h3><p>{index + 1} / {videos.length}本</p><time>{new Date(item.captured_at).toLocaleString('ja-JP')}</time>{item.latitude != null && item.longitude != null && <p>位置情報付き</p>}</div>
      </div>
      <p className="trip-day-route" aria-label="その日の訪問順"><strong>{route.day} の訪問順（日本時間）</strong><br />{route.places.join(" → ")}</p>
      <div className="feed-navigation"><button disabled={index === 0} onClick={() => select(index - 1)}>前の動画</button><button disabled={index === videos.length - 1} onClick={() => select(index + 1)}>次の動画</button></div>
      {finished && <p role="status">旅の最後まで再生しました。</p>}
      <ol className="trip-clip-list">{videos.map((video, n) => <li key={video.id}><button aria-current={n === index ? 'true' : undefined} onClick={() => select(n)}><span>{String(n + 1).padStart(2, '0')}</span><strong>{video.place_name}</strong><time>{new Date(video.captured_at).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}</time></button></li>)}</ol>
    </>}
  </section>;
}

function FeedContent() {
  const [trips, setTrips] = useState([]);
  const [cursor, setCursor] = useState(null);
  const [moreLoading,setMoreLoading]=useState(false);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    apiRequest('/api/public/trips').then(data => { if (active) {setTrips(data.trips);setCursor(data.nextCursor);} })
      .catch(e => { if (active) setError(e.message); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [retry]);
  async function more(){
    if(moreLoading||!cursor)return;setMoreLoading(true);setError('');
    try{const data=await apiRequest(`/api/public/trips?before=${cursor}`);setTrips(current=>[...current,...data.trips.filter(t=>!current.some(c=>String(c.id)===String(t.id)))]);setCursor(data.nextCursor);}catch(e){setError(e.message)}finally{setMoreLoading(false)}
  }
  if (selected) return <TripPlayback key={selected.id} trip={selected} onBack={() => setSelected(null)} />;
  return <>
    <div className="feed-toolbar"><p>公開されている旅行 · {trips.length}件</p><button disabled={loading || moreLoading} onClick={() => setRetry(n => n + 1)}>一覧を更新</button></div>
    {loading ? <p role="status">旅行を読み込んでいます…</p> : error ? <p role="alert">{error}</p> : trips.length ? <div className="trip-feed-grid">{trips.map((trip, n) => <button className="trip-feed-card" key={trip.id} onClick={() => setSelected(trip)}><span className="trip-feed-number">TRIP {String(n + 1).padStart(2, '0')}</span><h2>{trip.title}</h2><span>{trip.video_count}本の動画</span><span className="trip-feed-open">旅の動画を見る →</span></button>)}</div> : <div className="trip-feed-empty"><h2>最初の旅を残そう</h2><p>撮影画面で保存した旅行を、許可して公開するとここに表示されます。</p><a href="#create">旅を記録する →</a></div>}
    {cursor && <button disabled={loading || moreLoading} onClick={more}>{moreLoading ? "読み込み中…" : "もっと見る"}</button>}
    <p className="feed-private-note">公開を許可された旅行だけ表示します。自分だけの旅行はマイページから見られます。訪問順は保存された動画の場所と撮影日時をもとに表示します。</p>
  </>;
}

export default function FeedPage() {
  return <PageShell title="旅の思い出" description="みんなの旅行を、短い動画と訪問順で見てみよう。">
    {!isApiConfigured ? <p>サーバーへの接続設定が必要です。</p> : <FeedContent />}
  </PageShell>;
}
