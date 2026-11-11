// "Realistic" kit: procedural PBR textures (wood, leather, marble, carpet, paper) with normal and
// roughness maps, a lit interior set (panelled walls, carpet, ceiling lights) and a legislative
// chamber built from instanced leather benches and timber desks. Everything is generated in code:
// no external images or models.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { E, C, ease, remap, lerp } from './core.js';

RectAreaLightUniformsLib.init();

// ---------- noise ----------
function makeNoise(seed = 1) {
  const p = new Uint8Array(512);
  let s = seed * 9301 + 49297;
  const r = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  const perm = [...Array(256).keys()].sort(() => r() - 0.5);
  for (let i = 0; i < 512; i++) p[i] = perm[i & 255];
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const grad = (h, x, y) => ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
  const n2 = (x, y) => {
    const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
    x -= Math.floor(x); y -= Math.floor(y);
    const u = fade(x), v = fade(y);
    const a = p[X] + Y, b = p[X + 1] + Y;
    return lerp(lerp(grad(p[a], x, y), grad(p[b], x - 1, y), u), lerp(grad(p[a + 1], x, y - 1), grad(p[b + 1], x - 1, y - 1), u), v) * 0.7 + 0.5;
  };
  const fbm = (x, y, oct = 5) => { let a = 0, f = 1, w = 0.5, t = 0; for (let i = 0; i < oct; i++) { a += n2(x * f, y * f) * w; t += w; f *= 2; w *= 0.5; } return a / t; };
  return { n2, fbm };
}

// Build colour + height canvases with fn(u,v) -> [r,g,b,height,rough]
function bake(size, fn) {
  const col = document.createElement('canvas'), hgt = document.createElement('canvas'), rgh = document.createElement('canvas');
  [col, hgt, rgh].forEach((c) => { c.width = c.height = size; });
  const cc = col.getContext('2d'), hc = hgt.getContext('2d'), rc = rgh.getContext('2d');
  const ci = cc.createImageData(size, size), hi = hc.createImageData(size, size), ri = rc.createImageData(size, size);
  const H = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const [r, g, b, h, ro] = fn(x / size, y / size);
    const i = (y * size + x) * 4;
    ci.data[i] = r; ci.data[i + 1] = g; ci.data[i + 2] = b; ci.data[i + 3] = 255;
    H[y * size + x] = h;
    const R = Math.round((ro ?? 0.5) * 255);
    ri.data[i] = ri.data[i + 1] = ri.data[i + 2] = R; ri.data[i + 3] = 255;
  }
  // normal map from height (sobel, wrapping)
  const at = (x, y) => H[((y + size) % size) * size + ((x + size) % size)];
  const nrm = document.createElement('canvas'); nrm.width = nrm.height = size;
  const nc = nrm.getContext('2d'), ni = nc.createImageData(size, size);
  const k = 2.2;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (at(x + 1, y) - at(x - 1, y)) * k, dy = (at(x, y + 1) - at(x, y - 1)) * k;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * size + x) * 4;
    ni.data[i] = (-dx / l * 0.5 + 0.5) * 255; ni.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; ni.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; ni.data[i + 3] = 255;
  }
  cc.putImageData(ci, 0, 0); rc.putImageData(ri, 0, 0); nc.putImageData(ni, 0, 0);
  const tex = (c, srgb) => { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8; if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  return { map: tex(col, true), normalMap: tex(nrm), roughnessMap: tex(rgh) };
}

const cache = new Map();
const memo = (key, f) => { if (!cache.has(key)) cache.set(key, f()); return cache.get(key); };
const hex = (c) => { const k = new THREE.Color(c); return [k.r * 255, k.g * 255, k.b * 255]; };
const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

