// React shell around MapScene: the canvas, floating region labels (real buttons, so the map is keyboard- and
// screen-reader-usable), camera buttons and keyboard controls. Default export: loaded lazily by ./index.tsx.
import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameState, RegionId } from '../engine/types';
import { CONTENT, nextElectionIn, partyColor, partyName, totalTurns } from '../ui/adapter';
import { regionLeader } from '../ui/map';
import { dayPhaseOf } from './atmosphere';
import { MapScene, type MapSceneState } from './mapScene';
import { REGION_ORDER } from './terrain';
import type { Quality } from './support';

export interface Map3DProps {
  s: GameState;
  selected?: RegionId | null;
  onSelect?: (id: RegionId) => void;
  /** Election night: colours of the regions declared so far. */
  flash?: Record<RegionId, string>;
  pulse?: RegionId | null;
  night?: boolean;
  compact?: boolean;
  quality: Quality;
  rm: boolean;
  onFail: () => void;
  onSlow?: () => void;
}

export default function Map3D({ s, selected, onSelect, flash, pulse, night, compact, quality, rm, onFail, onSlow }: Map3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const scene = useRef<MapScene | null>(null);
  const labels = useRef<(HTMLButtonElement | null)[]>([]);
  const [hover, setHover] = useState<string | null>(null);
  const cb = useRef({ onSelect, onFail, onSlow }); cb.current = { onSelect, onFail, onSlow };

  // the scene lives as long as the quality and motion settings stay the same
  useEffect(() => {
    if (!host.current) return;
    let sc: MapScene;
    try {
      sc = new MapScene(host.current, {
        quality, rm, compact,
        onPick: (id) => cb.current.onSelect?.(id),
        onHover: setHover,
        onLost: () => cb.current.onFail(),
        onSlow: () => cb.current.onSlow?.(),
      });
    } catch (e) {
      console.warn('3D map unavailable, using the 2D map', e);
      cb.current.onFail();
      return;
    }
    scene.current = sc;
    sc.setLabels(labels.current);
    (host.current as HTMLDivElement & { __q3d?: () => unknown }).__q3d = () => sc.stats();
    return () => { sc.dispose(); scene.current = null; };
  }, [quality, rm, compact]);

  const state = useMemo<MapSceneState>(() => {
    const tints: Record<string, string | null> = {}, glow: Record<string, number> = {};
    for (const id of REGION_ORDER) {
      if (flash) { tints[id] = flash[id] ?? null; glow[id] = flash[id] ? (pulse === id ? 1 : 0.7) : 0; }
      else { const lead = regionLeader(s, id).party; tints[id] = lead ? partyColor(s, lead) : null; glow[id] = 0; }
    }
    let toElect: number | null = null; try { toElect = nextElectionIn(s); } catch { /* ignore */ }
    return {
      tints, glow, selected: selected ?? null, pulse: pulse ?? null, era: s.era ?? 1, turn: s.turn, totalTurns: totalTurns(s),
      dayPhase: dayPhaseOf(toElect), night: !!night, campaigns: { ...(flash ? {} : s.campaign) }, flagColor: s.player.color,
      autoOrbit: !!night, flash: !!flash,
    };
  }, [s, selected, flash, pulse, night]);
  useEffect(() => { scene.current?.setState(state); }, [state, quality, rm, compact]);

  const onKey = (e: React.KeyboardEvent) => {
    const sc = scene.current; if (!sc || e.metaKey || e.ctrlKey || e.altKey) return;
    const k = e.key;
    const handled: Record<string, () => void> = {
      ArrowLeft: () => (e.shiftKey ? sc.orbit(0.12, 0) : sc.pan(-1, 0)), ArrowRight: () => (e.shiftKey ? sc.orbit(-0.12, 0) : sc.pan(1, 0)),
      ArrowUp: () => (e.shiftKey ? sc.orbit(0, -0.08) : sc.pan(0, 1)), ArrowDown: () => (e.shiftKey ? sc.orbit(0, 0.08) : sc.pan(0, -1)),
      '+': () => sc.zoom(0.85), '=': () => sc.zoom(0.85), '-': () => sc.zoom(1.18), _: () => sc.zoom(1.18),
      '[': () => sc.orbit(0.15, 0), ']': () => sc.orbit(-0.15, 0), Home: () => sc.resetView(), '0': () => sc.resetView(), r: () => sc.resetView(), R: () => sc.resetView(),
    };
    if (handled[k]) { e.preventDefault(); e.stopPropagation(); handled[k](); }
  };

  const regions = REGION_ORDER.map((id) => CONTENT.regions.find((r) => r.id === id)).filter((r): r is NonNullable<typeof r> => !!r);
  return (
    <div className={`q3d${compact ? ' is-compact' : ''}${night ? ' is-night' : ''}`} data-quality={quality}>
      <div ref={host} className="q3d__host" tabIndex={0} onKeyDown={onKey} role="application"
        aria-label="3D map of Calderra. Drag to pan, pinch or scroll to zoom, right-drag or two fingers to rotate. Keyboard: arrows pan, Shift and arrows orbit, plus and minus zoom, R resets the view." />
      <div className="q3d__labels">
        {regions.map((reg, i) => {
          const lead = flash ? null : regionLeader(s, reg.id).party;
          const decl = flash?.[reg.id];
          const camp = flash ? 0 : s.campaign?.[reg.id] ?? 0;
          const dot = decl ?? (lead ? partyColor(s, lead) : null);
          return (
            <button key={reg.id} ref={(el) => { labels.current[i] = el; }} type="button"
              className={`q3d__lbl${selected === reg.id ? ' is-sel' : ''}${hover === reg.id ? ' is-hover' : ''}${pulse === reg.id ? ' is-pulse' : ''}${flash && !decl ? ' is-wait' : ''}`}
              tabIndex={onSelect ? 0 : -1}
              aria-label={`${reg.name}, ${reg.seats} seats${lead ? `, led by ${partyName(s, lead)}` : ''}${camp ? `, you campaigned ${camp} time${camp > 1 ? 's' : ''}` : ''}${flash ? (decl ? ', declared' : ', still counting') : ''}`}
              onClick={() => { if (!onSelect) return; const sc = scene.current; if (sc) sc.flyTo(reg.id, () => onSelect(reg.id)); else onSelect(reg.id); }}
              onMouseEnter={() => scene.current?.setHover(i)} onMouseLeave={() => scene.current?.setHover(-1)}>
              {dot && <i className="q3d__dot" style={{ background: dot }} aria-hidden="true" />}
              <b>{reg.name.split(' ')[0]}</b>
              {!compact && <small className="q-num">{reg.seats}</small>}
              {camp > 0 && <span className="q3d__camp" aria-hidden="true">⚑{camp > 1 ? camp : ''}</span>}
            </button>
          );
        })}
      </div>
      <div className="q3d__tools">
        <button type="button" className="q3d__tool" onClick={() => scene.current?.zoom(0.8)} aria-label="Zoom in">+</button>
        <button type="button" className="q3d__tool" onClick={() => scene.current?.zoom(1.25)} aria-label="Zoom out">−</button>
        <button type="button" className="q3d__tool q3d__tool--wide" onClick={() => scene.current?.resetView()} aria-label="Reset view">⟲ <span>Reset</span></button>
      </div>
    </div>
  );
}
