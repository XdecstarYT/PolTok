// Social pack 2.0 — every asset (size, renderer, safe zones) per platform, plus the spec sources.
// Shared by the Owner "Social pack" tool and tests. Rects are fractions of the asset (x, y, w, h in 0..1).
//   safe   = area that is visible on every device (keep text/logos inside)
//   covers = areas platform UI draws over (profile photo, buttons, captions)
//   brand  = drawn by the brand renderer (real logo geometry); otherwise `design` = card design id (renderCard)

const R = (x, y, w, h, label) => ({ x, y, w, h, label });
const story = (id) => ({ id, type: 'story', label: 'Story template', w: 1080, h: 1920, design: 'story-message', covers: [R(0, 0, 1, 0.13, 'Top bar / profile'), R(0, 0.82, 1, 0.18, 'Reply / caption UI')] });
const postSq = { id: 'post-square', type: 'post', label: 'Post template (square)', w: 1080, h: 1080, design: 'statement' };
const postPt = { id: 'post-portrait', type: 'post', label: 'Post template (portrait 4:5)', w: 1080, h: 1350, design: 'announce', safe: [R(0, 0.0625, 1, 0.875, 'Profile grid 3:4 crop')] };
const avatar = (w, label = 'Profile picture') => ({ id: 'avatar', type: 'avatar', label, w, h: w, brand: 'avatar', design: 'x-avatar', circle: true });

/** The 8 highlight covers (Instagram story highlights; also used as TikTok/Facebook story covers). */
export const HIGHLIGHT_ICONS = ['live', 'map', 'au', 'news', 'polls', 'results', 'ask', 'menu'];
export const HIGHLIGHT_LABELS = { live: 'Live', map: 'Map', au: 'AU', news: 'News', polls: 'Polls', results: 'Results', ask: 'Ask', menu: 'Menu' };
const hl = (icon) => ({ id: `highlight-${icon}`, type: 'highlight', label: `Highlight · ${HIGHLIGHT_LABELS[icon]}`, w: 1080, h: 1920, brand: 'highlight', icon, design: 'highlight', circle: true, safe: [R(0.2, 0.3875, 0.6, 0.3375, 'Circle crop')] });

export const SOCIAL_PACK = {
  x: { name: 'X / Twitter', assets: [
    avatar(400),
    { id: 'header', type: 'banner', label: 'Header', w: 1500, h: 500, brand: 'banner', design: 'x-header', covers: [R(0.02, 0.56, 0.2, 0.44, 'Profile photo')], safe: [R(0, 0.1, 1, 0.8, 'Visible on all crops')] },
    { id: 'community-banner', type: 'banner', label: 'Community banner', w: 1200, h: 480, brand: 'banner', design: 'x-header' },
    postSq,
  ] },
  instagram: { name: 'Instagram', assets: [
    avatar(320),
    ...HIGHLIGHT_ICONS.map(hl), story('story'), postSq, postPt,
  ] },
  tiktok: { name: 'TikTok', assets: [
    avatar(200),
    { ...story('story'), covers: [R(0, 0, 1, 0.08, 'Top tabs'), R(0.85, 0.35, 0.15, 0.5, 'Action buttons'), R(0, 0.75, 1, 0.25, 'Caption / music')] },
  ] },
  youtube: { name: 'YouTube', assets: [
    avatar(800),
    { id: 'banner', type: 'banner', label: 'Channel banner', w: 2560, h: 1440, brand: 'banner', design: 'x-header', safe: [R((2560 - 1546) / 2 / 2560, (1440 - 423) / 2 / 1440, 1546 / 2560, 423 / 1440, 'Safe area 1546×423 (all devices)')] },
    { id: 'thumbnail', type: 'thumbnail', label: 'Video thumbnail template', w: 1280, h: 720, design: 'announce', covers: [R(0.86, 0.86, 0.13, 0.11, 'Duration badge')] },
  ] },
  facebook: { name: 'Facebook', assets: [
    avatar(320),
    { id: 'cover', type: 'banner', label: 'Cover photo', w: 1640, h: 624, brand: 'banner', design: 'x-header', covers: [R(0.02, 0.6, 0.18, 0.4, 'Profile photo')], safe: [R(0.162, 0, 0.676, 1, 'Mobile crop (16:9)')] },
    { id: 'cover-small', type: 'banner', label: 'Cover photo (851×315)', w: 851, h: 315, brand: 'banner', design: 'x-header', covers: [R(0.02, 0.6, 0.2, 0.4, 'Profile photo')], safe: [R(0.162, 0, 0.676, 1, 'Mobile crop (16:9)')] },
    postSq,
  ] },
  linkedin: { name: 'LinkedIn', assets: [
    avatar(400),
    { id: 'banner', type: 'banner', label: 'Profile background banner', w: 1584, h: 396, brand: 'banner', design: 'x-header', covers: [R(0.02, 0.45, 0.17, 0.55, 'Profile photo')] },
    { id: 'page-cover', type: 'banner', label: 'Company page cover (upload 1128×191, exported @2x)', w: 2256, h: 382, brand: 'banner', design: 'x-header', covers: [R(0.02, 0.55, 0.12, 0.45, 'Page logo')] },
    { id: 'post', type: 'post', label: 'Post template', w: 1200, h: 627, design: 'announce' },
  ] },
  threads: { name: 'Threads', assets: [
    avatar(320),
    postPt,
  ] },
  bluesky: { name: 'Bluesky', assets: [
    avatar(1000, 'Avatar'),
    { id: 'banner', type: 'banner', label: 'Banner', w: 1500, h: 500, brand: 'banner', design: 'x-header', covers: [R(0.02, 0.6, 0.18, 0.4, 'Avatar')] },
  ] },
  discord: { name: 'Discord', assets: [
    { ...avatar(512, 'Server icon'), brand: 'icon' },
    { id: 'banner', type: 'banner', label: 'Server banner', w: 960, h: 540, brand: 'banner', design: 'x-header', safe: [R(0, 0, 1, 0.6, 'Sidebar shows top ~60%')] },
    { id: 'invite-splash', type: 'splash', label: 'Invite splash', w: 1920, h: 1080, brand: 'splash', design: 'x-header', covers: [R(0.3, 0.25, 0.4, 0.5, 'Invite dialog')] },
  ] },
};

