// node --test tests/  — Ask PolTok retrieval, ranking, budgets and the 413 retry path (all network mocked).
import test from 'node:test';
import assert from 'node:assert/strict';
import { gatherKnowledge, defaultLoaders, clearKnowledgeCache, LIVE_BUDGET } from '../server/ai-knowledge.js';
import { buildMessages, handleAi, promptChars, BUDGET } from '../server/ai.js';
import { selectKb } from '../shared/ai-kb.js';

const cand = (id, first, last, party, inc = false) => [id, { nyt_id: id, first_name: first, last_name: last, party: { nyt_id: party }, incumbent: inc }];
function race(nyt_id, st, office, cands, votes, { won, gained, eevp = 90, seat } = {}) {
  return {
    nyt_id, office_id: office, seat_number: seat, race_call_status: won ? 'called' : 'too_early', type: 'General',
    candidate_metadata: Object.fromEntries(cands),
    top_reporting_unit: { state_postal: st, eevp, candidates: cands.map(([id], i) => ({ nyt_id: id, votes: { total: votes[i] } })) },
    outcome: { won: won ? [won] : [], gained: !!gained },
  };
}
const ctrl = (office, d, r, total, demWin) => ({ partyControlData: { results: [{ state_postal: 'US', offices: { [office]: { total, party_balance: { DEM: { seats: d, flip_count: 2, winner: demWin }, GOP: { seats: r, flip_count: 1 } } } } }] } });
const filler = (n, st, office) => Array.from({ length: n }, (_, i) => race(`${st}${i}-${office}`, 'TX', office, [cand(`a${i}`, 'Al', `Filler${i}`, 'DEM'), cand(`b${i}`, 'Bo', `Other${i}`, 'GOP')], [500 + i, 480], { seat: String(i + 1) }));
const DOCS = {
  senate: { ...ctrl('S', 51, 47, 100, true), races: [race('GA-G-S-2026-11-03', 'GA', 'S', [cand('ossoff-j', 'Jon', 'Ossoff', 'DEM', true), cand('carter-b', 'Buddy', 'Carter', 'GOP')], [2600000, 2400000], { won: 'ossoff-j' }), race('ME-G-S-2026-11-03', 'ME', 'S', [cand('platner-g', 'Graham', 'Platner', 'DEM'), cand('collins-s', 'Susan', 'Collins', 'GOP', true)], [400000, 390000], { won: 'platner-g', gained: true }), ...filler(30, 'S', 'S')] },
  governor: { ...ctrl('G', 18, 18, 36), races: [race('PA-G-G-2026-11-03', 'PA', 'G', [cand('shapiro-j', 'Josh', 'Shapiro', 'DEM', true), cand('mastriano-d', 'Doug', 'Mastriano', 'GOP')], [3e6, 2e6], { won: 'shapiro-j' })] },
  house: { ...ctrl('H', 220, 205, 435, true), races: filler(200, 'H', 'H') },
};
const PM = { slug: 'x', volume: 100, markets: [{ active: true, groupItemTitle: 'Democratic', outcomePrices: '["0.9","0.1"]' }, { active: true, groupItemTitle: 'Republican', outcomePrices: '["0.1","0.9"]' }] };

function mockFetch(url) {
  const u = String(url);
  const body = u.includes('results-senate') ? DOCS.senate : u.includes('results-governor') ? DOCS.governor : u.includes('results-house') ? DOCS.house : u.includes('gamma-api') ? [PM] : u.includes('results-') ? { races: [] } : null;
  return Promise.resolve(body ? new Response(JSON.stringify(body), { status: 200 }) : new Response('nope', { status: 404 }));
}
const NEWS = [{ title: 'Ossoff wins re-election in Georgia', source: 'Reuters', publishedAt: Date.now() - 3600e3, tags: ['GA'] }, ...Array.from({ length: 80 }, (_, i) => ({ title: `Generic political story number ${i} about budgets`, source: 'AP', publishedAt: Date.now() - i * 3600e3 }))];
const AUNEWS = [{ title: 'Victorian election: Carroll and Wilson clash on housing', source: 'The Age', publishedAt: Date.now() }];
const BILLS = [{ id: '119-hr-8205', number: 'H.R. 8205', title: 'Rural Broadband Act', stage: 2, latestAction: { date: new Date().toISOString().slice(0, 10), text: 'Passed House' } }];
const loaders = () => ({ ...defaultLoaders(mockFetch), news: async () => NEWS, auNews: async () => AUNEWS, bills: async (c) => (c === 'us' ? BILLS : []) });

test('Georgia senate → GA-SEN facts and national summary included', async () => {
  clearKnowledgeCache();
  const k = await gatherKnowledge('Georgia senate', { loaders: loaders() });
  assert.match(k.text, /race:GA-SEN \| Georgia Senate: Jon Ossoff \(D, inc\.\) 52\.0%.*CALLED for Jon Ossoff/);
  assert.match(k.text, /balance:senate \| Senate: D 51, R 47 of 100.*Democrats have WON control/);
  assert.match(k.text, /balance:house/);
  assert.ok(k.refs.includes('race:GA-SEN'));
  assert.ok(k.text.length <= LIVE_BUDGET);
});

