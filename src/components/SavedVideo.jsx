import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import './SavedVideo.css';

export default function SavedVideo({ item }) {
  const { authRequest } = useAuth();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const source = useRef('');
  const request = useRef(0);
  const pending = useRef(false);

  useEffect(() => {
    setUrl(''); setError(''); setLoading(false); pending.current = false;
    return () => {
      request.current++;
      if (source.current) URL.revokeObjectURL(source.current);
      source.current = '';
    };
  }, [item.id, authRequest]);

  async function play() {
    if (pending.current) return;
    pending.current = true;
    const version = ++request.current;
    setLoading(true); setError('');
    try {
      const blob = await authRequest(`/api/videos/${item.id}/content`, { responseType: 'blob' });
      if (version !== request.current) return;
      if (source.current) URL.revokeObjectURL(source.current);
      source.current = URL.createObjectURL(blob);
      setUrl(source.current);
    } catch (e) {
      if (version === request.current) setError(e.message);
    } finally {
      if (version === request.current) { pending.current = false; setLoading(false); }
    }
  }

  return <article className="trip-video-card">
    <time dateTime={item.captured_at}>{new Date(item.captured_at).toLocaleString('ja-JP')}</time>
    <strong>{item.place_name}</strong>
    {url
      ? <video src={url} controls autoPlay playsInline aria-label={`${item.place_name}の保存動画`}
          onError={() => setError('この動画を再生できません。別のブラウザーでも確認してください。')} />
      : <button type="button" onClick={play} disabled={loading}>{loading ? '読込中…' : '▶ 動画を再生'}</button>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
