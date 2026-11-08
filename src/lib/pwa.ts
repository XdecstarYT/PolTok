// PWA: service-worker registration (production only) + <UpdatePrompt/> banner.
// Registration runs on import; mount <UpdatePrompt/> once near the app root.
import { createElement as h, useEffect, useState } from 'react';

type Listener = (waiting: ServiceWorker | null) => void;
let waitingWorker: ServiceWorker | null = null;
const listeners = new Set<Listener>();
const emit = (w: ServiceWorker | null) => { waitingWorker = w; listeners.forEach((l) => l(w)); };

export function registerSW(): void {
  if (!import.meta.env.PROD || typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      const track = (sw: ServiceWorker | null) => {
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed' && navigator.serviceWorker.controller) emit(sw);
        });
      };
      if (reg.waiting && navigator.serviceWorker.controller) emit(reg.waiting);
      track(reg.installing);
      reg.addEventListener('updatefound', () => track(reg.installing));
      // Long-lived election-night tabs: check for a new build every 30 min.
      setInterval(() => { reg.update().catch(() => {}); }, 30 * 60 * 1000);
      // Reload only when an update replaces an existing worker. On a first visit the new worker
      // claims the page (clients.claim) and fires controllerchange too; reloading then would
      // load the whole app twice.
      let hadController = !!navigator.serviceWorker.controller;
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) {
          hadController = true;
          return;
        }
        if (reloaded) return;
        reloaded = true;
        window.location.reload();
      });
    } catch {
      /* SW is progressive enhancement */
    }
  });
}

export function applyUpdate(): void {
  waitingWorker?.postMessage({ type: 'SKIP_WAITING' });
}

registerSW();

/** Fixed bottom banner shown when a new build is waiting. Renders nothing otherwise. */
export function UpdatePrompt() {
  const [w, setW] = useState<ServiceWorker | null>(waitingWorker);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => { listeners.add(setW); return () => { listeners.delete(setW); }; }, []);
  if (!w || dismissed) return null;
  const btn = { font: 'inherit', fontWeight: 600, border: 0, borderRadius: 8, padding: '8px 14px', cursor: 'pointer', minHeight: 36 } as const;
  return h('div', {
    role: 'status', 'aria-live': 'polite', className: 'pwa-update',
    style: {
      position: 'fixed', zIndex: 1000, left: 16, right: 16, margin: '0 auto', maxWidth: 420,
      bottom: 'calc(var(--shell-bottom, 0px) + 16px + env(safe-area-inset-bottom, 0px))',
      display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 16px',
      background: 'var(--bg-2, #121726)', color: 'var(--text, #f2f5ff)',
      border: '1px solid var(--line-3, rgba(160,180,255,.28))', borderRadius: 12,
      boxShadow: '0 10px 30px rgba(0,0,0,.45)', fontSize: 14,
    },
  },
    h('span', { style: { flex: 1 } }, 'Update available'),
    h('button', { type: 'button', onClick: () => setDismissed(true), style: { ...btn, background: 'transparent', color: 'var(--text-2, #a3adc8)' } }, 'Later'),
    h('button', { type: 'button', onClick: applyUpdate, style: { ...btn, background: 'var(--dem, #3d7bff)', color: '#fff' } }, 'Reload'),
  );
}
