// Shared enriched-profile sections (hero photo, quick facts, career, ideology, sources) for US + AU pages.
import type { ReactNode } from 'react';
import { initials } from '../members/data';
import type { AuPhoto } from '../../data/au-photo';
import { type OfficeHeld, type Profile, type SourceRef, ageOn, fmtDate } from './profile';

export function HeroPhoto({ name, color, profile, fallback, free }: { name: string; color: string; profile?: Profile; fallback?: string; free?: AuPhoto }) {
  const p = profile?.portrait;
  const src = p?.src ?? free?.thumbUrl ?? fallback;
  return (
    <figure className="cd-photo" style={{ ['--pc' as string]: color }}>
      <div className="cd-photo__frame">
        {src ? <img src={src} alt={name} title={!p && free ? free.credit : undefined} width={180} height={220} loading="eager" decoding="async" /> : <span aria-hidden="true">{initials(name)}</span>}
      </div>
      <figcaption className="cd-photo__credit">
        {p ? (
          <>
            Photo: {p.author ?? 'Unknown'} ·{' '}
            {p.licenceUrl ? <a href={p.licenceUrl} target="_blank" rel="noopener noreferrer">{p.licence}</a> : p.licence} ·{' '}
            <a href={p.page} target="_blank" rel="noopener noreferrer">Wikimedia Commons</a>
          </>
        ) : free?.official ? (
          <a href={free.sourcePage} target="_blank" rel="noopener noreferrer">{free.credit}</a>
        ) : free ? (
          <>
            Photo: {free.author} ·{' '}
            {free.licenceUrl ? <a href={free.licenceUrl} target="_blank" rel="noopener noreferrer">{free.licence}</a> : free.licence} ·{' '}
            <a href={free.sourcePage} target="_blank" rel="noopener noreferrer">via Wikimedia Commons</a>
          </>
        ) : fallback ? (
          'Photo: AP via The New York Times'
        ) : (
          'No freely licensed photo'
        )}
      </figcaption>
    </figure>
  );
}

const SOCIAL_LABEL: Record<string, string> = { x: 'X', twitter: 'X', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', bluesky: 'Bluesky' };
function socialLinks(profile?: Profile): [string, string][] {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(profile?.facts?.social ?? {})) out.set(k, v);
  const s = profile?.congress?.social ?? {};
  if (s.twitter && !out.has('x')) out.set('x', `https://x.com/${s.twitter}`);
  if (s.facebook && !out.has('facebook')) out.set('facebook', `https://www.facebook.com/${s.facebook}`);
  if (s.instagram && !out.has('instagram')) out.set('instagram', `https://www.instagram.com/${s.instagram}`);
  if (s.youtube_id && !out.has('youtube')) out.set('youtube', `https://www.youtube.com/channel/${s.youtube_id}`);
  return [...out];
}

