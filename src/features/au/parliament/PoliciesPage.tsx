/** /au/victoria/policies — compare the major parties' 2026 commitments side by side (summaries in PolTok's own words from
 *  the ABC News policy tracker), plus where each stands on the headline issues. */
import { useState, type CSSProperties } from 'react';
import { PageHeader } from '../../../components';
import { useSeo } from '../../../lib/seo';
import '../../../lib/liquidGlass';
import POLICIES from '../../../data/vic-policies.json';
import { AuNav } from '../AuNav';
import { VIC_NAME, vicColor } from '../vicLive';
import '../au.css';
import './profile.css';

const P = POLICIES as unknown as { source: { name: string; url: string; asAt: string }; topics: { id: string; label: string; emoji: string; parties: Record<string, string[]> }[]; stances: { id: string; issue: string; positions: Record<string, { stance: 'for' | 'against' | 'mixed' | 'unclear'; note: string }> }[] };
const PARTIES = ['ALP', 'LNP', 'GRN', 'ONP'];
const L = { for: 'For', against: 'Against', mixed: 'Mixed', unclear: 'No clear position' } as const;

export default function PoliciesPage() {
  useSeo({ title: 'Compare the promises · Victoria 2026', description: 'Labor, the Coalition, the Greens and One Nation side by side: every major commitment by topic and where each stands on the big issues.' });
  const [topic, setTopic] = useState(P.topics[0].id);
  const t = P.topics.find((x) => x.id === topic)!;
  return (
    <div className="page au-page">
      <PageHeader className="au-pagehead" kicker="Victorian state election · Sat 28 Nov" title="Compare the promises" crumbLabel="Compare the promises"
        sub={<>The four biggest parties side by side, summarised in PolTok's own words from the <a href={P.source.url} target="_blank" rel="noreferrer">{P.source.name}</a>.</>}>
        <AuNav />
      </PageHeader>
      <section className="ds__sec lg" style={{ marginBottom: 16 }}>
        <h3 className="ds__h"><span>⚖️</span>Where they stand</h3>
        <div className="ds__stances">
          <div className="ds__srow ds__srow--head pc-row">{['Issue', ...PARTIES].map((k) => <span key={k} style={k !== 'Issue' ? { color: vicColor(k) } : undefined}>{VIC_NAME[k] ?? k}</span>)}</div>
          {P.stances.map((s) => (
            <div key={s.id} className="ds__srow pc-row">
              <span className="ds__issue">{s.issue}</span>
              {PARTIES.map((k) => { const x = s.positions[k]; return <span key={k} style={{ display: 'grid', gap: 3 }}><em className={`st st--${x?.stance ?? 'unclear'}`}>{L[x?.stance ?? 'unclear']}</em>{x && x.stance !== 'unclear' && <small>{x.note}</small>}</span>; })}
            </div>
          ))}
        </div>
      </section>
      <div className="ds__tabs" role="tablist" style={{ marginBottom: 12 }}>{P.topics.map((x) => <button key={x.id} role="tab" type="button" aria-selected={x.id === topic} onClick={() => setTopic(x.id)} style={{ ['--c' as string]: 'var(--accent)' } as CSSProperties}>{x.emoji} {x.label}</button>)}</div>
      <div className="pc-cols">
        {PARTIES.map((k) => (
          <section key={k} className="ds__sec lg" style={{ ['--c' as string]: vicColor(k) } as CSSProperties}>
            <h3 className="ds__h"><span>{t.emoji}</span>{VIC_NAME[k]}</h3>
            <ul className="ds__policies">{(t.parties[k] ?? []).map((b) => <li key={b}>{b}</li>)}{!(t.parties[k] ?? []).length && <li className="faint">No commitments listed on this topic.</li>}</ul>
          </section>
        ))}
      </div>
      <p className="vp-method">Party platforms as at {P.source.asAt}. Summaries are PolTok's; see the ABC tracker for full detail. Independents and minor parties aren't covered by the tracker.</p>
    </div>
  );
}
