import { useEffect, useState } from 'react';
import { cloneSnap, createRun, type SimModel, type SimParams, type SimSnapshot } from './sim';

type IdleWin = Window & {
  requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
  cancelIdleCallback?: (h: number) => void;
};

/**
 * Runs the Monte Carlo in small time-boxed slices (≤8ms each) scheduled with requestIdleCallback
 * (setTimeout fallback) so sliders and animation stay smooth. Results stream in progressively.
 */
export function useMonteCarlo(model: SimModel | null, params: SimParams, target: number, seed = 20261103) {
  const [snap, setSnap] = useState<SimSnapshot | null>(null);
  const ovKey = JSON.stringify(params.overrides ?? {});

  useEffect(() => {
    if (!model || !model.seats.length) {
      setSnap(null);
      return;
    }
    const run = createRun(model, params, target, seed);
    const w = window as IdleWin;
    let cancelled = false;
    let handle: number | ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      handle = w.requestIdleCallback ? w.requestIdleCallback(tick, { timeout: 60 }) : setTimeout(tick, 0);
    };
    const tick = () => {
      if (cancelled) return;
      const t0 = performance.now();
      let done = false;
      const per = model.chamber === 'house' ? 20 : 100;
      do done = run.step(per);
      while (!done && performance.now() - t0 < 8);
      setSnap(cloneSnap(run.snap));
      if (!done) schedule();
    };
    schedule();
    return () => {
      cancelled = true;
      if (handle != null) {
        if (w.cancelIdleCallback && typeof handle === 'number') w.cancelIdleCallback(handle);
        clearTimeout(handle as ReturnType<typeof setTimeout>);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [model, params.shift, params.corr, ovKey, target, seed]);

  return snap;
}
