// scripts/release.mjs (design 3.6.5): the source check, the order of steps, and what is (not) uploaded. Everything
// external (git, npm, the build, rsync, ssh, the live site) is injected; nothing here touches a network or a server.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkOutput } from '../../scripts/check-output.mjs';
import { checkSource, evaluateSmoke, findSamplePaths, release, releaseId, smokeChecks } from '../../scripts/release.mjs';
import { withFixture } from '../helpers/content-fixture.ts';

const SHA = 'abc1234' + '0'.repeat(33);
const OTHER = 'def5678' + '0'.repeat(33);
const NOW = new Date('2026-11-09T12:34:56.789Z');
const ID = '20261109T123456Z-abc1234';

describe('checkSource, local (GITHUB_ACTIONS unset)', () => {
  const ok = { clean: true, branch: 'main', head: SHA, originMain: SHA, isAncestor: true };
  it('accepts a clean HEAD on main equal to origin/main', () => {
    expect(checkSource(ok, {})).toEqual([]);
  });
  it.each([
    ['a dirty work tree', { clean: false }, /clean/],
    ['a detached HEAD', { branch: null }, /detached|main/],
    ['a branch other than main', { branch: 'feature' }, /main/],
    ['unpushed commits (ahead of origin/main)', { originMain: OTHER }, /origin\/main/],
    ['a HEAD behind origin/main', { head: OTHER }, /origin\/main/],
  ])('refuses %s', (_name, change, message) => {
    const problems = checkSource({ ...ok, ...change }, {});
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(message);
  });
});

describe('checkSource, CI (GITHUB_ACTIONS=true)', () => {
  const env = { GITHUB_ACTIONS: 'true', DEPLOY_SHA: SHA };
  const ok = { clean: true, branch: null, head: SHA, originMain: OTHER, isAncestor: true };
  it('accepts a clean detached HEAD equal to DEPLOY_SHA and an ancestor of origin/main', () => {
    expect(checkSource(ok, env)).toEqual([]);
  });
  it.each([
    ['a dirty work tree', { clean: false }, env, /clean/],
    ['a HEAD different from DEPLOY_SHA', { head: OTHER }, env, /DEPLOY_SHA/],
    ['a commit that is not an ancestor of origin/main', { isAncestor: false }, env, /ancestor/],
    ['a missing DEPLOY_SHA', {}, { GITHUB_ACTIONS: 'true' }, /DEPLOY_SHA/],
  ])('refuses %s', (_name, change, e, message) => {
    const problems = checkSource({ ...ok, ...change }, e);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.join(' ')).toMatch(message);
  });
});

describe('releaseId', () => {
  it('is <UTC yyyymmddTHHMMSSZ>-<7 hex of the commit>', () => {
    expect(releaseId(NOW, SHA)).toBe(ID);
    expect(releaseId(NOW, SHA)).toMatch(/^[0-9]{8}T[0-9]{6}Z-[0-9a-f]{7}$/);
  });
  it('rejects anything but a full lower-case sha', () => {
    expect(() => releaseId(NOW, 'abc1234')).toThrow(/sha/);
    expect(() => releaseId(NOW, 'unknown')).toThrow(/sha/);
  });
});

// --- the whole flow with fakes

const goodMeta = { strict: true, samplesAllowed: false, commit: SHA, ref: 'main', source: 'local', dirty: false, builtAt: NOW.toISOString(), astroVersion: '7.4.7' };
const deployEnv = { DEPLOY_HOST: 'host.example', DEPLOY_USER: 'deploy', DEPLOY_SSH_KEY_FILE: '/run/key', DEPLOY_KNOWN_HOSTS: '/run/known_hosts', DEPLOY_SSH_KEY: 'SECRET-KEY-MATERIAL' };
const cleanGit = { clean: true, branch: 'main', head: SHA, originMain: SHA, isAncestor: true };

