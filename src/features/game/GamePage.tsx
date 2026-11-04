import { useEffect, useState } from 'react';

const SRC = '/game/index.html';

export default function GamePage() {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const prev = document.title;
    document.title = 'Campaign HQ · PolTok';
    return () => {
      document.title = prev;
    };
  }, []);
  return (
    <div style={{ position: 'relative', width: '100%', height: 'calc(100dvh - var(--shell-top) - var(--shell-bottom))', background: '#000' }}>
      {!loaded && (
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: 'var(--text-3)' }}>
          Loading Campaign HQ…
        </div>
      )}
      <iframe
        src={SRC}
        title="Campaign HQ game"
        onLoad={() => setLoaded(true)}
        allow="fullscreen; autoplay"
        style={{ border: 0, width: '100%', height: '100%', display: 'block', opacity: loaded ? 1 : 0 }}
      />
      <a
        href={SRC}
        target="_blank"
        rel="noopener"
        style={{ position: 'absolute', right: 8, bottom: 8, fontSize: 12, padding: '4px 8px', borderRadius: 6, background: 'rgba(0,0,0,.6)', color: '#fff', textDecoration: 'none' }}
      >
        Open fullscreen ↗
      </a>
    </div>
  );
}
