// PolTok reel engine — browser runtime (three.js). Deterministic: every frame is a pure function of t.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

export const W = 1080, H = 1920;
export const C = {
  ink: 0x090b10, ink1: 0x0f1218, ink2: 0x141820, ink3: 0x1b2029, line: 0x2a303c,
  lime: 0xc8f04a, text: 0xf3f5f9, text2: 0xb7bfcd, red: 0xff3d55, blue: 0x3d7bff, live: 0xff4560,
};

// ---------- math ----------
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, k) => a + (b - a) * k;
export const remap = (x, a, b) => clamp((x - a) / (b - a));
export const ease = {
  lin: (x) => clamp(x),
  inOut: (x) => { x = clamp(x); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; },
  out: (x) => 1 - Math.pow(1 - clamp(x), 3),
  in: (x) => Math.pow(clamp(x), 3),
  expo: (x) => { x = clamp(x); return x === 1 ? 1 : 1 - Math.pow(2, -10 * x); },
  inExpo: (x) => { x = clamp(x); return x === 0 ? 0 : Math.pow(2, 10 * x - 10); },
  back: (x) => { x = clamp(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); },
  elastic: (x) => { x = clamp(x); if (x === 0 || x === 1) return x; return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1; },
  sine: (x) => -(Math.cos(Math.PI * clamp(x)) - 1) / 2,
};
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
// smooth deterministic noise (sum of sines) for handheld camera drift
export const wobble = (t, s = 0) => Math.sin(t * 1.13 + s) * 0.5 + Math.sin(t * 2.31 + s * 1.7) * 0.3 + Math.sin(t * 4.07 + s * 2.9) * 0.2;

// ---------- engine state ----------
export const E = {
  THREE, C, W, H, ease, clamp, lerp, remap, rng, wobble,
  tl: null, data: null, geo: {}, scenes: new Map(), cues: [], updaters: [], dpr: 1,
};

export function cue(t, type, opts = {}) { E.cues.push({ t: +t.toFixed(4), type, ...opts }); }
E.cue = cue;

// beat helpers (grid origin = tl.origin)
E.beatPhase = (t) => { const b = E.tl.beat; const x = (t - E.tl.origin) / b; return x < 0 ? 1 : x - Math.floor(x); };
E.beatPulse = (t, k = 7) => (t < E.tl.origin ? 0 : Math.exp(-E.beatPhase(t) * E.tl.beat * k));
E.snap = (t, div = 1) => { const b = E.tl.beat / div; return E.tl.origin + Math.round((t - E.tl.origin) / b) * b; };

// ---------- renderer & post ----------
let renderer, rtA, rtB, rtC, comp, grade, bloom, pmrem, envTex;

function makeRT(w, h) {
  const rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 });
  rt.depthTexture = new THREE.DepthTexture(w, h);
  rt.depthTexture.type = THREE.UnsignedIntType;
  return rt;
}

