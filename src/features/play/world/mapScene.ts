// The 3D diorama of Calderra: a seeded low-poly heightmap on a tabletop slab, a wavy translucent sea,
// instanced forests, reeds, towns that grow by era (gas lamps, then factories with smoke, then radio masts),
// the Assembly in Quillon, campaign flags, region tints with raised borders, and a sky that follows the turn.
// Everything is generated in code; no model files. Imported only by the lazy 3D chunk.
import * as THREE from 'three';
import { MapControls } from 'three/addons/controls/MapControls.js';
import { BORDER_SEGS, CAPITAL, FRONTIER_LINE, LAND_RING, REG_RING, REGION_LABEL, type Pt } from '../ui/geo';
import { seeded } from '../ui/seeded';
import { atmosphere, type Atmosphere } from './atmosphere';
import { cssColor, easeInOut, GeoBuilder, Loop, makeRenderer, makeSky, lin, SHADOW, disposeTree } from './gl';
import type { Quality } from './support';
import {
  buildTerrain, classify, groundColor, heightAtMap, heightAtWorld, K, NEIGHBOR, REGION_ORDER, regionAtMap, scatterReeds, scatterTrees, SEA,
  toMap, toWorld, TOWNS, townLots, type RegionKey, type Terrain,
} from './terrain';

export interface MapSceneState {
  /** CSS colour per region id (leading party, or the declared winner on election night); null = untinted. */
  tints: Record<string, string | null>;
  /** 0..1 how strongly each region is lit (election night declarations). */
  glow: Record<string, number>;
  selected: string | null;
  pulse: string | null;
  era: number; turn: number; totalTurns: number;
  /** Time of day 0..3 (morning to dusk), from the election calendar. */
  dayPhase: number;
  night: boolean;
  campaigns: Record<string, number>;
  flagColor: string;
  autoOrbit: boolean;
  /** Stronger tint (election night). */
  flash: boolean;
}

export interface MapSceneOpts {
  quality: Quality; rm: boolean; compact?: boolean;
  onPick?: (regionId: string) => void;
  onHover?: (regionId: string | null) => void;
  onLost?: () => void;
  onSlow?: () => void;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const M = (x: number, y: number, z: number, ry = 0, sx = 1, sy = sx, sz = sx) =>
  new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(sx, sy, sz));
const SLOT = (id: string) => REGION_ORDER.indexOf(id as RegionKey);
const COUNTS: Record<Quality, { trees: number; reeds: number; smoke: number; seg: number }> = {
  low: { trees: 2600, reeds: 260, smoke: 6, seg: 36 },
  medium: { trees: 4600, reeds: 520, smoke: 10, seg: 64 },
  high: { trees: 7200, reeds: 800, smoke: 14, seg: 96 },
};
const BOTTOM = -2.4;

// ---------------------------------------------------------------- prop geometries (local space, base at y = 0)

function prism(b: GeoBuilder, w: number, d: number, y0: number, h: number, rgb: [number, number, number], o = 0.02) {
  const x = w / 2 + o, z = d / 2 + o;
  const a = V(-x, y0, z), bb = V(x, y0, z), c = V(x, y0, -z), dd = V(-x, y0, -z), r1 = V(-x, y0 + h, 0), r2 = V(x, y0 + h, 0);
  b.quad(a, bb, r2, r1, rgb); b.quad(c, dd, r1, r2, rgb); b.tri(bb, c, r2, rgb); b.tri(dd, a, r1, rgb);
}
function houseGeo() {
  const b = new GeoBuilder();
  b.add(new THREE.BoxGeometry(0.3, 0.22, 0.24), lin(0xeadfc8), M(0, 0.11, 0));
  prism(b, 0.3, 0.24, 0.22, 0.15, lin(0xb5533c));
  b.add(new THREE.BoxGeometry(0.06, 0.08, 0.01), lin(0x5a4636), M(0, 0.04, 0.121)); // door
  b.add(new THREE.BoxGeometry(0.05, 0.12, 0.05), lin(0x8a5a44), M(0.09, 0.32, -0.05)); // chimney pot
  return b.build();
}
function factoryGeo() {
  const b = new GeoBuilder();
  b.add(new THREE.BoxGeometry(0.62, 0.28, 0.4), lin(0x9a4b34), M(0, 0.14, 0));
  for (let i = 0; i < 3; i++) { // saw-tooth roof
    const x0 = -0.31 + i * 0.207, x1 = x0 + 0.207, y = 0.28, h = 0.13, z = 0.2;
    const s = lin(0x4b4f55), g = lin(0x9fb6c4);
    b.quad(V(x0, y, z), V(x1, y, z), V(x1, y + h, z), V(x0, y + h, z), g);
    b.quad(V(x0, y, -z), V(x0, y + h, -z), V(x1, y + h, -z), V(x1, y, -z), g);
    b.quad(V(x0, y + h, z), V(x1, y, z), V(x1, y, -z), V(x0, y + h, -z), s);
    b.quad(V(x0, y, z), V(x0, y + h, z), V(x0, y + h, -z), V(x0, y, -z), s);
  }
  b.add(new THREE.CylinderGeometry(0.045, 0.065, 0.9, 6), lin(0x7a3a2a), M(0.22, 0.45, -0.1));
  b.add(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 6), lin(0x2a2a2a), M(0.22, 0.88, -0.1));
  return b.build();
}
const CHIMNEY_TOP = V(0.22, 0.92, -0.1);
function mastGeo() {
  const b = new GeoBuilder();
  const red = lin(0xc8402f), white = lin(0xf2efe8);
  for (let i = 0; i < 4; i++) { const r0 = 0.07 - i * 0.015, r1 = r0 - 0.015; b.add(new THREE.CylinderGeometry(r1, r0, 0.42, 4), i % 2 ? white : red, M(0, 0.21 + i * 0.42, 0)); }
  b.add(new THREE.BoxGeometry(0.34, 0.015, 0.015), lin(0x444444), M(0, 1.2, 0));
  b.add(new THREE.BoxGeometry(0.015, 0.015, 0.26), lin(0x444444), M(0, 0.9, 0));
  b.add(new THREE.BoxGeometry(0.22, 0.03, 0.22), lin(0x555555), M(0, 0.02, 0));
  return b.build();
}
const MAST_TOP = 1.72;
function lampGeo() {
  const b = new GeoBuilder();
  b.add(new THREE.CylinderGeometry(0.012, 0.018, 0.34, 5), lin(0x2b2b2b), M(0, 0.17, 0));
  b.add(new THREE.BoxGeometry(0.055, 0.06, 0.055), lin(0xe8c46a), M(0, 0.36, 0));
  b.add(new THREE.ConeGeometry(0.05, 0.04, 4), lin(0x2b2b2b), M(0, 0.41, 0, Math.PI / 4));
  return b.build();
}
const LAMP_TOP = 0.36;
function coniferGeo() {
  const b = new GeoBuilder();
  b.add(new THREE.CylinderGeometry(0.05, 0.07, 0.3, 5), lin(0x6b4a2e), M(0, 0.15, 0));
  b.add(new THREE.ConeGeometry(0.34, 0.62, 6), lin(0x2f5a34), M(0, 0.55, 0));
  b.add(new THREE.ConeGeometry(0.24, 0.48, 6), lin(0x3b6b3c), M(0, 0.86, 0, 0.5));
  return b.build();
}
function broadleafGeo() {
  const b = new GeoBuilder();
  b.add(new THREE.CylinderGeometry(0.05, 0.07, 0.34, 5), lin(0x6b4a2e), M(0, 0.17, 0));
  b.add(new THREE.IcosahedronGeometry(0.36, 0), lin(0x5d8a3e), M(0, 0.62, 0));
  return b.build();
}
function reedGeo() {
  const b = new GeoBuilder();
  [[0, 0, 0.3], [0.07, 0.04, 0.24], [-0.06, 0.05, 0.27], [0.02, -0.07, 0.22]].forEach(([x, z, h]) => b.add(new THREE.ConeGeometry(0.035, h, 4), lin(0x8d9a52), M(x, h / 2, z)));
  return b.build();
}
function sailGeo() {
  const b = new GeoBuilder();
  prismHull(b, lin(0x6b4a2e));
  b.add(new THREE.CylinderGeometry(0.01, 0.01, 0.5, 4), lin(0x3a2a1c), M(0, 0.3, 0));
  const s = lin(0xf3ead2);
  b.tri(V(0.01, 0.08, 0), V(0.01, 0.52, 0), V(0.2, 0.1, 0), s); b.tri(V(0.01, 0.08, 0), V(0.2, 0.1, 0), V(0.01, 0.52, 0), s);
  return b.build();
}
function steamerGeo() {
  const b = new GeoBuilder();
  prismHull(b, lin(0x2c2f36), 1.4);
  b.add(new THREE.BoxGeometry(0.22, 0.09, 0.12), lin(0xf0eadc), M(-0.04, 0.11, 0));
  b.add(new THREE.CylinderGeometry(0.035, 0.035, 0.16, 6), lin(0xc0392b), M(0.03, 0.22, 0));
  return b.build();
}
function prismHull(b: GeoBuilder, rgb: [number, number, number], s = 1) {
  const L = 0.24 * s, W = 0.08 * s, H = 0.07;
  const p = [V(-L, H, -W), V(L * 0.7, H, -W), V(L * 1.2, H, 0), V(L * 0.7, H, W), V(-L, H, W)];
  const q = p.map((v) => V(v.x * 0.85, 0, v.z * 0.6));
  for (let i = 0; i < 5; i++) { const j = (i + 1) % 5; b.quad(q[i], q[j], p[j], p[i], rgb); }
  b.tri(p[0], p[1], p[4], rgb); b.tri(p[1], p[3], p[4], rgb); b.tri(p[1], p[2], p[3], rgb);
}
function assemblyGeo(): THREE.BufferGeometry {
  const b = new GeoBuilder();
  const marble = lin(0xefe7d4), marble2 = lin(0xd9cfb6), slate = lin(0x6c6f78), gold = lin(0xd8b04a);
  b.add(new THREE.CylinderGeometry(1.25, 1.3, 0.05, 20), lin(0xcfc4a8), M(0, 0.025, 0)); // the square
  b.add(new THREE.BoxGeometry(1.7, 0.08, 1.15), marble2, M(0, 0.09, 0));
  b.add(new THREE.BoxGeometry(1.56, 0.08, 1.02), marble, M(0, 0.17, 0));
  b.add(new THREE.BoxGeometry(1.25, 0.42, 0.72), marble, M(0, 0.42, -0.08));
  for (let i = 0; i < 8; i++) b.add(new THREE.CylinderGeometry(0.035, 0.04, 0.42, 6), marble, M(-0.56 + i * 0.16, 0.42, 0.38));
  b.add(new THREE.BoxGeometry(1.3, 0.06, 0.92), marble2, M(0, 0.66, 0.02));
  prismPed(b, 1.3, 0.2, 0.69, 0.18, marble, 0.46);
  b.add(new THREE.CylinderGeometry(0.36, 0.38, 0.22, 14), marble, M(0, 0.8, -0.1));
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.add(new THREE.BoxGeometry(0.04, 0.16, 0.04), marble2, M(Math.cos(a) * 0.37, 0.8, -0.1 + Math.sin(a) * 0.37)); }
  b.add(new THREE.BoxGeometry(1.25, 0.04, 0.72), slate, M(0, 0.65, -0.08));
  b.add(new THREE.SphereGeometry(0.05, 6, 4), gold, M(0, 1.4, -0.1));
  // steps
  for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(0.7, 0.04, 0.08), marble, M(0, 0.05 + i * 0.04, 0.6 - i * 0.06));
  return b.build();
}
function prismPed(b: GeoBuilder, w: number, d: number, y0: number, h: number, rgb: [number, number, number], zc: number) {
  const x = w / 2;
  const a = V(-x, y0, zc + d / 2), bb = V(x, y0, zc + d / 2), c = V(x, y0, zc - d / 2), dd = V(-x, y0, zc - d / 2), r1 = V(-x * 0.0, y0 + h, zc + d / 2), r2 = V(0, y0 + h, zc - d / 2);
  b.tri(a, bb, r1, rgb); b.tri(c, dd, r2, rgb); b.quad(bb, c, r2, r1, rgb); b.quad(dd, a, r1, r2, rgb);
}

