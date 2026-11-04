// GENERATED from docs/research/australia.json (compiled 2026-11-04) by AU-DATA. Do not hand-edit facts;
// regenerate from research. Seat ids: federal = division slug ("kooyong"); vic = "vic-" + district slug.
// margin = 2025 (federal) / 2022-redistributed (Vic) two-candidate-preferred margin, % points above 50; null = unknown.

export interface AuSeat {
  id: string;
  name: string;
  state: string;
  party: string;
  member: string;
  margin: number | null;
  chamber: 'federal' | 'vic';
  /** federal: party that won the seat at the 2025 election, when different from current */
  party2025?: string;
  /** federal: 2025 contest type, e.g. "ALP", "IND v LIB" */
  contest?: string;
  /** vic: margin measured against */
  vs?: string;
  vacant?: boolean;
  note?: string;
}

export interface AuPoll {
  pollster: string;
  date: string; // yyyy-mm-dd (published, or fieldwork end)
  sample?: number;
  tpp: { ALP: number; LNP: number } | null;
  tppVsOnp?: { ALP: number; ONP: number };
  primary: Record<string, number>;
  note?: string;
}

export interface AuLeader { name: string; party?: string; seat?: string; since?: string; note?: string }

export const AU_PARTIES: Record<string, { name: string; short: string; color: string }> = {
  ALP: { name: 'Labor', short: 'ALP', color: '#e53940' },
  LIB: { name: 'Liberal', short: 'LIB', color: '#1c4f9c' },
  NAT: { name: 'Nationals', short: 'NAT', color: '#2c7d3f' },
  LNP: { name: 'Liberal National', short: 'LNP', color: '#2a62b8' },
  GRN: { name: 'Greens', short: 'GRN', color: '#10a35a' },
  ONP: { name: 'One Nation', short: 'ONP', color: '#f36c21' },
  IND: { name: 'Independent', short: 'IND', color: '#2bb3a8' },
  CSA: { name: 'Community Strong Australia', short: 'CSA', color: '#1f9e95' },
  KAP: { name: "Katter's Australian Party", short: 'KAP', color: '#8b1a1a' },
  CA: { name: 'Centre Alliance', short: 'CA', color: '#f2a900' },
  OTH: { name: 'Other', short: 'OTH', color: '#8b93a7' },
};

export const auPartyColor = (p: string): string => (AU_PARTIES[p] ?? AU_PARTIES.OTH).color;

