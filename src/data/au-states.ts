// AU state & territory parliaments + federal history. Compiled 2026-11-05 by agent D (AUSTRALIA).
// Every figure carries a source; compositions are snapshots from the cited pages ("asOf" = the latest date the
// source itself supports). Where sources disagree or are undated the entry says so in `note`.
import type { AuLeader } from './au';

export interface AuChamber { name: string; seats: number; majority: number; comp: Record<string, number>; asOf: string; note?: string }
export interface AuState {
  code: string;
  name: string;
  kind: 'state' | 'territory';
  parliament: string;
  lower: AuChamber;
  upper?: AuChamber;
  head: AuLeader & { title: string };
  opposition: AuLeader;
  lastElection: { date: string; result: string; tpp?: string };
  nextElection: { date: string; exact: boolean; note?: string };
  facts: string[];
  sources: { label: string; url: string }[];
}

const W = (t: string) => ({ label: `Wikipedia: ${t.replace(/_/g, ' ')}`, url: `https://en.wikipedia.org/wiki/${t}` });

export const AU_STATES: AuState[] = [
  {
    code: 'nsw', name: 'New South Wales', kind: 'state', parliament: 'Parliament of New South Wales',
    lower: { name: 'Legislative Assembly', seats: 93, majority: 47, comp: { ALP: 46, LIB: 24, NAT: 11, GRN: 3, IND: 9 }, asOf: '2025-11', note: 'Undated infobox snapshot (page reflects events to at least 21 Nov 2025).' },
    upper: { name: 'Legislative Council', seats: 42, majority: 22, comp: { ALP: 15, LIB: 9, NAT: 5, GRN: 4, SFF: 2, AJP: 1, LCV: 1, LDP: 1, IND: 4 }, asOf: '2025', note: 'Chart labelled 2025. 21 of 42 seats are elected at each state election.' },
    head: { title: 'Premier', name: 'Chris Minns', party: 'ALP', seat: 'Kogarah', since: '2023-03-28' },
    opposition: { name: 'Kellie Sloane', party: 'LIB', seat: 'Vaucluse', since: '2025-11-21' },
    lastElection: { date: '2023-03-25', result: 'Labor won 45 of 93 seats and formed a minority government, ending 12 years of Coalition rule.' },
    nextElection: { date: '2027-03-13', exact: true, note: 'Wikipedia cites a Feb 2025 NSW Government release for 13 March 2027 (the usual fixed date would be the fourth Saturday in March).' },
    facts: ['Fixed four-year terms.', 'Optional preferential voting in the Assembly.'],
    sources: [W('Parliament_of_New_South_Wales'), W('2023_New_South_Wales_state_election')],
  },
  {
    code: 'vic', name: 'Victoria', kind: 'state', parliament: 'Parliament of Victoria',
    lower: { name: 'Legislative Assembly', seats: 88, majority: 45, comp: { ALP: 54, LIB: 20, NAT: 9, GRN: 2, IND: 2, vacant: 1 }, asOf: '2026-10', note: 'IND = Will Fowles and Darren Cheeseman (both ex-Labor). Vacant = Brunswick (per PolTok research, src/data/au.ts).' },
    upper: { name: 'Legislative Council', seats: 40, majority: 21, comp: { ALP: 15, LIB: 11, NAT: 2, GRN: 4, LCV: 2, AJP: 1, LDP: 1, ONP: 1, SFF: 1, IND: 2 }, asOf: '2026-07', note: 'Chart labelled July 2026. 8 regions x 5 members, all elected each election.' },
    head: { title: 'Premier', name: 'Ben Carroll', party: 'ALP', seat: 'Niddrie', since: '2026-07-28' },
    opposition: { name: 'Jess Wilson', party: 'LIB', seat: 'Kew', since: '2025-11-18' },
    lastElection: { date: '2022-11-26', result: 'Labor (Andrews) re-elected with 56 seats; Coalition 28; Greens 4.', tpp: 'ALP 55.0' },
    nextElection: { date: '2026-11-28', exact: true },
    facts: ['Polls close 6pm AEDT (07:00 UTC) on 28 Nov 2026.', 'Nominations close 12 noon Mon 9 Nov 2026; early voting 18–27 Nov.', 'VEC plans ~200 early voting centres (155 in 2022) and ~1,700 election-day centres.'],
    sources: [W('Parliament_of_Victoria'), { label: 'VEC: 2026 state election', url: 'https://www.vec.vic.gov.au/voting/2026-state-election' }, { label: 'VEC: 100 days until the 2026 election', url: 'https://vec.vic.gov.au/about-us/media/100-days-until-the-2026-victorian-state-election---what-you-need-to-know' }],
  },
  {
    code: 'qld', name: 'Queensland', kind: 'state', parliament: 'Parliament of Queensland (unicameral)',
    lower: { name: 'Legislative Assembly', seats: 93, majority: 47, comp: { LNP: 53, ALP: 36, KAP: 2, GRN: 1, IND: 1 }, asOf: '2026', note: 'Infobox figures; the election returned LNP 52, so one change since 2024 is implied (not verified).' },
    head: { title: 'Premier', name: 'David Crisafulli', party: 'LNP', seat: 'Broadwater', since: '2024-10-28' },
    opposition: { name: 'Steven Miles', party: 'ALP', seat: 'Murrumba', since: '2024-10-28' },
    lastElection: { date: '2024-10-26', result: 'LNP won 52 of 93 seats, ending nine years of Labor government.' },
    nextElection: { date: '2028-10-28', exact: false, note: 'On or before 28 Oct 2028 (fixed four-year terms, last Saturday in October).' },
    facts: ['Only unicameral state parliament (upper house abolished 1922).', 'Compulsory preferential voting.'],
    sources: [W('Parliament_of_Queensland'), W('2024_Queensland_state_election')],
  },
  {
    code: 'wa', name: 'Western Australia', kind: 'state', parliament: 'Parliament of Western Australia',
    lower: { name: 'Legislative Assembly', seats: 59, majority: 30, comp: { ALP: 45, LIB: 6, NAT: 6, ONP: 1, IND: 1 }, asOf: '2026-09', note: 'Wikipedia (page last edited 20 Sep 2026); the 2025 election returned ALP 46, LIB 7, NAT 6.' },
    upper: { name: 'Legislative Council', seats: 37, majority: 19, comp: { ALP: 16, LIB: 10, NAT: 2, GRN: 4, ONP: 2, AJP: 1, AUC: 1, LCV: 1 }, asOf: '2025-05', note: 'Elected statewide (single electorate) from 2025.' },
    head: { title: 'Premier', name: 'Roger Cook', party: 'ALP', seat: 'Kwinana', since: '2023-06-08' },
    opposition: { name: 'Basil Zempilas', party: 'LIB', seat: 'Churchlands', since: '2025-03-25' },
    lastElection: { date: '2025-03-08', result: 'Labor re-elected with 46 of 59 seats; Liberal 7, National 6.', tpp: 'ALP 57.1' },
    nextElection: { date: '2029-03-10', exact: true },
    facts: ['Fixed four-year terms (second Saturday in March).'],
    sources: [W('Parliament_of_Western_Australia'), W('2025_Western_Australian_state_election')],
  },
  {
    code: 'sa', name: 'South Australia', kind: 'state', parliament: 'Parliament of South Australia',
    lower: { name: 'House of Assembly', seats: 47, majority: 24, comp: { ALP: 33, LIB: 5, ONP: 4, IND: 5 }, asOf: '2026-05', note: 'IND includes Speaker Nat Cook (elected as Labor). Reflects the post-March-2026 parliament (presiding officers since 5 May 2026).' },
    upper: { name: 'Legislative Council', seats: 22, majority: 12, comp: { ALP: 10, LIB: 6, ONP: 3, GRN: 2, FF: 1 }, asOf: '2026-05' },
    head: { title: 'Premier', name: 'Peter Malinauskas', party: 'ALP', seat: 'Croydon', since: '2022-03-21' },
    opposition: { name: 'Ashton Hurn', party: 'LIB', seat: 'Schubert', since: '2025-12-08' },
    lastElection: { date: '2026-03-21', result: 'Labor re-elected in a landslide (34 seats, 37.5% primary); One Nation 22.9% primary and 4 seats; Liberals 18.9% and 5 seats.' },
    nextElection: { date: '2030-03-16', exact: false, note: 'Computed from the fixed-date rule (third Saturday in March, every four years).' },
    facts: ['One Nation outpolled the Liberals on primary votes in 2026 (PolTok research).'],
    sources: [W('Parliament_of_South_Australia'), W('2026_South_Australian_state_election')],
  },
  {
    code: 'tas', name: 'Tasmania', kind: 'state', parliament: 'Parliament of Tasmania',
    lower: { name: 'House of Assembly', seats: 35, majority: 18, comp: { LIB: 14, ALP: 10, IND: 6, GRN: 4, SFF: 1 }, asOf: '2026-10', note: 'Wikipedia (page last edited 28 Oct 2026). The July 2025 election returned Greens 5, IND 5; one Green-to-independent change is implied (not verified). Hare-Clark: 5 divisions x 7 members.' },
    upper: { name: 'Legislative Council', seats: 15, majority: 8, comp: { IND: 8, LIB: 3, ALP: 3, GRN: 1 }, asOf: '2025', note: 'Labelled as after the 2025 periodic elections; may not reflect the 2 May 2026 periodic election.' },
    head: { title: 'Premier', name: 'Jeremy Rockliff', party: 'LIB', seat: 'Braddon', since: '2022-04-08' },
    opposition: { name: 'Josh Willie', party: 'ALP', seat: 'Clark', since: '2025-08-20' },
    lastElection: { date: '2025-07-19', result: 'Snap election after a no-confidence vote: Liberal 14, Labor 10, Greens 5, independents 5, SFF 1; Rockliff continued in minority.' },
    nextElection: { date: '2029', exact: false, note: 'Due by 2029 (four-year maximum term).' },
    facts: ['Third Tasmanian election in a little over four years (2021, 2024, 2025).', 'Legislative Council has 15 single-member divisions with staggered periodic elections each May.'],
    sources: [W('Parliament_of_Tasmania'), W('2025_Tasmanian_state_election')],
  },
  {
    code: 'act', name: 'Australian Capital Territory', kind: 'territory', parliament: 'ACT Legislative Assembly (unicameral)',
    lower: { name: 'Legislative Assembly', seats: 25, majority: 13, comp: { ALP: 10, LIB: 8, GRN: 4, IND: 3 }, asOf: '2024-10', note: 'IND includes Fiona Carrick and Elizabeth Kikkert (removed from the Liberal party room). Hare-Clark: 5 electorates x 5 members.' },
    head: { title: 'Chief Minister', name: 'Andrew Barr', party: 'ALP', seat: 'Kurrajong', since: '2014-12-11' },
    opposition: { name: 'Mark Parton', party: 'LIB', seat: 'Brindabella', since: '2025-11-10' },
    lastElection: { date: '2024-10-19', result: 'Labor 10, Liberal 9, Greens 4, independents 2; Barr continued (Labor minority).' },
    nextElection: { date: '2028-10-21', exact: true },
    facts: ['Labor has governed the ACT continuously since 2001.'],
    sources: [W('Australian_Capital_Territory_Legislative_Assembly'), W('2024_Australian_Capital_Territory_general_election')],
  },
  {
    code: 'nt', name: 'Northern Territory', kind: 'territory', parliament: 'NT Legislative Assembly (unicameral)',
    lower: { name: 'Legislative Assembly', seats: 25, majority: 13, comp: { CLP: 17, ALP: 6, IND: 2 }, asOf: '2026-09-12', note: 'Infobox "as of 12 Sep 2026". The 2024 election returned CLP 17, ALP 4, GRN 1, IND 3; the changes since are not documented on that page — treat as unverified.' },
    head: { title: 'Chief Minister', name: 'Lia Finocchiaro', party: 'CLP', seat: 'Spillett', since: '2024-08-28' },
    opposition: { name: 'Selena Uibo', party: 'ALP', seat: 'Arnhem' },
    lastElection: { date: '2024-08-24', result: 'Country Liberals won 17 of 25 seats; Labor reduced to 4 (Chief Minister Eva Lawler lost her seat).' },
    nextElection: { date: '2028-08-26', exact: true, note: 'Fourth Saturday in August (Wikipedia infobox says 22 Aug; body text and the fixed-date rule give 26 Aug).' },
    facts: ['Single-member electorates; 25 seats.'],
    sources: [W('Northern_Territory_Legislative_Assembly'), W('2024_Northern_Territory_general_election')],
  },
];

