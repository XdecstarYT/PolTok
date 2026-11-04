/**
 * User settings (persisted per browser): display time zone, race-call alerts, sound.
 * The display time zone is applied globally via setDisplayTZ() so every formatter
 * (fmtTime/fmtET/fmtHHMM/tzAbbr) follows it; App remounts on change (see main.tsx).
 */
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { setDisplayTZ } from '../components/time';

export type AlertLevel = 'all' | 'key' | 'off';

export interface Settings {
  /** IANA zone or 'local' */
  timeZone: string;
  alerts: AlertLevel;
  sound: boolean;
  /** visual style: 'command' (default dark) or 'broadcast' (cable-news desk) */
  ui: 'command' | 'broadcast';
}

export const TIME_ZONES: { id: string; label: string; group: string }[] = [
  { id: 'local', label: 'My device', group: 'Auto' },
  { id: 'America/New_York', label: 'US Eastern', group: 'United States' },
  { id: 'America/Chicago', label: 'US Central', group: 'United States' },
  { id: 'America/Denver', label: 'US Mountain', group: 'United States' },
  { id: 'America/Los_Angeles', label: 'US Pacific', group: 'United States' },
  { id: 'America/Anchorage', label: 'Alaska', group: 'United States' },
  { id: 'Pacific/Honolulu', label: 'Hawaii', group: 'United States' },
  { id: 'Australia/Melbourne', label: 'Melbourne', group: 'Australia' },
  { id: 'Australia/Sydney', label: 'Sydney', group: 'Australia' },
  { id: 'Australia/Brisbane', label: 'Brisbane', group: 'Australia' },
  { id: 'Australia/Adelaide', label: 'Adelaide', group: 'Australia' },
  { id: 'Australia/Perth', label: 'Perth', group: 'Australia' },
  { id: 'Pacific/Auckland', label: 'Auckland', group: 'Asia-Pacific' },
  { id: 'Asia/Tokyo', label: 'Tokyo', group: 'Asia-Pacific' },
  { id: 'Asia/Singapore', label: 'Singapore', group: 'Asia-Pacific' },
  { id: 'Europe/London', label: 'London', group: 'Europe' },
  { id: 'Europe/Paris', label: 'Paris / Berlin', group: 'Europe' },
  { id: 'UTC', label: 'UTC', group: 'Other' },
];

const KEY = 'poltok:settings';
const DEFAULTS: Settings = { timeZone: 'America/New_York', alerts: 'key', sound: false, ui: 'command' };

function applyUi(ui: Settings['ui']) {
  try {
    document.documentElement.dataset.ui = ui;
  } catch {
    /* no DOM */
  }
}

function load(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || '{}') as Partial<Settings>;
    return { ...DEFAULTS, ...raw };
  } catch {
    return DEFAULTS;
  }
}

interface Ctx {
  settings: Settings;
  update: (patch: Partial<Settings>) => void;
  /** Settings panel visibility (the panel lives outside the remounting App). */
  panelOpen: boolean;
  setPanelOpen: (open: boolean) => void;
}
const SettingsCtx = createContext<Ctx>({ settings: DEFAULTS, update: () => {}, panelOpen: false, setPanelOpen: () => {} });

export function SettingsProvider({ children }: { children: (settings: Settings) => ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => {
    const s = load();
    setDisplayTZ(s.timeZone);
    applyUi(s.ui);
    return s;
  });
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      if (patch.timeZone) setDisplayTZ(next.timeZone);
      if (patch.ui) applyUi(next.ui);
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage unavailable */
      }
      return next;
    });
  }, []);
  const [panelOpen, setPanelOpen] = useState(false);
  const value = useMemo(() => ({ settings, update, panelOpen, setPanelOpen }), [settings, update, panelOpen]);
  return <SettingsCtx.Provider value={value}>{children(settings)}</SettingsCtx.Provider>;
}

export const useSettings = () => useContext(SettingsCtx);

/* ── Race-call chime (Web Audio, no assets) ── */
let audioCtx: AudioContext | null = null;
export function playCallChime(party: string) {
  try {
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    audioCtx ??= new Ctor();
    const ctx = audioCtx;
    const base = party === 'R' ? 392 : party === 'D' ? 523.25 : 440;
    [0, 0.12, 0.24].forEach((t, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = base * [1, 1.25, 1.5][i];
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.5);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.55);
    });
  } catch {
    /* audio unavailable */
  }
}
