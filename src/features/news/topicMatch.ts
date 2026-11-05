/** Client mirror of server TOPIC_DEFS matching (server/news.js), for tagging stories with topic hubs. */
import type { NewsItem } from '../../types';
import { cleanText } from './newsUtils';

const DEFS: Record<string, { tags: string[]; re: RegExp }> = {
  senate: { tags: ['senate'], re: /\bsenat(e|or|ors)\b/i },
  house: { tags: ['house'], re: /\b(the house|house (race|seat|majority|control)|congressional district|speaker)\b/i },
  governors: { tags: ['governor'], re: /\b(governor|gubernatorial)\b/i },
  abortion: { tags: ['abortion'], re: /\babortion\b/i },
  economy: { tags: ['economy'], re: /\b(economy|inflation|tariffs?|jobs report|interest rates?|cost of living|budget)\b/i },
  immigration: { tags: ['immigration'], re: /\b(immigration|immigrants?|border|deportation|migrants?|visa)\b/i },
  climate: { tags: [], re: /\b(climate|emissions|net zero|renewables?|clean energy|carbon)\b/i },
  trump: { tags: ['trump'], re: /\btrump\b/i },
  'victoria-election': { tags: [], re: /\b(victoria(n)?|vic\b|spring street|allan|battin|wilson|vec)\b/i },
  'one-nation': { tags: [], re: /\b(one nation|hanson)\b/i },
  albanese: { tags: [], re: /\balbanese\b/i },
};

export function topicMatchClient(item: NewsItem, slug: string) {
  const d = DEFS[slug];
  if (!d) return false;
  if (d.tags.length && item.tags?.some((t) => d.tags.includes(t.toLowerCase()))) return true;
  return d.re.test(`${cleanText(item.title)} ${cleanText(item.summary)}`);
}
