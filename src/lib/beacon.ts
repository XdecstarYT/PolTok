/**
 * Anonymous pageview beacon (first-party, no cookies, no storage of identifiers). Sends {path, referrer host,
 * utm_source, device class, theme, installed-app flag} to /api/pv on every route change via navigator.sendBeacon.
 * Skipped for Do Not Track / Global Privacy Control, bots/automation, localhost and the signed-in owner.
 * Set localStorage "poltok.analytics.debug" = "1" to test on localhost.
 */
const ls = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
export function analyticsAllowed(): boolean {
  const n = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const w = window as Window & { doNotTrack?: string };
  if (n.doNotTrack === '1' || w.doNotTrack === '1' || n.msDoNotTrack === '1' || n.globalPrivacyControl) return false;
  if (ls('poltok.analytics.ignore') === '1') return false; // owner opted out (set on owner sign-in)
  try { if (sessionStorage.getItem('poltok.owner.token')) return false; } catch { /* ignore */ }
  const debug = ls('poltok.analytics.debug') === '1';
  if (!debug && (n.webdriver || /bot|crawl|spider|headless|lighthouse/i.test(n.userAgent))) return false;
  if (!debug && /^(localhost|127\.|0\.0\.0\.0|\[::1\]|192\.168\.|10\.)/.test(location.hostname)) return false;
  return true;
}

let last = '';
let first = true;
function send() {
  const p = location.pathname;
  if (p === last || p.startsWith('/embed/') || p === '/owner') return;
  last = p;
  if (!analyticsAllowed()) return;
  let r = '';
  if (first) try { const h = new URL(document.referrer).hostname; if (h !== location.hostname) r = h; } catch { /* none */ }
  first = false;
  const u = new URLSearchParams(location.search).get('utm_source') || '';
  const w = Math.min(innerWidth, screen.width || innerWidth);
  const d = w < 768 ? 'mobile' : w < 1100 && matchMedia('(pointer: coarse)').matches ? 'tablet' : 'desktop';
  const de = document.documentElement;
  const t = de.dataset.ui || de.dataset.theme || '';
  const a = matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  const body = JSON.stringify({ p, r, u, d, t, a: a ? 1 : 0 });
  try {
    if (!navigator.sendBeacon?.('/api/pv', new Blob([body], { type: 'text/plain' }))) {
      void fetch('/api/pv', { method: 'POST', body, keepalive: true, headers: { 'content-type': 'text/plain' } }).catch(() => {});
    }
  } catch { /* never break the page */ }
}

export function startBeacon() {
  if (typeof window === 'undefined' || (window as Window & { __ptBeacon?: boolean }).__ptBeacon) return;
  (window as Window & { __ptBeacon?: boolean }).__ptBeacon = true;
  const fire = () => setTimeout(send, 0);
  for (const m of ['pushState', 'replaceState'] as const) {
    const orig = history[m];
    history[m] = function (this: History, ...args: Parameters<History['pushState']>) {
      const r = orig.apply(this, args);
      fire();
      return r;
    } as History['pushState'];
  }
  addEventListener('popstate', fire);
  fire();
}
