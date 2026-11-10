// Public entry for the 3D world. Light: no three.js here. The scenes load lazily (their own chunk with three)
// only when a 3D view is about to render; the 2D SVG map / hemicycle render meanwhile and whenever 3D is off,
// unsupported (no WebGL2) or fails.
import { Component, lazy, Suspense, useCallback, useEffect, useState, type ReactNode } from 'react';
import type { GameState, RegionId } from '../engine/types';
import { CalderraMap, type MapProps } from '../ui/map';
import { Hemicycle, type SeatView } from '../ui/visuals';
import { disableWebGL, downgrade, hasWebGL, resolveQuality, useGfx3D, type Quality } from './support';
import type { ChamberSeat } from './chamberScene';

export { Gfx3DContext, hasWebGL, defaultQuality, type QualityPref } from './support';

const Map3D = lazy(() => import('./Map3D'));
const Chamber3D = lazy(() => import('./Chamber3D'));
/** Start fetching the 3D chunk early (e.g. on the title screen), without rendering anything. */
export const preload3D = () => { if (hasWebGL()) { void import('./Map3D'); } };

class Boundary extends Component<{ fallback: ReactNode; onError: () => void; children: ReactNode }, { err: boolean }> {
  state = { err: false };
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e: unknown) { console.warn('3D view failed', e); this.props.onError(); }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

/** Session-wide: quality actually in use (auto may step down if frames are slow), and whether 3D broke. */
let sessionQuality: Quality | null = null;
let broken = false;
function useQuality(): [Quality, () => void] {
  const g = useGfx3D();
  const [q, setQ] = useState<Quality>(() => (g.quality === 'auto' ? sessionQuality ?? resolveQuality('auto') : g.quality));
  useEffect(() => { setQ(g.quality === 'auto' ? sessionQuality ?? resolveQuality('auto') : g.quality); }, [g.quality]);
  const slow = useCallback(() => {
    if (g.quality !== 'auto') return;
    setQ((cur) => { const d = downgrade(cur); if (d) sessionQuality = d; return d ?? cur; });
  }, [g.quality]);
  return [q, slow];
}

export interface MapViewProps extends MapProps {
  night?: boolean;
  /** Show the 2D / 3D switch. */
  toggle?: boolean;
  tall?: boolean;
}

/** The Calderra map: 3D by default when supported, the SVG map otherwise (or by choice). */
export function MapView({ night, toggle, tall, ...p }: MapViewProps) {
  const g = useGfx3D();
  const [failed, setFailed] = useState(broken);
  const [q, slow] = useQuality();
  const can = hasWebGL() && !failed;
  const on = g.enabled && can;
  const fail = useCallback(() => { broken = true; disableWebGL(); setFailed(true); }, []);
  const svg = <CalderraMap {...p} />;
  return (
    <div className={`q-mapview${on ? ' is-3d' : ''}${tall ? ' is-tall' : ''}${p.compact ? ' is-compact' : ''}`}>
      {on ? (
        <Boundary fallback={svg} onError={fail}>
          <Suspense fallback={<div className="q3d q3d--loading">{svg}<span className="q3d__loading">Raising the diorama…</span></div>}>
            <Map3D s={p.s} selected={p.selected} onSelect={p.onSelect} flash={p.flash} pulse={p.pulse} night={night} compact={p.compact} quality={q} rm={g.rm} onFail={fail} onSlow={slow} />
          </Suspense>
        </Boundary>
      ) : svg}
      {toggle && can && g.setEnabled && (
        <div className="q-mapview__switch" role="group" aria-label="Map style">
          <button type="button" aria-pressed={on} className={on ? 'is-on' : ''} onClick={() => g.setEnabled?.(true)}>3D</button>
          <button type="button" aria-pressed={!on} className={!on ? 'is-on' : ''} onClick={() => g.setEnabled?.(false)}>2D</button>
        </div>
      )}
    </div>
  );
}

/** The roll-call chamber: 3D hemicycle when enabled and supported, else the existing 2D hemicycle. */
export function ChamberView({ seats, partyOf, era, label, center, seatTip, rm }: {
  seats: SeatView[]; partyOf: (i: number) => string | null; era: number; label: string; center?: ReactNode; seatTip?: (i: number) => ReactNode; rm: boolean;
}) {
  const g = useGfx3D();
  const [failed, setFailed] = useState(broken);
  const [q] = useQuality();
  const fail = useCallback(() => { broken = true; disableWebGL(); setFailed(true); }, []);
  const flat = <Hemicycle seats={seats} rm label={label} seatTip={seatTip} center={center} />;
  if (!g.enabled || failed || !hasWebGL()) return flat;
  const cs: ChamberSeat[] = seats.map((s, i) => ({ fill: s.color, party: partyOf(i), dim: s.dim, flip: s.flip }));
  return (
    <Boundary fallback={flat} onError={fail}>
      <Suspense fallback={flat}>
        <Chamber3D seats={cs} era={era} quality={q} rm={rm || g.rm} label={label} center={center} onFail={fail} />
      </Suspense>
    </Boundary>
  );
}

export type { GameState, RegionId };
