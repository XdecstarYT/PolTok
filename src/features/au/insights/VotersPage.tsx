/** /au/victoria/voters — Voter explorer: how Victoria splits by region, age and gender, using the latest published
 *  breakdowns on Wikipedia's Victorian polling page. Each slice shows its pollster and fieldwork dates. */
import { useState, type CSSProperties } from 'react';
import { m as M } from 'framer-motion';
import { PageHeader } from '../../../components';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import { AuNav } from '../AuNav';
import { useVicLive, vicColor, VIC_NAME, type VicSlice } from '../vicLive';
import '../au.css';
import '../parliament/profile.css';
import './insights.css';

const KEYS = ['ALP', 'LNP', 'GRN', 'ONP'] as const;
const REGION: Record<string, { label: string; emoji: string; blurb: string }> = {
  inner: { label: 'Inner Melbourne', emoji: '🏙️', blurb: 'Teals, Greens and the Labor–Liberal fight for the inner ring' },
  outer: { label: 'Outer Melbourne', emoji: '🏘️', blurb: 'The growth corridors: mortgage belt, cost of living, crime' },
  provincial: { label: 'Provincial cities', emoji: '🏭', blurb: 'Geelong, Ballarat, Bendigo, the Latrobe Valley' },
  rural: { label: 'Rural Victoria', emoji: '🌾', blurb: 'Nationals heartland, and One Nation\'s best ground' },
};

function Slice({ s, title, sub, i }: { s: VicSlice; title: string; sub?: string; i: number }) {
  const lead = KEYS.reduce((a, k) => ((s[k] ?? -1) > (s[a] ?? -1) ? k : a), KEYS[0] as (typeof KEYS)[number]);
  return (
    <M.article className="vx-slice lg" style={{ ['--c' as string]: vicColor(lead) } as CSSProperties} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.07 }}>
      <header><b>{title}</b>{sub && <small>{sub}</small>}</header>
      <div className="vx-lead"><span>Leads</span><b>{VIC_NAME[lead]}</b><i className="num">{s[lead]}%</i></div>
      <div className="vx-bars">
        {KEYS.map((k) => (
          <div key={k} className="vx-bar" style={{ ['--c' as string]: vicColor(k) } as CSSProperties}>
            <span>{VIC_NAME[k]}</span>
            <span className="vx-bar__track"><M.i initial={{ width: 0 }} whileInView={{ width: `${Math.min(100, (s[k] ?? 0) * 2)}%` }} viewport={{ once: true }} transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }} /></span>
            <b className="num">{s[k] == null ? 'n/a' : `${s[k]}%`}</b>
          </div>
        ))}
      </div>
      <small className="vx-src">{s.firm} · {s.date}</small>
    </M.article>
  );
}

export default function VotersPage() {
  useSeo({ title: 'Voter explorer · Victoria 2026', description: 'How Victorians plan to vote by region, age and gender: the latest published poll breakdowns, live.' });
  const { data, loading: isLoading } = useVicLive();
  const x = data?.extra;
  const [tab, setTab] = useState<'region' | 'age' | 'gender'>('region');
  const avg = data?.polls?.average;
  return (
    <div className="page au-page">
      <PageHeader className="au-pagehead" kicker="Victorian state election · Sat 28 Nov" title="Voter explorer" crumbLabel="Voter explorer"
        sub="Victoria isn't one electorate. See how the vote splits across Melbourne and the regions, young and old, women and men.">
        <AuNav />
      </PageHeader>
      {avg && (
        <section className="vx-state lg">
          <span className="pf__kicker">Statewide average</span>
          <div className="vx-stack" aria-label="Statewide primary vote">
            {KEYS.map((k) => <M.i key={k} style={{ background: vicColor(k) }} initial={{ flexGrow: 0 }} animate={{ flexGrow: avg[k] }} transition={{ duration: 1 }} title={`${VIC_NAME[k]} ${avg[k]}%`}><span>{VIC_NAME[k]} {Math.round(avg[k])}</span></M.i>)}
            <M.i style={{ background: 'var(--bg-3)' }} initial={{ flexGrow: 0 }} animate={{ flexGrow: Math.max(0, 100 - KEYS.reduce((a, k) => a + avg[k], 0)) }}><span>Other</span></M.i>
          </div>
        </section>
      )}
      <div className="ds__tabs" role="tablist" style={{ margin: '16px 0 12px' }}>
        {([['region', '🗺️ By region'], ['age', '🎂 By age'], ['gender', '⚧ By gender']] as const).map(([k, l]) => <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{ ['--c' as string]: 'var(--accent)' } as CSSProperties}>{l}</button>)}
      </div>
      {isLoading && !data && <p className="faint">Loading the latest breakdowns…</p>}
      <div className="vx-grid" key={tab}>
        {tab === 'region' && Object.entries(x?.regions ?? {}).map(([k, s], i) => <Slice key={k} s={s!} title={`${REGION[k].emoji} ${REGION[k].label}`} sub={REGION[k].blurb} i={i} />)}
        {tab === 'age' && Object.entries(x?.age ?? {}).map(([k, s], i) => <Slice key={k} s={s} title={`Aged ${k}`} i={i} />)}
        {tab === 'gender' && Object.entries(x?.gender ?? {}).map(([k, s], i) => <Slice key={k} s={s!} title={k === 'women' ? 'Women' : 'Men'} i={i} />)}
      </div>
      {data && !x && <p className="faint">Breakdowns are temporarily unavailable from the source.</p>}
      <p className="vp-method">Each card is the most recent published breakdown for that group, from Wikipedia's "Opinion polling for the 2026 Victorian state election" page. Sub-samples are small and pollsters differ, so cards can be from different polls and dates: read them as directions, not precise numbers.</p>
    </div>
  );
}
