// The 3D Assembly chamber for roll calls: a stepped hemicycle of 72 low-poly desks with simple stylised members,
// a lamp on every desk that lights YES / NO / ABSTAIN as the votes come in, members rising as they vote,
// and a slow camera sweep (none under reduced motion). Everything is instanced: about 10 draw calls.
import * as THREE from 'three';
import { HEMI_LAYOUT } from '../ui/visuals';
import { cssColor, disposeTree, easeInOut, GeoBuilder, lin, Loop, makeRenderer, SHADOW } from './gl';
import type { Quality } from './support';

export interface ChamberSeat {
  /** Lamp colour (CSS, may be var(--x)); null = vacant. */
  fill: string | null;
  /** Party colour of the member (CSS). */
  party: string | null;
  /** Not yet called / forecast only. */
  dim?: boolean;
  /** Swing seat (voted against the forecast). */
  flip?: boolean;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const M = (x: number, y: number, z: number, ry = 0, s = 1) => new THREE.Matrix4().compose(V(x, y, z), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), ry), V(s, s, s));
const ROW_R = (row: number) => 3.1 + row * 0.95;
const ROW_Y = (row: number) => row * 0.3;
const ERA_WALL: Record<number, number> = { 1: 0xcdb48a, 2: 0xa58e74, 3: 0xc9d2d8 };

function deskGeo() {
  const b = new GeoBuilder();
  b.add(new THREE.BoxGeometry(0.52, 0.3, 0.2), lin(0x6e4a2c), new THREE.Matrix4().makeTranslation(0, 0.15, 0.16));
  b.add(new THREE.BoxGeometry(0.56, 0.03, 0.26), lin(0x8a5d36), new THREE.Matrix4().makeTranslation(0, 0.31, 0.14));
  b.add(new THREE.BoxGeometry(0.4, 0.3, 0.06), lin(0x5b3a22), new THREE.Matrix4().makeTranslation(0, 0.3, -0.24)); // bench back
  b.add(new THREE.BoxGeometry(0.42, 0.06, 0.2), lin(0x7a2e2e), new THREE.Matrix4().makeTranslation(0, 0.18, -0.14)); // red bench
  return b.build();
}
function figureGeo() {
  const b = new GeoBuilder(), w = lin(0xffffff), skin = lin(0xe9c9a6);
  b.add(new THREE.CylinderGeometry(0.1, 0.15, 0.34, 6), w, new THREE.Matrix4().makeTranslation(0, 0.37, -0.12));
  b.add(new THREE.BoxGeometry(0.3, 0.06, 0.13), w, new THREE.Matrix4().makeTranslation(0, 0.52, -0.12));
  b.add(new THREE.IcosahedronGeometry(0.085, 1), skin, new THREE.Matrix4().makeTranslation(0, 0.65, -0.12));
  b.add(new THREE.BoxGeometry(0.07, 0.04, 0.02), lin(0xf5f0e6), new THREE.Matrix4().makeTranslation(0, 0.49, -0.04)); // collar
  return b.build();
}

export class ChamberScene {
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(36, 1, 0.3, 120);
  private loop: Loop;
  private desks: THREE.InstancedMesh;
  private figures: THREE.InstancedMesh;
  private lamps: THREE.InstancedMesh;
  private halo: THREE.Points;
  private haloU = { uScale: { value: 300 } };
  private wallMat: THREE.MeshStandardMaterial;
  private seatPos: { x: number; y: number; z: number; ry: number }[] = [];
  private stand = new Float32Array(72);
  private standTarget = new Float32Array(72);
  private time = 0;
  private intro = 0;
  private ro: ResizeObserver;
  private size = new THREE.Vector2(1, 1);

