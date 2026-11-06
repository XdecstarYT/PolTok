// Office-holder selection + Wikipedia infobox cross-check helpers (server/countries.js).
import test from 'node:test';
import assert from 'node:assert/strict';
import { pickCurrent, parseIncumbent } from '../server/countries.js';

test('pickCurrent: no end time, preferred rank first, latest start', () => {
  const st = [
    { qid: 'Q1', name: 'Old', rank: 'normal', start: '2019-01-01T00:00:00Z', end: '2024-07-05T00:00:00Z' },
    { qid: 'Q2', name: 'Stale open', rank: 'normal', start: '2010-01-01T00:00:00Z' },
    { qid: 'Q3', name: 'Current', rank: 'normal', start: '2024-07-05T00:00:00Z' },
    { qid: 'Q4', name: 'Deprecated', rank: 'deprecated', start: '2025-01-01T00:00:00Z' },
  ];
  assert.deepEqual(pickCurrent(st).map((p) => p.name), ['Current']);
  assert.deepEqual(pickCurrent([...st, { qid: 'Q5', name: 'Pref', rank: 'preferred', start: '2000-01-01T00:00:00Z' }]).map((p) => p.name), ['Pref']);
  assert.deepEqual(pickCurrent([{ qid: 'Q1', rank: 'normal', end: '2020' }]), []);
});

test('parseIncumbent reads the officeholder infobox', () => {
  assert.deepEqual(parseIncumbent('{{Infobox official post\n| incumbent = [[Keir Starmer]]\n| incumbentsince = 5 July 2024'), ['Keir Starmer']);
  assert.deepEqual(parseIncumbent('| incumbent      = [[Charles III]]<br>'), ['Charles III']);
  assert.deepEqual(parseIncumbent('no infobox'), []);
});
