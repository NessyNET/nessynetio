import { resolve } from 'node:path';
import sitemap from '@astrojs/sitemap';
import { defineConfig } from 'astro/config';
import { contentGate } from './src/integrations/content-gate.ts';

export default defineConfig({
  output: 'static',
  // `site` comes from content (set by contentGate), so the sitemap integration must be listed after it.
  integrations: [contentGate(), sitemap({ filter: (page) => !/\/404(\/|\.html)?$/.test(new URL(page).pathname) })],
  trailingSlash: 'always',
  compressHTML: 'jsx', // S2: default jsx rules keep multi-space commands byte-exact
  build: { format: 'directory', inlineStylesheets: 'never' },
  vite: {
    build: { assetsInlineLimit: 0 },
    resolve: {
      alias: { '@content': resolve(process.env.NESSY_CONTENT_DIR ?? 'content') },
    },
  },
});
