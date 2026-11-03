// PolTok election-night simulation engine. Owned by the Server agent.
//
// Deterministic (seeded PRNG), dependency-free, browser-safe (no fs, no process).
// Contract (see src/shared.d.ts):
//   createSimulation({ races, states, speed?, seed?, startAt?, loop? }) => {
//     start(): void; stop(): void;
//     snapshot(): { results, balance, markets, clock };
//     subscribe(fn: (ev: LiveEvent) => void): () => void;
//   }
//
// TIME MODEL
//   The simulated night runs 18:00 ET -> 02:00 ET (480 sim minutes). At speed=1 it plays out
//   over ~25 real minutes (19.2 sim minutes per real minute). `startAt` is the real epoch ms at
//   which the simulated clock reads 18:00 ET (default: creation time). State is a pure function
//   of elapsed time + seed, so two engines created with the same seed/startAt (e.g. server and a
//   browser fallback) show the same night. After 02:00 results are held; with `loop: true` the
//   night restarts after a pause with a new seed.
//
// MODEL
//   * Each race gets a latent true D-minus-R margin drawn around its rating plus a shared
//     national swing (correlated error).
//   * Vote is split into an early/mail bloc and an election-day bloc with different partisan
//     shares. States that count mail late (PA, WI, MI, ...) show a "red mirage" then a
//     "blue shift"; other states report early vote first ("blue mirage").
//   * Counting starts after the state's final poll close (StateInfo.pollClose, ET) and follows
//     an S-curve with a state-specific speed; races report in lumpy batches.
//   * The "needle" blends the pre-election prior with the (unknown to viewers) final outcome
//     as more vote is counted, and its uncertainty shrinks with expectedPct. Races are called
//     only when winProb > 0.995 and enough vote is in for the margin size.
//   * House seats not individually listed in `races` are modeled in aggregate as safe seats
//     (split by state partisanship to the 2024 baseline) so House totals sum to 435.

import * as DATA from './data/index.js';
const { SENATE_NOT_UP, HOUSE_TOTAL } = DATA;
/** Unlisted (safe) House seats by party, if the data layer provides them. */
const HOUSE_BASELINE = /** @type {any} */ (DATA).HOUSE_BASELINE;

/** @typedef {import('../src/types').Race} Race */
/** @typedef {import('../src/types').StateInfo} StateInfo */
/** @typedef {import('../src/types').RaceResult} RaceResult */
/** @typedef {import('../src/types').BalanceOfPower} BalanceOfPower */
/** @typedef {import('../src/types').Market} Market */
/** @typedef {import('../src/types').LiveEvent} LiveEvent */

export const NIGHT_START_MIN = 18 * 60; // 18:00 ET, in minutes after midnight
export const NIGHT_LENGTH_MIN = 8 * 60; // until 02:00 ET
export const REAL_NIGHT_MS = 25 * 60 * 1000; // at speed 1
export const DEFAULT_SEED = 20261103;
const HOLD_BEFORE_LOOP_MS = 5 * 60 * 1000; // real ms at speed 1
const SIM_MIN_PER_REAL_MS = NIGHT_LENGTH_MIN / REAL_NIGHT_MS;

// 2024 House baseline (post-2024 election): R 220, D 215.
const HOUSE_BASE_R = 220;
const SENATE_TOTAL = 100;
// VP (2025-2029) is a Republican, so Republicans control a 50-50 Senate.
const SENATE_D_NEEDS = 51;
const SENATE_R_NEEDS = 50;

const D_HEX = '#3d7bff';
const R_HEX = '#ff3d55';

const RATING_MODEL = {
  'Solid D': { mean: 20, sd: 6, priorSd: 6 },
  'Likely D': { mean: 8, sd: 3.5, priorSd: 5 },
  'Lean D': { mean: 4, sd: 3, priorSd: 4.5 },
  'Toss-up': { mean: 0, sd: 3.5, priorSd: 4.5 },
  'Lean R': { mean: -4, sd: 3, priorSd: 4.5 },
  'Likely R': { mean: -8, sd: 3.5, priorSd: 5 },
  'Solid R': { mean: -20, sd: 6, priorSd: 6 },
};

// States that process mail / early ballots late (or where late-counted ballots lean D).
const MAIL_LATE = new Set(['PA', 'WI', 'MI', 'NV', 'CA', 'AZ', 'NY', 'OR', 'WA', 'UT', 'AK', 'NJ', 'MD']);
// Minutes (sim) after close until half of the vote is counted.
const COUNT_T50 = {
  CA: 150, AK: 190, NV: 130, AZ: 120, OR: 110, WA: 110, UT: 100, PA: 95, WI: 85, MI: 85,
  NY: 90, NJ: 80, MD: 85, HI: 70, CO: 70, ME: 80,
};

