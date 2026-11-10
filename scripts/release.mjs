// `npm run deploy` (design 3.6.5): check the release source, build strict, upload a full release over the restricted
// deploy key, activate it through the server-side guard, smoke-test, and roll back on failure. Run by CI and usable
// locally with the same key model. Secrets only ever travel as file paths (DEPLOY_SSH_KEY_FILE, DEPLOY_KNOWN_HOSTS);
// no key material is read or logged here.
//
// Environment: DEPLOY_HOST, DEPLOY_SSH_KEY_FILE, DEPLOY_KNOWN_HOSTS (required); DEPLOY_USER (default `deploy`);
// GITHUB_ACTIONS and DEPLOY_SHA (CI mode).
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isReleasable, parseBuildMeta } from '../src/lib/build-meta.ts';

const SITE = 'https://nessynet.io';
const WWW = 'https://www.nessynet.io';
const DIST = 'dist';
const SMOKE_TIMEOUT_MS = 10_000;
const SECURITY_HEADERS = ['content-security-policy', 'strict-transport-security'];
const FULL_SHA = /^[0-9a-f]{40}$/;

/**
 * @typedef {{ clean: boolean, branch: string | null, head: string, originMain: string, isAncestor: boolean }} GitState
 * `branch` is the symbolic ref's short name, or null when HEAD is detached.
 */

/**
 * Source check (design 3.6.5 step 1). Returns the reasons to refuse; empty means the source may be released.
 * @param {GitState} state @param {NodeJS.ProcessEnv} env @returns {string[]}
 */
export function checkSource(state, env) {
  /** @type {string[]} */
  const problems = [];
  if (!state.clean) problems.push('the work tree is not clean');
  if (env['GITHUB_ACTIONS'] === 'true') {
    const deploySha = env['DEPLOY_SHA'];
    if (deploySha === undefined || deploySha === '') problems.push('DEPLOY_SHA is not set');
    else if (state.head !== deploySha) problems.push(`HEAD (${state.head.slice(0, 7)}) is not DEPLOY_SHA (${deploySha.slice(0, 7)})`);
    if (!state.isAncestor) problems.push('HEAD is not an ancestor of origin/main');
  } else {
    if (state.branch === null) problems.push('HEAD is detached; a local release comes from the branch main');
    else if (state.branch !== 'main') problems.push(`HEAD is on branch ${state.branch}, not main`);
    if (state.head !== state.originMain) problems.push('HEAD is not origin/main (unpushed or behind-remote commits)');
  }
  return problems;
}

/** `<UTC yyyymmddTHHMMSSZ>-<7 hex of the commit>`. @param {Date} date @param {string} fullSha */
export function releaseId(date, fullSha) {
  if (!FULL_SHA.test(fullSha)) throw new Error(`release id needs a full lower-case sha, got "${fullSha}"`);
  const stamp = date.toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  return `${stamp}-${fullSha.slice(0, 7)}`;
}

/** @typedef {{ url: string, status: number, location?: string, headers?: string[] }} SmokeCheck */

/**
 * The checks after activation (design 3.6.5 step 5).
 * @param {{ category: string, project: string }} paths site paths found in the build, e.g. `/ffxiv` and `/ffxiv/x/`
 * @returns {SmokeCheck[]}
 */
export function smokeChecks({ category, project }) {
  return [
    { url: `${SITE}/`, status: 200, headers: SECURITY_HEADERS },
    { url: `${SITE}/__nope__/`, status: 404, headers: SECURITY_HEADERS },
    { url: `${SITE}${project}`, status: 200 },
    { url: `${WWW}/`, status: 301, location: `${SITE}/` },
    { url: `${SITE}${category}`, status: 301, location: `${category}/` },
  ];
}

/**
 * @param {SmokeCheck[]} checks
 * @param {(url: string, init: { redirect: 'manual', signal: AbortSignal }) => Promise<{ status: number, headers: { get(name: string): string | null } }>} fetchFn
 * @returns {Promise<string[]>} one line per failed expectation
 */
export async function evaluateSmoke(checks, fetchFn) {
  /** @type {string[]} */
  const failures = [];
  for (const check of checks) {
    let response;
    try {
      response = await fetchFn(check.url, { redirect: 'manual', signal: AbortSignal.timeout(SMOKE_TIMEOUT_MS) });
    } catch (error) {
      failures.push(`${check.url} request failed: ${error instanceof Error ? error.message : error}`);
      continue;
    }
    if (response.status !== check.status) failures.push(`${check.url} expected ${check.status}, got ${response.status}`);
    if (check.location !== undefined && response.headers.get('location') !== check.location) {
      failures.push(`${check.url} expected Location ${check.location}, got ${response.headers.get('location')}`);
    }
    for (const header of check.headers ?? []) {
      if (response.headers.get(header) === null) failures.push(`${check.url} is missing the ${header} header`);
    }
  }
  return failures;
}

/** The first category and its first project in the built output. @param {string} distDir */
export function findSamplePaths(distDir) {
  /** @param {string} dir @returns {string[]} */
  const pages = (dir) =>
    readdirSync(dir)
      .filter((name) => !name.startsWith('.') && statSync(join(dir, name)).isDirectory() && existsSync(join(dir, name, 'index.html')))
      .sort();
  for (const category of pages(distDir)) {
    if (['_astro', 'og', 'bookmarks'].includes(category)) continue;
    const [first] = pages(join(distDir, category));
    if (first !== undefined) return { category: `/${category}`, project: `/${category}/${first}/` };
  }
  throw new Error(`no category with a project page found in ${distDir}`);
}

