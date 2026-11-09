// node --test tests/ — QUORUM engine: seats (D'Hondt), vote forecast vs roll call, budget, events,
// a full 24-turn bot game, determinism/save round-trip, and a 200-game balance smoke test.
// The engine is TypeScript; esbuild (already installed with Vite) bundles it to a temp ESM file.
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSync } from 'esbuild';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const outfile = join(mkdtempSync(join(tmpdir(), 'quorum-')), 'engine.mjs');
buildSync({ entryPoints: [join(root, 'src/features/play/engine/index.ts')], bundle: true, format: 'esm', platform: 'neutral', outfile, logLevel: 'error' });
const E = await import(pathToFileURL(outfile).href);

const sumSeats = (seats) => Object.values(seats).reduce((a, b) => a + b, 0);
function rng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) >>> 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const step = (s, a) => {
  const r = E.apply(s, a);
  assert.notEqual(r.log[0]?.kind, 'error', `${JSON.stringify(a)}: ${r.log[0]?.text}`);
  return r.state;
};
/** Put the state into the actions phase with no pending event (for focused tests). */
function actionsState(seed = 1, opts = {}) {
  let s = E.newGame({ seed, ...opts });
  if (s.phase === 'coalition') s = step(s, { type: s.pendingCoalition.kind === 'form' ? 'formCoalition' : 'answerOffer', ...(s.pendingCoalition.kind === 'form' ? { partners: [] } : { accept: false }) });
  return s;
}

// ---------------------------------------------------------------- bots
function randomBot(s, r) {
  const acts = E.listAvailableActions(s);
  if (s.phase === 'actions' && r() < (s.ap === 0 ? 0.7 : 0.15)) return { type: 'endTurn' };
  const pool = acts.filter((a) => a.type !== 'endTurn' && a.type !== 'setStance');
  return (pool.length ? pool : acts)[Math.floor(r() * (pool.length ? pool.length : acts.length))];
}
/** A "reasonable player": courts its base, drafts popular affordable laws that will pass,
 *  whips close votes, votes down costly rival bills, campaigns in big regions, takes any government. */
function smartBot(s, r) {
  if (s.phase === 'event') {
    const val = (c) => { const ch = E.eventChoice(s, s.pendingEvent, c); return Object.values(ch.groupEffects).reduce((a, b) => a + b, 0) + ch.treasury * 0.2; };
    return { type: 'resolveEvent', choice: val(0) >= val(1) ? 0 : 1 };
  }
  if (s.phase === 'coalition') {
    if (s.pendingCoalition.kind === 'offer') return { type: 'answerOffer', accept: true };
    return E.listAvailableActions(s).reduce((a, b) => (b.partners.length && (!a.partners.length || b.partners.length < a.partners.length) ? b : a));
  }
  for (const d of s.docket) {
    if (d.proposer === 'player' || d.kind !== 'enact') continue;
    const l = E.LAWS[d.lawId];
    const want = (E.budget(s).net - l.upkeep < 0 || s.debt > 60) && l.upkeep > 0 ? 'no' : d.playerStance;
    if (want !== d.playerStance) return { type: 'setStance', itemId: d.id, stance: want };
  }
  for (const d of s.docket) {
    const f = E.forecastVote(s, d.id);
    if (d.proposer === 'player' && !f.passes && s.politicalCapital >= 1) {
      const w = f.blocs.find((b) => (b.stance === 'abstain' || b.rebels > 0) && !b.whipped);
      if (w) return { type: 'whip', itemId: d.id, party: w.party };
    }
  }
  if (s.ap > 0) {
    if (!s.docket.some((d) => d.proposer === 'player')) {
      const net = E.budget(s).net;
      const laws = E.draftableLaws(s)
        .filter((l) => E.validate(s, { type: 'draft', lawId: l.id }) === null)
        .map((l) => ({ l, f: E.forecastVote(s, l.id), gain: Object.entries(l.groupEffects).reduce((a, [g, v]) => a + v * (s.approval[g] > 40 ? 1 : 0.5), 0) }))
        .filter((x) => x.f.passes && x.gain > 0 && (net - x.l.upkeep > 5 || x.l.upkeep < 0));
      if (laws.length) {
        const val = (x) => x.gain - (s.debt > 0 ? x.l.upkeep * 3 : 0);
        laws.sort((a, b) => val(b) - val(a));
        return { type: 'draft', lawId: laws[0].l.id };
      }
    }
    const inGov = E.playerInGovernment(s);
    if ((inGov ? s.treasury >= 40 : s.partyFunds >= 10) && r() < 0.6) {
      const regs = [...E.REGION_IDS].sort((a, b) => E.REGIONS[b].seats - E.REGIONS[a].seats);
      return { type: 'campaign', regionId: regs[Math.floor(r() * 3)] };
    }
    const g = E.topGroups(s, 'player', 4);
    return { type: 'court', groupId: g[Math.floor(r() * 4)] };
  }
  return { type: 'endTurn' };
}
function play(seed, bot, check) {
  let s = E.newGame({ seed, ideologyId: ['commonwealth', 'hearth', 'ledger'][seed % 3] });
  const r = rng(seed * 7 + 1);
  for (let n = 0; s.phase !== 'over' && n < 3000; n++) {
    const a = bot(s, r);
    const res = E.apply(s, a);
    s = res.log[0]?.kind === 'error' ? E.endTurn(s).state : res.state;
    check?.(s);
  }
  return s;
}

