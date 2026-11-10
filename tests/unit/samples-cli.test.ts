import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { withFixture } from '../helpers/content-fixture.ts';

const samples = (name: string) =>
  withFixture(name, async (dir) => spawnSync(process.execPath, ['scripts/samples.mjs', '--content', dir], { encoding: 'utf8' }));

describe('npm run samples (scripts/samples.mjs)', () => {
  it('prints one line per sample item and the count, exit 0', async () => {
    const result = await samples('r28-a-sample-allow');
    expect(result.status).toBe(0);
    const lines = result.stdout.trim().split('\n');
    expect(lines).toContain('projects/ffxiv/gear-tweaks.toml [gear-tweaks]: sample = true');
    expect(lines).toHaveLength(2);
    expect(lines.at(-1)).toBe('1 sample items');
  });

  it('prints 0 sample items for _base', async () => {
    const result = await samples('_base');
    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe('0 sample items');
  });

  it('rejects a flag given as the content directory', () => {
    const result = spawnSync(process.execPath, ['scripts/samples.mjs', '--content', '--strict'], { encoding: 'utf8' });
    expect(result.status).toBe(2);
  });
});
