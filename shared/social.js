// Social packs — every asset (size, design, safe zones) per platform. Shared by the Owner "Social pack"
// tool and tests. Rects are fractions of the asset (x, y, w, h in 0..1).
//   safe   = area that is visible on every device (keep text/logos inside)
//   covers = areas platform UI draws over (profile photo, buttons, captions)

const R = (x, y, w, h, label) => ({ x, y, w, h, label });
const story = (id) => ({ id, type: 'story', label: 'Story template', w: 1080, h: 1920, design: 'story-message', covers: [R(0, 0, 1, 0.13, 'Top bar / profile'), R(0, 0.82, 1, 0.18, 'Reply / caption UI')] });
const postSq = { id: 'post-square', type: 'post', label: 'Post template (square)', w: 1080, h: 1080, design: 'statement' };
const postPt = { id: 'post-portrait', type: 'post', label: 'Post template (portrait 4:5)', w: 1080, h: 1350, design: 'announce' };
const hl = (n) => ({ id: `highlight-${n}`, type: 'highlight', label: `Highlight cover ${n}`, w: 1080, h: 1920, design: 'highlight', circle: true, safe: [R(0.2, 0.3875, 0.6, 0.3375, 'Circle crop')] });

export const SOCIAL_PACK = {
  x: { name: 'X / Twitter', assets: [
    { id: 'avatar', type: 'avatar', label: 'Profile picture', w: 400, h: 400, design: 'x-avatar', circle: true },
    { id: 'header', type: 'banner', label: 'Header', w: 1500, h: 500, design: 'x-header', covers: [R(0.02, 0.56, 0.2, 0.44, 'Profile photo')] },
    postSq,
  ] },
  instagram: { name: 'Instagram', assets: [
    { id: 'avatar', type: 'avatar', label: 'Profile picture', w: 320, h: 320, design: 'x-avatar', circle: true },
    hl(1), hl(2), hl(3), story('story'), postSq, postPt,
  ] },
  tiktok: { name: 'TikTok', assets: [
    { id: 'avatar', type: 'avatar', label: 'Profile picture', w: 200, h: 200, design: 'x-avatar', circle: true },
    { ...story('story'), covers: [R(0, 0, 1, 0.08, 'Top tabs'), R(0.85, 0.35, 0.15, 0.5, 'Action buttons'), R(0, 0.75, 1, 0.25, 'Caption / music')] },
    hl(1),
  ] },
  youtube: { name: 'YouTube', assets: [
    { id: 'avatar', type: 'avatar', label: 'Profile picture', w: 800, h: 800, design: 'x-avatar', circle: true },
    { id: 'banner', type: 'banner', label: 'Channel banner', w: 2560, h: 1440, design: 'x-header', safe: [R((2560 - 1546) / 2 / 2560, (1440 - 423) / 2 / 1440, 1546 / 2560, 423 / 1440, 'Safe area 1546×423 (all devices)')] },
  ] },
  facebook: { name: 'Facebook', assets: [
    { id: 'avatar', type: 'avatar', label: 'Profile picture', w: 320, h: 320, design: 'x-avatar', circle: true },
    { id: 'cover', type: 'banner', label: 'Cover photo', w: 1640, h: 624, design: 'x-header', covers: [R(0.02, 0.6, 0.18, 0.4, 'Profile photo')], safe: [R(0.1, 0, 0.8, 1, 'Mobile crop')] },
    { id: 'cover-small', type: 'banner', label: 'Cover photo (851×315)', w: 851, h: 315, design: 'x-header', covers: [R(0.02, 0.6, 0.2, 0.4, 'Profile photo')] },
    postSq,
  ] },
  linkedin: { name: 'LinkedIn', assets: [
    { id: 'avatar', type: 'avatar', label: 'Profile picture', w: 400, h: 400, design: 'x-avatar', circle: true },
    { id: 'banner', type: 'banner', label: 'Background banner', w: 1584, h: 396, design: 'x-header', covers: [R(0.02, 0.45, 0.17, 0.55, 'Profile photo')] },
    { id: 'post', type: 'post', label: 'Post template', w: 1200, h: 627, design: 'announce' },
  ] },
  threads: { name: 'Threads', assets: [
    { id: 'avatar', type: 'avatar', label: 'Profile picture', w: 320, h: 320, design: 'x-avatar', circle: true },
    postPt,
  ] },
  bluesky: { name: 'Bluesky', assets: [
    { id: 'avatar', type: 'avatar', label: 'Avatar', w: 1000, h: 1000, design: 'x-avatar', circle: true },
    { id: 'banner', type: 'banner', label: 'Banner', w: 1500, h: 500, design: 'x-header', covers: [R(0.02, 0.6, 0.18, 0.4, 'Avatar')] },
  ] },
  discord: { name: 'Discord', assets: [
    { id: 'avatar', type: 'avatar', label: 'Server icon / avatar', w: 512, h: 512, design: 'x-avatar', circle: true },
    { id: 'banner', type: 'banner', label: 'Server banner', w: 960, h: 540, design: 'x-header' },
  ] },
};

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

/** README.txt listing every asset, size and the copy. */
export function packReadme(platforms, copy = {}, limits = {}) {
  const L = ['PolTok social pack', `Generated ${new Date().toISOString().slice(0, 10)}`, ''];
  for (const p of platforms) {
    const def = SOCIAL_PACK[p];
    if (!def) continue;
    L.push(`== ${def.name} ==`);
    for (const a of def.assets) {
      L.push(`  ${p}/${a.id}-${a.w}x${a.h}.png  — ${a.label}, ${a.w}×${a.h}px${a.circle ? ' (circle-safe)' : ''}`);
      for (const s of a.safe ?? []) L.push(`      keep inside: ${s.label}`);
      for (const c of a.covers ?? []) L.push(`      covered by: ${c.label}`);
    }
    if (copy.bios?.[p]) L.push(`  Bio (${[...copy.bios[p]].length}/${limits[p]?.bio ?? '?'} chars): ${copy.bios[p]}`);
    L.push('');
  }
  if (copy.names?.length) L.push(`Display names: ${copy.names.join(' · ')}`);
  if (copy.handles?.length) L.push(`Handles: ${copy.handles.map((h) => '@' + h).join(' · ')}`);
  if (copy.pinned) L.push('', 'Pinned post:', copy.pinned);
  if (copy.links?.length) L.push('', 'Link in bio:', ...copy.links.map((l) => `  ${l.label}: https://poltok.netlify.app${l.path}`));
  return L.join('\n') + '\n';
}
