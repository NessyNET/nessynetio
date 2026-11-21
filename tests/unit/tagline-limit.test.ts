// The whoami tagline limit counts rendered characters, markup excluded: 80 passes, 81 warns (ux 7.12).
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/content/load.ts';
import { applyRules } from '../../src/lib/content/rules.ts';
import { SITE_HOST, withFixture } from '../helpers/content-fixture.ts';

async function taglineDiagnostics(tagline: string): Promise<string[]> {
  return withFixture('_base', async (dir) => {
    const path = join(dir, 'site.toml');
    await writeFile(path, (await readFile(path, 'utf8')).replace(/^tagline = .*$/m, `tagline = ${JSON.stringify(tagline)}`));
    const loaded = await loadContent(dir);
    const result = await applyRules(loaded.parsed, { strict: false, allowSamples: false, siteHost: SITE_HOST, contentDir: dir });
    return [...loaded.diagnostics, ...result.diagnostics].filter((d) => d.code === 'whoami/tagline-long').map((d) => d.message);
  });
}

describe('whoami/tagline-long', () => {
  it('passes at 80 rendered characters, even when markup makes the source longer', async () => {
    expect(await taglineDiagnostics(`*${'a'.repeat(40)}*{green} ${'b'.repeat(39)}`)).toEqual([]);
  });

  it('warns at 81 and says the limit is 80', async () => {
    expect(await taglineDiagnostics(`*${'a'.repeat(40)}*{green} ${'b'.repeat(40)}`)).toEqual(['tagline renders 81 characters; at most 80 are expected']);
  });
});
