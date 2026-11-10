import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBuildArgs } from '../../scripts/build.mjs';

describe('parseBuildArgs', () => {
  it('defaults to non-strict, no samples, ./content', () => {
    expect(parseBuildArgs([])).toEqual({
      strict: false,
      allowSamples: false,
      contentDir: resolve('content'),
    });
  });

  it('reads all flags and resolves the content dir to an absolute path', () => {
    const args = parseBuildArgs(['--strict', '--allow-samples', '--content', 'tests/fixtures/x']);
    expect(args).toEqual({
      strict: true,
      allowSamples: true,
      contentDir: resolve('tests/fixtures/x'),
    });
  });

  it('throws on an unknown flag', () => {
    expect(() => parseBuildArgs(['--fast'])).toThrow(/--fast/);
  });

  it('throws when --content has no value', () => {
    expect(() => parseBuildArgs(['--content'])).toThrow(/--content/);
  });
});
