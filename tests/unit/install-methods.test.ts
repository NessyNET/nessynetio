// The install-method rules on a Linux tool (ux 7.12): what makes a method with no command valid or empty, and which
// text is checked for an unclosed backtick. Each case rewrites the install list of one validation fixture.
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/lib/content/load.ts';
import { applyRules } from '../../src/lib/content/rules.ts';
import { SITE_HOST, withFixture } from '../helpers/content-fixture.ts';

const FILE = 'projects/tools/lochctl.toml';
const WITH_METHODS = /install = \[[\s\S]*?\n\]\n/;

/** Diagnostics (code and field) for lochctl with the given TOML inline tables as its install methods. */
async function diagnosticsFor(methods: string[], strict = false): Promise<string[]> {
  return withFixture('project__install-method-empty', async (dir) => {
    const path = join(dir, FILE);
    const toml = (await readFile(path, 'utf8')).replace(WITH_METHODS, `install = [\n${methods.map((m) => `  ${m},`).join('\n')}\n]\n`);
    await writeFile(path, toml);
    const loaded = await loadContent(dir);
    const result = await applyRules(loaded.parsed, { strict, allowSamples: false, siteHost: SITE_HOST, contentDir: dir });
    return [...loaded.diagnostics, ...result.diagnostics].filter((d) => d.code.startsWith('project/install-')).map((d) => `${d.code} ${d.field ?? ''}`.trim());
  });
}

describe('project/install-method-empty', () => {
  it('accepts a method with a command only', async () => {
    expect(await diagnosticsFor(['{ method = "cargo", command = "cargo install x" }'])).toEqual([]);
  });

  it('accepts a manual method with steps only', async () => {
    expect(await diagnosticsFor(['{ method = "VS Code", steps = ["Open the Extensions view."] }'])).toEqual([]);
  });

  it('accepts a manual method with a note only', async () => {
    expect(await diagnosticsFor(['{ method = "VS Code", note = "Install it from the marketplace." }'])).toEqual([]);
  });

  it('rejects a method with nothing, an empty steps list, or a whitespace-only note', async () => {
    const empty = ['project/install-method-empty linux.install[0]'];
    expect(await diagnosticsFor(['{ method = "A" }'])).toEqual(empty);
    expect(await diagnosticsFor(['{ method = "A", steps = [] }'])).toEqual(empty);
    expect(await diagnosticsFor(['{ method = "A", note = "   " }'])).toEqual(empty);
  });

  it('reports each empty method by its index, in both modes', async () => {
    const methods = ['{ method = "ok", command = "x" }', '{ method = "A" }', '{ method = "B", note = " " }'];
    const both = ['project/install-method-empty linux.install[1]', 'project/install-method-empty linux.install[2]'];
    expect(await diagnosticsFor(methods)).toEqual(both);
    expect(await diagnosticsFor(methods, true)).toEqual(both);
  });
});

describe('project/install-text-backtick', () => {
  it('flags an unclosed backtick in a note, by the note field', async () => {
    expect(await diagnosticsFor(['{ method = "A", command = "x", note = "Add `include x." }'])).toEqual(['project/install-text-backtick linux.install[0].note']);
  });

  it('flags an unclosed backtick in a step, by the step index', async () => {
    expect(await diagnosticsFor(['{ method = "A", steps = ["Fine.", "Open `the folder."] }'])).toEqual(['project/install-text-backtick linux.install[0].steps[1]']);
  });

  it('accepts closed and escaped backticks in both', async () => {
    expect(await diagnosticsFor(['{ method = "A", steps = ["Copy `a`."], note = "Type \\\\` then `b`." }'])).toEqual([]);
  });
});
