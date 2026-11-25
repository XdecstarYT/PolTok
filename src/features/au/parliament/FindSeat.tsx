/** "Find my seat": suburb or postcode → Victorian district(s), or the browser's location (matched on-device). */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../../../lib/liquidGlass';
import { seatById } from './people';
import './parliament.css';

type Where = { postcodes: Record<string, [string, number][]>; suburbs: Record<string, [string, number][]> };
let whereP: Promise<Where> | null = null;
const loadWhere = () => (whereP ??= fetch('/data/vic-where.json').then((r) => { if (!r.ok) throw new Error(String(r.status)); return r.json(); }));
type Geo = { features: { properties: { id: string }; geometry: { type: string; coordinates: number[][][] | number[][][][] } }[] };
let geoP: Promise<Geo> | null = null;
const loadGeo = () => (geoP ??= fetch('/geo/vic-districts.json').then((r) => r.json()));
const inRing = (x: number, y: number, r: number[][]) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) { const [xi, yi] = r[i], [xj, yj] = r[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };

export function FindSeat({ compact, onSeat }: { compact?: boolean; onSeat?: (id: string) => void }) {
  const nav = useNavigate();
  const [q, setQ] = useState('');
  const [where, setWhere] = useState<Where | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (q.length >= 2 && !where) loadWhere().then(setWhere).catch(() => setMsg('Lookup data is unavailable right now.')); }, [q, where]);
  const go = (id: string) => (onSeat ? onSeat(id) : nav(`/au/victoria/parliament?seat=${id}`));
  const matches = useMemo(() => {
    if (!where) return [];
    const t = q.trim();
    if (/^3\d{3}$/.test(t)) return where.postcodes[t] ? [{ label: `Postcode ${t}`, seats: where.postcodes[t] }] : [];
    if (t.length < 2) return [];
    const lo = t.toLowerCase();
    return Object.entries(where.suburbs).filter(([n]) => n.toLowerCase().startsWith(lo)).slice(0, 6).map(([n, seats]) => ({ label: n, seats }));
  }, [q, where]);
  const locate = () => {
    if (!navigator.geolocation) { setMsg('Location isn\'t available in this browser.'); return; }
    setBusy(true); setMsg(null);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { longitude: x, latitude: y } = pos.coords;
      const g: Geo = await loadGeo();
      const hit = g.features.find((f: Geo['features'][number]) => (f.geometry.type === 'Polygon' ? [f.geometry.coordinates as number[][][]] : (f.geometry.coordinates as number[][][][])).some((p) => inRing(x, y, p[0]) && !p.slice(1).some((h) => inRing(x, y, h))));
      setBusy(false);
      if (hit) go(hit.properties.id); else setMsg('You don\'t seem to be in Victoria. Try a suburb or postcode instead.');
    }, () => { setBusy(false); setMsg('Couldn\'t get your location. Try a suburb or postcode.'); }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 600000 });
  };
  return (
    <div className={`fs lg${compact ? ' fs--compact' : ''}`}>
      {!compact && <div className="fs__head"><span aria-hidden="true">📍</span><div><b>Find my seat</b><small>Suburb or postcode · see your candidates and the projection</small></div></div>}
      <div className="fs__row">
        <input type="search" value={q} onChange={(e) => { setQ(e.target.value); setMsg(null); }} placeholder="e.g. Niddrie or 3042" aria-label="Suburb or postcode" autoComplete="off"
          onKeyDown={(e) => { if (e.key === 'Enter' && matches[0]) go(matches[0].seats[0][0]); }} />
        <button type="button" className="lg lg--pill lg-btn" onClick={locate} disabled={busy} title="Your location is matched on your device and never sent anywhere">{busy ? '…' : '🎯 Use my location'}</button>
      </div>
      {matches.length > 0 && (
        <ul className="fs__res">
          {matches.map((m) => (
            <li key={m.label}><span className="faint">{m.label}</span>
              {m.seats.map(([id, share]) => <button key={id} type="button" onClick={() => go(id)}>{seatById.get(id)?.name ?? id}{m.seats.length > 1 ? <small> {Math.round(share * 100)}%</small> : null} →</button>)}
            </li>
          ))}
        </ul>
      )}
      {q.trim().length >= 2 && where && !matches.length && <p className="fs__msg">No Victorian suburb or postcode matches “{q.trim()}”.</p>}
      {msg && <p className="fs__msg">{msg}</p>}
    </div>
  );
}
