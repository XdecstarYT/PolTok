/**
 * Browser-only news fallback, used when the PolTok API server is unreachable (static hosting,
 * `vite preview`, etc.). Fetches real RSS through CORS-friendly routes:
 *  - feeds that send `Access-Control-Allow-Origin: *` (NYT) are fetched and parsed directly;
 *  - others go through the public rss2json.com converter (free tier, ~10 items per feed).
 * Never fabricates items: if every request fails, it returns [].
 */
import type { Lean, NewsItem } from '../types';
import { OUTLET_LEAN } from '../../server/feeds.js';

const GN = (q: string) => `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;

type Feed = { name: string; url: string; lean: Lean; direct?: boolean; gnews?: boolean };

const FEEDS: Feed[] = [
  { name: 'New York Times', url: 'https://rss.nytimes.com/services/xml/rss/nyt/Politics.xml', lean: 'Lean Left', direct: true },
  { name: 'Google News', url: GN('midterm election results when:1d'), lean: 'Unrated', gnews: true },
  { name: 'Google News', url: GN('Senate race 2026 when:1d'), lean: 'Unrated', gnews: true },
  { name: 'Google News', url: GN('governor race 2026 when:1d'), lean: 'Unrated', gnews: true },
  { name: 'Google News', url: GN('House midterms 2026 when:1d'), lean: 'Unrated', gnews: true },
  { name: 'NPR', url: 'https://feeds.npr.org/1014/rss.xml', lean: 'Lean Left' },
  { name: 'Fox News', url: 'https://moxie.foxnews.com/google-publisher/politics.xml', lean: 'Right' },
  { name: 'The Hill', url: 'https://thehill.com/homenews/campaign/feed/', lean: 'Center' },
  { name: 'Politico', url: 'https://rss.politico.com/politics-news.xml', lean: 'Lean Left' },
  { name: 'Washington Examiner', url: 'https://www.washingtonexaminer.com/section/politics/feed/', lean: 'Lean Right' },
  { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/us_and_canada/rss.xml', lean: 'Center' },
];

const STATES: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA', Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL', Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY',
  Louisiana: 'LA', Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN', Mississippi: 'MS', Missouri: 'MO',
  Montana: 'MT', Nebraska: 'NE', Nevada: 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK', Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI',
  'South Carolina': 'SC', 'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT', Virginia: 'VA',
  Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI', Wyoming: 'WY',
};
const KEYWORDS: [RegExp, string][] = [
  [/\bsenat/i, 'senate'], [/\bhouse\b|congress/i, 'house'], [/governor|gubernatorial/i, 'governor'], [/\bpoll/i, 'polls'],
  [/trump/i, 'trump'], [/result|wins|projected|called/i, 'results'], [/midterm/i, 'midterms'], [/election|ballot|vote/i, 'election'],
];

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(16);
}

function strip(html = '') {
  const d = new DOMParser().parseFromString(html, 'text/html');
  return (d.body.textContent || '').replace(/\s+/g, ' ').trim();
}

function tags(text: string) {
  const out = new Set<string>();
  for (const [name, abbr] of Object.entries(STATES)) if (new RegExp(`\\b${name}\\b`).test(text)) out.add(abbr);
  for (const [re, t] of KEYWORDS) if (re.test(text)) out.add(t);
  return [...out];
}

function make(feed: Feed, raw: { title: string; link: string; date: string; summary?: string; image?: string; source?: string }): NewsItem | null {
  let title = raw.title?.trim();
  if (!title || !raw.link) return null;
  let source = feed.name;
  let lean = feed.lean;
  if (feed.gnews) {
    const m = title.match(/^(.*) - ([^-]+)$/);
    source = raw.source || m?.[2]?.trim() || 'Google News';
    if (m) title = m[1].trim();
    lean = ((OUTLET_LEAN as Record<string, Lean>)[source] ?? 'Unrated') as Lean;
  }
  const publishedAt = Date.parse(raw.date.replace(' ', 'T') + (/[zZ]|[+-]\d\d:?\d\d$/.test(raw.date) ? '' : 'Z')) || Date.now();
  const summary = feed.gnews ? undefined : strip(raw.summary).slice(0, 320) || undefined;
  return {
    id: hash(raw.link),
    title,
    url: raw.link,
    source,
    sourceLean: lean,
    publishedAt,
    summary,
    image: raw.image || undefined,
    tags: tags(`${title} ${summary ?? ''}`),
    breaking: Date.now() - publishedAt < 30 * 60000 && /breaking|projected|wins/i.test(title),
  };
}

async function fetchDirect(feed: Feed): Promise<NewsItem[]> {
  const res = await fetch(feed.url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(String(res.status));
  const doc = new DOMParser().parseFromString(await res.text(), 'text/xml');
  return [...doc.querySelectorAll('item')]
    .map((it) =>
      make(feed, {
        title: it.querySelector('title')?.textContent || '',
        link: it.querySelector('link')?.textContent || '',
        date: it.querySelector('pubDate')?.textContent || '',
        summary: it.querySelector('description')?.textContent || '',
        image: it.getElementsByTagName('media:content')[0]?.getAttribute('url') || undefined,
      }),
    )
    .filter((x): x is NewsItem => !!x);
}

async function fetchViaRss2Json(feed: Feed): Promise<NewsItem[]> {
  const res = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(String(res.status));
  const d = (await res.json()) as {
    status: string;
    items?: { title: string; link: string; pubDate: string; description?: string; thumbnail?: string; enclosure?: { link?: string }; author?: string }[];
  };
  if (d.status !== 'ok') throw new Error(d.status);
  return (d.items ?? [])
    .map((it) =>
      make(feed, {
        title: it.title,
        link: it.link,
        date: it.pubDate,
        summary: it.description,
        image: it.thumbnail || it.enclosure?.link,
      }),
    )
    .filter((x): x is NewsItem => !!x);
}

/** Fetch real headlines straight from the browser. Resolves to [] if everything fails. */
export async function fetchBrowserNews(): Promise<NewsItem[]> {
  const settled = await Promise.allSettled(FEEDS.map((f) => (f.direct ? fetchDirect(f) : fetchViaRss2Json(f))));
  const seen = new Set<string>();
  const items: NewsItem[] = [];
  for (const s of settled) {
    if (s.status !== 'fulfilled') continue;
    for (const it of s.value) {
      const key = it.title.toLowerCase();
      if (seen.has(it.id) || seen.has(key)) continue;
      seen.add(it.id);
      seen.add(key);
      items.push(it);
    }
  }
  return items.sort((a, b) => b.publishedAt - a.publishedAt);
}
