/**
 * Issues-match statements and party positions.
 *
 * Positions are a summary of each party's OFFICIAL stated platform/policy documents, on a
 * -2 (strongly disagree) … +2 (strongly agree) scale. `null` = the document takes no clear
 * position, so that party is NOT scored on that statement (we never guess).
 * Every statement cites the document(s) used. Reviewed Nov 2026; platforms change, so
 * users are always pointed to the primary source.
 */
export type Region = 'US' | 'AU';
export type PartyId = 'DEM' | 'GOP' | 'ALP' | 'LIB' | 'GRN' | 'ONP';
export type Pos = -2 | -1 | 0 | 1 | 2 | null;

export interface PartyDoc { id: PartyId; region: Region; name: string; short: string; color: string; doc: string; url: string }

export const PARTIES: PartyDoc[] = [
  { id: 'DEM', region: 'US', name: 'Democratic Party', short: 'Democrats', color: '#3d7bff', doc: '2024 Democratic Party Platform (adopted Aug 19, 2024)', url: 'https://www.presidency.ucsb.edu/documents/2024-democratic-party-platform' },
  { id: 'GOP', region: 'US', name: 'Republican Party', short: 'Republicans', color: '#ff3d55', doc: '2024 Republican Party Platform (adopted Jul 15, 2024)', url: 'https://www.presidency.ucsb.edu/documents/2024-republican-party-platform' },
  { id: 'ALP', region: 'AU', name: 'Australian Labor Party', short: 'Labor', color: '#e53935', doc: 'ALP National Platform 2023 + 2025 election policies', url: 'https://www.alp.org.au/media/3569/2023-alp-national-platform.pdf' },
  { id: 'LIB', region: 'AU', name: 'Liberal Party of Australia', short: 'Liberal', color: '#1e5bc6', doc: 'Liberal Party beliefs + 2025 Coalition election policies & Nov 2025 energy policy', url: 'https://www.liberal.org.au/our-beliefs' },
  { id: 'GRN', region: 'AU', name: 'Australian Greens', short: 'Greens', color: '#2ecc71', doc: 'Australian Greens Policy Platform', url: 'https://greens.org.au/platform' },
  { id: 'ONP', region: 'AU', name: "Pauline Hanson's One Nation", short: 'One Nation', color: '#f57c00', doc: 'One Nation stated policies', url: 'https://www.onenation.org.au/issues' },
];
export const partyById = new Map(PARTIES.map((p) => [p.id, p]));

export interface Statement {
  id: string;
  topic: string;
  text: string;
  /** Positions by party; omitted party = no clear stated position. */
  pos: Partial<Record<PartyId, Pos>>;
  /** Where in the documents the position comes from. */
  note: string;
}

