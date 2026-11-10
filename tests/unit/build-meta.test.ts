import { describe, expect, it } from 'vitest';
import { isReleasable, parseBuildMeta, type BuildMeta } from '../../src/lib/build-meta.ts';

const ID = '20261109T120000Z-abc1234';
const COMMIT = 'abc1234' + '0123456789abcdef0123456789abcdef0'.slice(0, 33);

const good = (): BuildMeta => ({
  strict: true,
  samplesAllowed: false,
  commit: COMMIT,
  ref: 'main',
  source: 'ci',
  dirty: false,
  builtAt: '2026-11-09T12:00:00.000Z',
  astroVersion: '7.4.7',
});

describe('parseBuildMeta', () => {
  it('accepts a complete document', () => {
    expect(parseBuildMeta(good())).toEqual(good());
  });

  it.each(['ref', 'source', 'commit', 'strict', 'samplesAllowed', 'dirty', 'builtAt', 'astroVersion'] as const)(
    'throws naming the field when %s is missing',
    (key) => {
      const raw: Record<string, unknown> = { ...good() };
      delete raw[key];
      expect(() => parseBuildMeta(raw)).toThrow(new RegExp(`\\.build-meta\\.json.*${key}`, 's'));
    },
  );

  it('rejects an unknown source and non-object input', () => {
    expect(() => parseBuildMeta({ ...good(), source: 'laptop' })).toThrow(/source/);
    expect(() => parseBuildMeta(null)).toThrow(/\.build-meta\.json/);
    expect(() => parseBuildMeta('{}')).toThrow(/\.build-meta\.json/);
  });
});

describe('isReleasable', () => {
  it('is true for a strict, sample-free main build whose commit matches the id', () => {
    expect(COMMIT).toHaveLength(40);
    expect(isReleasable(good(), ID)).toBe(true);
  });

  it('is true for a 12-character id suffix', () => {
    expect(isReleasable({ ...good(), commit: 'abcdef012345' + '0'.repeat(28) }, '20261109T120000Z-abcdef012345')).toBe(true);
  });

  it.each([
    ['strict false', { strict: false }],
    ['samples allowed', { samplesAllowed: true }],
    ['ref is not main', { ref: 'feature-x' }],
    ['commit is short', { commit: 'abc1234' }],
    ['commit is "unknown"', { commit: 'unknown' }],
    ['commit is 41 hex characters', { commit: COMMIT + '0' }],
    ['commit has non-hex characters', { commit: 'abc1234' + 'g'.repeat(33) }],
    ['commit prefix differs from the id', { commit: 'def5678' + COMMIT.slice(7) }],
  ] as const)('is false when %s', (_name, override) => {
    expect(isReleasable({ ...good(), ...override }, ID)).toBe(false);
  });

  it.each([
    'abc1234',
    '20261109T120000Z',
    '20261109T120000Z-abc123',
    '20261109T120000Z-abc1234567890',
    '20261109T120000Z-ABC1234',
    '2026-11-09T12:00:00Z-abc1234',
    '',
  ])('is false for the malformed release id %j', (id) => {
    expect(isReleasable(good(), id)).toBe(false);
  });
});
