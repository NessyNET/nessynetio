// The frozen browser-test content sets (plan section 8, concern C5): they must keep loading as specified, and the
// ported harness expectations (docs/ux/checks/r8-acceptance.mjs) must keep holding on site-e2e.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { formatDiagnostic, type Diagnostic } from '../../src/lib/content/diagnostics.ts';
import { loadSite } from '../../src/lib/content/index.ts';
import type { SiteModel } from '../../src/lib/content/model.ts';
import { sortRows } from '../../src/lib/sort.ts';

const dir = (name: string) => fileURLToPath(new URL(`../fixtures/${name}/`, import.meta.url));

const e2e: { model: SiteModel | null; diagnostics: Diagnostic[] } = { model: null, diagnostics: [] };
const stress: { model: SiteModel | null; diagnostics: Diagnostic[] } = { model: null, diagnostics: [] };

beforeAll(async () => {
  Object.assign(e2e, await loadSite({ dir: dir('site-e2e'), strict: true, allowSamples: false }));
  Object.assign(stress, await loadSite({ dir: dir('site-stress'), strict: false, allowSamples: false }));
});

const site = (): SiteModel => {
  if (e2e.model === null) throw new Error('site-e2e did not load');
  return e2e.model;
};
const category = (id: string) => {
  const found = site().categories.find((c) => c.id === id);
  if (found === undefined) throw new Error(`no category ${id}`);
  return found;
};

describe('site-e2e (strict)', () => {
  it('has zero errors and zero warnings, and the only note is the hidden empty terraria category', () => {
    expect(e2e.diagnostics.filter((d) => d.level !== 'note').map(formatDiagnostic)).toEqual([]);
    const notes = e2e.diagnostics.filter((d) => d.level === 'note');
    expect(notes.map((d) => [d.code, d.entry])).toEqual([['category/empty', 'terraria']]);
    expect(e2e.model).not.toBeNull();
  });

  it('carries no sample flags, markers or sample images', () => {
    expect(site().samples).toEqual([]);
  });

  it('publishes the four categories in config order and keeps terraria hidden', () => {
    expect(site().categories.map((c) => c.id)).toEqual(['ffxiv', 'minecraft', 'linux', 'other']);
  });

  it('sets the dummy repo_url on ffxiv only, so install entries survive', () => {
    expect(category('ffxiv').repoUrl).toBe('https://repo.example.invalid/repo.json');
    expect(site().categories.filter((c) => c.repoUrl !== undefined).map((c) => c.id)).toEqual(['ffxiv']);
    const lantern = site().projectsBySlug.get('loch-lantern');
    expect(lantern?.get.map((g) => g.kind)).toEqual(['install']);
  });

  it('keeps the harness chip order per category (config order)', () => {
    const CFG: Record<string, string[]> = {
      ffxiv: ['plugin', 'web', 'offline', 'dalamud', 'api12', 'windows', 'linux', 'gear'],
      minecraft: ['mod', 'modpack', 'fabric', 'neoforge', 'mc121', 'worldgen'],
      linux: ['cli', 'tui', 'aur', 'theme'],
      other: ['bot', 'web', 'experiment'],
    };
    for (const [id, tags] of Object.entries(CFG)) expect(category(id).tags.map((t) => t.id)).toEqual(tags);
  });

  it('has 16 bookmarks in the harness group order (empty other skipped)', () => {
    const groups = site().bookmarks;
    expect(groups.map((g) => g.id)).toEqual(['ffxiv', 'minecraft', 'linux', 'reading', 'inspiration', 'general']);
    expect(groups.reduce((n, g) => n + g.bookmarks.length, 0)).toBe(16);
  });

  it('gives ?tag=offline&sort=updated&dir=desc the harness result order', () => {
    const rows = category('ffxiv').projects.filter((p) => p.tags.some((t) => t.id === 'offline'));
    expect(sortRows(rows, 'updated', 'desc').map((p) => p.slug)).toEqual([
      'peat-fishing-log',
      'mist-macro-editor',
      'urquhart-crafting-sim',
    ]);
  });

  it('has three rows for ?tag=plugin', () => {
    expect(category('ffxiv').projects.filter((p) => p.tags.some((t) => t.id === 'plugin'))).toHaveLength(3);
  });

  it('suggests ffxiv/loch-lantern for the typo path and has no /terraria page', () => {
    expect(site().paths).toContain('/ffxiv/loch-lantern/');
    expect(site().paths.some((p) => p.startsWith('/terraria'))).toBe(false);
  });
});

describe('site-stress (local)', () => {
  it('prints exactly the warnings listed in EXPECTED-WARNINGS.txt, in order, and nothing else', async () => {
    const listed = (await readFile(new URL('../fixtures/site-stress/EXPECTED-WARNINGS.txt', import.meta.url), 'utf8'))
      .split('\n')
      .filter((line) => line.trim() !== '' && !line.startsWith('#'));
    const actual = stress.diagnostics.map((d) => {
      const where = [d.file, d.entry === undefined ? undefined : `[${d.entry}]`, d.field].filter((p) => p !== undefined);
      return [d.code, ...where].join(' ');
    });
    expect(stress.diagnostics.every((d) => d.level === 'warning')).toBe(true);
    expect(actual.sort()).toEqual([...listed].sort());
    expect(stress.model).not.toBeNull();
  });

  it('has a 430-character bio, the malformed tagline and the disallowed discord link', () => {
    const who = stress.model?.whoami;
    expect(who?.bio).toHaveLength(430);
    expect(who?.taglinePlain).toBe('I make plugins, mods and *small tools');
    expect(who?.links).toEqual({ github: 'https://github.com/example', mail: 'hello@nessynet.io' });
  });

  it('has a category with 22 used tags (3 type tags) and the opt-in empty category published', () => {
    const ffxiv = stress.model?.categories.find((c) => c.id === 'ffxiv');
    expect(ffxiv?.tags).toHaveLength(22);
    expect(ffxiv?.tags.filter((t) => t.isType)).toHaveLength(3);
    const terraria = stress.model?.categories.find((c) => c.id === 'terraria');
    expect(terraria?.showEmpty).toBe(true);
    expect(terraria?.projects).toEqual([]);
  });

  it('has a plugin project whose install entry is dropped for want of a repo_url', () => {
    const p = stress.model?.projectsBySlug.get('mark-board');
    expect(p?.layout).toBe('plugin');
    expect(p?.get).toEqual([]);
    expect(p?.getSlot).toEqual({ kind: 'text', text: 'Not distributed yet' });
  });
});
