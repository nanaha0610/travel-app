import PageShell from '../components/PageShell.jsx';

export default function FeedPage() {
  return (
    <PageShell title="旅の動画" description="みんなの旅の瞬間に出会おう。">
      <div className="video-placeholder">
        <span className="empty-icon" aria-hidden="true">▷</span>
        <h2>まだ動画はありません</h2>
        <p>投稿された旅行動画がここに並びます。</p>
      </div>
      <p className="status-note">動画の再生・投稿機能は準備中です。</p>
    </PageShell>
  );
}
