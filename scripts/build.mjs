// Build wrapper: parses flags into env vars, then runs Astro's programmatic build.
// 010 and 030 extend this file.
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const USAGE = 'Usage: npm run build -- [--strict] [--allow-samples] [--content <dir>]';

/** @param {string[]} argv
 *  @returns {{ strict: boolean, allowSamples: boolean, contentDir: string }} */
export function parseBuildArgs(argv) {
  const args = { strict: false, allowSamples: false, contentDir: resolve('content') };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--strict') args.strict = true;
    else if (arg === '--allow-samples') args.allowSamples = true;
    else if (arg === '--content') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error('--content requires a directory');
      args.contentDir = resolve(value);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

async function main() {
  let args;
  try {
    args = parseBuildArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`${error.message}\n${USAGE}`);
    process.exit(2);
  }
  process.env.NESSY_STRICT = args.strict ? '1' : '0';
  process.env.NESSY_ALLOW_SAMPLES = args.allowSamples ? '1' : '0';
  process.env.NESSY_CONTENT_DIR = args.contentDir;
  try {
    const { build } = await import('astro');
    await build({ root: process.cwd() });
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
