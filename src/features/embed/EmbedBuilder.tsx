import { useMemo, useState } from 'react';
import { PageHeader } from '../../components';
import { RACES } from '../../data';
import { ShareCardButton } from './ShareCardButton';
import './embed.css';

type Widget = 'race' | 'balance' | 'map';
const SIZES = { small: { w: 360, h: 420 }, medium: { w: 560, h: 480 }, wide: { w: 760, h: 520 } } as const;
type Size = keyof typeof SIZES;

/** /embed — pick a widget, size and theme; live preview + copyable <iframe> snippet. */
export default function EmbedBuilder() {
  const [widget, setWidget] = useState<Widget>('race');
  const keyRaces = useMemo(() => [...RACES].sort((a, b) => Number(!!b.key) - Number(!!a.key) || a.title.localeCompare(b.title)), []);
  const [raceId, setRaceId] = useState(keyRaces[0]?.id ?? '');
  const [chamber, setChamber] = useState('senate');
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [size, setSize] = useState<Size>('medium');
  const [copied, setCopied] = useState(false);

  const qs = new URLSearchParams();
  if (theme === 'light') qs.set('theme', 'light');
  if (widget !== 'race' && chamber !== 'senate') qs.set('chamber', chamber);
  const path = widget === 'race' ? `/embed/race/${encodeURIComponent(raceId)}` : `/embed/${widget}`;
  const src = `${location.origin}${path}${qs.toString() ? `?${qs}` : ''}`;
  const { w, h } = SIZES[size];
  const snippet = `<iframe src="${src}" width="${w}" height="${h}" style="border:0;max-width:100%;border-radius:12px" loading="lazy" title="PolTok live results"></iframe>`;

  const copy = async () => {
    try { await navigator.clipboard.writeText(snippet); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ }
  };

  return (
    <div className="page embb">
      <PageHeader
        className="embb__head"
        kicker="Tools · Embed"
        title="Embed live results"
        crumbLabel="Embed"
        sub="Drop a live, auto-updating PolTok widget on any site. Results: AP via NYT."
      />
      <div className="embb__grid">
        <form className="embb__opts card" onSubmit={(e) => e.preventDefault()}>
          <fieldset>
            <legend>Widget</legend>
            <div className="embb__chips">
              {(['race', 'balance', 'map'] as Widget[]).map((x) => (
                <button key={x} type="button" className={`chip ${widget === x ? 'is-active' : ''}`} aria-pressed={widget === x} onClick={() => setWidget(x)}>
                  {x === 'race' ? 'Race' : x === 'balance' ? 'Balance of power' : 'Map'}
                </button>
              ))}
            </div>
          </fieldset>
          {widget === 'race' ? (
            <label>Race
              <select value={raceId} onChange={(e) => setRaceId(e.target.value)}>
                {keyRaces.map((r) => <option key={r.id} value={r.id}>{r.title}{r.key ? ' ★' : ''}</option>)}
              </select>
            </label>
          ) : (
            <label>Chamber
              <select value={chamber} onChange={(e) => setChamber(e.target.value)}>
                <option value="senate">Senate</option>
                {widget === 'balance' ? <option value="house">House</option> : <option value="governor">Governor</option>}
              </select>
            </label>
          )}
          <fieldset>
            <legend>Size</legend>
            <div className="embb__chips">
              {(Object.keys(SIZES) as Size[]).map((s) => (
                <button key={s} type="button" className={`chip ${size === s ? 'is-active' : ''}`} aria-pressed={size === s} onClick={() => setSize(s)}>
                  {s} · {SIZES[s].w}×{SIZES[s].h}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Theme</legend>
            <div className="embb__chips">
              {(['dark', 'light'] as const).map((t) => (
                <button key={t} type="button" className={`chip ${theme === t ? 'is-active' : ''}`} aria-pressed={theme === t} onClick={() => setTheme(t)}>{t}</button>
              ))}
            </div>
          </fieldset>
          <label>Embed code
            <textarea readOnly value={snippet} rows={4} onFocus={(e) => e.currentTarget.select()} />
          </label>
          <div className="embb__actions">
            <button type="button" className="btn btn--accent" onClick={copy}>{copied ? 'Copied ✓' : 'Copy embed code'}</button>
            <a className="btn" href={src} target="_blank" rel="noopener noreferrer">Open widget</a>
            {widget === 'race' && raceId && <ShareCardButton kind="race" id={raceId} />}
            {widget === 'balance' && <ShareCardButton kind="balance" id={chamber === 'house' ? 'house' : 'senate'} />}
          </div>
        </form>
        <section className="embb__preview" aria-label="Live preview">
          <div className="embb__frame" style={{ width: w, maxWidth: '100%' }}>
            <iframe key={src} src={src} width={w} height={h} title="Widget preview" style={{ border: 0, width: '100%', borderRadius: 12 }} />
          </div>
        </section>
      </div>
    </div>
  );
}
