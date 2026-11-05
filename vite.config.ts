import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vendor splitting: stable libs get their own long-cached chunks; geo JSON stays in lazy route chunks.
function manualChunks(id: string) {
  if (!id.includes('node_modules')) return undefined;
  if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'vendor-react';
  if (/node_modules\/(react-router|react-router-dom|@remix-run)\//.test(id)) return 'vendor-router';
  if (id.includes('node_modules/framer-motion/') || id.includes('node_modules/motion-')) return 'vendor-motion';
  if (/node_modules\/(d3-[a-z]+|internmap)\//.test(id)) return 'vendor-d3';
  if (id.includes('node_modules/topojson-client/')) return 'vendor-topojson';
  return undefined;
}

export default defineConfig({
  plugins: [react()],
  build: { rollupOptions: { output: { manualChunks } } },
  server: {
    port: 5173,
    host: true,
    proxy: { '/api': { target: 'http://localhost:8787', changeOrigin: true } },
  },
});