// ---------------------------------------------------------------- shaders

const SMOKE_VERT = /* glsl */`
  attribute float aSeed; uniform float uTime; uniform float uScale; varying float vA;
  void main(){
    float life = fract(uTime * 0.12 + aSeed);
    vec3 p = position + vec3(life * 0.9 + sin(aSeed * 40.0 + life * 5.0) * 0.08, life * 1.7, sin(aSeed * 17.0) * 0.12 * life);
    vA = (1.0 - life) * smoothstep(0.0, 0.12, life);
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = uScale * (0.12 + life * 0.42) / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const SMOKE_FRAG = /* glsl */`
  uniform vec3 uColor; varying float vA;
  void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard; gl_FragColor = vec4(uColor, vA * 0.55 * smoothstep(0.5, 0.15, d)); #include <colorspace_fragment> }`;
const GLOW_VERT = /* glsl */`
  attribute vec3 aColor; attribute float aSize; attribute float aKind; uniform float uTime; uniform float uNight; uniform float uScale; varying vec3 vC; varying float vA;
  void main(){
    float k = aKind; float a = uNight;
    if (k > 1.5 && k < 2.5) a = max(a, 0.35) * step(0.5, fract(uTime * 0.7 + position.x));      // mast beacons blink
    if (k > 2.5) a = max(0.25, uNight) * (0.55 + 0.45 * sin(uTime * 2.0));                       // lighthouse
    if (k < 0.5) a = uNight;                                                                         // lamps
    if (k > 0.5 && k < 1.5) a = uNight * step(0.35, fract(sin(position.x * 91.7 + position.z * 37.1) * 43758.5)); // windows
    vC = aColor; vA = a;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_PointSize = uScale * aSize / -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;
const GLOW_FRAG = /* glsl */`
  varying vec3 vC; varying float vA;
  void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5 || vA < 0.01) discard; float g = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * (g * g + g * 0.4), g * vA); #include <colorspace_fragment> }`;
