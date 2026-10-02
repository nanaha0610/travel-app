import { useCallback, useEffect, useState } from 'react';
import PageShell from '../components/PageShell.jsx';
import LoginPanel from '../components/LoginPanel.jsx';
import { useAuth } from '../auth/AuthProvider.jsx';
import { isApiConfigured } from '../api/client.js';
import './ProfilePage.css';

const statusLabels = { draft: '下書き', published: '公開中' };

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' });
}

function ApiNotConfigured() {
  return (
    <div className="mypage-panel">
      <h2>サーバーの接続先が未設定です</h2>
      <p>
        プロジェクト直下に <code>.env.local</code> を作り、<code>VITE_API_BASE_URL</code> に
        server の URL を書いてから、<code>npm run dev</code> を起動し直してください。
      </p>
    </div>
  );
}

function NewTripForm({ onCreated }) {
  const { authRequest } = useAuth();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await authRequest('/api/trips', { method: 'POST', body: { title } });
      setTitle('');
      onCreated();
    } catch (submitError) {
      if (submitError.status !== 401) setError(submitError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="mypage-new-trip" onSubmit={handleSubmit}>
      <label htmlFor="mypage-new-trip-title">新しい旅行を作る</label>
      <div>
        <input
          id="mypage-new-trip-title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例：鎌倉・江ノ島さんぽ"
          maxLength={100}
          required
        />
        <button type="submit" className="mypage-button mypage-button-primary" disabled={isSubmitting}>
          {isSubmitting ? '作成中…' : '作成'}
        </button>
      </div>
      {error && <p className="mypage-error" role="alert">{error}</p>}
    </form>
  );
}

function TripItem({ trip }) {
  return (
    <article className="mypage-trip">
      <header className="mypage-trip-header">
        <h3>{trip.title}</h3>
        <p>
          <time dateTime={trip.created_at}>{formatDate(trip.created_at)}</time>
          <span className={`mypage-status mypage-status-${trip.status}`}>
            {statusLabels[trip.status] ?? trip.status}
          </span>
        </p>
      </header>
      <p className="mypage-trip-empty">動画はまだありません（動画の保存は準備中です）</p>
    </article>
  );
}

function ProfileContent() {
  const { user, logout, authRequest } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loadState, setLoadState] = useState('loading'); // 'loading' | 'ready' | 'error'
  const [loadError, setLoadError] = useState('');
  const [notice, setNotice] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadTrips = useCallback(async () => {
    setLoadState('loading');
    setLoadError('');
    try {
      const data = await authRequest('/api/trips');
      setTrips(data.trips ?? []);
      setLoadState('ready');
    } catch (error) {
      // 401 のときは AuthProvider がログイン画面に戻すので、ここでは何もしない
      if (error.status !== 401) {
        setLoadError(error.message);
        setLoadState('error');
      }
    }
  }, [authRequest]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  async function handleLogout() {
    setIsLoggingOut(true);
    await logout();
  }

  const draftCount = trips.filter((trip) => trip.status === 'draft').length;
  const publishedCount = trips.filter((trip) => trip.status === 'published').length;

  return (
    <>
      <section className="mypage-profile" aria-label="プロフィール">
        <span className="mypage-avatar" aria-hidden="true">{user.display_name.slice(0, 1)}</span>
        <div className="mypage-profile-text">
          <h2>{user.display_name}</h2>
          <p>{user.email}</p>
        </div>
      </section>

      <dl className="mypage-stats">
        <div><dt>旅行</dt><dd>{loadState === 'ready' ? trips.length : '–'}</dd></div>
        <div><dt>下書き</dt><dd>{loadState === 'ready' ? draftCount : '–'}</dd></div>
        <div><dt>公開中</dt><dd>{loadState === 'ready' ? publishedCount : '–'}</dd></div>
      </dl>

      <div className="mypage-actions">
        <button type="button" className="mypage-button" onClick={() => setNotice('設定画面は準備中です。')}>
          設定
        </button>
        <button type="button" className="mypage-button" onClick={handleLogout} disabled={isLoggingOut}>
          {isLoggingOut ? 'ログアウト中…' : 'ログアウト'}
        </button>
      </div>
      <p className="mypage-notice" role="status">{notice}</p>

      <section className="mypage-trips" aria-labelledby="mypage-trips-title">
        <h2 id="mypage-trips-title">旅の記録</h2>
        <NewTripForm onCreated={loadTrips} />

        {loadState === 'loading' && <p className="mypage-loading" role="status">読み込み中…</p>}

        {loadState === 'error' && (
          <div className="mypage-panel">
            <p className="mypage-error" role="alert">{loadError}</p>
            <button type="button" className="mypage-button" onClick={loadTrips}>もう一度読み込む</button>
          </div>
        )}

        {loadState === 'ready' && trips.length === 0 && (
          <div className="mypage-panel">
            <h3>まだ旅行がありません</h3>
            <p>上のフォームから、最初の旅行を作ってみよう。</p>
          </div>
        )}

        {loadState === 'ready' && trips.map((trip) => <TripItem key={trip.id} trip={trip} />)}
      </section>
    </>
  );
}

export default function ProfilePage() {
  const { isLoggedIn } = useAuth();

  return (
    <PageShell title="マイページ" description="あなたの旅を、ひとつずつ。">
      {!isApiConfigured ? <ApiNotConfigured /> : isLoggedIn ? <ProfileContent /> : <LoginPanel />}
    </PageShell>
  );
}
