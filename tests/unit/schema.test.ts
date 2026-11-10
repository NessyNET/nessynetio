import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { formatDiagnostic } from '../../src/lib/content/diagnostics.ts';
import {
  bookmarkSchema,
  categorySchema,
  projectSchema,
  siteSectionSchema,
  validateEntity,
  whoamiSchema,
} from '../../src/lib/content/schema.ts';

const where = { file: 'projects/ffxiv/x.toml', entry: 'x' };

const project = (): Record<string, unknown> => ({
  slug: 'x',
  name: 'X',
  category: 'ffxiv',
  status: 'active',
  summary: 'One sentence.',
  priority: 1,
  updated: '2026-01-05',
  description: 'Prose.',
  tags: ['plugin'],
  get: [{ kind: 'install' }],
});

const codes = (raw: unknown, schema: z.ZodType = projectSchema) => validateEntity(schema, raw, where).diagnostics;

describe('projectSchema', () => {
  it('accepts a minimal valid project and a fully populated one', () => {
    expect(codes(project())).toEqual([]);
    const full = {
      ...project(),
      version: '1.0.0',
      licence: 'MIT',
      issues: 'https://github.com/a/b/issues',
      changelog_url: 'https://github.com/a/b/releases',
      source: { host: 'GitHub', url: 'https://github.com/a/b' },
      get: [
        { kind: 'install' },
        { kind: 'external', label: 'Open', url: 'https://tool.example.com/' },
        { kind: 'download', url: '/downloads/x.zip' },
      ],
      notice: { kind: 'retired', text: 'Gone.', date: '2026-02-01', what: 'bot' },
      caution: 'Careful.',
      screenshots: [{ file: '01.png', caption: 'Main' }],
      changelog: [{ version: '1.0.0', date: '2026-01-05', items: ['a', 'b'] }],
      sample: true,
      ffxiv: { requires: 'Dalamud' },
      webtool: {},
      linux: { language: 'rust' },
      bot: { platform: 'discord' },
      minecraft: { import_url: 'https://x.example/p', mods: [{ name: 'a', url: 'https://x.example/a' }] },
    };
    expect(codes(full)).toEqual([]);
  });

  it.each(['slug', 'name', 'category', 'status', 'summary', 'priority', 'updated', 'description', 'tags', 'get'])(
    'missing required %s: one schema/required error naming the field',
    (key) => {
      const raw = project();
      delete raw[key];
      const ds = codes(raw);
      expect(ds).toHaveLength(1);
      expect(ds[0]).toMatchObject({ code: 'schema/required', level: 'error', file: where.file, entry: 'x', field: key });
    },
  );

  it('status outside active|retired is a schema/type error', () => {
    const ds = codes({ ...project(), status: 'archived' });
    expect(ds).toHaveLength(1);
    expect(ds[0]).toMatchObject({ code: 'schema/type', level: 'error', field: 'status' });
  });

  it('wrong types: priority float, updated not a date, tags empty', () => {
    expect(codes({ ...project(), priority: 1.5 })[0]).toMatchObject({ code: 'schema/type', field: 'priority' });
    expect(codes({ ...project(), updated: 'soon' })[0]).toMatchObject({ code: 'schema/type', field: 'updated' });
    expect(codes({ ...project(), tags: [] })[0]).toMatchObject({ code: 'schema/required', field: 'tags' });
    expect(codes({ ...project(), get: [] })[0]).toMatchObject({ code: 'schema/required', field: 'get' });
  });

  it('unknown keys survive at the top level and in nested tables', () => {
    const raw = { ...project(), mystery: 1, source: { host: 'GitHub', url: 'https://g.example/a', extra: true } };
    const r = validateEntity(projectSchema, raw, where);
    expect(r.diagnostics).toEqual([]);
    expect(r.data).toMatchObject({ mystery: 1, source: { extra: true } });
  });

  it('names nested paths like get[1].url and screenshots[0].caption', () => {
    const bad = { ...project(), get: [{ kind: 'install' }, { kind: 'external', url: 'javascript:alert(1)' }] };
    const ds = codes(bad);
    expect(ds).toHaveLength(1);
    expect(formatDiagnostic(ds[0]!)).toMatch(/^ERROR projects\/ffxiv\/x\.toml \[x\] get\[1\]\.url: .+/);
    expect(codes({ ...project(), screenshots: [{ file: '01.png' }] })[0]).toMatchObject({
      code: 'schema/required',
      field: 'screenshots[0].caption',
    });
  });

  it('kind and notice kind must be known values', () => {
    expect(codes({ ...project(), get: [{ kind: 'buy' }] })[0]).toMatchObject({ code: 'schema/type', field: 'get[0].kind' });
    expect(codes({ ...project(), notice: { kind: 'odd', text: 't' } })[0]).toMatchObject({ field: 'notice.kind' });
  });

  describe('URL fields', () => {
    const bad = ['javascript:alert(1)', 'tel:+1', 'data:text/plain,x', 'ftp://x.example/f', 'relative/path', '//evil.example/x', 'mailto:a@b.c'];

    it.each(['issues', 'changelog_url'])('%s accepts http(s) only', (key) => {
      expect(codes({ ...project(), [key]: 'http://x.example/a' })).toEqual([]);
      for (const url of bad) expect(codes({ ...project(), [key]: url }), url).toMatchObject([{ code: 'schema/type', field: key }]);
    });

    it('source.url accepts http(s) only', () => {
      for (const url of bad) {
        expect(codes({ ...project(), source: { host: 'h', url } }), url).toMatchObject([{ code: 'schema/type', field: 'source.url' }]);
      }
    });

    it('get[].url accepts http(s) or a root-relative path, nothing else', () => {
      for (const url of ['https://x.example/a', 'http://x.example/a', '/downloads/a.zip']) {
        expect(codes({ ...project(), get: [{ kind: 'download', url }] }), url).toEqual([]);
      }
      for (const url of bad) {
        expect(codes({ ...project(), get: [{ kind: 'download', url }] }), url).toMatchObject([{ code: 'schema/type', field: 'get[0].url' }]);
      }
    });

    it('a value that matches the pattern but cannot be parsed is a schema/type error (https://[bad)', () => {
      const unparseable = 'https://[bad';
      const cases: [string, unknown, unknown, string][] = [
        ['issues', { ...project(), issues: unparseable }, projectSchema, 'issues'],
        ['source.url', { ...project(), source: { host: 'h', url: unparseable } }, projectSchema, 'source.url'],
        ['get[0].url', { ...project(), get: [{ kind: 'download', url: unparseable }] }, projectSchema, 'get[0].url'],
        ['minecraft.import_url', { ...project(), minecraft: { import_url: unparseable } }, projectSchema, 'minecraft.import_url'],
        ['repo_url', { id: 'a', label: 'A', blurb: 'b', accent: 'blue', tags: [], repo_url: unparseable }, categorySchema, 'repo_url'],
        ['bookmark url', { name: 'n', url: unparseable, note: 'n', relation: 'r' }, bookmarkSchema, 'url'],
        ['whoami.links.github', { name: 'n', bio: 'b', links: { github: unparseable } }, whoamiSchema, 'links.github'],
      ];
      for (const [label, raw, schema, field] of cases) {
        expect(codes(raw, schema as z.ZodType), label).toMatchObject([{ code: 'schema/type', level: 'error', field }]);
      }
    });

    it('a root-relative get URL is still accepted (no absolute form to parse)', () => {
      expect(codes({ ...project(), get: [{ kind: 'download', url: '/downloads/a.zip' }] })).toEqual([]);
    });

    it('minecraft URL fields accept http(s) only', () => {
      const mc = (minecraft: unknown) => codes({ ...project(), minecraft });
      expect(mc({ import_url: 'javascript:x' })).toMatchObject([{ field: 'minecraft.import_url' }]);
      expect(mc({ mods_url: 'tel:1' })).toMatchObject([{ field: 'minecraft.mods_url' }]);
      expect(mc({ dependencies: [{ name: 'a', url: 'data:x' }] })).toMatchObject([{ field: 'minecraft.dependencies[0].url' }]);
      expect(mc({ mods: [{ name: 'a' }, { name: 'b', url: 'rel/x' }] })).toMatchObject([{ field: 'minecraft.mods[1].url' }]);
    });
  });
});