export const FEDERAL: {
  electionDate: string;
  nextElectionDue: string;
  pm: AuLeader;
  opposition: AuLeader;
  house: Record<string, number>;
  houseAsOf: string;
  houseAfter2025: Record<string, number>;
  senate: Record<string, number>;
  senateAsOf: string;
  senateNote: string;
  seats: AuSeat[];
} = {
  electionDate: "2025-05-03",
  nextElectionDue: "by 2028 (TBD)",
  pm: {"name": "Anthony Albanese", "party": "ALP", "since": "2022-05-23"},
  opposition: {"name": "Angus Taylor", "party": "LIB", "note": "replaced Sussan Ley (date TBD, early 2026; Ley resigned Farrer 27 Feb 2026)"},
  house: {"ALP": 94, "LIB": 17, "LNP": 16, "NAT": 8, "ONP": 2, "GRN": 1, "CA": 1, "KAP": 1, "CSA": 2, "IND": 8},
  houseAsOf: "2026-06-25",
  houseAfter2025: {"ALP": 94, "LIB": 18, "LNP": 16, "NAT": 9, "GRN": 1, "CA": 1, "KAP": 1, "IND": 10},
  senate: {"GRN": 10, "ONP": 4, "IND": 2, "JLN": 1, "UAP": 1, "AV": 1, "ALP": 30, "LIB": 23, "NAT": 4},
  senateAsOf: "2026-05-14",
  senateNote: "LIB/NAT split per Wikipedia (LNP/CLP senators folded into party rooms). Crossbench breakdown inferred from start-of-parliament list minus Dorinda Cox (GRN->ALP Jun 2025) and Tammy Tyrrell (IND->ALP May 2026) - verify. Crossbench breakdown uncertain.",
  seats: [
    {"id": "adelaide", "name": "Adelaide", "state": "SA", "party": "ALP", "member": "Steve Georganas", "margin": 19.07, "chamber": "federal", "contest": "ALP"},
    {"id": "aston", "name": "Aston", "state": "VIC", "party": "ALP", "member": "Mary Doyle", "margin": 3.43, "chamber": "federal", "contest": "ALP"},
    {"id": "ballarat", "name": "Ballarat", "state": "VIC", "party": "ALP", "member": "Catherine King", "margin": 10.66, "chamber": "federal", "contest": "ALP"},
    {"id": "banks", "name": "Banks", "state": "NSW", "party": "ALP", "member": "Zhi Soon", "margin": 2.39, "chamber": "federal", "contest": "ALP"},
    {"id": "barker", "name": "Barker", "state": "SA", "party": "LIB", "member": "Tony Pasin", "margin": 12.98, "chamber": "federal", "contest": "LIB"},
    {"id": "barton", "name": "Barton", "state": "NSW", "party": "ALP", "member": "Ash Ambihaipahar", "margin": 16.0, "chamber": "federal", "contest": "ALP"},
    {"id": "bass", "name": "Bass", "state": "TAS", "party": "ALP", "member": "Jess Teesdale", "margin": 8.01, "chamber": "federal", "contest": "ALP"},
    {"id": "bean", "name": "Bean", "state": "ACT", "party": "ALP", "member": "David Smith", "margin": 0.34, "chamber": "federal", "contest": "ALP v IND"},
    {"id": "bendigo", "name": "Bendigo", "state": "VIC", "party": "ALP", "member": "Lisa Chesters", "margin": 1.4, "chamber": "federal", "contest": "ALP v NAT"},
    {"id": "bennelong", "name": "Bennelong", "state": "NSW", "party": "ALP", "member": "Jerome Laxale", "margin": 9.26, "chamber": "federal", "contest": "ALP"},
    {"id": "berowra", "name": "Berowra", "state": "NSW", "party": "LIB", "member": "Julian Leeser", "margin": 1.63, "chamber": "federal", "contest": "LIB"},
    {"id": "blair", "name": "Blair", "state": "QLD", "party": "ALP", "member": "Shayne Neumann", "margin": 5.71, "chamber": "federal", "contest": "ALP"},
    {"id": "blaxland", "name": "Blaxland", "state": "NSW", "party": "ALP", "member": "Jason Clare", "margin": 21.9, "chamber": "federal", "contest": "ALP"},
    {"id": "bonner", "name": "Bonner", "state": "QLD", "party": "ALP", "member": "Kara Cook", "margin": 5.0, "chamber": "federal", "contest": "ALP"},
    {"id": "boothby", "name": "Boothby", "state": "SA", "party": "ALP", "member": "Louise Miller-Frost", "margin": 11.1, "chamber": "federal", "contest": "ALP"},
    {"id": "bowman", "name": "Bowman", "state": "QLD", "party": "LNP", "member": "Henry Pike", "margin": 2.43, "chamber": "federal", "contest": "LNP"},
    {"id": "braddon", "name": "Braddon", "state": "TAS", "party": "ALP", "member": "Anne Urquhart", "margin": 7.2, "chamber": "federal", "contest": "ALP"},
    {"id": "bradfield", "name": "Bradfield", "state": "NSW", "party": "IND", "member": "Nicolette Boele", "margin": 0.01, "chamber": "federal", "contest": "IND v LIB"},
    {"id": "brand", "name": "Brand", "state": "WA", "party": "ALP", "member": "Madeleine King", "margin": 16.92, "chamber": "federal", "contest": "ALP"},
    {"id": "brisbane", "name": "Brisbane", "state": "QLD", "party": "ALP", "member": "Madonna Jarrett", "margin": 8.96, "chamber": "federal", "contest": "ALP"},
    {"id": "bruce", "name": "Bruce", "state": "VIC", "party": "ALP", "member": "Julian Hill", "margin": 14.62, "chamber": "federal", "contest": "ALP"},
    {"id": "bullwinkel", "name": "Bullwinkel", "state": "WA", "party": "ALP", "member": "Trish Cook", "margin": 0.51, "chamber": "federal", "contest": "ALP"},
    {"id": "burt", "name": "Burt", "state": "WA", "party": "ALP", "member": "Matt Keogh", "margin": 15.71, "chamber": "federal", "contest": "ALP"},
    {"id": "calare", "name": "Calare", "state": "NSW", "party": "IND", "member": "Andrew Gee", "margin": 6.78, "chamber": "federal", "contest": "IND v NAT"},
    {"id": "calwell", "name": "Calwell", "state": "VIC", "party": "ALP", "member": "Basem Abdo", "margin": 5.08, "chamber": "federal", "contest": "ALP v IND"},
    {"id": "canberra", "name": "Canberra", "state": "ACT", "party": "ALP", "member": "Alicia Payne", "margin": 19.52, "chamber": "federal", "contest": "ALP v GRN"},
    {"id": "canning", "name": "Canning", "state": "WA", "party": "LIB", "member": "Andrew Hastie", "margin": 6.55, "chamber": "federal", "contest": "LIB"},
    {"id": "capricornia", "name": "Capricornia", "state": "QLD", "party": "LNP", "member": "Michelle Landry", "margin": 5.83, "chamber": "federal", "contest": "LNP"},
    {"id": "casey", "name": "Casey", "state": "VIC", "party": "LIB", "member": "Aaron Violi", "margin": 2.89, "chamber": "federal", "contest": "LIB"},
    {"id": "chifley", "name": "Chifley", "state": "NSW", "party": "ALP", "member": "Ed Husic", "margin": 19.83, "chamber": "federal", "contest": "ALP"},
    {"id": "chisholm", "name": "Chisholm", "state": "VIC", "party": "ALP", "member": "Carina Garland", "margin": 5.7, "chamber": "federal", "contest": "ALP"},
    {"id": "clark", "name": "Clark", "state": "TAS", "party": "IND", "member": "Andrew Wilkie", "margin": 20.38, "chamber": "federal", "contest": "IND v ALP"},
    {"id": "cook", "name": "Cook", "state": "NSW", "party": "LIB", "member": "Simon Kennedy", "margin": 7.19, "chamber": "federal", "contest": "LIB"},
    {"id": "cooper", "name": "Cooper", "state": "VIC", "party": "ALP", "member": "Ged Kearney", "margin": 9.72, "chamber": "federal", "contest": "ALP v GRN"},
    {"id": "corangamite", "name": "Corangamite", "state": "VIC", "party": "ALP", "member": "Libby Coker", "margin": 8.05, "chamber": "federal", "contest": "ALP"},
    {"id": "corio", "name": "Corio", "state": "VIC", "party": "ALP", "member": "Richard Marles", "margin": 13.23, "chamber": "federal", "contest": "ALP"},
    {"id": "cowan", "name": "Cowan", "state": "WA", "party": "ALP", "member": "Anne Aly", "margin": 13.63, "chamber": "federal", "contest": "ALP"},
    {"id": "cowper", "name": "Cowper", "state": "NSW", "party": "NAT", "member": "Pat Conaghan", "margin": 2.54, "chamber": "federal", "contest": "NAT v IND"},
    {"id": "cunningham", "name": "Cunningham", "state": "NSW", "party": "ALP", "member": "Alison Byrnes", "margin": 17.52, "chamber": "federal", "contest": "ALP"},
    {"id": "curtin", "name": "Curtin", "state": "WA", "party": "IND", "member": "Kate Chaney", "margin": 3.27, "chamber": "federal", "contest": "IND v LIB"},
    {"id": "dawson", "name": "Dawson", "state": "QLD", "party": "LNP", "member": "Andrew Willcox", "margin": 11.83, "chamber": "federal", "contest": "LNP"},
    {"id": "deakin", "name": "Deakin", "state": "VIC", "party": "ALP", "member": "Matt Gregg", "margin": 2.82, "chamber": "federal", "contest": "ALP"},
    {"id": "dickson", "name": "Dickson", "state": "QLD", "party": "ALP", "member": "Ali France", "margin": 5.99, "chamber": "federal", "contest": "ALP"},
    {"id": "dobell", "name": "Dobell", "state": "NSW", "party": "ALP", "member": "Emma McBride", "margin": 9.43, "chamber": "federal", "contest": "ALP"},
    {"id": "dunkley", "name": "Dunkley", "state": "VIC", "party": "ALP", "member": "Jodie Belyea", "margin": 7.08, "chamber": "federal", "contest": "ALP"},
    {"id": "durack", "name": "Durack", "state": "WA", "party": "LIB", "member": "Melissa Price", "margin": 10.15, "chamber": "federal", "contest": "LIB"},
    {"id": "eden-monaro", "name": "Eden-Monaro", "state": "NSW", "party": "ALP", "member": "Kristy McBain", "margin": 7.21, "chamber": "federal", "contest": "ALP"},
    {"id": "fadden", "name": "Fadden", "state": "QLD", "party": "LNP", "member": "Cameron Caldwell", "margin": 6.88, "chamber": "federal", "contest": "LNP"},
    {"id": "fairfax", "name": "Fairfax", "state": "QLD", "party": "LNP", "member": "Ted O'Brien", "margin": 3.23, "chamber": "federal", "contest": "LNP"},
    {"id": "farrer", "name": "Farrer", "state": "NSW", "party": "ONP", "member": "David Farley", "margin": 6.19, "chamber": "federal", "party2025": "LIB", "contest": "LIB v IND", "note": "Sussan Ley (LIB) resigned 27 Feb 2026; One Nation won by-election 9 May 2026; 2025 margin no longer applicable"},
    {"id": "fenner", "name": "Fenner", "state": "ACT", "party": "ALP", "member": "Andrew Leigh", "margin": 22.08, "chamber": "federal", "contest": "ALP"},
    {"id": "fisher", "name": "Fisher", "state": "QLD", "party": "LNP", "member": "Andrew Wallace", "margin": 6.03, "chamber": "federal", "contest": "LNP"},
    {"id": "flinders", "name": "Flinders", "state": "VIC", "party": "LIB", "member": "Zoe McKenzie", "margin": 2.29, "chamber": "federal", "contest": "LIB v IND"},
    {"id": "flynn", "name": "Flynn", "state": "QLD", "party": "LNP", "member": "Colin Boyce", "margin": 10.24, "chamber": "federal", "contest": "LNP"},
    {"id": "forde", "name": "Forde", "state": "QLD", "party": "ALP", "member": "Rowan Holzberger", "margin": 1.77, "chamber": "federal", "contest": "ALP"},
    {"id": "forrest", "name": "Forrest", "state": "WA", "party": "LIB", "member": "Ben Small", "margin": 2.24, "chamber": "federal", "contest": "LIB"},
    {"id": "fowler", "name": "Fowler", "state": "NSW", "party": "IND", "member": "Dai Le", "margin": 2.68, "chamber": "federal", "contest": "IND v ALP"},
    {"id": "franklin", "name": "Franklin", "state": "TAS", "party": "ALP", "member": "Julie Collins", "margin": 7.78, "chamber": "federal", "contest": "ALP v IND"},
    {"id": "fraser", "name": "Fraser", "state": "VIC", "party": "ALP", "member": "Daniel Mulino", "margin": 9.23, "chamber": "federal", "contest": "ALP v GRN"},
    {"id": "fremantle", "name": "Fremantle", "state": "WA", "party": "ALP", "member": "Josh Wilson", "margin": 0.69, "chamber": "federal", "contest": "ALP v IND"},
    {"id": "gellibrand", "name": "Gellibrand", "state": "VIC", "party": "ALP", "member": "Tim Watts", "margin": 15.1, "chamber": "federal", "contest": "ALP"},
    {"id": "gilmore", "name": "Gilmore", "state": "NSW", "party": "ALP", "member": "Fiona Phillips", "margin": 5.13, "chamber": "federal", "contest": "ALP"},
    {"id": "gippsland", "name": "Gippsland", "state": "VIC", "party": "NAT", "member": "Darren Chester", "margin": 19.36, "chamber": "federal", "contest": "NAT"},
    {"id": "goldstein", "name": "Goldstein", "state": "VIC", "party": "LIB", "member": "Tim Wilson", "margin": 0.08, "chamber": "federal", "contest": "LIB v IND"},
    {"id": "gorton", "name": "Gorton", "state": "VIC", "party": "ALP", "member": "Alice Jordan-Baird", "margin": 10.28, "chamber": "federal", "contest": "ALP"},
    {"id": "grayndler", "name": "Grayndler", "state": "NSW", "party": "ALP", "member": "Anthony Albanese", "margin": 16.86, "chamber": "federal", "contest": "ALP v GRN"},
    {"id": "greenway", "name": "Greenway", "state": "NSW", "party": "ALP", "member": "Michelle Rowland", "margin": 13.76, "chamber": "federal", "contest": "ALP"},
    {"id": "grey", "name": "Grey", "state": "SA", "party": "LIB", "member": "Tom Venning", "margin": 4.64, "chamber": "federal", "contest": "LIB"},
    {"id": "griffith", "name": "Griffith", "state": "QLD", "party": "ALP", "member": "Renee Coffey", "margin": 10.57, "chamber": "federal", "contest": "ALP v GRN"},
    {"id": "groom", "name": "Groom", "state": "QLD", "party": "LNP", "member": "Garth Hamilton", "margin": 5.67, "chamber": "federal", "contest": "LNP v IND"},
    {"id": "hasluck", "name": "Hasluck", "state": "WA", "party": "ALP", "member": "Tania Lawrence", "margin": 15.97, "chamber": "federal", "contest": "ALP"},
    {"id": "hawke", "name": "Hawke", "state": "VIC", "party": "ALP", "member": "Sam Rae", "margin": 7.63, "chamber": "federal", "contest": "ALP"},
    {"id": "herbert", "name": "Herbert", "state": "QLD", "party": "LNP", "member": "Phillip Thompson", "margin": 13.41, "chamber": "federal", "contest": "LNP"},
    {"id": "hindmarsh", "name": "Hindmarsh", "state": "SA", "party": "ALP", "member": "Mark Butler", "margin": 16.35, "chamber": "federal", "contest": "ALP"},
    {"id": "hinkler", "name": "Hinkler", "state": "QLD", "party": "LNP", "member": "David Batt", "margin": 6.26, "chamber": "federal", "contest": "LNP"},
    {"id": "holt", "name": "Holt", "state": "VIC", "party": "ALP", "member": "Cassandra Fernando", "margin": 14.03, "chamber": "federal", "contest": "ALP"},
    {"id": "hotham", "name": "Hotham", "state": "VIC", "party": "ALP", "member": "Clare O'Neil", "margin": 16.86, "chamber": "federal", "contest": "ALP"},
    {"id": "hughes", "name": "Hughes", "state": "NSW", "party": "ALP", "member": "David Moncrieff", "margin": 3.06, "chamber": "federal", "contest": "ALP"},
    {"id": "hume", "name": "Hume", "state": "NSW", "party": "LIB", "member": "Angus Taylor", "margin": 8.06, "chamber": "federal", "contest": "LIB"},
    {"id": "hunter", "name": "Hunter", "state": "NSW", "party": "ALP", "member": "Daniel Repacholi", "margin": 9.04, "chamber": "federal", "contest": "ALP v ONP"},
    {"id": "indi", "name": "Indi", "state": "VIC", "party": "IND", "member": "Helen Haines", "margin": 8.64, "chamber": "federal", "contest": "IND v LIB"},
    {"id": "isaacs", "name": "Isaacs", "state": "VIC", "party": "ALP", "member": "Mark Dreyfus", "margin": 14.34, "chamber": "federal", "contest": "ALP"},
    {"id": "jagajaga", "name": "Jagajaga", "state": "VIC", "party": "ALP", "member": "Kate Thwaites", "margin": 12.88, "chamber": "federal", "contest": "ALP"},
    {"id": "kennedy", "name": "Kennedy", "state": "QLD", "party": "KAP", "member": "Bob Katter", "margin": 15.75, "chamber": "federal", "contest": "KAP v LNP"},
    {"id": "kingsford-smith", "name": "Kingsford Smith", "state": "NSW", "party": "ALP", "member": "Matt Thistlethwaite", "margin": 17.19, "chamber": "federal", "contest": "ALP"},
    {"id": "kingston", "name": "Kingston", "state": "SA", "party": "ALP", "member": "Amanda Rishworth", "margin": 20.74, "chamber": "federal", "contest": "ALP"},
    {"id": "kooyong", "name": "Kooyong", "state": "VIC", "party": "IND", "member": "Monique Ryan", "margin": 0.67, "chamber": "federal", "contest": "IND v LIB"},
    {"id": "la-trobe", "name": "La Trobe", "state": "VIC", "party": "LIB", "member": "Jason Wood", "margin": 2.06, "chamber": "federal", "contest": "LIB"},
    {"id": "lalor", "name": "Lalor", "state": "VIC", "party": "ALP", "member": "Joanne Ryan", "margin": 13.21, "chamber": "federal", "contest": "ALP"},
    {"id": "leichhardt", "name": "Leichhardt", "state": "QLD", "party": "ALP", "member": "Matt Smith", "margin": 6.06, "chamber": "federal", "contest": "ALP"},
    {"id": "lilley", "name": "Lilley", "state": "QLD", "party": "ALP", "member": "Anika Wells", "margin": 14.52, "chamber": "federal", "contest": "ALP"},
    {"id": "lindsay", "name": "Lindsay", "state": "NSW", "party": "LIB", "member": "Melissa McIntosh", "margin": 2.78, "chamber": "federal", "contest": "LIB"},
    {"id": "lingiari", "name": "Lingiari", "state": "NT", "party": "ALP", "member": "Marion Scrymgour", "margin": 8.13, "chamber": "federal", "contest": "ALP"},
    {"id": "longman", "name": "Longman", "state": "QLD", "party": "LNP", "member": "Terry Young", "margin": 0.11, "chamber": "federal", "contest": "LNP"},
    {"id": "lyne", "name": "Lyne", "state": "NSW", "party": "NAT", "member": "Alison Penfold", "margin": 9.78, "chamber": "federal", "contest": "NAT"},
    {"id": "lyons", "name": "Lyons", "state": "TAS", "party": "ALP", "member": "Rebecca White", "margin": 11.58, "chamber": "federal", "contest": "ALP"},
    {"id": "macarthur", "name": "Macarthur", "state": "NSW", "party": "ALP", "member": "Mike Freelander", "margin": 15.61, "chamber": "federal", "contest": "ALP"},
    {"id": "mackellar", "name": "Mackellar", "state": "NSW", "party": "IND", "member": "Sophie Scamps", "margin": 5.66, "chamber": "federal", "contest": "IND v LIB"},
    {"id": "macnamara", "name": "Macnamara", "state": "VIC", "party": "ALP", "member": "Josh Burns", "margin": 11.8, "chamber": "federal", "contest": "ALP"},
    {"id": "macquarie", "name": "Macquarie", "state": "NSW", "party": "ALP", "member": "Susan Templeman", "margin": 7.71, "chamber": "federal", "contest": "ALP"},
    {"id": "makin", "name": "Makin", "state": "SA", "party": "ALP", "member": "Tony Zappia", "margin": 14.66, "chamber": "federal", "contest": "ALP"},
    {"id": "mallee", "name": "Mallee", "state": "VIC", "party": "NAT", "member": "Anne Webster", "margin": 19.04, "chamber": "federal", "contest": "NAT"},
    {"id": "maranoa", "name": "Maranoa", "state": "QLD", "party": "LNP", "member": "David Littleproud", "margin": 20.1, "chamber": "federal", "contest": "LNP v ONP"},
    {"id": "maribyrnong", "name": "Maribyrnong", "state": "VIC", "party": "ALP", "member": "Jo Briskey", "margin": 12.65, "chamber": "federal", "contest": "ALP"},
    {"id": "mayo", "name": "Mayo", "state": "SA", "party": "CA", "member": "Rebekha Sharkie", "margin": 14.89, "chamber": "federal", "contest": "CA v ALP"},
    {"id": "mcewen", "name": "McEwen", "state": "VIC", "party": "ALP", "member": "Rob Mitchell", "margin": 4.76, "chamber": "federal", "contest": "ALP"},
    {"id": "mcmahon", "name": "McMahon", "state": "NSW", "party": "ALP", "member": "Chris Bowen", "margin": 9.02, "chamber": "federal", "contest": "ALP"},
    {"id": "mcpherson", "name": "McPherson", "state": "QLD", "party": "LNP", "member": "Leon Rebello", "margin": 4.44, "chamber": "federal", "contest": "LNP"},
    {"id": "melbourne", "name": "Melbourne", "state": "VIC", "party": "ALP", "member": "Sarah Witty", "margin": 3.02, "chamber": "federal", "contest": "ALP v GRN"},
    {"id": "menzies", "name": "Menzies", "state": "VIC", "party": "ALP", "member": "Gabriel Ng", "margin": 1.08, "chamber": "federal", "contest": "ALP"},
    {"id": "mitchell", "name": "Mitchell", "state": "NSW", "party": "LIB", "member": "Alex Hawke", "margin": 3.81, "chamber": "federal", "contest": "LIB"},
    {"id": "monash", "name": "Monash", "state": "VIC", "party": "LIB", "member": "Mary Aldred", "margin": 4.09, "chamber": "federal", "contest": "LIB"},
    {"id": "moncrieff", "name": "Moncrieff", "state": "QLD", "party": "LNP", "member": "Angie Bell", "margin": 8.8, "chamber": "federal", "contest": "LNP"},
    {"id": "moore", "name": "Moore", "state": "WA", "party": "ALP", "member": "Tom French", "margin": 2.89, "chamber": "federal", "contest": "ALP"},
    {"id": "moreton", "name": "Moreton", "state": "QLD", "party": "ALP", "member": "Julie-Ann Campbell", "margin": 16.09, "chamber": "federal", "contest": "ALP"},
    {"id": "new-england", "name": "New England", "state": "NSW", "party": "ONP", "member": "Barnaby Joyce", "margin": 17.06, "chamber": "federal", "party2025": "NAT", "contest": "NAT", "note": "Elected as NAT 2025; quit Nationals 27 Nov 2025, joined One Nation 8 Dec 2025"},
    {"id": "newcastle", "name": "Newcastle", "state": "NSW", "party": "ALP", "member": "Sharon Claydon", "margin": 15.8, "chamber": "federal", "contest": "ALP v GRN"},
    {"id": "nicholls", "name": "Nicholls", "state": "VIC", "party": "NAT", "member": "Sam Birrell", "margin": 14.38, "chamber": "federal", "contest": "NAT"},
    {"id": "o-connor", "name": "O'Connor", "state": "WA", "party": "LIB", "member": "Rick Wilson", "margin": 13.28, "chamber": "federal", "contest": "LIB"},
    {"id": "oxley", "name": "Oxley", "state": "QLD", "party": "ALP", "member": "Milton Dick", "margin": 19.19, "chamber": "federal", "contest": "ALP"},
    {"id": "page", "name": "Page", "state": "NSW", "party": "NAT", "member": "Kevin Hogan", "margin": 9.29, "chamber": "federal", "contest": "NAT"},
    {"id": "parkes", "name": "Parkes", "state": "NSW", "party": "NAT", "member": "Jamie Chaffey", "margin": 12.97, "chamber": "federal", "contest": "NAT"},
    {"id": "parramatta", "name": "Parramatta", "state": "NSW", "party": "ALP", "member": "Andrew Charlton", "margin": 12.55, "chamber": "federal", "contest": "ALP"},
    {"id": "paterson", "name": "Paterson", "state": "NSW", "party": "ALP", "member": "Meryl Swanson", "margin": 6.89, "chamber": "federal", "contest": "ALP"},
    {"id": "pearce", "name": "Pearce", "state": "WA", "party": "ALP", "member": "Tracey Roberts", "margin": 6.44, "chamber": "federal", "contest": "ALP"},
    {"id": "perth", "name": "Perth", "state": "WA", "party": "ALP", "member": "Patrick Gorman", "margin": 16.51, "chamber": "federal", "contest": "ALP"},
    {"id": "petrie", "name": "Petrie", "state": "QLD", "party": "ALP", "member": "Emma Comer", "margin": 1.17, "chamber": "federal", "contest": "ALP"},
    {"id": "rankin", "name": "Rankin", "state": "QLD", "party": "ALP", "member": "Jim Chalmers", "margin": 15.55, "chamber": "federal", "contest": "ALP"},
    {"id": "reid", "name": "Reid", "state": "NSW", "party": "ALP", "member": "Sally Sitou", "margin": 12.01, "chamber": "federal", "contest": "ALP"},
    {"id": "richmond", "name": "Richmond", "state": "NSW", "party": "ALP", "member": "Justine Elliot", "margin": 10.0, "chamber": "federal", "contest": "ALP"},
    {"id": "riverina", "name": "Riverina", "state": "NSW", "party": "NAT", "member": "Michael McCormack", "margin": 12.62, "chamber": "federal", "contest": "NAT"},
    {"id": "robertson", "name": "Robertson", "state": "NSW", "party": "ALP", "member": "Gordon Reid", "margin": 9.37, "chamber": "federal", "contest": "ALP"},
    {"id": "ryan", "name": "Ryan", "state": "QLD", "party": "GRN", "member": "Elizabeth Watson-Brown", "margin": 3.27, "chamber": "federal", "contest": "GRN v LNP"},
    {"id": "scullin", "name": "Scullin", "state": "VIC", "party": "ALP", "member": "Andrew Giles", "margin": 14.29, "chamber": "federal", "contest": "ALP"},
    {"id": "shortland", "name": "Shortland", "state": "NSW", "party": "ALP", "member": "Pat Conroy", "margin": 11.51, "chamber": "federal", "contest": "ALP"},
    {"id": "solomon", "name": "Solomon", "state": "NT", "party": "ALP", "member": "Luke Gosling", "margin": 1.31, "chamber": "federal", "contest": "ALP"},
    {"id": "spence", "name": "Spence", "state": "SA", "party": "ALP", "member": "Matt Burnell", "margin": 15.34, "chamber": "federal", "contest": "ALP"},
    {"id": "sturt", "name": "Sturt", "state": "SA", "party": "ALP", "member": "Claire Clutterham", "margin": 6.62, "chamber": "federal", "contest": "ALP"},
    {"id": "swan", "name": "Swan", "state": "WA", "party": "ALP", "member": "Zaneta Mascarenhas", "margin": 13.99, "chamber": "federal", "contest": "ALP"},
    {"id": "sydney", "name": "Sydney", "state": "NSW", "party": "ALP", "member": "Tanya Plibersek", "margin": 20.95, "chamber": "federal", "contest": "ALP v GRN"},
    {"id": "tangney", "name": "Tangney", "state": "WA", "party": "ALP", "member": "Sam Lim", "margin": 6.99, "chamber": "federal", "contest": "ALP"},
    {"id": "wannon", "name": "Wannon", "state": "VIC", "party": "LIB", "member": "Dan Tehan", "margin": 3.27, "chamber": "federal", "contest": "LIB v IND"},
    {"id": "warringah", "name": "Warringah", "state": "NSW", "party": "CSA", "member": "Zali Steggall", "margin": 11.2, "chamber": "federal", "party2025": "IND", "contest": "IND v LIB", "note": "Founded Community Strong Australia 25 Jun 2026 (was IND)"},
    {"id": "watson", "name": "Watson", "state": "NSW", "party": "ALP", "member": "Tony Burke", "margin": 16.52, "chamber": "federal", "contest": "ALP v IND"},
    {"id": "wentworth", "name": "Wentworth", "state": "NSW", "party": "CSA", "member": "Allegra Spender", "margin": 8.34, "chamber": "federal", "party2025": "IND", "contest": "IND v LIB", "note": "Founded Community Strong Australia 25 Jun 2026 (was IND)"},
    {"id": "werriwa", "name": "Werriwa", "state": "NSW", "party": "ALP", "member": "Anne Stanley", "margin": 6.77, "chamber": "federal", "contest": "ALP"},
    {"id": "whitlam", "name": "Whitlam", "state": "NSW", "party": "ALP", "member": "Carol Berry", "margin": 6.25, "chamber": "federal", "contest": "ALP"},
    {"id": "wide-bay", "name": "Wide Bay", "state": "QLD", "party": "LNP", "member": "Llew O'Brien", "margin": 7.63, "chamber": "federal", "contest": "LNP"},
    {"id": "wills", "name": "Wills", "state": "VIC", "party": "ALP", "member": "Peter Khalil", "margin": 1.43, "chamber": "federal", "contest": "ALP v GRN"},
    {"id": "wright", "name": "Wright", "state": "QLD", "party": "LNP", "member": "Scott Buchholz", "margin": 7.98, "chamber": "federal", "contest": "LNP"},
  ],
};

