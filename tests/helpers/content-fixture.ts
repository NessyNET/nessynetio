// Overlays a validation fixture directory on the `_base` content tree in a temp dir (plan section 8).
import { cp, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Diagnostic } from '../../src/lib/content/diagnostics.ts';
import { loadContent, type ParsedSite } from '../../src/lib/content/load.ts';
import { applyRules } from '../../src/lib/content/rules.ts';

export const VALIDATION_DIR = fileURLToPath(new URL('../fixtures/validation/', import.meta.url));

export interface FixtureExpectation {
  /** Defaults to the directory name with `__` read as `/`. */
  readonly code?: string;
  readonly local: ExpectedDiagnostic | null;
  readonly strict: ExpectedDiagnostic | null;
  readonly flags?: { readonly allowSamples?: boolean };
  /** Names a fallback assertion in `rules-fallbacks.test.ts`. */
  readonly resolvedCheck?: string;
}

export interface ExpectedDiagnostic {
  readonly level: 'error' | 'warning' | 'note';
  readonly file: string;
  readonly entry?: string;
  readonly field?: string;
}

/** Names of every fixture directory except `_base`, sorted. */
export async function fixtureNames(): Promise<string[]> {
  const entries = await readdir(VALIDATION_DIR, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory() && e.name !== '_base').map((e) => e.name).sort();
}

/** Copies `_base`, then the named fixture's files over it (`expect.json` excluded), runs `fn(dir)` and cleans up. */
export async function withFixture<T>(name: string, fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), 'nessy-fixture-'));
  try {
    await cp(join(VALIDATION_DIR, '_base'), dir, { recursive: true });
    if (name !== '_base') {
      await cp(join(VALIDATION_DIR, name), dir, { recursive: true, filter: (src) => !src.endsWith('expect.json') });
    }
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export const SITE_HOST = 'nessynet.io';

export interface Validated {
  readonly diagnostics: Diagnostic[];
  readonly parsed: ParsedSite;
  readonly resolved: ParsedSite;
}

/** Load plus rules over a fixture, as `loadSite` composes them: load diagnostics first, then the rules pass. */
export async function validateFixture(name: string, mode: { strict: boolean; allowSamples?: boolean }): Promise<Validated> {
  return withFixture(name, async (dir) => {
    const loaded = await loadContent(dir);
    const result = await applyRules(loaded.parsed, { strict: mode.strict, allowSamples: mode.allowSamples ?? false, siteHost: SITE_HOST, contentDir: dir });
    return { diagnostics: [...loaded.diagnostics, ...result.diagnostics], parsed: loaded.parsed, resolved: result.resolved };
  });
}
