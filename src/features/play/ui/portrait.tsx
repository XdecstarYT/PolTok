// Procedural, deterministic SVG portraits: geometric cameo busts from a seed string. No photos, no assets.
import { memo, useId } from 'react';
import { seeded } from './fx';

const SKIN = ['#f3d6bd', '#e8bf9c', '#d6a07a', '#b97f58', '#93603d', '#6e4429', '#4f2f1c'];
const HAIR = ['#1d1612', '#3b2618', '#5a3a22', '#8a4b26', '#b5793a', '#d9b46a', '#8d8a86', '#d8d4cc'];
const COAT = ['#1f2a3d', '#2b2b30', '#4a3426', '#5a2232', '#33402a', '#3a4452', '#3d2f4f'];

export type Mood = 'stern' | 'warm' | 'sly' | 'calm';

function shade(hex: string, k: number) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(k < 0 ? c * (1 + k) : c + (255 - c) * k)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
const safeHex = (c: string) => (/^#[0-9a-f]{6}$/i.test(c) ? c : '#7a4fd6');

export interface PortraitProps {
  /** Any stable string: a character's name or id. Same seed, same face. */
  seed: string;
  /** Party/accent colour for the backdrop and rosette. */
  color: string;
  size?: number;
  mood?: Mood;
  /** Accessible name; omit for decorative portraits. */
  label?: string;
  className?: string;
  /** Muted / greyed (e.g. dismissed minister). */
  dim?: boolean;
}

export const Portrait = memo(function Portrait({ seed, color, size = 56, mood, label, className, dim }: PortraitProps) {
  const uid = useId().replace(/:/g, '');
  const r = seeded(seed);
  const accent = safeHex(color);
  const lower = seed.toLowerCase();
  const military = /marshal|general|colonel|captain|admiral|commander/.test(lower);
  const cleric = /reverend|mother|father|abbess|chaplain|deacon/.test(lower);
  const doctor = /doctor|dr\.|professor/.test(lower);
  const fem = r.next() < 0.5;
  const age = r.next(); // 0 young .. 1 old
  const skin = r.pick(SKIN);
  const hair = age > 0.78 ? r.pick(HAIR.slice(6)) : r.pick(HAIR.slice(0, 6));
  const coat = military ? '#2f3b2a' : cleric ? '#1c1a22' : r.pick(COAT);
  const headRx = r.range(14.5, 17.5), headRy = r.range(18.5, 21.5);
  const jaw = r.int(3); // 0 round, 1 square, 2 narrow
  const hairStyle = fem ? r.pick([0, 1, 2, 3, 5]) : r.pick([0, 2, 4, 5, 6, 6]);
  const facial = !fem && r.next() < 0.55 ? r.int(4) : -1; // 0 moustache, 1 full beard, 2 chops, 3 goatee
  const specs = doctor || r.next() < 0.22 ? (r.next() < 0.25 ? 'monocle' : 'round') : null;
  const hat = military ? 'kepi' : !cleric && r.next() < 0.18 ? r.pick(['top', 'bowler'] as const) : null;
  const md: Mood = mood ?? r.pick(['stern', 'warm', 'sly', 'calm'] as const);
  const bgPattern = r.int(3);
  const collar = cleric ? 'clerical' : r.pick(['cravat', 'bow', 'tie', 'high'] as const);
  const cx = 50, cy = 46;

  const headPath = jaw === 1
    ? `M${cx - headRx},${cy - 4} Q${cx - headRx},${cy - headRy} ${cx},${cy - headRy} Q${cx + headRx},${cy - headRy} ${cx + headRx},${cy - 4} L${cx + headRx - 1},${cy + 8} Q${cx + headRx - 4},${cy + headRy} ${cx},${cy + headRy} Q${cx - headRx + 4},${cy + headRy} ${cx - headRx + 1},${cy + 8} Z`
    : jaw === 2
      ? `M${cx - headRx},${cy - 3} Q${cx - headRx},${cy - headRy} ${cx},${cy - headRy} Q${cx + headRx},${cy - headRy} ${cx + headRx},${cy - 3} Q${cx + headRx - 1},${cy + 10} ${cx},${cy + headRy + 1} Q${cx - headRx + 1},${cy + 10} ${cx - headRx},${cy - 3} Z`
      : '';
  const browTilt = md === 'stern' ? 2.2 : md === 'sly' ? -1 : md === 'warm' ? -0.6 : 0.6;
  const mouth = md === 'warm' ? `M${cx - 5},${cy + 11} Q${cx},${cy + 15} ${cx + 5},${cy + 11}`
    : md === 'stern' ? `M${cx - 5},${cy + 12.5} Q${cx},${cy + 11} ${cx + 5},${cy + 12.5}`
      : md === 'sly' ? `M${cx - 5},${cy + 12} Q${cx + 1},${cy + 14} ${cx + 6},${cy + 10.5}`
        : `M${cx - 4.5},${cy + 12} L${cx + 4.5},${cy + 12}`;
  const eyeY = cy + 1;
  const hairD = shade(hair, -0.25);
  const skinD = shade(skin, -0.18);

  const hairBack = (() => {
    if (hairStyle === 1) return <path d={`M${cx - headRx - 3},${cy - 6} Q${cx - headRx - 6},${cy + 26} ${cx - headRx + 2},${cy + 34} L${cx + headRx - 2},${cy + 34} Q${cx + headRx + 6},${cy + 26} ${cx + headRx + 3},${cy - 6} Z`} fill={hairD} />;
    if (hairStyle === 3) return <circle cx={cx} cy={cy - headRy - 2} r={7.5} fill={hairD} />;
    return null;
  })();
  const hairFront = (() => {
    const top = cy - headRy;
    switch (hairStyle) {
      case 0: return <path d={`M${cx - headRx - 1},${cy - 2} Q${cx - headRx - 2},${top - 5} ${cx},${top - 4} Q${cx + headRx + 2},${top - 5} ${cx + headRx + 1},${cy - 2} Q${cx + headRx - 3},${top + 6} ${cx + 4},${top + 5} Q${cx - 6},${top + 9} ${cx - headRx + 2},${cy - 4} Z`} fill={hair} />;
      case 1: return <path d={`M${cx - headRx - 2},${cy + 4} Q${cx - headRx - 3},${top - 6} ${cx},${top - 5} Q${cx + headRx + 3},${top - 6} ${cx + headRx + 2},${cy + 4} Q${cx + headRx - 2},${top + 4} ${cx},${top + 7} Q${cx - headRx + 2},${top + 4} ${cx - headRx - 2},${cy + 4} Z`} fill={hair} />;
      case 2: return <path d={`M${cx - headRx},${cy - 3} Q${cx - headRx - 1},${top - 3} ${cx - 2},${top - 3} Q${cx + headRx + 2},${top - 3} ${cx + headRx},${cy - 4} L${cx + headRx - 2},${top + 6} Q${cx - 4},${top + 3} ${cx - 6},${top + 1} Q${cx - 10},${top + 8} ${cx - headRx + 1},${cy - 4} Z`} fill={hair} />;
      case 3: return <path d={`M${cx - headRx},${cy - 2} Q${cx - headRx},${top - 3} ${cx},${top - 3} Q${cx + headRx},${top - 3} ${cx + headRx},${cy - 2} Q${cx + 8},${top + 4} ${cx},${top + 3} Q${cx - 8},${top + 4} ${cx - headRx},${cy - 2} Z`} fill={hair} />;
      case 4: return <g fill={hair}><path d={`M${cx - headRx},${cy - 2} Q${cx - headRx},${cy - 10} ${cx - headRx + 3},${cy - 12} L${cx - headRx + 4},${cy - 2} Z`} /><path d={`M${cx + headRx},${cy - 2} Q${cx + headRx},${cy - 10} ${cx + headRx - 3},${cy - 12} L${cx + headRx - 4},${cy - 2} Z`} /></g>;
      case 5: return <g fill={hair}>{Array.from({ length: 9 }, (_, i) => { const a = Math.PI + (Math.PI * i) / 8; return <circle key={i} cx={cx + Math.cos(a) * (headRx - 1)} cy={cy - 6 + Math.sin(a) * (headRy - 2)} r={5.2} />; })}</g>;
      default: return <path d={`M${cx - headRx},${cy - 3} Q${cx - headRx},${top - 2} ${cx},${top - 2} Q${cx + headRx},${top - 2} ${cx + headRx},${cy - 3} Q${cx + headRx - 2},${top + 5} ${cx},${top + 4} Q${cx - headRx + 2},${top + 5} ${cx - headRx},${cy - 3} Z`} fill={hair} />;
    }
  })();
  const facialHair = (() => {
    const fh = hair === HAIR[7] || age > 0.7 ? HAIR[6] : hair;
    switch (facial) {
      case 0: return <path d={`M${cx - 8},${cy + 10.5} Q${cx - 4},${cy + 6.5} ${cx},${cy + 8.5} Q${cx + 4},${cy + 6.5} ${cx + 8},${cy + 10.5} Q${cx + 4},${cy + 9.5} ${cx},${cy + 10} Q${cx - 4},${cy + 9.5} ${cx - 8},${cy + 10.5} Z`} fill={fh} />;
      case 1: return <path d={`M${cx - headRx + 1},${cy + 2} Q${cx - headRx + 1},${cy + headRy + 6} ${cx},${cy + headRy + 7} Q${cx + headRx - 1},${cy + headRy + 6} ${cx + headRx - 1},${cy + 2} Q${cx + 9},${cy + 9} ${cx + 5},${cy + 10} L${cx - 5},${cy + 10} Q${cx - 9},${cy + 9} ${cx - headRx + 1},${cy + 2} Z M${cx - 4},${cy + 12.5} Q${cx},${cy + 16} ${cx + 4},${cy + 12.5} Z`} fill={fh} fillRule="evenodd" />;
      case 2: return <g fill={fh}><path d={`M${cx - headRx},${cy - 2} L${cx - headRx + 6},${cy - 1} L${cx - headRx + 7},${cy + 12} Q${cx - headRx + 2},${cy + 12} ${cx - headRx + 0.5},${cy + 6} Z`} /><path d={`M${cx + headRx},${cy - 2} L${cx + headRx - 6},${cy - 1} L${cx + headRx - 7},${cy + 12} Q${cx + headRx - 2},${cy + 12} ${cx + headRx - 0.5},${cy + 6} Z`} /></g>;
      case 3: return <path d={`M${cx - 3.5},${cy + 14.5} Q${cx},${cy + 23} ${cx + 3.5},${cy + 14.5} Z`} fill={fh} />;
      default: return null;
    }
  })();
  const hatEl = (() => {
    const top = cy - headRy;
    if (hat === 'kepi') return <g><path d={`M${cx - headRx - 1},${top + 7} L${cx - headRx + 2},${top - 9} L${cx + headRx - 2},${top - 9} L${cx + headRx + 1},${top + 7} Z`} fill="#3c4a33" /><rect x={cx - headRx - 1} y={top + 3} width={headRx * 2 + 2} height={4} fill={accent} /><path d={`M${cx - headRx - 2},${top + 7} Q${cx},${top + 13} ${cx + headRx + 4},${top + 7} Z`} fill="#16140f" /><circle cx={cx} cy={top - 2} r={2.4} fill="#e2c46b" /></g>;
    if (hat === 'top') return <g><rect x={cx - headRx + 1} y={top - 18} width={headRx * 2 - 2} height={20} rx={1.5} fill="#17161a" /><rect x={cx - headRx + 1} y={top - 2} width={headRx * 2 - 2} height={3.5} fill={accent} /><ellipse cx={cx} cy={top + 2} rx={headRx + 7} ry={3} fill="#17161a" /></g>;
    if (hat === 'bowler') return <g><path d={`M${cx - headRx + 1},${top + 2} Q${cx - headRx + 1},${top - 13} ${cx},${top - 13} Q${cx + headRx - 1},${top - 13} ${cx + headRx - 1},${top + 2} Z`} fill="#231d18" /><ellipse cx={cx} cy={top + 2} rx={headRx + 5} ry={2.6} fill="#231d18" /><rect x={cx - headRx + 1} y={top - 2} width={headRx * 2 - 2} height={2.4} fill={shade(accent, -0.3)} /></g>;
    return null;
  })();
  const collarEl = (() => {
    const y = 80;
    if (collar === 'clerical') return <rect x={cx - 5} y={y - 2} width={10} height={4} rx={1} fill="#f4f1ea" />;
    if (collar === 'bow') return <g><path d={`M${cx - 7},${y - 2} L${cx},${y + 1} L${cx - 7},${y + 4} Z M${cx + 7},${y - 2} L${cx},${y + 1} L${cx + 7},${y + 4} Z`} fill={accent} /><circle cx={cx} cy={y + 1} r={1.6} fill={shade(accent, -0.3)} /></g>;
    if (collar === 'tie') return <path d={`M${cx - 2.5},${y - 2} L${cx + 2.5},${y - 2} L${cx + 3.5},${y + 14} L${cx},${y + 18} L${cx - 3.5},${y + 14} Z`} fill={accent} />;
    if (collar === 'high') return <path d={`M${cx - 8},${y - 4} L${cx + 8},${y - 4} L${cx + 5},${y + 4} L${cx},${y + 1} L${cx - 5},${y + 4} Z`} fill="#f4f1ea" />;
    return <path d={`M${cx - 6},${y - 2} Q${cx},${y + 9} ${cx + 6},${y - 2} Q${cx + 3},${y + 14} ${cx},${y + 16} Q${cx - 3},${y + 14} ${cx - 6},${y - 2} Z`} fill={accent} />;
  })();

  return (
    <svg className={`q-portrait${dim ? ' is-dim' : ''} ${className ?? ''}`} width={size} height={size} viewBox="0 0 100 100"
      role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id={`bg${uid}`} cx="50%" cy="38%" r="70%">
          <stop offset="0%" stopColor={shade(accent, 0.45)} />
          <stop offset="100%" stopColor={shade(accent, -0.45)} />
        </radialGradient>
        <clipPath id={`cp${uid}`}><circle cx="50" cy="50" r="47" /></clipPath>
      </defs>
      <g clipPath={`url(#cp${uid})`}>
        <rect width="100" height="100" fill={`url(#bg${uid})`} />
        {bgPattern === 0 && <g stroke={shade(accent, 0.6)} strokeOpacity="0.18" strokeWidth="5">{Array.from({ length: 9 }, (_, i) => <line key={i} x1={i * 14 - 20} y1="0" x2={i * 14 + 20} y2="100" />)}</g>}
        {bgPattern === 1 && <g fill={shade(accent, 0.6)} fillOpacity="0.16">{Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return <path key={i} d={`M50,40 L${50 + Math.cos(a) * 80},${40 + Math.sin(a) * 80} L${50 + Math.cos(a + 0.22) * 80},${40 + Math.sin(a + 0.22) * 80} Z`} />; })}</g>}
        {bgPattern === 2 && <circle cx="50" cy="44" r="30" fill="none" stroke={shade(accent, 0.6)} strokeOpacity="0.22" strokeWidth="2" strokeDasharray="2 4" />}
        {hairBack}
        {/* shoulders / coat */}
        <path d={`M6,104 Q8,84 28,78 L${cx - 6},74 L${cx + 6},74 L72,78 Q92,84 94,104 Z`} fill={coat} />
        <path d={`M${cx - 9},76 L${cx},92 L${cx + 9},76 L${cx + 6},74 L${cx - 6},74 Z`} fill={cleric ? coat : '#efe9dc'} />
        <path d={`M28,79 L${cx - 9},76 L${cx - 2},100 L30,104 Z`} fill={shade(coat, 0.12)} />
        <path d={`M72,79 L${cx + 9},76 L${cx + 2},100 L70,104 Z`} fill={shade(coat, 0.12)} />
        {military && <g><rect x="16" y="80" width="16" height="4" rx="2" fill="#d9b44a" /><rect x="68" y="80" width="16" height="4" rx="2" fill="#d9b44a" /><circle cx="36" cy="93" r="3" fill="#d9b44a" /><path d="M34,88 L38,88 L36,91 Z" fill={accent} /></g>}
        {/* neck + head */}
        <rect x={cx - 6} y={cy + headRy - 8} width="12" height="14" fill={skinD} />
        {collarEl}
        <ellipse cx={cx - headRx + 0.5} cy={cy + 2} rx="3" ry="4.5" fill={skinD} />
        <ellipse cx={cx + headRx - 0.5} cy={cy + 2} rx="3" ry="4.5" fill={skinD} />
        {headPath ? <path d={headPath} fill={skin} /> : <ellipse cx={cx} cy={cy} rx={headRx} ry={headRy} fill={skin} />}
        <ellipse cx={cx + headRx * 0.45} cy={cy + 4} rx={headRx * 0.45} ry={headRy * 0.7} fill={skinD} opacity="0.18" />
        {age > 0.6 && <g stroke={skinD} strokeWidth="0.8" fill="none" opacity="0.8"><path d={`M${cx - 9},${cy - 9} Q${cx},${cy - 11} ${cx + 9},${cy - 9}`} /><path d={`M${cx - 8},${cy + 7} Q${cx - 9},${cy + 10} ${cx - 7},${cy + 12}`} /><path d={`M${cx + 8},${cy + 7} Q${cx + 9},${cy + 10} ${cx + 7},${cy + 12}`} /></g>}
        {/* face */}
        <g fill="#1b1410">
          <ellipse cx={cx - 6} cy={eyeY} rx="1.9" ry={md === 'sly' ? 1.1 : 1.8} />
          <ellipse cx={cx + 6} cy={eyeY} rx="1.9" ry={md === 'sly' ? 1.1 : 1.8} />
        </g>
        <circle cx={cx - 5.4} cy={eyeY - 0.6} r="0.55" fill="#fff" opacity="0.8" />
        <circle cx={cx + 6.6} cy={eyeY - 0.6} r="0.55" fill="#fff" opacity="0.8" />
        <g stroke={facial >= 0 || hairStyle !== 4 ? hairD : '#3a2a20'} strokeWidth="1.7" strokeLinecap="round">
          <line x1={cx - 9.5} y1={eyeY - 5 - browTilt * -0.5} x2={cx - 3} y2={eyeY - 5 + browTilt} />
          <line x1={cx + 9.5} y1={eyeY - 5 - browTilt * -0.5} x2={cx + 3} y2={eyeY - 5 + browTilt} />
        </g>
        <path d={`M${cx},${eyeY + 1} L${cx - 2.2},${cy + 8} L${cx + 1},${cy + 8.4}`} fill="none" stroke={skinD} strokeWidth="1.3" strokeLinejoin="round" />
        {fem && <g fill="#d26a6a" opacity="0.22"><circle cx={cx - 9} cy={cy + 7} r="3" /><circle cx={cx + 9} cy={cy + 7} r="3" /></g>}
        <path d={mouth} fill="none" stroke="#6b2f2a" strokeWidth="1.6" strokeLinecap="round" />
        {facialHair}
        {hairFront}
        {specs === 'round' && <g fill="none" stroke="#2a2420" strokeWidth="1.1"><circle cx={cx - 6} cy={eyeY} r="4.2" /><circle cx={cx + 6} cy={eyeY} r="4.2" /><line x1={cx - 1.8} y1={eyeY} x2={cx + 1.8} y2={eyeY} /></g>}
        {specs === 'monocle' && <g fill="none" stroke="#c9a54a" strokeWidth="1.1"><circle cx={cx + 6} cy={eyeY} r="4.4" /><path d={`M${cx + 10},${eyeY + 2} Q${cx + 14},${eyeY + 20} ${cx + 10},${eyeY + 34}`} strokeWidth="0.6" /></g>}
        {fem && !hat && r.next() < 0.4 && <circle cx={cx - headRx + 0.5} cy={cy + 7} r="1.6" fill="#e2c46b" />}
        {hatEl}
        {/* party rosette */}
        <circle cx="70" cy="90" r="4.2" fill={accent} stroke="#f4f1ea" strokeWidth="1" />
      </g>
      <circle cx="50" cy="50" r="47.5" className="q-portrait__ring" fill="none" strokeWidth="3" />
    </svg>
  );
});
