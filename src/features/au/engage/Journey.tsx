/** Shown under every Victorian election page: a scroll-progress bar, a "stamp unlocked" toast, the Vic Passport progress
 *  ring and the next places to explore, so there's always somewhere good to go next. */
import { useEffect, useState } from 'react';
import { AnimatePresence, m, useScroll, useSpring } from 'framer-motion';
import { Link, useLocation } from 'react-router-dom';
import { STAMPS, stamp, stampFor, usePassport } from './passport';
import './journey.css';

export function Journey() {
  const loc = useLocation();
  const got = usePassport();
  const [toast, setToast] = useState<(typeof STAMPS)[number] | null>(null);
  const { scrollYProgress } = useScroll();
  const prog = useSpring(scrollYProgress, { stiffness: 140, damping: 26 });

  useEffect(() => {
    if (stamp(loc.pathname)) {
      const s = STAMPS.find((x) => x.to === stampFor(loc.pathname)) ?? null;
      setToast(s);
      const t = setTimeout(() => setToast(null), 3800);
      return () => clearTimeout(t);
    }
  }, [loc.pathname]);

  const here = stampFor(loc.pathname);
  const next = STAMPS.filter((s) => s.to !== here && !got.includes(s.to)).slice(0, 3);
  const more = next.length < 3 ? STAMPS.filter((s) => s.to !== here && got.includes(s.to)).slice(0, 3 - next.length) : [];
  const n = got.length, total = STAMPS.length, done = n >= total;
  const R = 26, C = 2 * Math.PI * R;

  return (
    <>
      <m.div className="jr-progress" style={{ scaleX: prog }} aria-hidden="true" />
      <AnimatePresence>
        {toast && (
          <m.div className="jr-toast lg" role="status" initial={{ y: 80, opacity: 0, scale: 0.9 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 80, opacity: 0 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
            <m.span className="jr-toast__stamp" initial={{ rotate: -30, scale: 2.2 }} animate={{ rotate: -8, scale: 1 }} transition={{ type: 'spring', stiffness: 300, damping: 12, delay: 0.1 }}>{toast.emoji}</m.span>
            <span><b>Passport stamp unlocked</b><small>{toast.title} · {n}/{total} explored</small></span>
          </m.div>
        )}
      </AnimatePresence>
      <div className="jr-wrap"><section className="jr lg" aria-label="Keep exploring">
        <div className="jr__pass">
          <svg viewBox="0 0 64 64" className="jr__ring" aria-hidden="true">
            <circle cx="32" cy="32" r={R} className="jr__ring-bg" />
            <m.circle cx="32" cy="32" r={R} className="jr__ring-fg" strokeDasharray={C} initial={false} animate={{ strokeDashoffset: C * (1 - n / total) }} transition={{ duration: 1 }} />
          </svg>
          <div>
            <span className="jr__kicker">Your Vic Passport</span>
            <b>{done ? 'Every stamp collected 🏆' : `${n} of ${total} explored`}</b>
            <div className="jr__stamps">{STAMPS.map((s) => <Link key={s.to} to={s.to} title={s.title} className={got.includes(s.to) ? 'is-got' : ''}>{s.emoji}</Link>)}</div>
          </div>
        </div>
        <div className="jr__next">
          <span className="jr__kicker">{done ? 'Jump back in' : 'Explore next'}</span>
          <div className="jr__cards">
            {[...next, ...more].map((s, i) => (
              <m.div key={s.to} initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.08 }}>
                <Link to={s.to} className="jr__card">
                  <span className="jr__emoji">{s.emoji}</span>
                  <span><b>{s.title}</b><small>{s.sub}</small></span>
                  <i aria-hidden="true">→</i>
                </Link>
              </m.div>
            ))}
          </div>
        </div>
      </section></div>
    </>
  );
}