export const tex = {
  wood: (tone = 0x6b3f22) => memo('wood' + tone, () => {
    const N = makeNoise(3), base = hex(tone), dark = mixc(base, [20, 10, 4], 0.55), lite = mixc(base, [235, 190, 140], 0.25);
    return bake(512, (u, v) => {
      const w = N.fbm(u * 3, v * 0.4, 4);
      const ring = Math.sin((u * 26 + w * 7) * Math.PI) * 0.5 + 0.5;
      const grain = N.fbm(u * 120, v * 6, 3);
      const t = Math.pow(ring, 2.2) * 0.65 + grain * 0.35;
      const c = mixc(lite, dark, t);
      return [c[0], c[1], c[2], t * 0.35 + grain * 0.15, 0.38 + grain * 0.2];
    });
  }),
  leather: (tone = 0x1f5a3a) => memo('leather' + tone, () => {
    const N = makeNoise(7), base = hex(tone);
    return bake(512, (u, v) => {
      const cell = N.fbm(u * 48, v * 48, 3), big = N.fbm(u * 4, v * 4, 3);
      const crease = Math.pow(Math.abs(N.n2(u * 90, v * 90) - 0.5) * 2, 0.6);
      const t = cell * 0.6 + big * 0.4;
      const c = mixc(mixc(base, [0, 0, 0], 0.35), mixc(base, [255, 255, 255], 0.12), t);
      return [c[0], c[1], c[2], cell * 0.6 - crease * 0.25, 0.55 - big * 0.18];
    });
  }),
  marble: (tone = 0xe9e4da) => memo('marble' + tone, () => {
    const N = makeNoise(11), base = hex(tone), vein = mixc(base, [60, 58, 64], 0.75);
    return bake(512, (u, v) => {
      const w = N.fbm(u * 3, v * 3, 6);
      const m = Math.pow(1 - Math.abs(Math.sin((u * 4 + v * 2 + w * 6) * Math.PI)), 14);
      const c = mixc(base, vein, m * 0.8 + N.fbm(u * 18, v * 18, 3) * 0.08);
      return [c[0], c[1], c[2], m * 0.05, 0.12 + m * 0.2];
    });
  }),
  carpet: (tone = 0x3a1e24) => memo('carpet' + tone, () => {
    const N = makeNoise(5), base = hex(tone);
    return bake(256, (u, v) => {
      const f = N.fbm(u * 160, v * 160, 2), p = N.fbm(u * 6, v * 6, 3);
      const c = mixc(mixc(base, [0, 0, 0], 0.25), mixc(base, [255, 255, 255], 0.08), f * 0.7 + p * 0.3);
      return [c[0], c[1], c[2], f * 0.5, 0.92];
    });
  }),
  paper: () => memo('paper', () => {
    const N = makeNoise(13);
    return bake(256, (u, v) => {
      const f = N.fbm(u * 90, v * 12, 3) * 0.6 + N.fbm(u * 200, v * 200, 2) * 0.4;
      const c = mixc([244, 240, 230], [214, 207, 192], f * 0.5);
      return [c[0], c[1], c[2], f * 0.25, 0.85];
    });
  }),
};

/** PBR material from a texture set, with repeat. */
export function pbr(set, o = {}) {
  const rep = o.repeat || [1, 1];
  const t = (x) => { if (!x) return x; const c = x.clone(); c.needsUpdate = true; c.repeat.set(rep[0], rep[1]); return c; };
  return new THREE.MeshPhysicalMaterial({
    map: t(set.map), normalMap: t(set.normalMap), roughnessMap: t(set.roughnessMap),
    normalScale: new THREE.Vector2(o.normal ?? 0.8, o.normal ?? 0.8),
    roughness: o.roughness ?? 1, metalness: o.metalness ?? 0, clearcoat: o.clearcoat ?? 0, clearcoatRoughness: o.clearcoatRoughness ?? 0.3,
    sheen: o.sheen ?? 0, sheenRoughness: 0.6, sheenColor: new THREE.Color(o.sheenColor ?? 0xffffff), envMapIntensity: o.env ?? 1,
  });
}

/**
 * A lit interior set instead of the abstract stage: panelled timber walls, carpet, a ceiling of soft
 * area lights and warm practical lamps. o: { carpet, wood, width, depth, height, center, warm, bloom }
 */