  constructor(private host: HTMLElement, private opts: { quality: Quality; rm: boolean; era: number; onLost?: () => void }) {
    const q = opts.quality;
    this.renderer = makeRenderer(host, q);
    this.scene.background = new THREE.Color(0x15110d);
    this.scene.fog = new THREE.Fog(0x15110d, 22, 44);
    const sh = SHADOW[q] > 0;

    // seats in the same left-to-right order as the 2D hemicycle
    for (const p of HEMI_LAYOUT) {
      const a = Math.atan2(100 - p.y, p.x - 100);
      const r = ROW_R(p.row);
      this.seatPos.push({ x: Math.cos(a) * r, y: ROW_Y(p.row), z: -Math.sin(a) * r + 1.2, ry: a - Math.PI / 2 });
    }
    const wood = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.75 });
    this.desks = new THREE.InstancedMesh(deskGeo(), wood, 72);
    this.figures = new THREE.InstancedMesh(figureGeo(), new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.8 }), 72);
    this.lamps = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.07, 0.04), new THREE.MeshBasicMaterial({ color: 0xffffff }), 72);
    this.seatPos.forEach((s, i) => {
      this.desks.setMatrixAt(i, M(s.x, s.y, s.z, s.ry));
      this.figures.setColorAt(i, new THREE.Color(0x888888));
      this.lamps.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(M(s.x, s.y, s.z, s.ry), new THREE.Matrix4().makeTranslation(0, 0.2, 0.265)));
      this.lamps.setColorAt(i, new THREE.Color(0x333333));
    });
    this.desks.castShadow = this.figures.castShadow = sh; this.desks.receiveShadow = sh;
    this.scene.add(this.desks, this.figures, this.lamps);
    this.layoutFigures();

    // lamp halos
    const hg = new THREE.BufferGeometry();
    const hp = new Float32Array(72 * 3), hc = new Float32Array(72 * 3);
    this.seatPos.forEach((s, i) => { const p = V(0, 0.2, 0.3).applyMatrix4(M(s.x, s.y, s.z, s.ry)); hp.set([p.x, p.y, p.z], i * 3); });
    hg.setAttribute('position', new THREE.Float32BufferAttribute(hp, 3));
    hg.setAttribute('aColor', new THREE.Float32BufferAttribute(hc, 3));
    this.halo = new THREE.Points(hg, new THREE.ShaderMaterial({
      uniforms: this.haloU, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */`attribute vec3 aColor; uniform float uScale; varying vec3 vC; void main(){ vC = aColor; vec4 mv = modelViewMatrix * vec4(position,1.0); gl_PointSize = uScale * 0.5 / -mv.z; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: /* glsl */`varying vec3 vC; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; float g = smoothstep(0.5, 0.0, d); gl_FragColor = vec4(vC * g * g, g);
#include <colorspace_fragment>
}`,
    }));
    this.halo.frustumCulled = false;
    this.scene.add(this.halo);

    // the room: stepped tiers, carpet, Speaker's dais, a curved colonnaded wall
    const room = new GeoBuilder();
    for (let r = 0; r < 6; r++) {
      // a stepped half-annulus per row: tread on top, riser facing the floor
      const r0 = ROW_R(r) - 0.48, r1 = ROW_R(r) + 0.48, y = ROW_Y(r), n = 36, top = lin(r % 2 ? 0x5b3d26 : 0x6a472c), riser = lin(0x3e2918);
      for (let k = 0; k < n; k++) {
        const a0 = (Math.PI * k) / n, a1 = (Math.PI * (k + 1)) / n;
        const P = (rad: number, a: number, yy: number) => V(Math.cos(a) * rad, yy, -Math.sin(a) * rad + 1.2);
        room.quad(P(r0, a0, y), P(r0, a1, y), P(r1, a1, y), P(r1, a0, y), top);
        room.quad(P(r0, a1, y), P(r0, a0, y), P(r0, a0, 0), P(r0, a1, 0), riser);
      }
    }
    room.add(new THREE.BoxGeometry(18, 0.04, 14), lin(0x3a2a1e), new THREE.Matrix4().makeTranslation(0, -0.04, 1));
    room.add(new THREE.CylinderGeometry(2.6, 2.6, 0.02, 32, 1, false, Math.PI / 2, Math.PI), lin(0x8c2f2f), new THREE.Matrix4().makeTranslation(0, 0.01, 1.2));
    room.add(new THREE.BoxGeometry(1.6, 0.5, 0.7), lin(0x4a3020), new THREE.Matrix4().makeTranslation(0, 0.25, 2.3));
    room.add(new THREE.BoxGeometry(1.2, 0.08, 0.5), lin(0x8a5d36), new THREE.Matrix4().makeTranslation(0, 0.54, 2.3));
    room.add(new THREE.BoxGeometry(0.5, 0.9, 0.12), lin(0x7a2e2e), new THREE.Matrix4().makeTranslation(0, 0.75, 2.75)); // Speaker's chair
    room.add(new THREE.BoxGeometry(0.1, 0.06, 0.25), lin(0xd8b04a), new THREE.Matrix4().makeTranslation(0.4, 0.6, 2.2)); // the gavel block
    const roomMesh = new THREE.Mesh(room.build(), wood);
    roomMesh.receiveShadow = sh;
    this.scene.add(roomMesh);
    this.wallMat = new THREE.MeshStandardMaterial({ color: ERA_WALL[opts.era] ?? ERA_WALL[1], roughness: 0.9, side: THREE.BackSide, flatShading: true });
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(9.6, 9.6, 6, 30, 1, true, Math.PI / 2, Math.PI), this.wallMat);
    wall.position.set(0, 3, 1.2);
    this.scene.add(wall);
    const colG = new THREE.CylinderGeometry(0.16, 0.19, 5.2, 8); colG.translate(0, 2.6, 0);
    const cols = new THREE.InstancedMesh(colG, new THREE.MeshStandardMaterial({ color: 0xece2cc, roughness: 0.7, flatShading: true }), 11);
    for (let i = 0; i < 11; i++) { const a = Math.PI * (i + 0.5) / 11; cols.setMatrixAt(i, M(Math.cos(a) * 9.1, 0, -Math.sin(a) * 9.1 + 1.2)); }
    cols.castShadow = sh;
    this.scene.add(cols);

    // light: warm lamps of the Lamp Era, harsher electric light later
    const hemi = new THREE.HemisphereLight(opts.era >= 3 ? 0xdfe8ff : 0xffe2b8, 0x2a1d12, 1.1);
    const key = new THREE.DirectionalLight(opts.era >= 3 ? 0xffffff : 0xffd9a0, 2.2);
    key.position.set(-4, 10, 7);
    if (sh) {
      key.castShadow = true; key.shadow.mapSize.set(SHADOW[q], SHADOW[q]);
      const c = key.shadow.camera; c.left = -10; c.right = 10; c.top = 10; c.bottom = -6; c.near = 1; c.far = 30; key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02;
    }
    this.scene.add(hemi, key, key.target);

    this.loop = new Loop(this.renderer, host, (dt) => this.frame(dt), !opts.rm);
    this.loop.render = () => this.renderer.render(this.scene, this.camera);
    this.renderer.domElement.addEventListener('webglcontextlost', this.onLost);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(host);
    this.resize();
    this.placeCamera(0);
  }

  private onLost = (e: Event) => { e.preventDefault(); this.opts.onLost?.(); };

  setSeats(seats: ChamberSeat[]) {
    const c = new THREE.Color();
    const hc = this.halo.geometry.getAttribute('aColor') as THREE.BufferAttribute;
    for (let i = 0; i < 72; i++) {
      const s = seats[i];
      const vacant = !s || !s.fill;
      this.figures.setColorAt(i, vacant ? c.set(0x3a3a3a) : cssColor(this.host, s.party, '#888'));
      const lamp = vacant ? c.set(0x2a2a2a) : cssColor(this.host, s.fill, '#666');
      if (!vacant && s.dim) lamp.multiplyScalar(0.35);
      this.lamps.setColorAt(i, lamp);
      const lit = !vacant && !s.dim;
      hc.setXYZ(i, lit ? lamp.r * (s.flip ? 1.6 : 1) : 0, lit ? lamp.g * (s.flip ? 1.6 : 1) : 0, lit ? lamp.b * (s.flip ? 1.6 : 1) : 0);
      this.standTarget[i] = lit ? 1 : 0;
      if (this.opts.rm) this.stand[i] = this.standTarget[i];
    }
    hc.needsUpdate = true;
    if (this.figures.instanceColor) this.figures.instanceColor.needsUpdate = true;
    if (this.lamps.instanceColor) this.lamps.instanceColor.needsUpdate = true;
    this.figures.visible = true;
    this.layoutFigures();
    this.loop.invalidate();
  }
  setEra(era: number) { this.wallMat.color.set(ERA_WALL[era] ?? ERA_WALL[1]); this.loop.invalidate(); }

  private layoutFigures() {
    this.seatPos.forEach((s, i) => {
      const k = this.stand[i];
      this.figures.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(M(s.x, s.y, s.z, s.ry), new THREE.Matrix4().makeTranslation(0, k * 0.16, k * 0.04)));
    });
    this.figures.instanceMatrix.needsUpdate = true;
  }

  private placeCamera(t: number) {
    // a slow sweep across the benches; reduced motion keeps the camera still
    const k = easeInOut(Math.min(1, this.intro));
    const sweep = this.opts.rm ? 0 : Math.sin(t * 0.16) * 0.32;
    const aspect = this.size.x / Math.max(1, this.size.y);
    const hHalf = Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    const dist = Math.max(12, 9.4 / Math.tan(hHalf) + 1.5) + (1 - k) * 3;
    const elev = 0.78 - (1 - k) * 0.12;
    this.camera.position.set(Math.sin(sweep) * dist * Math.cos(elev), Math.sin(elev) * dist + 0.4, 1.2 + Math.cos(sweep) * dist * Math.cos(elev));
    this.camera.lookAt(0, 0.2, -2.2);
  }

  private frame(dt: number): boolean {
    let moving = false;
    if (!this.opts.rm) { this.time += dt; this.intro += dt / 1.6; moving = true; } else this.intro = 1;
    let changed = false;
    for (let i = 0; i < 72; i++) {
      const d = this.standTarget[i] - this.stand[i];
      if (Math.abs(d) > 0.002) { this.stand[i] += d * Math.min(1, dt * 10); changed = true; }
    }
    if (changed) { this.layoutFigures(); moving = true; }
    this.placeCamera(this.time);
    return moving;
  }

  private resize() {
    const w = Math.max(1, this.host.clientWidth), h = Math.max(1, this.host.clientHeight);
    if (w === this.size.x && h === this.size.y) return;
    this.size.set(w, h);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    this.haloU.uScale.value = h * this.renderer.getPixelRatio();
    this.placeCamera(this.time);
    this.loop?.invalidate();
  }

  stats() { return { fps: this.loop.fps, calls: this.renderer.info.render.calls, triangles: this.renderer.info.render.triangles, quality: this.opts.quality }; }

  dispose() {
    this.ro.disconnect();
    this.loop.dispose();
    this.renderer.domElement.removeEventListener('webglcontextlost', this.onLost);
    disposeTree(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.renderer.domElement.remove();
  }
}
