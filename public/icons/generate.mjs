// Rasterise public/favicon.svg into the PWA icon set.
// Usage: NODE_PATH=$(npm root -g) node public/icons/generate.mjs   (needs Playwright + chromium)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const dir = path.dirname(fileURLToPath(import.meta.url));
const svg = fs.readFileSync(path.join(dir, '..', 'favicon.svg'), 'utf8');
const BG = '#07080d';
// [file, size, maskable(safe-zone padding, full-bleed bg)]
const OUT = [
  ['icon-192.png', 192, false], ['icon-512.png', 512, false],
  ['maskable-192.png', 192, true], ['maskable-512.png', 512, true],
  ['apple-touch-icon.png', 180, true], ['favicon-32.png', 32, false],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [file, size, mask] of OUT) {
  const inner = mask ? Math.round(size * 0.72) : size;
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;width:${size}px;height:${size}px;display:grid;place-items:center;background:${mask ? BG : 'transparent'}">
    <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: path.join(dir, file), omitBackground: !mask });
  console.log('wrote', file);
}
await browser.close();