test('Victorian election → AU facts, no US races', async () => {
  clearKnowledgeCache();
  const k = await gatherKnowledge('What is happening in the Victorian election?', { loaders: loaders() });
  assert.match(k.text, /au:victoria \| Victorian election 2026-11-28/);
  assert.match(k.text, /The Age/);
  assert.doesNotMatch(k.text, /race:GA-SEN/);
});

test('AU seat, flips, candidate name and bills are ranked in', async () => {
  clearKnowledgeCache();
  assert.match((await gatherKnowledge('Who leads in Kooyong?', { loaders: loaders() })).text, /seat:kooyong \| Kooyong/);
  assert.match((await gatherKnowledge('Biggest flips tonight?', { loaders: loaders() })).text.split('\n').slice(0, 6).join('\n'), /Maine Senate.*FLIP/);
  assert.match((await gatherKnowledge('How did Collins do?', { loaders: loaders() })).text, /Susan Collins/);
  const b = await gatherKnowledge('What bills passed this week?', { loaders: loaders() });
  assert.match(b.text, /bill:119-hr-8205 \| US H\.R\. 8205 Rural Broadband Act — passed one chamber/);
});

test('failing sources degrade gracefully', async () => {
  clearKnowledgeCache();
  const bad = { ...defaultLoaders(() => Promise.reject(new Error('down'))), news: async () => { throw new Error('x'); }, auNews: async () => null, bills: async () => null };
  const k = await gatherKnowledge('Georgia senate', { loaders: bad });
  assert.equal(typeof k.text, 'string');
});

test('KB selects sections by keyword', () => {
  assert.ok(selectKb('How does ranked-choice work in Alaska?').some((s) => s.id === 'rcv'));
  assert.ok(selectKb('What is 2PP?').some((s) => s.id === 'au-system'));
  assert.ok(selectKb('Where can I find the swingometer page?').some((s) => s.id === 'features'));
  assert.ok(selectKb('x'.repeat(10)).length === 0);
  assert.ok(selectKb('senate house poll market bill source flip recount victoria australia page').reduce((a, s) => a + s.text.length, 0) <= 1800);
});

const QUESTIONS = ['Who won the Senate?', 'Georgia senate', 'How does ranked-choice work in Alaska?', 'What bills passed this week?', 'Who leads in Kooyong?', 'Explain the Victorian election', 'Which races are still uncalled?', 'Biggest upsets?', 'What are the Polymarket odds for House control?', 'Where can I see ballot measures and how are races called?'];

test('total prompt chars for 10 sample questions stay within budget', async () => {
  clearKnowledgeCache();
  const bigCtx = { balanceOfPower: { senate: { dem: 51 } }, headlines: Array.from({ length: 300 }, (_, i) => ({ title: `Headline ${i} `.repeat(4) })) };
  const history = Array.from({ length: 8 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: 'y'.repeat(1500) }));
  for (const q of QUESTIONS) {
    const k = await gatherKnowledge(q, { loaders: loaders() });
    const msgs = buildMessages({ question: q, context: bigCtx, history }, new Date(), 9000, { live: k.text, refs: k.refs, kb: selectKb(q) });
    const n = promptChars(msgs);
    assert.ok(n <= BUDGET.total, `${q}: ${n} chars`);
  }
});

test('413 from Groq → retried once with a smaller prompt; tokens are allowed only from context', async () => {
  clearKnowledgeCache();
  const sizes = [];
  const groq = async (url, init) => {
    if (String(url).includes('groq.com')) {
      sizes.push(promptChars(JSON.parse(init.body).messages));
      if (sizes.length === 1) return new Response('too big', { status: 413 });
      const sse = 'data: {"choices":[{"delta":{"content":"Ossoff won [AP via NYT]\\n[[race:GA-SEN]]"}}]}\n\ndata: [DONE]\n\n';
      return new Response(sse, { status: 200 });
    }
    return mockFetch(url);
  };
  const req = new Request('http://x/api/ai', { method: 'POST', body: JSON.stringify({ question: 'Georgia senate', context: { big: 'z'.repeat(20000) }, history: [] }) });
  const res = await handleAi(req, { ip: 't413', env: { GROQ: 'k' }, fetchImpl: groq, loaders: loaders() });
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Ossoff won/);
  assert.equal(sizes.length, 2);
  assert.ok(sizes[1] < sizes[0] && sizes[1] <= 8000, `${sizes}`);
});

test('system data block lists ALLOWED CARDS from retrieval', async () => {
  clearKnowledgeCache();
  const k = await gatherKnowledge('Georgia senate', { loaders: loaders() });
  const msgs = buildMessages({ question: 'Georgia senate', context: null }, new Date(), 9000, { live: k.text, refs: k.refs, kb: [] });
  assert.match(msgs[1].content, /ALLOWED CARDS: .*race:GA-SEN/);
  assert.match(msgs[0].content, /general knowledge, not live data/);
});
