// 3D support detection and quality defaults. No three.js here: this module ships in the PlayPage chunk,
// and the 3D scenes (which pull in three) are loaded lazily only when they are about to render.
import { createContext, useContext } from 'react';

export type Quality = 'low' | 'medium' | 'high';
export type QualityPref = 'auto' | Quality;

let webgl: boolean | null = null;
let gpu = '';
/** WebGL2 is available (three r170 needs it). Cached; never throws. */
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    if (typeof document === 'undefined') return (webgl = false);
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) as WebGL2RenderingContext | null;
    webgl = !!gl;
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      gpu = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) ?? '');
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  } catch { webgl = false; }
  return webgl;
}
/** Mark 3D as unavailable for this session (context lost, renderer failed). */
export function disableWebGL() { webgl = false; }

/** A sensible default quality for this device. */
export function defaultQuality(): Quality {
  if (typeof navigator === 'undefined') return 'medium';
  hasWebGL();
  const soft = /swiftshader|llvmpipe|software|basic render/i.test(gpu);
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 4;
  const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
  const small = typeof window !== 'undefined' && Math.min(window.screen?.width ?? 1280, window.innerWidth) < 820;
  if (soft) return 'low';
  if (coarse || small) return cores >= 8 && mem >= 6 ? 'medium' : 'low';
  return cores >= 8 && mem >= 8 ? 'high' : 'medium';
}
export const resolveQuality = (p: QualityPref): Quality => (p === 'auto' ? defaultQuality() : p);
export const downgrade = (q: Quality): Quality | null => (q === 'high' ? 'medium' : q === 'medium' ? 'low' : null);

export interface Gfx3D {
  /** The player wants the 3D views (map and roll call). */
  enabled: boolean;
  quality: QualityPref;
  rm: boolean;
  /** Change the 3D preference from inside a view (e.g. the map's 2D/3D toggle). */
  setEnabled?: (on: boolean) => void;
}
export const Gfx3DContext = createContext<Gfx3D>({ enabled: true, quality: 'auto', rm: false });
export const useGfx3D = () => useContext(Gfx3DContext);
/** 3D views should render now: wanted, and the browser can do it. */
export const use3D = () => { const g = useGfx3D(); return g.enabled && hasWebGL(); };
