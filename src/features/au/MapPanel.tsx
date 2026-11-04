import { lazy, Suspense, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Skeleton, Tabs } from '../../components';
import { party, pColor, partyKey, type AuSeat } from './model';

const AUMap = lazy(() => import('./map/AUMap'));

import type { AUZoom } from './map/AUMap';
export type Region = { id: AUZoom; label: string };
export const FED_ZOOMS: Region[] = [
  { id: 'all', label: 'Australia' },
  { id: 'sydney', label: 'Sydney' },
  { id: 'melbourne', label: 'Melbourne' },
  { id: 'brisbane', label: 'Brisbane' },
  { id: 'perth', label: 'Perth' },
  { id: 'adelaide', label: 'Adelaide' },
];
export const VIC_ZOOMS: Region[] = [
  { id: 'all', label: 'Victoria' },
  { id: 'melbourne', label: 'Melbourne' },
];

/** Electorate map (AU-MAP's AUMap) coloured by holding party (or live leader when given). */
export function MapPanel({
  layer, seats, title, kicker, fills, regions, tooltip, action, legendNote, selected, focus,
}: {
  layer: 'federal' | 'vic';
  seats: AuSeat[];
  title: string;
  kicker?: ReactNode;
  fills?: Record<string, string>;
  regions?: Region[];
  tooltip?: (s: AuSeat) => ReactNode;
  action?: ReactNode;
  legendNote?: ReactNode;
  selected?: string;
  focus?: string[];
}) {
  const nav = useNavigate();
  const [variant, setVariant] = useState<'geo' | 'hex'>('geo');
  const [region, setRegion] = useState<AUZoom>('all');
  const byId = useMemo(() => new Map(seats.map((s) => [s.id, s])), [seats]);
  const baseFills = useMemo(() => fills ?? Object.fromEntries(seats.map((s) => [s.id, pColor(s.party)])), [fills, seats]);
  const legend = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of seats) m.set(partyKey(s.party), (m.get(partyKey(s.party)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [seats]);
  return (
    <Card
      title={title}
      kicker={kicker}
      className="au-map"
      action={
        <div className="au-seg" role="tablist" aria-label="Map style">
          {(['geo', 'hex'] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={variant === v} onClick={() => setVariant(v)}>{v === 'geo' ? 'Map' : 'Hex'}</button>
          ))}
          {action}
        </div>
      }
    >
      {regions && regions.length > 1 && variant === 'geo' && (
        <div className="au-map-tabs">
          <Tabs tabs={regions.map((r) => ({ id: r.id, label: r.label }))} value={region} onChange={(v) => setRegion(v)} variant="pill" ariaLabel="Zoom to region" />
        </div>
      )}
      <div className="au-map-canvas">
        <Suspense fallback={<Skeleton height="100%" />}>
          <AUMap
            layer={layer}
            variant={variant}
            fills={baseFills}
            zoom={variant === 'geo' ? region : 'all'}
            selected={selected}
            focus={focus}
            onSeatClick={(id: string) => nav(`/au/seat/${id}`)}
            renderTooltip={(id: string) => {
              const s = byId.get(id);
              if (!s) return id;
              return tooltip ? tooltip(s) : (
                <div className="au-tip">
                  <b>{s.name}</b> <span className="muted">{s.state}</span>
                  <div><i style={{ background: pColor(s.party) }} /> {s.member} ({party(s.party).short}){s.margin != null ? ` · ${s.margin.toFixed(1)}%` : ''}</div>
                </div>
              );
            }}
          />
        </Suspense>
      </div>
      <ul className="au-legend au-legend--inline">
        {legend.map(([p, n]) => (
          <li key={p}><i style={{ background: pColor(p) }} /><span>{party(p).short}</span><b className="num">{n}</b></li>
        ))}
      </ul>
      {legendNote && <p className="au-note">{legendNote}</p>}
    </Card>
  );
}
