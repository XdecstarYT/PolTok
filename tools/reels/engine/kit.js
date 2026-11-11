// 3D building blocks for reels: bevelled solids, 3D type, extruded maps, hemicycles, coins, particles.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';
import { TTFLoader } from 'three/addons/loaders/TTFLoader.js';
import { Font } from 'three/addons/loaders/FontLoader.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';
import { E, C, ease, clamp, remap } from './core.js';

// ---------- materials ----------
export const M = {
  std: (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.42, metalness: 0.15, ...o }),
  gloss: (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.28, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.18, ...o }),
  metal: (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.26, metalness: 1, ...o }),
  glow: (color, k = 1.6, o = {}) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4, ...o }),
  lime: () => new THREE.MeshPhysicalMaterial({ color: C.lime, emissive: C.lime, emissiveIntensity: 0.08, roughness: 0.25, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.12 }),
  ink: () => new THREE.MeshPhysicalMaterial({ color: 0x151a23, roughness: 0.32, metalness: 0.5, clearcoat: 0.6 }),
  gold: () => new THREE.MeshStandardMaterial({ color: 0xe9b949, roughness: 0.24, metalness: 1, envMapIntensity: 1.3 }),
};

export const shadow = (o, cast = true, recv = true) => { o.traverse((m) => { if (m.isMesh) { m.castShadow = cast; m.receiveShadow = recv; } }); return o; };

export const box = (w, h, d, r = 0.08, mat) => shadow(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, Math.min(r, w / 2, h / 2, d / 2)), mat));

// ---------- 3D type ----------
const fonts = {};
export async function loadFont(name, url) {
  const buf = await (await fetch(url)).arrayBuffer();
  fonts[name] = new Font(new TTFLoader().parse(buf));
  return fonts[name];
}
export function text3d(str, o = {}) {
  const font = fonts[o.font || 'sans'];
  const size = o.size ?? 1;
  const g = new TextGeometry(str, {
    font, size, depth: o.depth ?? size * 0.28, curveSegments: o.curve ?? 5,
    bevelEnabled: o.bevel !== false, bevelThickness: size * 0.035, bevelSize: size * 0.022, bevelOffset: 0, bevelSegments: o.bevelSegments ?? 3,
  });
  g.computeBoundingBox();
  const bb = g.boundingBox;
  const ax = o.align === 'left' ? -bb.min.x : o.align === 'right' ? -bb.max.x : -(bb.min.x + bb.max.x) / 2;
  g.translate(ax, -(bb.min.y + bb.max.y) / 2 + (o.baseline ? (bb.max.y - bb.min.y) / 2 : 0), -(bb.min.z + bb.max.z) / 2);
  const m = new THREE.Mesh(g, o.mat || M.lime());
  m.userData.width = bb.max.x - bb.min.x;
  return shadow(m);
}

// ---------- extruded maps ----------
function shapeFrom(poly) {
  const s = new THREE.Shape(poly[0].map((p) => new THREE.Vector2(p[0], p[1])));
  for (const h of poly.slice(1)) s.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p[0], p[1]))));
  return s;
}
/** Extrude projected rings (from engine/geo.mjs) into a slab lying on XZ (north = -Z). */
export function extrudeRings(polys, o = {}) {
  const shapes = polys.map(shapeFrom);
  const bev = o.bevel ?? 0.05;
  const g = new THREE.ExtrudeGeometry(shapes, {
    depth: o.depth ?? 0.3, curveSegments: 1, bevelEnabled: bev > 0, bevelThickness: bev, bevelSize: bev * 0.8, bevelOffset: -bev * 0.8 - (o.inset ?? 0), bevelSegments: o.bevelSegments ?? 2,
  });
  g.rotateX(-Math.PI / 2);
  return g;
}
export function mapSlab(geo, o = {}) {
  const grp = new THREE.Group();
  const polys = geo.outline.map((r) => [r]);
  const slab = shadow(new THREE.Mesh(extrudeRings(polys, { depth: o.depth ?? 0.35, bevel: o.bevel ?? 0.06 }), o.mat || M.ink()));
  grp.add(slab);
  grp.userData.slab = slab;
  if (o.edge !== false) {
    const edgeMat = M.glow(o.edgeColor ?? C.lime, o.edgeGlow ?? 2.2);
    for (const r of geo.outline.slice(0, o.edgeRings ?? 6)) {
      if (r.length < 12) continue;
      const pts = r.map((p) => new THREE.Vector3(p[0], (o.depth ?? 0.35) + (o.bevel ?? 0.06) + 0.012, -p[1]));
      const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal');
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.min(900, pts.length * 2), o.edgeWidth ?? 0.022, 4, true), edgeMat);
      grp.add(tube);
    }
    grp.userData.edgeMat = edgeMat;
  }
  return grp;
}
/** One mesh per tile (electorate/state). Returns group with userData.tiles = [{mesh, tile}] */
export function mapTiles(geo, o = {}) {
  const grp = new THREE.Group();
  const tiles = [];
  for (const t of geo.tiles) {
    const g = extrudeRings(t.polys, { depth: o.depth ?? 0.25, bevel: o.bevel ?? 0.02, inset: o.inset ?? 0.004, bevelSegments: 1 });
    const mesh = shadow(new THREE.Mesh(g, (o.mat || (() => M.std(0x2a3140, { roughness: 0.5 })))(t)));
    grp.add(mesh);
    tiles.push({ mesh, tile: t, c: new THREE.Vector3(t.c[0], 0, -t.c[1]) });
  }
  grp.userData.tiles = tiles;
  return grp;
}

