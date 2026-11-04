/** Floating "Ask PolTok" button + slide-over chat. Mount once in Shell: <AskPolTok />. */
import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { Chat } from './Chat';
import './ask.css';

export function AskPolTok() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [open]);
  if (pathname.startsWith('/embed/') || pathname === '/ask') return null;
  return (
    <>
      {!open && (
        <button type="button" className="ask-fab" onClick={() => setOpen(true)} aria-label="Ask PolTok AI assistant">
          <span aria-hidden>✦</span> Ask
        </button>
      )}
      {open && (
        <div className="ask-overlay" onClick={() => setOpen(false)}>
          <aside className="ask-panel" role="dialog" aria-modal="true" aria-label="Ask PolTok" onClick={(e) => e.stopPropagation()}>
            <header className="ask-head">
              <strong>✦ Ask PolTok</strong>
              <Link to="/ask" className="ask-link" onClick={() => setOpen(false)}>Open page</Link>
              <button type="button" className="ask-x" onClick={() => setOpen(false)} aria-label="Close">×</button>
            </header>
            <Chat autoFocus />
          </aside>
        </div>
      )}
    </>
  );
}

export default AskPolTok;
