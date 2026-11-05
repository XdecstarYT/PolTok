import { useState } from 'react';
import { Button } from '../../components';
import { useLive } from '../../lib/live';
import { VICTORIA } from '../../data/au';
import { SITE } from './tweets';

function CopyBlock({ title, text, max }: { title: string; text: string; max?: number }) {
  const [ok, setOk] = useState('');
  const n = [...text].length;
  return (
    <div className="ow-block">
      <div className="ow-block__h">
        <strong>{title}</strong>
        {max && <span className={`ow-count ${n > max ? 'is-over' : ''}`}>{n}/{max}</span>}
        <Button size="sm" variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(text); setOk('Copied'); } catch { setOk('Copy failed'); } }}>{ok || 'Copy'}</Button>
      </div>
      <pre className="ow-pre">{text}</pre>
    </div>
  );
}

const LINKS: [string, string][] = [
  ['Live election night', '/live'], ['Interactive map', '/map'], ['Ask PolTok (AI)', '/ask'], ['PolTok feed', '/feed'],
  ['Flips tracker', '/flips'], ['Ballot measures', '/measures'], ['Forecast & markets', '/forecast'], ['Polls', '/polls'],
  ['News (bias-labelled)', '/news'], ['Parliament tracker', '/parliament'], ['Victoria 2026', '/au/victoria'],
  ['Swingometer', '/au/swingometer'], ['Australia hub', '/au'], ['Embed widgets', '/embed'],
];

export function ContentTools() {
  const live = useLive();
  const sen = live.balance.senate;
  const days = Math.max(0, Math.ceil((Date.parse(VICTORIA.pollsCloseUtc) - Date.now()) / 86400000));
  const thread = [
    `🧵 Meet PolTok — election night, rebuilt for your phone. Live results, race calls, maps, polls, markets and news in one fast app. Free, no sign-up. 1/7\n${SITE}`,
    `⚡ Live: every Senate, House & governor race with real AP results (via NYT), % counted and race calls as they happen.${sen ? ` Right now: Senate D ${sen.dem + sen.ind} – R ${sen.rep}.` : ''} 2/7\n${SITE}/live`,
    `🗺️ The map is alive — states and House seats shift as votes land. Tap to drill into any race. 3/7\n${SITE}/map`,
    `🤖 Ask PolTok: plain-English questions, answers grounded only in live data with sources cited. No hallucinated winners. 4/7\n${SITE}/ask`,
    `📱 The PolTok feed: calls, flips and headlines in a vertical swipe. News from Left, Center and Right, labelled. 5/7\n${SITE}/feed`,
    `🇦🇺 Not just the US: Victoria votes in ${days} days. Every seat, margin and candidate, plus a swingometer you can drag. 6/7\n${SITE}/au/victoria`,
    `🏛️ And after the votes: track bills and roll calls in Congress and the Australian Parliament from official sources. Follow along 👉 7/7\n${SITE}/parliament`,
  ];
  return (
    <section className="ow-tools">
      <h3>Launch thread ({thread.length} tweets)</h3>
      <CopyBlock title="Whole thread" text={thread.join('\n\n---\n\n')} />
      {thread.map((t, i) => <CopyBlock key={i} title={`Tweet ${i + 1}`} text={t} max={280} />)}
      <h3>Profile bios</h3>
      <CopyBlock title="X / Twitter bio" max={160} text="Election night, rebuilt for your phone 📱 Live results, race calls, maps, polls & news. US midterms + 🇦🇺 Vic 2026. Ask our AI anything." />
      <CopyBlock title="TikTok bio" max={80} text="Live election results 🗳️ maps, calls & flips ⚡ US + AU 🇦🇺" />
      <CopyBlock title="Instagram bio" max={150} text={`🗳️ Live election results, maps & race calls\n📱 Politics, scroll-native\n🇺🇸 Midterms 2026 · 🇦🇺 Vic votes 28 Nov\n👇 Live now`} />
      <CopyBlock title="Long description (link previews / app stores)" text="PolTok is a free, real-time politics app: live AP results via The New York Times, race calls, flips, balance of power, interactive maps, polls, prediction markets and bias-labelled news — plus Australia’s Victorian and federal elections, a swingometer, a parliament tracker and Ask PolTok, an AI assistant that answers only from live data." />
      <h3>Link-in-bio</h3>
      <CopyBlock title="Deep links" text={LINKS.map(([l, p]) => `${l} — ${SITE}${p}`).join('\n')} />
    </section>
  );
}