// ---------- hemicycle ----------
/** seats: array of colors (hex) in order left→right. Returns {mesh, pos:[Vector3], count, set(i, scale, y)} */
export function hemicycle(colors, o = {}) {
  const n = colors.length;
  const rows = o.rows ?? Math.max(3, Math.round(Math.sqrt(n / 4.5)));
  const r0 = o.r0 ?? 2.2, r1 = o.r1 ?? 5.2;
  const radii = Array.from({ length: rows }, (_, i) => r0 + ((r1 - r0) * i) / Math.max(1, rows - 1));
  const tot = radii.reduce((a, b) => a + b, 0);
  let counts = radii.map((r) => Math.round((n * r) / tot));
  let diff = n - counts.reduce((a, b) => a + b, 0);
  counts[counts.length - 1] += diff;
  const spots = [];
  radii.forEach((r, ri) => {
    const c = counts[ri];
    for (let j = 0; j < c; j++) {
      const a = Math.PI * (1 - (c === 1 ? 0.5 : j / (c - 1)));
      spots.push({ a, r, ri });
    }
  });
  spots.sort((p, q) => q.a - p.a || p.r - q.r); // left (angle π) → right (0)
  const seat = o.seat ?? 0.34;
  const geo = o.geometry || new THREE.CylinderGeometry(seat * 0.5, seat * 0.5, seat * 0.45, 20);
  const mat = o.mat || new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.2 });
  const mesh = new THREE.InstancedMesh(geo, mat, n);
  mesh.castShadow = true; mesh.receiveShadow = true;
  const pos = spots.map((s) => new THREE.Vector3(Math.cos(s.a) * s.r, seat * 0.225, -Math.sin(s.a) * s.r));
  const col = new THREE.Color();
  colors.forEach((c, i) => mesh.setColorAt(i, col.set(c)));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), p = new THREE.Vector3();
  const set = (i, s, y = 0, color) => {
    p.copy(pos[i]); p.y += y; sc.set(s, s, s);
    m4.compose(p, q, sc); mesh.setMatrixAt(i, m4);
    if (color !== undefined) mesh.setColorAt(i, col.set(color));
  };
  for (let i = 0; i < n; i++) set(i, 1);
  return { mesh, pos, count: n, set, spots, commit: () => { mesh.instanceMatrix.needsUpdate = true; if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true; } };
}

// ---------- coin (lathe with rim + bevel) ----------
export function coinGeometry(r = 0.5, h = 0.12) {
  const pts = [[0, -h / 2], [r * 0.8, -h / 2], [r * 0.97, -h / 2 + h * 0.08], [r, -h / 2 + h * 0.25], [r, h / 2 - h * 0.25], [r * 0.97, h / 2 - h * 0.08], [r * 0.92, h / 2], [r * 0.86, h / 2], [r * 0.82, h / 2 - h * 0.18], [0, h / 2 - h * 0.18]];
  return new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0], p[1])), 40);
}
// ---------- pawn (people token) ----------
export function pawnGeometry(s = 1) {
  const pts = [[0, 0], [0.42, 0], [0.44, 0.05], [0.42, 0.1], [0.3, 0.16], [0.24, 0.3], [0.18, 0.62], [0.26, 0.7], [0.27, 0.74], [0.16, 0.78], [0.22, 0.86], [0.25, 0.98], [0.22, 1.1], [0.14, 1.17], [0, 1.2]];
  return new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p[0] * s, p[1] * s)), 32);
}

