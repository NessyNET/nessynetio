import { describe, expect, it } from 'vitest';
import {
  formatDiagnostic,
  hasErrors,
  resolveLevel,
  type Diagnostic,
  type Rule,
} from '../../src/lib/content/diagnostics.ts';

const diag = (over: Partial<Diagnostic> = {}): Diagnostic => ({
  code: 'project/unknown-tag',
  level: 'warning',
  file: 'projects/minecraft/highland-pack.toml',
  message: "uses tag 'qol' which is not in categories.toml",
  ...over,
});

const rule = (over: Partial<Rule> = {}): Rule => ({
  code: 'project/unknown-tag',
  local: 'warning',
  strict: 'error',
  uxRow: 'Project tag not in its category config',
  message: ({ tag = '' }) => `uses tag '${tag}'`,
  ...over,
});

describe('formatDiagnostic', () => {
  it('prints LEVEL file [entry] field: message', () => {
    expect(formatDiagnostic(diag({ entry: 'highland-pack', field: 'tags' }))).toBe(
      "WARNING projects/minecraft/highland-pack.toml [highland-pack] tags: uses tag 'qol' which is not in categories.toml",
    );
  });

  it('omits the entry when absent', () => {
    expect(formatDiagnostic(diag({ field: 'tags' }))).toBe(
      "WARNING projects/minecraft/highland-pack.toml tags: uses tag 'qol' which is not in categories.toml",
    );
  });

  it('omits the field when absent (colon stays before the message)', () => {
    expect(formatDiagnostic(diag({ level: 'note', entry: 'terraria' }))).toBe(
      "NOTE projects/minecraft/highland-pack.toml [terraria]: uses tag 'qol' which is not in categories.toml",
    );
  });

  it('omits both and upper-cases every level', () => {
    expect(formatDiagnostic(diag({ level: 'error', message: 'bad' }))).toBe(
      'ERROR projects/minecraft/highland-pack.toml: bad',
    );
  });
});

describe('resolveLevel', () => {
  const off = { strict: false, allowSamples: false, isSample: false };

  it('uses the local level when not strict', () => {
    expect(resolveLevel(rule(), off)).toBe('warning');
  });

  it('uses the strict level when strict', () => {
    expect(resolveLevel(rule(), { ...off, strict: true })).toBe('error');
  });

  it('ignores the sample flags without sampleExempt', () => {
    expect(resolveLevel(rule(), { strict: true, allowSamples: true, isSample: true })).toBe('error');
  });

  it('sample exemption truth table: warning only when all four conditions hold', () => {
    const exempt = rule({ sampleExempt: true });
    for (const strict of [false, true]) {
      for (const allowSamples of [false, true]) {
        for (const isSample of [false, true]) {
          const all = strict && allowSamples && isSample;
          const expected = all ? 'warning' : strict ? 'error' : 'warning';
          expect(resolveLevel(exempt, { strict, allowSamples, isSample }), `${strict}/${allowSamples}/${isSample}`).toBe(
            expected,
          );
        }
      }
    }
    // The exemption is the only way a strict error becomes a warning: sampleExempt=false never does.
    expect(resolveLevel(rule({ sampleExempt: false }), { strict: true, allowSamples: true, isSample: true })).toBe('error');
  });

  it('exemption does not weaken a rule whose strict level is already a note', () => {
    const r = rule({ local: 'note', strict: 'note', sampleExempt: true });
    expect(resolveLevel(r, { strict: true, allowSamples: true, isSample: true })).toBe('warning');
  });
});

describe('hasErrors', () => {
  it('is true only when an error is present', () => {
    expect(hasErrors([])).toBe(false);
    expect(hasErrors([diag(), diag({ level: 'note' })])).toBe(false);
    expect(hasErrors([diag(), diag({ level: 'error' })])).toBe(true);
  });
});
