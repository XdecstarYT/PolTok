/** Owner tool: people shown on PolTok who still have no portrait (initials avatar), with takedown/blocklist info. */
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../components';
import { FEDERAL, VICTORIA, SENATORS } from '../../data/au';
import { NZ_ELECTORATES } from '../nz/generated';
import { loadPhotoIndex, personPhoto, PHOTO_BLOCKLIST, type PhotoScope } from '../../data/photos';

interface Person { group: 'AU' | 'NZ'; scope: PhotoScope; name: string; party?: string; where: string }
const REPO = 'https://github.com/XdecstarYT/PolTok';

function people(): Person[] {
  const out = new Map<string, Person>();
  const add = (p: Person) => {
    for (const part of p.name.split(/\s*\/\s*/)) {
      const name = part.trim();
      if (!name || /vacant|—/i.test(name)) continue;
      const k = `${p.scope}:${name.toLowerCase()}`;
      if (!out.has(k)) out.set(k, { ...p, name });
    }
  };
  for (const s of FEDERAL.seats) add({ group: 'AU', scope: 'au', name: s.member, party: s.party, where: `Federal · ${s.name}` });
  for (const s of SENATORS) add({ group: 'AU', scope: 'au', name: s.name, party: s.party, where: `Senate · ${s.state}` });
  for (const s of VICTORIA.seats) add({ group: 'AU', scope: 'au', name: s.member, party: s.party, where: `Victoria · ${s.name}` });
  for (const e of NZ_ELECTORATES) for (const c of e.candidates) add({ group: 'NZ', scope: 'nz', name: c.name, party: c.party, where: `NZ · ${e.name}` });
  return [...out.values()];
}

export function MissingPhotos() {
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState('');
  const [group, setGroup] = useState<'all' | 'AU' | 'NZ'>('all');
  useEffect(() => {
    void Promise.all([loadPhotoIndex('au'), loadPhotoIndex('gen'), loadPhotoIndex('off')]).then(() => setReady(true));
  }, []);
  const all = useMemo(() => (ready ? people() : []), [ready]);
  const missing = useMemo(() => all.filter((p) => !personPhoto({ name: p.name, scope: p.scope })), [all]);
  const shown = missing.filter((p) => (group === 'all' || p.group === group) && `${p.name} ${p.party} ${p.where}`.toLowerCase().includes(q.toLowerCase()));
  const count = (g: 'AU' | 'NZ') => ({ total: all.filter((p) => p.group === g).length, miss: missing.filter((p) => p.group === g).length });
  const csv = () => {
    const rows = ['group,name,party,where', ...missing.map((p) => [p.group, p.name, p.party ?? '', p.where].map((v) => `"${v.replace(/"/g, '""')}"`).join(','))];
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' }));
    a.download = 'poltok-missing-photos.csv';
    a.click();
  };
  return (
    <section className="ow-studio" aria-label="Missing photos">
      <div className="ow-tweet">
        <b>How photos work</b>
        <p className="ow-muted">Free-licence portraits (Wikimedia Commons, public-domain government portraits) win; gaps are filled with credited official headshots (<code>scripts/gen-official-photos.mts</code>). US candidates use AP headshots from the live feed, so they are not listed here. Anyone without a photo shows a party-coloured initials ring.</p>
        <p className="ow-muted">
          <b>Takedown blocklist:</b> {PHOTO_BLOCKLIST.length} slug{PHOTO_BLOCKLIST.length === 1 ? '' : 's'} blocked. To remove a photo, add its <code>group/slug</code> to{' '}
          <a className="ow-link" href={`${REPO}/blob/main/src/data/photos/blocklist.ts`} target="_blank" rel="noopener noreferrer">src/data/photos/blocklist.ts</a> and redeploy. Requests arrive via{' '}
          <a className="ow-link" href={`${REPO}/issues`} target="_blank" rel="noopener noreferrer">GitHub issues</a> (linked from the <a className="ow-link" href="/menu">Menu page</a> footer).
        </p>
      </div>
      {!ready ? <p className="ow-muted">Loading photo index…</p> : (
        <div className="ow-tweet">
          <div className="ow-actions" style={{ alignItems: 'center' }}>
            {(['all', 'AU', 'NZ'] as const).map((g) => (
              <button key={g} type="button" className={`ow-pill ${group === g ? 'is-on' : ''}`} aria-pressed={group === g} onClick={() => setGroup(g)}>
                {g === 'all' ? `All (${missing.length})` : `${g} ${count(g).miss}/${count(g).total} missing`}
              </button>
            ))}
            <input className="ow-select" style={{ flex: '1 1 160px', width: 'auto' }} placeholder="Filter by name, party, seat" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filter missing photos" />
            <Button size="sm" variant="ghost" onClick={csv}>CSV</Button>
          </div>
          <ul className="xs-list" style={{ maxHeight: 480, overflow: 'auto' }}>
            {shown.slice(0, 400).map((p) => (
              <li key={p.scope + p.name} className="xs-row">
                <div className="xs-row__t"><b>{p.name}</b><span className="ow-muted">{p.party ? p.party + ' · ' : ''}{p.where}</span></div>
                <a className="ow-link" href={`https://commons.wikimedia.org/w/index.php?search=${encodeURIComponent(p.name)}&title=Special:MediaSearch&type=image`} target="_blank" rel="noopener noreferrer">Search Commons</a>
              </li>
            ))}
            {!shown.length && <li className="ow-muted">Nobody missing for this filter.</li>}
          </ul>
        </div>
      )}
    </section>
  );
}
