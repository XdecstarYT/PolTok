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
const ReplayPage = lazy(() => import('../features/analysis/ReplayPage'));
const AnalysisPage = lazy(() => import('../features/analysis/AnalysisPage'));
const RacesIndex = lazy(() => import('../features/races/RacesIndex'));
const AUPage = lazy(() => import('../features/au/AUPage'));
const VictoriaPage = lazy(() => import('../features/au/VictoriaPage'));
const AUSeatPage = lazy(() => import('../features/au/SeatPage'));
const WatchPage = lazy(() => import('../features/watch/WatchPage'));
const ComparePage = lazy(() => import('../features/watch/ComparePage'));
import { WatchAlerts } from '../features/watch/WatchAlerts';
const FlipsPage = lazy(() => import('../features/flips/FlipsPage'));
const MeasuresPage = lazy(() => import('../features/measures/MeasuresPage'));
const GovernorsPage = lazy(() => import('../features/governors/GovernorsPage'));
const GovStatePage = lazy(() => import('../features/governors/GovStatePage'));
const SearchPage = lazy(() => import('../features/search/SearchPage'));
const CandidatesIndex = lazy(() => import('../features/candidates/CandidatesIndex'));
const CandidatePage = lazy(() => import('../features/candidates/CandidatePage'));

export function App() {
  return (
    <Shell>
      <WatchAlerts />
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
          <Route path="/watch" element={<WatchPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/flips" element={<FlipsPage />} />
          <Route path="/measures" element={<MeasuresPage />} />
          <Route path="/governors" element={<GovernorsPage />} />
          <Route path="/governors/:abbr" element={<GovStatePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/replay" element={<ReplayPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/candidates" element={<CandidatesIndex />} />
          <Route path="/candidate/:id" element={<CandidatePage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
