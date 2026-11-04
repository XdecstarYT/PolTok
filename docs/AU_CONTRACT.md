# Australia section — team contract
Research: docs/research/australia.md + australia.json (source of truth; never invent facts).

## Ownership
- Agent AU-DATA: shared/au/** , server/au.js (+ wire into server/index.js ONLY by adding routes/imports), src/data/au.ts
- Agent AU-MAP:  public/geo/** , src/features/au/map/**
- Agent AU-UI:   src/features/au/** (except map/), plus ONE line each in src/app/App.tsx (routes) and src/app/Shell.tsx NAV (add {to:'/au',label:'Australia'})

## Data API (AU-DATA provides, AU-UI consumes) — src/data/au.ts
export interface AuSeat { id:string; name:string; state:string; party:string; member:string; margin:number|null; chamber:'federal'|'vic' }
export const AU_PARTIES: Record<string,{name:string;short:string;color:string}>  // ALP red #e53940, LIB blue #1c4f9c, NAT green #2c7d3f, LNP #2a62b8, GRN #10a35a, ONP orange #f36c21, IND teal #2bb3a8 (teals), KAP, CA, OTH
export const FEDERAL: { pm, opposition, house: Record<party,number>, senate: Record<party,number>, seats: AuSeat[] }
export const VICTORIA: { date:'2026-11-28', pollsCloseUtc:string, premier, opposition, composition, seats: AuSeat[] }
export const AU_POLLS: { federal: AuPoll[]; victoria: AuPoll[] }  // AuPoll {pollster,date,tpp:{ALP,LNP},primary:Record<string,number>}
export const OTHER_AU_ELECTIONS: {...}[]

## Live API (server/au.js, mounted in server/index.js)
GET /api/au/news     -> { items: NewsItem[] } real AU RSS (lean labels), refreshed 2 min
GET /api/au/markets  -> { markets: Market[] } real Polymarket AU markets (Victoria winner, next premier, NSW, Albanese out…) refreshed 60s
GET /api/au/results?contest=vic2026 -> { status:'pre-election'|'counting'|'final', updatedAt, seats: { [seatId]: { counted:number, tcp?: {party,pct}[], leader?:string, called?:string } }, source }
  Before polls close returns status 'pre-election' with empty seats (NO fabrication). Implement a pluggable VEC/AEC fetcher that activates on election night (document what it parses).
Browser fallback: shared/au/markets.js (Polymarket is CORS *) usable directly from the client.

## Map API (AU-MAP provides) — src/features/au/map/AUMap.tsx
<AUMap layer="federal"|"vic" fills={Record<seatId,string>} variant="geo"|"hex" onSeatClick(id) renderTooltip(id) highlight={ids} selected={id}/>
Seat ids: federal = lowercase division name slug (e.g. "kooyong"); vic = "vic-" + district slug ("vic-brunswick"). Geometry: simplified TopoJSON/GeoJSON saved in public/geo/ (fetched lazily), plus generated hex layout.

Rules: plain CSS with tokens, TS strict, no new deps, `npx tsc -b --noEmit` must pass, no git commits.
