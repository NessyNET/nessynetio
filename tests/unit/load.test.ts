import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { formatDiagnostic } from '../../src/lib/content/diagnostics.ts';
import { loadContent } from '../../src/lib/content/load.ts';

const fixture = (name: string): string => fileURLToPath(new URL(`../fixtures/load/${name}/`, import.meta.url));

describe('loadContent: valid tree', () => {
  it('returns no diagnostics and records files, folder category and file slug', async () => {
    const { parsed, diagnostics } = await loadContent(fixture('valid'));
    expect(diagnostics).toEqual([]);
    expect(parsed.site).toMatchObject({ file: 'site.toml', data: { url: 'https://nessynet.io' } });
    expect(parsed.whoami).toMatchObject({ file: 'site.toml', data: { name: 'Nessy', links: { mail: 'hello@nessynet.io' } } });
    expect(parsed.categories).toMatchObject([{ file: 'categories.toml', data: { id: 'ffxiv' } }]);
    expect(parsed.projects).toHaveLength(1);
    expect(parsed.projects[0]).toMatchObject({
      file: 'projects/ffxiv/x.toml',
      folderCategory: 'ffxiv',
      fileSlug: 'x',
      assets: [],
      data: { slug: 'x', category: 'ffxiv' },
    });
    expect(parsed.relations).toMatchObject([{ file: 'bookmarks.toml', data: { id: 'docs' } }]);
    expect(parsed.groups).toMatchObject([{ data: { id: 'misc' } }]);
    expect(parsed.bookmarks).toMatchObject([{ file: 'bookmarks.toml', data: { name: 'Example' } }]);
    expect(parsed.samples).toEqual([]);
  });

  it('normalises TOML dates to YYYY-MM-DD strings, including nested ones', async () => {
    const { parsed } = await loadContent(fixture('valid'));
    const data = parsed.projects[0]!.data;
    expect(data.updated).toBe('2026-01-05');
    expect(data.changelog?.[0]?.date).toBe('2026-01-05');
  });

  it('keeps unknown keys, and the top-level keys of each file', async () => {
    const { parsed } = await loadContent(fixture('valid'));
    expect(parsed.topLevelKeys).toContainEqual({ file: 'site.toml', keys: ['site', 'whoami'] });
    expect(parsed.topLevelKeys).toContainEqual({ file: 'projects/ffxiv/x.toml', keys: expect.arrayContaining(['slug', 'get', 'changelog']) });
  });

  it('records a folder or filename mismatch without judging it', async () => {
    const { parsed, diagnostics } = await loadContent(fixture('mismatch'));
    expect(diagnostics).toEqual([]);
    expect(parsed.projects[0]).toMatchObject({ folderCategory: 'ffxiv', fileSlug: 'y', data: { slug: 'x', category: 'minecraft' } });
  });
});

describe('loadContent: problems are diagnostics', () => {
  it('TOML syntax error: error naming the file and line, other files still load', async () => {
    const { parsed, diagnostics } = await loadContent(fixture('syntax-error'));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'toml/syntax', level: 'error', file: 'projects/ffxiv/x.toml' });
    expect(diagnostics[0]!.message).toMatch(/line 7\b/);
    expect(parsed.projects).toEqual([]);
    expect(parsed.categories).toHaveLength(1);
  });

  it('missing whoami.bio: error for [whoami] bio; the site table still loads', async () => {
    const { parsed, diagnostics } = await loadContent(fixture('missing-bio'));
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'schema/required', level: 'error', file: 'site.toml', entry: 'whoami', field: 'bio' });
    expect(formatDiagnostic(diagnostics[0]!)).toMatch(/^ERROR site\.toml \[whoami\] bio: /);
    expect(parsed.whoami).toBeNull();
    expect(parsed.site).not.toBeNull();
  });

  it('names project, field path and file for nested errors', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'load-'));
    try {
      await cp(fixture('valid'), dir, { recursive: true });
      const project = await readFile(join(dir, 'projects/ffxiv/x.toml'), 'utf8');
      await writeFile(join(dir, 'projects/ffxiv/x.toml'), project.replace('url = "/downloads/x.zip"', 'url = "javascript:alert(1)"'));
      const { diagnostics } = await loadContent(dir);
      expect(diagnostics).toHaveLength(1);
      expect(formatDiagnostic(diagnostics[0]!)).toMatch(/^ERROR projects\/ffxiv\/x\.toml \[x\] get\[1\]\.url: .+/);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('an empty directory reports the missing required files; bookmarks.toml is optional', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'load-'));
    try {
      const { parsed, diagnostics } = await loadContent(dir);
      expect(diagnostics.map((d) => [d.code, d.file])).toEqual([
        ['schema/required', 'site.toml'],
        ['schema/required', 'categories.toml'],
      ]);
      expect(parsed.projects).toEqual([]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});

describe('loadContent: sample scan', () => {
  it('finds sample = true, [sample] strings with field paths, and *.sample.<ext> assets, one item per entity', async () => {
    const { parsed, diagnostics } = await loadContent(fixture('samples'));
    expect(diagnostics).toEqual([]);
    expect(parsed.projects[0]!.assets).toEqual(['01.sample.png', '02.png']);
    expect(parsed.samples).toContainEqual({
      file: 'projects/ffxiv/x.toml',
      entry: 'x',
      fields: ['notice.text'],
      assets: ['projects/ffxiv/x/01.sample.png'],
    });
    expect(parsed.samples).toContainEqual({ file: 'site.toml', entry: 'site', fields: ['description'], assets: [] });
    expect(parsed.samples).toContainEqual({ file: 'bookmarks.toml', entry: 'Flagged', fields: [], assets: [] });
    expect(parsed.samples).toHaveLength(3);
  });
});

describe('loadContent: stray files and orphan asset folders', () => {
  const withTree = async (setup: (dir: string) => Promise<void>) => {
    const dir = await mkdtemp(join(tmpdir(), 'load-'));
    try {
      await cp(fixture('valid'), dir, { recursive: true });
      await setup(dir);
      return await loadContent(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  };

  it('a clean tree has none', async () => {
    const { parsed } = await loadContent(fixture('valid'));
    expect(parsed.strays).toEqual([]);
    expect(parsed.orphanAssetDirs).toEqual([]);
  });

  it('records a .toml directly in projects/ and one nested below a category folder, sorted, content-relative', async () => {
    const { parsed, diagnostics } = await withTree(async (dir) => {
      await mkdir(join(dir, 'projects/ffxiv/sub'), { recursive: true });
      await writeFile(join(dir, 'projects/ffxiv/sub/deep.toml'), 'slug = "deep"\n');
      await writeFile(join(dir, 'projects/foo.toml'), 'slug = "foo"\n');
    });
    expect(parsed.strays).toEqual(['projects/ffxiv/sub/deep.toml', 'projects/foo.toml']);
    expect(parsed.projects.map((p) => p.data.slug)).toEqual(['x']);
    expect(diagnostics).toEqual([]);
  });

  it('records a folder projects/<category>/<name>/ with no <name>.toml; folders with a project file are not orphans', async () => {
    const { parsed } = await withTree(async (dir) => {
      await mkdir(join(dir, 'projects/ffxiv/x'), { recursive: true });
      await writeFile(join(dir, 'projects/ffxiv/x/01.png'), '');
      await mkdir(join(dir, 'projects/ffxiv/ghost'), { recursive: true });
      await writeFile(join(dir, 'projects/ffxiv/ghost/01.png'), '');
    });
    expect(parsed.orphanAssetDirs).toEqual(['projects/ffxiv/ghost']);
  });
});