// ---------- arc gauge (discard fragments past the sweep angle) ----------
export function arcGauge(o = {}) {
  const R = o.r ?? 2, tube = o.tube ?? 0.18;
  const g = new THREE.TorusGeometry(R, tube, 18, 160);
  const mat = (o.mat || M.lime()).clone();
  const U = { sweep: { value: 0 } };
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.sweep = U.sweep;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvLP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vLP; uniform float sweep;')
      .replace('void main() {', 'void main() {\n float ang = atan(vLP.x, vLP.y); if (ang < 0.0) ang += 6.2831853; if (ang > sweep) discard;');
  };
  mat.customProgramCacheKey = () => 'arc';
  const m = shadow(new THREE.Mesh(g, mat));
  m.userData.U = U;
  m.userData.setFrac = (f) => { U.sweep.value = clamp(f) * Math.PI * 2; };
  return m;
}

// ---------- particles (bokeh dust) ----------
export function particles(o = {}) {
  const n = o.count ?? 600;
  const r = E.rng(o.seed ?? 7);
  const pos = new Float32Array(n * 3), ph = new Float32Array(n), sz = new Float32Array(n);
  const [bx, by, bz] = o.box || [30, 16, 30];
  const [cx, cy, cz] = o.center || [0, 6, -4];
  for (let i = 0; i < n; i++) {
    pos[i * 3] = cx + (r() - 0.5) * bx; pos[i * 3 + 1] = cy + (r() - 0.5) * by; pos[i * 3 + 2] = cz + (r() - 0.5) * bz;
    ph[i] = r() * 100; sz[i] = 0.4 + r() * r() * 1.8;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, col: { value: new THREE.Color(o.color ?? C.lime) }, col2: { value: new THREE.Color(o.color2 ?? 0xffffff) }, size: { value: (o.size ?? 26) * E.dpr }, amp: { value: o.amp ?? 0.6 }, alpha: { value: o.alpha ?? 0.55 }, rise: { value: o.rise ?? 0.15 } },
    vertexShader: `attribute float ph; attribute float sz; uniform float time, size, amp, rise; varying float vA; varying float vMix;
      void main(){ vec3 p = position; p.x += sin(time*0.4+ph)*amp; p.y += sin(time*0.31+ph*1.3)*amp*0.6 + mod(time*rise + ph, 8.0) - 4.0; p.z += cos(time*0.27+ph)*amp;
        vec4 mv = modelViewMatrix * vec4(p,1.0); gl_Position = projectionMatrix * mv; gl_PointSize = size * sz / -mv.z;
        vA = 0.55 + 0.45*sin(time*1.7 + ph*3.0); vA *= smoothstep(4.0, 3.0, abs(mod(time*rise + ph, 8.0) - 4.0)); vMix = fract(ph*0.37); }`,
    fragmentShader: `uniform vec3 col, col2; uniform float alpha; varying float vA; varying float vMix;
      void main(){ float d = length(gl_PointCoord-0.5)*2.0; float a = smoothstep(1.0, 0.55, d) * 0.6 + smoothstep(1.0, 0.0, d)*0.4; gl_FragColor = vec4(mix(col, col2, step(0.7, vMix)) * a * vA * alpha, 1.0); }`,
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  const pts = new THREE.Points(g, mat);
  pts.frustumCulled = false;
  pts.userData.tick = (t) => { mat.uniforms.time.value = t; };
  return pts;
}

// ---------- canvas texture (for ballot papers, labels in 3D) ----------
export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// ---------- PolTok mark (from public/favicon.svg) ----------
export function poltokMark(svgText, o = {}) {
  const data = new SVGLoader().parse(svgText);
  const grp = new THREE.Group();
  const s = (o.size ?? 3) / 64;
  data.paths.forEach((path, i) => {
    const color = path.userData.style.fill;
    const shapes = SVGLoader.createShapes(path);
    const isBase = i === 0;
    const depth = isBase ? 10 : 5;
    const g = new THREE.ExtrudeGeometry(shapes, { depth, bevelEnabled: true, bevelThickness: isBase ? 2 : 1.2, bevelSize: isBase ? 1.6 : 0.9, bevelSegments: 4, curveSegments: 16 });
    g.translate(-32, -32, isBase ? -depth : 1);
    g.scale(s, -s, s);
    const c = new THREE.Color(color);
    const mat = isBase ? new THREE.MeshPhysicalMaterial({ color: 0x07080d, roughness: 0.38, metalness: 0.1, clearcoat: 0.35, envMapIntensity: 0.12 })
      : new THREE.MeshPhysicalMaterial({ color: c, emissive: c, emissiveIntensity: 0.6, roughness: 0.3, clearcoat: 0.6, envMapIntensity: 0.4 });
    grp.add(shadow(new THREE.Mesh(g, mat)));
  });
  return grp;
}

// ---------- helpers ----------
export const pop = (lt, t0, d = 0.5) => ease.back(remap(lt, t0, t0 + d));
export { THREE };
