import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthProvider.jsx';

// Mounted only for the selected clip. Leaving a clip releases its media URL.
export default function FeedPlayer({ item, onEnded }) {
  const { authRequest } = useAuth();
  const player = useRef(null);
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [needsPlay, setNeedsPlay] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    let objectUrl = '';
    setUrl(''); setError(''); setNeedsPlay(false);
    authRequest(`/api/videos/${item.id}/content`, { responseType: 'blob' }).then(blob => {
      if (!active) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [item.id, authRequest, retry]);

  useEffect(() => {
    const video = player.current;
    if (!url || !video) return;
    let active = true;
    const play = () => {
      if (document.hidden) return;
      video.play()?.catch(() => { if (active) setNeedsPlay(true); });
    };
    const onVisibility = () => { if (document.hidden) video.pause(); else setNeedsPlay(true); };
    play();
    document.addEventListener('visibilitychange', onVisibility);
    return () => { active = false; video.pause(); document.removeEventListener('visibilitychange', onVisibility); };
  }, [url]);

  async function resume() {
    try { await player.current?.play(); setNeedsPlay(false); }
    catch { setError('再生できませんでした。別のブラウザーでも確認してください。'); }
  }

  return <div className="feed-player">
    {!url && !error && <p role="status">動画を読み込んでいます…</p>}
    {url && <video ref={player} src={url} controls loop={!onEnded} onEnded={onEnded} muted playsInline preload="auto"
      aria-label={`${item.trip_title}・${item.place_name}の動画`}
      onError={() => setError('この動画を再生できません。撮影時と同じブラウザーでも確認してください。')} />}
    {needsPlay && !error && <button type="button" className="feed-resume" onClick={resume}>▶ 再生する</button>}
    {error && <div className="feed-player-error"><p role="alert">{error}</p>
      <button type="button" onClick={() => setRetry(value => value + 1)}>動画を再読み込み</button></div>}
  </div>;
}