interface Call { cmd: string; args: string[]; env: Record<string, string | undefined> | undefined }
function harness(over: { env?: NodeJS.ProcessEnv; argv?: string[]; gitState?: object; meta?: object; failOn?: (c: Call) => boolean; smoke?: (url: string) => { status: number; headers?: Record<string, string> } } = {}) {
  const calls: Call[] = [];
  const logs: string[] = [];
  const fetched: string[] = [];
  const run = (cmd: string, args: string[], opts?: { env?: Record<string, string | undefined> }): { status: number | null } => {
    const call = { cmd, args, env: opts?.env };
    calls.push(call);
    return { status: over.failOn?.(call) ? 1 : 0 };
  };
  const goodSmoke = (url: string): { status: number; headers?: Record<string, string> } => {
    const secure = { 'content-security-policy': "default-src 'self'", 'strict-transport-security': 'max-age=31536000' };
    if (url === 'https://www.nessynet.io/') return { status: 301, headers: { location: 'https://nessynet.io/' } };
    if (url.endsWith('/ffxiv')) return { status: 301, headers: { location: '/ffxiv/' } };
    if (url.includes('__nope__')) return { status: 404, headers: secure };
    return { status: 200, headers: secure };
  };
  const fetchFn = async (url: string) => {
    fetched.push(url);
    const r: { status: number; headers?: Record<string, string> } = (over.smoke ?? goodSmoke)(url);
    return { status: r.status, headers: { get: (name: string) => r.headers?.[name.toLowerCase()] ?? null } };
  };
  const deps = {
    argv: over.argv ?? [],
    env: { ...deployEnv, ...over.env },
    git: () => ({ ...cleanGit, ...over.gitState }),
    run,
    fetchFn,
    readMeta: () => ({ ...goodMeta, ...over.meta }),
    samplePaths: () => ({ category: '/ffxiv', project: '/ffxiv/loch-lantern/' }),
    now: () => NOW,
    log: (line: string) => logs.push(line),
  };
  return { deps, calls, logs, fetched };
}
const cmds = (calls: Call[]) => calls.map((c) => [c.cmd, ...c.args].join(' '));

describe('release: refusals stop before anything runs', () => {
  it.each([
    ['--allow-samples', ['--allow-samples']],
    ['--allow-samples=true', ['--allow-samples=true']],
    ['a mixed-case form', ['--Allow-Samples']],
  ])('refuses %s in any form', async (_name, argv) => {
    const h = harness({ argv });
    await expect(release(h.deps)).rejects.toThrow(/allow-samples/i);
    expect(h.calls).toEqual([]);
  });

  it('refuses a bad source without running npm, the build or rsync', async () => {
    const h = harness({ gitState: { branch: 'feature' } });
    await expect(release(h.deps)).rejects.toThrow(/source check/i);
    expect(h.calls).toEqual([]);
  });

  it.each(['DEPLOY_HOST', 'DEPLOY_SSH_KEY_FILE', 'DEPLOY_KNOWN_HOSTS'])('refuses a missing %s before running anything', async (name) => {
    const h = harness({ env: { [name]: undefined } });
    await expect(release(h.deps)).rejects.toThrow(new RegExp(name));
    expect(h.calls).toEqual([]);
  });

  it('refuses a key file path that would break the ssh command line', async () => {
    const h = harness({ env: { DEPLOY_SSH_KEY_FILE: '/run/my key' } });
    await expect(release(h.deps)).rejects.toThrow(/DEPLOY_SSH_KEY_FILE/);
  });
});

