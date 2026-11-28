// Offline tests for the election-night VEC page reader (shared/au/vec-results.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeSnapshot, parseDistrictPage } from '../shared/au/vec-results.js';

const counting = `<p>Total enrolment as at close of rolls: 50,000 Formal votes: 20,000 Informal votes: 1,000</p>
<h2>First preference votes</h2><table><tr><td>CARROLL, Ben Australian Labor Party</td><td>8,000</td><td>40.00%</td></tr>
<tr><td>BYRNE, Samantha Liberal</td><td>7,000</td><td>35.00%</td></tr><tr><td>TAVERNA, Jason Pauline Hanson's One Nation</td><td>5,000</td><td>25.00%</td></tr></table>
<p>Recheck results by voting centre</p><h2>Two candidate preferred results</h2><table><tr><th>Candidate</th></tr><tr><td>CARROLL, Ben Australian Labor Party</td><td>9,000</td><td>45.00%</td></tr>
<tr><td>BYRNE, Samantha Liberal</td><td>11,000</td><td>55.00%</td></tr></table><p>Two candidate preferred results by voting centre</p>`;

test('counting page: first prefs, 2CP leader, counted %, no early call', () => {
  const s = parseDistrictPage(counting);
  assert.equal(s.counted, 42);
  assert.equal(s.fp[0].party, 'ALP');
  assert.equal(s.leader, 'LIB');
  assert.deepEqual(s.tcp.map((t) => [t.party, t.pct]), [['LIB', 55], ['ALP', 45]]);
  assert.equal(s.called, undefined, 'only 42% counted: not called');
});

test('finished preference distribution is a call', () => {
  const html = counting.replace('<h2>Two candidate preferred results</h2><table><tr><th>Candidate</th></tr>', '<h2>Preference distribution results</h2><p>We have finished the preference distribution for this district.</p><table><tr><th>Candidate Party Votes after distribution % votes</th></tr>').replace('Two candidate preferred results by voting centre', 'Distributions');
  const s = parseDistrictPage(html);
  assert.equal(s.called, 'LIB');
  assert.equal(s.final, true);
});

test('no votes yet → null', () => {
  assert.equal(parseDistrictPage('<p>Results will appear after 6pm.</p>'), null);
});

import { diffResults } from '../shared/au/vec-results.js';
test('diffResults: first results, lead changes and calls', () => {
  const a = { seats: { 'vic-a': { leader: 'ALP' }, 'vic-b': { leader: 'LIB' } } };
  const b = { seats: { 'vic-a': { leader: 'LIB' }, 'vic-b': { leader: 'LIB', called: 'LIB' }, 'vic-c': { leader: 'GRN' } } };
  const ev = diffResults(a, b, 1);
  assert.deepEqual(ev.map((e) => [e.id, e.kind, e.party]).sort(), [['vic-a', 'lead', 'LIB'], ['vic-b', 'called', 'LIB'], ['vic-c', 'first', 'GRN']]);
});

test('2026 VEC layout: table columns, party-first 2CP, One Nation, enrolled voters, successful candidate', async () => {
  const { readFileSync } = await import('node:fs');
  const html = readFileSync(new URL('./fixtures-vec2026-district.html', import.meta.url), 'utf8');
  const s = parseDistrictPage(html);
  assert.equal(s.counted, 54.8);
  assert.equal(s.fp.find((r) => r.name === 'Tam Lindrum').party, 'ONP');
  assert.deepEqual(s.tcp.map((r) => [r.party, r.name, r.pct]), [['LIB', 'Andrew Cook', 50.7], ['ALP', 'Nina Taylor', 49.3]]);
  assert.equal(s.called, 'LIB');
  assert.equal(s.elected, 'Andrew Cook');
});

test('mergeSnapshot: a partial run never shrinks the count', () => {
  const prev = { status: 'counting', seats: { 'vic-a': { counted: 10, leader: 'ALP' }, 'vic-b': { counted: 12, leader: 'LIB' } } };
  const next = { status: 'counting', updatedAt: 2, seats: { 'vic-a': { counted: 14, leader: 'ALP' } }, stats: { ok: 1 } };
  const m = mergeSnapshot(prev, next, 2);
  assert.deepEqual(Object.keys(m.seats).sort(), ['vic-a', 'vic-b']);
  assert.equal(m.seats['vic-a'].counted, 14);
  assert.equal(m.status, 'counting');
});
