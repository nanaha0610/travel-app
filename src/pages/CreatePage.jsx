import PageShell from '../components/PageShell.jsx';

export default function CreatePage() {
  return (
    <PageShell title="旅を記録する" description="数秒の動画で、旅の思い出を残そう。">
      <div className="empty-panel camera-placeholder">
        <span className="empty-icon" aria-hidden="true">＋</span>
        <h2>カメラは準備中です</h2>
        <p>ここに撮影画面を追加していきます。</p>
      </div>
      <p className="status-note">今はカメラやマイクへのアクセスは行いません。</p>
    </PageShell>
  );
}
