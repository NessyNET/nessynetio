import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { formatDiagnostic, type Diagnostic } from '../../src/lib/content/diagnostics.ts';
import { RULES } from '../../src/lib/content/rules.ts';
import { fixtureNames, validateFixture, VALIDATION_DIR, type FixtureExpectation } from '../helpers/content-fixture.ts';

const expectation = async (name: string): Promise<FixtureExpectation> =>
  JSON.parse(await readFile(join(VALIDATION_DIR, name, 'expect.json'), 'utf8')) as FixtureExpectation;

const codeOf = (name: string, e: FixtureExpectation): string => e.code ?? name.replaceAll('__', '/');

const run = async (name: string, strict: boolean, allowSamples = false) => validateFixture(name, { strict, allowSamples });

const names = await fixtureNames();
const expectations = new Map(await Promise.all(names.map(async (n) => [n, await expectation(n)] as const)));

describe('rules table', () => {
  it('has unique codes and a ux row quote for each', () => {
    expect(new Set(RULES.map((r) => r.code)).size).toBe(RULES.length);
    for (const rule of RULES) expect(rule.uxRow.length, rule.code).toBeGreaterThan(5);
  });

  it('has a fixture directory for every rule code', () => {
    const covered = new Set([...expectations].map(([n, e]) => codeOf(n, e)));
    expect(RULES.map((r) => r.code).filter((c) => !covered.has(c))).toEqual([]);
  });

  it('has a table row for every code a fixture names', () => {
    const codes = new Set(RULES.map((r) => r.code));
    expect([...expectations].map(([n, e]) => codeOf(n, e)).filter((c) => !codes.has(c))).toEqual([]);
  });

  it('local and strict levels in the table are the ones the fixtures expect (fixtures without flags)', () => {
    const byCode = new Map(RULES.map((r) => [r.code, r]));
    for (const [name, e] of expectations) {
      if (e.flags !== undefined || e.local === null || e.strict === null) continue;
      const rule = byCode.get(codeOf(name, e))!;
      expect([name, e.local.level, e.strict.level]).toEqual([name, rule.local, rule.strict]);
    }
  });
});

describe('_base', () => {
  it.each([false, true])('has no diagnostics (strict = %s)', async (strict) => {
    const { diagnostics } = await run('_base', strict);
    expect(diagnostics.map(formatDiagnostic)).toEqual([]);
  });
});

describe.each(names)('fixture %s', (name) => {
  const matching = (diagnostics: Diagnostic[], code: string): Diagnostic[] => diagnostics.filter((d) => d.code === code);

  it.each(['local', 'strict'] as const)('%s mode', async (mode) => {
    const e = expectations.get(name)!;
    const { diagnostics } = await run(name, mode === 'strict', e.flags?.allowSamples === true);
    const found = matching(diagnostics, codeOf(name, e));
    const want = e[mode];
    if (want === null) {
      expect(found).toEqual([]);
      return;
    }
    expect(found, JSON.stringify(diagnostics)).toHaveLength(1);
    const { level, file, entry, field } = found[0]!;
    expect({ level, file, entry, field }).toEqual({ level: want.level, file: want.file, entry: want.entry, field: want.field });
  });
});

describe('message format', () => {
  it('every diagnostic from every fixture names its file, and entry and field wherever it has them', async () => {
    for (const name of ['_base', ...names]) {
      const e = expectations.get(name);
      for (const strict of [false, true]) {
        const { diagnostics } = await run(name, strict, e?.flags?.allowSamples === true);
        for (const d of diagnostics) {
          expect(d.file, `${name} ${d.code}`).not.toBe('');
          expect(d.message, `${name} ${d.code}`).not.toBe('');
          const line = formatDiagnostic(d);
          expect(line.startsWith(`${d.level.toUpperCase()} ${d.file}`), line).toBe(true);
          if (d.entry !== undefined) expect(line).toContain(`[${d.entry}]`);
          if (d.field !== undefined) expect(line).toContain(` ${d.field}: `);
        }
      }
    }
  });
});

describe('design 3.3 sample exemption rows (S16)', () => {
  const install = (ds: Diagnostic[]): Diagnostic[] => ds.filter((d) => d.code === 'project/install-without-repo-url');
  const samplePresent = (ds: Diagnostic[]): Diagnostic[] => ds.filter((d) => d.code === 'sample/present');
  const errors = (ds: Diagnostic[]): Diagnostic[] => ds.filter((d) => d.level === 'error');

  it('(a) sample plugin, install, no repo_url, strict + allow-samples: warnings only, the build passes', async () => {
    const { diagnostics } = await run('r28-a-sample-allow', true, true);
    expect(install(diagnostics).map((d) => d.level)).toEqual(['warning']);
    expect(samplePresent(diagnostics).map((d) => d.level)).toEqual(['warning']);
    expect(errors(diagnostics)).toEqual([]);
  });

  it('(b) the same under strict alone: errors for the sample item and the rule', async () => {
    const { diagnostics } = await run('r28-b-sample-strict', true, false);
    expect(install(diagnostics).map((d) => d.level)).toEqual(['error']);
    expect(samplePresent(diagnostics).map((d) => d.level)).toEqual(['error']);
  });

  it('(c) non-sample plugin, install, no repo_url, strict + allow-samples: error', async () => {
    const { diagnostics } = await run('r28-c-nonsample-allow', true, true);
    expect(install(diagnostics).map((d) => d.level)).toEqual(['error']);
    expect(samplePresent(diagnostics)).toEqual([]);
  });

  it('(d) non-sample, local: warning, and the install entry is dropped', async () => {
    const { diagnostics, resolved } = await run('r28-d-nonsample-local', false);
    expect(install(diagnostics).map((d) => d.level)).toEqual(['warning']);
    expect(errors(diagnostics)).toEqual([]);
    expect(resolved.projects.find((p) => p.data.slug === 'gear-tweaks')?.data.get).toEqual([]);
  });

  it('a sample note is listed locally and is not exempt without allow-samples under strict', async () => {
    expect(samplePresent((await run('sample__present', false)).diagnostics).map((d) => d.level)).toEqual(['note']);
    expect(samplePresent((await run('sample__present', true, true)).diagnostics).map((d) => d.level)).toEqual(['warning']);
    expect(samplePresent((await run('sample__present', true, false)).diagnostics).map((d) => d.level)).toEqual(['error']);
  });
});
