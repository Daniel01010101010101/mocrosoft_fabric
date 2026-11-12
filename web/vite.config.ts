import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, type Plugin } from 'vite';
import { CATEGORY_IDS } from '../shared/categories';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * GitHub Pages no tiene reescrituras de rutas. Para que los enlaces directos devuelvan 200
 * se genera una copia de index.html por cada ruta conocida (secciones, categorías y novedades);
 * 404.html cubre cualquier otra ruta y el SPA la resuelve.
 */
function staticRoutes(): Plugin {
  return {
    name: 'static-route-copies',
    apply: 'build',
    closeBundle() {
      const dist = path.join(here, 'dist');
      const index = path.join(dist, 'index.html');
      copyFileSync(index, path.join(dist, '404.html'));
      const routes = ['novedades', 'semanas', 'historico', 'roadmap', 'destacadas', 'categorias', 'estado'];
      try {
        routes.push(...CATEGORY_IDS.map((c) => `categorias/${c}`));
        const updates = JSON.parse(readFileSync(path.join(dist, 'api', 'updates.json'), 'utf8')) as { id: string }[];
        routes.push(...updates.map((u) => `novedad/${u.id}`));
      } catch {
        /* sin API generada: solo las secciones */
      }
      for (const r of routes) {
        const dir = path.join(dist, r);
        mkdirSync(dir, { recursive: true });
        copyFileSync(index, path.join(dir, 'index.html'));
      }
    },
  };
}

export default defineConfig({
  root: here,
  base: process.env.BASE_PATH || '/',
  plugins: [react(), tailwindcss(), staticRoutes()],
  build: {
    outDir: path.join(here, 'dist'),
    emptyOutDir: true,
    chunkSizeWarningLimit: 900,
  },
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
});
