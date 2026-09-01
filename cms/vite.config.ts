import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ command }) => ({
  // In production the CMS and the marketing site share one Vercel project,
  // so the CMS's assets are namespaced to keep them clear of the site's own
  // /assets. Only asset URLs are affected — routes still answer at the root
  // of cms.televizio.ge, so the router keeps its default basename.
  //
  // Dev serves from '/' so local URLs stay ordinary.
  base: command === 'build' ? '/cmsapp/' : '/',
  plugins: [react(), tailwindcss()],
  server: { port: 5174, strictPort: true },
}));
