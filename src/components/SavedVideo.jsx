import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../auth/AuthProvider.jsx';
import './SavedVideo.css';
import '../pages/map/SpotPicker.css';

export default function SavedVideo({ item }) {
  const { authRequest } = useAuth();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isPublic, setIsPublic] = useState(Number(item.is_public) === 1);
  const [consent, setConsent] = useState(false);
  const [changing, setChanging] = useState(false);
  useEffect(() => { setIsPublic(Number(item.is_public) === 1); setConsent(false); }, [item.id, item.is_public]);
  async function changeVisibility() {
    if (changing || (!isPublic && !consent)) return;
    setChanging(true); setError('');
    try {
      const data = await authRequest(`/api/videos/${item.id}/visibility`, {method:'POST', body:{isPublic:!isPublic}});
      setIsPublic(data.isPublic); setConsent(false);
    } catch(e) { setError(e.message); } finally { setChanging(false); }
  }
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
    <p className="status-note">旅行全体の公開設定は上の旅行設定で確認できます。</p>
    {url
      ? <video src={url} controls autoPlay playsInline aria-label={`${item.place_name}の保存動画`}
          onError={() => setError('この動画を再生できません。別のブラウザーでも確認してください。')} />
      : <button type="button" onClick={play} disabled={loading}>{loading ? '読込中…' : '▶ 動画を再生'}</button>}
    {item.spot_id && <div className="spot-visibility"><p>スポット：{item.spot_name} · {isPublic ? 'スポット公開中' : 'スポット公開なし'}</p>
      {!isPublic && <label><input type="checkbox" checked={consent} disabled={changing} onChange={e=>setConsent(e.target.checked)} />このスポットで誰でも再生・保存できる状態にすることを許可する</label>}
      <button type="button" disabled={changing || (!isPublic && !consent)} onClick={changeVisibility}>{changing ? '変更中…' : isPublic ? '公開を取り消す' : '許可して公開する'}</button></div>}
    {error && <p role="alert">{error}</p>}
  </article>;
}
