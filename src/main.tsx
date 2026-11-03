import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './styles/global.css';
import { App } from './app/App';
import { LiveProvider } from './lib/live';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <LiveProvider>
        <App />
      </LiveProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
