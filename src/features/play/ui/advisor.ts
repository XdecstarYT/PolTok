// The Advisor: a heuristic hint for a good next move. Pure: tries candidate actions on copies of the state
// (the engine never mutates its input) and scores the results.
import type { Action, GameState, PartyId } from '../engine/types';
import { api, CONTENT, groupName, lawById, MAJORITY, nextElectionIn, partyName, projectSeats, regionName } from './adapter';

export interface Advice {
  title: string;
  why: string;
  /** A one-click action, when the advice is a single safe action. */
  action?: Action;
  /** Open the roll call for a docket item instead. */
  vote?: string;
  tone: 'go' | 'warn' | 'info';
}

const share = (s: GameState, g: string) => s.shares?.[g] ?? CONTENT.groups.find((x) => x.id === g)?.share ?? 0.125;
function weightedApproval(s: GameState) { let a = 0; for (const g of CONTENT.groups) a += (s.approval[g.id] ?? 0) * share(s, g.id); return a; }
function forecast(s: GameState, id: string) { try { return api.forecastVote(s, id); } catch { return null; } }

export function advise(s: GameState): Advice | null {
  try {
    if (s.phase === 'event') return null;
    if (s.phase === 'coalition') {
      const pc = s.pendingCoalition;
      if (pc?.kind === 'offer') return { title: 'Weigh the offer', why: 'Joining counts as time in government and gives your bills more support. Staying out keeps your hands clean.', tone: 'info' };
      const ok = api.coalitionTerms(s).filter((t) => t.accepts && t.seats).sort((a, b) => a.distance - b.distance);
      let seats = s.seats.player ?? 0; const pick: string[] = [];
      for (const t of ok) { if (seats >= MAJORITY) break; pick.push(t.party); seats += t.seats; }
      return seats >= MAJORITY
        ? { title: `Build with ${pick.map((p) => partyName(s, p)).join(' + ')}`, why: `The closest willing partners reach ${seats} seats.`, tone: 'go' }
        : { title: 'No majority available', why: 'No willing partners get you to 37. A minority government still counts as governing.', tone: 'warn' };
    }
    if (s.phase !== 'actions') return null;

    // 1. bills ready to pass
    const mine = s.docket.filter((d) => d.proposer === 'player');
    for (const d of mine) {
      const f = forecast(s, d.id);
      if (f?.passes) return { title: `Call the vote on ${lawById(d.lawId)?.name ?? 'your bill'}`, why: `Forecast passes ${f.yes} to ${f.no}. Votes are not final until called.`, vote: d.id, tone: 'go' };
    }
    // 2. bills one whip away
    if (s.politicalCapital >= 1) {
      for (const d of mine) {
        const f = forecast(s, d.id); if (!f) continue;
        for (const b of f.blocs) {
          if (b.whipped || (b.stance !== 'abstain' && !(b.party === 'player' && b.rebels > 0))) continue;
          try {
            const p = api.previewAction(s, { type: 'whip', itemId: d.id, party: b.party as PartyId });
            if (p.valid && p.forecast?.passes) return { title: `Whip ${partyName(s, b.party)} on ${lawById(d.lawId)?.name}`, why: `1 Political Capital turns the forecast into a pass (${p.forecast.yes} to ${p.forecast.no}).`, vote: d.id, tone: 'go' };
          } catch { /* ignore */ }
        }
      }
    }
    if (s.ap <= 0) {
      const opp = s.docket.find((d) => d.proposer !== 'player');
      if (opp) { const f = forecast(s, opp.id); return { title: `Decide on ${lawById(opp.lawId)?.name}`, why: `A rival bill is on the docket${f ? ` (forecast ${f.passes ? 'passes' : 'fails'} ${f.yes}–${f.no})` : ''}. Set your bloc's stance before you end the turn.`, vote: opp.id, tone: 'info' }; }
      return { title: 'End the turn', why: 'No action points left. Income and upkeep are settled at the end of the turn.', tone: 'info' };
    }

    // 3. score candidate actions
    const next = nextElectionIn(s);
    const urgency = next === null ? 0.2 : next === 0 ? 3.5 : next === 1 ? 2.5 : next === 2 ? 1.4 : 0.8;
    const seats0 = projectSeats(s).player ?? 0;
    const appr0 = weightedApproval(s);
    const lowMoney = s.debt > 180 || s.treasury < 20;
    let best: { a: Action; score: number; why: string; title: string } | null = null;
    const cands = api.listAvailableActions(s).filter((a) => a.type === 'campaign' || a.type === 'court' || a.type === 'draft' || a.type === 'lobby');
    for (const a of cands) {
      let r; try { r = api.apply(s, a); } catch { continue; }
      if (r.log.some((l) => l.kind === 'error')) continue;
      const t = r.state;
      const dSeats = (projectSeats(t).player ?? 0) - seats0;
      const dAppr = weightedApproval(t) - appr0;
      let score = dSeats * urgency * 1.6 + dAppr * 0.9;
      let title = '', why = '';
      if (a.type === 'campaign') {
        title = `Campaign in ${regionName(a.regionId)}`;
        why = dSeats > 0 ? `Projected +${dSeats} seat${dSeats > 1 ? 's' : ''}${next !== null ? ` with the election in ${next === 0 ? 'this turn' : `${next} turn${next > 1 ? 's' : ''}`}` : ''}.` : 'Builds support where your margin is thin.';
        if (inGov(s) && lowMoney) score -= 1.5;
      } else if (a.type === 'court') {
        const g = CONTENT.groups.find((x) => x.id === a.groupId);
        title = `Court the ${g?.name}`;
        why = `+${Math.round((t.approval[a.groupId] ?? 0) - (s.approval[a.groupId] ?? 0))} approval with ${Math.round(share(s, a.groupId) * 100)}% of voters${dSeats > 0 ? `, projected +${dSeats} seat${dSeats > 1 ? 's' : ''}` : ''}.`;
      } else if (a.type === 'draft') {
        const law = lawById(a.lawId); if (!law) continue;
        const item = t.docket[t.docket.length - 1];
        const f = item ? forecast(t, item.id) : null;
        let fit = 0; for (const [g, n] of Object.entries(law.groupEffects)) fit += n * share(s, g) * ((s.approval[g] ?? 50) / 50);
        const statSum = Object.values(law.stats).reduce((x, y) => x + (y ?? 0), 0);
        score = (f?.passes ? 4 : -2) + fit * 0.6 + statSum / 8 - (lowMoney ? Math.max(0, law.upkeep) / 3 : 0) + (lowMoney && law.upkeep < 0 ? 2 : 0);
        const top = Object.entries(law.groupEffects).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1])[0];
        title = `Draft ${law.name}`;
        why = `${f ? `Forecast ${f.passes ? 'passes' : 'fails'} ${f.yes}–${f.no}` : 'Goes to the docket'}${top ? `; ${groupName(top[0])} +${top[1]}` : ''}${law.upkeep < 0 ? `; raises ${-law.upkeep} per turn` : ''}.`;
      } else if (a.type === 'lobby') {
        const rel = s.rivals[a.rivalId]?.relation ?? 0;
        const needPartner = (seats0 < MAJORITY) && next !== null && next <= 2;
        score = needPartner && rel < 1 ? 1.4 + (s.seats[a.rivalId] ?? 0) / 20 : -1;
        title = `Lobby ${partyName(s, a.rivalId)}`;
        why = `Warmer relations make them willing coalition partners after the vote. You are projected ${seats0} of ${MAJORITY}.`;
      }
      if (!best || score > best.score) best = { a, score, why, title };
    }
    if (best && best.score > 0.2) return { title: best.title, why: best.why, action: best.a, tone: lowMoney ? 'warn' : 'go' };
    if (lowMoney) return { title: 'Mind the budget', why: `Debt is ${Math.round(s.debt)}. Revenue laws (negative upkeep) and a strong economy pay it down; 300 is bankruptcy.`, tone: 'warn' };
    return { title: 'Save your strength', why: 'Nothing here clearly helps. Ending the turn is fine.', tone: 'info' };
  } catch {
    return null;
  }
}
const inGov = (s: GameState) => s.government.members.includes('player');