export const VICTORIA: {
  date: '2026-11-28';
  pollsCloseUtc: string;
  seats: AuSeat[];
  totalSeats: number;
  majority: number;
  upperHouse: number;
  timeline: Record<string, string>;
  premier: AuLeader;
  opposition: AuLeader;
  otherLeaders: Record<string, AuLeader>;
  composition: Record<string, number>;
  compositionNote: string;
} = {
  date: '2026-11-28',
  pollsCloseUtc: "2026-11-28T07:00:00Z",
  totalSeats: 88,
  majority: 45,
  upperHouse: 40,
  timeline: {"writsIssued": "2026-11-03", "rollsClose": "2026-11-10 20:00", "nominationsClose": "2026-11-13 12:00", "earlyVoting": "2026-11-18", "writsReturn": "by 2026-12-19"},
  premier: {"name": "Ben Carroll", "party": "ALP", "seat": "Niddrie", "since": "2026-07-28"},
  opposition: {"name": "Jess Wilson", "party": "LIB", "seat": "Kew", "since": "2025-11-18"},
  otherLeaders: {"greens": {"name": "Ellen Sandell", "seat": "Melbourne"}, "oneNation": {"name": "Warren Pickering", "seat": "contesting Pakenham", "since": "2026-08-02"}, "nationals": {"name": "Danny O'Brien", "note": "unverified - inferred from Polymarket candidate list"}},
  composition: {"ALP": 54, "GRN": 2, "IND": 2, "vacant": 1, "LIB/NAT": 29},
  compositionNote: "IND = Will Fowles, Darren Cheeseman (ex-Labor); vacant = Brunswick",
  seats: [
    {"id": "vic-albert-park", "name": "Albert Park", "state": "VIC", "party": "ALP", "member": "Nina Taylor", "margin": 11.2, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-ashwood", "name": "Ashwood", "state": "VIC", "party": "ALP", "member": "Matt Fregon", "margin": 6.2, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-bass", "name": "Bass", "state": "VIC", "party": "ALP", "member": "Jordan Crugnale", "margin": 0.2, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-bayswater", "name": "Bayswater", "state": "VIC", "party": "ALP", "member": "Jackson Taylor", "margin": 4.2, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-bellarine", "name": "Bellarine", "state": "VIC", "party": "ALP", "member": "Alison Marchant", "margin": 8.5, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-benambra", "name": "Benambra", "state": "VIC", "party": "LIB", "member": "Bill Tilley", "margin": 0.9, "chamber": "vic", "vs": "IND"},
    {"id": "vic-bendigo-east", "name": "Bendigo East", "state": "VIC", "party": "ALP", "member": "Jacinta Allan", "margin": 10.8, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-bendigo-west", "name": "Bendigo West", "state": "VIC", "party": "ALP", "member": "Maree Edwards", "margin": 14.6, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-bentleigh", "name": "Bentleigh", "state": "VIC", "party": "ALP", "member": "Nick Staikos", "margin": 8.0, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-berwick", "name": "Berwick", "state": "VIC", "party": "LIB", "member": "Brad Battin", "margin": 4.7, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-box-hill", "name": "Box Hill", "state": "VIC", "party": "ALP", "member": "Paul Hamer", "margin": 7.2, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-brighton", "name": "Brighton", "state": "VIC", "party": "LIB", "member": "James Newbury", "margin": 5.1, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-broadmeadows", "name": "Broadmeadows", "state": "VIC", "party": "ALP", "member": "Kathleen Matthews-Ward", "margin": 15.5, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-brunswick", "name": "Brunswick", "state": "VIC", "party": "GRN", "member": "Vacant", "margin": 13.7, "chamber": "vic", "vacant": true, "vs": "ALP", "note": "Tim Read (GRN) died 19 Sep 2026; seat vacant"},
    {"id": "vic-bulleen", "name": "Bulleen", "state": "VIC", "party": "LIB", "member": "Matthew Guy", "margin": 5.9, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-bundoora", "name": "Bundoora", "state": "VIC", "party": "ALP", "member": "Colin Brooks", "margin": 12.7, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-carrum", "name": "Carrum", "state": "VIC", "party": "ALP", "member": "Sonya Kilkenny", "margin": 9.8, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-caulfield", "name": "Caulfield", "state": "VIC", "party": "LIB", "member": "David Southwick", "margin": 2.1, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-clarinda", "name": "Clarinda", "state": "VIC", "party": "ALP", "member": "Meng Heang Tak", "margin": 10.2, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-cranbourne", "name": "Cranbourne", "state": "VIC", "party": "ALP", "member": "Pauline Richards", "margin": 9.0, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-croydon", "name": "Croydon", "state": "VIC", "party": "LIB", "member": "David Hodgett", "margin": 1.4, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-dandenong", "name": "Dandenong", "state": "VIC", "party": "ALP", "member": "Gabrielle Williams", "margin": 18.3, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-eildon", "name": "Eildon", "state": "VIC", "party": "LIB", "member": "Cindy McLeish", "margin": 7.0, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-eltham", "name": "Eltham", "state": "VIC", "party": "ALP", "member": "Vicki Ward", "margin": 9.0, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-essendon", "name": "Essendon", "state": "VIC", "party": "ALP", "member": "Danny Pearson", "margin": 12.5, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-eureka", "name": "Eureka", "state": "VIC", "party": "ALP", "member": "Michaela Settle", "margin": 7.2, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-euroa", "name": "Euroa", "state": "VIC", "party": "NAT", "member": "Annabelle Cleeland", "margin": 9.9, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-evelyn", "name": "Evelyn", "state": "VIC", "party": "LIB", "member": "Bridget Vallence", "margin": 5.4, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-footscray", "name": "Footscray", "state": "VIC", "party": "ALP", "member": "Katie Hall", "margin": 4.2, "chamber": "vic", "vs": "GRN"},
    {"id": "vic-frankston", "name": "Frankston", "state": "VIC", "party": "ALP", "member": "Paul Edbrooke", "margin": 8.7, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-geelong", "name": "Geelong", "state": "VIC", "party": "ALP", "member": "Christine Couzens", "margin": 14.7, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-gippsland-east", "name": "Gippsland East", "state": "VIC", "party": "NAT", "member": "Tim Bull", "margin": 24.6, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-gippsland-south", "name": "Gippsland South", "state": "VIC", "party": "NAT", "member": "Danny O'Brien", "margin": 15.6, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-glen-waverley", "name": "Glen Waverley", "state": "VIC", "party": "ALP", "member": "John Mullahy", "margin": 3.3, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-greenvale", "name": "Greenvale", "state": "VIC", "party": "ALP", "member": "Iwan Walters", "margin": 7.1, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-hastings", "name": "Hastings", "state": "VIC", "party": "ALP", "member": "Paul Mercurio", "margin": 1.4, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-hawthorn", "name": "Hawthorn", "state": "VIC", "party": "LIB", "member": "John Pesutto", "margin": 1.7, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-ivanhoe", "name": "Ivanhoe", "state": "VIC", "party": "ALP", "member": "Anthony Carbines", "margin": 13.0, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-kalkallo", "name": "Kalkallo", "state": "VIC", "party": "ALP", "member": "Ros Spence", "margin": 16.5, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-kew", "name": "Kew", "state": "VIC", "party": "LIB", "member": "Jess Wilson", "margin": 4.0, "chamber": "vic", "vs": "ALP", "note": "Opposition leader Jess Wilson"},
    {"id": "vic-kororoit", "name": "Kororoit", "state": "VIC", "party": "ALP", "member": "Luba Grigorovitch", "margin": 14.5, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-lara", "name": "Lara", "state": "VIC", "party": "ALP", "member": "Ella George", "margin": 15.9, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-laverton", "name": "Laverton", "state": "VIC", "party": "ALP", "member": "Sarah Connolly", "margin": 18.4, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-lowan", "name": "Lowan", "state": "VIC", "party": "NAT", "member": "Emma Kealy", "margin": 21.6, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-macedon", "name": "Macedon", "state": "VIC", "party": "ALP", "member": "Mary-Anne Thomas", "margin": 9.5, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-malvern", "name": "Malvern", "state": "VIC", "party": "LIB", "member": "Michael O'Brien", "margin": 8.1, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-melbourne", "name": "Melbourne", "state": "VIC", "party": "GRN", "member": "Ellen Sandell", "margin": 10.2, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-melton", "name": "Melton", "state": "VIC", "party": "ALP", "member": "Steve McGhie", "margin": 4.6, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-mildura", "name": "Mildura", "state": "VIC", "party": "NAT", "member": "Jade Benham", "margin": 1.2, "chamber": "vic", "vs": "IND"},
    {"id": "vic-mill-park", "name": "Mill Park", "state": "VIC", "party": "ALP", "member": "Lily D'Ambrosio", "margin": 11.6, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-monbulk", "name": "Monbulk", "state": "VIC", "party": "ALP", "member": "Daniela De Martino", "margin": 7.6, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-mordialloc", "name": "Mordialloc", "state": "VIC", "party": "ALP", "member": "Tim Richardson", "margin": 8.2, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-mornington", "name": "Mornington", "state": "VIC", "party": "LIB", "member": "Chris Crewther", "margin": 0.7, "chamber": "vic", "vs": "IND"},
    {"id": "vic-morwell", "name": "Morwell", "state": "VIC", "party": "NAT", "member": "Martin Cameron", "margin": 4.4, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-mulgrave", "name": "Mulgrave", "state": "VIC", "party": "ALP", "member": "Eden Foster", "margin": 10.8, "chamber": "vic", "vs": "IND"},
    {"id": "vic-murray-plains", "name": "Murray Plains", "state": "VIC", "party": "NAT", "member": "Peter Walsh", "margin": 23.4, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-narracan", "name": "Narracan", "state": "VIC", "party": "LIB", "member": "Wayne Farnham", "margin": 13.0, "chamber": "vic", "vs": "IND"},
    {"id": "vic-narre-warren-north", "name": "Narre Warren North", "state": "VIC", "party": "ALP", "member": "Belinda Wilson", "margin": 8.7, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-narre-warren-south", "name": "Narre Warren South", "state": "VIC", "party": "ALP", "member": "Gary Maas", "margin": 8.3, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-nepean", "name": "Nepean", "state": "VIC", "party": "LIB", "member": "Sam Groth", "margin": 6.4, "chamber": "vic", "vs": "ALP", "note": "By-election May 2026; Wikipedia pendulum still lists Sam Groth - verify current member"},
    {"id": "vic-niddrie", "name": "Niddrie", "state": "VIC", "party": "ALP", "member": "Ben Carroll", "margin": 6.7, "chamber": "vic", "vs": "LIB/NAT", "note": "Premier Ben Carroll"},
    {"id": "vic-northcote", "name": "Northcote", "state": "VIC", "party": "ALP", "member": "Kat Theophanous", "margin": 0.2, "chamber": "vic", "vs": "GRN"},
    {"id": "vic-oakleigh", "name": "Oakleigh", "state": "VIC", "party": "ALP", "member": "Steve Dimopoulos", "margin": 13.5, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-ovens-valley", "name": "Ovens Valley", "state": "VIC", "party": "NAT", "member": "Tim McCurdy", "margin": 17.8, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-pakenham", "name": "Pakenham", "state": "VIC", "party": "ALP", "member": "Emma Vulin", "margin": 0.4, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-pascoe-vale", "name": "Pascoe Vale", "state": "VIC", "party": "ALP", "member": "Anthony Cianflone", "margin": 2.0, "chamber": "vic", "vs": "GRN"},
    {"id": "vic-point-cook", "name": "Point Cook", "state": "VIC", "party": "ALP", "member": "Mathew Hilakari", "margin": 8.3, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-polwarth", "name": "Polwarth", "state": "VIC", "party": "LIB", "member": "Richard Riordan", "margin": 1.8, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-prahran", "name": "Prahran", "state": "VIC", "party": "LIB", "member": "Rachel Westaway", "margin": null, "chamber": "vic", "note": "LIB gain at Feb 2025 by-election (Rachel Westaway); Wikipedia margin \"12.0% v LIB\" is garbled - TBD"},
    {"id": "vic-preston", "name": "Preston", "state": "VIC", "party": "ALP", "member": "Nathan Lambert", "margin": 2.1, "chamber": "vic", "vs": "GRN"},
    {"id": "vic-richmond", "name": "Richmond", "state": "VIC", "party": "GRN", "member": "Gabrielle de Vietri", "margin": 7.3, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-ringwood", "name": "Ringwood", "state": "VIC", "party": "ALP", "member": "Will Fowles (IND)", "margin": 7.5, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-ripon", "name": "Ripon", "state": "VIC", "party": "ALP", "member": "Martha Haylett", "margin": 3.0, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-rowville", "name": "Rowville", "state": "VIC", "party": "LIB", "member": "Kim Wells", "margin": 3.7, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-sandringham", "name": "Sandringham", "state": "VIC", "party": "LIB", "member": "Brad Rowswell", "margin": 5.0, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-shepparton", "name": "Shepparton", "state": "VIC", "party": "NAT", "member": "Kim O'Keeffe", "margin": 6.8, "chamber": "vic", "vs": "IND"},
    {"id": "vic-south-barwon", "name": "South Barwon", "state": "VIC", "party": "IND", "member": "Darren Cheeseman", "margin": 9.8, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-south-west-coast", "name": "South-West Coast", "state": "VIC", "party": "LIB", "member": "Roma Britnell", "margin": 8.0, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-st-albans", "name": "St Albans", "state": "VIC", "party": "ALP", "member": "Natalie Suleyman", "margin": 9.6, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-sunbury", "name": "Sunbury", "state": "VIC", "party": "ALP", "member": "Josh Bull", "margin": 6.4, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-sydenham", "name": "Sydenham", "state": "VIC", "party": "ALP", "member": "Natalie Hutchins", "margin": 8.8, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-tarneit", "name": "Tarneit", "state": "VIC", "party": "ALP", "member": "Dylan Wight", "margin": 12.3, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-thomastown", "name": "Thomastown", "state": "VIC", "party": "ALP", "member": "Bronwyn Halfpenny", "margin": 15.8, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-warrandyte", "name": "Warrandyte", "state": "VIC", "party": "LIB", "member": "Nicole Werner", "margin": 4.3, "chamber": "vic", "vs": "ALP"},
    {"id": "vic-wendouree", "name": "Wendouree", "state": "VIC", "party": "ALP", "member": "Juliana Addison", "margin": 11.9, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-werribee", "name": "Werribee", "state": "VIC", "party": "ALP", "member": "John Lister", "margin": 10.9, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-williamstown", "name": "Williamstown", "state": "VIC", "party": "ALP", "member": "Melissa Horne", "margin": 13.4, "chamber": "vic", "vs": "LIB/NAT"},
    {"id": "vic-yan-yean", "name": "Yan Yean", "state": "VIC", "party": "ALP", "member": "Lauren Kathage", "margin": 4.3, "chamber": "vic", "vs": "LIB/NAT"},
  ],
};

export const AU_POLLS: { federal: AuPoll[]; victoria: AuPoll[] } = {
  federal: [{"pollster": "YouGov", "date": "2026-11-04", "tpp": {"ALP": 50.0, "LNP": 50.0}, "primary": {"ALP": 25, "LNP": 23, "GRN": 13, "ONP": 27, "OTH": 12}, "sample": 1500, "tppVsOnp": {"ALP": 53.0, "ONP": 47.0}}, {"pollster": "Newspoll", "date": "2026-11-01", "tpp": null, "primary": {"ALP": 27, "LNP": 21, "GRN": 13, "ONP": 28, "OTH": 11}, "sample": 1200}, {"pollster": "DemosAU", "date": "2026-11-01", "tpp": null, "primary": {"ALP": 26, "LNP": 24, "GRN": 13, "ONP": 26, "OTH": 11}, "sample": 1500}, {"pollster": "Essential", "date": "2026-10-28", "tpp": null, "primary": {"ALP": 28, "LNP": 23, "GRN": 12, "ONP": 28, "OTH": 9}, "sample": 1087, "note": "2PP+ Coalition 52, ALP 44 (rest undecided)"}, {"pollster": "Roy Morgan", "date": "2026-10-27", "tpp": {"ALP": 53.0, "LNP": 47.0}, "primary": {"ALP": 26, "LNP": 23.5, "GRN": 15.5, "ONP": 22.5, "OTH": 12.5}, "sample": 2711}, {"pollster": "YouGov", "date": "2026-10-21", "tpp": {"ALP": 50.0, "LNP": 50.0}, "primary": {"ALP": 24, "LNP": 23, "GRN": 14, "ONP": 27, "OTH": 12}, "sample": 1542, "tppVsOnp": {"ALP": 53.0, "ONP": 47.0}}, {"pollster": "Roy Morgan", "date": "2026-10-13", "tpp": {"ALP": 53.0, "LNP": 47.0}, "primary": {"ALP": 26, "LNP": 21.5, "GRN": 15, "ONP": 24, "OTH": 13.5}, "sample": 2655, "tppVsOnp": {"ALP": 54.5, "ONP": 45.5}}, {"pollster": "Newspoll", "date": "2026-10-11", "tpp": null, "primary": {"ALP": 29, "LNP": 20, "GRN": 14, "ONP": 28, "OTH": 9}, "sample": 1241}, {"pollster": "Resolve", "date": "2026-10-11", "tpp": null, "primary": {"ALP": 29, "LNP": 23, "GRN": 12, "ONP": 25, "OTH": 11}, "sample": 2250}, {"pollster": "RedBridge/Accent", "date": "2026-10-05", "tpp": {"ALP": 50.0, "LNP": 50.0}, "primary": {"ALP": 28, "LNP": 21, "GRN": 11, "ONP": 29, "OTH": 11}, "sample": 1000, "tppVsOnp": {"ALP": 52.0, "ONP": 48.0}}],
  victoria: [{"pollster": "Roy Morgan", "date": "2026-10-29", "tpp": {"ALP": 44.0, "LNP": 56.0}, "primary": {"ALP": 22.5, "LNP": 29.5, "GRN": 12.5, "ONP": 22, "IND": 7.5, "OTH": 6}, "sample": 3610, "tppVsOnp": {"ALP": 54.5, "ONP": 45.5}}, {"pollster": "Newspoll", "date": "2026-10-22", "tpp": {"ALP": 45.0, "LNP": 55.0}, "primary": {"ALP": 24, "LNP": 33, "GRN": 14, "ONP": 20, "OTH": 9}, "sample": 1017}, {"pollster": "Online Research Unit (for Greens)", "date": "2026-10-26", "tpp": {"ALP": 46.0, "LNP": 54.0}, "primary": {"ALP": 25, "LNP": 32, "GRN": 15, "ONP": 14, "OTH": 14}, "sample": 1488}, {"pollster": "Roy Morgan", "date": "2026-10-09", "tpp": {"ALP": 45.0, "LNP": 55.0}, "primary": {"ALP": 22.5, "LNP": 26, "GRN": 14, "ONP": 25, "IND": 7, "OTH": 5.5}}, {"pollster": "Resolve", "date": "2026-10-10", "tpp": null, "primary": {"ALP": 25, "LNP": 28, "GRN": 15, "ONP": 23, "IND": 4, "OTH": 5}, "sample": 1000}, {"pollster": "RedBridge/Accent", "date": "2026-10-08", "tpp": {"ALP": 44.0, "LNP": 56.0}, "primary": {"ALP": 24, "LNP": 30, "GRN": 16, "ONP": 24, "OTH": 6}, "sample": 1008, "tppVsOnp": {"ALP": 55.0, "ONP": 45.0}}, {"pollster": "Freshwater", "date": "2026-09-28", "tpp": {"ALP": 47.0, "LNP": 53.0}, "primary": {"ALP": 24, "LNP": 29, "GRN": 14, "ONP": 22, "OTH": 11}, "sample": 1030}, {"pollster": "DemosAU", "date": "2026-09-20", "tpp": {"ALP": 48.0, "LNP": 52.0}, "primary": {"ALP": 25, "LNP": 30, "GRN": 14, "ONP": 20, "OTH": 11}, "sample": 1020}],
};

export const OTHER_AU_ELECTIONS: { name: string; date: string; status: string; result?: string; seats?: number; note?: string }[] = [{"name": "South Australian state election", "date": "2026-03-21", "status": "held", "result": "Labor (Malinauskas) 34 seats, 37.5% primary; One Nation (Cory Bernardi) 4 seats, 22.9%; Liberal (Ashton Hurn) 5 seats, 18.9%", "seats": 47}, {"name": "Farrer federal by-election", "date": "2026-05-09", "status": "held", "result": "One Nation gain from Liberal (David Farley)"}, {"name": "Nepean (Vic) state by-election", "date": "2026-05 (TBD exact)", "status": "held", "result": "TBD"}, {"name": "New South Wales state election", "date": "2027-03-27", "status": "upcoming", "seats": 93, "note": "Polymarket markets close 2027-03-28"}, {"name": "Tasmanian state election", "date": "2025-07-19", "status": "held (snap)", "note": "next due TBD"}, {"name": "Queensland state election", "date": "2028-10 (TBD)", "status": "future"}, {"name": "ACT election", "date": "2028-10 (TBD)", "status": "future"}, {"name": "WA state election", "date": "2029-03 (TBD)", "status": "future"}, {"name": "NT election", "date": "2028-08 (TBD)", "status": "future"}];
