/** /au/victoria — Victorian state election 2026 night page (AU-UI). */
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedNumber, Card, Countdown, LiveDot, PageHeader } from '../../components';
import { fmtTime, tzAbbr } from '../../components/time';
import { relatedNews, useAuMarkets, useAuNews, useAuResults, type AuResults } from './api';
import { MapPanel, VIC_ZOOMS } from './MapPanel';
import { AU_POLLS, counts, leader, normPolls, party, partyKey, pColor, VIC_CLOSE, VIC_MAJORITY, VIC_TOTAL, VICTORIA, type AuSeat } from './model';
import { FeedStatus, LeaderCard, MarketsPanel, NewsPanel, PollsPanel, Pendulum, TallyBar } from './widgets';
import { AuNav } from './AuNav';
import './au.css';

const NOT_REPORTING = '#2a3048';
const KEY_NAMES = ['kew', 'niddrie', 'brunswick', 'pakenham', 'nepean', 'prahran'];

export function seatOutcome(r: AuResults | null, id: string): { party?: string; called: boolean; counted?: number } {
  const s = r?.seats?.[id];
  if (!s) return { called: false };
  return { party: s.called ?? s.leader, called: !!s.called, counted: s.counted };
}
export const fmtCounted = (c?: number) => (c == null ? '' : c <= 100 ? `${c.toFixed(c < 10 ? 1 : 0)}% counted` : `${c.toLocaleString()} votes counted`);

