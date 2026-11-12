// Victoria 2026 — "If the Liberals win" (Liberal–National Coalition). Promises per ABC News policy tracker (4 Nov 2026).
import { make } from './_lib-vic-party.js';
const r = make({
  key: 'LNP', slug: 'liberal', n: 2, of: 3, name: 'The Coalition', short: 'the Liberals', color: 0x1f5fd1, css: '#6ea2ff',
  leaderTitle: 'Opposition Leader', leader: 'Jess Wilson', leaderSay: 'The Liberal–National Coalition is led by Jess Wilson',
  others: ['Labor', 'One Nation'],
  say: {
    cost: 'No new or higher taxes, and a fifty dollar weekly toll cap.',
    housing: 'No stamp duty for first home buyers, up to a million dollars.',
    health: 'One point two seven billion dollars to cut surgery waiting lists.',
    crime: 'Three thousand more police, and a one-strike bail rule.',
    transport: 'The Suburban Rail Loop is paused for review.',
    energy: 'Net zero stays, but the gas ban in homes is repealed.',
  },
  card: {
    cost: ['<em>No new</em> taxes', 'No new or increased taxes, and a $50 weekly toll cap'],
    housing: ['<em>$0</em> stamp duty', 'For first home buyers on homes up to $1 million'],
    health: ['<em>$1.27b</em> for surgery', 'Aiming for 25,000 extra elective procedures a year'],
    crime: ['<em>3,000</em> more police', 'A one-strike bail rule, and 40+ police stations reopened'],
    transport: ['Rail Loop <em>paused</em>', 'Paused and reviewed; $1.7b for 25 new trains'],
    energy: ['Gas ban <em>repealed</em>', 'Net zero 2045 legislation kept; 2km wind turbine buffer'],
  },
  capText: {
    cost: 'No new or higher taxes. $50 weekly toll cap.', housing: 'No stamp duty for first home buyers up to $1m.', health: '$1.27b to cut elective surgery waitlists.',
    crime: '3,000 more police and a one-strike bail rule.', transport: 'Suburban Rail Loop paused for review.', energy: 'Net zero kept; home gas ban repealed.',
  },
});
export const { data, meta, scenes, build } = r;
