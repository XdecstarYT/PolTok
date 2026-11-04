import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/global.css';
import './styles/broadcast.css';
import { App } from './app/App';
import { LiveProvider } from './lib/live';
import { SettingsProvider } from './lib/settings';
import { SettingsPanel } from './app/shell/SettingsPanel';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LiveProvider>
        <SettingsProvider>
          {/* Remount on time-zone change so every formatted time re-renders in the new zone. */}
          {(settings) => (
            <>
              <App key={settings.timeZone} />
              <SettingsPanel />
            </>
          )}
        </SettingsProvider>
      </LiveProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
