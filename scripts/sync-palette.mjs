// Copies the theme repo's palette.toml into src/theme/ and regenerates the tokens (ADR 013).
import { copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = new URL('../', import.meta.url);
const themeDir = resolve(fileURLToPath(ROOT), process.env.NESSY_THEME_DIR ?? '../nessy-theme');
const source = resolve(themeDir, 'palette.toml');

if (!existsSync(source)) {
  console.error(`sync-palette: ${source} not found. Set NESSY_THEME_DIR to the nessy-theme checkout.`);
  process.exit(1);
}

copyFileSync(source, new URL('src/theme/palette.toml', ROOT));
const result = spawnSync(process.execPath, [fileURLToPath(new URL('scripts/gen-tokens.mjs', ROOT))], { stdio: 'inherit' });
process.exit(result.status ?? 1);