const BEAM_VERT = /* glsl */`varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const BEAM_FRAG = /* glsl */`uniform vec3 uColor; uniform float uA; uniform float uTime; varying float vY;
  void main(){ float a = (1.0 - vY) * (1.0 - vY) * uA * (0.75 + 0.25 * sin(uTime * 5.0 + vY * 9.0)); gl_FragColor = vec4(uColor * 1.6, a); #include <colorspace_fragment> }`;

// ---------------------------------------------------------------- the scene

export class MapScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera: THREE.PerspectiveCamera;
  private controls: MapControls;
  private loop: Loop;
  private t: Terrain;
  private time = 0;
  private sun = new THREE.DirectionalLight(0xffffff, 2);
  private hemi = new THREE.HemisphereLight(0xffffff, 0x444444, 1);
  private sky = makeSky();
  private terrainU = {
    uTint: { value: Array.from({ length: 8 }, () => new THREE.Color()) }, uAmt: { value: new Array(8).fill(0) as number[] }, uGlow: { value: new Array(8).fill(0) as number[] },
    uHover: { value: -1 }, uSel: { value: -1 }, uTime: { value: 0 }, uNight: { value: 0 },
  };
  private waterU = { uTime: { value: 0 } };
  private flagU = { uTime: { value: 0 } };
  private smokeU = { uTime: { value: 0 }, uColor: { value: new THREE.Color(0xbdb6aa) }, uScale: { value: 300 } };
  private glowU = { uTime: { value: 0 }, uNight: { value: 0 }, uScale: { value: 300 } };
  private beamU = { uColor: { value: new THREE.Color() }, uA: { value: 0 }, uTime: { value: 0 } };
  private waterMat!: THREE.MeshStandardMaterial;
  private houses!: THREE.InstancedMesh;
  private factories!: THREE.InstancedMesh;
  private masts!: THREE.InstancedMesh;
  private lamps!: THREE.InstancedMesh;
  private flagsPole!: THREE.InstancedMesh;
  private flagsCloth!: THREE.InstancedMesh;
  private boats: { sail: THREE.InstancedMesh; steam: THREE.InstancedMesh; spots: { x: number; z: number; a: number; p: number }[] } | null = null;
  private smoke!: THREE.Points;
  private glow!: THREE.Points;
  private rails: THREE.Mesh | null = null;
  private dome!: THREE.Mesh;
  private beam!: THREE.Mesh;
  private hoverLine: THREE.Mesh;
  private selLine: THREE.Mesh;
  private outlineCache = new Map<number, THREE.BufferGeometry>();
  private lots = new Map<RegionKey, ReturnType<typeof townLots>>();
  private labels: (HTMLElement | null)[] = [];
  private labelPos: THREE.Vector3[] = [];
  private st: MapSceneState | null = null;
  private builtFor = '';
  private atm: Atmosphere = atmosphere(1, 1, 0);
  private night = 0;
  private nightTarget = 0;
  private hover = -1;
  private flight: { t: number; dur: number; fromT: THREE.Vector3; toT: THREE.Vector3; fromP: THREE.Vector3; toP: THREE.Vector3; then?: () => void } | null = null;
  private down: { x: number; y: number; t: number } | null = null;
  private slowSecs = 0;
  private lastFpsCheck = 0;
  private disposed = false;
  private size = new THREE.Vector2(1, 1);
  private ro: ResizeObserver;

  constructor(private host: HTMLElement, private opts: MapSceneOpts) {
    const q = opts.quality;
    this.renderer = makeRenderer(host, q);
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
    this.t = buildTerrain(q);
    this.scene.add(this.sky.mesh);
    this.scene.fog = new THREE.Fog(0xffffff, 60, 150);

    this.hemi.position.set(0, 50, 0);
    this.scene.add(this.hemi);
    const shadow = SHADOW[q];
    if (shadow) {
      this.sun.castShadow = true;
      this.sun.shadow.mapSize.set(shadow, shadow);
      const c = this.sun.shadow.camera; c.left = -25; c.right = 25; c.top = 19; c.bottom = -19; c.near = 1; c.far = 140;
      this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
    }
    this.scene.add(this.sun, this.sun.target);

    this.buildTerrainMesh();
    this.buildWater();
    this.buildBorders();
    this.buildForest();
    this.buildTowns();
    this.buildAssembly();
    this.buildFlags();
    this.buildBoats();
    this.buildBeam();
    const lineMat = (c: number, o: number) => new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: o, side: THREE.DoubleSide, depthWrite: false, fog: false });
    this.hoverLine = new THREE.Mesh(new THREE.BufferGeometry(), lineMat(0xffffff, 0.75)); this.hoverLine.visible = false; this.hoverLine.renderOrder = 5;
    this.selLine = new THREE.Mesh(new THREE.BufferGeometry(), lineMat(0xffd76a, 0.95)); this.selLine.visible = false; this.selLine.renderOrder = 6;
    this.scene.add(this.hoverLine, this.selLine);
    for (const id of REGION_ORDER) { const [x, y] = REGION_LABEL[id]; const [wx, wz] = toWorld(x, y); this.labelPos.push(V(wx, Math.max(0.4, heightAtMap(this.t, x, y)) + 1.1, wz)); }

    // controls
    this.controls = new MapControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = !opts.rm;
    this.controls.dampingFactor = 0.09;
    this.controls.minDistance = 6; this.controls.maxDistance = 62;
    this.controls.minPolarAngle = 0.18; this.controls.maxPolarAngle = 1.22;
    this.controls.screenSpacePanning = false;
    this.controls.zoomToCursor = !opts.compact;
    this.controls.autoRotateSpeed = 0.35;
    this.controls.addEventListener('change', () => { this.clampTarget(); this.loop.invalidate(); });

    this.loop = new Loop(this.renderer, host, (dt, t) => this.frame(dt, t), !opts.rm);
    this.loop.render = () => this.renderer.render(this.scene, this.camera);

    const cv = this.renderer.domElement;
    cv.addEventListener('pointerdown', this.onDown);
    cv.addEventListener('pointerup', this.onUp);
    cv.addEventListener('pointermove', this.onMove);
    cv.addEventListener('pointerleave', this.onLeave);
    cv.addEventListener('webglcontextlost', this.onLost);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.resetView(true);
  }

  // ------------------------------------------------ building

  private buildTerrainMesh() {
    const t = this.t, b = new GeoBuilder();
    const P = (i: number, j: number) => { const k = j * t.cols + i; const [wx, wz] = toWorld(t.x0 + i * t.step, t.y0 + j * t.step); return V(wx, t.h[k], wz); };
    const tmp = new THREE.Vector3(), e1 = new THREE.Vector3(), e2 = new THREE.Vector3();
    const face = (ia: number[], a: THREE.Vector3, bb: THREE.Vector3, c: THREE.Vector3) => {
      const ks = ia;
      const rs = ks.map((k) => t.region[k]);
      const r = rs[0] === rs[1] || rs[0] === rs[2] ? rs[0] : rs[1] === rs[2] ? rs[1] : rs[0];
      const hAvg = (a.y + bb.y + c.y) / 3;
      e1.subVectors(bb, a); e2.subVectors(c, a); tmp.crossVectors(e1, e2).normalize();
      const ny = Math.abs(tmp.y) || 1e-3, slope = Math.sqrt(Math.max(0, 1 - ny * ny)) / ny;
      const d = (t.dist[ks[0]] + t.dist[ks[1]] + t.dist[ks[2]]) / 3;
      const [mx, my] = toMap((a.x + bb.x + c.x) / 3, (a.z + bb.z + c.z) / 3);
      const reg = r === SEA || r === NEIGHBOR ? r : rs.every((x) => x === SEA) ? SEA : r;
      b.tri(a, bb, c, groundColor(reg, hAvg, slope, d, mx, my), reg >= 0 && reg < 8 && hAvg > -0.02 ? reg : -1);
    };
    for (let j = 0; j < t.rows - 1; j++) for (let i = 0; i < t.cols - 1; i++) {
      const k00 = j * t.cols + i, k10 = k00 + 1, k01 = k00 + t.cols, k11 = k01 + 1;
      const p00 = P(i, j), p10 = P(i + 1, j), p01 = P(i, j + 1), p11 = P(i + 1, j + 1);
      if ((i + j) & 1) { face([k00, k01, k10], p00, p01, p10); face([k10, k01, k11], p10, p01, p11); }
      else { face([k00, k01, k11], p00, p01, p11); face([k00, k11, k10], p00, p11, p10); }
    }
    // diorama skirt (earth strata) and the tabletop slab
    const soil = lin(0x6b4f35), rock = lin(0x4a3b2c);
    const edge = (pts: THREE.Vector3[]) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const a = pts[i], c = pts[i + 1], mid = -1.2;
        b.quad(V(a.x, Math.min(a.y, mid + 0.4), a.z), V(a.x, BOTTOM, a.z), V(c.x, BOTTOM, c.z), V(c.x, Math.min(c.y, mid + 0.4), c.z), rock);
        if (a.y > mid + 0.4 || c.y > mid + 0.4) b.quad(V(a.x, a.y, a.z), V(a.x, Math.min(a.y, mid + 0.4), a.z), V(c.x, Math.min(c.y, mid + 0.4), c.z), V(c.x, c.y, c.z), soil);
      }
    };
    const top = Array.from({ length: t.cols }, (_, i) => P(i, 0)), bot = Array.from({ length: t.cols }, (_, i) => P(t.cols - 1 - i, t.rows - 1));
    const left = Array.from({ length: t.rows }, (_, j) => P(0, t.rows - 1 - j)), right = Array.from({ length: t.rows }, (_, j) => P(t.cols - 1, j));
    [top.slice().reverse(), bot.slice().reverse(), left.slice().reverse(), right.slice().reverse()].forEach(edge);
    const g = b.build(true);
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
    const U = this.terrainU;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aRegion; varying float vRegion;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRegion = aRegion;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
