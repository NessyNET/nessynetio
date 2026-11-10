import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { VALIDATION_DIR, withFixture } from '../helpers/content-fixture.ts';

const SLOW = 180_000;

// The content gate stays silent under Vitest (which inherits into children), so the child must not look like Vitest.
const { VITEST: _vitest, ...childEnv } = process.env;
const build = (args: string[]) => spawnSync(process.execPath, ['scripts/build.mjs', ...args], { encoding: 'utf8', env: childEnv });
const buildFixture = (name: string, args: string[]) => withFixture(name, async (dir) => build([...args, '--content', dir]));

describe('node scripts/build.mjs (slow: runs Astro)', () => {
  it('passes on the _base content and prints the summary', () => {
    const result = build(['--content', `${VALIDATION_DIR}_base`]);
    expect(result.status, result.stdout + result.stderr).toBe(0);
    expect(result.stdout).toContain('0 errors, 0 warnings, 0 notes');
    expect(result.stdout).toContain('0 sample items');
  }, SLOW);

  it('fails with exit 1 and the formatted ERROR line on an error fixture, before rendering', async () => {
    const result = await buildFixture('project__screenshot-file', []);
    expect(result.status).toBe(1);
    expect(result.stdout).toMatch(/^ERROR projects\/ffxiv\/gear-tweaks\.toml \[gear-tweaks\] screenshots\[0\]\.file: /m);
    expect(result.stdout).toMatch(/1 errors, /);
    expect(result.stdout).not.toMatch(/generating static routes/);
  }, SLOW);

  it('--strict fails on a warning-only fixture', async () => {
    const local = await buildFixture('project__unknown-tag', []);
    expect(local.status, local.stdout + local.stderr).toBe(0);
    const strict = await buildFixture('project__unknown-tag', ['--strict']);
    expect(strict.status).toBe(1);
    expect(strict.stdout).toMatch(/^ERROR projects\/ffxiv\/gear-tweaks\.toml \[gear-tweaks\] tags\[2\]: /m);
  }, SLOW);

  it('exits 2 on a malformed argument list without building', () => {
    const result = build(['--content', '--strict']);
    expect(result.status).toBe(2);
  });
});
