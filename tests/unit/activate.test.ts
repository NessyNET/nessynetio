// deploy/activate (design 3.6.4): the server-side guard, exercised against a temp NESSY_ROOT. Needs bash and python3.
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = resolve('deploy/activate');
const SHA = 'abc1234' + '0'.repeat(33);
const id = (n: number, short = 'abc1234') => `20261109T1200${String(n).padStart(2, '0')}Z-${short}`;
const goodMeta = { strict: true, samplesAllowed: false, commit: SHA, ref: 'main', source: 'ci', dirty: false, builtAt: '2026-11-09T12:00:00.000Z', astroVersion: '7.4.7' };

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'activate-'));
  mkdirSync(join(root, 'releases'));
  mkdirSync(join(root, 'holding'));
  symlinkSync('holding', join(root, 'current'));
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const NO_META = Symbol('no .build-meta.json');
const release = (releaseId: string, meta: unknown = goodMeta, raw?: string) => {
  const dir = join(root, 'releases', releaseId);
  mkdirSync(dir, { recursive: true });
  if (meta !== NO_META) writeFileSync(join(dir, '.build-meta.json'), raw ?? JSON.stringify(meta));
  writeFileSync(join(dir, 'index.html'), releaseId);
};
const run = (...args: string[]) => spawnSync('bash', [SCRIPT, ...args], { encoding: 'utf8', env: { ...process.env, NESSY_ROOT: root } });
const current = () => readlinkSync(join(root, 'current'));
const releases = () => readdirSync(join(root, 'releases')).sort();

describe('activate <id>: refusals leave `current` untouched', () => {
  it.each([
    ['a missing .build-meta.json', () => release(id(1), NO_META), /\.build-meta\.json/],
    ['malformed JSON', () => release(id(1), null, '{not json'), /json/i],
    ['strict: false', () => release(id(1), { ...goodMeta, strict: false }), /strict/],
    ['samplesAllowed: true', () => release(id(1), { ...goodMeta, samplesAllowed: true }), /samplesAllowed/],
    ['ref other than main', () => release(id(1), { ...goodMeta, ref: 'feature' }), /ref/],
    ['a local ref', () => release(id(1), { ...goodMeta, ref: 'local:main' }), /ref/],
    ['a short commit', () => release(id(1), { ...goodMeta, commit: 'abc1234' }), /commit/],
    ['an upper-case commit', () => release(id(1), { ...goodMeta, commit: SHA.toUpperCase() }), /commit/],
    ['a commit whose prefix differs from the id', () => release(id(1), { ...goodMeta, commit: 'def5678' + SHA.slice(7) }), /commit/],
    ['a string "true" instead of a boolean', () => release(id(1), { ...goodMeta, strict: 'true' }), /strict/],
    ['a non-object meta', () => release(id(1), ['x']), /meta/i],
  ])('%s', (_name, setup, message) => {
    setup();
    const result = run(id(1));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(message);
    expect(current()).toBe('holding');
  });

  it('refuses an id that is malformed, a path, or not a release', () => {
    for (const bad of ['../x', 'latest', '20261109T120001Z', `${id(1)}/../${id(2)}`]) expect(run(bad).status, bad).toBe(1);
    expect(run(id(9)).stderr).toMatch(/no such release/);
    expect(current()).toBe('holding');
  });

  it('refuses a release directory that is a symlink', () => {
    release(id(2));
    symlinkSync(id(2), join(root, 'releases', id(1)));
    expect(run(id(1)).status).toBe(1);
  });

  it('exits 2 on bad usage', () => {
    expect(run().status).toBe(2);
    expect(run(id(1), 'extra').status).toBe(2);
  });
});

