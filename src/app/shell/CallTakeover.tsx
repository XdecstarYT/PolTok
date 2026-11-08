/**
 * Full-screen "race call" moment: the state's outline draws itself, floods with the
 * winner's party color from its center, shockwave rings and a particle burst fire,
 * then the winner card (real AP/NYT headshot), vote share and a CALLED stamp land.
 */
import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'framer-motion';
import { useLive } from '../../lib/live';
import { raceById, stateByAbbr } from '../../data';
import { PARTY_HEX, PARTY_NAME } from '../../lib/format';
import type { RaceCallEvent } from '../../types';
import { Avatar, SimBadge, fmtET } from '../../components';

const W = 520;
const H = 420;
type Shape = { d: string; cx: number; cy: number };
const shapeCache = new Map<string, Shape | null>();

function useStateShape(abbr: string | undefined) {
  const [shape, setShape] = useState<Shape | null>(abbr ? shapeCache.get(abbr) ?? null : null);
  useEffect(() => {
    if (!abbr) return;
    if (shapeCache.has(abbr)) return setShape(shapeCache.get(abbr) ?? null);
    let alive = true;
    import('../../features/map/geometry').then(({ stateShape }) => {
      const s = stateShape(abbr, W, H, 18);
      shapeCache.set(abbr, s);
      if (alive) setShape(s);
    });
    return () => {
      alive = false;
    };
  }, [abbr]);
  return shape;
}

/** Deterministic particle field (angle, distance, size, delay). */
function particles(seed: string, n = 34) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  const rnd = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0), (h % 10000) / 10000);
  return Array.from({ length: n }, (_, i) => ({
    a: (i / n) * Math.PI * 2 + rnd() * 0.4,
    r: 120 + rnd() * 220,
    s: 2 + rnd() * 4,
    d: rnd() * 0.25,
  }));
}

