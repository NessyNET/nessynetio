// The build wrapper's finishing steps (030): output checks, budget, precompression and `.build-meta.json`.
import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { parseBuildMeta } from '../../src/lib/build-meta.ts';
import { buildRef, verifyOutput } from '../../scripts/build.mjs';
import { withFixture } from '../helpers/content-fixture.ts';

const SLOW = 240_000;
// The content gate stays silent under Vitest (which inherits into children), so the child must not look like Vitest.
const { VITEST: _vitest, ...baseEnv } = process.env;
const { NESSY_RELEASE_REF: _ref, NESSY_RELEASE_SOURCE: _source, ...cleanEnv } = baseEnv;

mkdirSync('.builds', { recursive: true });
const outs: string[] = [];
const outDir = () => {
  const out = mkdtempSync(resolve('.builds', 'meta-write-'));
  outs.push(out);
  return out;
};
afterAll(() => outs.forEach((o) => rmSync(o, { recursive: true, force: true })));

const build = (args: string[], env: NodeJS.ProcessEnv = cleanEnv) => spawnSync(process.execPath, ['scripts/build.mjs', ...args], { encoding: 'utf8', env });
const readMeta = (out: string) => parseBuildMeta(JSON.parse(readFileSync(join(out, '.build-meta.json'), 'utf8')));
const git = (...args: string[]) => spawnSync('git', args, { encoding: 'utf8' }).stdout.trim();

describe('strict build of site-e2e', () => {
  const out = outDir();
  const result = build(['--strict', '--content', 'tests/fixtures/site-e2e', '--out', out]);

  it('succeeds and prints the budget table, then the sample list and summary last', () => {
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toMatch(/page\s+html\s+css\s+js\s+total/);
    expect(result.stdout).toMatch(/budget: ok/);
    expect(result.stdout.trim().split('\n').at(-1)).toMatch(/^\d+ errors, \d+ warnings, \d+ notes$/);
  }, SLOW);

  it('writes a valid .build-meta.json with the strict, non-sample, local facts', () => {
    const meta = readMeta(out);
    expect(meta).toMatchObject({ strict: true, samplesAllowed: false, source: 'local' });
    expect(meta.commit).toMatch(/^[0-9a-f]{40}$/);
    expect(meta.commit).toBe(git('rev-parse', 'HEAD'));
    expect(meta.ref).toMatch(/^local:.+/); // whatever the checkout: a branch or detached
    expect(meta.ref).not.toBe('main');
    expect(Number.isNaN(Date.parse(meta.builtAt))).toBe(false);
    expect(meta.builtAt).toMatch(/Z$/);
    expect(meta.astroVersion).toMatch(/^\d+\.\d+\.\d+/);
    expect(typeof meta.dirty).toBe('boolean');
  });

  it('precompresses: index.html.gz exists beside index.html', () => {
    expect(existsSync(join(out, 'index.html.gz'))).toBe(true);
  });
});

describe('buildRef', () => {
  it('is the release ref when the release script sets it', () => {
    expect(buildRef({ NESSY_RELEASE_REF: 'main' }, 'feature')).toBe('main');
  });

  it('is local:<branch> otherwise, so a build on main is never releasable', () => {
    expect(buildRef({}, 'main')).toBe('local:main');
    expect(buildRef({}, 'm4-scripts')).toBe('local:m4-scripts');
  });

  it('is local:detached on a detached checkout (git prints HEAD, or nothing outside git)', () => {
    expect(buildRef({}, 'HEAD')).toBe('local:detached');
    expect(buildRef({}, '')).toBe('local:detached');
  });
});

