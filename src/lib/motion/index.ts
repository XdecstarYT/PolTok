/**
 * Motion — animated cards + video/GIF export.
 *
 *   const card = await renderCardCanvas('broadcast', data, { ...style, size: { w: 1080, h: 1920 } });
 *   const frame = (c, t) => renderMotionFrame(c, { card, data }, { preset: 'election', duration: 10 }, t);
 *   const { blob } = await exportVideo(frame, { width: 1080, height: 1920, duration: 10 });
 */
export * from './timeline';
export * from './reel';
export * from './export';
export { encodeGif, medianCut } from './gif';
