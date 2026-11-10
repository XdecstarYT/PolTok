// React shell around ChamberScene (lazy chunk). The tally and banners stay as 2D overlays on top.
import { useEffect, useRef, type ReactNode } from 'react';
import { ChamberScene, type ChamberSeat } from './chamberScene';
import type { Quality } from './support';

export interface Chamber3DProps { seats: ChamberSeat[]; era: number; quality: Quality; rm: boolean; label: string; center?: ReactNode; onFail: () => void }

export default function Chamber3D({ seats, era, quality, rm, label, center, onFail }: Chamber3DProps) {
  const host = useRef<HTMLDivElement>(null);
  const sc = useRef<ChamberScene | null>(null);
  const fail = useRef(onFail); fail.current = onFail;
  const seatsRef = useRef(seats); seatsRef.current = seats;
  useEffect(() => {
    if (!host.current) return;
    let c: ChamberScene;
    try { c = new ChamberScene(host.current, { quality, rm, era, onLost: () => fail.current() }); }
    catch (e) { console.warn('3D chamber unavailable, using the 2D hemicycle', e); fail.current(); return; }
    sc.current = c; c.setSeats(seatsRef.current);
    (host.current as HTMLDivElement & { __q3d?: () => unknown }).__q3d = () => c.stats();
    return () => { c.dispose(); sc.current = null; };
  }, [quality, rm]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { sc.current?.setSeats(seats); }, [seats]);
  useEffect(() => { sc.current?.setEra(era); }, [era]);
  return (
    <div className="q3d q3d--chamber">
      <div ref={host} className="q3d__host" role="img" aria-label={label} />
      {center && <div className="q3d__center">{center}</div>}
    </div>
  );
}
