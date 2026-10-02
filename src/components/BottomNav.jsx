export const tabs = [
  { id: 'feed', label: '動画一覧', icon: '▷' },
  { id: 'create', label: '撮影', icon: '＋' },
  { id: 'map', label: '地図', icon: '◇' },
  { id: 'profile', label: 'マイページ', icon: '○' },
];

export default function BottomNav({ current }) {
  return (
    <nav className="bottom-nav" aria-label="メインメニュー">
      {tabs.map((tab) => (
        <a key={tab.id} href={`#${tab.id}`} aria-current={current === tab.id ? 'page' : undefined}>
          <span className="nav-icon" aria-hidden="true">{tab.icon}</span>
          <span>{tab.label}</span>
        </a>
      ))}
    </nav>
  );
}
