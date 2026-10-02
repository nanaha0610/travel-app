import PageShell from '../components/PageShell.jsx';

export default function ProfilePage() {
  return (
    <PageShell title="マイページ" description="あなたの旅を、ひとつずつ。">
      <div className="profile-summary">
        <span className="avatar" aria-hidden="true">○</span>
        <div><h2>あなたのプロフィール</h2><p>ログイン機能は準備中です。</p></div>
      </div>
      <div className="empty-panel">
        <h2>旅の記録がここに並びます</h2>
        <p>自分が投稿した旅行動画を見返せる場所です。</p>
      </div>
    </PageShell>
  );
}
