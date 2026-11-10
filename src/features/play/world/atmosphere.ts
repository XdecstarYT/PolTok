// Sky, light and fog for the 3D world: time of day follows the turn, mood follows the era, and election night is night.
// Pure numbers (hex colours, angles), no three.js.

export interface Atmosphere {
  skyTop: number; skyHorizon: number; skyBottom: number; fog: number; fogNear: number; fogFar: number;
  sun: number; sunIntensity: number; sunElev: number; sunAzim: number;
  hemiSky: number; hemiGround: number; hemiIntensity: number;
  exposure: number; night: number; stars: number; water: number;
}

type Mood = { top: number; hor: number; fog: number; sun: number; haze: number; water: number };
/** Era moods: the Lamp Era is warm and amber, the Smokestack Era hazy and ochre, the Signal Era crisp and cool. */
const MOOD: Record<number, Mood> = {
  1: { top: 0x7fb2d6, hor: 0xf3dfb4, fog: 0xead7b0, sun: 0xffe2b0, haze: 0, water: 0x3f8f9a },
  2: { top: 0x8c9aa6, hor: 0xd8c39c, fog: 0xc9b896, sun: 0xffcf96, haze: 0.45, water: 0x4d7f80 },
  3: { top: 0x4f8fd8, hor: 0xd4ecf6, fog: 0xcfe3ee, sun: 0xfff6ea, haze: 0, water: 0x2f87a8 },
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export function mixHex(a: number, b: number, t: number) {
  const r = lerp((a >> 16) & 255, (b >> 16) & 255, t), g = lerp((a >> 8) & 255, (b >> 8) & 255, t), bl = lerp(a & 255, b & 255, t);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(bl);
}

/** Times of day across an electoral cycle: morning, noon, afternoon, golden dusk on the election turn. */
const DAY = [
  { elev: 26, azim: -60, warm: 0.25, bright: 0.9 },
  { elev: 58, azim: -20, warm: 0, bright: 1.05 },
  { elev: 38, azim: 30, warm: 0.15, bright: 1 },
  { elev: 11, azim: 62, warm: 0.75, bright: 0.8 },
];
/** Day phase 0..3 from the scenario's election calendar (pass the engine's turnsToElection; null = no more elections). */
export const dayPhaseOf = (turnsToElection: number | null) => (turnsToElection === null ? 1 : 3 - Math.min(3, Math.max(0, turnsToElection)));

/** `phase` 0..3 is the time of day (see dayPhaseOf); `night` 0..1 blends toward election night. */
export function atmosphere(era: number, phase: number, night = 0): Atmosphere {
  const m = MOOD[era] ?? MOOD[1];
  const d = DAY[Math.max(0, Math.min(3, Math.round(phase)))];
  const dusk = 0xff9a5a;
  const day: Atmosphere = {
    skyTop: mixHex(m.top, 0x6f7fb8, d.warm * 0.35), skyHorizon: mixHex(m.hor, dusk, d.warm * 0.55), skyBottom: mixHex(m.hor, 0x9a8a70, 0.4),
    fog: mixHex(m.fog, dusk, d.warm * 0.35), fogNear: lerp(60, 32, m.haze), fogFar: lerp(150, 95, m.haze),
    sun: mixHex(m.sun, dusk, d.warm * 0.6), sunIntensity: 2.6 * d.bright * (1 - m.haze * 0.25), sunElev: d.elev, sunAzim: d.azim,
    hemiSky: mixHex(m.top, 0xffffff, 0.4), hemiGround: 0x6a5a40, hemiIntensity: 1.15 * d.bright,
    exposure: 1.0, night: 0, stars: 0, water: m.water,
  };
  if (night <= 0) return day;
  const n = Math.min(1, night);
  const nightA: Atmosphere = {
    skyTop: 0x070b1c, skyHorizon: 0x1c2550, skyBottom: 0x0b0f20, fog: 0x121a38, fogNear: 50, fogFar: 140,
    sun: 0x9fb4ff, sunIntensity: 0.55, sunElev: 40, sunAzim: -130,
    hemiSky: 0x4a5a9a, hemiGround: 0x15151f, hemiIntensity: 0.75, exposure: 1.05, night: 1, stars: 1, water: 0x1a3550,
  };
  const out = { ...day };
  (Object.keys(out) as (keyof Atmosphere)[]).forEach((k) => {
    const a = day[k], b = nightA[k];
    out[k] = (/sky|fog$|^sun$|hemiSky|hemiGround|water/.test(k) && k !== 'fogNear' && k !== 'fogFar') ? mixHex(a, b, n) : lerp(a, b, n);
  });
  return out;
}