/* ------------------------------------------------------------------------------------------ */
/* PRNG + helpers                                                                              */
/* ------------------------------------------------------------------------------------------ */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Deterministic uniform in [0,1) for (seed, key...). */
function hrand(seed, ...keys) {
  return mulberry32((seed ^ hashStr(keys.join('|'))) >>> 0)();
}

function gauss(rng) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));

/** Standard normal CDF (Abramowitz-Stegun 7.1.26). */
function phi(z) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

function parseClose(s) {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(s || ''));
  if (!m) return 20 * 60;
  let mins = +m[1] * 60 + +m[2];
  if (mins < 12 * 60) mins += 24 * 60; // after midnight (e.g. AK "01:00")
  return mins;
}

function fmtClock(minOfDay) {
  const m = ((Math.round(minOfDay) % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = String(m % 60).padStart(2, '0');
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm} ${h24 < 12 ? 'AM' : 'PM'} ET`;
}

const PARTY_NAME = { D: 'Democrat', R: 'Republican', I: 'Independent', L: 'Libertarian', G: 'Green', O: 'Other' };
const PARTY_PLURAL = { D: 'Democrats', R: 'Republicans' };

/** Poisson-binomial: probability that the sum of Bernoulli(p_i) >= k. */
/**
 * P(at least k successes) with a correlated national error: each uncalled seat's
 * probability is shifted together in logit space across a grid of swing scenarios.
 * Independent-seat math is badly overconfident early in the night.
 */
function correlatedAtLeast(ps, k, sd = 0.7) {
  const grid = [-2, -1.5, -1, -0.5, 0, 0.5, 1, 1.5, 2];
  let wsum = 0;
  let acc = 0;
  for (const z of grid) {
    const w = Math.exp(-0.5 * z * z);
    const shift = z * sd;
    const shifted = ps.map((p) => {
      if (p <= 0 || p >= 1) return p;
      const q = clamp(p, 1e-4, 1 - 1e-4);
      return 1 / (1 + Math.exp(-(Math.log(q / (1 - q)) + shift)));
    });
    acc += w * probAtLeast(shifted, k);
    wsum += w;
  }
  return acc / wsum;
}

function probAtLeast(ps, k) {
  if (k <= 0) return 1;
  if (k > ps.length) return 0;
  let dist = new Float64Array(ps.length + 1);
  dist[0] = 1;
  let n = 0;
  for (const p of ps) {
    n++;
    for (let j = n; j >= 1; j--) dist[j] = dist[j] * (1 - p) + dist[j - 1] * p;
    dist[0] *= 1 - p;
  }
  let s = 0;
  for (let j = k; j <= ps.length; j++) s += dist[j];
  return clamp(s, 0, 1);
}

/* ------------------------------------------------------------------------------------------ */
/* Engine                                                                                      */
/* ------------------------------------------------------------------------------------------ */

/**
 * @param {{ races: Race[]; states: StateInfo[]; speed?: number; seed?: number; startAt?: number; loop?: boolean }} opts
 */
export function createSimulation(opts) {
  const races = Array.isArray(opts?.races) ? opts.races : [];
  const states = Array.isArray(opts?.states) ? opts.states : [];
  const speed = Math.max(0.01, Number(opts?.speed) || 1);
  const baseSeed = (Number.isFinite(opts?.seed) ? Number(opts.seed) : DEFAULT_SEED) >>> 0;
  const loop = !!opts?.loop;
  const stateBy = new Map(states.map((s) => [s.abbr, s]));
  const notUp = normalizeNotUp(SENATE_NOT_UP);
  const houseTotal = Number(HOUSE_TOTAL) > 0 ? Number(HOUSE_TOTAL) : 435;

  /** @type {Set<(ev: LiveEvent) => void>} */
  const subs = new Set();
  let timer = null;
  let startAt = Number.isFinite(opts?.startAt) ? Number(opts.startAt) : Date.now();
  let cycle = 0;
  let world = buildWorld(baseSeed);

  function emit(ev) {
    for (const fn of subs) {
      try {
        fn(ev);
      } catch (e) {
        /* subscriber errors must not kill the engine */
      }
    }
  }

  /* ---------------------------------- world construction ---------------------------------- */

  function buildWorld(seed) {
    const rng = mulberry32(seed);
    const nationalSwing = gauss(rng) * 2.5; // + favors D
    const stateParams = new Map();
    const getState = (abbr) => {
      if (stateParams.has(abbr)) return stateParams.get(abbr);
      const info = stateBy.get(abbr);
      const r = mulberry32((seed ^ hashStr('state:' + abbr)) >>> 0);
      const close = parseClose(info?.pollClose);
      const t50 = (COUNT_T50[abbr] ?? 55 + r() * 20) * (0.9 + r() * 0.2);
      const p = {
        abbr,
        name: info?.name ?? abbr,
        close,
        t50,
        width: t50 / 3.2,
        fmax: 0.985 + r() * 0.012,
        delay: 3 + r() * 9, // sim min after close before first votes
        mailLate: MAIL_LATE.has(abbr),
        seats: info?.houseSeats ?? 5,
        turnoutScale: 0.85 + r() * 0.3,
        dLean: info?.pres2024 ? (info.pres2024.dem - info.pres2024.rep) : 0,
      };
      stateParams.set(abbr, p);
      return p;
    };

    const models = races.map((race, idx) => buildRace(race, idx, seed, rng, nationalSwing, getState));

    // Aggregate (unlisted) House seats.
    const listedHouse = models.filter((m) => m.race.chamber === 'house');
    const remaining = Math.max(0, houseTotal - listedHouse.length);
    const listedR = listedHouse.filter((m) => m.race.incumbentParty === 'R').length;
    let remR = HOUSE_BASELINE && Number.isFinite(HOUSE_BASELINE.R) && HOUSE_BASELINE.total === remaining
      ? HOUSE_BASELINE.R
      : clamp(HOUSE_BASE_R - listedR, 0, remaining);
    const virtual = buildVirtualSeats(remaining, remR, seed, listedHouse, getState);

    return { seed, nationalSwing, models, virtual, getState, stateParams };
  }

  function buildRace(race, idx, seed, rng, nationalSwing, getState) {
    const st = getState(race.state);
    const r = mulberry32((seed ^ hashStr('race:' + race.id)) >>> 0);
    const cands = Array.isArray(race.candidates) ? race.candidates : [];
    const rm = RATING_MODEL[race.rating] ?? RATING_MODEL['Toss-up'];

    // Identify the two main "sides": D-side (D, else I/other) and R-side.
    let left = cands.find((c) => c.party === 'D');
    let right = cands.find((c) => c.party === 'R');
    let sameParty = false;
    if (!left) left = cands.find((c) => c !== right && c.party !== 'R');
    if (!right) {
      right = cands.find((c) => c !== left);
      sameParty = !!right;
    }
    // Latent true margin (left minus right, points).
    let margin;
    let priorMean = rm.mean;
    if (sameParty) {
      margin = gauss(r) * 8;
      priorMean = 0;
    } else {
      let draw = rm.mean + gauss(r) * rm.sd + nationalSwing;
      if (Math.abs(rm.mean) >= 15) {
        // keep solid races solid
        const sign = Math.sign(rm.mean);
        draw = sign * Math.max(Math.abs(draw), 10 + r() * 6);
      }
      margin = draw;
    }

    // Shares: minor candidates get 0.6-3%.
    const shares = {};
    let minor = 0;
    for (const c of cands) {
      if (c === left || c === right) continue;
      const s = 0.6 + r() * 2.4;
      shares[c.id] = s;
      minor += s;
    }
    if (left && right) {
      shares[left.id] = clamp((100 - minor + margin) / 2, 1, 99);
      shares[right.id] = clamp((100 - minor - margin) / 2, 1, 99);
    } else if (left) {
      shares[left.id] = 100 - minor;
    }
    const sumS = Object.values(shares).reduce((a, b) => a + b, 0) || 1;
    for (const k in shares) shares[k] /= sumS;

    // Turnout.
    const isHouse = race.chamber === 'house';
    const perSeat = 290000 * st.turnoutScale;
    const total = Math.round(
      (isHouse ? perSeat * (0.75 + r() * 0.45) : perSeat * Math.max(1, st.seats) * (0.92 + r() * 0.12)) || 0,
    );

    // Early/mail bloc: mailFrac of the vote, D-side share shifted by `delta` points.
    const mailFrac = 0.22 + r() * 0.16; // < 0.4 keeps counting monotone
    const delta = (0.08 + r() * 0.08) * (sameParty ? 0 : 1);
    const mailShares = {};
    const edShares = {};
    for (const k in shares) {
      let m = shares[k];
      let e = shares[k];
      if (left && k === left.id) {
        m = shares[k] + delta / 2;
        e = shares[k] - (delta / 2) * (mailFrac / (1 - mailFrac));
      } else if (right && k === right.id) {
        m = shares[k] - delta / 2;
        e = shares[k] + (delta / 2) * (mailFrac / (1 - mailFrac));
      }
      mailShares[k] = Math.max(0.002, m);
      edShares[k] = Math.max(0.002, e);
    }
    normalize(mailShares);
    normalize(edShares);

    const winnerId = Object.keys(shares).sort((a, b) => shares[b] - shares[a])[0];
    const winner = cands.find((c) => c.id === winnerId);

    return {
      race,
      idx,
      st,
      cands,
      leftId: left?.id,
      rightId: right?.id,
      sameParty,
      trueMargin: margin,
      priorMean,
      priorSd: sameParty ? 8 : rm.priorSd,
      total,
      mailFrac,
      mailShares,
      edShares,
      winnerId,
      winnerParty: winner?.party,
      wobblePhase: r() * Math.PI * 2,
      wobbleAmp: 1 + r() * 2,
      cadence: 2 + r() * 5, // sim minutes between reporting batches
      uncontested: cands.length === 1,
      // mutable state
      called: null,
      calledAt: undefined,
      announcedTooEarly: false,
      lastKey: '',
      result: null,
    };
  }

  function buildVirtualSeats(n, nR, seed, listedHouse, getState) {
    const seats = [];
    if (n <= 0) return seats;
    // Distribute remaining seats among states by houseSeats minus listed seats.
    const listedByState = new Map();
    for (const m of listedHouse) listedByState.set(m.race.state, (listedByState.get(m.race.state) || 0) + 1);
    const pool = [];
    for (const s of states) {
      const free = Math.max(0, (s.houseSeats || 0) - (listedByState.get(s.abbr) || 0));
      for (let i = 0; i < free; i++) pool.push(s.abbr);
    }
    // Rank pool seats by state D lean so the most Democratic states get the D seats.
    const entries = [];
    for (let i = 0; i < n; i++) {
      const abbr = pool[i] ?? null;
      const st = abbr ? getState(abbr) : null;
      const u = hrand(seed, 'vseat', i);
      const lean = st ? st.dLean + (u - 0.5) * 40 : (u - 0.5) * 40;
      entries.push({ i, abbr, lean, u });
    }
    const order = [...entries].sort((a, b) => a.lean - b.lean);
    const partyOf = new Map();
    order.forEach((e, k) => partyOf.set(e.i, k < nR ? 'R' : 'D'));
    for (const e of entries) {
      const st = e.abbr ? getState(e.abbr) : null;
      const close = st ? st.close : 19 * 60 + e.u * 240;
      const late = st ? st.t50 / 55 : 1;
      seats.push({
        party: partyOf.get(e.i),
        state: e.abbr,
        callAt: close + 1 + hrand(seed, 'vcall', e.i) ** 2 * 80 * late,
      });
    }
    return seats;
  }

  /* --------------------------------------- clock ------------------------------------------ */

  function simMinute(now) {
    return ((now - startAt) * speed * SIM_MIN_PER_REAL_MS);
  }

  function clockInfo(now = Date.now()) {
    const m = clamp(simMinute(now), 0, NIGHT_LENGTH_MIN);
    const minOfDay = NIGHT_START_MIN + m;
    return {
      simMinute: m,
      et: fmtClock(minOfDay),
      progress: m / NIGHT_LENGTH_MIN,
      final: simMinute(now) >= NIGHT_LENGTH_MIN,
      speed,
      startAt,
      seed: world.seed,
    };
  }

  /* ------------------------------------ race state ---------------------------------------- */

  function countedFraction(m, t) {
    const st = m.st;
    const dt = t - st.close - st.delay;
    if (dt <= 0) return 0;
    const L = (x) => 1 / (1 + Math.exp(-(x - st.t50) / st.width));
    const l0 = L(0);
    return clamp((st.fmax * (L(dt) - l0)) / (1 - l0), 0, st.fmax);
  }

  /** Last reporting batch time <= t (lumpy updates). */
  function batchTime(m, t) {
    const start = m.st.close + m.st.delay;
    if (t <= start) return t;
    const k = Math.floor((t - start) / m.cadence);
    const jitter = hrand(world.seed, m.race.id, 'b', k) * m.cadence * 0.6;
    const bt = start + k * m.cadence + jitter;
    return bt <= t ? bt : start + Math.max(0, k - 1) * m.cadence;
  }

  function votesAt(m, f) {
    const T = m.total;
    const M = T * m.mailFrac;
    const E = T - M;
    const p = m.st.mailLate ? 2.5 : 0.5;
    let cm = Math.min(Math.pow(f, p), (T * f) / Math.max(1, M));
    let ce = (T * f - M * cm) / Math.max(1, E);
    if (ce > 1) {
      ce = 1;
      cm = (T * f - E) / Math.max(1, M);
    }
    const votes = {};
    for (const c of m.cands) {
      votes[c.id] = Math.round(M * cm * (m.mailShares[c.id] ?? 0) + E * ce * (m.edShares[c.id] ?? 0));
    }
    return votes;
  }

  /** Needle: returns { est, sd } for left-minus-right margin given counted fraction f. */
  function needle(m, f) {
    const w = 1 - Math.pow(1 - f, 1.3);
    const wobble = m.wobbleAmp * Math.sin(m.wobblePhase + f * 9) * (1 - f);
    const est = m.priorMean * (1 - w) + m.trueMargin * w + wobble;
    const sd = m.priorSd * Math.pow(1 - f, 0.9) + 0.25;
    return { est, sd };
  }

  function computeResult(m, t, now) {
    const race = m.race;
    const closed = t >= m.st.close;
    const bt = closed ? batchTime(m, t) : t;
    const f = closed ? countedFraction(m, bt) : 0;
    const expectedPct = Math.round(f * 1000) / 10;
    const votes = votesAt(m, f);
    const winProb = {};
    let leaderId = m.winnerId;
    let leaderP = 1;

    if (m.uncontested) {
      winProb[m.cands[0].id] = 1;
    } else if (m.leftId && m.rightId) {
      const { est, sd } = needle(m, f);
      const pLeft = clamp(phi(est / sd), 0.0005, 0.9995);
      const minorIds = m.cands.filter((c) => c.id !== m.leftId && c.id !== m.rightId);
      const minorP = minorIds.length ? 0.001 : 0;
      for (const c of minorIds) winProb[c.id] = minorP;
      const rest = 1 - minorP * minorIds.length;
      winProb[m.leftId] = round4(pLeft * rest);
      winProb[m.rightId] = round4((1 - pLeft) * rest);
      leaderId = pLeft >= 0.5 ? m.leftId : m.rightId;
      leaderP = Math.max(pLeft, 1 - pLeft);
      // Call rule: > 0.995 and enough of the vote in for this margin size.
      const minPct = Math.max(0, 75 - 4 * Math.abs(est));
      if (
        !m.called &&
        closed &&
        leaderP > 0.995 &&
        expectedPct >= minPct &&
        leaderId === m.winnerId // networks don't retract: only call the eventual winner
      ) {
        m.called = leaderId;
        m.calledAt = now;
        m.justCalled = true;
      }
    }
    if (m.uncontested && closed && !m.called) {
      m.called = m.cands[0].id;
      m.calledAt = now;
      m.justCalled = true;
    }

    let status;
    if (m.called) status = 'called';
    else if (!closed) status = 'not-started';
    else if (f <= 0) status = 'polls-closed';
    else if (f >= 0.95 || t >= NIGHT_LENGTH_MIN + NIGHT_START_MIN - 1) status = 'too-close';
    else status = 'counting';

    if (m.called) {
      for (const k in winProb) winProb[k] = k === m.called ? 1 : 0;
    }

    /** @type {RaceResult} */
    const res = {
      raceId: race.id,
      votes,
      expectedPct,
      winProb,
      updatedAt: now,
      status,
      reportingNote: !closed
        ? `Polls close ${fmtClock(m.st.close)}`
        : f <= 0
          ? 'Polls closed · awaiting first results'
          : `~${Math.round(expectedPct)}% of expected vote counted${
              m.st.mailLate && f < 0.8 ? ' · mail ballots still being counted' : ''
            }`,
    };
    if (m.called) {
      res.calledFor = m.called;
      res.calledAt = m.calledAt;
    }
    return res;
  }

  /* ----------------------------------- balance of power ----------------------------------- */

  function computeBalance(t) {
    /** @type {BalanceOfPower[]} */
    const out = [];
    // Senate
    {
      const sen = world.models.filter((m) => m.race.chamber === 'senate');
      let dem = notUp.D;
      let rep = notUp.R;
      let ind = notUp.I;
      let projD = notUp.D + notUp.I;
      let projR = notUp.R;
      const dProbs = [];
      for (const m of sen) {
        const res = m.result;
        const leftParty = partyOf(m, m.leftId);
        const rightParty = partyOf(m, m.rightId);
        if (m.called) {
          const p = partyOf(m, m.called);
          if (p === 'D') dem++;
          else if (p === 'R') rep++;
          else ind++;
        }
        // Probability the seat goes to the D caucus (D or I).
        let pD = 0;
        for (const c of m.cands) {
          const pr = res?.winProb?.[c.id] ?? 0;
          if (c.party === 'D' || c.party === 'I') pD += pr;
        }
        if (!res) pD = leftParty === 'D' || leftParty === 'I' ? 0.5 : rightParty === 'R' ? 0 : 0.5;
        dProbs.push(clamp(pD, 0, 1));
        projD += pD;
        projR += 1 - pD;
      }
      const accounted = notUp.D + notUp.R + notUp.I + sen.length;
      const unknown = Math.max(0, SENATE_TOTAL - accounted);
      for (let i = 0; i < unknown; i++) dProbs.push(0.5);
      projD += unknown / 2;
      projR += unknown / 2;
      const baseD = notUp.D + notUp.I;
      const pDcontrol = correlatedAtLeast(dProbs, SENATE_D_NEEDS - baseD);
      out.push({
        chamber: 'senate',
        total: SENATE_TOTAL,
        majority: SENATE_D_NEEDS,
        dem,
        rep,
        ind,
        undecided: Math.max(0, SENATE_TOTAL - dem - rep - ind),
        projected: { dem: Math.round(projD), rep: Math.round(projR) },
        controlProb: { D: round4(pDcontrol), R: round4(1 - pDcontrol) },
      });
    }
    // House
    {
      const hs = world.models.filter((m) => m.race.chamber === 'house');
      let dem = 0;
      let rep = 0;
      let ind = 0;
      let projD = 0;
      let projR = 0;
      const dProbs = [];
      for (const m of hs) {
        if (m.called) {
          const p = partyOf(m, m.called);
          if (p === 'D') dem++;
          else if (p === 'R') rep++;
          else ind++;
        }
        let pD = 0;
        for (const c of m.cands) if (c.party === 'D') pD += m.result?.winProb?.[c.id] ?? 0;
        if (!m.result) pD = 0.5;
        dProbs.push(clamp(pD, 0, 1));
        projD += pD;
        projR += 1 - pD;
      }
      for (const v of world.virtual) {
        if (t >= v.callAt) {
          if (v.party === 'D') dem++;
          else rep++;
        }
        const pD = v.party === 'D' ? 0.985 : 0.015;
        dProbs.push(pD);
        projD += pD;
        projR += 1 - pD;
      }
      const majority = Math.floor(houseTotal / 2) + 1;
      const pDcontrol = correlatedAtLeast(dProbs, majority);
      out.push({
        chamber: 'house',
        total: houseTotal,
        majority,
        dem,
        rep,
        ind,
        undecided: Math.max(0, houseTotal - dem - rep - ind),
        projected: { dem: Math.round(projD), rep: Math.round(projR) },
        controlProb: { D: round4(pDcontrol), R: round4(1 - pDcontrol) },
      });
    }
    return out;
  }

  /* -------------------------------------- markets ----------------------------------------- */

  const marketState = new Map(); // id -> { p, history }

  function marqueeModels() {
    const prefer = (m) =>
      (m.race.key ? 0 : 10) +
      (m.race.chamber === 'senate' ? 0 : m.race.chamber === 'governor' ? 1 : 3) +
      Math.abs(RATING_MODEL[m.race.rating]?.mean ?? 0) / 2;
    return world.models
      .filter((m) => m.leftId && m.rightId && !m.uncontested)
      .slice()
      .sort((a, b) => prefer(a) - prefer(b) || a.idx - b.idx)
      .slice(0, 3);
  }

  function seedHistory(id, p0, now) {
    // Synthetic pre-election drift (labelled simulated): 48 hourly points before startAt.
    const r = mulberry32((world.seed ^ hashStr('mh:' + id)) >>> 0);
    const pts = [];
    let p = p0;
    for (let i = 0; i < 48; i++) {
      pts.push({ t: startAt - i * 3600_000, p: round4(p) });
      p = clamp(p + (r() - 0.5) * 0.03, 0.03, 0.97);
    }
    pts.reverse();
    return pts.filter((x) => x.t <= now);
  }

  function updateMarkets(balance, now, appendHistory) {
    const sen = balance.find((b) => b.chamber === 'senate');
    const house = balance.find((b) => b.chamber === 'house');
    /** @type {{id:string;question:string;dLabel:string;rLabel:string;model:number;dColor:string;rColor:string}[]} */
    const defs = [
      { id: 'house-control', question: 'Which party will win the House?', dLabel: 'Democrats', rLabel: 'Republicans', model: house?.controlProb?.D ?? 0.5, dColor: D_HEX, rColor: R_HEX },
      { id: 'senate-control', question: 'Which party will win the Senate?', dLabel: 'Democrats', rLabel: 'Republicans', model: sen?.controlProb?.D ?? 0.5, dColor: D_HEX, rColor: R_HEX },
    ];
    for (const m of marqueeModels()) {
      const l = m.cands.find((c) => c.id === m.leftId);
      const r = m.cands.find((c) => c.id === m.rightId);
      const lp = l?.party ?? 'D';
      const rp = r?.party ?? 'R';
      defs.push({
        id: `race-${m.race.id}`,
        question: `Who will win the ${m.race.title}?`,
        dLabel: l ? `${l.name} (${lp})` : 'D',
        rLabel: r ? `${r.name} (${rp})` : 'R',
        model: m.result?.winProb?.[m.leftId] ?? 0.5,
        dColor: lp === 'I' ? '#a96bff' : lp === 'R' ? R_HEX : D_HEX,
        rColor: rp === 'D' ? D_HEX : rp === 'I' ? '#a96bff' : R_HEX,
      });
    }
    /** @type {Market[]} */
    const markets = [];
    for (const d of defs) {
      let s = marketState.get(d.id);
      if (!s) {
        const p0 = clamp(d.model + (hrand(world.seed, d.id, 'bias') - 0.5) * 0.08, 0.03, 0.97);
        s = { p: p0, history: seedHistory(d.id, p0, now), lastT: 0 };
        marketState.set(d.id, s);
      }
      if (appendHistory) {
        // Traders lag/overshoot the model a little.
        const noise = (hrand(world.seed, d.id, now) - 0.5) * 0.02;
        const target = clamp(d.model, 0.005, 0.995);
        s.p = clamp(s.p + (target - s.p) * 0.35 + noise, 0.005, 0.995);
        if (now - s.lastT >= 1000) {
          s.history.push({ t: now, p: round4(s.p) });
          if (s.history.length > 240) s.history.splice(0, s.history.length - 240);
          s.lastT = now;
        }
      }
      markets.push({
        id: d.id,
        question: d.question,
        outcomes: [
          { label: d.dLabel, prob: round4(s.p), color: d.dColor },
          { label: d.rLabel, prob: round4(1 - s.p), color: d.rColor },
        ],
        source: 'Market odds (simulated)',
        history: s.history.slice(),
      });
    }
    return markets;
  }

  /* ---------------------------------------- tick ------------------------------------------ */

  let balance = [];
  let markets = [];
  let announcedCloses = new Set();
  let announcedControl = new Set();
  let lastBalanceKey = '';
  let lastMarketsAt = 0;
  let lastLeadTickerAt = -1e9;
  let started = false;
  let finalAnnounced = false;

  function step(now, silent) {
    const tRel = simMinute(now);
    const t = NIGHT_START_MIN + clamp(tRel, 0, NIGHT_LENGTH_MIN);
    const changed = [];
    const calls = [];
    const tickers = [];

    // Poll-closing announcements.
    const closings = new Map();
    for (const s of states) {
      const c = world.getState(s.abbr).close;
      if (!closings.has(c)) closings.set(c, []);
      closings.get(c).push(s.abbr);
    }
    for (const m of world.models) {
      if (!closings.has(m.st.close)) closings.set(m.st.close, []);
      if (!closings.get(m.st.close).includes(m.st.abbr)) closings.get(m.st.close).push(m.st.abbr);
    }
    for (const [c, list] of [...closings.entries()].sort((a, b) => a[0] - b[0])) {
      if (t >= c && !announcedCloses.has(c)) {
        announcedCloses.add(c);
        const shown = list.slice(0, 8).join(', ') + (list.length > 8 ? '…' : '');
        tickers.push({ text: `${fmtClock(c)} — Polls close in ${shown}`, level: 'alert' });
      }
    }

    for (const m of world.models) {
      const res = computeResult(m, t, now);
      const key = `${res.status}|${res.expectedPct}|${res.calledFor ?? ''}|${Object.values(res.winProb).join(',')}`;
      if (key !== m.lastKey) {
        m.lastKey = key;
        m.result = res;
        changed.push(res);
      } else if (!m.result) m.result = res;

      if (m.justCalled) {
        m.justCalled = false;
        const cand = m.cands.find((c) => c.id === m.called);
        const party = cand?.party ?? 'O';
        const flip = party !== m.race.incumbentParty;
        calls.push({ type: 'call', raceId: m.race.id, candidateId: m.called, party, flip, at: now });
        const important = m.race.key || m.race.chamber !== 'house' || flip;
        if (important) {
          tickers.push({
            text: `${flip ? 'FLIP — ' : ''}PROJECTION: ${cand?.name ?? 'TBD'} (${party}) wins the ${m.race.title}${
              flip ? `, a pickup for ${PARTY_PLURAL[party] ?? PARTY_NAME[party] ?? party}` : ''
            }`,
            level: flip || m.race.key ? 'breaking' : 'alert',
          });
        }
      } else if (
        !m.called &&
        !m.announcedTooEarly &&
        t >= m.st.close &&
        (m.race.key || m.race.chamber === 'senate')
      ) {
        m.announcedTooEarly = true;
        tickers.push({ text: `${m.race.title}: Too early to call`, level: 'info' });
      }
    }

    // Periodic "leader" ticker for a counting key race (every ~20 sim minutes).
    if (t - lastLeadTickerAt >= 20) {
      const counting = world.models.filter(
        (m) => m.result?.status === 'counting' && (m.race.key || m.race.chamber === 'senate') && m.leftId && m.rightId,
      );
      if (counting.length) {
        lastLeadTickerAt = t;
        const m = counting[Math.floor(hrand(world.seed, 'lead', Math.floor(t)) * counting.length)];
        const v = m.result.votes;
        const tot = Object.values(v).reduce((a, b) => a + b, 0) || 1;
        const [a, b] = [m.leftId, m.rightId].sort((x, y) => v[y] - v[x]);
        const lead = ((v[a] - v[b]) / tot) * 100;
        const ca = m.cands.find((c) => c.id === a);
        tickers.push({
          text: `${m.race.title}: ${ca?.name ?? 'TBD'} (${ca?.party}) leads by ${lead.toFixed(1)} pts with ~${Math.round(
            m.result.expectedPct,
          )}% in`,
          level: 'info',
        });
      }
    }

    // Balance.
    balance = computeBalance(t);
    const bKey = balance.map((b) => `${b.dem}/${b.rep}/${b.ind}/${b.projected?.dem}/${b.controlProb?.D}`).join('|');
    const balanceChanged = bKey !== lastBalanceKey;
    lastBalanceKey = bKey;
    for (const b of balance) {
      for (const [p, seats] of [['D', b.dem + (b.chamber === 'senate' ? b.ind : 0)], ['R', b.rep]]) {
        const need = b.chamber === 'senate' ? (p === 'D' ? SENATE_D_NEEDS : SENATE_R_NEEDS) : b.majority;
        const k = `${b.chamber}:${p}`;
        if (seats >= need && !announcedControl.has(k) && (b.chamber !== 'senate' || races.some((r) => r.chamber === 'senate'))) {
          announcedControl.add(k);
          tickers.push({
            text: `PROJECTION: ${PARTY_PLURAL[p]} will control the ${b.chamber === 'senate' ? 'Senate' : 'House'}`,
            level: 'breaking',
          });
        }
      }
    }

    // Markets (every ~2s real).
    const marketsDue = now - lastMarketsAt >= 2000 || !markets.length;
    if (marketsDue) {
      markets = updateMarkets(balance, now, started);
      lastMarketsAt = now;
    }

    if (tRel >= NIGHT_LENGTH_MIN && !finalAnnounced) {
      finalAnnounced = true;
      const open = world.models.filter((m) => !m.called).length;
      tickers.push({
        text: `${fmtClock(NIGHT_START_MIN + NIGHT_LENGTH_MIN)} — Simulation complete. ${open} race${open === 1 ? '' : 's'} still too close to call.`,
        level: 'info',
      });
    }

    if (silent) return;
    if (changed.length) emit({ type: 'results', results: changed });
    for (const c of calls) emit(c);
    if (balanceChanged) emit({ type: 'balance', balance });
    if (marketsDue) emit({ type: 'markets', markets });
    for (const tk of tickers) emit({ type: 'ticker', text: tk.text, level: tk.level });
  }

  function resetForLoop(now) {
    cycle++;
    startAt = now;
    world = buildWorld((baseSeed + cycle * 7919) >>> 0);
    marketState.clear();
    announcedCloses = new Set();
    announcedControl = new Set();
    lastBalanceKey = '';
    lastMarketsAt = 0;
    lastLeadTickerAt = -1e9;
    finalAnnounced = false;
    emit({ type: 'ticker', text: 'Simulation restarting — a new election night begins (simulated results)', level: 'info' });
  }

  function tick() {
    const now = Date.now();
    if (loop && simMinute(now) >= NIGHT_LENGTH_MIN + (HOLD_BEFORE_LOOP_MS * SIM_MIN_PER_REAL_MS * speed)) {
      resetForLoop(now);
    }
    step(now, false);
  }

  // Initial state (catch up silently if startAt is in the past).
  {
    const now = Date.now();
    step(now, true);
    for (const m of world.models) m.justCalled = false;
  }

  return {
    start() {
      if (timer) return;
      started = true;
      if (simMinute(Date.now()) < 1) {
        emit({
          type: 'ticker',
          text: 'Election night 2026 (simulated): results begin as polls close — first closings 6:00 PM ET',
          level: 'info',
        });
      }
      const interval = speed >= 20 ? 100 : speed >= 4 ? 250 : 1000;
      tick();
      timer = setInterval(tick, interval);
    },
    stop() {
      if (timer) clearInterval(timer);
      timer = null;
    },
    snapshot() {
      return {
        results: world.models.map((m) => m.result).filter(Boolean),
        balance,
        markets,
        clock: clockInfo(),
      };
    },
    subscribe(fn) {
      subs.add(fn);
      return () => {
        subs.delete(fn);
      };
    },
    /** Simulated Eastern-time clock (extra; not in the base contract). */
    clock: clockInfo,
  };
}

/* ------------------------------------------------------------------------------------------ */

function normalize(o) {
  const s = Object.values(o).reduce((a, b) => a + b, 0) || 1;
  for (const k in o) o[k] /= s;
}

function round4(x) {
  return Math.round(x * 10000) / 10000;
}

function partyOf(m, id) {
  return m.cands.find((c) => c.id === id)?.party;
}

function normalizeNotUp(x) {
  const o = x && typeof x === 'object' ? x : {};
  return { D: Number(o.D) || 0, R: Number(o.R) || 0, I: Number(o.I) || 0 };
}