export default function VictoriaPage() {
  const res = useAuResults('vic2026');
  const news = useAuNews();
  const markets = useAuMarkets();
  const seats = VICTORIA.seats ?? [];
  const status = res.data?.status ?? 'pre-election';
  const live = status !== 'pre-election' && !!res.data;
  const prem = leader(VICTORIA.premier);
  const opp = leader(VICTORIA.opposition);
  const baseline = useMemo(() => counts(VICTORIA.composition).map(([k, v]) => [/vacant/i.test(k) ? 'VACANT' : k, v] as [string, number]), []);
  const polls = useMemo(() => normPolls(AU_POLLS.victoria), []);

  const tally = useMemo(() => {
    const won = new Map<string, number>();
    const lead = new Map<string, number>();
    let reporting = 0;
    for (const s of seats) {
      const o = seatOutcome(res.data, s.id);
      if (!o.party) continue;
      reporting++;
      const k = partyKey(o.party);
      (o.called ? won : lead).set(k, ((o.called ? won : lead).get(k) ?? 0) + 1);
    }
    const parties = [...new Set([...won.keys(), ...lead.keys()])].map((k) => ({ k, won: won.get(k) ?? 0, lead: lead.get(k) ?? 0 }));
    parties.sort((a, b) => b.won + b.lead - (a.won + a.lead));
    return { parties, reporting };
  }, [res.data, seats]);

  const fills = useMemo(() => {
    if (!live) return undefined;
    const f: Record<string, string> = {};
    for (const s of seats) {
      const o = seatOutcome(res.data, s.id);
      f[s.id] = o.party ? pColor(o.party) + (o.called ? '' : '99') : NOT_REPORTING;
    }
    return f;
  }, [live, res.data, seats]);

  const keySeats = useMemo(() => {
    const byMargin = seats.filter((s) => s.margin != null).sort((a, b) => (a.margin ?? 0) - (b.margin ?? 0)).slice(0, 14);
    const named = seats.filter((s) => KEY_NAMES.some((k) => s.id === 'vic-' + k));
    return [...new Map([...named, ...byMargin].map((s) => [s.id, s])).values()];
  }, [seats]);

  const vicNews = useMemo(() => {
    const words = ['victoria', 'victorian', 'melbourne', 'carroll', 'jess wilson', 'vec', 'spring street', ...seats.map((s) => s.name)];
    const r = relatedNews(news.data, words);
    return news.data ? r : null;
  }, [news.data, seats]);

  const [pickTab, setPickTab] = useState<'close' | 'all'>('close');
  const coalitionNow = tally.parties.filter((p) => ['LIB', 'NAT', 'LNP'].includes(p.k)).reduce((a, p) => a + p.won + p.lead, 0);
  const alpNow = tally.parties.find((p) => p.k === 'ALP');

  return (
    <div className="page au-page">
      <PageHeader
        className="au-pagehead"
        live={live}
        kicker={live ? 'Counting · Victorian state election · Sat 28 Nov 2026' : 'Pre-election · Victorian state election · Sat 28 Nov 2026'}
        title="Victoria decides"
        crumbLabel="Victoria 2026"
        sub={<>Legislative Assembly · 88 districts · {VIC_MAJORITY} for majority</>}
        aside={
          <dl className="au-stats mono">
            <div><dt>Polls close</dt><dd>{fmtTime(VIC_CLOSE)} {tzAbbr(VIC_CLOSE)}</dd></div>
            <div><dt>Status</dt><dd className={live ? 'ok' : ''}>{status === 'final' ? 'Final' : live ? 'Counting' : 'Pre-election'}</dd></div>
            <div><dt>Reporting</dt><dd><AnimatedNumber value={tally.reporting} />/{VIC_TOTAL}</dd></div>
            <div><dt>Results feed</dt><dd><FeedStatus updated={res.updated} error={res.error} label={res.data?.source ?? 'VEC'} /></dd></div>
          </dl>
        }
      >
        <AuNav />
      </PageHeader>

      <div className="au-vic-hero">
        <Card className="au-count-card" kicker="6:00pm AEDT · 07:00 UTC" title={live ? 'Polls closed' : 'Polls close in'}>
          <Countdown to={VIC_CLOSE} doneLabel="Polls closed — count under way" />
          <p className="au-note">Shown in your time zone: {fmtTime(VIC_CLOSE)} {tzAbbr(VIC_CLOSE)}. Early voting opened 18 Nov.</p>
        </Card>
        <LeaderCard role="Premier" name={prem.name} partyCode={prem.party ?? 'ALP'} seat={prem.seat ?? 'Niddrie'} />
        <LeaderCard role="Opposition Leader" name={opp.name} partyCode={opp.party ?? 'LIB'} seat={opp.seat ?? 'Kew'} />
      </div>

      {live ? (
        <Card title="Seats won + leading" live kicker={`Updated ${res.data?.updatedAt ? fmtTime(typeof res.data.updatedAt === 'number' ? res.data.updatedAt : Date.parse(res.data.updatedAt), true) : '—'} · source ${res.data?.source ?? 'VEC'}`}>
          <div className="au-race">
            <div className="au-race-side" style={{ color: pColor('ALP') }}>
              <span className="mono">LABOR</span>
              <b className="num"><AnimatedNumber value={(alpNow?.won ?? 0) + (alpNow?.lead ?? 0)} /></b>
              <span className="muted mono">{alpNow?.won ?? 0} won</span>
            </div>
            <div className="au-race-mid mono">
              <span>{VIC_MAJORITY} to win</span>
            </div>
            <div className="au-race-side au-race-r" style={{ color: pColor('LIB') }}>
              <span className="mono">COALITION</span>
              <b className="num"><AnimatedNumber value={coalitionNow} /></b>
              <span className="muted mono">{tally.parties.filter((p) => ['LIB', 'NAT'].includes(p.k)).reduce((a, p) => a + p.won, 0)} won</span>
            </div>
          </div>
          <TallyBar comp={tally.parties.map((p) => [p.k, p.won + p.lead] as [string, number])} total={VIC_TOTAL} majority={VIC_MAJORITY} />
          <ul className="au-legend au-legend--inline">
            {tally.parties.map((p) => (
              <li key={p.k}><i style={{ background: pColor(p.k) }} /><span>{party(p.k).short}</span><b className="num">{p.won}</b><span className="muted">+{p.lead} lead</span></li>
            ))}
          </ul>
        </Card>
      ) : (
        <Card title="Seats needed for majority" kicker="BASELINE · pre-election composition (no votes counted yet)">
          <TallyBar comp={baseline} total={VIC_TOTAL} majority={VIC_MAJORITY} />
          <div className="au-need">
            {[['ALP', baseline.find(([k]) => partyKey(k) === 'ALP')?.[1] ?? 0], ['LIB', baseline.filter(([k]) => /coalition|lib|nat/i.test(k)).reduce((a, [, v]) => a + v, 0)]].map(([k, v]) => (
              <div key={k as string} style={{ ['--pc' as string]: pColor(k as string) }}>
                <span className="mono">{k === 'ALP' ? 'Labor holds' : 'Coalition holds'}</span>
                <b className="num">{v}</b>
                <span className="muted">{(v as number) >= VIC_MAJORITY ? `${(v as number) - VIC_MAJORITY + 1} seats to spare` : `needs ${VIC_MAJORITY - (v as number)} more`}</span>
              </div>
            ))}
          </div>
          <p className="au-note">
            Live results from the VEC will appear here automatically once counting starts after 6pm AEDT on 28 Nov (checked every 30 seconds). Until then all seat figures are the 2022-based pre-election pendulum, not results.
          </p>
        </Card>
      )}

      <div className="au-grid-main">
        <MapPanel
          layer="vic"
          seats={seats}
          fills={fills}
          title="Assembly districts"
          regions={VIC_ZOOMS}
          kicker={live ? 'Coloured by leader (faded = not yet called)' : 'BASELINE · coloured by current holder'}
          tooltip={(s) => {
            const o = seatOutcome(res.data, s.id);
            return (
              <div className="au-tip">
                <b>{s.name}</b>
                <div><i style={{ background: pColor(s.party) }} /> {s.member} ({party(s.party).short}) · margin {s.margin != null ? s.margin.toFixed(1) : 'TBD'}</div>
                {live && <div className="mono">{o.party ? `${o.called ? 'WON' : 'LEADS'}: ${party(o.party).short}` : 'No results yet'} {fmtCounted(o.counted)}</div>}
              </div>
            );
          }}
        />
        <div className="au-side">
          <MarketsPanel title="Victoria markets" markets={markets.data} error={markets.error} filter={(m) => /victoria|premier|vic\b/i.test(m.question)} />
          <Card title="Key seats" kicker={live ? 'Live' : 'Closest baseline margins'}>
            <div className="au-seg" style={{ marginBottom: 8 }}>
              {(['close', 'all'] as const).map((t) => (
                <button key={t} type="button" aria-selected={pickTab === t} onClick={() => setPickTab(t)}>{t === 'close' ? 'Key' : 'All 88'}</button>
              ))}
            </div>
            <KeySeatList seats={pickTab === 'close' ? keySeats : [...seats].sort((a, b) => a.name.localeCompare(b.name))} res={res.data} />
          </Card>
        </div>
      </div>

      <Pendulum seats={seats} title="Victorian pendulum" results={live ? Object.fromEntries(Object.entries(res.data?.seats ?? {}).map(([k, v]) => [k, { leader: v.leader, called: v.called }])) : undefined} />

      <div className="au-grid-2">
        <PollsPanel polls={polls} title="Victorian voting intention" kicker="Primary vote · state polls" />
        <NewsPanel items={vicNews} error={news.error} title="Victorian election news" emptyNote="No Victoria-specific stories in the current feed." />
      </div>

      <p className="au-foot muted">
        {live ? <>Results: {res.data?.source ?? 'VEC'}, refreshed every 30 seconds. </> : <>No results yet: the page shows the pre-election baseline (mostly 2022 margins, Wikipedia pendulum) and live market odds. </>}
        Party colours: Labor red, Liberal blue, Nationals green, Greens green, One Nation orange, independents teal.
      </p>
    </div>
  );
}

function KeySeatList({ seats, res }: { seats: AuSeat[]; res: AuResults | null }) {
  return (
    <ul className="au-keyseats">
      {seats.map((s) => {
        const o = seatOutcome(res, s.id);
        return (
          <li key={s.id}>
            <Link to={`/au/seat/${s.id}`}>
              <i style={{ background: pColor(s.party) }} />
              <span className="au-ks-n">{s.name}</span>
              <span className="muted au-ks-m">{s.member}</span>
              <span className="num au-ks-v">
                {o.party ? <b style={{ color: pColor(o.party) }}>{o.called ? '✓ ' : ''}{party(o.party).short}</b> : s.margin != null ? `${party(s.party).short} ${s.margin.toFixed(1)}` : 'TBD'}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
