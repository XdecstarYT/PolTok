// Victoria 2026 — "If Labor wins". Promises per ABC News policy tracker (4 Nov 2026). Template: _lib-vic-party.js
import { make } from './_lib-vic-party.js';
const r = make({
  key: 'ALP', slug: 'labor', n: 1, of: 3, name: 'Labor', short: 'Labor', color: 0xe53935, css: '#ff6b6b',
  leaderTitle: 'Premier', leader: 'Ben Carroll', leaderSay: 'Labor is led by Premier Ben Carroll',
  others: ['Liberal', 'One Nation'],
  say: {
    cost: 'Public transport fares, capped at thirty dollars a week.',
    housing: 'Twenty-five thousand new homes set aside for first home buyers.',
    health: 'Ten free public dental clinics.',
    crime: 'Fifteen hundred more police.',
    transport: 'The Suburban Rail Loop keeps going.',
    energy: 'Net zero by twenty forty-five stays.',
  },
  card: {
    cost: ['<em>$30</em> fare cap', 'Weekly public transport cap for two years, plus a $30 weekly toll cap for smaller vehicles'],
    housing: ['<em>25,600</em> homes', 'Reserved for first home buyers at market prices'],
    health: ['<em>Free</em> dental', '$230m for 10 free public dental clinics, and free abortion care'],
    crime: ['<em>1,500</em> more police', 'Plus a $170m organised crime unit'],
    transport: ['Rail Loop <em>continues</em>', 'After $1b in cost cuts and a review targeting another $1b'],
    energy: ['Net zero <em>2045</em> stays', 'Plus a mineral royalties fund for regional Victoria'],
  },
  capText: {
    cost: '$30 weekly public transport fare cap.', housing: '25,600 homes reserved for first home buyers.', health: '10 free public dental clinics.',
    crime: '1,500 more police.', transport: 'Suburban Rail Loop continues.', energy: 'Net zero by 2045 stays.',
  },
});
export const { data, meta, scenes, build } = r;