describe('other schemas', () => {
  it('site section needs url and description', () => {
    expect(codes({ url: 'https://nessynet.io', description: 'd' }, siteSectionSchema)).toEqual([]);
    expect(codes({ url: 'https://nessynet.io' }, siteSectionSchema)).toMatchObject([{ code: 'schema/required', field: 'description' }]);
  });

  it('whoami needs name and bio; links are loose; github is http(s); mail is a bare address', () => {
    const base = { name: 'n', bio: 'b' };
    expect(codes({ ...base, tagline: 't', links: { github: 'https://github.com/a', mail: 'a@b.example', discord: 'whatever' } }, whoamiSchema)).toEqual([]);
    expect(codes({ name: 'n' }, whoamiSchema)).toMatchObject([{ code: 'schema/required', field: 'bio' }]);
    expect(codes({ ...base, links: { github: 'javascript:x' } }, whoamiSchema)).toMatchObject([{ field: 'links.github' }]);
    expect(codes({ ...base, links: { mail: 'mailto:a@b.example' } }, whoamiSchema)).toMatchObject([{ field: 'links.mail' }]);
    expect(codes({ ...base, links: { mail: 'not an address' } }, whoamiSchema)).toMatchObject([{ field: 'links.mail' }]);
  });

  it('category: shape only (accent is any string), tags required with loose entries', () => {
    const cat = { id: 'ffxiv', label: 'FFXIV', blurb: 'b', accent: 'not-a-colour', tags: [{ id: 'plugin', type: true, layout: 'plugin', extra: 1 }] };
    expect(codes(cat, categorySchema)).toEqual([]);
    expect(codes({ ...cat, repo_url: 'https://repo.example/r.json', short_label: 'F', show_empty: true, sample: true }, categorySchema)).toEqual([]);
    for (const key of ['id', 'label', 'blurb', 'accent', 'tags']) {
      const raw: Record<string, unknown> = { ...cat };
      delete raw[key];
      expect(codes(raw, categorySchema), key).toMatchObject([{ code: 'schema/required', field: key }]);
    }
    expect(codes({ ...cat, tags: [{ label: 'x' }] }, categorySchema)).toMatchObject([{ field: 'tags[0].id' }]);
    expect(codes({ ...cat, repo_url: 'http://repo.example/r.json' }, categorySchema)).toMatchObject([{ field: 'repo_url' }]);
  });

  it('bookmark: required keys, optional keys, http(s) url', () => {
    const bm = { name: 'N', url: 'https://x.example/', note: 'n', relation: 'docs' };
    expect(codes({ ...bm, category: 'c', group: 'g', author: 'a', projects: ['x'], sample: true }, bookmarkSchema)).toEqual([]);
    for (const key of ['name', 'url', 'note', 'relation']) {
      const raw: Record<string, unknown> = { ...bm };
      delete raw[key];
      expect(codes(raw, bookmarkSchema), key).toMatchObject([{ code: 'schema/required', field: key }]);
    }
    expect(codes({ ...bm, url: 'javascript:x' }, bookmarkSchema)).toMatchObject([{ code: 'schema/type', field: 'url' }]);
  });
});
