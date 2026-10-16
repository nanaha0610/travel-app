import { useEffect, useRef, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import LoginPanel from '../components/LoginPanel.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { isApiConfigured } from '../api/client.js';
import FeedPlayer from './feed/FeedPlayer.jsx';
import './FeedPage.css';

function FeedContent() {
  const { authRequest } = useAuth();
  const [videos, setVideos] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [cursor, setCursor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [moreError, setMoreError] = useState('');
  const [reload, setReload] = useState(0);
  const viewport = useRef(null);
  const generation = useRef(0);
  const morePending = useRef(false);

  useEffect(() => {
    const version = ++generation.current;
    morePending.current = false;
    setLoading(true); setLoadingMore(false); setError(''); setMoreError('');
    setVideos([]); setActiveId(''); setCursor(null);
    authRequest('/api/videos').then(data => {
      if (version !== generation.current) return;
      setVideos(data.videos); setCursor(data.nextCursor);
      setActiveId(String(data.videos[0]?.id || ''));
    }).catch(e => { if (version === generation.current) setError(e.message); })
      .finally(() => { if (version === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [authRequest, reload]);

  useEffect(() => {
    const root = viewport.current;
    if (!root || !window.IntersectionObserver) return;
    const observer = new IntersectionObserver(entries => {
      const visible = entries.filter(entry => entry.isIntersecting && entry.intersectionRatio >= 0.6)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActiveId(visible.target.dataset.videoId);
    }, { root, threshold: [0.6, 0.8] });
    root.querySelectorAll('[data-video-id]').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [videos, loading]);

  async function loadMore() {
    if (!cursor || morePending.current) return;
    morePending.current = true; setLoadingMore(true); setMoreError('');
    const version = generation.current;
    try {
      const data = await authRequest(`/api/videos?before=${encodeURIComponent(cursor)}`);
      if (version !== generation.current) return;
      setVideos(current => {
        const ids = new Set(current.map(item => String(item.id)));
        return [...current, ...data.videos.filter(item => !ids.has(String(item.id)))];
      });
      setCursor(data.nextCursor);
    } catch (e) { if (version === generation.current) setMoreError(e.message); }
    finally { if (version === generation.current) { morePending.current = false; setLoadingMore(false); } }
  }

  const activeIndex = videos.findIndex(item => String(item.id) === activeId);
  function select(index) {
    const item = videos[index];
    if (!item) return;
    setActiveId(String(item.id));
    const element = [...(viewport.current?.querySelectorAll('[data-video-id]') || [])]
      .find(node => node.dataset.videoId === String(item.id));
    element?.scrollIntoView({ behavior: 'instant', block: 'nearest' });
  }

  if (loading) return <p role="status">動画一覧を読み込んでいます…</p>;
  if (error) return <div className="feed-feedback"><p role="alert">{error}</p>
    <button onClick={() => setReload(value => value + 1)}>一覧を再読み込み</button></div>;
  if (!videos.length) return <div className="video-placeholder">
    <span className="empty-icon" aria-hidden="true">▷</span><h2>まだ保存動画がありません</h2>
    <p>撮影画面で旅行を選び、動画を保存するとここに表示されます。</p><a href="#create">撮影しにいく</a>
    <button className="feed-empty-refresh" onClick={() => setReload(value => value + 1)}>一覧を更新</button>
  </div>;

  return <>
    <div className="feed-toolbar">
      <p role="status">{activeIndex + 1} / {videos.length}本{cursor ? '（続きあり）' : ''}</p>
      <button onClick={() => setReload(value => value + 1)}>一覧を更新</button>
    </div>
    <p className="feed-hint">上下にスクロールして切り替え。最初は消音で再生します。</p>
    <div className="feed-viewport" ref={viewport} tabIndex={0} role="region" aria-label="保存動画の一覧"
      onKeyDown={event => {
        if (event.target !== event.currentTarget) return;
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
          event.preventDefault(); select(activeIndex + (event.key === 'ArrowDown' ? 1 : -1));
        }
      }}>
      {videos.map((item, index) => <article className="feed-item" data-video-id={String(item.id)} key={item.id} aria-label={`${item.trip_title}・${item.place_name}`}>
        {String(item.id) === activeId ? <FeedPlayer key={item.id} item={item} />
          : <div className="feed-player feed-waiting"><button onClick={() => select(index)}>▶ この動画を見る</button></div>}
        <div className="feed-caption"><h2>{item.trip_title}</h2><p>{item.place_name}</p>
          <time dateTime={item.captured_at}>{new Date(item.captured_at).toLocaleString('ja-JP')}</time></div>
      </article>)}
    </div>
    <div className="feed-navigation" aria-label="動画の切り替え">
      <button disabled={activeIndex <= 0} onClick={() => select(activeIndex - 1)}>↑ 前の動画</button>
      <button disabled={activeIndex >= videos.length - 1} onClick={() => select(activeIndex + 1)}>次の動画 ↓</button>
    </div>
    {moreError && <p role="alert">{moreError}</p>}
    {cursor && <button className="feed-more" disabled={loadingMore} onClick={loadMore}>{loadingMore ? '読み込み中…' : moreError ? '続きを再読み込み' : 'さらに動画を読み込む'}</button>}
  </>;
}

export default function FeedPage() {
  const { user } = useAuth();
  return <PageShell title="旅の動画" description="保存した旅の瞬間を、ひとつずつ振り返ろう。">
    <p className="feed-private-note">現在は自分の保存動画だけを表示します。</p>
    {!isApiConfigured ? <p role="status">サーバーへの接続設定が必要です。チームのセットアップ手順を確認してください。</p>
      : user ? <FeedContent key={user.id} /> : <LoginPanel />}
  </PageShell>;
}
