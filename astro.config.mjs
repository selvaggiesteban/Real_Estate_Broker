// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  site: 'https://real-estate-broker.pages.dev',
  output: 'server',
  trailingSlash: 'ignore',
  vite: {
    // Cast: @tailwindcss/vite resuelve una versión de Vite distinta a la de Astro 5.
    plugins: [/** @type {any} */ (tailwindcss())],
  },
  integrations: [
    sitemap({
      filter: (page) => !page.includes('/api/'),
    }),
  ],
  adapter: cloudflare({
    imageService: 'compile',
  }),
});