describe('symlinks inside a release (nginx would follow them out of the release)', () => {
  const link = (releaseId: string, where: string, target = '/etc/passwd') => {
    const path = join(root, 'releases', releaseId, where);
    mkdirSync(join(path, '..'), { recursive: true });
    symlinkSync(target, path);
  };

  it.each([
    ['at the top level', 'leak'],
    ['nested in a directory', 'ffxiv/deep/leak'],
    ['a dotfile link', '.hidden-leak'],
    ['a link replacing a page', 'index.html.gz'],
  ])('refuses activating a release with a symlink %s', (_name, where) => {
    release(id(1));
    link(id(1), where);
    const result = run(id(1));
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/symlink/);
    expect(current()).toBe('holding');
  });

  it('refuses a directory symlink and a dangling one', () => {
    release(id(1));
    link(id(1), 'etc', '/etc');
    expect(run(id(1)).stderr).toMatch(/symlink/);
    rmSync(join(root, 'releases', id(1), 'etc'));
    link(id(1), 'gone', '/nonexistent/target');
    expect(run(id(1)).stderr).toMatch(/symlink/);
  });

  it('refuses rollback targets that contain a symlink, explicit or previous, and keeps the active release', () => {
    release(id(1));
    release(id(2));
    run(id(1));
    run(id(2));
    link(id(1), 'a/b/leak');
    for (const args of [['--rollback', id(1)], ['--rollback'], ['--previous']]) {
      const result = run(...args);
      expect(result.status, args.join(' ')).toBe(1);
      expect(result.stderr).toMatch(/symlink/);
      expect(current()).toBe(`releases/${id(2)}`);
    }
  });

  it('does not prune anything when it refuses for a symlink', () => {
    for (let n = 1; n <= 7; n++) release(id(n));
    link(id(7), 'leak');
    expect(run(id(7)).status).toBe(1);
    expect(releases()).toHaveLength(7);
  });

  it('still activates a clean release that has real directories and files', () => {
    release(id(1));
    mkdirSync(join(root, 'releases', id(1), 'ffxiv/loch-lantern'), { recursive: true });
    writeFileSync(join(root, 'releases', id(1), 'ffxiv/loch-lantern/index.html'), 'x');
    expect(run(id(1)).status).toBe(0);
  });
});

describe('activate <id>', () => {
  it('points `current` at the release with a relative symlink and leaves no temp link', () => {
    release(id(1));
    const result = run(id(1));
    expect(result.status, result.stderr).toBe(0);
    expect(current()).toBe(`releases/${id(1)}`);
    expect(lstatSync(join(root, 'current')).isSymbolicLink()).toBe(true);
    expect(existsSync(join(root, 'current.tmp'))).toBe(false);
    expect(result.stdout).toContain(id(1));
  });

  it('prunes to the newest 5 releases', () => {
    for (let n = 1; n <= 8; n++) release(id(n));
    expect(run(id(8)).status).toBe(0);
    expect(releases()).toEqual([4, 5, 6, 7, 8].map((n) => id(n)));
  });

  it('never prunes the active release, even when it is an old one activated again', () => {
    for (let n = 1; n <= 7; n++) release(id(n));
    expect(run(id(1)).status).toBe(0);
    expect(releases()).toEqual([1, 3, 4, 5, 6, 7].map((n) => id(n)));
    expect(current()).toBe(`releases/${id(1)}`);
  });

  it('does not delete anything when it refuses', () => {
    for (let n = 1; n <= 7; n++) release(id(n));
    release(id(8), { ...goodMeta, strict: false });
    expect(run(id(8)).status).toBe(1);
    expect(releases()).toHaveLength(8);
  });
});

describe('activate --rollback', () => {
  it('re-points to the previous release', () => {
    release(id(1));
    release(id(2));
    run(id(1));
    run(id(2));
    const result = run('--rollback');
    expect(result.status, result.stderr).toBe(0);
    expect(current()).toBe(`releases/${id(1)}`);
  });

  it('accepts --previous as the same thing (runbook wording)', () => {
    release(id(1));
    release(id(2));
    run(id(1));
    run(id(2));
    expect(run('--previous').status).toBe(0);
    expect(current()).toBe(`releases/${id(1)}`);
  });

  it('re-points to a given release', () => {
    for (const n of [1, 2, 3]) release(id(n));
    run(id(3));
    expect(run('--rollback', id(1)).status).toBe(0);
    expect(current()).toBe(`releases/${id(1)}`);
  });

  it('applies the same checks to the rollback target', () => {
    release(id(1), { ...goodMeta, samplesAllowed: true });
    release(id(2));
    run(id(2));
    expect(run('--rollback', id(1)).status).toBe(1);
    expect(current()).toBe(`releases/${id(2)}`);
  });

  it('fails with a clear message when there are no releases, or no earlier one', () => {
    const none = run('--rollback');
    expect(none.status).toBe(1);
    expect(none.stderr).toMatch(/no previous release/);
    release(id(1));
    run(id(1));
    const first = run('--rollback');
    expect(first.status).toBe(1);
    expect(first.stderr).toMatch(/no previous release/);
    expect(current()).toBe(`releases/${id(1)}`);
  });
});
