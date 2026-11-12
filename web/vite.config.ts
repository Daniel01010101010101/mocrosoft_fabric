import { copyFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));

/** GitHub Pages sirve 404.html para rutas desconocidas: se copia index.html para que el SPA las resuelva. */
function spaFallback(): Plugin {
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    closeBundle() {
      const dist = path.join(here, 'dist');
      copyFileSync(path.join(dist, 'index.html'), path.join(dist, '404.html'));
    },
  };
}

export default defineConfig({
  root: here,
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss(), spaFallback()],
  build: {
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
