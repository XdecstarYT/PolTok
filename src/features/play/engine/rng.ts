// Seeded mulberry32 RNG. The generator state lives in GameState.rng so games replay exactly.
import type { GameState } from './types';

/** Normalise any number to a uint32 seed. */
export function seedToState(seed: number): number {
  return (Math.floor(Math.abs(seed)) ^ 0x9e3779b9) >>> 0;
}

/** Next float in [0,1). Mutates state.rng (call only on a working copy). */
export function rand(state: GameState): number {
  let t = (state.rng = (state.rng + 0x6d2b79f5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/** Uniform float in [a,b). */
export function uniform(state: GameState, a: number, b: number): number {
  return a + (b - a) * rand(state);
}

/** Weighted pick; returns index or -1 when total weight is 0. */
export function weightedIndex(state: GameState, weights: number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  if (total <= 0) return -1;
  let r = rand(state) * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return weights.length - 1;
}
