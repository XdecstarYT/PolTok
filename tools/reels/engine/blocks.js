// Reusable scene blocks: branded end card.
import * as THREE from 'three';
import { E, C, ease, remap, stage, camPath } from './core.js';
import * as kit from './kit.js';
import * as ui from './ui.js';

/** Branded end card. o: { title, sub, sources } */
export function endCard(S, o = {}) {
  S.scene.fog = null;
  stage(S, { accent: C.lime, accent2: 0x3d7bff, grid: 0.09, rim: 50, glow: 0.14, glowPos: [0, 5, -14], center: [0, 3, 0] });
  const mark = kit.poltokMark(E.svgMark, { size: 1.75 });
  const piv = new THREE.Group();
  piv.add(mark);
  piv.position.set(0, 3.5, 0);
  S.scene.add(piv);
  const ring = kit.arcGauge({ r: 1.5, tube: 0.03, mat: kit.M.glow(C.lime, 1.3) });
  ring.position.set(0, 3.5, -0.4);
  S.scene.add(ring);
  const dust = kit.particles({ count: 260, center: [0, 4, -3], box: [18, 12, 12], color: C.lime, color2: 0x7da7ff, size: 22, alpha: 0.6 });
  S.scene.add(dust);
  camPath(S, [
    { t: 0, pos: [0.0, 3.0, 10.0], look: [0, 2.2, 0] },
    { t: S.dur, pos: [0.0, 2.9, 11.2], look: [0, 2.2, 0] },
  ], { shake: 0.02 });
  S.focus = 10.5; S.aperture = 0.5;
  S.update((lt, t) => {
    const k = ease.back(remap(lt, 0.0, 0.9));
    piv.rotation.y = (1 - k) * -1.6 + Math.sin(lt * 1.1) * 0.08;
    piv.rotation.x = Math.sin(lt * 0.8) * 0.05;
    piv.scale.setScalar(0.3 + 0.7 * ease.expo(remap(lt, 0, 0.6)));
    piv.position.y = 3.5 + Math.sin(lt * 1.6) * 0.06;
    ring.userData.setFrac(ease.inOut(remap(lt, 0.2, 1.4)));
    ring.rotation.z = -lt * 0.3;
    dust.userData.tick(t);
  });
  ui.headline(S, { t0: 0.45, html: o.title || 'Follow <em>PolTok</em>', y: 1000, size: 112, align: 'center', style: 'rise', font: 'serif', t1: S.dur + 5 });
  ui.block(S, { t0: 0.8, html: o.sub || 'Live results, maps and explainers', cls: 'body', y: 1140, align: 'center', t1: S.dur + 5 });
  ui.block(S, { t0: 1.05, html: '<div class="endcta"><div class="urlpill"><span class="dot"></span>poltok.netlify.app</div></div>', y: 1236, style: 'pop', t1: S.dur + 5 });
  if (o.sources) ui.block(S, { t0: 1.3, html: o.sources, cls: 'src', y: 1420, align: 'center', t1: S.dur + 5 });
}
