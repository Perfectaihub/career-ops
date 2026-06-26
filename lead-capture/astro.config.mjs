// @ts-check
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

// The lead-capture form is a single static screen — no per-request SSR is needed.
// We ship a fully static Astro build (served by Cloudflare Pages' CDN for a fast
// first paint) and put the only server-side logic in a Cloudflare Pages Function
// at `functions/api/lead.ts`. That keeps the Airtable token off the client and
// avoids the `_worker.js` (advanced mode) that an SSR adapter would generate,
// which would otherwise shadow the `functions/` directory on Pages.
export default defineConfig({
  output: 'static',
  site: 'https://connect.perfectaihub.com',
  vite: {
    plugins: [tailwindcss()],
  },
});
