import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Shell } from './Shell';

// Each feature owns its folder and default-exports its page component.
const Home = lazy(() => import('../features/home/HomePage'));
const MapPage = lazy(() => import('../features/map/MapPage'));
const LivePage = lazy(() => import('../features/live/LivePage'));
const NewsPage = lazy(() => import('../features/news/NewsPage'));
const FeedPage = lazy(() => import('../features/feed/FeedPage'));
const PollsPage = lazy(() => import('../features/polls/PollsPage'));
const ForecastPage = lazy(() => import('../features/polls/ForecastPage'));
const RacePage = lazy(() => import('../features/races/RacePage'));
const StatePage = lazy(() => import('../features/races/StatePage'));
const RacesIndex = lazy(() => import('../features/races/RacesIndex'));
const AUPage = lazy(() => import('../features/au/AUPage'));
const VictoriaPage = lazy(() => import('../features/au/VictoriaPage'));
const AUSeatPage = lazy(() => import('../features/au/SeatPage'));

export function App() {
  return (
    <Shell>
      <Suspense fallback={<div className="page" style={{ color: 'var(--text-3)' }}>Loading…</div>}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/map/:mode" element={<MapPage />} />
          <Route path="/live" element={<LivePage />} />
          <Route path="/news" element={<NewsPage />} />
          <Route path="/feed" element={<FeedPage />} />
          <Route path="/polls" element={<PollsPage />} />
          <Route path="/forecast" element={<ForecastPage />} />
          <Route path="/races" element={<RacesIndex />} />
          <Route path="/race/:id" element={<RacePage />} />
          <Route path="/state/:abbr" element={<StatePage />} />
          <Route path="/au" element={<AUPage />} />
          <Route path="/au/victoria" element={<VictoriaPage />} />
          <Route path="/au/seat/:id" element={<AUSeatPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