export const STATEMENTS: Statement[] = [
  { id: 'minwage', topic: 'Economy', text: 'The minimum wage should be raised substantially.',
    pos: { DEM: 2, ALP: 1, GRN: 2 }, note: 'DEM platform: raise the federal minimum wage. ALP platform: support real wage growth via the Fair Work Commission. Greens: lift minimum wage. GOP, Liberal and One Nation documents take no explicit position.' },
  { id: 'tax', topic: 'Taxes', text: 'Taxes on large corporations and the highest earners should be increased.',
    pos: { DEM: 2, GOP: -2, LIB: -1, GRN: 2 }, note: 'DEM: “make billionaires and big corporations pay their fair share”. GOP: make the 2017 tax cuts permanent and cut taxes. Liberal beliefs: lower taxes. Greens: tax billionaires and big corporations.' },
  { id: 'tariffs', topic: 'Trade', text: 'Broad tariffs on imported goods are a good way to protect local jobs.',
    pos: { DEM: -1, GOP: 2, ALP: -1, LIB: -1, ONP: 2 }, note: 'GOP: baseline tariffs on foreign goods. DEM: criticises across-the-board tariffs as a tax on families. ALP & Liberal: support free-trade agreements. One Nation: restore tariffs to rebuild manufacturing.' },
  { id: 'health', topic: 'Health', text: 'Government should guarantee health coverage for everyone, even if public spending rises.',
    pos: { DEM: 2, GOP: -1, ALP: 2, LIB: 1, GRN: 2 }, note: 'DEM: health care is a right; expand the ACA. GOP: increase choice/transparency rather than government coverage. ALP: protect and strengthen Medicare. Liberal: committed to Medicare. Greens: universal care incl. dental in Medicare.' },
  { id: 'drugs', topic: 'Health', text: 'Government should negotiate or cap the price of prescription medicines.',
    pos: { DEM: 2, ALP: 2, LIB: 1, GRN: 2 }, note: 'DEM: Medicare drug-price negotiation & $35 insulin cap. ALP: cheaper medicines via PBS. Coalition 2025: matched PBS co-payment cut. Greens: lower medicine costs.' },
  { id: 'migration', topic: 'Immigration', text: 'Overall immigration levels should be reduced.',
    pos: { DEM: -1, GOP: 2, LIB: 1, GRN: -1, ONP: 2 }, note: 'GOP: “largest deportation operation” and immigration restriction. DEM: support legal immigration pathways. Coalition 2025: cut permanent migration. Greens: welcoming migration & refugee intake. One Nation: drastically cut immigration.' },
  { id: 'border', topic: 'Immigration', text: 'Unauthorised arrivals should face stricter enforcement, including detention and removal.',
    pos: { DEM: 1, GOP: 2, ALP: 1, LIB: 2, GRN: -2, ONP: 2 }, note: 'DEM: backs the bipartisan border security bill and more agents. GOP: seal the border, deport. ALP: maintains Operation Sovereign Borders. Liberal: strong border protection. Greens: end offshore detention. One Nation: strict border control.' },
  { id: 'citizenship', topic: 'Immigration', text: 'Long-term undocumented residents should have a path to citizenship.',
    pos: { DEM: 2, GOP: -2 }, note: 'DEM: earned path to citizenship (incl. Dreamers). GOP: opposes amnesty. (US-specific; AU parties not scored.)' },
  { id: 'netzero', topic: 'Climate', text: 'The country should commit to net-zero emissions by 2050.',
    pos: { DEM: 2, GOP: -2, ALP: 2, LIB: -2, GRN: 2, ONP: -2 }, note: 'DEM: net-zero by 2050. GOP: end the “Green New Scam”. ALP: legislated net zero by 2050. Liberal: dropped the net-zero target (Nov 2025). Greens: support faster action. One Nation: scrap net zero.' },
  { id: 'fossil', topic: 'Energy', text: 'Governments should approve more new coal, oil and gas projects.',
    pos: { GOP: 2, LIB: 2, GRN: -2, ONP: 2 }, note: 'GOP: “unleash American energy” / drilling. Coalition 2025: expand gas supply. Greens: no new coal and gas. One Nation: support coal and gas. DEM & ALP documents mixed, not scored.' },
  { id: 'nuclear', topic: 'Energy', text: 'Nuclear power should be part of the energy mix.',
    pos: { GOP: 1, ALP: -2, LIB: 2, GRN: -2, ONP: 2 }, note: 'GOP: supports nuclear. ALP platform: opposes nuclear power. Coalition 2025: nuclear plants plan. Greens: oppose nuclear. One Nation: lift the nuclear ban.' },
  { id: 'guns', topic: 'Guns', text: 'Stricter gun laws (e.g. universal background checks, assault-weapon bans) are needed.',
    pos: { DEM: 2, GOP: -2, ALP: 1, GRN: 2, ONP: -1 }, note: 'DEM: universal background checks & assault weapons ban. GOP: defend Second Amendment. ALP: uphold National Firearms Agreement. Greens: strengthen gun laws. One Nation: oppose further restrictions on licensed owners.' },
  { id: 'abortion', topic: 'Abortion', text: 'Access to abortion should be protected by law.',
    pos: { DEM: 2, GOP: -1, ALP: 2, GRN: 2 }, note: 'DEM: restore Roe v. Wade protections. GOP: leave to states, oppose late-term abortion. ALP: supports access to reproductive health care. Greens: free, safe, legal access. Liberal: conscience issue; One Nation: no clear position.' },
  { id: 'voterid', topic: 'Democracy', text: 'Voters should have to show photo ID to vote.',
    pos: { DEM: -1, GOP: 2, LIB: 1, GRN: -1, ONP: 2 }, note: 'GOP: voter ID. DEM: opposes restrictive voting laws. Coalition: introduced voter ID bill (2021). Greens: opposed it. One Nation: supports voter ID.' },
  { id: 'donations', topic: 'Democracy', text: 'Limits on political donations and campaign spending should be tightened.',
    pos: { DEM: 2, ALP: 2, GRN: 2 }, note: 'DEM: overturn Citizens United. ALP: donation & spending caps (2024 electoral reform). Greens: ban big donations.' },
  { id: 'ukraine', topic: 'Foreign policy', text: 'The country should keep providing military aid to Ukraine.',
    pos: { DEM: 2, ALP: 2, LIB: 2 }, note: 'DEM: support for Ukraine. ALP & Liberal: bipartisan support for Ukraine assistance. Other documents: no clear position.' },
  { id: 'alliances', topic: 'Foreign policy', text: 'Strong military alliances (such as NATO or AUKUS) make the country safer.',
    pos: { DEM: 2, GOP: 1, ALP: 2, LIB: 2, GRN: -2 }, note: 'DEM: strengthen NATO. GOP: “peace through strength”, allies to invest in defence. ALP & Liberal: support AUKUS. Greens: scrap AUKUS.' },
  { id: 'student', topic: 'Education', text: 'Government should cancel or reduce student debt.',
    pos: { DEM: 2, ALP: 2, GRN: 2 }, note: 'DEM: student debt relief. ALP: 20% HECS debt cut (2025). Greens: wipe student debt.' },
  { id: 'housing', topic: 'Housing', text: 'Government should directly fund much more public and social housing.',
    pos: { DEM: 1, ALP: 2, GRN: 2 }, note: 'DEM: build 3 million homes incl. affordable housing. ALP: Housing Australia Future Fund. Greens: build 1 million public homes.' },
  { id: 'foreignbuyers', topic: 'Housing', text: 'Foreign buyers should be restricted from buying existing homes.',
    pos: { GOP: 1, ALP: 1, LIB: 1, ONP: 2 }, note: 'GOP: restrict Chinese purchase of US land. ALP & Coalition: 2-year ban on foreign purchase of established homes (2025). One Nation: ban foreign ownership of homes & farmland.' },
];

export const SCALE = [
  { v: -2, label: 'Strongly disagree' },
  { v: -1, label: 'Disagree' },
  { v: 0, label: 'Neutral' },
  { v: 1, label: 'Agree' },
  { v: 2, label: 'Strongly agree' },
] as const;

export interface Answer { v: number | null; w: 1 | 2 | 3 }

/** Per-party agreement 0..100 (weighted). Skipped answers and unstated party positions are excluded. */
export function scoreParty(party: PartyId, answers: Record<string, Answer>) {
  let num = 0, den = 0, n = 0;
  const per: { id: string; agree: number | null }[] = [];
  for (const s of STATEMENTS) {
    const a = answers[s.id];
    const p = s.pos[party];
    if (!a || a.v == null || p == null) { per.push({ id: s.id, agree: null }); continue; }
    const agree = 1 - Math.abs(a.v - p) / 4;
    num += agree * a.w; den += a.w; n++;
    per.push({ id: s.id, agree });
  }
  return { pct: den ? Math.round((num / den) * 100) : null, n, per };
}