// ---------------------------------------------------------------- tests

test("D'Hondt: textbook allocation, 5% regional threshold, ties stable", () => {
  assert.deepEqual(E.dhondt({ a: 100000, b: 80000, c: 30000, d: 20000 }, 8), { a: 4, b: 3, c: 1, d: 0 });
  assert.deepEqual(E.dhondt({ a: 0.5, b: 0.46, c: 0.04 }, 10), { a: 5, b: 5, c: 0 });
  assert.equal(E.dhondt({ a: 0.96, b: 0.04 }, 6).b, 0, 'below 5% wins nothing');
  assert.deepEqual(E.dhondt({ a: 0, b: 0 }, 3), { a: 0, b: 0 });
});

test('elections: 72 seats across 8 regions; region shares sum to 1; campaigning raises share', () => {
  const s = actionsState(3);
  assert.equal(E.CONTENT.regions.reduce((a, r) => a + r.seats, 0), 72);
  assert.equal(sumSeats(s.seats), 72);
  assert.equal(sumSeats(s.elections[0].seats), 72);
  for (const r of s.elections[0].regions) {
    assert.equal(sumSeats(r.seats), E.REGIONS[r.regionId].seats);
    assert.ok(Math.abs(Object.values(r.share).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  }
  const before = E.regionShares(s, 'brassport').player;
  const s2 = step(s, { type: 'campaign', regionId: 'brassport' });
  assert.ok(E.regionShares(s2, 'brassport').player > before);
  assert.equal(s2.ap, s.ap - 1);
  assert.equal(sumSeats(E.projectSeats(s2)), 72);
});

test('vote: forecast is deterministic and the roll call lands near it', () => {
  let s = actionsState(5);
  s = { ...s, docket: [] };
  const law = E.draftableLaws(s).find((l) => E.validate(s, { type: 'draft', lawId: l.id }) === null);
  s = step(s, { type: 'draft', lawId: law.id });
  const item = s.docket.find((d) => d.proposer === 'player');
  const f1 = E.forecastVote(s, item.id);
  const f2 = E.forecastVote(s, item.id);
  assert.deepEqual(f1, f2);
  assert.equal(f1.yes + f1.no + f1.abstain, 72);
  assert.equal(f1.passes, f1.yes > f1.no && f1.yes >= f1.threshold);
  assert.deepEqual(E.forecastVote(s, law.id), f1, 'lookup by law id finds the docket item');
  let yesSum = 0, agree = 0;
  const N = 60;
  for (let i = 0; i < N; i++) {
    const t = E.apply({ ...s, rng: (s.rng + i * 7919) >>> 0 }, { type: 'callVote', itemId: item.id }).log.find((l) => l.kind === 'vote').data;
    assert.equal(t.yes + t.no + t.abstain, 72);
    assert.equal(t.rollCall.length, 72);
    yesSum += t.yes;
    if (t.passes === f1.passes) agree++;
  }
  assert.ok(Math.abs(yesSum / N - f1.yes) <= 3, `mean yes ${yesSum / N} vs forecast ${f1.yes}`);
  assert.ok(agree / N >= 0.75, `forecast agreed ${agree}/${N}`);
  // the vote leaves the docket and is recorded
  const after = step(s, { type: 'callVote', itemId: item.id });
  assert.ok(!after.docket.some((d) => d.id === item.id));
  assert.equal(after.votes.at(-1).tally.itemId, item.id);
});

test('vote: whipping an abstaining bloc turns it YES and costs 1 PC; supermajority for non-repealable laws', () => {
  let s = actionsState(2);
  s = { ...s, era: 2, docket: [], politicalCapital: 5, seats: { player: 20, iron_crown: 20, harbor_left: 16, glass_circle: 16 } };
  s = step(s, { type: 'draft', lawId: 'womens_vote' });
  const item = s.docket.at(-1);
  const f = E.forecastVote(s, item.id);
  assert.equal(f.threshold, 48);
  const abst = f.blocs.find((b) => b.stance === 'abstain' && b.party !== 'player');
  if (abst) {
    const s2 = step(s, { type: 'whip', itemId: item.id, party: abst.party });
    assert.equal(s2.politicalCapital, 4);
    assert.equal(E.forecastVote(s2, item.id).blocs.find((b) => b.party === abst.party).stance, 'yes');
    assert.ok(s2.everWhipped);
  }
  const yesBloc = f.blocs.find((b) => b.stance === 'yes' && b.party !== 'player');
  if (yesBloc) assert.equal(E.apply(s, { type: 'whip', itemId: item.id, party: yesBloc.party }).log[0].kind, 'error');
});

test('budget: income, upkeep, deficit to debt, interest, central bank, privatized rail, bankruptcy', () => {
  let s = actionsState(4);
  s = { ...s, docket: [], stats: { ...s.stats, economy: 50 }, enacted: [], treasury: 100, debt: 0, timed: [] };
  let b = E.budget(s);
  assert.equal(b.income, 60);
  assert.equal(b.net, 30);
  s = { ...s, enacted: ['rail_bond', 'clinic_network', 'basic_income'] };
  b = E.budget(s);
  assert.equal(b.upkeep, 10 + 14 + 22);
  assert.equal(b.net, 60 - 30 - 46);
  assert.equal(E.budget({ ...s, enacted: [...s.enacted, 'privatize_rail'] }).upkeep, 14 + 22 - 14);
  // deficit becomes debt, interest 6% (5% with central bank)
  const deficit = { ...s, treasury: 0, debt: 100, stats: { ...s.stats, economy: 50 } };
  assert.equal(E.budget(deficit).interest, 6);
  assert.equal(E.budget({ ...deficit, enacted: [...deficit.enacted, 'central_bank'] }).interest, 5);
  const after = E.endTurn(deficit).state;
  assert.equal(after.debt, 100 + 6 + 16);
  assert.equal(after.treasury, 0);
  // bankruptcy
  const broke = E.endTurn({ ...deficit, debt: 290 }).state;
  assert.equal(broke.phase, 'over');
  assert.equal(broke.outcome, 'bankrupt');
});

test('events: choices apply group effects, treasury, stats, PC and special rules', () => {
  const base = { ...actionsState(6), phase: 'event', docket: [], timed: [], treasury: 100, politicalCapital: 3 };
  const withEvent = (id) => ({ ...base, pendingEvent: id });
  // dock strike: mediate
  let s = step(withEvent('dock_strike'), { type: 'resolveEvent', choice: 0 });
  assert.equal(s.approval.laborers, Math.min(100, base.approval.laborers + 8));
  assert.equal(s.treasury, 90);
  assert.equal(s.phase, 'actions');
  assert.equal(s.pendingEvent, null);
  // foreign loan: +50 now, 5/turn for 6 turns
  s = step(withEvent('foreign_loan'), { type: 'resolveEvent', choice: 0 });
  assert.equal(s.treasury, 150);
  assert.deepEqual(s.timed.map((t) => [t.id, t.turnsLeft, t.treasury]), [['foreign_loan', 6, -5]]);
  // defector: +1 seat, largest rival -1
  s = step(withEvent('defector'), { type: 'resolveEvent', choice: 0 });
  assert.equal(s.seats.player, base.seats.player + 1);
  assert.equal(sumSeats(s.seats), 72);
  // Silver Seam: nationalize = +30 plus royalties +5/turn for 4 turns; auction = +20 and economy +2
  s = step(withEvent('windfall'), { type: 'resolveEvent', choice: 0 });
  assert.equal(s.treasury, 130);
  assert.equal(s.timed[0].id, 'silver_royalties');
  s = step(withEvent('windfall'), { type: 'resolveEvent', choice: 1 });
  assert.equal(s.stats.economy, base.stats.economy + 2);
  // Corvane Border Line: reinforcing is free when border posts exist
  s = step({ ...withEvent('border_skirmish'), enacted: ['border_wall'] }, { type: 'resolveEvent', choice: 0 });
  assert.equal(s.treasury, 100);
  s = step(withEvent('border_skirmish'), { type: 'resolveEvent', choice: 0 });
  assert.equal(s.treasury, 88);
  // Thinking Loom: retraining fund pays out economy +1 / laborers +1 for 3 turns
  s = step(withEvent('ai_rumor'), { type: 'resolveEvent', choice: 0 });
  assert.equal(s.treasury, 88);
  assert.equal(s.timed[0].id, 'retraining_fund');
  // actions are blocked while an event is pending
  assert.equal(E.apply(withEvent('flood'), { type: 'court', groupId: 'elders' }).log[0].kind, 'error');
});

test('apply never mutates; invalid actions return an error log; preview matches apply', () => {
  const s = actionsState(7);
  const snap = JSON.stringify(s);
  const r = E.apply(s, { type: 'court', groupId: 'elders' });
  assert.equal(JSON.stringify(s), snap);
  const p = E.previewAction(s, { type: 'court', groupId: 'elders' });
  assert.ok(p.valid);
  assert.equal(p.cost.ap, 1);
  assert.equal(p.approvalDelta.elders, Math.round((r.state.approval.elders - s.approval.elders) * 10) / 10);
  const bad = E.apply(s, { type: 'lobby', rivalId: 'nope' });
  assert.equal(bad.state, s);
  assert.equal(bad.log[0].kind, 'error');
  assert.equal(E.previewAction(s, { type: 'draft', lawId: 'basic_income' }).valid, false, 'era 3 law locked in era 1');
});

test('full 24-turn game with the smart bot: never crashes, invariants hold, deterministic, JSON round-trip', () => {
  const check = (s) => {
    assert.equal(sumSeats(s.seats), 72);
    for (const g of E.GROUP_IDS) assert.ok(s.approval[g] >= 0 && s.approval[g] <= 100);
    for (const k of E.STAT_IDS) assert.ok(s.stats[k] >= 0 && s.stats[k] <= 100);
    assert.ok(s.ap >= 0 && s.politicalCapital >= 0 && s.politicalCapital <= 8);
  };
  const a = play(11, smartBot, check);
  assert.equal(a.phase, 'over');
  assert.ok(a.outcome);
  if (!['bankrupt', 'collapse', 'dissolved'].includes(a.outcome)) {
    assert.equal(a.turn, 24);
    assert.equal(a.elections.filter((e) => e.turn > 0).length, 6);
  }
  const b = play(11, smartBot);
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'same seed + same actions = same game');
  const back = E.deserialize(E.serialize(a));
  assert.deepEqual(back, a);
  assert.equal(back.version, 1);
  assert.equal(E.deserialize('{bad'), null);
  assert.equal(E.migrate({ version: 99 }), null);
  const sc = E.score(a);
  assert.equal(sc.total, sc.laws + sc.seats + sc.government + sc.stats + sc.debt);
  assert.ok(typeof sc.rank === 'string' && Array.isArray(sc.achievements));
});

test('balance smoke: 200 random-bot games + 100 smart-bot games', () => {
  const run = (bot, n) => {
    const c = {};
    let score = 0, seats = 0;
    for (let i = 1; i <= n; i++) {
      const s = play(i, bot);
      assert.equal(s.phase, 'over');
      c[s.outcome] = (c[s.outcome] ?? 0) + 1;
      score += E.score(s).total;
      seats += s.seats.player;
    }
    const gov = (c.majority ?? 0) + (c.coalition ?? 0) + (c.minority ?? 0) + (c.junior ?? 0);
    const lost = (c.bankrupt ?? 0) + (c.collapse ?? 0) + (c.dissolved ?? 0);
    return { c, win: gov / n, lost: lost / n, coalition: ((c.coalition ?? 0) + (c.junior ?? 0)) / n, score: Math.round(score / n), seats: +(seats / n).toFixed(1) };
  };
  const rnd = run(randomBot, 200);
  const smart = run(smartBot, 100);
  console.log('random bot x200:', JSON.stringify(rnd));
  console.log('smart bot x100:', JSON.stringify(smart));
  assert.ok(smart.win > rnd.win + 0.2, 'skill matters');
  assert.ok(smart.win >= 0.5 && smart.win <= 0.95, `smart win rate ${smart.win}`);
  assert.ok(rnd.win <= 0.4, `random win rate ${rnd.win}`);
});
