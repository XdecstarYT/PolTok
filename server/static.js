// Serves the built SPA from dist/ with an index.html fallback for client-side routes.
import fs from 'node:fs';
import path from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.map': 'application/json', '.xml': 'application/xml; charset=utf-8',
};

export function createStatic(distDir) {
  const root = path.resolve(distDir);
  const enabled = () => fs.existsSync(path.join(root, 'index.html'));

  function send(res, file, req) {
    const ext = path.extname(file).toLowerCase();
    const st = fs.statSync(file);
    const immutable = file.includes(`${path.sep}assets${path.sep}`);
    res.writeHead(200, {
      'content-type': TYPES[ext] || 'application/octet-stream',
      'content-length': st.size,
      'cache-control': immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
    });
    if (req.method === 'HEAD') return res.end();
    fs.createReadStream(file).pipe(res);
  }

  return {
    enabled,
    /** @returns {boolean} handled */
    handle(req, res, pathname) {
      if (!enabled()) return false;
      let rel;
      try {
        rel = decodeURIComponent(pathname);
      } catch {
        rel = '/';
      }
      const file = path.resolve(root, '.' + rel);
      if (file.startsWith(root + path.sep) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        send(res, file, req);
        return true;
      }
      // Missing asset-looking paths 404; routes fall back to the SPA.
      if (path.extname(rel) && !rel.endsWith('.html')) return false;
      send(res, path.join(root, 'index.html'), req);
      return true;
    },
  };
}