const COMP_FS = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA, tB, dA, dB;
uniform vec4 camA, camB;      // near, far, focus, aperture
uniform float mode, p, maxCoc, aspect;
uniform vec2 dir, res;
float lin(float z, vec4 c){ return (c.x*c.y)/((c.y-c.x)*z - c.y) * -1.0; }
float coc(float d, vec4 c){ return clamp(c.w * abs(d - c.z) / max(d, 0.001), 0.0, 1.0); }
vec3 dof(sampler2D tc, sampler2D td, vec2 uv, vec4 c){
  vec3 base = texture2D(tc, uv).rgb;
  if (c.w <= 0.0) return base;
  float cc = coc(lin(texture2D(td, uv).r, c), c) * maxCoc;
  if (cc < 0.6) return base;
  vec3 acc = base; float wsum = 1.0;
  for (int i = 1; i < 17; i++) {
    float fi = float(i);
    float r = sqrt(fi / 16.0) * cc;
    float a = fi * 2.39996323;
    vec2 o = vec2(cos(a), sin(a)) * r / res;
    vec2 su = uv + o;
    float tc2 = coc(lin(texture2D(td, su).r, c), c) * maxCoc;
    float w = smoothstep(0.0, 1.0, tc2 / max(r, 0.001) + 0.15);
    acc += texture2D(tc, su).rgb * w; wsum += w;
  }
  return acc / wsum;
}
vec4 samp(sampler2D t, vec2 uv){ if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return vec4(0.0); return vec4(texture2D(t, uv).rgb, 1.0); }
vec3 dirBlur(vec2 uv, float s){
  // uv is in "strip" space: A occupies [0,1], B occupies [1,2] (or [-1,0]) along dir
  vec3 acc = vec3(0.0);
  float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  for (int i = 0; i < 24; i++) {
    float f = ((float(i) + jit) / 24.0 - 0.5) * s;
    vec2 u = uv + dir * f;
    vec2 la = u; vec2 lb = u - dir;
    vec4 a = samp(tA, la); vec4 b = samp(tB, lb);
    acc += a.a > 0.5 ? a.rgb : b.rgb;
  }
  return acc / 24.0;
}
void main(){
  vec2 uv = vUv;
  vec3 col;
  if (mode < 0.5) {
    col = dof(tA, dA, uv, camA);
  } else if (mode < 1.5) {           // whip pan
    float e = p < 0.5 ? 4.0*p*p*p : 1.0 - pow(-2.0*p + 2.0, 3.0) / 2.0;
    float s = sin(3.14159 * p);
    col = dirBlur(uv + dir * e, 0.22 * s);
    col *= 1.0 + 0.35 * s;
  } else if (mode < 2.5) {           // zoom through
    float s = sin(3.14159 * p);
    vec2 c = uv - 0.5;
    vec3 acc = vec3(0.0);
    float jit = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
    for (int i = 0; i < 16; i++) {
      float f = (float(i) + jit) / 16.0;
      float zA = 1.0 / (1.0 + 1.6 * p * p + 0.25 * s * f);
      float zB = 1.0 / (0.55 + 0.45 * p + 0.25 * s * f);
      vec3 a = texture2D(tA, 0.5 + c * zA).rgb;
      vec3 b = texture2D(tB, 0.5 + c * zB).rgb;
      acc += mix(a, b, smoothstep(0.35, 0.65, p));
    }
    col = acc / 16.0 * (1.0 + 0.6 * s);
  } else {                            // dissolve / flash / match
    vec3 a = dof(tA, dA, uv, camA);
    vec3 b = dof(tB, dB, uv, camB);
    col = mix(a, b, smoothstep(0.0, 1.0, p));
  }
  gl_FragColor = vec4(col, 1.0);
}`;

const GRADE_FS = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform sampler2D tC;
uniform float exposure, grain, frame, vig, ca, flash;
uniform vec3 flashCol, lift;
uniform vec2 res;
vec3 aces(vec3 x){ const float a=2.51,b=0.03,c=2.43,d=0.59,e=0.14; return clamp((x*(a*x+b))/(x*(c*x+d)+e),0.0,1.0); }
float h(vec2 p){ p = fract(p * vec2(443.897, 441.423)); p += dot(p, p.yx + 19.19); return fract((p.x + p.y) * p.x); }
vec3 srgb(vec3 c){ return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(0.0031308, c)); }
void main(){
  vec2 uv = vUv; vec2 d = uv - 0.5;
  float r2 = dot(d, d);
  vec2 off = d * ca * r2;
  vec3 col;
  col.r = texture2D(tC, uv - off).r;
  col.g = texture2D(tC, uv).g;
  col.b = texture2D(tC, uv + off).b;
  col *= exposure;
  col = aces(col);
  col = srgb(col);
  col = max(col, lift * (1.0 - col));
  float v = smoothstep(0.85, 0.18, length(d * vec2(1.0, 1.25)));
  col *= mix(1.0 - vig, 1.0, v);
  float g = h(uv * res + frame * 7.13) - 0.5;
  col += g * grain;
  col = mix(col, flashCol, flash);
  gl_FragColor = vec4(col, 1.0);
}`;