// --- Orchestration

/**
 * @typedef {object} Deps
 * @property {string[]} argv
 * @property {NodeJS.ProcessEnv} env
 * @property {() => GitState} git reads the repository (fetching origin/main first)
 * @property {(cmd: string, args: string[], opts?: { env?: Record<string, string | undefined> }) => { status: number | null }} run
 * @property {Parameters<typeof evaluateSmoke>[1]} fetchFn
 * @property {() => unknown} readMeta the parsed `dist/.build-meta.json`
 * @property {() => { category: string, project: string }} samplePaths
 * @property {() => Date} now
 * @property {(line: string) => void} log
 */

/** @param {NodeJS.ProcessEnv} env @param {string} name @param {RegExp} shape */
function required(env, name, shape) {
  const value = env[name];
  if (value === undefined || value === '') throw new Error(`${name} is not set`);
  if (!shape.test(value)) throw new Error(`${name} has an unexpected shape`);
  return value;
}

/** @param {Deps} deps */
export async function release(deps) {
  const { argv, env, run, log } = deps;
  if (argv.some((arg) => /allow-samples/i.test(arg))) throw new Error('--allow-samples is never allowed for a release');

  const host = required(env, 'DEPLOY_HOST', /^[A-Za-z0-9.-]+$/);
  const user = env['DEPLOY_USER'] ?? 'deploy';
  if (!/^[a-z_][a-z0-9_-]*$/.test(user)) throw new Error('DEPLOY_USER has an unexpected shape');
  const keyFile = required(env, 'DEPLOY_SSH_KEY_FILE', /^[A-Za-z0-9_./~+-]+$/);
  const knownHosts = required(env, 'DEPLOY_KNOWN_HOSTS', /^[A-Za-z0-9_./~+-]+$/);

  const state = deps.git();
  const problems = checkSource(state, env);
  if (problems.length > 0) throw new Error(`source check failed: ${problems.join('; ')}`);
  log('source check passed');

  const ssh = ['-i', keyFile, '-o', 'IdentitiesOnly=yes', '-o', 'StrictHostKeyChecking=yes', '-o', `UserKnownHostsFile=${knownHosts}`];
  const target = `${user}@${host}`;

  if (run('npm', ['test']).status !== 0) throw new Error('npm test failed; nothing was uploaded');
  const buildEnv = { NESSY_RELEASE_REF: 'main', NESSY_RELEASE_SOURCE: env['GITHUB_ACTIONS'] === 'true' ? 'ci' : 'local' };
  if (run('node', ['scripts/build.mjs', '--strict'], { env: buildEnv }).status !== 0) throw new Error('strict build failed; nothing was uploaded');

  const meta = parseBuildMeta(deps.readMeta());
  // The id comes from the checked-out commit, so a build stamped with any other commit fails the releasable check.
  const id = releaseId(deps.now(), state.head);
  if (!isReleasable(meta, id)) throw new Error('the build meta is not releasable (needs strict, no samples, ref main, matching commit); nothing was uploaded');
  log(`release ${id}`);

  const shell = ['ssh', ...ssh].join(' ');
  if (run('rsync', ['-a', '-e', shell, `${DIST}/`, `${target}:${id}/`]).status !== 0) throw new Error('upload failed');
  if (run('ssh', [...ssh, target, 'activate', id]).status !== 0) throw new Error(`activation of ${id} was refused or failed; the previous release is still live`);
  log(`activated ${id}`);

  const failures = await evaluateSmoke(smokeChecks(deps.samplePaths()), deps.fetchFn);
  if (failures.length > 0) {
    for (const failure of failures) log(`smoke: ${failure}`);
    run('ssh', [...ssh, target, 'rollback']);
    throw new Error(`smoke checks failed; rolled back from ${id}`);
  }
  log('smoke checks passed');
  return id;
}

// --- Real dependencies

/** @param {...string} args @returns {{ status: number | null, stdout: string }} */
function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout.trim() };
}

/** @returns {GitState} */
function readGitState() {
  if (git('fetch', 'origin', 'main').status !== 0) throw new Error('git fetch origin main failed');
  const branch = git('symbolic-ref', '-q', '--short', 'HEAD');
  return {
    clean: git('status', '--porcelain').stdout === '',
    branch: branch.status === 0 ? branch.stdout : null,
    head: git('rev-parse', 'HEAD').stdout,
    originMain: git('rev-parse', 'refs/remotes/origin/main').stdout,
    isAncestor: git('merge-base', '--is-ancestor', 'HEAD', 'refs/remotes/origin/main').status === 0,
  };
}

async function main() {
  /** @type {Deps} */
  const deps = {
    argv: process.argv.slice(2),
    env: process.env,
    git: readGitState,
    run: (cmd, args, opts) => spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...opts?.env } }),
    fetchFn: (url, init) => fetch(url, init),
    readMeta: () => JSON.parse(readFileSync(join(resolve(DIST), '.build-meta.json'), 'utf8')),
    samplePaths: () => findSamplePaths(resolve(DIST)),
    now: () => new Date(),
    log: (line) => console.log(`deploy: ${line}`),
  };
  try {
    await release(deps);
  } catch (error) {
    console.error(`deploy: ${error instanceof Error ? error.message : error}`);
    process.exit(1);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
