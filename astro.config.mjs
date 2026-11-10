import { resolve } from 'node:path';
import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
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
