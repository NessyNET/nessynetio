// Precompression for nginx `gzip_static` (design 3.6.3): `.gz` only, gzip level 9, no brotli (ADR 015).
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { constants, gzipSync } from 'node:zlib';

/** Text formats worth compressing; images and fonts are already compressed and are skipped. */
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.xml', '.svg', '.txt']);
const MIN_BYTES = 1024;

/** The one compression setting the budget and the server both assume. @param {Buffer} data */
export const gzip9 = (data) => gzipSync(data, { level: constants.Z_BEST_COMPRESSION });

/** @param {string} dir @returns {string[]} */
function filesUnder(dir) {
  /** @type {string[]} */
  const found = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path));
    else found.push(path);
  }
  return found;
}

/**
 * Writes `<file>.gz` beside every compressible file of at least 1 KB.
 * @param {string} distDir
 * @returns {string[]} the written paths, relative to `distDir`
 */
export function precompress(distDir) {
  /** @type {string[]} */
  const written = [];
  for (const path of filesUnder(distDir)) {
    if (!COMPRESSIBLE.has(extname(path)) || statSync(path).size < MIN_BYTES) continue;
    writeFileSync(`${path}.gz`, gzip9(readFileSync(path)));
    written.push(`${relative(distDir, path).split('\\').join('/')}.gz`);
  }
  return written;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dist = process.argv[2];
  if (dist === undefined) {
    console.error('Usage: node scripts/precompress.mjs <dist>');
    process.exit(2);
  }
  console.log(`${precompress(dist).length} files precompressed`);
}
