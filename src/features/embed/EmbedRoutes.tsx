import { Route, Routes } from 'react-router-dom';
import { EmbedBalance, EmbedMap, EmbedNotFound, EmbedRace } from './widgets';

/** Rendered by App.tsx OUTSIDE the Shell for any /embed/* path. */
export default function EmbedRoutes() {
  return (
    <Routes>
      <Route path="/embed/race/:id" element={<EmbedRace />} />
      <Route path="/embed/balance" element={<EmbedBalance />} />
      <Route path="/embed/map" element={<EmbedMap />} />
      <Route path="*" element={<EmbedNotFound />} />
    </Routes>
  );
}
