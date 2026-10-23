import { useEffect, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import SavedVideo from './SavedVideo.jsx';
import './TripVideos.css';

export default function TripVideos({ tripId, tripTitle }) {
  const { authRequest } = useAuth();
  const [result, setResult] = useState({ loading: true, videos: [], error: '' });
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setResult({ loading: true, videos: [], error: '' });
    authRequest(`/api/trips/${tripId}/videos`)
      .then(data => { if (active) setResult({ loading: false, videos: data.videos, error: '' }); })
      .catch(error => { if (active) setResult({ loading: false, videos: [], error: error.message }); });
    return () => { active = false; };
  }, [tripId, authRequest, retry]);

  if (result.loading) return <p role="status">動画一覧を読み込んでいます…</p>;
  if (result.error) return <div className="trip-videos-feedback">
    <p role="alert">{result.error}</p>
    <button type="button" className="mypage-button" onClick={() => setRetry(value => value + 1)}>もう一度読み込む</button>
  </div>;
  if (!result.videos.length) return <p className="mypage-trip-empty">この旅行にはまだ動画がありません。「撮影」画面でこの旅行を選んで記録できます。</p>;

  // Preserve chronological order within each place. Fetch media only on Play.
  const groups = new Map();
  for (const video of result.videos) {
    const name = video.place_name || '場所未設定';
    if (!groups.has(name)) groups.set(name, []);
    groups.get(name).push(video);
  }
  return <section className="trip-videos" aria-label={`${tripTitle}の保存動画`}>
    <p>保存動画 {result.videos.length}本 · 場所ごとに表示（公開範囲は旅行・スポットの設定に従います）</p>
    {[...groups].map(([name, videos]) => <section key={name} className="trip-videos-place" aria-label={name}>
      <h4>{name}（{videos.length}本）</h4>
      <div className="trip-videos-grid">{videos.map(video => <SavedVideo key={video.id} item={video} />)}</div>
    </section>)}
  </section>;
}