export function initRenderer(dpr) {
  E.dpr = dpr;
  renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(dpr);
  renderer.setSize(W, H);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.NoToneMapping;
  document.getElementById('stage').appendChild(renderer.domElement);
  const w = Math.round(W * dpr), h = Math.round(H * dpr);
  rtA = makeRT(w, h); rtB = makeRT(w, h);
  rtC = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType });
  comp = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: {
      tA: { value: null }, tB: { value: null }, dA: { value: null }, dB: { value: null },
      camA: { value: new THREE.Vector4() }, camB: { value: new THREE.Vector4() },
      mode: { value: 0 }, p: { value: 0 }, maxCoc: { value: 16 * dpr }, aspect: { value: W / H },
      dir: { value: new THREE.Vector2(1, 0) }, res: { value: new THREE.Vector2(w, h) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: COMP_FS, depthTest: false, depthWrite: false,
  }));
  grade = new FullScreenQuad(new THREE.ShaderMaterial({
    uniforms: {
      tC: { value: rtC.texture }, exposure: { value: 1.0 }, grain: { value: 0.032 }, frame: { value: 0 }, vig: { value: 0.42 }, ca: { value: 0.012 },
      flash: { value: 0 }, flashCol: { value: new THREE.Color(1, 1, 1) }, lift: { value: new THREE.Vector3(0.035, 0.043, 0.063) }, res: { value: new THREE.Vector2(w, h) },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: GRADE_FS, depthTest: false, depthWrite: false,
  }));
  bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), 0.5, 0.45, 1.25);
  pmrem = new THREE.PMREMGenerator(renderer);
  envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  E.renderer = renderer; E.envTex = envTex; E.bloom = bloom; E.gradeU = grade.material.uniforms;
}

// ---------- scenes ----------
/**
 * Register the visuals for a timeline scene id.
 * builder(S) gets S = { id, t0, t1, dur, scene, camera, layer (DOM), update(fn(lt, t)), focus, aperture }
 */
export function defineScene(id, builder) { E.scenes.set(id, { id, builder }); }
E.defineScene = defineScene;

export function buildScenes() {
  const list = [];
  for (const s of E.tl.scenes) {
    const def = E.scenes.get(s.id);
    if (!def) throw new Error('no builder for scene ' + s.id);
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(C.ink);
    scene.environment = envTex;
    scene.environmentIntensity = 0.32;
    const camera = new THREE.PerspectiveCamera(34, W / H, 0.1, 200);
    const layer = document.createElement('div');
    layer.className = 'layer';
    layer.dataset.scene = s.id;
    document.getElementById('ov').appendChild(layer);
    const S = { ...s, dur: s.t1 - s.t0, scene, camera, layer, fns: [], late: [], focus: 12, aperture: 0.0, exposure: 1, flash: 0 };
    S.update = (fn) => S.fns.push(fn);
    def.builder(S, E);
    list.push(S);
  }
  E.list = list;
  // transitions → audio cues
  for (let i = 1; i < list.length; i++) {
    const tr = list[i].trans || { type: 'cut' };
    const tb = list[i].t0;
    const sfx = { whip: 'whoosh', zoom: 'zoom', fade: 'swell', flash: 'hit', cut: 'tick', match: 'swell' }[tr.type] || 'whoosh';
    cue(tb, sfx, { dir: tr.dir || 'left', dur: tr.dur || 0.4 });
  }
}

const DIRS = { left: [1, 0], right: [-1, 0], up: [0, -1], down: [0, 1] };

function camVec(S) {
  return new THREE.Vector4(S.camera.near, S.camera.far, S.focus, S.aperture);
}

function setLayer(S, css, vis) {
  S.layer.style.display = vis ? 'block' : 'none';
  if (vis) { S.layer.style.transform = css.transform || ''; S.layer.style.opacity = css.opacity ?? 1; S.layer.style.filter = css.filter || ''; }
}

function runScene(S, t) {
  const lt = t - S.t0;
  for (const fn of S.fns) fn(lt, t);
  S.camera.updateMatrixWorld();
  for (const fn of S.late) fn(lt, t);
}

