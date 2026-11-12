// Victoria 2026 — "If One Nation wins". Promises per ABC News policy tracker (4 Nov 2026). Leader per Wikipedia.
import { make } from './_lib-vic-party.js';
const r = make({
  key: 'ONP', slug: 'one-nation', n: 3, of: 3, name: 'One Nation', short: 'One Nation', color: 0xd9480f, css: '#ff9a4a',
  leaderTitle: 'Victorian leader', leader: 'Warren Pickering', leaderSay: 'One Nation in Victoria is led by Warren Pickering',
  others: ['Labor', 'Liberal'],
  say: {
    cost: 'Labor\'s land tax increases reversed, and stamp duty on insurance abolished.',
    housing: 'Higher duty for foreign buyers, and a say before high-rises in your suburb.',
    health: 'Emergency departments open twenty-four seven in the regions.',
    crime: 'Children charged as adults for serious violent crimes.',
    transport: 'The Suburban Rail Loop is cancelled.',
    energy: 'Net zero scrapped, and the nuclear ban lifted.',
  },
  card: {
    cost: ['Land tax <em>rolled back</em>', 'Labor\'s land tax increases reversed; 10% stamp duty on insurance abolished'],
    housing: ['<em>Higher</em> foreign duty', 'Community consultation before high-rise in established suburbs'],
    health: ['<em>24/7</em> regional EDs', 'Plus nurse-led discharging and prescribing'],
    crime: ['Kids tried <em>as adults</em>', 'For serious violent offences; age of criminal responsibility back to 10'],
    transport: ['Rail Loop <em>cancelled</em>', 'Funds moved to the Melton line and Airport Rail'],
    energy: ['Net zero <em>scrapped</em>', 'State nuclear ban lifted; home gas ban reversed'],
  },
  capText: {
    cost: 'Land tax increases reversed. Stamp duty on insurance abolished.', housing: 'Higher foreign buyer duty.', health: '24/7 regional emergency departments.',
    crime: 'Children charged as adults for serious violence.', transport: 'Suburban Rail Loop cancelled.', energy: 'Net zero scrapped. Nuclear ban lifted.',
  },
});
export const { data, meta, scenes, build } = r;