/** Extra (non-platform) brand assets shipped in every export. */
export const EXTRA_ASSETS = [
  { id: 'og', type: 'og', label: 'Link preview (Open Graph)', w: 1200, h: 630, brand: 'banner', design: 'x-header', safe: [R(0.08, 0, 0.84, 1, 'Square-crop safe (some apps)')], platform: 'web', file: 'web/og-1200x630.png' },
  { id: 'email-signature', type: 'email', label: 'Email signature banner (600×200 @2x)', w: 1200, h: 400, brand: 'email', design: 'x-header', platform: 'web', file: 'web/email-signature-600x200@2x.png' },
];

/**
 * Current spec sizes with sources. `checked` is when the figure was last re-checked (official help page
 * linked; cross-checked against 2026 size guides). Platforms change these often: re-check before campaigns.
 */
const CHK = '2026-11-06';
export const SPECS = [
  { platform: 'x', item: 'Profile photo', size: '400×400', note: 'displays as circle', source: 'https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo', checked: CHK },
  { platform: 'x', item: 'Header', size: '1500×500', note: '3:1, top/bottom crop on some screens', source: 'https://help.x.com/en/managing-your-account/common-issues-when-uploading-profile-photo', checked: CHK },
  { platform: 'x', item: 'Community banner', size: '1200×480', note: '5:2', source: 'https://help.x.com/en/using-x/communities', checked: CHK },
  { platform: 'x', item: 'In-feed image', size: '1080×1080 / 1200×675', note: '1:1 or 16:9', source: 'https://help.x.com/en/using-x/tweeting-gifs-and-pictures', checked: CHK },
  { platform: 'instagram', item: 'Profile photo', size: '320×320', note: 'displays 110px circle', source: 'https://help.instagram.com/1631821640426723', checked: CHK },
  { platform: 'instagram', item: 'Feed post', size: '1080×1080 / 1080×1350', note: 'profile grid shows 3:4 crop (since 2025)', source: 'https://help.instagram.com/1631821640426723', checked: CHK },
  { platform: 'instagram', item: 'Story / highlight cover', size: '1080×1920', note: 'highlight shows centre circle', source: 'https://help.instagram.com/1038071743007909', checked: CHK },
  { platform: 'tiktok', item: 'Profile photo', size: '200×200 min', note: 'circle', source: 'https://support.tiktok.com/en/getting-started/setting-up-your-profile/changing-your-profile-photo-or-video', checked: CHK },
  { platform: 'tiktok', item: 'Video / story', size: '1080×1920', note: 'right rail + caption cover edges', source: 'https://ads.tiktok.com/help/article/tiktok-auction-in-feed-ads', checked: CHK },
  { platform: 'youtube', item: 'Profile picture', size: '800×800', note: 'renders 98px circle', source: 'https://support.google.com/youtube/answer/2976309', checked: CHK },
  { platform: 'youtube', item: 'Channel banner', size: '2560×1440', note: 'safe area 1546×423; min 2048×1152', source: 'https://support.google.com/youtube/answer/2972003', checked: CHK },
  { platform: 'youtube', item: 'Thumbnail', size: '1280×720', note: '≤2 MB, 16:9', source: 'https://support.google.com/youtube/answer/72431', checked: CHK },
  { platform: 'facebook', item: 'Profile picture', size: '320×320 min', note: 'circle', source: 'https://www.facebook.com/help/1620869161526307', checked: CHK },
  { platform: 'facebook', item: 'Cover photo', size: '1640×624 (min 851×315)', note: 'desktop 820×312, mobile 640×360 crop', source: 'https://www.facebook.com/help/125379114252045', checked: CHK },
  { platform: 'linkedin', item: 'Profile background', size: '1584×396', note: '4:1', source: 'https://www.linkedin.com/help/linkedin/answer/a563309', checked: CHK },
  { platform: 'linkedin', item: 'Company page cover', size: '1128×191', note: 'logo 400×400', source: 'https://www.linkedin.com/help/linkedin/answer/a563309', checked: CHK },
  { platform: 'linkedin', item: 'Link / post image', size: '1200×627', note: '1.91:1', source: 'https://www.linkedin.com/help/lms/answer/a426534', checked: CHK },
  { platform: 'threads', item: 'Profile photo', size: '320×320', note: 'shared with Instagram', source: 'https://help.instagram.com/788669719351404', checked: CHK },
  { platform: 'threads', item: 'Post image', size: '1080×1350', note: '4:5 max height in feed', source: 'https://help.instagram.com/788669719351404', checked: CHK },
  { platform: 'bluesky', item: 'Avatar', size: '1000×1000', note: 'circle', source: 'https://bsky.social/about/support', checked: CHK },
  { platform: 'bluesky', item: 'Banner', size: '3000×1000 (3:1; 1500×500 ok)', note: 'avatar overlaps bottom-left', source: 'https://bsky.social/about/support', checked: CHK },
  { platform: 'discord', item: 'Server icon', size: '512×512 (min 128)', note: 'circle', source: 'https://support.discord.com/hc/en-us/articles/360035991572', checked: CHK },
  { platform: 'discord', item: 'Server banner', size: '960×540', note: '16:9, Boost level 2', source: 'https://support.discord.com/hc/en-us/articles/360028716472', checked: CHK },
  { platform: 'discord', item: 'Invite splash', size: '1920×1080', note: '16:9, Boost level 1', source: 'https://support.discord.com/hc/en-us/articles/360028716472', checked: CHK },
  { platform: 'web', item: 'Open Graph image', size: '1200×630', note: '1.91:1, <5 MB', source: 'https://developers.facebook.com/docs/sharing/webmasters/images', checked: CHK },
  { platform: 'web', item: 'Email signature banner', size: '600×200 (2× for retina)', note: 'convention; most clients cap width ~600px', source: 'https://www.htmlemailcheck.com/knowledge-base/email-width/', checked: CHK },
];

