import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { LazyMotion } from 'framer-motion';
import './styles/global.css';
import './styles/broadcast.css';
import './styles/paper.css';
import './styles/terminal.css';
import './styles/aurora.css';
import { App } from './app/App';
import { LiveProvider } from './lib/live';
import { SettingsProvider } from './lib/settings';
import { WatchlistProvider } from './lib/watchlist';
import { SettingsPanel } from './app/shell/SettingsPanel';
import { startBeacon } from './lib/beacon';

startBeacon(); // anonymous, cookieless pageview count (see src/lib/beacon.ts)

// Animation features (incl. layout animations) load in their own chunk after first paint;
// components render with the lightweight `m` element.
const motionFeatures = () => import('./lib/motionFeatures').then((r) => r.default);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <LazyMotion features={motionFeatures}>
    <BrowserRouter>
      <LiveProvider>
      <WatchlistProvider>
        <SettingsProvider>
          {/* Remount on time-zone change so every formatted time re-renders in the new zone. */}
          {(settings) => (
            <>
              <App key={settings.timeZone} />
              <SettingsPanel />
            </>
          )}
        </SettingsProvider>
      </WatchlistProvider>
      </LiveProvider>
    </BrowserRouter>
    </LazyMotion>
  </React.StrictMode>,
);
