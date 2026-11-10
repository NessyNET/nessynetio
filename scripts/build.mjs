// Build wrapper: parses flags into env vars, runs the content gate, Astro's programmatic build, then the output
// checks, the performance budget, precompression and `dist/.build-meta.json` (design 3.4 F-build).
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBuildMeta } from '../src/lib/build-meta.ts';
import { clearSiteMemo, formatSampleList, loadSiteMemoised, summarise } from '../src/lib/content/index.ts';
import { formatDiagnostic } from '../src/lib/content/diagnostics.ts';
import { formatBudget, measureBudget } from './budget.mjs';
import { checkOutput } from './check-output.mjs';
import { precompress } from './precompress.mjs';

export const USAGE = 'Usage: npm run build -- [--strict] [--allow-samples] [--content <dir>] [--out <dir>]';

/** @param {string[]} argv
 *  @returns {{ strict: boolean, allowSamples: boolean, contentDir: string, outDir: string | undefined }} */
export function parseBuildArgs(argv) {
  const args = { strict: false, allowSamples: false, contentDir: resolve('content'), outDir: undefined };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--strict') args.strict = true;
    else if (arg === '--allow-samples') args.allowSamples = true;
    else if (arg === '--content') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error('--content requires a directory');
      args.contentDir = resolve(value);
    } else if (arg === '--out') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error('--out requires a directory');
      args.outDir = resolve(value);
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return args;
}

/**
 * Output checks (O1 to O7) and the budget over a finished build.
 * @param {{ distDir: string, siteUrl: string, samplesAllowed: boolean }} options
 */
export function verifyOutput({ distDir, siteUrl, samplesAllowed }) {
  const findings = checkOutput({ distDir, siteUrl, samplesAllowed });
  const budget = measureBudget(distDir);
  return { ok: findings.length === 0 && budget.failures.length === 0, findings, budget };
}

/** @param {string[]} args @returns {string} trimmed stdout, or "" when git fails (not a repository, no commits) */
function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : '';
}

/**
 * `ref` of the build meta. Only the release script sets NESSY_RELEASE_REF (to `main`, after its source check), so only
 * a release build can carry `main`; an ordinary build records `local:<branch>` or `local:detached`, which `activate`
 * and `isReleasable` refuse (design 3.6.4, 3.6.5).
 * @param {NodeJS.ProcessEnv} env @param {string} branch `git rev-parse --abbrev-ref HEAD`, "" or "HEAD" when detached
 */
export function buildRef(env, branch) {
  return env['NESSY_RELEASE_REF'] ?? `local:${branch === '' || branch === 'HEAD' ? 'detached' : branch}`;
}

/**
 * The build's provenance (design 8.2). `ref` and `source` come from the release script's environment; an ordinary
 * build records `local:<branch>` and `local`.
 * @param {{ strict: boolean, samplesAllowed: boolean, env?: NodeJS.ProcessEnv, now?: Date }} options
 */
export function makeBuildMeta({ strict, samplesAllowed, env = process.env, now = new Date() }) {
  const commit = git('rev-parse', 'HEAD');
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  const astroVersion = createRequire(import.meta.url)('astro/package.json').version;
  return parseBuildMeta({
    strict,
    samplesAllowed,
    commit: /^[0-9a-f]{40}$/.test(commit) ? commit : 'unknown',
    ref: buildRef(env, branch),
    source: env['NESSY_RELEASE_SOURCE'] ?? 'local',
    dirty: git('status', '--porcelain') !== '',
    builtAt: now.toISOString(),
    astroVersion,
  });
}

/**
 * Runs the content gate before Astro so a failing gate prints its diagnostics and one message, not Astro's hook
 * error and stack trace. A passing gate prints nothing here: the Astro hook prints it once.
 * @returns {Promise<{ siteUrl: string, samples: string[], summary: string }>}
 */
async function preflightGate() {
  clearSiteMemo();
  const { model, diagnostics, samples } = await loadSiteMemoised();
  const errors = diagnostics.filter((d) => d.level === 'error').length;
  if (errors > 0 || model === undefined) {
    for (const d of diagnostics) console.log(formatDiagnostic(d));
    for (const line of formatSampleList(samples)) console.log(line);
    console.log(summarise(diagnostics));
    console.error(`Content gate failed: ${errors} errors (listed above); nothing was built.`);
    process.exit(1);
  }
  return { siteUrl: model.site.url, samples: formatSampleList(samples), summary: summarise(diagnostics) };
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
  const distDir = args.outDir ?? resolve('dist');
  try {
    const gate = await preflightGate();
    const { build } = await import('astro');
    await build({ root: process.cwd(), outDir: distDir });

    // Samples and the dev-only fallback text are only forbidden where the data gate forbids them: strict, without --allow-samples.
    const checked = verifyOutput({ distDir, siteUrl: gate.siteUrl, samplesAllowed: args.allowSamples || !args.strict });
    for (const f of checked.findings) console.log(`${f.rule} ${f.file} ${f.selector} ${f.message}`);
    console.log(formatBudget(checked.budget));
    if (!checked.ok) {
      console.error(`Output checks failed: ${checked.findings.length} findings, ${checked.budget.failures.length} budget failures.`);
      process.exit(1);
    }
    precompress(distDir);
    const meta = makeBuildMeta({ strict: args.strict, samplesAllowed: args.allowSamples });
    writeFileSync(join(distDir, '.build-meta.json'), `${JSON.stringify(meta, null, 2)}\n`);
    for (const line of gate.samples) console.log(line);
    console.log(gate.summary);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