export const auStateByCode = new Map(AU_STATES.map((s) => [s.code, s]));

/** Federal House results 1996–2025. coalition = LIB+NAT+LNP+CLP (WA Nationals 2010 counted in others). */
export const FED_HISTORY: { year: number; date: string; seats: number; alp: number; coalition: number; other: number; alpTpp: number; winner: 'ALP' | 'LNP'; pm: string }[] = [
  { year: 1996, date: '1996-03-02', seats: 148, alp: 49, coalition: 94, other: 5, alpTpp: 46.4, winner: 'LNP', pm: 'John Howard' },
  { year: 1998, date: '1998-10-03', seats: 148, alp: 67, coalition: 80, other: 1, alpTpp: 51.0, winner: 'LNP', pm: 'John Howard' },
  { year: 2001, date: '2001-11-10', seats: 150, alp: 65, coalition: 82, other: 3, alpTpp: 49.0, winner: 'LNP', pm: 'John Howard' },
  { year: 2004, date: '2004-10-09', seats: 150, alp: 60, coalition: 87, other: 3, alpTpp: 47.3, winner: 'LNP', pm: 'John Howard' },
  { year: 2007, date: '2007-11-24', seats: 150, alp: 83, coalition: 65, other: 2, alpTpp: 52.7, winner: 'ALP', pm: 'Kevin Rudd' },
  { year: 2010, date: '2010-08-21', seats: 150, alp: 72, coalition: 72, other: 6, alpTpp: 50.1, winner: 'ALP', pm: 'Julia Gillard' },
  { year: 2013, date: '2013-09-07', seats: 150, alp: 55, coalition: 90, other: 5, alpTpp: 46.5, winner: 'LNP', pm: 'Tony Abbott' },
  { year: 2016, date: '2016-07-02', seats: 150, alp: 69, coalition: 76, other: 5, alpTpp: 49.6, winner: 'LNP', pm: 'Malcolm Turnbull' },
  { year: 2019, date: '2019-05-18', seats: 151, alp: 68, coalition: 77, other: 6, alpTpp: 48.5, winner: 'LNP', pm: 'Scott Morrison' },
  { year: 2022, date: '2022-05-21', seats: 151, alp: 77, coalition: 58, other: 16, alpTpp: 52.1, winner: 'ALP', pm: 'Anthony Albanese' },
  { year: 2025, date: '2025-05-03', seats: 150, alp: 94, coalition: 43, other: 13, alpTpp: 55.2, winner: 'ALP', pm: 'Anthony Albanese' },
];
export const FED_HISTORY_SOURCE = { label: 'Wikipedia: Two-party-preferred vote (AEC figures)', url: 'https://en.wikipedia.org/wiki/Two-party-preferred_vote' };

