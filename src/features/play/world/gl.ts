// Shared three.js plumbing for the 3D views: renderer setup, a pausable render loop, a tiny geometry builder,
// a gradient sky dome and CSS colour resolution. Imported only by the lazy 3D chunk.
import * as THREE from 'three';
import type { Quality } from './support';

export const PIXEL_RATIO: Record<Quality, number> = { low: 1, medium: 1.5, high: 2 };
export const SHADOW: Record<Quality, number> = { low: 0, medium: 1024, high: 2048 };

export function makeRenderer(host: HTMLElement, quality: Quality): THREE.WebGLRenderer {
  const r = new THREE.WebGLRenderer({ antialias: quality !== 'low', powerPreference: quality === 'high' ? 'high-performance' : 'default', alpha: false, stencil: false });
  r.setPixelRatio(Math.min(window.devicePixelRatio || 1, PIXEL_RATIO[quality]));
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.toneMapping = THREE.ACESFilmicToneMapping;
  r.toneMappingExposure = 1;
  r.shadowMap.enabled = SHADOW[quality] > 0;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.domElement.className = 'q3d__canvas';
  host.appendChild(r.domElement);
  return r;
}

/**
 * A render loop that only runs while the view is on screen and the tab is visible.
 * `continuous` false renders on demand (reduced motion); call `invalidate()` after changes.
 */
export class Loop {
  private visible = !document.hidden;
  private onscreen = true;
  private running = false;
  private dirty = true;
  private last = 0;
  private acc = 0;
  private frames = 0;
  private fpsT = 0;
  fps = 0;
  private io?: IntersectionObserver;
  private onVis = () => { this.visible = !document.hidden; this.sync(); };
  constructor(private renderer: THREE.WebGLRenderer, private host: HTMLElement, private frame: (dt: number, t: number) => boolean | void,
    public continuous = true, private minFrameMs = 0) {
    document.addEventListener('visibilitychange', this.onVis);
    if (typeof IntersectionObserver !== 'undefined') {
      this.io = new IntersectionObserver((es) => { for (const e of es) this.onscreen = e.isIntersecting; this.sync(); }, { threshold: 0.01 });
      this.io.observe(host);
    }
    this.sync();
  }
  get active() { return this.running; }
  invalidate() { this.dirty = true; }
  private sync() {
    const want = this.visible && this.onscreen;
    if (want === this.running) return;
    this.running = want;
    this.last = 0;
    this.renderer.setAnimationLoop(want ? (t) => this.tick(t) : null);
    this.host.dataset.paused = want ? '' : '1';
  }
  private tick(now: number) {
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 1 / 60;
    if (this.minFrameMs && this.last && now - this.last < this.minFrameMs - 1) return; // frame cap (low quality)
    this.last = now;
    const moving = this.frame(dt, now / 1000) === true;
    if (this.continuous || moving || this.dirty) { this.dirty = false; this.frames++; this.render(); }
    this.acc += dt; this.fpsT += dt;
    if (this.fpsT >= 1) { this.fps = Math.round(this.frames / this.fpsT); this.frames = 0; this.fpsT = 0; this.host.dataset.fps = String(this.fps); this.host.dataset.calls = String(this.renderer.info.render.calls); }
  }
  render = () => {};
  dispose() {
    this.renderer.setAnimationLoop(null);
    document.removeEventListener('visibilitychange', this.onVis);
    this.io?.disconnect();
  }
}

/** Accumulates flat-shaded triangles with per-vertex colour and a region slot into one non-indexed geometry. */
export class GeoBuilder {
  pos: number[] = []; col: number[] = []; reg: number[] = [];
  tri(a: THREE.Vector3Like, b: THREE.Vector3Like, c: THREE.Vector3Like, rgb: readonly [number, number, number], region = -1) {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) { this.col.push(rgb[0], rgb[1], rgb[2]); this.reg.push(region); }
  }
  quad(a: THREE.Vector3Like, b: THREE.Vector3Like, c: THREE.Vector3Like, d: THREE.Vector3Like, rgb: readonly [number, number, number], region = -1) {
    this.tri(a, b, c, rgb, region); this.tri(a, c, d, rgb, region);
  }
  /** Append another (indexed or not) geometry with a flat colour. */
  add(g: THREE.BufferGeometry, rgb: readonly [number, number, number], m?: THREE.Matrix4) {
    const ng = g.index ? g.toNonIndexed() : g;
    const p = ng.getAttribute('position'); const v = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i); if (m) v.applyMatrix4(m);
      this.pos.push(v.x, v.y, v.z); this.col.push(rgb[0], rgb[1], rgb[2]); this.reg.push(-1);
    }
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  build(withRegion = false): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if (withRegion) g.setAttribute('aRegion', new THREE.Float32BufferAttribute(this.reg, 1));
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

/** sRGB hex colour to a linear [r,g,b] triple (vertex colours are linear). */
export function lin(hex: number): [number, number, number] {
  const c = new THREE.Color(hex);
  return [c.r, c.g, c.b];
}

/** Resolve a CSS colour (hex, rgb(), or var(--x)) against an element, as a THREE.Color. */
export function cssColor(el: Element, css: string | null | undefined, fallback = '#888888'): THREE.Color {
  let v = (css ?? '').trim();
  const m = /^var\((--[\w-]+)\s*(?:,\s*([^)]+))?\)$/.exec(v);
  if (m) v = getComputedStyle(el).getPropertyValue(m[1]).trim() || (m[2] ?? '').trim();
  if (!v) v = fallback;
  if (v.startsWith('color-mix') || v.startsWith('oklch') || v.startsWith('lab')) {
    // let the browser compute it
    const probe = document.createElement('span'); probe.style.color = v; probe.style.display = 'none'; el.appendChild(probe);
    v = getComputedStyle(probe).color; probe.remove();
  }
  const c = new THREE.Color();
  try { const rgb = /^rgba?\(([^)]+)\)$/.exec(v); if (rgb) { const [r, g, b] = rgb[1].split(/[ ,/]+/).map(Number); c.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace); } else c.set(v); }
  catch { c.set(fallback); }
  return c;
}

/** A big gradient sky dome with an optional star field. */
export function makeSky(radius = 300) {
  const uniforms = {
    uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() }, uBottom: { value: new THREE.Color() },
    uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSun: { value: new THREE.Color() }, uStars: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: /* glsl */`varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
    fragmentShader: /* glsl */`
      uniform vec3 uTop, uHorizon, uBottom, uSun, uSunDir; uniform float uStars; varying vec3 vDir;
      float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
      void main(){
        vec3 d = normalize(vDir);
        float y = d.y;
        vec3 c = y > 0.0 ? mix(uHorizon, uTop, pow(clamp(y,0.0,1.0), 0.55)) : mix(uHorizon, uBottom, clamp(-y*3.0,0.0,1.0));
        float s = max(dot(d, normalize(uSunDir)), 0.0);
        c += uSun * (pow(s, 600.0) * 1.2 + pow(s, 12.0) * 0.18);
        if (uStars > 0.0 && y > 0.02) { vec3 g = floor(d * 220.0); float st = step(0.9975, h(g)); c += vec3(st) * uStars * smoothstep(0.02, 0.3, y); }
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 24, 12), mat);
  mesh.frustumCulled = false; mesh.renderOrder = -10;
  return { mesh, uniforms };
}

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Dispose every geometry and material under an object. */
export function disposeTree(root: THREE.Object3D) {
  root.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose()); else mat?.dispose();
  });
}