describe('release environment', () => {
  it('NESSY_RELEASE_REF and NESSY_RELEASE_SOURCE set ref and source', () => {
    const out = outDir();
    const result = build(['--strict', '--content', 'tests/fixtures/site-e2e', '--out', out], { ...cleanEnv, NESSY_RELEASE_REF: 'main', NESSY_RELEASE_SOURCE: 'ci' });
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readMeta(out)).toMatchObject({ ref: 'main', source: 'ci' });
  }, SLOW);

  it('an unknown source is refused', () => {
    const out = outDir();
    const result = build(['--strict', '--content', 'tests/fixtures/site-e2e', '--out', out], { ...cleanEnv, NESSY_RELEASE_SOURCE: 'laptop' });
    expect(result.status).toBe(1);
    expect(existsSync(join(out, '.build-meta.json'))).toBe(false);
  }, SLOW);
});

describe('samples', () => {
  it('--strict --allow-samples on content/ records samplesAllowed: true', () => {
    const out = outDir();
    const result = build(['--strict', '--allow-samples', '--out', out]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(readMeta(out)).toMatchObject({ strict: true, samplesAllowed: true });
  }, SLOW);

  it('--strict on content/ fails at the data gate, before anything is built', () => {
    const out = outDir();
    const result = build(['--strict', '--out', out]);
    expect(result.status).toBe(1);
    expect(existsSync(join(out, 'index.html'))).toBe(false);
  }, SLOW);
});

describe('a local (non-strict) build keeps the dev-only fallback text', () => {
  it('builds the stress fixture, where a dropped install entry shows "Not distributed yet", without an output-check failure', () => {
    const out = outDir();
    const result = build(['--content', 'tests/fixtures/site-stress', '--out', out]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).not.toMatch(/^O[0-9] /m);
    expect(readMeta(out)).toMatchObject({ strict: false, samplesAllowed: false });
  }, SLOW);
});

describe('content gate failure', () => {
  it('prints the diagnostics and the gate message only: no Astro hook error, no stack trace', async () => {
    const result = await withFixture('project__screenshot-file', async (dir) => build(['--content', dir, '--out', outDir()]));
    expect(result.status).toBe(1);
    const all = result.stdout + result.stderr;
    expect(all).toMatch(/^ERROR projects\/ffxiv\/gear-tweaks\.toml /m);
    expect(all).toMatch(/Content gate failed: 1 errors/);
    expect(all).not.toMatch(/unhandled error|astro:config:setup|\n\s+at /);
  }, SLOW);
});

describe('verifyOutput: any finding or hard budget failure stops the build', () => {
  const dist = mkdtempSync(resolve('.builds', 'verify-'));
  afterAll(() => rmSync(dist, { recursive: true, force: true }));
  const head = '<title>T</title><meta name="description" content="d"><link rel="canonical" href="https://nessynet.io/">'
    + ['og:title', 'og:description', 'og:url', 'og:image', 'og:image:width', 'og:image:height', 'og:image:alt']
      .map((p) => `<meta property="${p}" content="x">`).join('') + '<meta name="twitter:card" content="s">';

  it('is ok for a clean small page', () => {
    writeFileSync(join(dist, 'index.html'), `<!DOCTYPE html><html><head>${head}</head><body><p>hi</p></body></html>`);
    expect(verifyOutput({ distDir: dist, siteUrl: 'https://nessynet.io', samplesAllowed: false })).toMatchObject({ ok: true, findings: [], budget: { failures: [] } });
  });

  it('is not ok when the page is over the 100 KB hard limit', () => {
    writeFileSync(join(dist, 'index.html'), `<!DOCTYPE html><html><head>${head}</head><body><p>${randomBytes(140 * 1024).toString('base64')}</p></body></html>`);
    const result = verifyOutput({ distDir: dist, siteUrl: 'https://nessynet.io', samplesAllowed: false });
    expect(result.ok).toBe(false);
    expect(result.budget.failures[0]).toMatch(/hard limit/);
  });

  it('is not ok on an output finding', () => {
    writeFileSync(join(dist, 'index.html'), `<!DOCTYPE html><html><head>${head}</head><body><p style="color:red">x</p></body></html>`);
    const result = verifyOutput({ distDir: dist, siteUrl: 'https://nessynet.io', samplesAllowed: false });
    expect(result.ok).toBe(false);
    expect(result.findings.map((f) => f.rule)).toEqual(['O6']);
  });
});