export function room(S, o = {}) {
  const { scene } = S;
  scene.background = new THREE.Color(o.bg ?? 0x0c0a09);
  scene.fog = new THREE.FogExp2(o.bg ?? 0x0c0a09, o.fog ?? 0.018);
  scene.environmentIntensity = o.env ?? 0.55;
  const W = o.width ?? 26, D = o.depth ?? 22, Hh = o.height ?? 9;
  const c = o.center || [0, 0, 0];
  const g = new THREE.Group(); g.position.set(c[0], 0, c[2]);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), pbr(tex.carpet(o.carpet ?? 0x40242a), { repeat: [W / 3, D / 3], sheen: 0.6, sheenColor: 0xd9a8a8 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; g.add(floor);
  const wallMat = pbr(tex.wood(o.wood ?? 0x5b351c), { repeat: [W / 4, Hh / 4], clearcoat: 0.35, clearcoatRoughness: 0.35 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(W, Hh), wallMat); back.position.set(0, Hh / 2, -D / 2); back.receiveShadow = true; g.add(back);
  const left = new THREE.Mesh(new THREE.PlaneGeometry(D, Hh), wallMat); left.rotation.y = Math.PI / 2; left.position.set(-W / 2, Hh / 2, 0); g.add(left);
  const right = left.clone(); right.rotation.y = -Math.PI / 2; right.position.x = W / 2; g.add(right);
  // vertical panel battens on the back wall for depth
  const batM = pbr(tex.wood((o.wood ?? 0x5b351c) - 0x101008), { repeat: [0.2, 2], clearcoat: 0.5 });
  const bat = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, Hh, 0.12), batM, Math.ceil(W / 1.6));
  const m4 = new THREE.Matrix4();
  for (let i = 0; i < bat.count; i++) { m4.makeTranslation(-W / 2 + 0.8 + i * 1.6, Hh / 2, -D / 2 + 0.06); bat.setMatrixAt(i, m4); }
  bat.castShadow = true; g.add(bat);
  // dado rail + skirting
  const rail = new THREE.Mesh(new THREE.BoxGeometry(W, 0.16, 0.18), batM); rail.position.set(0, 1.2, -D / 2 + 0.1); g.add(rail);
  scene.add(g);
  // lighting: hemisphere fill, a big soft area light overhead, warm key with shadows, practical glow
  scene.add(new THREE.HemisphereLight(0xfff1dd, 0x1a1210, o.fill ?? 0.45));
  const area = new THREE.RectAreaLight(0xfff4e6, o.area ?? 6, 10, 6);
  area.position.set(c[0], Hh - 0.2, c[2] + 1); area.lookAt(c[0], 0, c[2]); scene.add(area);
  const key = new THREE.SpotLight(o.warm ?? 0xffd7a8, o.key ?? 260, 40, 0.55, 0.65, 1.6);
  key.position.set(c[0] + 5, Hh - 0.5, c[2] + 6); key.target.position.set(c[0], 0.6, c[2] - 1);
  key.castShadow = true; key.shadow.mapSize.set(1536, 1536); key.shadow.bias = -0.0003; key.shadow.radius = 6;
  scene.add(key, key.target);
  const kick = new THREE.SpotLight(0xbfd2ff, (o.key ?? 260) * 0.35, 40, 0.6, 0.8, 1.6);
  kick.position.set(c[0] - 7, Hh - 1, c[2] - 4); kick.target.position.set(c[0], 0.6, c[2]);
  scene.add(kick, kick.target);
  // gentle bloom for realism (less neon than the abstract stage)
  S.update(() => { if (E.bloom) { E.bloom.strength = o.bloom ?? 0.22; E.bloom.threshold = 1.1; } });
  return { group: g, key, area, floor };
}

/**
 * Legislative chamber: n leather seats on tiered horseshoe benches with timber desks.
 * Each seat has a small desk lamp (instanced emissive) that set(i, color, k) lights in a party colour.
 * o: { rows, r0, r1, leather, wood, open (0..1 of a full circle used, default 0.62 = horseshoe) }
 */