export function renderFrame(t) {
  const list = E.list;
  let i = list.findIndex((s) => t >= s.t0 && t < s.t1);
  if (i < 0) i = t < 0 ? 0 : list.length - 1;
  let A = list[i], B = null, p = 0, tr = null;
  // incoming transition for scene i
  const trIn = list[i].trans, trOut = list[i + 1]?.trans;
  if (i > 0 && trIn && trIn.type !== 'cut' && t < list[i].t0 + (trIn.dur || 0.4) / 2) {
    tr = trIn; A = list[i - 1]; B = list[i]; p = (t - (list[i].t0 - (tr.dur || 0.4) / 2)) / (tr.dur || 0.4);
  } else if (trOut && trOut.type !== 'cut' && t >= list[i].t1 - (trOut.dur || 0.4) / 2) {
    tr = trOut; A = list[i]; B = list[i + 1]; p = (t - (list[i].t1 - (tr.dur || 0.4) / 2)) / (tr.dur || 0.4);
  }
  p = clamp(p);
  for (const S of list) if (S !== A && S !== B) setLayer(S, {}, false);
  runScene(A, t);
  if (B) runScene(B, t);
  for (const fn of E.updaters) fn(t);

  const U = comp.material.uniforms;
  renderer.setRenderTarget(rtA);
  renderer.render(A.scene, A.camera);
  U.tA.value = rtA.texture; U.dA.value = rtA.depthTexture; U.camA.value.copy(camVec(A));
  let exposure = A.exposure, flash = A.flash || 0;
  if (B) {
    renderer.setRenderTarget(rtB);
    renderer.render(B.scene, B.camera);
    U.tB.value = rtB.texture; U.dB.value = rtB.depthTexture; U.camB.value.copy(camVec(B));
    const d = DIRS[tr.dir || 'left'] || DIRS.left;
    U.dir.value.set(d[0], d[1]);
    U.p.value = p;
    U.mode.value = { whip: 1, zoom: 2 }[tr.type] ?? 3;
    exposure = lerp(A.exposure, B.exposure, p);
    // DOM layers follow the shader motion
    const e = ease.inOut(p), s = Math.sin(Math.PI * p);
    if (tr.type === 'whip') {
      // uv shift: dir*e in uv space -> content moves by -dir*e; y uv is flipped vs CSS
      const dx = -d[0] * e * W, dy = d[1] * e * H;
      const blur = `blur(${(s * 10).toFixed(1)}px)`;
      setLayer(A, { transform: `translate(${dx}px,${dy}px)`, filter: blur }, true);
      setLayer(B, { transform: `translate(${dx + d[0] * W}px,${dy - d[1] * H}px)`, filter: blur }, true);
    } else if (tr.type === 'zoom') {
      setLayer(A, { transform: `scale(${1 + 1.6 * p * p})`, opacity: 1 - remap(p, 0.3, 0.55) }, true);
      setLayer(B, { transform: `scale(${0.55 + 0.45 * p})`, opacity: remap(p, 0.45, 0.75) }, true);
    } else {
      setLayer(A, { opacity: 1 - ease.sine(p) }, true);
      setLayer(B, { opacity: ease.sine(p) }, true);
      if (tr.type === 'flash') flash = Math.max(flash, Math.sin(Math.PI * p) * 0.85);
    }
    if (tr.type === 'whip') flash = Math.max(flash, s * 0.06);
  } else {
    U.mode.value = 0;
    setLayer(A, {}, true);
  }
  renderer.setRenderTarget(rtC);
  comp.render(renderer);
  bloom.render(renderer, null, rtC, 0, false);
  const G = grade.material.uniforms;
  G.exposure.value = exposure;
  G.frame.value = Math.round(t * E.tl.fps);
  G.flash.value = flash;
  if (tr && tr.type === 'flash') G.flashCol.value.set(tr.color ?? 0xc8f04a); else G.flashCol.value.set(0xffffff);
  renderer.setRenderTarget(null);
  grade.render(renderer);
}
E.renderFrame = renderFrame;

