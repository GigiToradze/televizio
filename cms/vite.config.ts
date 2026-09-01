import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // The CMS and the marketing site share one Vercel project, so the CMS's
  // assets are namespaced to keep them clear of the site's own /assets.
  // Only asset URLs are affected — routes are still served from the root of
  // cms.televizio.ge, so the router keeps its default basename.
  base: '/cmsapp/',
  plugins: [react(), tailwindcss()],
  server: { port: 5174 },
});