export function CallTakeover({ call, reduce, onClose, durationMs }: { call: RaceCallEvent; reduce: boolean; onClose: () => void; durationMs: number }) {
  const { results } = useLive();
  const race = raceById.get(call.raceId);
  const cand = race?.candidates.find((c) => c.id === call.candidateId);
  const color = PARTY_HEX[call.party] ?? '#8b93a7';
  const shape = useStateShape(race?.state);
  const res = results[call.raceId];
  const parts = useMemo(() => particles(call.raceId), [call.raceId]);

  const share = useMemo(() => {
    if (!res) return null;
    const total = Object.values(res.votes).reduce((a, b) => a + b, 0);
    if (!total) return null;
    const ranked = Object.entries(res.votes).sort((a, b) => b[1] - a[1]);
    const mine = (res.votes[call.candidateId] ?? 0) / total;
    const other = ranked.find(([id]) => id !== call.candidateId);
    const margin = mine - (other ? other[1] / total : 0);
    return { pct: mine * 100, margin: margin * 100, expected: res.expectedPct };
  }, [res, call.candidateId]);

  const kicker = call.preview
    ? 'ANIMATION PREVIEW · NOT A REAL CALL'
    : call.flip
    ? `${call.party === 'D' ? 'DEMOCRATIC' : call.party === 'R' ? 'REPUBLICAN' : 'INDEPENDENT'} PICKUP`
    : race?.key
      ? 'KEY RACE ALERT'
      : 'RACE CALL';
  const stateName = race ? stateByAbbr.get(race.state)?.name ?? race.state : '';
  const t0 = reduce ? 0 : 1; // multiply delays by 0 when motion is reduced

  return (
    <m.div
      className={`ct ${call.flip ? 'is-flip' : ''}`}
      role="alertdialog"
      aria-live="assertive"
      aria-label={`Race call: ${cand?.name ?? PARTY_NAME[call.party]} wins ${race?.title ?? call.raceId}`}
      style={{ '--ct': color } as CSSProperties}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: reduce ? 0 : 0.4 } }}
      onClick={onClose}
    >
      <m.div className="ct__bloom" initial={reduce ? false : { scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.75 * t0, duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }} />
      <div className="ct__grid" aria-hidden="true" />
      {call.flip && !reduce && <div className="ct__glitch" aria-hidden="true" />}

      <div className="ct__inner" onClick={(e) => e.stopPropagation()}>
        <div className="ct__stage" aria-hidden="true">
          <svg viewBox={`0 0 ${W} ${H}`} className="ct__svg">
            <defs>
              <radialGradient id="ct-fill" cx="50%" cy="45%" r="75%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.22" />
                <stop offset="35%" stopColor={color} />
                <stop offset="100%" stopColor={color} stopOpacity="0.75" />
              </radialGradient>
              {shape && (
                <clipPath id="ct-clip">
                  <path d={shape.d} />
                </clipPath>
              )}
              <filter id="ct-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur stdDeviation="10" result="b" />
                <feMerge>
                  <feMergeNode in="b" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {shape && (
              <>
                {/* flood fill from the center, clipped to the state */}
                <g clipPath="url(#ct-clip)">
                  <rect width={W} height={H} fill="rgba(255,255,255,0.04)" />
                  <m.circle
                    cx={shape.cx}
                    cy={shape.cy}
                    fill="url(#ct-fill)"
                    initial={reduce ? { r: 600 } : { r: 0 }}
                    animate={{ r: 600 }}
                    transition={{ delay: 0.7 * t0, duration: 0.85, ease: [0.5, 0, 0.2, 1] }}
                  />
                  {!reduce &&
                    [0, 1, 2].map((i) => (
                      <m.circle
                        key={i}
                        cx={shape.cx}
                        cy={shape.cy}
                        fill="none"
                        stroke="#fff"
                        strokeOpacity={0.35}
                        initial={{ r: 0, strokeWidth: 10 }}
                        animate={{ r: 420, strokeWidth: 0 }}
                        transition={{ delay: 1.5 + i * 0.6, duration: 1.8, repeat: Infinity, repeatDelay: 0.2, ease: 'easeOut' }}
                      />
                    ))}
                </g>
                {/* outline draws itself */}
                <m.path
                  d={shape.d}
                  fill="none"
                  stroke="#fff"
                  strokeWidth={3}
                  strokeLinejoin="round"
                  filter="url(#ct-glow)"
                  initial={reduce ? false : { pathLength: 0, opacity: 1 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.8, ease: [0.6, 0, 0.3, 1] }}
                />
                {/* shockwaves */}
                {!reduce &&
                  [0, 0.18, 0.36].map((d, i) => (
                    <m.circle
                      key={i}
                      cx={shape.cx}
                      cy={shape.cy}
                      fill="none"
                      stroke={i === 1 ? '#fff' : color}
                      initial={{ r: 4, opacity: 0.95, strokeWidth: 6 }}
                      animate={{ r: 330, opacity: 0, strokeWidth: 0.5 }}
                      transition={{ delay: 1.45 + d, duration: 1.3, ease: 'easeOut' }}
                    />
                  ))}
                {/* particle burst */}
                {!reduce &&
                  parts.map((p, i) => (
                    <m.circle
                      key={i}
                      r={p.s}
                      fill={i % 3 === 0 ? '#fff' : color}
                      initial={{ cx: shape.cx, cy: shape.cy, opacity: 1 }}
                      animate={{ cx: shape.cx + Math.cos(p.a) * p.r, cy: shape.cy + Math.sin(p.a) * p.r, opacity: 0 }}
                      transition={{ delay: 1.45 + p.d, duration: 1.1, ease: [0.1, 0.8, 0.3, 1] }}
                    />
                  ))}
              </>
            )}
          </svg>
          <m.div
            className="ct__check"
            initial={reduce ? false : { scale: 0, rotate: -40 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ delay: 1.5 * t0, type: 'spring', stiffness: 420, damping: 14 }}
          >
            ✓
          </m.div>
        </div>

        <div className="ct__copy">
          <m.div className="ct__kicker" initial={reduce ? false : { x: -24, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ delay: 0.25 * t0 }}>
            <span className="ct__dot" aria-hidden="true" />
            {kicker}
          </m.div>
          <m.div className="ct__state" initial={reduce ? false : { y: 30, opacity: 0, filter: 'blur(8px)' }} animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }} transition={{ delay: 0.35 * t0, duration: 0.5 }}>
            {stateName}
          </m.div>
          <m.div className="ct__office" initial={reduce ? false : { y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 * t0 }}>
            {race ? race.title.replace(stateName, '').trim() || race.title : call.raceId}
          </m.div>

          <m.div className="ct__winner" initial={reduce ? false : { y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 1.6 * t0, type: 'spring', stiffness: 200, damping: 20 }}>
            {cand && <Avatar name={cand.name} party={call.party} src={cand.photo} size={84} />}
            <div className="ct__who">
              <div className="ct__label">{call.preview ? 'Preview only' : 'Projected winner'}</div>
              <div className="ct__name">{cand?.name ?? PARTY_NAME[call.party]}</div>
              <div className="ct__meta">
                {PARTY_NAME[call.party]}
                {share && (
                  <>
                    {' · '}
                    <b className="num">{share.pct.toFixed(1)}%</b> · +{share.margin.toFixed(1)} · {Math.round(share.expected)}% in
                  </>
                )}
              </div>
            </div>
          </m.div>

          {!call.preview && <m.div
            className="ct__stamp"
            initial={reduce ? false : { scale: 2.6, opacity: 0, rotate: -18 }}
            animate={{ scale: 1, opacity: 1, rotate: -7 }}
            transition={{ delay: 1.9 * t0, type: 'spring', stiffness: 420, damping: 15 }}
          >
            {call.flip ? 'FLIP' : 'CALLED'}
          </m.div>}

          <m.div className="ct__actions" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.1 * t0 }}>
            <Link to={`/race/${call.raceId}`} className="btn btn--sm" onClick={onClose}>
              Open race →
            </Link>
            <button type="button" className="btn btn--ghost btn--sm" onClick={onClose} autoFocus>
              Dismiss
            </button>
            <span className="ct__time num">{fmtET(call.at)}</span>
            <SimBadge />
          </m.div>
        </div>
      </div>
      {!reduce && <m.div className="ct__timer" initial={{ scaleX: 1 }} animate={{ scaleX: 0 }} transition={{ duration: durationMs / 1000, ease: 'linear' }} />}
    </m.div>
  );
}
