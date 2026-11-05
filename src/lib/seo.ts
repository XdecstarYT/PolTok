/** Per-route document title + description + Open Graph/Twitter tags. Usage: useSeo({ title: 'Live results', description: '…' }). */
import { useEffect } from 'react';

export const SITE_URL = 'https://poltok.netlify.app';
export const SITE_NAME = 'PolTok';
const DEFAULT_DESC = 'Live election results, maps, markets and news.';
const DEFAULT_IMAGE = '/og-default.png';

export interface SeoOptions { title?: string; description?: string; image?: string; }

function setMeta(attr: 'name' | 'property', key: string, value: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', value);
}

export function applySeo({ title, description, image }: SeoOptions = {}) {
  if (typeof document === 'undefined') return;
  const full = title ? `${title} · ${SITE_NAME}` : `${SITE_NAME} — Election Night Command Center`;
  const desc = description || DEFAULT_DESC;
  const img = new URL(image || DEFAULT_IMAGE, SITE_URL).href;
  const url = SITE_URL + window.location.pathname;
  document.title = full;
  setMeta('name', 'description', desc);
  setMeta('property', 'og:title', full);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:image', img);
  setMeta('property', 'og:url', url);
  setMeta('name', 'twitter:title', full);
  setMeta('name', 'twitter:description', desc);
  setMeta('name', 'twitter:image', img);
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) { link = document.createElement('link'); link.rel = 'canonical'; document.head.appendChild(link); }
  link.href = url;
}

export function useSeo(opts: SeoOptions = {}) {
  const { title, description, image } = opts;
  useEffect(() => { applySeo({ title, description, image }); }, [title, description, image]);
}