export const AU_PMS: { name: string; party: 'ALP' | 'LIB'; from: string; to: string | null }[] = [
  { name: 'John Howard', party: 'LIB', from: '1996-03-11', to: '2007-12-03' },
  { name: 'Kevin Rudd', party: 'ALP', from: '2007-12-03', to: '2010-06-24' },
  { name: 'Julia Gillard', party: 'ALP', from: '2010-06-24', to: '2013-06-27' },
  { name: 'Kevin Rudd', party: 'ALP', from: '2013-06-27', to: '2013-09-18' },
  { name: 'Tony Abbott', party: 'LIB', from: '2013-09-18', to: '2015-09-15' },
  { name: 'Malcolm Turnbull', party: 'LIB', from: '2015-09-15', to: '2018-08-24' },
  { name: 'Scott Morrison', party: 'LIB', from: '2018-08-24', to: '2022-05-23' },
  { name: 'Anthony Albanese', party: 'ALP', from: '2022-05-23', to: null },
];
export const AU_PMS_SOURCE = { label: 'Wikipedia: List of prime ministers of Australia', url: 'https://en.wikipedia.org/wiki/List_of_prime_ministers_of_Australia' };

/** Victorian Legislative Council: members elected at the 2022 election (party at election). */
export const VIC_LC_2022: Record<string, [string, string][]> = {
  'Eastern Victoria': [['Renee Heath', 'LIB'], ['Melina Bath', 'NAT'], ['Tom McIntosh', 'ALP'], ['Harriet Shing', 'ALP'], ['Jeff Bourman', 'SFF']],
  'North-Eastern Metropolitan': [['Shaun Leane', 'ALP'], ['Sonja Terpstra', 'ALP'], ['Matthew Bach', 'LIB'], ['Nick McGowan', 'LIB'], ['Aiv Puglielli', 'GRN']],
  'Northern Metropolitan': [['Sheena Watt', 'ALP'], ['Enver Erdogan', 'ALP'], ['Evan Mulholland', 'LIB'], ['Samantha Ratnam', 'GRN'], ['Adem Somyurek', 'DLP']],
  'Northern Victoria': [['Wendy Lovell', 'LIB'], ['Gaelle Broad', 'NAT'], ['Jaclyn Symes', 'ALP'], ['Georgie Purcell', 'AJP'], ['Rikkie-Lee Tyrrell', 'ONP']],
  'South-Eastern Metropolitan': [['Lee Tarlamis', 'ALP'], ['Michael Galea', 'ALP'], ['Ann-Marie Hermans', 'LIB'], ['Rachel Payne', 'LCV'], ['David Limbrick', 'LDP']],
  'Southern Metropolitan': [['David Davis', 'LIB'], ['Georgie Crozier', 'LIB'], ['John Berger', 'ALP'], ['Ryan Batchelor', 'ALP'], ['Katherine Copsey', 'GRN']],
  'Western Metropolitan': [['Lizzie Blandthorn', 'ALP'], ['Ingrid Stitt', 'ALP'], ['Moira Deeming', 'LIB'], ['Trung Luu', 'LIB'], ['David Ettershank', 'LCV']],
  'Western Victoria': [['Jacinta Ermacora', 'ALP'], ['Gayle Tierney', 'ALP'], ['Bev McArthur', 'LIB'], ['Joe McCracken', 'LIB'], ['Sarah Mansfield', 'GRN']],
};
export const VIC_LC_2022_SOURCE = { label: 'Wikipedia: Results of the 2022 Victorian state election (Legislative Council)', url: 'https://en.wikipedia.org/wiki/Results_of_the_2022_Victorian_state_election_(Legislative_Council)' };