describe('release: the happy path', () => {
  it('runs npm test, then a strict build for release, then rsync, activate and the smoke checks, in that order', async () => {
    const h = harness();
    await release(h.deps);
    const [test, build, rsync, activate] = h.calls;
    expect([test?.cmd, test?.args]).toEqual(['npm', ['test']]);
    expect([build?.cmd, build?.args]).toEqual(['node', ['scripts/build.mjs', '--strict']]);
    expect(build?.env).toMatchObject({ NESSY_RELEASE_REF: 'main', NESSY_RELEASE_SOURCE: 'local' });
    expect(rsync?.cmd).toBe('rsync');
    expect(rsync?.args.slice(-2)).toEqual(['dist/', `deploy@host.example:${ID}/`]);
    expect(cmds([activate!])[0]).toMatch(new RegExp(`^ssh .* deploy@host\\.example activate ${ID}$`));
    expect(h.calls).toHaveLength(4);
    expect(h.fetched).toHaveLength(5);
  });

  it('records source ci under GitHub Actions', async () => {
    const h = harness({ env: { GITHUB_ACTIONS: 'true', DEPLOY_SHA: SHA }, gitState: { branch: null, originMain: OTHER } });
    await release(h.deps);
    expect(h.calls[1]?.env).toMatchObject({ NESSY_RELEASE_REF: 'main', NESSY_RELEASE_SOURCE: 'ci' });
  });

  it('never passes --allow-samples to the build, and pins host keys on rsync and ssh', async () => {
    const h = harness();
    await release(h.deps);
    expect(cmds(h.calls).join('\n')).not.toMatch(/allow-samples/);
    for (const call of h.calls.slice(2)) {
      const line = [call.cmd, ...call.args].join(' ');
      expect(line).toContain('StrictHostKeyChecking=yes');
      expect(line).toContain('UserKnownHostsFile=/run/known_hosts');
      expect(line).toContain('-i /run/key');
    }
    expect(h.calls[2]?.args).not.toContain('--link-dest');
  });

  it('does not put secret values in any command or log line', async () => {
    const h = harness();
    await release(h.deps);
    expect(JSON.stringify(h.calls.map((c) => [c.cmd, c.args]))).not.toContain('SECRET-KEY-MATERIAL');
    expect(h.logs.join('\n')).not.toContain('SECRET-KEY-MATERIAL');
  });
});

describe('release: failures', () => {
  it('a failing npm test stops before the build', async () => {
    const h = harness({ failOn: (c) => c.cmd === 'npm' });
    await expect(release(h.deps)).rejects.toThrow(/npm test/);
    expect(h.calls).toHaveLength(1);
  });

  it('a failing build stops before any upload', async () => {
    const h = harness({ failOn: (c) => c.cmd === 'node' });
    await expect(release(h.deps)).rejects.toThrow(/build/);
    expect(cmds(h.calls).some((l) => l.startsWith('rsync') || l.startsWith('ssh'))).toBe(false);
  });

  it('a meta that is not releasable stops before the upload', async () => {
    for (const meta of [{ ref: 'local:main' }, { strict: false }, { samplesAllowed: true }, { commit: OTHER }]) {
      const h = harness({ meta });
      await expect(release(h.deps), JSON.stringify(meta)).rejects.toThrow(/releasable/);
      expect(cmds(h.calls).some((l) => l.startsWith('rsync') || l.startsWith('ssh'))).toBe(false);
    }
  });

  it('a failing upload or activation stops without a rollback of an unactivated release', async () => {
    const h = harness({ failOn: (c) => c.cmd === 'rsync' });
    await expect(release(h.deps)).rejects.toThrow(/upload/);
    expect(h.calls.map((c) => c.cmd)).toEqual(['npm', 'node', 'rsync']);
  });

  it('a failing smoke check rolls back and fails', async () => {
    const h = harness({ smoke: (url) => (url.includes('__nope__') ? { status: 200 } : { status: 200, headers: {} }) });
    await expect(release(h.deps)).rejects.toThrow(/smoke/i);
    expect(cmds(h.calls).at(-1)).toMatch(/ssh .* deploy@host\.example rollback$/);
  });
});

