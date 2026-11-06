// Parser tests for server/nz.js against the Electoral Commission's 2023 official result pages
// (captured via web.archive.org into tests/fixtures/nz2023).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parsePartyPage, parseStatusPage, parseDetailsPage, fetchNzResults } from '../server/nz.js';

const fx = (f) => fs.readFileSync(new URL(`./fixtures/nz2023/${f}`, import.meta.url), 'utf8');

test('party page (index.html)', () => {
  const r = parsePartyPage(fx('index.html'));
  assert.equal(r.status, 'final');
  const nat = r.party.find((p) => p.party === 'NAT');
  assert.deepEqual([nat.votes, nat.pct, nat.electorateSeats, nat.listSeats, nat.totalSeats], [1085851, 38.08, 43, 5, 48]);
  const tpm = r.party.find((p) => p.party === 'TPM');
  assert.deepEqual([tpm.electorateSeats, tpm.listSeats, tpm.totalSeats], [6, 0, 6]);
  assert.equal(r.party.reduce((a, p) => a + p.totalSeats, 0), 122); // 120 + 2 overhang
  assert.ok(!r.party.some((p) => p.name === 'Rock the Vote NZ')); // component rows skipped
});

test('electorate status page', () => {
  const r = parseStatusPage(fx('electorate-status.html'));
  assert.equal(r.electorates.length, 72);
  const ac = r.electorates[0];
  assert.deepEqual([ac.id, ac.leader, ac.leadingParty, ac.secondParty, ac.margin], ['auckland-central', 'SWARBRICK, Chlöe', 'GRN', 'NAT', 3896]);
  const w = r.electorates.find((e) => e.id === 'waiariki');
  assert.equal(w.leadingParty, 'TPM');
});

test('electorate details page', () => {
  const d = parseDetailsPage(fx('electorate-details-01.html'));
  assert.equal(d.name, 'Auckland Central');
  assert.equal(d.status, 'final');
  assert.equal(d.countedPct, 100);
  assert.equal(d.candidates[0].name, 'SWARBRICK, Chlöe');
  assert.equal(d.candidates[0].party, 'GRN');
  assert.equal(d.margin, 3896);
  assert.equal(d.candidates.find((c) => c.name === 'DAVIE, Paul').party, 'IND');
  assert.equal(d.partyVotes[0].party, 'NAT');
  assert.equal(d.informal.candidate, 299);
});

test('pre-results: unreachable source yields status pre with no numbers', async () => {
  const r = await fetchNzResults({ fetchImpl: async () => new Response('nope', { status: 404 }) });
  assert.equal(r.status, 'pre');
  assert.deepEqual([r.party, r.electorates], [[], []]);
});

test('fetchNzResults end-to-end with 2023 pages', async () => {
  const r = await fetchNzResults({ base: 'x/', fetchImpl: async (u) => new Response(fx(u.endsWith('index.html') ? 'index.html' : 'electorate-status.html')) });
  assert.equal(r.status, 'final');
  assert.equal(r.electorates.length, 72);
  assert.equal(r.electorates.filter((e) => e.type === 'maori').length, 7);
  assert.equal(r.votesCountedPct, 100);
});
