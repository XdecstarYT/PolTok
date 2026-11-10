/** Release notes → ready-to-post X copy (deterministic templates; AI rewrite is optional and separate). Pure. */
import type { CardData } from '../../../lib/cards';
import type { UpdatePost } from '../../updates/api';
import { assemblePost, hashtagLine, splitThread, SITE, trimToFit, utmUrl, xLength, X_MAX } from './xtext';
import { BADGE_OFF } from './badgeOpts';
import type { XDraft } from './types';

const plain = (md: string) => md.replace(/\*\*|__|`/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^#+\s*/gm, '').trim();

/** Bullet lines ("- x") of a markdown-lite body, plain text. */
export function bulletsOf(body: string): string[] {
  return body.split('\n').filter((l) => /^\s*[-*•]\s+/.test(l)).map((l) => plain(l.replace(/^\s*[-*•]\s+/, ''))).filter(Boolean);
}
/** First non-bullet, non-heading paragraph line. */
export function introOf(body: string): string {
  return plain(body.split('\n').find((l) => l.trim() && !/^\s*[-*•]\s+/.test(l) && !/^\s*\*\*[^*]+\*\*\s*$/.test(l)) ?? '');
}

export const UPDATE_TAGS = ['PolTok', 'Politics'];
const tagsFor = (posts: UpdatePost[]) => {
  const txt = posts.map((p) => `${p.title} ${p.body}`).join(' ').toLowerCase();
  const t = ['PolTok'];
  if (/australi|victoria|nsw|auspol/.test(txt)) t.push('auspol');
  if (/new zealand|\bnz\b/.test(txt)) t.push('nzpol');
  if (/midterm|congress|senate|house/.test(txt)) t.push('Midterms2026');
  if (t.length < 2) t.push('Politics');
  return t.slice(0, 3);
};

export const updateLink = (p?: UpdatePost) => utmUrl(`${SITE}/updates${p ? '#' + p.id : ''}`, p ? `update-${p.id}` : 'updates');

export function updateCard(posts: UpdatePost[]): CardData {
  const one = posts.length === 1 ? posts[0] : null;
  return one
    ? {
        kind: 'announcement',
        title: one.title,
        subtitle: (introOf(one.body) || bulletsOf(one.body)[0] || '').slice(0, 140),
        footer: [one.version, 'PolTok updates'].filter(Boolean).join(' · '),
        cta: 'poltok.netlify.app/updates',
        url: `${SITE}/updates`,
      }
    : {
        kind: 'announcement',
        title: `${posts.length} new things on PolTok`,
        subtitle: posts.slice(0, 3).map((p) => p.title).join(' · ').slice(0, 140),
        footer: 'PolTok updates',
        cta: 'poltok.netlify.app/updates',
        url: `${SITE}/updates`,
      };
}

export function updateAlt(posts: UpdatePost[]): string {
  const c = updateCard(posts);
  return trimToFit(`PolTok announcement card. Headline: “${c.title}”.${c.subtitle ? ` ${c.subtitle.replace(/[.!?…]+$/, '')}.` : ''} Link: poltok.netlify.app/updates`, 1000);
}

/**
 * Posts for one or more updates. One update → a single tweet when it fits, otherwise a thread
 * (hook + link first, then the bullet points). Several → a "what's new" thread, one post per update.
 */
export function postsForUpdates(posts: UpdatePost[], tags = tagsFor(posts)): { posts: string[]; url: string } {
  if (!posts.length) return { posts: [], url: '' };
  if (posts.length === 1) {
    const p = posts[0];
    const url = updateLink(p);
    const head = `${p.major ? '🚀 ' : '✨ '}New on PolTok${p.version ? ' ' + p.version : ''}: ${plain(p.title)}`;
    const bullets = bulletsOf(p.body);
    const intro = introOf(p.body);
    const shortBody = [head, bullets.slice(0, 3).map((b) => '• ' + b).join('\n')].filter(Boolean).join('\n\n');
    const single = assemblePost(shortBody, { tags, url });
    if (bullets.length <= 3 && xLength(single) <= X_MAX && !single.includes('…')) return { posts: [single], url };
    const first = assemblePost(`${head} 🧵${intro ? '\n\n' + intro : ''}`, { tags, url });
    const rest = splitThread(bullets.map((b) => '• ' + b).join('\n'), { number: false });
    const all = [first, ...rest];
    return { posts: all.map((t, i) => `${t}\n\n${i + 1}/${all.length}`.trim()).map((t) => (xLength(t) > X_MAX ? trimToFit(t) : t)), url };
  }
  const url = updateLink();
  const sorted = [...posts].sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  const first = assemblePost(`🧵 What's new on PolTok — ${posts.length} updates since our last post:\n\n${sorted.map((p) => '• ' + plain(p.title)).join('\n')}`, { tags, url });
  const rest = sorted.map((p) => {
    const b = bulletsOf(p.body).slice(0, 2).map((x) => '– ' + x).join('\n');
    return trimToFit(`${p.version ? p.version + ' · ' : ''}${plain(p.title)}${b ? '\n' + b : ''}\n${updateLink(p)}`, X_MAX - 8);
  });
  const all = [first, ...rest];
  return { posts: all.map((t, i) => `${t}\n\n${i + 1}/${all.length}`), url };
}

export const newId = (p = 'x') => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** A full queue draft for one or more updates. */
export function draftForUpdates(posts: UpdatePost[], designId = 'announce', now = Date.now()): XDraft {
  const tags = tagsFor(posts);
  const { posts: texts, url } = postsForUpdates(posts, tags);
  return {
    id: newId('upd'),
    title: posts.length === 1 ? posts[0].title : `${posts.length} updates: ${posts.map((p) => p.title).join(', ')}`.slice(0, 120),
    posts: texts,
    url,
    hashtags: tags.map((t) => '#' + t),
    alt: updateAlt(posts),
    designId,
    cardKind: 'announcement',
    card: updateCard(posts),
    brand: true,
    badge: { ...BADGE_OFF },
    source: { type: 'update', ids: posts.map((p) => p.id) },
    status: 'draft',
    created: now,
    updated: now,
  };
}

/** Published (non-draft) updates newer than `since` (epoch ms), oldest first. */
export function updatesSince(all: UpdatePost[], since = 0): UpdatePost[] {
  return all.filter((p) => !p.draft && Date.parse(p.date) > since).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}

export { hashtagLine };