describe('a deliberate strict error does not publish (R25 acceptance)', () => {
  const made: string[] = [];
  afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

  it('the real strict build fails on a warning-only fixture, so nothing is uploaded', async () => {
    mkdirSync('.builds', { recursive: true });
    const out = join(resolve('.builds'), `release-strict-${process.pid}`);
    made.push(out);
    const h = harness();
    const { VITEST: _v, ...env } = process.env;
    await withFixture('project__unknown-tag', async (content) => {
      // Same build command as the release, pointed at the bad content and a scratch output.
      h.deps.run = (cmd, args, opts): { status: number | null } => {
        h.calls.push({ cmd, args, env: opts?.env });
        if (cmd !== 'node') return { status: 0 };
        return spawnSync(process.execPath, [...args, '--content', content, '--out', out], { encoding: 'utf8', env: { ...env, ...opts?.env } });
      };
      await expect(release(h.deps)).rejects.toThrow(/build/);
    });
    expect(cmds(h.calls).some((l) => l.startsWith('rsync') || l.startsWith('ssh'))).toBe(false);
  }, 240_000);
});

describe('smoke checks', () => {
  it('cover the design 3.6.5 list: home, 404, a project, www redirect, category redirect, CSP and HSTS', () => {
    const checks = smokeChecks({ category: '/ffxiv', project: '/ffxiv/loch-lantern/' });
    expect(checks.map((c) => [c.url, c.status])).toEqual(expect.arrayContaining([
      ['https://nessynet.io/', 200],
      ['https://nessynet.io/__nope__/', 404],
      ['https://nessynet.io/ffxiv/loch-lantern/', 200],
      ['https://www.nessynet.io/', 301],
      ['https://nessynet.io/ffxiv', 301],
    ]));
    expect(checks.find((c) => c.url === 'https://www.nessynet.io/')?.location).toBe('https://nessynet.io/');
    expect(checks.find((c) => c.url === 'https://nessynet.io/ffxiv')?.location).toBe('/ffxiv/');
    for (const url of ['https://nessynet.io/', 'https://nessynet.io/__nope__/']) {
      expect(checks.find((c) => c.url === url)?.headers).toEqual(['content-security-policy', 'strict-transport-security']);
    }
  });

  it('evaluateSmoke reports the failing checks with what was expected and seen', async () => {
    const checks = smokeChecks({ category: '/ffxiv', project: '/ffxiv/x/' });
    const fetchFn = async (url: string) => ({ status: url === 'https://nessynet.io/' ? 500 : 200, headers: { get: () => null } });
    const failures = await evaluateSmoke(checks, fetchFn);
    expect(failures.length).toBeGreaterThan(1);
    expect(failures.find((f) => f.includes('https://nessynet.io/ '))).toMatch(/expected 200, got 500/);
  });

  it('findSamplePaths takes the first category and project from the built output', () => {
    mkdirSync('.builds', { recursive: true });
    const dist = mkdtempSync(join(resolve('.builds'), 'sample-paths-'));
    try {
      for (const p of ['_astro', 'og', 'bookmarks', 'linux/tool-a', 'linux/tool-b', 'zeta']) mkdirSync(join(dist, p), { recursive: true });
      for (const p of ['index.html', 'bookmarks/index.html', 'linux/index.html', 'linux/tool-a/index.html', 'linux/tool-b/index.html', 'zeta/index.html']) writeFileSync(join(dist, p), '');
      expect(findSamplePaths(dist)).toEqual({ category: '/linux', project: '/linux/tool-a/' });
    } finally {
      rmSync(dist, { recursive: true, force: true });
    }
  });
});

describe('the holding page', () => {
  it('has no inline script or style, no style attribute, no handler, and no external reference', () => {
    const findings = checkOutput({ distDir: resolve('deploy/holding'), siteUrl: 'https://nessynet.io', samplesAllowed: false });
    expect(findings.filter((f) => f.rule === 'O6')).toEqual([]);
    expect(findings.filter((f) => f.rule === 'O1')).toEqual([]);
  });
});
