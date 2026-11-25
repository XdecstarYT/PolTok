/** Immersive Mode: a 3D Victoria. 88 extruded districts on a glowing sea, starfield, glass poll pillars, bloom.
 *  Pure three.js; the React page drives it through the returned controller. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export interface District { id: string; name: string; rings: [number, number][][][] } // polygons → rings → [lon, lat]
export interface Pillar { key: string; label: string; value: number; color: string }
export interface SceneOpts { reduced: boolean; onHover: (id: string | null, x: number, y: number) => void; onPick: (id: string | null) => void }

const LON0 = 145.2, LAT0 = -36.9, K = 2.35; // projection centre + scale (≈ 20 units across the state)
const COSL = Math.cos((LAT0 * Math.PI) / 180);
export const proj = (lon: number, lat: number): [number, number] => [(lon - LON0) * COSL * K, (lat - LAT0) * K];
export const MELBOURNE = proj(144.96, -37.81);

type Tile = { id: string; mesh: THREE.Mesh; mat: THREE.MeshPhysicalMaterial; edge: THREE.LineSegments; cx: number; cz: number;
  h: number; hTarget: number; col: THREE.Color; colTarget: THREE.Color; glow: number; glowTarget: number; delay: number };

export function createImmersive(host: HTMLElement, districts: District[], pillars: Pillar[], o: SceneOpts) {
  const W = () => host.clientWidth, H = () => host.clientHeight;
  const mobile = W() < 720;
  const renderer = new THREE.WebGLRenderer({ antialias: !mobile, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.5 : 2));
  renderer.setSize(W(), H());
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.88;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);
  renderer.domElement.style.display = 'block';
  renderer.domElement.style.touchAction = 'none';

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x070a18, 0.022);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  // sky: vertical gradient dome
  const sky = new THREE.Mesh(new THREE.SphereGeometry(140, 32, 16), new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(0x120b3a) }, mid: { value: new THREE.Color(0x0a1230) }, bot: { value: new THREE.Color(0x02030a) } },
    vertexShader: 'varying vec3 vp; void main(){ vp = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; varying vec3 vp; void main(){ float h = normalize(vp).y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, .6)) : mix(mid, bot, pow(-h, .5)); gl_FragColor = vec4(c, 1.0); }',
  }));
  scene.add(sky);

  // stars
  {
    const n = 1800, pos = new Float32Array(n * 3), col = new Float32Array(n * 3);
    const pal = [new THREE.Color(0xffffff), new THREE.Color(0xcdf25a), new THREE.Color(0x7da7ff), new THREE.Color(0xff8394)];
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1, th = Math.random() * Math.PI * 2, r = 60 + Math.random() * 60;
      const y = Math.abs(u) * 0.9 + 0.05;
      pos.set([Math.cos(th) * Math.sqrt(1 - y * y) * r, y * r, Math.sin(th) * Math.sqrt(1 - y * y) * r], i * 3);
      const c = pal[i % 11 === 0 ? 1 : i % 13 === 0 ? 2 : i % 17 === 0 ? 3 : 0]; col.set([c.r, c.g, c.b], i * 3);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    scene.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 0.35, vertexColors: true, transparent: true, opacity: 0.9, fog: false, depthWrite: false })));
  }

  // sea: dark glossy plane with a shimmering grid
  const seaMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false,
    uniforms: { t: { value: 0 }, c1: { value: new THREE.Color(0x061028) }, c2: { value: new THREE.Color(0xcdf25a) } },
    vertexShader: 'varying vec2 vUv; varying vec3 wp; void main(){ vUv = uv; vec4 w = modelMatrix * vec4(position,1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float t; uniform vec3 c1; uniform vec3 c2; varying vec2 vUv; varying vec3 wp;
      float grid(vec2 p, float s){ vec2 g = abs(fract(p / s - 0.5) - 0.5) / fwidth(p / s); return 1.0 - min(min(g.x, g.y), 1.0); }
      void main(){ float d = length(wp.xz); float fade = smoothstep(55.0, 6.0, d);
        float g = grid(wp.xz, 1.0) * 0.18 + grid(wp.xz, 5.0) * 0.32;
        float wave = 0.5 + 0.5 * sin(d * 0.9 - t * 1.6);
        vec3 col = c1 + c2 * g * (0.35 + 0.65 * wave) * 0.55;
        gl_FragColor = vec4(col, fade * 0.95); }`,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(160, 160), seaMat);
  sea.rotation.x = -Math.PI / 2; sea.position.y = -0.02;
  scene.add(sea);

  // lights
  scene.add(new THREE.HemisphereLight(0x9fb4ff, 0x10061a, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.15); key.position.set(-8, 18, 10); scene.add(key);
  const rim = new THREE.DirectionalLight(0xcdf25a, 0.7); rim.position.set(10, 6, -12); scene.add(rim);

  // districts
  const group = new THREE.Group(); scene.add(group);
  const tiles: Tile[] = [];
  const edgeMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.28 });
  for (const d of districts) {
    const shapes: THREE.Shape[] = [];
    let sx = 0, sz = 0, sn = 0;
    for (const poly of d.rings) {
      const [outer, ...holes] = poly;
      if (!outer || outer.length < 4) continue;
      const pts = outer.map(([lo, la]) => { const [x, y] = proj(lo, la); sx += x; sz += -y; sn++; return new THREE.Vector2(x, y); });
      const sh = new THREE.Shape(pts);
      for (const h of holes) if (h.length >= 4) sh.holes.push(new THREE.Path(h.map(([lo, la]) => new THREE.Vector2(...proj(lo, la)))));
      shapes.push(sh);
    }
    if (!shapes.length) continue;
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 1 });
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x334, roughness: 0.38, metalness: 0.05, clearcoat: 0.25, clearcoatRoughness: 0.35, emissive: 0x000000, envMapIntensity: 0.28 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.id = d.id;
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), edgeMat);
    mesh.add(edge);
    group.add(mesh);
    const cx = sx / sn, cz = sz / sn;
    tiles.push({ id: d.id, mesh, mat, edge, cx, cz, h: 0.001, hTarget: 0.2, col: new THREE.Color(0x334455), colTarget: new THREE.Color(0x334455), glow: 0, glowTarget: 0, delay: (cx + 12) / 24 * 1.6 + Math.random() * 0.25 });
  }
  const byId = new Map(tiles.map((t) => [t.id, t]));

  // glass poll pillars in Bass Strait
  const pillarGroup = new THREE.Group(); scene.add(pillarGroup);
  const pillarMeshes: { mesh: THREE.Mesh; core: THREE.Mesh; target: number; label: string; key: string }[] = [];
  pillars.forEach((p, i) => {
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 1, roughness: 0.06, thickness: 0.6, ior: 1.45, metalness: 0, clearcoat: 1, transparent: true, opacity: 0.95, envMapIntensity: 1.2 });
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1, 40, 1), glass);
    const core = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1, 24, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(p.color).multiplyScalar(1.6) }));
    const x = -3.1 + i * 2.05, z = -7.4;
    m.position.set(x, 0, z); core.position.set(x, 0, z);
    pillarGroup.add(m, core);
    pillarMeshes.push({ mesh: m, core, target: Math.max(0.3, p.value * 0.065), label: p.label, key: p.key });
  });

  // camera + controls
  const camera = new THREE.PerspectiveCamera(mobile ? 55 : 42, W() / H(), 0.1, 400);
  const home = { pos: new THREE.Vector3(0, mobile ? 21 : 15, mobile ? 22 : 17), look: new THREE.Vector3(0, 0, 0.6) };
  camera.position.set(0, 48, 44);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.06;
  controls.minDistance = 2.2; controls.maxDistance = 45; controls.maxPolarAngle = Math.PI * 0.47;
  controls.target.copy(home.look);
  controls.autoRotate = !o.reduced; controls.autoRotateSpeed = 0.35;

  // post
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(W() / 2, H() / 2), mobile ? 0.45 : 0.6, 0.5, 0.86);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // camera tween
  let tween: { from: THREE.Vector3; to: THREE.Vector3; lf: THREE.Vector3; lt: THREE.Vector3; t0: number; dur: number } | null = null;
  const flyTo = (pos: THREE.Vector3, look: THREE.Vector3, dur = 2.2) => {
    tween = { from: camera.position.clone(), to: pos, lf: controls.target.clone(), lt: look, t0: clock.getElapsedTime(), dur: o.reduced ? 0.01 : dur };
  };
  const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

  // picking
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let hovered: Tile | null = null, picked: Tile | null = null, downAt = 0;
  const pick = (cx: number, cy: number) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hit = ray.intersectObjects(tiles.map((t) => t.mesh), false)[0];
    return hit ? byId.get(hit.object.userData.id as string) ?? null : null;
  };
  const onMove = (e: PointerEvent) => {
    const t = pick(e.clientX, e.clientY);
    if (t !== hovered) { hovered = t; renderer.domElement.style.cursor = t ? 'pointer' : 'grab'; }
    o.onHover(t?.id ?? null, e.clientX, e.clientY);
  };
  const onDown = () => { downAt = performance.now(); };
  const onUp = (e: PointerEvent) => {
    if (performance.now() - downAt > 250) return; // drag, not tap
    const t = pick(e.clientX, e.clientY);
    picked = t; o.onPick(t?.id ?? null);
    if (t) focusSeat(t.id);
  };
  renderer.domElement.addEventListener('pointermove', onMove);
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);
  renderer.domElement.addEventListener('pointerleave', () => { hovered = null; o.onHover(null, 0, 0); });

  const focusSeat = (id: string) => {
    const t = byId.get(id); if (!t) return;
    t.mesh.geometry.computeBoundingBox();
    const bb = t.mesh.geometry.boundingBox!; const size = Math.max(bb.max.x - bb.min.x, bb.max.z - bb.min.z);
    const dist = Math.max(4.6, size * 3.6);
    controls.autoRotate = false;
    flyTo(new THREE.Vector3(t.cx + dist * 0.25, dist * 0.95, t.cz + dist * 0.95), new THREE.Vector3(t.cx, 0.2, t.cz));
  };

  // loop
  const clock = new THREE.Clock();
  let raf = 0, alive = true, introDone = false, lastT = 0;
  const tmp = new THREE.Color();
  const frame = () => {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    const t = clock.getElapsedTime();
    const dt = Math.min(0.05, Math.max(0.001, t - lastT)); lastT = t;
    if (!introDone) { flyTo(home.pos.clone(), home.look.clone(), 3.2); introDone = true; }
    if (tween) {
      const k = Math.min(1, (t - tween.t0) / tween.dur), e = ease(k);
      camera.position.lerpVectors(tween.from, tween.to, e);
      controls.target.lerpVectors(tween.lf, tween.lt, e);
      if (k >= 1) tween = null;
    }
    for (const tl of tiles) {
      const appear = o.reduced ? 1 : Math.min(1, Math.max(0, (t - 0.6 - tl.delay) / 0.7));
      const target = tl.hTarget * (appear < 1 ? 1 - Math.pow(1 - appear, 3) : 1);
      tl.h += (target - tl.h) * Math.min(1, dt * 6);
      tl.mesh.scale.y = Math.max(0.001, tl.h + (tl === hovered || tl === picked ? 0.08 : 0));
      tl.col.lerp(tl.colTarget, Math.min(1, dt * 5));
      tl.glow += (tl.glowTarget - tl.glow) * Math.min(1, dt * 4);
      const pulse = tl.glow > 0.01 ? tl.glow * (0.55 + 0.45 * Math.sin(t * 3.2 + tl.cx)) : 0;
      tl.mat.color.copy(tl.col);
      tl.mat.emissive.copy(tmp.copy(tl.col)).multiplyScalar(0.04 + pulse * 0.55 + (tl === hovered || tl === picked ? 0.3 : 0));
    }
    pillarMeshes.forEach((p, i) => {
      const k = o.reduced ? 1 : Math.min(1, Math.max(0, (t - 2.2 - i * 0.18) / 0.9));
      const h = p.target * (1 - Math.pow(1 - k, 3));
      p.mesh.scale.y = Math.max(0.001, h); p.mesh.position.y = h / 2 + 0.25 + Math.sin(t * 1.2 + i) * 0.06;
      p.core.scale.y = Math.max(0.001, h * 0.96); p.core.position.y = p.mesh.position.y;
    });
    seaMat.uniforms.t.value = t;
    controls.update();
    composer.render();
  };
  frame();

  const onResize = () => {
    camera.aspect = W() / H(); camera.updateProjectionMatrix();
    renderer.setSize(W(), H()); composer.setSize(W(), H());
  };
  const ro = new ResizeObserver(onResize); ro.observe(host);

  return {
    /** party colour + whether it changes hands (glow + lift) per district id */
    setSeats(map: Record<string, { color: string; changed: boolean; height: number }>) {
      for (const tl of tiles) {
        const v = map[tl.id]; if (!v) continue;
        tl.colTarget.set(v.color);
        tl.hTarget = v.height + (v.changed ? 0.28 : 0);
        tl.glowTarget = v.changed ? 1 : 0;
      }
    },
    flyHome() { controls.autoRotate = !o.reduced; flyTo(home.pos.clone(), home.look.clone(), 2.2); picked = null; },
    flyMelbourne() { controls.autoRotate = false; flyTo(new THREE.Vector3(MELBOURNE[0] + 0.9, 7.2, -MELBOURNE[1] + 6.4), new THREE.Vector3(MELBOURNE[0], 0, -MELBOURNE[1] - 0.2), 2.4); },
    focusSeat(id: string) { picked = byId.get(id) ?? null; focusSeat(id); },
    setAutoRotate(v: boolean) { controls.autoRotate = v && !o.reduced; },
    /** screen position of each pillar top (for HTML labels) */
    pillarScreen(): { key: string; label: string; x: number; y: number; visible: boolean }[] {
      return pillarMeshes.map((p) => {
        const v = new THREE.Vector3(p.mesh.position.x, p.mesh.position.y + p.mesh.scale.y / 2 + 0.35, p.mesh.position.z).project(camera);
        return { key: p.key, label: p.label, x: (v.x * 0.5 + 0.5) * W(), y: (-v.y * 0.5 + 0.5) * H(), visible: v.z < 1 && p.mesh.scale.y > 0.2 };
      });
    },
    dispose() {
      alive = false; cancelAnimationFrame(raf); ro.disconnect(); controls.dispose();
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      scene.traverse((obj) => { const m = obj as THREE.Mesh; m.geometry?.dispose?.(); const mat = m.material as THREE.Material | THREE.Material[] | undefined; (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose()); });
      pmrem.dispose(); composer.dispose(); renderer.dispose(); renderer.domElement.remove();
    },
  };
}
export type Immersive = ReturnType<typeof createImmersive>;