uniform vec3 uTint[8]; uniform float uAmt[8]; uniform float uGlow[8]; uniform float uHover; uniform float uSel; uniform float uTime; uniform float uNight; varying float vRegion;`)
        .replace('#include <color_fragment>', `#include <color_fragment>
vec3 rTint = vec3(0.0); float rAmt = 0.0; float rGlow = 0.0;
if (vRegion > -0.5) { int ri = int(vRegion + 0.5); rTint = uTint[ri]; rAmt = uAmt[ri]; rGlow = uGlow[ri]; }
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 0.45 + rTint * 0.62, rAmt);
float hov = (vRegion > -0.5 && abs(vRegion - uHover) < 0.5) ? 1.0 : 0.0;
float sel = (vRegion > -0.5 && abs(vRegion - uSel) < 0.5) ? 1.0 : 0.0;
diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * 1.22 + 0.05, max(hov * 0.85, sel * (0.6 + 0.3 * sin(uTime * 3.0))));`)
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
totalEmissiveRadiance += rTint * rGlow * (0.12 + 0.5 * uNight);`);
    };
    const mesh = new THREE.Mesh(g, mat);
    mesh.receiveShadow = true; mesh.castShadow = SHADOW[this.opts.quality] > 0;
    this.scene.add(mesh);
    // tabletop slab
    const ext = this.extent();
    const slab = new THREE.Mesh(new THREE.BoxGeometry(ext.w + 1.6, 0.45, ext.d + 1.6), new THREE.MeshStandardMaterial({ color: 0x7a5434, roughness: 0.8 }));
    slab.position.set(ext.cx, BOTTOM - 0.225, ext.cz); slab.receiveShadow = true;
    this.scene.add(slab);
  }

  private extent() {
    const t = this.t;
    const [ax, az] = toWorld(t.x0, t.y0), [bx, bz] = toWorld(t.x0 + (t.cols - 1) * t.step, t.y0 + (t.rows - 1) * t.step);
    return { x0: ax, z0: az, x1: bx, z1: bz, w: bx - ax, d: bz - az, cx: (ax + bx) / 2, cz: (az + bz) / 2 };
  }

  private buildWater() {
    const e = this.extent(), n = COUNTS[this.opts.quality].seg, nz = Math.round(n * e.d / e.w);
    const b = new GeoBuilder(), c = lin(0xffffff);
    for (let j = 0; j < nz; j++) for (let i = 0; i < n; i++) {
      const x0 = e.x0 + (e.w * i) / n, x1 = e.x0 + (e.w * (i + 1)) / n, z0 = e.z0 + (e.d * j) / nz, z1 = e.z0 + (e.d * (j + 1)) / nz;
      b.quad(V(x0, 0, z0), V(x0, 0, z1), V(x1, 0, z1), V(x1, 0, z0), c);
    }
    const sides: [THREE.Vector3, THREE.Vector3][] = [[V(e.x0, 0, e.z1), V(e.x1, 0, e.z1)], [V(e.x1, 0, e.z1), V(e.x1, 0, e.z0)], [V(e.x1, 0, e.z0), V(e.x0, 0, e.z0)], [V(e.x0, 0, e.z0), V(e.x0, 0, e.z1)]];
    for (const [a, d] of sides) for (let i = 0; i < n; i++) {
      const p = a.clone().lerp(d, i / n), q = a.clone().lerp(d, (i + 1) / n);
      b.quad(p, V(p.x, BOTTOM, p.z), V(q.x, BOTTOM, q.z), q, c);
    }
    const g = b.build();
    this.waterMat = new THREE.MeshStandardMaterial({ color: 0x3f8f9a, transparent: true, opacity: 0.8, roughness: 0.22, metalness: 0.05, flatShading: true });
    const U = this.waterU;
    this.waterMat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
if (position.y > -0.01) { float w = sin(position.x * 1.7 + uTime * 1.1) * 0.035 + sin(position.z * 2.3 - uTime * 0.8 + position.x * 0.6) * 0.03 + sin((position.x + position.z) * 4.1 + uTime * 1.9) * 0.012; transformed.y += w; }`);
    };
    const mesh = new THREE.Mesh(g, this.waterMat);
    mesh.receiveShadow = SHADOW[this.opts.quality] > 0;
    mesh.renderOrder = 1;
    this.scene.add(mesh);
  }

  /** Raised stone walls along the borders between regions, and a darker frontier wall with the Hollin Reach. */
  private buildBorders() {
    const b = new GeoBuilder();
    const wall = (pts: Pt[], w: number, hgt: number, rgb: [number, number, number], ok: (x: number, y: number) => boolean) => {
      const dense = densify(pts, 1.4);
      for (let i = 0; i < dense.length - 1; i++) {
        const [x0, y0] = dense[i], [x1, y1] = dense[i + 1];
        if (!ok(x0, y0) || !ok(x1, y1)) continue;
        this.wallSeg(b, x0, y0, x1, y1, w, hgt, rgb);
      }
    };
    const inside = (x: number, y: number) => { const r = classify(x, y); return r >= 0 && r < 8; };
    for (const seg of BORDER_SEGS) wall(seg, 0.07, 0.12, lin(0xeee3c8), inside);
    wall(FRONTIER_LINE, 0.1, 0.2, lin(0x5b4a3a), () => true);
    const mesh = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 }));
    mesh.castShadow = SHADOW[this.opts.quality] > 0; mesh.receiveShadow = true;
    this.scene.add(mesh);
  }
  private wallSeg(b: GeoBuilder, x0: number, y0: number, x1: number, y1: number, w: number, hgt: number, rgb: [number, number, number]) {
    const [ax, az] = toWorld(x0, y0), [bx, bz] = toWorld(x1, y1);
    const ha = Math.max(0.02, heightAtMap(this.t, x0, y0)), hb = Math.max(0.02, heightAtMap(this.t, x1, y1));
    const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = (-dz / L) * w / 2, nz = (dx / L) * w / 2;
    const a1 = V(ax + nx, ha - 0.06, az + nz), a2 = V(ax + nx, ha + hgt, az + nz), a3 = V(ax - nx, ha + hgt, az - nz), a4 = V(ax - nx, ha - 0.06, az - nz);
    const b1 = V(bx + nx, hb - 0.06, bz + nz), b2 = V(bx + nx, hb + hgt, bz + nz), b3 = V(bx - nx, hb + hgt, bz - nz), b4 = V(bx - nx, hb - 0.06, bz - nz);
    b.quad(a1, b1, b2, a2, rgb); b.quad(a2, b2, b3, a3, rgb); b.quad(a3, b3, b4, a4, rgb);
  }
  /** A glowing raised outline of one region (built on first hover/selection). */
  private outline(slot: number): THREE.BufferGeometry {
    const hit = this.outlineCache.get(slot); if (hit) return hit;
    const b = new GeoBuilder(), c = lin(0xffffff), id = REGION_ORDER[slot];
    const ring = densify([...REG_RING[id], REG_RING[id][0]], 1.2);
    const land = densify([...LAND_RING, LAND_RING[0]], 1.2);
    const add = (pts: Pt[], keep: (x: number, y: number) => boolean) => {
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        if (keep((x0 + x1) / 2, (y0 + y1) / 2)) this.wallSeg(b, x0, y0, x1, y1, 0.05, 0.32, c);
      }
    };
    add(ring, (x, y) => { const r = classify(x, y); return r >= 0 && r < 8; });
    add(land, (x, y) => regionAtMap(this.t, x, y) === slot || classify(x - 1.5, y) === slot || classify(x + 1.5, y) === slot || classify(x, y - 1.5) === slot || classify(x, y + 1.5) === slot);
    const g = b.build();
    this.outlineCache.set(slot, g);
    return g;
  }

  private buildForest() {
    const q = this.opts.quality, cnt = COUNTS[q];
    const avoid: Pt[] = [...Object.values(TOWNS), CAPITAL];
    const trees = scatterTrees(this.t, cnt.trees, avoid);
    const r = seeded('tree-rot');
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9 });
    const groups: [THREE.BufferGeometry, typeof trees][] = [[coniferGeo(), trees.filter((x) => x.kind === 0)], [broadleafGeo(), trees.filter((x) => x.kind === 1)]];
    const col = new THREE.Color();
    for (const [geo, list] of groups) {
      const im = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      list.forEach((tr, i) => {
        const [wx, wz] = toWorld(tr.x, tr.y);
        im.setMatrixAt(i, M(wx, tr.h - 0.02, wz, r.next() * 6.28, tr.s * 0.62, tr.s * 0.62 * (0.85 + r.next() * 0.4), tr.s * 0.62));
        im.setColorAt(i, col.setHSL(0.25 + r.range(-0.05, 0.05), 0.25, 0.8 + r.next() * 0.25));
      });
      im.count = list.length;
      im.castShadow = SHADOW[q] > 0; im.receiveShadow = false;
      this.scene.add(im);
    }
    const reeds = scatterReeds(this.t, cnt.reeds);
    const rm = new THREE.InstancedMesh(reedGeo(), mat, Math.max(1, reeds.length));
    reeds.forEach((p, i) => { const [wx, wz] = toWorld(p.x, p.y); rm.setMatrixAt(i, M(wx, Math.max(p.h, -0.02), wz, r.next() * 6.28, 0.9 + r.next() * 0.5)); });
    rm.count = reeds.length;
    this.scene.add(rm);
  }

  private buildTowns() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.85 });
    for (const id of REGION_ORDER) this.lots.set(id, townLots(this.t, id, id === 'quillon' ? 90 : 70, id === 'quillon' ? 3.0 : 3.4));
    this.houses = new THREE.InstancedMesh(houseGeo(), mat, 8 * 90);
    this.factories = new THREE.InstancedMesh(factoryGeo(), mat, 40);
    this.masts = new THREE.InstancedMesh(mastGeo(), mat, 16);
    this.lamps = new THREE.InstancedMesh(lampGeo(), mat, 8 * 16);
    const sh = SHADOW[this.opts.quality] > 0;
    for (const m of [this.houses, this.factories, this.masts, this.lamps]) { m.count = 0; m.castShadow = sh; m.receiveShadow = sh; this.scene.add(m); }
    const smokeN = 40 * COUNTS[this.opts.quality].smoke;
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(smokeN * 3), 3));
    sg.setAttribute('aSeed', new THREE.Float32BufferAttribute(new Float32Array(smokeN), 1));
    this.smoke = new THREE.Points(sg, new THREE.ShaderMaterial({ uniforms: this.smokeU, vertexShader: SMOKE_VERT, fragmentShader: SMOKE_FRAG, transparent: true, depthWrite: false }));
    this.smoke.frustumCulled = false;
    this.scene.add(this.smoke);
    const gg = new THREE.BufferGeometry();
    const GN = 1200;
    gg.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(GN * 3), 3));
    gg.setAttribute('aColor', new THREE.Float32BufferAttribute(new Float32Array(GN * 3), 3));
    gg.setAttribute('aSize', new THREE.Float32BufferAttribute(new Float32Array(GN), 1));
    gg.setAttribute('aKind', new THREE.Float32BufferAttribute(new Float32Array(GN), 1));
    this.glow = new THREE.Points(gg, new THREE.ShaderMaterial({ uniforms: this.glowU, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.glow.frustumCulled = false;
    this.scene.add(this.glow);
  }

  /** Lay out towns for an era and turn: more houses as the republic grows; lamps, then factories, then masts. */
  private layoutTowns(era: number, turn: number, total: number) {
    const key = `${era}|${turn}`;
    if (key === this.builtFor) return;
    this.builtFor = key;
    const grow = 0.5 + 0.5 * Math.min(1, (turn - 1) / Math.max(1, total - 1));
    const r = seeded(`towns-${era}`);
    const col = new THREE.Color();
    let nh = 0, nf = 0, nm = 0, nl = 0;
    const smokeOrigins: THREE.Vector3[] = [];
    const glow: { p: THREE.Vector3; c: number; s: number; k: number }[] = [];
    const lampCol = era >= 3 ? 0xdff1ff : 0xffc46a;
    const industrial: Partial<Record<RegionKey, number>> = { glasswick: 4, brassport: 3, quillon: 1, lowmere: 1, tamsfield: 1, corvane: 1, ardent: 1, sallow: 0 };
    const seatsOf: Record<RegionKey, number> = { brassport: 14, lowmere: 8, ardent: 9, sallow: 7, quillon: 10, tamsfield: 8, corvane: 6, glasswick: 10 };
    for (const id of REGION_ORDER) {
      const lots = this.lots.get(id) ?? [];
      const cap = id === 'quillon';
      const want = Math.min(lots.length - 12, Math.round((6 + seatsOf[id] * 1.5 + (era - 1) * 5 + (cap ? 14 : 0)) * grow));
      for (let i = 0; i < want; i++) {
        const l = lots[i]; const [wx, wz] = toWorld(l.x, l.y);
        const tall = cap ? 1.35 + l.rnd * 0.6 : 0.9 + l.rnd * 0.35 + (era - 1) * 0.12;
        this.houses.setMatrixAt(nh, M(wx, l.h - 0.02, wz, l.rot, cap ? 1.15 : 1, tall, cap ? 1.15 : 1));
        this.houses.setColorAt(nh, col.setHSL(0.08 + l.rnd * 0.06, 0.25 + (era - 1) * 0.08, 0.82 + r.next() * 0.18));
        if (l.rnd > 0.45) glow.push({ p: V(wx + Math.sin(l.rot) * 0.13, l.h + 0.12 * tall, wz + Math.cos(l.rot) * 0.13), c: 0xffb45a, s: 0.5, k: 1 });
        nh++;
      }
      // gas lamps (all eras; electric light in the Signal Era)
      const nLamps = Math.min(16, 3 + era * 2 + (cap ? 5 : 0));
      for (let i = 0; i < nLamps && i + 1 < want; i++) {
        const a = lots[i], b = lots[i + 1]; const x = (a.x + b.x) / 2 + 0.6, y = (a.y + b.y) / 2;
        const h = heightAtMap(this.t, x, y); if (h < 0.08) continue;
        const [wx, wz] = toWorld(x, y);
        this.lamps.setMatrixAt(nl++, M(wx, h - 0.01, wz));
        glow.push({ p: V(wx, h + LAMP_TOP, wz), c: lampCol, s: 0.85, k: 0 });
      }
      // factories from the Smokestack Era
      if (era >= 2) {
        const nF = (industrial[id] ?? 0) + (era >= 3 ? 1 : 0);
        for (let i = 0; i < nF; i++) {
          const l = lots[Math.min(lots.length - 1, want + 2 + i * 3)]; if (!l) break;
          const [wx, wz] = toWorld(l.x, l.y);
          const m = M(wx, l.h - 0.02, wz, l.rot, 1.15);
          this.factories.setMatrixAt(nf, m);
          this.factories.setColorAt(nf, col.setHSL(0.03, 0.2, 0.85 + r.next() * 0.15));
          smokeOrigins.push(CHIMNEY_TOP.clone().applyMatrix4(m));
          nf++;
        }
      }
      // radio masts in the Signal Era
      if (era >= 3) {
        const l = lots[Math.min(lots.length - 1, want + 1)];
        if (l) { const [wx, wz] = toWorld(l.x + 2.5, l.y - 2); const h = heightAtMap(this.t, l.x + 2.5, l.y - 2); this.masts.setMatrixAt(nm++, M(wx, h - 0.02, wz, 0, cap ? 1.2 : 1)); glow.push({ p: V(wx, h + MAST_TOP * (cap ? 1.2 : 1), wz), c: 0xff3b30, s: 1.1, k: 2 }); }
      }
    }
    // the lighthouse on the Sallow Coast and the Assembly's lantern
    const [lx, lz] = toWorld(248, 266);
    glow.push({ p: V(lx, heightAtMap(this.t, 248, 266) + 0.75, lz), c: 0xfff0b0, s: 2.2, k: 3 });
    const [cx, cz] = toWorld(CAPITAL[0], CAPITAL[1]);
    glow.push({ p: V(cx, heightAtMap(this.t, CAPITAL[0], CAPITAL[1]) + 1.5, cz - 0.13), c: 0xffe08a, s: 1.6, k: 0 });
    for (const m of [this.houses, this.factories, this.masts, this.lamps]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; m.computeBoundingSphere(); }
    this.houses.count = nh; this.factories.count = nf; this.masts.count = nm; this.lamps.count = nl;
    // smoke
    const per = COUNTS[this.opts.quality].smoke;
    const sp = this.smoke.geometry.getAttribute('position') as THREE.BufferAttribute, ss = this.smoke.geometry.getAttribute('aSeed') as THREE.BufferAttribute;
    let n = 0;
    for (const o of smokeOrigins) for (let i = 0; i < per && n < sp.count; i++, n++) { sp.setXYZ(n, o.x, o.y, o.z); ss.setX(n, i / per + r.next() * 0.05); }
    sp.needsUpdate = true; ss.needsUpdate = true; this.smoke.geometry.setDrawRange(0, n);
    // glow sprites
    const gp = this.glow.geometry.getAttribute('position') as THREE.BufferAttribute, gc = this.glow.geometry.getAttribute('aColor') as THREE.BufferAttribute;
    const gs = this.glow.geometry.getAttribute('aSize') as THREE.BufferAttribute, gk = this.glow.geometry.getAttribute('aKind') as THREE.BufferAttribute;
    const c = new THREE.Color();
    const gn = Math.min(glow.length, gp.count);
    for (let i = 0; i < gn; i++) { const g = glow[i]; gp.setXYZ(i, g.p.x, g.p.y, g.p.z); c.set(g.c); gc.setXYZ(i, c.r, c.g, c.b); gs.setX(i, g.s); gk.setX(i, g.k); }
    for (const a of [gp, gc, gs, gk]) a.needsUpdate = true;
    this.glow.geometry.setDrawRange(0, gn);
    // railways (Smokestack Era on) and the dome's patina
    this.buildRails(era);
    (this.dome.material as THREE.MeshStandardMaterial).color.set(era >= 2 ? 0x5fa58a : 0xc07a3e);
    if (this.boats) { this.boats.sail.visible = era < 3; this.boats.steam.visible = era >= 2; }
  }

  private buildRails(era: number) {
    if (this.rails) { this.scene.remove(this.rails); this.rails.geometry.dispose(); (this.rails.material as THREE.Material).dispose(); this.rails = null; }
    if (era < 2) return;
    const routes: RegionKey[] = era >= 3 ? ['brassport', 'glasswick', 'tamsfield', 'lowmere', 'sallow', 'ardent'] : ['brassport', 'glasswick', 'tamsfield', 'lowmere'];
    const b = new GeoBuilder(), rgb = lin(0x3d3128), sl = lin(0x8a6a48);
    const from = TOWNS.quillon;
    const segs: [Pt, Pt][] = routes.map((k) => [from, TOWNS[k]]);
    segs.push([TOWNS.tamsfield, TOWNS.corvane]);
    for (const [a, z] of segs) {
      const mid: Pt = [(a[0] + z[0]) / 2 + (z[1] - a[1]) * 0.12, (a[1] + z[1]) / 2 - (z[0] - a[0]) * 0.12];
      const pts: Pt[] = [];
      for (let i = 0; i <= 40; i++) { const t = i / 40, u = 1 - t; pts.push([u * u * a[0] + 2 * u * t * mid[0] + t * t * z[0], u * u * a[1] + 2 * u * t * mid[1] + t * t * z[1]]); }
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
        const [ax, az] = toWorld(x0, y0), [bx, bz] = toWorld(x1, y1);
        const ha = Math.max(0.06, heightAtMap(this.t, x0, y0)) + 0.03, hb = Math.max(0.06, heightAtMap(this.t, x1, y1)) + 0.03;
        const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz) || 1, nx = (-dz / L) * 0.05, nz = (dx / L) * 0.05;
        b.quad(V(ax + nx, ha, az + nz), V(bx + nx, hb, bz + nz), V(bx - nx, hb, bz - nz), V(ax - nx, ha, az - nz), rgb);
        if (i % 2 === 0) b.quad(V(ax + nx * 1.8, ha + 0.005, az + nz * 1.8), V(ax + nx * 1.8 + dx * 0.25, ha + 0.005, az + nz * 1.8 + dz * 0.25), V(ax - nx * 1.8 + dx * 0.25, ha + 0.005, az - nz * 1.8 + dz * 0.25), V(ax - nx * 1.8, ha + 0.005, az - nz * 1.8), sl);
      }
    }
    this.rails = new THREE.Mesh(b.build(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, polygonOffset: true, polygonOffsetFactor: -2 }));
    this.rails.receiveShadow = true;
    this.scene.add(this.rails);
  }

  private buildAssembly() {
    const [x, y] = CAPITAL, [wx, wz] = toWorld(x, y), h = heightAtMap(this.t, x, y);
    const g = new THREE.Group();
    g.position.set(wx, h - 0.03, wz);
    g.scale.setScalar(1.25);
    const body = new THREE.Mesh(assemblyGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.6 }));
    const sh = SHADOW[this.opts.quality] > 0;
    body.castShadow = sh; body.receiveShadow = sh;
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 7, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc07a3e, flatShading: true, roughness: 0.45, metalness: 0.35 }));
    this.dome.position.set(0, 0.91, -0.1); this.dome.castShadow = sh;
    g.add(body, this.dome);
    this.scene.add(g);
  }

  private buildFlags() {
    const pole = new THREE.CylinderGeometry(0.012, 0.014, 0.78, 5); pole.translate(0, 0.39, 0);
    const cloth = new THREE.PlaneGeometry(0.34, 0.2, 6, 2); cloth.translate(0.17, 0.66, 0);
    this.flagsPole = new THREE.InstancedMesh(pole, new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.6 }), 40);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, side: THREE.DoubleSide, roughness: 0.8, flatShading: true });
    const U = this.flagU;
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
float ph = 0.0;
#ifdef USE_INSTANCING
ph = instanceMatrix[3].x * 3.1 + instanceMatrix[3].z * 1.7;
#endif
transformed.z += sin(uTime * 4.0 + position.x * 16.0 + ph) * 0.045 * (position.x / 0.34);`);
    };
    this.flagsCloth = new THREE.InstancedMesh(cloth, mat, 40);
    this.flagsCloth.castShadow = this.flagsPole.castShadow = SHADOW[this.opts.quality] > 0;
    this.flagsPole.count = this.flagsCloth.count = 0;
    this.scene.add(this.flagsPole, this.flagsCloth);
  }
  private layoutFlags(campaigns: Record<string, number>, color: string) {
    const c = cssColor(this.host, color, '#c6ff3d');
    let n = 0;
    // the Republic's own flag over the Assembly
    const [ax, ay] = CAPITAL, [awx, awz] = toWorld(ax, ay), ah = heightAtMap(this.t, ax, ay);
    const big = M(awx + 0.62, ah + 0.15, awz + 0.55, 0, 1.6);
    this.flagsPole.setMatrixAt(n, big); this.flagsCloth.setMatrixAt(n, big); this.flagsCloth.setColorAt(n, new THREE.Color(0x1f3c88)); n++;
    for (const id of REGION_ORDER) {
      const k = Math.min(4, campaigns[id] ?? 0);
      const [tx, ty] = TOWNS[id];
      for (let i = 0; i < k; i++) {
        const a = -0.6 + i * 0.85 + (id.length % 3) * 0.4, rad = 7 + i * 1.2;
        const x = tx + Math.cos(a) * rad, y = ty + Math.sin(a) * rad * 0.8;
        const h = Math.max(0.05, heightAtMap(this.t, x, y));
        const [wx, wz] = toWorld(x, y);
        const m = M(wx, h - 0.02, wz, -0.4, i === 0 ? 1.35 : 1);
        this.flagsPole.setMatrixAt(n, m); this.flagsCloth.setMatrixAt(n, m); this.flagsCloth.setColorAt(n, c); n++;
      }
    }
    this.flagsPole.count = this.flagsCloth.count = n;
    this.flagsPole.instanceMatrix.needsUpdate = this.flagsCloth.instanceMatrix.needsUpdate = true;
    if (this.flagsCloth.instanceColor) this.flagsCloth.instanceColor.needsUpdate = true;
    this.flagsPole.computeBoundingSphere(); this.flagsCloth.computeBoundingSphere();
  }

  private buildBoats() {
    const r = seeded('boats');
    const spots: { x: number; z: number; a: number; p: number }[] = [];
    const want: Pt[] = [[330, 200], [338, 226], [312, 250], [296, 268], [262, 270], [355, 176], [150, 276], [120, 260]];
    for (const [x, y] of want) { if (classify(x, y) !== SEA) continue; const [wx, wz] = toWorld(x, y); spots.push({ x: wx, z: wz, a: r.next() * 6.28, p: r.next() * 6.28 }); }
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.7 });
    const sail = new THREE.InstancedMesh(sailGeo(), mat, Math.max(1, spots.length));
    const steam = new THREE.InstancedMesh(steamerGeo(), mat, Math.max(1, spots.length));
    sail.count = steam.count = spots.length;
    this.boats = { sail, steam, spots };
    this.scene.add(sail, steam);
    this.bobBoats(0);
  }
  private bobBoats(t: number) {
    if (!this.boats) return;
    const { sail, steam, spots } = this.boats;
    spots.forEach((s, i) => {
      const y = Math.sin(t * 1.3 + s.p) * 0.03 - 0.02;
      const m = new THREE.Matrix4().compose(V(s.x, y, s.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(t * 1.1 + s.p) * 0.06, s.a, Math.cos(t * 0.9 + s.p) * 0.05)), V(1.3, 1.3, 1.3));
      (i % 2 ? steam : sail).setMatrixAt(i, m);
      (i % 2 ? sail : steam).setMatrixAt(i, new THREE.Matrix4().makeScale(0, 0, 0));
    });
    sail.instanceMatrix.needsUpdate = steam.instanceMatrix.needsUpdate = true;
    sail.computeBoundingSphere(); steam.computeBoundingSphere();
  }

  private buildBeam() {
    const g = new THREE.CylinderGeometry(0.9, 1.2, 9, 18, 1, true); g.translate(0, 4.5, 0);
    this.beam = new THREE.Mesh(g, new THREE.ShaderMaterial({ uniforms: this.beamU, vertexShader: BEAM_VERT, fragmentShader: BEAM_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.beam.visible = false; this.beam.renderOrder = 8;
    this.scene.add(this.beam);
  }

  // ------------------------------------------------ state

  setState(s: MapSceneState) {
    const prev = this.st; this.st = s;
    this.layoutTowns(s.era, s.turn, s.totalTurns);
    if (!prev || JSON.stringify(prev.campaigns) !== JSON.stringify(s.campaigns) || prev.flagColor !== s.flagColor) this.layoutFlags(s.campaigns, s.flagColor);
    REGION_ORDER.forEach((id, i) => {
      const css = s.tints[id];
      if (css) { this.terrainU.uTint.value[i].copy(cssColor(this.host, css)); this.terrainU.uAmt.value[i] = s.flash ? 0.8 : 0.5; }
      else this.terrainU.uAmt.value[i] = 0;
      this.terrainU.uGlow.value[i] = s.glow[id] ?? 0;
    });
    const sel = s.selected ? SLOT(s.selected) : -1;
    this.terrainU.uSel.value = sel;
    this.selLine.visible = sel >= 0;
    if (sel >= 0) this.selLine.geometry = this.outline(sel);
    this.nightTarget = s.night ? 1 : 0;
    if (this.opts.rm || !prev) this.night = this.nightTarget;
    this.atm = atmosphere(s.era, s.dayPhase, this.night);
    this.applyAtmosphere();
    if (s.pulse && SLOT(s.pulse) >= 0) {
      const p = this.labelPos[SLOT(s.pulse)];
      this.beam.position.set(p.x, 0, p.z);
      this.beamU.uColor.value.copy(cssColor(this.host, s.tints[s.pulse] ?? '#ffffff'));
      this.beamU.uA.value = 0.9; this.beam.visible = true;
    } else this.beam.visible = false;
    this.controls.autoRotate = s.autoOrbit && !this.opts.rm;
    this.loop.invalidate();
  }

  private applyAtmosphere() {
    const a = this.atmosphereNow();
    const su = this.sky.uniforms;
    su.uTop.value.set(a.skyTop); su.uHorizon.value.set(a.skyHorizon); su.uBottom.value.set(a.skyBottom); su.uStars.value = a.stars;
    const el = (a.sunElev * Math.PI) / 180, az = (a.sunAzim * Math.PI) / 180;
    const dir = V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    su.uSunDir.value.copy(dir); su.uSun.value.set(a.sun).multiplyScalar(1 - a.night * 0.7);
    this.sun.position.copy(dir).multiplyScalar(50); this.sun.target.position.set(0, 0, 0);
    this.sun.color.set(a.sun); this.sun.intensity = a.sunIntensity;
    this.hemi.color.set(a.hemiSky); this.hemi.groundColor.set(a.hemiGround); this.hemi.intensity = a.hemiIntensity;
    const fog = this.scene.fog as THREE.Fog; fog.color.set(a.fog); fog.near = a.fogNear; fog.far = a.fogFar;
    this.renderer.toneMappingExposure = a.exposure;
    this.waterMat.color.set(a.water);
    this.terrainU.uNight.value = a.night; this.glowU.uNight.value = a.night;
    this.smokeU.uColor.value.set(a.night > 0.5 ? 0x5a5a66 : 0xbdb6aa);
  }
  private atmosphereNow() { const s = this.st; return s ? atmosphere(s.era, s.dayPhase, this.night) : this.atm; }

  setLabels(els: (HTMLElement | null)[]) { this.labels = els; this.loop.invalidate(); }

  // ------------------------------------------------ camera

  private fitDistance() {
    const aspect = this.size.x / Math.max(1, this.size.y);
    const v = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    const W = this.opts.compact ? 33 : 35, D = 27;
    return Math.min(60, Math.max((W / 2) / (v * aspect), (D / 2) / v * 0.85) * 1.02);
  }
  private home() {
    const d = this.fitDistance(), pol = 0.78;
    const target = V(-0.4, 0, 0.6);
    return { target, pos: target.clone().add(V(0, Math.cos(pol) * d, Math.sin(pol) * d)) };
  }
  resetView(instant = false) {
    const h = this.home();
    this.fly(h.target, h.pos, instant || this.opts.rm ? 0 : 0.9);
  }
  /** Fly to a region's town; `then` runs when the camera arrives. */
  flyTo(regionId: string, then?: () => void) {
    const slot = SLOT(regionId); if (slot < 0) { then?.(); return; }
    const [x, y] = TOWNS[REGION_ORDER[slot]];
    const [wx, wz] = toWorld(x, y);
    const target = V(wx, Math.max(0, heightAtMap(this.t, x, y)), wz);
    const off = this.camera.position.clone().sub(this.controls.target);
    const sph = new THREE.Spherical().setFromVector3(off);
    sph.radius = this.opts.compact ? 16 : 12.5; sph.phi = 0.88;
    const pos = target.clone().add(new THREE.Vector3().setFromSpherical(sph));
    this.fly(target, pos, this.opts.rm ? 0 : 0.95, then);
  }
  private fly(target: THREE.Vector3, pos: THREE.Vector3, dur: number, then?: () => void) {
    if (dur <= 0) {
      this.controls.target.copy(target); this.camera.position.copy(pos); this.camera.lookAt(target); this.controls.update();
      this.flight = null; this.loop?.invalidate(); then?.(); return;
    }
    this.flight = { t: 0, dur, fromT: this.controls.target.clone(), toT: target, fromP: this.camera.position.clone(), toP: pos, then };
    this.controls.enabled = false;
  }
  pan(dx: number, dz: number) {
    const fwd = new THREE.Vector3().subVectors(this.controls.target, this.camera.position).setY(0).normalize();
    const right = new THREE.Vector3().crossVectors(fwd, V(0, 1, 0)).normalize();
    const dist = this.camera.position.distanceTo(this.controls.target) * 0.08;
    const d = right.multiplyScalar(dx * dist).add(fwd.multiplyScalar(-dz * dist));
    this.controls.target.add(d); this.camera.position.add(d); this.clampTarget(); this.controls.update(); this.loop.invalidate();
  }
  orbit(dAz: number, dPol: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const s = new THREE.Spherical().setFromVector3(off);
    s.theta += dAz; s.phi = THREE.MathUtils.clamp(s.phi + dPol, this.controls.minPolarAngle, this.controls.maxPolarAngle);
    this.camera.position.copy(this.controls.target).add(new THREE.Vector3().setFromSpherical(s)); this.controls.update(); this.loop.invalidate();
  }
  zoom(f: number) {
    const off = this.camera.position.clone().sub(this.controls.target);
    const len = THREE.MathUtils.clamp(off.length() * f, this.controls.minDistance, this.controls.maxDistance);
    this.camera.position.copy(this.controls.target).add(off.setLength(len)); this.controls.update(); this.loop.invalidate();
  }
  private clampTarget() {
    const t = this.controls.target;
    const c = V(THREE.MathUtils.clamp(t.x, -19, 19), 0, THREE.MathUtils.clamp(t.z, -13, 14));
    const d = c.sub(V(t.x, 0, t.z));
    if (d.lengthSq() > 0) { t.add(d); this.camera.position.add(d); }
    t.y = THREE.MathUtils.clamp(t.y, 0, 2);
  }

  // ------------------------------------------------ picking

  /** Region slot under a canvas point (ray-marched against the heightmap), or -1. */
  pick(clientX: number, clientY: number): number {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, this.camera);
    const o = rc.ray.origin, d = rc.ray.direction;
    if (d.y >= -1e-4) return -1;
    const top = 4, t0 = Math.max(0, (top - o.y) / d.y), t1 = (-0.2 - o.y) / d.y;
    const p = new THREE.Vector3();
    let prev = t0, hit = -1;
    const above = (t: number) => { p.copy(o).addScaledVector(d, t); return p.y > Math.max(0, heightAtWorld(this.t, p.x, p.z)); };
    for (let i = 1; i <= 160; i++) {
      const t = t0 + ((t1 - t0) * i) / 160;
      if (!above(t)) { let a = prev, b = t; for (let k = 0; k < 8; k++) { const m = (a + b) / 2; if (above(m)) a = m; else b = m; } hit = b; break; }
      prev = t;
    }
    if (hit < 0) return -1;
    p.copy(o).addScaledVector(d, hit);
    const [mx, my] = toMap(p.x, p.z);
    const r = regionAtMap(this.t, mx, my);
    return r >= 0 && r < 8 ? r : -1;
  }
  private onDown = (e: PointerEvent) => { this.down = { x: e.clientX, y: e.clientY, t: performance.now() }; if (this.flight) { this.flight = null; this.controls.enabled = true; } };
  private onUp = (e: PointerEvent) => {
    const d = this.down; this.down = null;
    if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 7 || performance.now() - d.t > 600) return;
    const slot = this.pick(e.clientX, e.clientY);
    if (slot < 0) return;
    const id = REGION_ORDER[slot];
    this.flyTo(id, () => this.opts.onPick?.(id));
  };
  private moveRaf = 0;
  private onMove = (e: PointerEvent) => {
    if (e.pointerType !== 'mouse' || e.buttons) return;
    if (this.moveRaf) return;
    const x = e.clientX, y = e.clientY;
    this.moveRaf = requestAnimationFrame(() => { this.moveRaf = 0; if (!this.disposed) this.setHover(this.pick(x, y)); });
  };
  private onLeave = () => this.setHover(-1);
  setHover(slot: number) {
    if (slot === this.hover) return;
    this.hover = slot;
    this.terrainU.uHover.value = slot;
    this.hoverLine.visible = slot >= 0 && slot !== this.terrainU.uSel.value;
    if (slot >= 0) this.hoverLine.geometry = this.outline(slot);
    this.renderer.domElement.style.cursor = slot >= 0 && this.opts.onPick ? 'pointer' : '';
    this.opts.onHover?.(slot >= 0 ? REGION_ORDER[slot] : null);
    this.loop.invalidate();
  }
  private onLost = (e: Event) => { e.preventDefault(); this.opts.onLost?.(); };

  // ------------------------------------------------ frame

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    if (w === this.size.x && h === this.size.y) return;
    const first = this.size.x === 1;
    this.size.set(w, h);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    const px = h * this.renderer.getPixelRatio();
    this.smokeU.uScale.value = px * 0.9; this.glowU.uScale.value = px * 0.55;
    if (!first && !this.flight) {
      // keep the whole map in view when the card changes shape
      const off = this.camera.position.clone().sub(this.controls.target);
      if (off.length() > this.fitDistance() * 1.05) this.camera.position.copy(this.controls.target).add(off.setLength(this.fitDistance()));
    }
    this.loop?.invalidate();
  }

  private frame(dt: number, now: number): boolean {
    if (!this.opts.rm) this.time += dt;
    const t = this.time;
    this.terrainU.uTime.value = t; this.waterU.uTime.value = t; this.flagU.uTime.value = t; this.smokeU.uTime.value = t; this.glowU.uTime.value = t; this.beamU.uTime.value = t;
    let moving = false;
    if (Math.abs(this.night - this.nightTarget) > 0.001) {
      this.night += Math.sign(this.nightTarget - this.night) * Math.min(Math.abs(this.nightTarget - this.night), dt / 1.6);
      this.applyAtmosphere(); moving = true;
    }
    if (this.flight) {
      const f = this.flight; f.t += dt / f.dur; const k = easeInOut(Math.min(1, f.t));
      this.controls.target.lerpVectors(f.fromT, f.toT, k);
      const p = new THREE.Vector3().lerpVectors(f.fromP, f.toP, k);
      p.y += Math.sin(Math.PI * k) * 2.2; // a gentle arc
      this.camera.position.copy(p); this.camera.lookAt(this.controls.target);
      moving = true;
      if (f.t >= 1) { this.flight = null; this.controls.enabled = true; this.controls.update(); f.then?.(); }
    } else if (this.controls.update()) moving = true;
    if (this.controls.autoRotate) moving = true;
    if (!this.opts.rm) this.bobBoats(t);
    this.placeLabels();
    // adaptive quality: report sustained low frame rates once
    if (this.opts.onSlow && now - this.lastFpsCheck > 1 && this.loop.fps) {
      this.lastFpsCheck = now;
      if (this.loop.fps < 24 && this.loop.continuous) { if (++this.slowSecs >= 4) { this.slowSecs = -1000; this.opts.onSlow(); } } else if (this.slowSecs > 0) this.slowSecs = 0;
    }
    return moving;
  }

  private placeLabels() {
    if (!this.labels.length) return;
    const w = this.size.x, h = this.size.y, v = new THREE.Vector3();
    this.labels.forEach((el, i) => {
      if (!el) return;
      v.copy(this.labelPos[i]).project(this.camera);
      const off = v.z > 1 || v.x < -1.1 || v.x > 1.1 || v.y < -1.15 || v.y > 1.1;
      const x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h;
      el.style.transform = `translate(-50%, -100%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      el.style.visibility = off ? 'hidden' : '';
      el.style.zIndex = String(Math.round((1 - v.z) * 1000));
    });
  }

  /** Renderer stats for debugging and tests. */
  stats() { return { fps: this.loop.fps, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, quality: this.opts.quality }; }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.moveRaf);
    this.ro.disconnect();
    this.loop.dispose();
    this.controls.dispose();
    const cv = this.renderer.domElement;
    cv.removeEventListener('pointerdown', this.onDown); cv.removeEventListener('pointerup', this.onUp);
    cv.removeEventListener('pointermove', this.onMove); cv.removeEventListener('pointerleave', this.onLeave);
    cv.removeEventListener('webglcontextlost', this.onLost);
    for (const g of this.outlineCache.values()) g.dispose();
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    cv.remove();
  }
}

function densify(pts: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i], [bx, by] = pts[i + 1];
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay) / step));
    for (let k = 0; k < n; k++) out.push([ax + ((bx - ax) * k) / n, ay + ((by - ay) * k) / n]);
  }
  out.push(pts[pts.length - 1]);
  return out;
}
export { K };
