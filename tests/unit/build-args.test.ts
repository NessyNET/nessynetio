import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseBuildArgs } from '../../scripts/build.mjs';

describe('parseBuildArgs', () => {
  it('defaults to non-strict, no samples, ./content', () => {
    expect(parseBuildArgs([])).toEqual({
      strict: false,
      allowSamples: false,
      contentDir: resolve('content'),
      outDir: undefined,
    });
  });

  it('reads all flags and resolves the content dir to an absolute path', () => {
    const args = parseBuildArgs(['--strict', '--allow-samples', '--content', 'tests/fixtures/x']);
    expect(args).toEqual({
      strict: true,
      allowSamples: true,
      contentDir: resolve('tests/fixtures/x'),
      outDir: undefined,
    });
  });

  it('reads --out as an absolute output directory', () => {
    expect(parseBuildArgs(['--out', '.builds/038']).outDir).toBe(resolve('.builds/038'));
  });

  it('throws when --out has no value or is followed by another flag', () => {
    expect(() => parseBuildArgs(['--out'])).toThrow(/--out/);
    expect(() => parseBuildArgs(['--out', '--strict'])).toThrow(/--out/);
  });

  it('throws on an unknown flag', () => {
    expect(() => parseBuildArgs(['--fast'])).toThrow(/--fast/);
  });

  it('throws when --content has no value', () => {
    expect(() => parseBuildArgs(['--content'])).toThrow(/--content/);
  });

  it('throws when --content is followed by another flag instead of a directory', () => {
    expect(() => parseBuildArgs(['--content', '--strict'])).toThrow(/--content/);
  });
});