export function QuickFacts({ profile, extra }: { profile?: Profile; extra?: [string, ReactNode][] }) {
  const f = profile?.facts;
  const born = f?.born ?? profile?.congress?.birthday ?? null;
  const age = ageOn(born);
  const rows: [string, ReactNode][] = [...(extra ?? [])];
  if (born) rows.push(['Born', `${fmtDate(born)}${age !== null ? ` (age ${age})` : ''}${f?.birthPlace ? ` · ${f.birthPlace}` : ''}`]);
  if (f?.education.length) rows.push(['Education', f.education.join('; ')]);
  if (f?.occupation.length) rows.push(['Occupation', f.occupation.join(', ')]);
  const site = f?.website ?? profile?.congress?.contact?.url;
  if (site) rows.push(['Website', <a key="w" href={site} target="_blank" rel="noopener noreferrer">{site.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}</a>]);
  const soc = socialLinks(profile);
  if (soc.length)
    rows.push(['Social', <span key="s" className="cd-links">{soc.map(([k, u]) => <a key={k} href={u} target="_blank" rel="noopener noreferrer">{SOCIAL_LABEL[k] ?? k}</a>)}</span>]);
  if (!rows.length) return null;
  return (
    <dl className="cd-qf">
      {rows.map(([k, v]) => (
        <div key={k}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function WikiBlurb({ profile, loading, name }: { profile?: Profile; loading: boolean; name: string }) {
  if (loading) return <p className="cd-muted">Looking up a verified profile…</p>;
  if (profile?.rateLimited) return <p className="cd-muted">Wikipedia/Wikidata is busy right now — profile details will appear on a later visit.</p>;
  const w = profile?.wiki;
  if (!w) return <p className="cd-muted cd-noprof">No verified profile for {name}. {profile?.noProfile ? `(${profile.noProfile}) ` : ''}We only show biography details we can tie to this exact person.</p>;
  return (
    <div className="cd-wiki">
      {w.extract && <p>{w.extract}</p>}
      <p className="cd-muted cd-attr">
        From Wikipedia’s article “<a href={w.url} target="_blank" rel="noopener noreferrer">{w.title}</a>”, text available under{' '}
        <a href={w.licenceUrl} target="_blank" rel="noopener noreferrer">{w.licence}</a>
        {w.revised ? ` · revised ${fmtDate(w.revised.slice(0, 10))}` : ''}.
      </p>
    </div>
  );
}

/** Wikidata positions held, falling back to congress-legislators terms. */
export function Career({ profile }: { profile?: Profile }) {
  let items: OfficeHeld[] = profile?.facts?.offices ?? [];
  let src = 'Wikidata';
  if (!items.length && profile?.congress?.terms.length) {
    src = 'congress-legislators';
    const merged: OfficeHeld[] = [];
    for (const t of profile.congress.terms) {
      const title = t.type === 'sen' ? `U.S. Senator from ${t.state}` : `U.S. Representative, ${t.state}-${t.district === 0 ? 'AL' : t.district}`;
      const prev = merged[merged.length - 1];
      if (prev && prev.title === title) prev.end = t.end;
      else merged.push({ title, start: t.start, end: t.end });
    }
    items = merged;
  }
  if (!items.length) return <p className="cd-muted">No offices on record in open data.</p>;
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <ol className="cd-tl">
        {items.map((o, i) => (
          <li key={i} className={!o.end || o.end > today ? 'is-now' : ''}>
            <span className="cd-tl__when mono">
              {fmtDate(o.start) || '?'} – {o.end ? (o.end > today ? 'present' : fmtDate(o.end)) : o.start ? 'present' : '?'}
            </span>
            <b>{o.title.charAt(0).toUpperCase() + o.title.slice(1)}</b>
          </li>
        ))}
      </ol>
      <p className="cd-muted cd-src">Source: {src}.</p>
    </>
  );
}

export function IdeologyMeter({ profile }: { profile?: Profile }) {
  const s = profile?.congress?.stats;
  if (!s || s.dim1 == null) return <p className="cd-muted">No DW-NOMINATE score — only sitting members of Congress have a Voteview voting record.</p>;
  const x = ((s.dim1 + 1) / 2) * 100;
  return (
    <div className="cd-ideo">
      <div className="cd-ideo__bar" role="img" aria-label={`DW-NOMINATE first dimension ${s.dim1.toFixed(3)} on a scale from −1 (liberal) to +1 (conservative)`}>
        <span className="cd-ideo__mid" />
        <span className="cd-ideo__dot" style={{ left: `${x}%` }} />
      </div>
      <div className="cd-ideo__ends cd-muted"><span>← Liberal (−1)</span><span className="mono">{s.dim1.toFixed(3)}</span><span>Conservative (+1) →</span></div>
      <dl className="cd-qf cd-qf--3">
        <div><dt>Party unity</dt><dd className="mono">{s.partyUnityPct != null ? `${s.partyUnityPct}%` : '—'}</dd></div>
        <div><dt>Missed votes</dt><dd className="mono">{s.missedPct != null ? `${s.missedPct}%` : '—'}</dd></div>
        <div><dt>Roll calls (119th)</dt><dd className="mono">{s.votes ?? '—'}</dd></div>
      </dl>
    </div>
  );
}

export function SourcesList({ sources, extra, generatedAt }: { sources?: SourceRef[]; extra: SourceRef[]; generatedAt?: number }) {
  const all = [...(sources ?? []), ...extra];
  return (
    <section className="card rx-sec" aria-labelledby="cd-src-h">
      <div className="rx-sec-head"><h3 id="cd-src-h">Sources</h3></div>
      <ol className="cd-sources">
        {all.map((s, i) => (
          <li key={i}>
            <a href={s.url} target="_blank" rel="noopener noreferrer">{s.name}</a>
            {s.retrieved && <span className="cd-muted"> · retrieved {fmtDate(s.retrieved)}</span>}
          </li>
        ))}
      </ol>
      {generatedAt && <p className="cd-muted cd-src">Profile compiled {new Date(generatedAt).toLocaleString()} and cached. People are matched on name + state + office; ambiguous matches are rejected.</p>}
    </section>
  );
}
