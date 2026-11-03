import { useEffect, useState } from 'react';
import { useReducedMotion as useFramerReducedMotion } from 'framer-motion';

/** Current epoch ms, re-rendering every `intervalMs` (default 1s). */
export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** True when the user prefers reduced motion (wraps framer-motion's hook; null → false). */
export function useReducedMotion(): boolean {
  return !!useFramerReducedMotion();
}

/** Previous value of a prop/state from the last render. */
export function usePrevious<T>(value: T): T | undefined {
  const [state, setState] = useState<{ cur: T; prev: T | undefined }>({ cur: value, prev: undefined });
  if (state.cur !== value) setState({ cur: value, prev: state.cur });
  return state.prev;
}
