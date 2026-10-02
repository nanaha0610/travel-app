import { useEffect, useRef, useState } from 'react';
import { AuthProvider } from './auth/AuthProvider.jsx';
import BottomNav, { tabs } from './components/BottomNav.jsx';
import FeedPage from './pages/FeedPage.jsx';
import CreatePage from './pages/CreatePage.jsx';
import MapPage from './pages/MapPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';

const pages = { feed: FeedPage, create: CreatePage, map: MapPage, profile: ProfilePage };
function readPage() {
  const id = window.location.hash.slice(1);
  return Object.hasOwn(pages, id) ? id : 'feed';
}

export default function App() {
  const [current, setCurrent] = useState(readPage);
  const mainRef = useRef(null);

  useEffect(() => {
    const navigate = () => setCurrent(readPage());
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  useEffect(() => {
    document.title = `${tabs.find((tab) => tab.id === current).label} | Travel App`;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [current]);

  const Page = pages[current];
  return (
    <AuthProvider>
      <div className="app-shell">
        <header className="app-header"><a href="#feed">Travel App</a><span>旅のはじまり</span></header>
        <main ref={mainRef} tabIndex={-1}><Page /></main>
        <BottomNav current={current} />
      </div>
    </AuthProvider>
  );
}
