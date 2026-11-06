import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useToast } from '../../components';
import { fmtPostDate, lastSeen, markSeen, SEEN_EVENT, setToasted, unread, useUpdates, wasToasted } from './api';
import './updates.css';

/** Shell button: unread-count dot + popover of the latest 3 posts; one-time toast for a new major release. */
export function UpdatesBell() {
  const posts = useUpdates();
  const loc = useLocation();
  const toast = useToast();
  const [seen, setSeen] = useState(lastSeen);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const n = unread(posts, seen).length;

  useEffect(() => {
    const on = () => setSeen(lastSeen());
    window.addEventListener(SEEN_EVENT, on);
    return () => window.removeEventListener(SEEN_EVENT, on);
  }, []);
  useEffect(() => setOpen(false), [loc.pathname]);
  useEffect(() => {
    if (!open) return;
    const off = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('pointerdown', off);
    window.addEventListener('keydown', esc);
    return () => {
      window.removeEventListener('pointerdown', off);
      window.removeEventListener('keydown', esc);
    };
  }, [open]);

  // one-time toast: newest major release, only for returning visitors who haven't seen it
  useEffect(() => {
    if (seen === null || loc.pathname === '/updates') return;
    const major = unread(posts, seen).find((p) => p.major);
    if (!major || wasToasted(major.id)) return;
    setToasted(major.id);
    toast.push({ kicker: `NEW ${major.version ?? 'RELEASE'}`, title: major.title, body: 'See what’s new →', tone: 'info', to: `/updates#${major.id}`, duration: 9000 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, seen]);

  const toggle = () => {
    setOpen((o) => !o);
    if (!open && n) markSeen(posts);
  };

  return (
    <div className="up-bell" ref={ref}>
      <button type="button" className="sh-gear up-bell__btn" onClick={toggle} aria-expanded={open} aria-haspopup="dialog" aria-label={n ? `What's new: ${n} unread update${n === 1 ? '' : 's'}` : "What's new"} title="What's new">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {n > 0 && <span className="up-bell__dot num" aria-hidden="true">{n > 9 ? '9+' : n}</span>}
      </button>
      {open && (
        <div className="up-pop" role="dialog" aria-label="Latest updates">
          <div className="up-pop__h">
            <b>What’s new</b>
            <Link to="/updates">All updates →</Link>
          </div>
          <ul>
            {posts.slice(0, 3).map((p) => (
              <li key={p.id}>
                <Link to={`/updates#${p.id}`} className="up-pop__item">
                  <span className="up-pop__meta">{p.version && <span className="up-ver num">{p.version}</span>}{fmtPostDate(p.date)}</span>
                  <span className="up-pop__t">{p.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
