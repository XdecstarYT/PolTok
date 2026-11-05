// Ask PolTok static knowledge base ("PolTok guide"): civics explainers, app features, data sources,
// glossary. Only sections whose keywords match the question are injected (see selectKb).
// Facts here are stable background — never live results. Cite as [PolTok guide].

export const KB = [
  {
    id: 'us-midterms',
    kw: /midterm|senate|house|congress|majority|control|chamber|class|seat|218|435|51|tie|vice president|vp\b|filibuster/i,
    text: `US midterms: all 435 House seats (2-year terms; majority 218) and ~1/3 of the 100-seat Senate (6-year terms in three "classes"; 2026 = Class 2 plus any specials) are elected. Senate control needs 51 seats, or 50 plus the Vice President's tie-breaking vote (VP is currently a Republican, so Democrats need 51). Independents are counted with the party they caucus with. 36 governorships were also up in 2026. New Congress is sworn in on 3 January.`,
  },
  {
    id: 'race-calls',
    kw: /call|called|projected|ap\b|associated press|declar|winner|expected vote|eevp|reporting|% in|count|too close|concede/i,
    text: `Race calls: PolTok shows Associated Press (AP) calls via The New York Times. AP declares a winner only when it is certain the trailing candidate cannot catch up, regardless of TV projections or concessions. "% in" is the estimated expected vote counted (eevp), not precincts. "Too close to call" means AP will wait for more ballots (mail, provisional, overseas). Counting continues for days in states with lots of mail ballots (e.g. CA, NV, AZ, WA).`,
  },
  {
    id: 'recounts-runoffs',
    kw: /recount|runoff|run-off|georgia|louisiana|jungle|50%|majority vote|certif/i,
    text: `Recounts & runoffs: many states allow or require a recount when the margin is under ~0.5% (thresholds vary by state). Georgia requires a majority (50%+1) in general elections, otherwise a runoff between the top two ~4 weeks later. Louisiana historically used a "jungle" primary with a December runoff; its congressional races moved to closed party primaries from 2026. Results become official only when states certify them, weeks after election day.`,
  },
  {
    id: 'rcv',
    kw: /ranked|rcv|instant runoff|alaska|maine|preferen/i,
    text: `Ranked-choice voting (RCV): Alaska and Maine use RCV for federal general elections. Voters rank candidates; if nobody has a majority of first preferences, the last-placed candidate is eliminated and their ballots transfer to next preferences, repeating until someone passes 50%. Alaska pairs this with a top-4 open primary (Alaska voters repealed nothing in 2024; the system remains). Tabulation of RCV rounds can take days, so AP calls there can be slow.`,
  },
  {
    id: 'au-system',
    kw: /austral|federal|preferential|2pp|tpp|two.party|aec|house of representatives|senate.*au|prime minister|albanese|labor|liberal|coalition|greens|one nation|teal|seat|kooyong|electorate|division/i,
    text: `Australian federal system: the House of Representatives has 150 single-member seats (divisions); a party needs 76 to govern. Voting is compulsory and preferential (number every box); if no candidate gets 50%+ of first preferences, preferences are distributed. "2PP/TPP" (two-party-preferred) is the final head-to-head between Labor and the Coalition; "2CP" (two-candidate-preferred) is the head-to-head between whichever two candidates finish top in a seat (e.g. Labor v Green, Liberal v teal Independent). The Senate has 76 senators (12 per state, 2 per territory) elected by proportional representation (quota system). Elections are run by the AEC.`,
  },
  {
    id: 'au-states',
    kw: /victoria|victorian|vec|spring street|melbourne|nsw|new south wales|state election|premier|legislative (assembly|council)|carroll|wilson|sandell/i,
    text: `Australian states have their own parliaments and elections. Victoria (election 28 Nov 2026, run by the VEC): Legislative Assembly 88 districts (majority 45), Legislative Council 40 members from 5 regions by proportional representation; fixed 4-year terms; compulsory preferential voting. NSW votes in March 2027 (93 Assembly seats). Results on election night are first preferences then an "indicative" 2CP count; final results take ~2 weeks as postal votes arrive.`,
  },
  {
    id: 'bills',
    kw: /bill|law|legislat|congress|parliament|passed|signed|veto|act\b|vote on|roll.?call|division/i,
    text: `Bills: a US bill must pass both House and Senate in identical form, then be signed by the President (or a veto overridden by 2/3 of each chamber). PolTok tracks stages: Introduced → In committee → Passed one chamber → Passed both chambers → Signed into law. Australian bills pass the House of Representatives and Senate then receive Royal Assent from the Governor-General. Data: GovInfo/congress.gov, clerk.house.gov, APH and the Federal Register of Legislation.`,
  },
  {
    id: 'polls-markets',
    kw: /poll|polling|average|generic ballot|approval|market|polymarket|odds|bet|forecast|chance|probab/i,
    text: `Polls vs markets: PolTok's polls are real published polls (compiled via PollCheck; each has pollster, date, sample, LV/RV). Single polls have a margin of error of ~±3–4 pts; averages are more reliable. Prediction-market prices (Polymarket) are traders' implied probabilities, not forecasts of vote share, and can be thin or move fast. Neither is a result.`,
  },
  {
    id: 'features',
    kw: /where|find|page|app|poltok|feature|how do i|menu|map|watch|compare|embed|replay|search|tab|navigate|see|show me/i,
    text: `PolTok pages: Home (/) — headline results & balance of power; Map (/map, /map/:mode) — US results map; Live (/live) — call ticker; News (/news) and Feed (/feed, swipeable cards); Polls (/polls); Forecast (/forecast); Races (/races) and each race (/race/GA-SEN etc.); States (/state/PA); House (/house); Governors (/governors, /governors/:abbr); Flips (/flips); Ballot measures (/measures); Candidates (/candidates, /candidate/:id); Watchlist (/watch); Compare (/compare); Replay election night (/replay); Analysis (/analysis); Search (/search); Parliament bill tracker (/parliament, /parliament/bill/:id); Australia (/au), Victoria 2026 (/au/victoria), seats (/au/seat/:id), Senate (/au/senate), parties (/au/party/:id), NSW (/au/nsw), swingometer (/au/swingometer); Embeds (/embed); Ask PolTok (/ask); Menu (/menu).`,
  },
  {
    id: 'sources',
    kw: /source|data|where.*from|accurate|reliable|delay|update|simulat|nyt|new york times|limit/i,
    text: `Data sources & limits: US results = AP via The New York Times live JSON (refreshes ~every 30–60 s; may lag TV). Markets = Polymarket public API. News = RSS from major outlets (headlines only). Polls = published polls compiled via PollCheck. Australia = AEC/VEC, ABC/Guardian/etc. RSS; live Victorian results only once counting starts on 28 Nov. Bills = GovInfo/congress.gov/APH. If a page says "simulation", numbers are demo data, not real.`,
  },
  {
    id: 'glossary',
    kw: /what (is|does|are)|mean|glossary|define|flip|hold|incumbent|open seat|toss.?up|lean|likely|solid|margin|swing|safe|marginal|crossbench|special election/i,
    text: `Glossary: Flip/gain — seat won by a different party than held it. Hold — same party keeps it. Incumbent — current office-holder. Open seat — no incumbent running. Ratings: Solid/Likely/Lean/Toss-up describe pre-election competitiveness. Margin — winner's lead in points. Swing — change in vote share vs last election. Special election — fills a vacancy mid-term. Marginal seat (AU) — 2PP margin under ~6%. Crossbench (AU) — MPs not in government or the main opposition.`,
  },
];

/** Pick KB sections whose keywords match the question, up to maxChars (best keyword-hit count first). */
export function selectKb(question, maxChars = 1800) {
  const q = String(question || '');
  const hits = KB.map((s) => ({ s, n: (q.match(new RegExp(s.kw.source, 'gi')) || []).length })).filter((x) => x.n > 0);
  hits.sort((a, b) => b.n - a.n);
  const out = [];
  let used = 0;
  for (const { s } of hits) {
    if (used + s.text.length > maxChars) continue;
    out.push(s);
    used += s.text.length + 1;
  }
  return out;
}