/** Flat list of assets for the chosen platforms (file names unique). */
export function packAssets(platforms) {
  const out = [];
  for (const p of platforms) {
    const def = SOCIAL_PACK[p];
    if (!def) continue;
    for (const a of def.assets) out.push({ ...a, platform: p, file: `${p}/${a.id}-${a.w}x${a.h}.png` });
  }
  return out;
}

/** README listing every asset, size, safe zone, spec source and the copy. */
export function packReadme(platforms, copy = {}, limits = {}) {
  const L = ['# PolTok brand & social pack', `Generated ${new Date().toISOString().slice(0, 10)}`, '', 'Folders: one per platform, web/ (OG + email), brand/ (logos SVG+PNG), brand-guide.html (print to PDF).', ''];
  for (const p of platforms) {
    const def = SOCIAL_PACK[p];
    if (!def) continue;
    L.push(`== ${def.name} ==`);
    for (const a of def.assets) {
      L.push(`  ${p}/${a.id}-${a.w}x${a.h}.png  — ${a.label}, ${a.w}×${a.h}px${a.circle ? ' (circle-safe)' : ''}`);
      for (const s of a.safe ?? []) L.push(`      keep inside: ${s.label}`);
      for (const c of a.covers ?? []) L.push(`      covered by: ${c.label}`);
    }
    for (const s of SPECS.filter((x) => x.platform === p)) L.push(`  spec: ${s.item} ${s.size} — ${s.note} [${s.source}, checked ${s.checked}]`);
    if (copy.bios?.[p]) L.push(`  Bio (${[...copy.bios[p]].length}/${limits[p]?.bio ?? '?'} chars): ${copy.bios[p]}`);
    L.push('');
  }
  L.push('== Web ==');
  for (const a of EXTRA_ASSETS) L.push(`  ${a.file}  — ${a.label}`);
  for (const s of SPECS.filter((x) => x.platform === 'web')) L.push(`  spec: ${s.item} ${s.size} — ${s.note} [${s.source}, checked ${s.checked}]`);
  L.push('');
  if (copy.names?.length) L.push(`Display names: ${copy.names.join(' · ')}`);
  if (copy.handles?.length) L.push(`Handles: ${copy.handles.map((h) => '@' + h).join(' · ')}`);
  if (copy.pinned) L.push('', 'Pinned post:', copy.pinned);
  if (copy.links?.length) L.push('', 'Link in bio:', ...copy.links.map((l) => `  ${l.label}: https://poltok.netlify.app${l.path}`));
  return L.join('\n') + '\n';
}
