import PageShell from '../components/PageShell.jsx';

export default function MapPage() {
  return (
    <PageShell title="旅の地図" description="目的地までの道中に、新しい発見を。">
      <div className="empty-panel">
        <span className="empty-icon" aria-hidden="true">◇</span>
        <h2>地図は準備中です</h2>
        <p>徒歩・車でめぐる旅の地図を、ここに追加します。</p>
      </div>
      <p className="status-note">地図の表示・経路検索機能はまだありません。</p>
    </PageShell>
  );
}
