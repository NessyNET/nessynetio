// `npm run samples [-- --content <dir>]`: prints every sample item and the count (design 3.5.6). A report: exit 0.
// Node strips the types of the imported .ts module.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formatSampleList, loadSite } from '../src/lib/content/index.ts';

export const USAGE = 'Usage: npm run samples -- [--content <dir>]';

/** @param {string[]} argv @returns {{ contentDir: string }} */
export function parseSamplesArgs(argv) {
  const args = { contentDir: resolve('content') };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] !== '--content') throw new Error(`Unknown argument: ${argv[i]}`);
    const value = argv[++i];
    if (value === undefined || value.startsWith('--')) throw new Error('--content requires a directory');
    args.contentDir = resolve(value);
  }
  return args;
}

async function main() {
  let args;
  try {
    args = parseSamplesArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    process.exit(2);
  }
  const { samples } = await loadSite({ dir: args.contentDir, strict: false, allowSamples: false });
  for (const line of formatSampleList(samples)) console.log(line);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