// ---------- stage: lights, floor, atmosphere ----------
export function stage(S, o = {}) {
  const { scene } = S;
  const accent = new THREE.Color(o.accent ?? C.lime);
  scene.fog = new THREE.FogExp2(C.ink, o.fog ?? 0.028);
  const hemi = new THREE.HemisphereLight(0x9fb3d9, 0x0b0d12, o.hemi ?? 0.55);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff1e0, o.key ?? 2.0);
  key.position.set(...(o.keyPos || [6, 14, 8]));
  key.castShadow = o.shadows !== false;
  key.shadow.mapSize.set(1024, 1024);
  const sz = o.shadowSize ?? 12;
  Object.assign(key.shadow.camera, { left: -sz, right: sz, top: sz, bottom: -sz, near: 1, far: 60 });
  key.shadow.bias = -0.0004;
  key.shadow.radius = 4;
  scene.add(key, key.target);
  const rimA = new THREE.PointLight(accent, (o.rim ?? 60) * 0.45, 30, 1.6);
  const rimB = new THREE.PointLight(new THREE.Color(o.accent2 ?? 0x6d8cff), (o.rim2 ?? 40) * 0.45, 30, 1.6);
  scene.add(rimA, rimB);
  let floor = null;
  if (o.floor !== false) {
    const mat = new THREE.MeshStandardMaterial({ color: 0x0b0e14, roughness: 0.42, metalness: 0.5, envMapIntensity: 0.25 });
    const gridCol = new THREE.Color(o.gridColor ?? C.lime);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.gridCol = { value: gridCol };
      sh.uniforms.gridAmt = { value: o.grid ?? 0.05 };
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWP;').replace('#include <worldpos_vertex>', '#include <worldpos_vertex>\nvWP = (modelMatrix * vec4(transformed,1.0)).xyz;');
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vWP; uniform vec3 gridCol; uniform float gridAmt;')
        .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          vec2 gw = abs(fract(vWP.xz * 0.5) - 0.5) / fwidth(vWP.xz * 0.5);
          float gl = 1.0 - min(min(gw.x, gw.y), 1.0);
          float fade = exp(-length(vWP.xz) * 0.06);
          totalEmissiveRadiance += gridCol * gl * gridAmt * fade;`);
    };
    floor = new THREE.Mesh(new THREE.CircleGeometry(80, 64), mat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = o.floorY ?? 0;
    floor.receiveShadow = true;
    scene.add(floor);
  }
  // atmosphere glow card behind subject
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.ShaderMaterial({
    uniforms: { col: { value: accent.clone() }, a: { value: (o.glow ?? 0.22) * 0.35 } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader: 'varying vec2 vUv; uniform vec3 col; uniform float a; void main(){ float d=length(vUv-0.5)*2.0; gl_FragColor=vec4(col*a*pow(max(0.0,1.0-d),2.2),1.0);}',
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  }));
  glow.scale.set(40, 40, 1);
  glow.position.set(...(o.glowPos || [0, 6, -18]));
  glow.renderOrder = -1;
  scene.add(glow);
  const st = { hemi, key, rimA, rimB, floor, glow, accent };
  // animated lighting: slow rim orbit + beat pulse
  const c = o.center || [0, 1, 0];
  S.update((lt, t) => {
    const a = lt * (o.orbit ?? 0.35);
    rimA.position.set(c[0] + Math.cos(a) * 7, c[1] + 4, c[2] - 5 + Math.sin(a) * 3);
    rimB.position.set(c[0] - Math.cos(a * 0.8) * 8, c[1] + 2.5, c[2] + 2 - Math.sin(a) * 3);
    const pulse = E.beatPulse(t) * (o.pulse ?? 0.35);
    rimA.intensity = (o.rim ?? 60) * 0.45 * (1 + pulse);
    key.target.position.set(...c);
  });
  return st;
}
E.stage = stage;

// camera move helper: keys = [{t, pos:[x,y,z], look:[x,y,z], fov?}] with ease between
export function camPath(S, keys, o = {}) {
  const V = (a) => new THREE.Vector3(...a);
  const P = keys.map((k) => ({ ...k, p: V(k.pos), l: V(k.look) }));
  const sh = o.shake ?? 0.05;
  if (o.shiftY) S.camera.setViewOffset(W, H, 0, -o.shiftY, W, H);
  S.update((lt, t) => {
    let i = 0;
    while (i < P.length - 1 && lt >= P[i + 1].t) i++;
    const a = P[i], b = P[Math.min(i + 1, P.length - 1)];
    const k = a === b ? 0 : (b.ease || ease.inOut)(remap(lt, a.t, b.t));
    const pos = a.p.clone().lerp(b.p, k), look = a.l.clone().lerp(b.l, k);
    pos.x += wobble(t * 0.7, 1) * sh; pos.y += wobble(t * 0.6, 2) * sh; pos.z += wobble(t * 0.5, 3) * sh * 0.5;
    S.camera.position.copy(pos);
    S.camera.lookAt(look);
    if (a.fov || b.fov) { S.camera.fov = lerp(a.fov ?? 34, b.fov ?? a.fov ?? 34, k); S.camera.updateProjectionMatrix(); }
    if (o.focusOn) S.focus = S.camera.position.distanceTo(look) + (o.focusBias ?? 0);
  });
}
E.camPath = camPath;

// project a world point to CSS px in the 1080x1920 overlay
const _v = new THREE.Vector3();
E.toScreen = (S, v) => { _v.copy(v).project(S.camera); return [(_v.x * 0.5 + 0.5) * W, (-_v.y * 0.5 + 0.5) * H, _v.z]; };
