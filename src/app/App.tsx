import { lazy, Suspense } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
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
const AUSenatePage = lazy(() => import('../features/au/SenatePage'));
const AUPartyPage = lazy(() => import('../features/au/PartyPage'));
const AUNSWPage = lazy(() => import('../features/au/NSWPage'));
const AUSwingPage = lazy(() => import('../features/au/SwingPage'));
const WatchPage = lazy(() => import('../features/watch/WatchPage'));
const ComparePage = lazy(() => import('../features/watch/ComparePage'));
import { WatchAlerts } from '../features/watch/WatchAlerts';
const FlipsPage = lazy(() => import('../features/flips/FlipsPage'));
const MeasuresPage = lazy(() => import('../features/measures/MeasuresPage'));
const HousePage = lazy(() => import('../features/house/HousePage'));
const GovernorsPage = lazy(() => import('../features/governors/GovernorsPage'));
const GovStatePage = lazy(() => import('../features/governors/GovStatePage'));
const SearchPage = lazy(() => import('../features/search/SearchPage'));
const CandidatesIndex = lazy(() => import('../features/candidates/CandidatesIndex'));
const CandidatePage = lazy(() => import('../features/candidates/CandidatePage'));
const ParliamentPage = lazy(() => import('../features/parliament/ParliamentPage'));
const ParliamentBillPage = lazy(() => import('../features/parliament/BillPage'));
const EmbedRoutes = lazy(() => import('../features/embed/EmbedRoutes'));
const EmbedBuilder = lazy(() => import('../features/embed/EmbedBuilder'));

const MenuPage = lazy(() => import('../features/menu/MenuPage'));
const AskPage = lazy(() => import('../features/ask/AskPage'));

export function App() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/embed/')) return <Suspense fallback={null}><EmbedRoutes /></Suspense>; // chrome-less iframe widgets (no Shell)
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
          <Route path="/au/senate" element={<AUSenatePage />} />
          <Route path="/au/party/:id" element={<AUPartyPage />} />
          <Route path="/au/nsw" element={<AUNSWPage />} />
          <Route path="/au/swingometer" element={<AUSwingPage />} />
          <Route path="/watch" element={<WatchPage />} />
          <Route path="/compare" element={<ComparePage />} />
          <Route path="/flips" element={<FlipsPage />} />
          <Route path="/measures" element={<MeasuresPage />} />
          <Route path="/house" element={<HousePage />} />
          <Route path="/governors" element={<GovernorsPage />} />
          <Route path="/governors/:abbr" element={<GovStatePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/replay" element={<ReplayPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/candidates" element={<CandidatesIndex />} />
          <Route path="/candidate/:id" element={<CandidatePage />} />
          <Route path="/parliament" element={<ParliamentPage />} />
          <Route path="/parliament/bill/:id" element={<ParliamentBillPage />} />
          <Route path="/embed" element={<EmbedBuilder />} />
          <Route path="/menu" element={<MenuPage />} />
          <Route path="/ask" element={<AskPage />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Suspense>
    </Shell>
  );
}
