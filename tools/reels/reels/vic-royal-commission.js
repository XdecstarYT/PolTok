// Reel — Victoria's Big Build royal commission: what it is and what week one of public hearings heard (as of 12 Nov 2026).
// Sources: the commission (rcimcp.vic.gov.au: established 20 Aug 2026 by the Governor, Commissioner the Hon Christopher
// Kourakis AC, final report due by 20 Aug 2027, 110,688 documents received as of 6 Nov); ABC News 9 Nov 2026 explainer
// and hearing report (John Holland 2017 memo, Gap Road stop-work 6–7 Jun 2022, ~$6m blowout, counsel assisting: "allegations
// at this stage"; Premier Carroll denies knowledge); CFMEU administrator Geoffrey Watson SC's public claim of "as much as
// $15 billion" lost (as reported by ABC). Everything heard is presented as EVIDENCE/ALLEGATIONS — no findings exist.
// Individual witnesses and people accused are deliberately not named.

export const meta = {
  title: 'Big Build royal commission: week one',
  label: 'ROYAL COMMISSION · ALLEGATIONS',
  labelCls: 'warn',
  out: 'poltok-vic-royal-commission',
  cover: 1.6,
  music: { prog: ['Dm', 'Bb', 'Gm', 'A'], arp: 'up', seed: 77, swing: 0.02 },
};

export const scenes = () => [
  { id: 'hook', beats: 8, energy: 3, voLead: 0.08,
    say: 'Victoria\'s Big Build is under a royal commission. Here\'s what it\'s heard so far.' },
  { id: 'what', beats: 10, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'Premier Ben Carroll called it in August. A former chief justice is running it.',
    cap: 'Called by Premier Ben Carroll in August. Commissioner: Chris Kourakis, former SA Chief Justice.' },
  { id: 'why', beats: 10, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'It follows corruption allegations against the construction union. Its administrator claims up to fifteen billion dollars was lost.',
    cap: 'Trigger: allegations about the CFMEU. Its administrator claims up to $15b lost.' },
  { id: 'gap', beats: 12, energy: 3, trans: { type: 'flash', dur: 0.36 },
    say: 'Week one: a rail site in Sunbury. The commission heard work stopped there in twenty twenty-two, and costs blew out by six million.',
    cap: 'Week one: Gap Road, Sunbury. Heard: a June 2022 stop-work, about $6m cost blowout.' },
  { id: 'memo', beats: 10, energy: 3, trans: { type: 'whip', dir: 'up', dur: 0.42 },
    say: 'And a 2017 memo said the union had unprecedented access to ministers. The premier says he knew nothing of it.',
    cap: 'A 2017 John Holland memo: "unprecedented access to ministers". Premier Carroll denies knowledge.' },
  { id: 'caveat', beats: 8, energy: 1, trans: { type: 'fade', dur: 0.45 },
    say: 'Remember: these are allegations. No findings yet, and some claims are denied.',
    cap: 'These are allegations. No findings yet. Some claims are denied.' },
  { id: 'next', beats: 8, energy: 2, trans: { type: 'whip', dir: 'left', dur: 0.42 },
    say: 'Hearings end eight days before the election. The final report is due next August.',
    cap: 'Hearings to 20 Nov, 8 days before the election. Final report due by Aug 2027.' },
  { id: 'ask', beats: 8, energy: 2, trans: { type: 'zoom', dur: 0.45 },
    say: 'Should this change how Victoria votes? Tell me in the comments.', cap: 'Should this change how Victoria votes? 👇' },
  { id: 'end', beats: 6, energy: 0, trans: { type: 'zoom', dur: 0.5 }, noProgress: true },
];

