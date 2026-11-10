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
const sumV = (o) => Object.values(o ?? {}).reduce((a, b) => a + (b ?? 0), 0);
/** A "reasonable player": courts its base, drafts popular affordable laws that will pass,
 *  whips close votes, votes down costly rival bills, campaigns in big regions, takes any government.
 *  v2: keeps the cabinet filled, answers debates, amends failing bills, handles party crises. */
function smartBot(s, r) {
  if (s.phase === 'event') {
    if (s.pendingEvent === 'leadership_challenge') return { type: 'resolveEvent', choice: E.eventChoice(s, s.pendingEvent, 0).winChance >= 0.7 || s.politicalCapital < 2 ? 0 : 1 };
    if (s.pendingEvent === 'defection_threat') return { type: 'resolveEvent', choice: s.politicalCapital >= 2 ? 1 : 0 };
    const val = (c) => { const ch = E.eventChoice(s, s.pendingEvent, c); return sumV(ch.groupEffects) + ch.treasury * 0.2 + sumV(ch.wings) * 0.5 + ch.politicalCapital * 2; };
    return { type: 'resolveEvent', choice: val(0) >= val(1) ? 0 : 1 };
  }
  if (s.phase === 'coalition') {
    if (s.pendingCoalition.kind === 'offer') return { type: 'answerOffer', accept: true };
    return E.listAvailableActions(s).reduce((a, b) => (b.partners.length && (!a.partners.length || b.partners.length < a.partners.length) ? b : a));
  }
  const sug = E.suggestCabinet(s);
  for (const p of E.POST_IDS) if (!s.cabinet[p] && sug[p] && !Object.values(s.cabinet).includes(sug[p])) return { type: 'appoint', post: p, characterId: sug[p] };
  for (const p of E.POST_IDS) if (!s.cabinet[p]) { const id = E.activeCharacters(s).find((c) => !s.characters[c].post); if (id) return { type: 'appoint', post: p, characterId: id }; }
  if (s.pendingDebate && s.ap > 0) {
    const val = (i) => { const d = E.debateChoice(s, i); const pos = Object.entries(d.groupEffects).reduce((a, [g, v]) => a + v * (s.approval[g] > 40 ? 1 : 0.5), 0); return pos * (1 - d.risk) - d.risk * 4 + d.politicalCapital * 3 * (1 - d.risk) + sumV(d.wings) * 0.6; };
    return { type: 'debate', choice: [0, 1, 2].reduce((a, b) => (val(b) > val(a) ? b : a)) };
  }
  for (const d of s.docket) {
    if (d.proposer === 'player' || d.kind !== 'enact') continue;
    const l = E.LAWS[d.lawId];
    const want = (E.budget(s).net - l.upkeep < 0 || s.debt > 60) && l.upkeep > 0 ? 'no' : d.playerStance;
    if (want !== d.playerStance) return { type: 'setStance', itemId: d.id, stance: want };
  }
  for (const d of s.docket) {
    const f = E.forecastVote(s, d.id);
    if (d.proposer === 'player' && !f.passes) {
      if (s.politicalCapital >= 1) {
        const w = f.blocs.find((b) => (b.stance === 'abstain' || b.rebels > 0) && !b.whipped);
        if (w) return { type: 'whip', itemId: d.id, party: w.party };
      }
      if (!d.amendment) {
        const o = E.amendmentsFor(s, d.id).find((x) => x.flips && E.validate(s, { type: 'amend', itemId: d.id, amendmentId: x.amendment.id }) === null);
        if (o) return { type: 'amend', itemId: d.id, amendmentId: o.amendment.id };
      }
    }
  }
  if (s.ap > 0) {
    if (!s.docket.some((d) => d.proposer === 'player')) {
      const net = E.budget(s).net;
      const laws = E.draftableLaws(s)
        .filter((l) => E.validate(s, { type: 'draft', lawId: l.id }) === null)
        .map((l) => ({ l, f: E.forecastVote(s, l.id), gain: Object.entries(l.groupEffects).reduce((a, [g, v]) => a + v * (s.approval[g] > 40 ? 1 : 0.5), 0) + sumV(E.wingReaction(s, l.id)) * 0.5 }))
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
/** Plays one game; `govs` (if given) collects every government formed after a real election. */
function play(seed, bot, check, govs, opts = {}) {
  let s = E.newGame({ seed, ideologyId: ['commonwealth', 'hearth', 'ledger'][seed % 3], ...opts });
  const r = rng(seed * 7 + 1);
  for (let n = 0; s.phase !== 'over' && n < 4000; n++) {
    const a = bot(s, r);
    let res = E.apply(s, a);
    if (res.log[0]?.kind === 'error') res = E.endTurn(s);
    s = res.state;
    if (govs && res.transitions.governmentFormed && s.elections.length > 1) govs.push(s.government);
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
  s = { ...s, docket: [], stats: { ...s.stats, economy: 50 }, enacted: [], treasury: 100, debt: 0, timed: [], cabinet: { ...s.cabinet, purse: null } };
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
  if (!['bankrupt', 'collapse', 'dissolved', 'ousted'].includes(a.outcome)) {
    assert.equal(a.turn, 24);
    assert.equal(a.elections.filter((e) => e.turn > 0).length, 6);
  }
  const b = play(11, smartBot);
  assert.equal(JSON.stringify(a), JSON.stringify(b), 'same seed + same actions = same game');
  const back = E.deserialize(E.serialize(a));
  assert.deepEqual(back, a);
  assert.equal(back.version, 2);
  assert.equal(E.deserialize('{bad'), null);
  assert.equal(E.migrate({ version: 99 }), null);
  const sc = E.score(a);
  assert.equal(sc.total, Math.round((sc.laws + sc.seats + sc.government + sc.stats + sc.debt + sc.bonus) * sc.multiplier));
  assert.ok(typeof sc.rank === 'string' && Array.isArray(sc.achievements));
});

test('coalitions: engine terms match validation, relations widen tolerance, rival pacts, fallback government', () => {
  let s = actionsState(3, { ideologyId: 'commonwealth' });
  // terms agree with validate() for every rival
  const terms = E.coalitionTerms(s);
  assert.equal(terms.length, 3);
  for (const t of terms) {
    assert.ok(t.reasons.length >= 1 && typeof t.reasons[0] === 'string');
    assert.equal(t.accepts, E.acceptablePartners(s).includes(t.party));
  }
  // allies always accept (unless a hawk's red line applies); relation widens the tolerated distance
  const far = { ...s, rivals: { ...s.rivals, glass_circle: { ...s.rivals.glass_circle, relation: -1 } } };
  const ally = { ...s, rivals: { ...s.rivals, glass_circle: { ...s.rivals.glass_circle, relation: 2 } } };
  assert.equal(E.coalitionStance(far, 'player', 'glass_circle').accepts, false);
  assert.equal(E.coalitionStance(ally, 'player', 'glass_circle').accepts, true);
  assert.ok(E.coalitionStance(far, 'player', 'glass_circle').reasons.some((r) => /Lobby/.test(r)), 'refusal explains how to fix it');
  // hawk refuses progressives even as an ally
  const hawkAlly = { ...s, rivals: { ...s.rivals, iron_crown: { ...s.rivals.iron_crown, relation: 2 } } };
  assert.equal(E.coalitionStance(hawkAlly, 'player', 'iron_crown').accepts, false);
  // rival pairs deal only with a pact for this term
  const pact = { ...s, rivalPacts: ['glass_circle+harbor_left'] };
  assert.equal(E.coalitionStance(pact, 'harbor_left', 'glass_circle').accepts, true);
  assert.equal(E.coalitionStance({ ...s, rivalPacts: [] }, 'harbor_left', 'glass_circle').accepts, false);
  // fallback: a rival majority if a pact can reach 37, else the largest party alone
  const seats = { player: 28, iron_crown: 6, harbor_left: 19, glass_circle: 19 };
  assert.deepEqual(E.fallbackGovernment({ ...pact, seats }).sort(), ['glass_circle', 'harbor_left']);
  assert.deepEqual(E.fallbackGovernment({ ...s, rivalPacts: [], seats }), ['player']);
  // passing on a coalition while a rival pact has a majority sends the player into opposition
  const form = { ...pact, seats, phase: 'coalition', pendingCoalition: { kind: 'form', seats }, elections: [...s.elections, s.elections[0]] };
  const r = E.apply(form, { type: 'formCoalition', partners: [] });
  assert.equal(r.transitions.governmentFormed, true);
  assert.equal(E.playerInGovernment(r.state), false);
});

test('transitions: endTurn reports elections, eras and game over; bloc support is normalised', () => {
  let s = actionsState(5);
  const seen = { electionHeld: 0, eraChanged: 0, gameOver: 0 };
  const r0 = E.apply(s, { type: 'court', groupId: 'elders' });
  assert.deepEqual(r0.transitions, { electionHeld: false, eraChanged: false, gameOver: false, governmentFormed: false });
  assert.equal(E.apply(s, { type: 'lobby', rivalId: 'nope' }).transitions.gameOver, false, 'errors carry transitions too');
  const r = rng(99);
  for (let n = 0; s.phase !== 'over' && n < 3000; n++) {
    const prev = s;
    let res = E.apply(s, smartBot(s, r));
    if (res.log[0]?.kind === 'error') res = E.endTurn(s);
    s = res.state;
    assert.equal(res.transitions.electionHeld, s.elections.length > prev.elections.length);
    assert.equal(res.transitions.eraChanged, s.era !== prev.era);
    assert.equal(res.transitions.gameOver, s.phase === 'over' && prev.phase !== 'over');
    for (const k of Object.keys(seen)) seen[k] += res.transitions[k] ? 1 : 0;
    for (const d of s.docket) {
      for (const b of E.forecastVote(s, d.id).blocs) {
        assert.ok(Number.isInteger(b.supportPct) && b.supportPct >= 0 && b.supportPct <= 100, `supportPct ${b.supportPct}`);
        if (b.party !== 'player' && b.stance === 'yes' && d.proposer !== b.party && !(d.government && s.government.members.includes(b.party)) && !b.whipped) assert.ok(b.supportPct >= 55);
      }
    }
  }
  if (s.outcome && !['bankrupt', 'collapse', 'dissolved', 'ousted'].includes(s.outcome)) {
    assert.equal(seen.electionHeld, 6);
    assert.equal(seen.eraChanged, 2);
  }
  assert.equal(seen.gameOver, 1);
});

test('balance smoke: 200 random-bot games + 100 smart-bot games', () => {
  const run = (bot, n) => {
    const c = {};
    const govs = [];
    let score = 0, seats = 0;
    for (let i = 1; i <= n; i++) {
      const s = play(i, bot, undefined, govs);
      assert.equal(s.phase, 'over');
      c[s.outcome] = (c[s.outcome] ?? 0) + 1;
      score += E.score(s).total;
      seats += s.seats.player;
    }
    const gov = (c.majority ?? 0) + (c.coalition ?? 0) + (c.minority ?? 0) + (c.junior ?? 0);
    const lost = (c.bankrupt ?? 0) + (c.collapse ?? 0) + (c.dissolved ?? 0) + (c.ousted ?? 0);
    const coalitionGovs = +(govs.filter((g) => g.members.length > 1).length / govs.length).toFixed(3);
    return { c, win: gov / n, lost: lost / n, coalition: ((c.coalition ?? 0) + (c.junior ?? 0)) / n, coalitionGovs, score: Math.round(score / n), seats: +(seats / n).toFixed(1) };
  };
  const rnd = run(randomBot, 200);
  const smart = run(smartBot, 100);
  console.log('random bot x200:', JSON.stringify(rnd));
  console.log('smart bot x100:', JSON.stringify(smart));
  assert.ok(smart.win > rnd.win + 0.2, 'skill matters');
  assert.ok(smart.win >= 0.55 && smart.win <= 0.8, `smart win rate ${smart.win}`);
  assert.ok(rnd.win <= 0.25, `random win rate ${rnd.win}`);
  // coalitions (any multi-party government) should be a regular sight, not a rarity or the norm
  for (const [name, r] of [['random', rnd], ['smart', smart]]) {
    assert.ok(r.coalitionGovs >= 0.2 && r.coalitionGovs <= 0.5, `${name} coalition share of elections ${r.coalitionGovs}`);
  }
});

// ---------------------------------------------------------------- v2 systems

test('v2 content: counts, 3-choice debates, chains reference real events, characters and posts', () => {
  const C = E.CONTENT;
  assert.ok(C.laws.length >= 50, `laws ${C.laws.length}`);
  assert.ok(C.events.length >= 48, `events ${C.events.length}`);
  assert.equal(C.characters.length, 12);
  assert.equal(C.posts.length, 5);
  assert.equal(C.wings.length, 3);
  assert.ok(Math.abs(C.wings.reduce((a, w) => a + w.size, 0) - 1) < 1e-9);
  assert.equal(C.scenarios.length, 4);
  assert.equal(C.difficulties.length, 4);
  for (const d of C.debates) assert.equal(d.choices.length, 3, d.id);
  for (const e of C.events) {
    assert.equal(e.choices.length, 2, e.id);
    for (const ch of e.choices) {
      if (ch.followUp) {
        assert.ok(E.EVENTS[ch.followUp.event], `${e.id} -> ${ch.followUp.event}`);
        if (ch.followUp.else) assert.ok(E.EVENTS[ch.followUp.else], `${e.id} -> ${ch.followUp.else}`);
      }
    }
  }
  // every chain-only event is reachable from some follow-up or is a character crisis
  const targets = new Set(C.events.flatMap((e) => e.choices.flatMap((c) => (c.followUp ? [c.followUp.event, c.followUp.else].filter(Boolean) : []))));
  for (const e of C.events.filter((x) => x.chainOnly && !x.character)) assert.ok(targets.has(e.id), `${e.id} unreachable`);
  for (const c of C.characters) { assert.ok(E.WINGS[c.wing]); assert.ok(E.TRAITS[c.trait]); }
  for (const p of C.perks) assert.ok(E.ACHIEVEMENTS[p.unlockedBy], p.id);
  for (const a of C.amendments) assert.ok(a.target === 'any' || E.RIVALS[a.target], a.id);
});

test('v2 migration: a v1 save loads as v2 with a cabinet, wings and politicians, and keeps playing', () => {
  const v2 = actionsState(8);
  const v1 = JSON.parse(JSON.stringify(v2));
  for (const k of ['scenarioId', 'difficulty', 'mods', 'electionTurns', 'totalTurns', 'characters', 'cabinet', 'wings', 'wingsStart', 'pendingDebate',
    'debateHistory', 'debatesWon', 'scheduledEvents', 'eventContext', 'perks', 'daily', 'lawAmendments', 'lawExtraUpkeep', 'pcProgress', 'scandals',
    'challengesSurvived', 'defections', 'fullCabinetTurns', 'lastChallenge', 'goalsDone', 'timeline']) delete v1[k];
  v1.version = 1;
  const s = E.deserialize(JSON.stringify(v1));
  assert.ok(s);
  assert.equal(s.version, 2);
  assert.equal(s.scenarioId, 'sandbox');
  assert.deepEqual(s.electionTurns, [4, 8, 12, 16, 20, 24]);
  assert.equal(Object.keys(s.characters).length, 12);
  assert.equal(E.POST_IDS.filter((p) => s.cabinet[p]).length, 5);
  for (const w of E.WING_IDS) assert.equal(s.wings[w], 60);
  assert.equal(s.rng, v2.rng, 'migration consumes no RNG');
  const after = E.endTurn(s).state;
  assert.equal(after.turn, s.turn + (after.phase === 'over' ? 0 : 1));
  assert.equal(after.timeline.length, 1);
});

test('v2 cabinet: appoint, replace (1 PC, loyalty -20), dismiss, purse income in the budget, shadow cabinet', () => {
  let s = actionsState(9);
  assert.equal(E.POST_IDS.filter((p) => s.cabinet[p]).length, 5, 'new games seat a cabinet');
  assert.equal(new Set(Object.values(s.cabinet)).size, 5);
  const purse = s.cabinet.purse;
  const bench = E.activeCharacters(s).find((id) => !s.characters[id].post);
  s = { ...s, politicalCapital: 3 };
  const s2 = step(s, { type: 'appoint', post: 'purse', characterId: bench });
  assert.equal(s2.cabinet.purse, bench);
  assert.equal(s2.politicalCapital, 2);
  assert.equal(s2.characters[purse].post, null);
  assert.equal(s2.characters[purse].loyalty, Math.max(0, s.characters[purse].loyalty - 20));
  assert.equal(s2.characters[bench].loyalty, Math.min(100, s.characters[bench].loyalty + 12));
  assert.equal(E.apply({ ...s, politicalCapital: 0 }, { type: 'appoint', post: 'purse', characterId: bench }).log[0].kind, 'error');
  const s3 = step(s2, { type: 'dismiss', post: 'purse' });
  assert.equal(s3.cabinet.purse, null);
  assert.equal(E.budget(s3).cabinet, 0);
  // filling an empty post is free; a perfect fit pays PURSE_INCOME in government, half in opposition
  const s4 = step({ ...s3, politicalCapital: 0 }, { type: 'appoint', post: 'purse', characterId: 'corin_ashby' });
  assert.equal(E.competence('corin_ashby', 'purse'), 1);
  const gov = { ...s4, government: { leader: 'player', members: ['player'], minority: true } };
  const opp = { ...s4, government: { leader: 'iron_crown', members: ['iron_crown'], minority: true } };
  assert.equal(E.budget(gov).cabinet, E.CONSTANTS.PURSE_INCOME);
  assert.equal(E.budget(opp).cabinet, Math.round(E.CONSTANTS.PURSE_INCOME * E.CONSTANTS.SHADOW_FACTOR));
  assert.equal(E.cabinetEffects(gov).length, 5);
  assert.ok(E.cabinetEffects(gov).every((l) => typeof l.text === 'string' && l.text.length > 0));
});

test('v2 wings: reactions to laws, rebels when unhappy, whipping, revolt halves', () => {
  let s = actionsState(10, { ideologyId: 'commonwealth' });
  s = { ...s, docket: [], seats: { player: 30, iron_crown: 14, harbor_left: 14, glass_circle: 14 }, politicalCapital: 5 };
  const r = E.wingReaction(s, 'press_freedom');
  assert.ok(r.reformers > r.traditionalists, 'reformers love a rights law more than traditionalists');
  // content wings: no rebels
  s = step(s, { type: 'draft', lawId: 'chapel_tithe' });
  const item = s.docket.at(-1);
  const calm = E.forecastVote(s, item.id).blocs.find((b) => b.party === 'player');
  assert.ok(!calm.wingRebels);
  // an unhappy reformer wing rebels against a faith law it dislikes
  const angry = { ...s, wings: { ...s.wings, reformers: 25 } };
  const bloc = E.forecastVote(angry, item.id).blocs.find((b) => b.party === 'player');
  assert.ok(bloc.wingRebels?.reformers > 0, JSON.stringify(bloc));
  assert.ok(bloc.rebels >= bloc.wingRebels.reformers);
  const whipped = step(angry, { type: 'whip', itemId: item.id, party: 'player' });
  assert.equal(E.forecastVote(whipped, item.id).blocs.find((b) => b.party === 'player').rebels, 0);
  // in revolt: rebels on everything, whipping only halves them
  const revolt = { ...s, wings: { ...s.wings, reformers: 5 } };
  const rb = E.forecastVote(revolt, item.id).blocs.find((b) => b.party === 'player').wingRebels.reformers;
  const rw = E.forecastVote(step(revolt, { type: 'whip', itemId: item.id, party: 'player' }), item.id).blocs.find((b) => b.party === 'player').wingRebels?.reformers ?? 0;
  assert.equal(rw, Math.floor(rb / 2));
  assert.equal(E.wingMood(revolt).find((w) => w.id === 'reformers').mood, 'revolt');
  assert.equal(E.wingMood(revolt).reduce((a, w) => a + w.seats, 0), 30);
});

test('v2 debates: cost 1 AP, preview shows risk without rolling, effects match debateChoice', () => {
  let s = actionsState(12);
  s = { ...s, pendingDebate: 'budget_question', ap: 3, politicalCapital: 2 };
  const d = E.currentDebate(s);
  assert.equal(d.choices.length, 3);
  const measured = E.debateChoice(s, 1);
  assert.equal(measured.risk, 0);
  assert.equal(E.consumesRng(s, { type: 'debate', choice: 1 }), false);
  const after = step(s, { type: 'debate', choice: 1 });
  assert.equal(after.ap, 2);
  assert.equal(after.pendingDebate, null);
  assert.equal(after.debatesWon, 1);
  for (const [g, v] of Object.entries(measured.groupEffects)) assert.equal(after.approval[g], Math.round(Math.min(100, Math.max(0, s.approval[g] + v)) * 10) / 10);
  const p = E.previewAction(s, { type: 'debate', choice: 2 });
  assert.ok(p.valid && p.risk > 0 && p.cost.ap === 1);
  assert.equal(E.apply(after, { type: 'debate', choice: 0 }).log[0].kind, 'error', 'one debate per turn');
  // a risky line backfires with roughly its stated chance
  let backfires = 0;
  for (let i = 0; i < 200; i++) if (E.apply({ ...s, rng: (s.rng + i * 7919) >>> 0 }, { type: 'debate', choice: 2 }).state.debatesWon === 0) backfires++;
  const risk = E.debateChoice(s, 2).risk;
  assert.ok(Math.abs(backfires / 200 - risk) < 0.1, `backfire ${backfires / 200} vs ${risk}`);
});

test('v2 amendments: two options, raise the target bloc, cost paid, upkeep tracked on enactment', () => {
  let s = actionsState(13, { ideologyId: 'commonwealth' });
  s = { ...s, docket: [], treasury: 100, politicalCapital: 4, seats: { player: 24, iron_crown: 16, harbor_left: 16, glass_circle: 16 } };
  const opts = E.amendmentsFor(s, 'union_rights');
  assert.ok(opts.length >= 1 && opts.length <= 2);
  s = { ...s, era: 2 };
  s = step(s, { type: 'draft', lawId: 'union_rights' });
  const item = s.docket.at(-1);
  const offer = E.amendmentsFor(s, item.id);
  assert.equal(offer.length, 2);
  assert.notEqual(offer[0].amendment.id, offer[1].amendment.id);
  for (const o of offer) {
    assert.ok(Array.isArray(o.stanceChanges) && typeof o.yesGain === 'number');
    assert.ok(o.forecast.yes >= E.forecastVote(s, item.id).yes - 1);
  }
  const a = offer[0].amendment;
  const before = E.forecastVote(s, item.id);
  const s2 = step(s, { type: 'amend', itemId: item.id, amendmentId: a.id });
  assert.equal(s2.docket.at(-1).amendment, a.id);
  assert.equal(s2.politicalCapital, s.politicalCapital - (a.politicalCapital ?? 0));
  assert.equal(s2.treasury, s.treasury + (a.oneOff ?? 0));
  const target = a.target === 'any' ? E.RIVAL_IDS[0] : a.target;
  const sup = (f) => f.blocs.find((b) => b.party === target)?.support ?? 0;
  assert.ok(sup(E.forecastVote(s2, item.id)) > sup(before));
  assert.equal(E.apply(s2, { type: 'amend', itemId: item.id, amendmentId: offer[1].amendment.id }).log[0].kind, 'error', 'one amendment per bill');
  assert.equal(E.apply(s, { type: 'amend', itemId: item.id, amendmentId: 'nope' }).log[0].kind, 'error');
  // force a pass by giving the player the whole chamber, then check upkeep bookkeeping
  const big = { ...s2, seats: { player: 72, iron_crown: 0, harbor_left: 0, glass_circle: 0 } };
  const passed = step(big, { type: 'callVote', itemId: item.id });
  assert.ok(passed.enacted.includes('union_rights'));
  assert.equal(passed.lawAmendments.union_rights, a.id);
  assert.equal(passed.lawExtraUpkeep.union_rights ?? 0, a.upkeep || 0);
});

test('v2 character crises: scandal resignation, defection moves seats, challenge deal or ballot', () => {
  const base = actionsState(14);
  const minister = base.cabinet.whip;
  const ev = (id, ctx) => ({ ...base, phase: 'event', pendingEvent: id, eventContext: ctx, docket: [], politicalCapital: 4 });
  // the card is rendered with names filled in
  const card = E.currentEvent(ev('minister_scandal', { characterId: minister, post: 'whip' }));
  assert.ok(!/[{}]/.test(card.title + card.text + card.choices.map((c) => c.label).join('')), card.text);
  assert.ok(card.text.includes(E.CHARACTERS[minister].name));
  // demand the resignation: disgraced, post vacant
  let s = step(ev('minister_scandal', { characterId: minister, post: 'whip' }), { type: 'resolveEvent', choice: 1 });
  assert.equal(s.characters[minister].status, 'disgraced');
  assert.equal(s.cabinet.whip, null);
  assert.equal(s.scandals, 1);
  // stand by them: maybe a follow-up later, loyalty up
  s = step(ev('minister_scandal', { characterId: minister, post: 'whip' }), { type: 'resolveEvent', choice: 0 });
  assert.equal(s.characters[minister].status, 'active');
  assert.ok(s.scheduledEvents.every((x) => x.event === 'scandal_deepens' && x.context.characterId === minister));
  // defection: let them go -> seats move to the rival, total stays 72
  const d = E.activeCharacters(base)[0];
  const rival = E.defectionTarget(base, d);
  s = step({ ...ev('defection_threat', { characterId: d, rivalId: rival }), seats: { ...base.seats, player: Math.max(base.seats.player, 10) } }, { type: 'resolveEvent', choice: 0 });
  assert.equal(s.characters[d].status, 'defected');
  assert.equal(sumSeats(s.seats), sumSeats({ ...base.seats, player: Math.max(base.seats.player, 10) }));
  assert.ok(s.seats[rival] > base.seats[rival]);
  assert.equal(s.defections, 1);
  // challenge: the deal hands the challenger a post; the ballot is won or lost (ousted) by the stated odds
  const ch = E.activeCharacters(base).find((id) => !base.characters[id].post);
  s = step(ev('leadership_challenge', { characterId: ch }), { type: 'resolveEvent', choice: 1 });
  assert.ok(s.characters[ch].post);
  assert.equal(s.politicalCapital, 2);
  const odds = E.challengeOdds(ev('leadership_challenge', { characterId: ch }), ch);
  assert.ok(odds.winChance > 0 && odds.winChance < 1 && odds.reasons.length >= 3);
  let ousted = 0;
  for (let i = 0; i < 100; i++) {
    const r = E.apply({ ...ev('leadership_challenge', { characterId: ch }), rng: (base.rng + i * 104729) >>> 0 }, { type: 'resolveEvent', choice: 0 }).state;
    if (r.outcome === 'ousted') { ousted++; assert.equal(r.phase, 'over'); } else assert.equal(r.challengesSurvived, 1);
  }
  assert.ok(Math.abs(ousted / 100 - (1 - odds.winChance)) < 0.15, `ousted ${ousted}% vs ${1 - odds.winChance}`);
});

test('v2 event chains: a choice schedules its follow-up, which fires on time', () => {
  const base = { ...actionsState(15), phase: 'event', pendingEvent: 'ledger_whisper', docket: [] };
  let s = step(base, { type: 'resolveEvent', choice: 0 });
  assert.deepEqual(s.scheduledEvents.map((e) => [e.event, e.turn]), [['ledger_trial', base.turn + 2]]);
  for (let i = 0; i < 2; i++) {
    s = E.endTurn(s).state;
    if (s.phase === 'coalition') s = step(s, s.pendingCoalition.kind === 'form' ? { type: 'formCoalition', partners: [] } : { type: 'answerOffer', accept: false });
    if (s.phase === 'event' && s.pendingEvent !== 'ledger_trial') s = step(s, { type: 'resolveEvent', choice: 0 });
  }
  assert.equal(s.pendingEvent, 'ledger_trial');
  assert.ok(E.EVENTS.ledger_trial.chainOnly);
});

test('v2 scenarios and difficulties: setups differ and every scenario plays to the end', () => {
  const snap = E.newGame({ seed: 3, scenarioId: 'snap_election' });
  assert.equal(snap.turn, 9);
  assert.equal(snap.era, 2);
  assert.ok(E.playerInGovernment(snap));
  assert.equal(E.isElectionTurn(snap, 10), true);
  assert.equal(E.turnsToElection(snap), 1);
  const debt = E.newGame({ seed: 3, scenarioId: 'debt_crisis' });
  assert.equal(debt.debt, 170);
  assert.ok(E.playerInGovernment(debt));
  const ins = E.newGame({ seed: 3, scenarioId: 'insurgent' });
  assert.ok(ins.seats.player <= 8, `insurgent seats ${ins.seats.player}`);
  assert.equal(ins.mods.dissolveBelow, 5);
  assert.equal(E.scenarioGoals(ins).length, 2);
  const story = E.newGame({ seed: 3, difficulty: 'story' }), iron = E.newGame({ seed: 3, difficulty: 'ironclad' });
  assert.ok(story.treasury > iron.treasury);
  assert.ok(iron.rivals.iron_crown.approval.scholars > story.rivals.iron_crown.approval.scholars);
  for (const scenarioId of ['sandbox', 'snap_election', 'debt_crisis', 'insurgent']) {
    for (const difficulty of ['story', 'ironclad']) {
      const s = play(21, smartBot, (x) => assert.equal(sumSeats(x.seats), 72), undefined, { scenarioId, difficulty });
      assert.equal(s.phase, 'over', `${scenarioId}/${difficulty}`);
      const sc = E.score(s);
      assert.equal(sc.multiplier, E.DIFFICULTIES[difficulty].scoreMult);
      assert.equal(sc.goals.length, E.SCENARIOS[scenarioId].goals.length);
    }
  }
});

test('v2 meta: perks, daily challenge, headlines, rng helper, per-turn timeline', () => {
  assert.deepEqual(E.unlockedPerks([]), []);
  assert.deepEqual(E.unlockedPerks(['balanced_books']).map((p) => p.id), ['war_chest']);
  const plain = E.newGame({ seed: 5 });
  const perked = E.newGame({ seed: 5, perks: ['war_chest', 'second_wind', 'deep_bench'] });
  assert.deepEqual(perked.perks, ['war_chest', 'second_wind'], 'max 2 perks');
  assert.equal(perked.partyFunds, plain.partyFunds + 40);
  assert.equal(perked.mods.maxPc, plain.mods.maxPc + 1);
  const d1 = E.dailyChallenge('2026-11-09'), d2 = E.dailyChallenge('2026-11-09'), d3 = E.dailyChallenge('2026-11-10');
  assert.deepEqual(d1, d2);
  assert.notEqual(d1.seed, d3.seed);
  assert.equal(E.dailyChallenge(new Date('2026-11-09T23:00:00Z')).seed, d1.seed);
  const daily = E.newGame({ ...d1.options, perks: ['war_chest'] });
  assert.equal(daily.daily, '2026-11-09');
  assert.deepEqual(daily.perks, [], 'perks are off in the daily challenge');
  assert.equal(daily.scenarioId, d1.scenarioId);
  // headlines: deterministic, no RNG, at most `max`
  const s = play(31, smartBot);
  const h = E.headlines(s, 3);
  assert.ok(h.length >= 1 && h.length <= 3);
  assert.deepEqual(E.headlines(s, 3), h);
  for (const x of h) assert.ok(E.CONTENT.papers.includes(x.paper) && x.text.length > 5);
  const mid = actionsState(31);
  const rngBefore = mid.rng;
  E.headlines(mid);
  assert.equal(mid.rng, rngBefore);
  // rng helper
  assert.equal(E.consumesRng(mid, { type: 'court', groupId: 'elders' }), false);
  assert.equal(E.isDeterministic(mid, { type: 'court', groupId: 'elders' }), true);
  assert.equal(E.consumesRng(mid, { type: 'endTurn' }), true);
  // timeline: start + one snapshot per completed turn
  assert.equal(mid.timeline.length, 1);
  assert.equal(s.timeline[0].turn, 1);
  assert.ok(s.timeline.length >= 20);
  for (const snap of s.timeline) { assert.equal(sumSeats(snap.seats), 72); assert.equal(Object.keys(snap.approval).length, 8); }
  // v2 achievements live alongside v1 ones
  const sc = E.score(s);
  for (const a of sc.achievements) assert.ok(sc.allAchievements.includes(a));
  for (const a of sc.allAchievements) assert.ok(E.ACHIEVEMENTS[a]);
});

test('v2 scenario goals: the snap-election goal needs the government formed after the vote', () => {
  const s = E.newGame({ seed: 4, scenarioId: 'snap_election' });
  assert.deepEqual(s.goalsDone, []);
  let x = E.endTurn(s).state; // turn 9 -> 10
  if (x.phase === 'event') x = step(x, { type: 'resolveEvent', choice: 0 });
  // force a crushing defeat at the turn-10 election: the player cannot stay in power
  x = { ...x, phase: 'actions', docket: [], approval: Object.fromEntries(E.GROUP_IDS.map((g) => [g, 5])) };
  const after = E.endTurn(x).state;
  assert.ok(after.elections.some((e) => e.turn === 10));
  assert.equal(E.playerInGovernment(after), false);
  assert.ok(!after.goalsDone.includes('win_snap'));
  assert.equal(E.scenarioGoals(after).find((g) => g.id === 'win_snap').done, false);
});
