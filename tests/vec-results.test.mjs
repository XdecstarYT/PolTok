// Offline tests for the election-night VEC page reader (shared/au/vec-results.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDistrictPage } from '../shared/au/vec-results.js';

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
