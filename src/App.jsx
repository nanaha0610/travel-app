import { useEffect, useRef, useState } from 'react';
import { AuthProvider } from './auth/AuthProvider.jsx';
import BottomNav, { tabs } from './components/BottomNav.jsx';
import FeedPage from './pages/FeedPage.jsx';
import CreatePage from './pages/CreatePage.jsx';
import MapPage from './pages/MapPage.jsx';
import ProfilePage from './pages/ProfilePage.jsx';
import DailyRecordPage from './pages/DailyRecordPage.jsx';

const pages = { feed: FeedPage, create: CreatePage, map: MapPage, profile: ProfilePage, day: DailyRecordPage };
function readPage() {
  const [id, query = ''] = window.location.hash.slice(1).split('?');
  const page = Object.hasOwn(pages, id) ? id : 'feed';
  const trip = new URLSearchParams(query).get('trip') || '';
  return { page, tripId: /^[1-9][0-9]{0,19}$/.test(trip) ? trip : '' };
}

export default function App() {
  const [route, setRoute] = useState(readPage);
  const current = route.page;
  const mainRef = useRef(null);

  useEffect(() => {
    const navigate = () => setRoute(readPage());
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  useEffect(() => {
    document.title = `${current === 'day' ? '1日の旅の記録' : tabs.find((tab) => tab.id === current).label} | Travel App`;
    window.scrollTo(0, 0);
    mainRef.current?.focus({ preventScroll: true });
  }, [current]);

  const Page = pages[current];
  return (
    <AuthProvider>
      <div className="app-shell">
        <header className="app-header"><a href="#feed">Travel App</a><span>旅のはじまり</span></header>
        <main ref={mainRef} tabIndex={-1}><Page initialTripId={route.tripId} /></main>
        <BottomNav current={current === 'day' ? 'profile' : current} />
      </div>
    </AuthProvider>
  );
}