export function chamber(n, o = {}) {
  const rows = o.rows ?? Math.max(4, Math.round(Math.sqrt(n / 4)));
  const r0 = o.r0 ?? 3.2, r1 = o.r1 ?? 7.4, span = Math.PI * 2 * (o.open ?? 0.62);
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((r1 - r0) * i) / Math.max(1, rows - 1));
  const tot = radii.reduce((a, b) => a + b, 0);
  const counts = radii.map((r) => Math.max(1, Math.round((n * r) / tot)));
  counts[rows - 1] += n - counts.reduce((a, b) => a + b, 0);
  const spots = [];
  radii.forEach((r, ri) => {
    const cnt = counts[ri];
    for (let j = 0; j < cnt; j++) {
      const a = -span / 2 + (cnt === 1 ? span / 2 : (span * (j + 0.5)) / cnt);
      spots.push({ a, r, ri });
    }
  });
  spots.sort((p, q) => p.a - q.a || p.r - q.r);
  const grp = new THREE.Group();
  const leather = pbr(tex.leather(o.leather ?? 0x1e5636), { repeat: [1, 1], normal: 1.1, sheen: 0.4, sheenColor: 0x9fd8b3, clearcoat: 0.15 });
  const wood = pbr(tex.wood(o.wood ?? 0x6b3f22), { repeat: [0.6, 0.6], clearcoat: 0.6, clearcoatRoughness: 0.25 });
  const seatG = new RoundedBoxGeometry(0.5, 0.18, 0.5, 2, 0.06);
  const backG = new RoundedBoxGeometry(0.5, 0.62, 0.14, 2, 0.06);
  const deskG = new RoundedBoxGeometry(0.62, 0.08, 0.36, 2, 0.03);
  const lampG = new RoundedBoxGeometry(0.56, 0.07, 0.07, 2, 0.02);
  const mk = (geo, mat) => { const m = new THREE.InstancedMesh(geo, mat, n); m.castShadow = true; m.receiveShadow = true; grp.add(m); return m; };
  const seats = mk(seatG, leather), backs = mk(backG, leather), desks = mk(deskG, wood);
  const lamps = new THREE.InstancedMesh(lampG, new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0, toneMapped: true }), n);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  lamps.material = lampMat; grp.add(lamps);
  // tier risers (timber steps)
  radii.forEach((r, ri) => {
    const step = new THREE.Mesh(new THREE.RingGeometry(r - 0.55, r + 0.45, 96, 1, Math.PI / 2 - span / 2 - 0.08, span + 0.16), wood);
    step.rotation.x = -Math.PI / 2; step.position.y = ri * 0.32 + 0.001; step.receiveShadow = true; grp.add(step);
    const rise = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.45, r + 0.45, ri * 0.32 + 0.01, 96, 1, true, Math.PI - span / 2 - 0.08, span + 0.16), wood);
    rise.position.y = (ri * 0.32) / 2; grp.add(rise);
  });
  const pos = [];
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s1 = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    const y = s.ri * 0.32;
    const x = Math.sin(s.a) * s.r, z = -Math.cos(s.a) * s.r; // a=0 faces the far end (−z)
    q.setFromAxisAngle(up, -s.a);
    const place = (mesh, dr, dy) => { p.set(Math.sin(s.a) * (s.r + dr), y + dy, -Math.cos(s.a) * (s.r + dr)); m4.compose(p, q, s1); mesh.setMatrixAt(i, m4); };
    place(seats, 0.05, 0.24); place(backs, 0.3, 0.55); place(desks, -0.42, 0.62); place(lamps, -0.62, 0.66);
    pos.push(new THREE.Vector3(x, y + 0.75, z));
    lamps.setColorAt(i, col.set(0x000000));
  });
  lamps.instanceColor.needsUpdate = true;
  // central table + Speaker's chair (generic) at the open end
  const table = new THREE.Mesh(new RoundedBoxGeometry(1.4, 0.8, 3.2, 3, 0.05), wood);
  table.position.set(0, 0.4, (r0 - 1.6) * -0.0 + 0.6); table.castShadow = true; table.receiveShadow = true; grp.add(table);
  return {
    group: grp, pos, count: n, spots,
    set(i, color, k = 1) { lamps.setColorAt(i, col.set(color).multiplyScalar(0.06 + k * 1.6)); },
    commit() { lamps.instanceColor.needsUpdate = true; },
  };
}

/** Realistic paper sheet with optional canvas-drawn face. */
export function sheet(w, h, draw) {
  const face = document.createElement('canvas'); face.width = 1024; face.height = Math.round((1024 * h) / w);
  const g = face.getContext('2d');
  const base = tex.paper().map.image;
  for (let y = 0; y < face.height; y += base.height) for (let x = 0; x < face.width; x += base.width) g.drawImage(base, x, y);
  draw && draw(g, face.width, face.height);
  const t = new THREE.CanvasTexture(face); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const m = new THREE.MeshPhysicalMaterial({ map: t, color: 0xcfcac0, roughness: 0.9, sheen: 0.15, sheenColor: 0xffffff, side: THREE.DoubleSide });
  const geo = new THREE.PlaneGeometry(w, h, 12, 12);
  const mesh = new THREE.Mesh(geo, m); mesh.castShadow = true; mesh.receiveShadow = true;
  return mesh;
}

export { THREE };