export function build({ E, kit, ui, THREE, endCard, real }) {
  const { C, ease, remap } = E;
  const AMBER = '#ffb347';

  // an inquiry document (generic, illustrative)
  const doc = (title, sub, stamp) => real.sheet(1.5, 2.0, (c, w) => {
    c.fillStyle = 'rgba(20,18,15,.85)'; c.font = '700 34px "Inter Tight"'; c.fillText('ROYAL COMMISSION · VICTORIA', 60, 100);
    c.fillRect(60, 120, w - 120, 4);
    c.font = '800 88px Newsreader'; const words = title.split(' '); let line = '', y = 250;
    for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (c.measureText(t).width > w - 120 && line) { c.fillText(line, 60, y); line = wd; y += 96; } else line = t; }
    c.fillText(line, 60, y);
    c.font = '500 40px Newsreader'; c.fillStyle = 'rgba(20,18,15,.65)'; c.fillText(sub, 60, y + 70);
    c.fillStyle = 'rgba(20,18,15,.16)'; for (let l = 0; l < 16; l++) c.fillRect(60, y + 130 + l * 46, w - 120 - (l % 4) * 70, 14);
    if (stamp) { c.save(); c.translate(w - 240, 1180); c.rotate(-0.25); c.strokeStyle = 'rgba(190,40,40,.75)'; c.lineWidth = 8; c.strokeRect(-150, -55, 300, 110); c.fillStyle = 'rgba(190,40,40,.8)'; c.font = '800 44px "Inter Tight"'; c.textAlign = 'center'; c.fillText(stamp, 0, 16); c.restore(); }
  });

  const deskScene = (S, pages, o = {}) => {
    real.room(S, { carpet: 0x2b2420, wood: 0x4a3020, width: 16, depth: 14, height: 7, key: o.key ?? 100, area: 2.4, fill: 0.28 });
    const desk = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.16, 3.8), real.pbr(real.tex.wood(0x5c3a20), { repeat: [2, 1], clearcoat: 0.7, clearcoatRoughness: 0.2 }));
    desk.position.set(0, 1.0, 0); desk.receiveShadow = true; desk.castShadow = true; S.scene.add(desk);
    // a tall stack of evidence folders behind
    for (let i = 0; i < 26; i++) { const f = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.05, 1.45), real.pbr(real.tex.paper ? real.tex.paper() : real.tex.wood(0xd8cfbf), {})); f.position.set(-2.3 + Math.sin(i) * 0.03, 1.11 + i * 0.052, -1.0); f.rotation.y = Math.sin(i * 2.1) * 0.05; f.castShadow = true; S.scene.add(f); }
    const meshes = pages.map(([h, s, st], i) => {
      const p = doc(h, s, st);
      p.rotation.x = -Math.PI / 2; p.rotation.z = (i - (pages.length - 1) / 2) * 0.1 + Math.sin(i * 2.3) * 0.04;
      p.position.set((i - (pages.length - 1) / 2) * 0.32, 1.09 + i * 0.012, (pages.length - 1 - i) * -0.18);
      S.scene.add(p); return p;
    });
    const at = o.at ?? ((i) => 0.25 + i * 0.7);
    meshes.forEach((_, i) => E.cue(S.t0 + at(i) + 0.35, 'pop', { i }));
    S.update((lt) => meshes.forEach((p, i) => { const k = ease.expo(remap(lt, at(i), at(i) + 0.5)); p.position.y = 1.09 + i * 0.012 + (1 - k) * 2.6; p.visible = k > 0.01; }));
    E.camPath(S, [{ t: 0, pos: [0, 5.3, 3.3], look: [0, 1.1, -0.1], fov: 34 }, { t: S.dur, pos: [0.25, 4.9, 3.0], look: [0, 1.1, -0.1], fov: 34 }], { shake: 0.012, shiftY: 470, focusOn: true });
    S.aperture = 0.35;
  };

  E.defineScene('hook', (S) => {
    deskScene(S, [['Terms of Reference', 'Integrity of major construction projects', null], ['Public Hearings', '9 – 20 November 2026', 'LIVE']], { at: (i) => 0.05 + i * 0.5 });
    E.cue(S.t0 + 0.3, 'boom', { g: 0.7 });
    ui.kicker(S, { t0: 0, text: 'Victoria · as of 12 November', y: 372 });
    ui.headline(S, { t0: 0, html: 'Big Build <em>royal commission</em>', y: 410, size: 92, style: 'slam', stagger: 0.04, t1: S.dur + 1 });
    ui.block(S, { t0: 0.35, html: 'Victoria\'s $100b project. What week one heard.', cls: 'body', y: 620, w: 920, size: 46, t1: S.dur + 1 });
  });

  E.defineScene('what', (S) => {
    deskScene(S, [['Letters Patent', 'Issued 20 August 2026', null]], { at: () => 0.2 });
    ui.kicker(S, { t0: 0.05, text: 'What is it?', y: 372 });
    ui.list(S, { t0: 0.3, stagger: 0.6, y: 420, size: 44, mark: '●', markColor: AMBER, items: [
      'Called by Premier <b>Ben Carroll</b>, August 2026',
      'Commissioner: <b>Chris Kourakis</b>, former SA Chief Justice',
      '<b>110,000+</b> documents received so far',
    ] });
  });

  E.defineScene('why', (S) => {
    deskScene(S, [['Administrator\'s Report', 'CFMEU, Victorian branch', null]], { at: () => 0.2 });
    ui.kicker(S, { t0: 0.05, text: 'Why now?', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Up to <em>$15b</em>', y: 410, size: 130, style: 'slam' });
    ui.block(S, { t0: 0.8, html: 'claimed lost to organised crime, says the union\'s federal administrator.<br><span style="opacity:.7">A claim, not a finding.</span>', cls: 'body', y: 580, w: 920, size: 42 });
  });

  E.defineScene('gap', (S) => {
    deskScene(S, [['Case Study: Gap Road', 'Level crossing removal, Sunbury', null], ['Stop-work', '6 – 7 June 2022', 'EXHIBIT']], { at: (i) => 0.2 + i * 1.0 });
    ui.kicker(S, { t0: 0.05, text: 'Week one · Sunbury', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Gap Road <em>stop-work</em>', y: 410, size: 96, style: 'rise' });
    ui.counter(S, { t0: 1.4, dur: 1.2, to: 6, prefix: '~$', suffix: 'm', y: 540, size: 150, color: AMBER, label: 'estimated cost blowout, the commission heard' });
  });

  E.defineScene('memo', (S) => {
    deskScene(S, [['Internal Memo, 2017', 'Contractor briefing note', 'EXHIBIT']], { at: () => 0.2 });
    ui.kicker(S, { t0: 0.05, text: 'Read to the commission', y: 372 });
    ui.headline(S, { t0: 0.1, html: '“Unprecedented <em>access to ministers</em>”', y: 410, size: 80, style: 'rise' });
    ui.block(S, { t0: 1.2, html: 'A 2017 John Holland memo, about the CFMEU', cls: 'body', y: 600, w: 920, size: 42 });
    ui.block(S, { t0: 2.4, html: 'Premier Carroll: <b>no knowledge</b> of that access', cls: 'body', y: 690, w: 920, size: 42 });
  });

  E.defineScene('caveat', (S) => {
    deskScene(S, [['Allegations Only', 'No findings have been made', 'UNTESTED']], { at: () => 0.15, key: 80 });
    ui.kicker(S, { t0: 0.05, text: 'Important', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Just <em>allegations</em>', y: 410, size: 104, style: 'rise' });
    ui.block(S, { t0: 0.8, html: 'No findings yet. Some claims are denied.', cls: 'body', y: 580, w: 920, size: 46 });
  });

  E.defineScene('next', (S) => {
    deskScene(S, [['Final Report', 'Due by 20 August 2027', null]], { at: () => 0.2 });
    ui.kicker(S, { t0: 0.05, text: 'What\'s next', y: 372 });
    ui.list(S, { t0: 0.3, stagger: 0.7, y: 420, size: 46, mark: '●', markColor: AMBER, items: [
      'Hearings until <b>20 Nov</b>',
      'Election: <b>28 Nov</b>',
      'Final report: by <b>Aug 2027</b>',
    ] });
  });

  E.defineScene('ask', (S) => {
    deskScene(S, [['Your Vote', '28 November 2026', null]], { at: () => 0.1, key: 110 });
    ui.kicker(S, { t0: 0.05, text: 'Your turn', y: 372 });
    ui.headline(S, { t0: 0.1, html: 'Should this change <em>how you vote?</em>', y: 410, size: 92, style: 'rise' });
    ui.block(S, { t0: 0.9, html: '<b style="color:#c8f04a">Comment</b> 👇 &nbsp;·&nbsp; <b>Follow</b> for week two', cls: 'body', y: 640, w: 920, size: 44 });
  });

  E.defineScene('end', (S) => endCard(S, { title: 'Follow it <em>live</em>', sub: 'poltok.netlify.app/au/victoria', sources: 'Sources: the royal commission (rcimcp.vic.gov.au); ABC News, 9–11 Nov 2026. Evidence and claims are untested allegations;<br>no findings have been made. Documents shown are illustrative.' }));
}
