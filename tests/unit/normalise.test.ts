import { describe, expect, it } from 'vitest';
import type { ParsedSite } from '../../src/lib/content/load.ts';
import type { Project, SiteModel } from '../../src/lib/content/model.ts';
import { normalise } from '../../src/lib/content/normalise.ts';
import type { ProjectData } from '../../src/lib/content/schema.ts';
import { bookmark, category, group, parsedSite, project, relation, tag, typeTag } from '../helpers/parsed-site.ts';

const build = (over: Partial<ParsedSite>): SiteModel => normalise(parsedSite(over));
const find = (model: SiteModel, slug: string): Project => {
  const found = model.projectsBySlug.get(slug);
  if (found === undefined) throw new Error(`no project ${slug}`);
  return found;
};

/** One `web`/`bot`/... category so a single project can be built for any layout. */
const MIXED = category('mixed', {
  label: 'Mixed',
  tags: [
    typeTag('plugin'),
    typeTag('web', { label: 'web tool' }),
    typeTag('bot', { label: 'bot' }),
    typeTag('offline'),
    typeTag('experiment'),
    tag('beta'),
    tag('alpha'),
  ],
});

/** Builds the single project in `MIXED` and returns it from the model. */
const one = (slug: string, over: Partial<ProjectData>, cat = MIXED): Project =>
  find(build({ categories: [cat], projects: [project('mixed', slug, over)] }), slug);

describe('site, whoami and relations', () => {
  it('derives the host and keeps the description', () => {
    const model = build({});
    expect(model.site).toEqual({ url: 'https://nessynet.io', host: 'nessynet.io', description: 'A site.' });
  });

  it('turns the tagline into segments and plain text', () => {
    const model = build({
      whoami: {
        file: 'site.toml',
        data: { name: 'Nessy', bio: 'Bio.', tagline: 'I make *plugins* and *mods*{pink}.', links: { github: 'https://github.com/x' } },
      },
    });
    expect(model.whoami).toEqual({
      name: 'Nessy',
      tagline: [
        { text: 'I make ' },
        { text: 'plugins', accent: 'green' },
        { text: ' and ' },
        { text: 'mods', accent: 'pink' },
        { text: '.' },
      ],
      taglinePlain: 'I make plugins and mods.',
      bio: 'Bio.',
      links: { github: 'https://github.com/x' },
    });
  });

  it('uses null tagline fields when there is no tagline, and null whoami when it failed to parse', () => {
    expect(build({}).whoami).toEqual({ name: 'Nessy', tagline: null, taglinePlain: null, bio: 'Bio.', links: {} });
    expect(build({ whoami: null }).whoami).toBeNull();
  });

  it('keeps relations in config order', () => {
    const model = build({ relations: [relation('docs', 'Docs I use'), relation('inspiration', 'Inspired by')] });
    expect(model.relations).toEqual([
      { id: 'docs', description: 'Docs I use' },
      { id: 'inspiration', description: 'Inspired by' },
    ]);
  });
});

describe('categories', () => {
  const cats = [
    category('full', { blurb: 'First one. Second one.' }),
    category('hidden'),
    category('shown', { show_empty: true, short_label: 'Sh' }),
  ];

  it('publishes categories with projects or show_empty, in config order', () => {
    const model = build({ categories: cats, projects: [project('full', 'a')] });
    expect(model.categories.map((c) => c.id)).toEqual(['full', 'shown']);
    expect(model.categories[1]).toMatchObject({ shortLabel: 'Sh', showEmpty: true, projects: [], tags: [] });
    expect(model.categories[0]).toMatchObject({ shortLabel: 'FULL', showEmpty: false, accent: 'blue' });
  });

  it.each([
    ['One. Two.', 'One.'],
    ['Really! Then more.', 'Really!'],
    ['Why? Because.', 'Why?'],
    ['Version 1.5 is out. Next.', 'Version 1.5 is out.'],
    ['No full stop', 'No full stop'],
    ['Only one.', 'Only one.'],
  ])('takes the first sentence of %j as %j', (blurb, first) => {
    const model = build({ categories: [category('c', { blurb })], projects: [project('c', 'a')] });
    expect(model.categories[0]?.blurbFirstSentence).toBe(first);
    expect(model.categories[0]?.blurb).toBe(blurb);
  });

  it('passes repo_url through only when set', () => {
    const withRepo = build({ categories: [category('c', { repo_url: 'https://repo.example.org/repo.json' })], projects: [project('c', 'a')] });
    expect(withRepo.categories[0]?.repoUrl).toBe('https://repo.example.org/repo.json');
    const without = build({ categories: [category('c')], projects: [project('c', 'a')] });
    expect(without.categories[0]).not.toHaveProperty('repoUrl');
  });

  it('lists only used tags, in config order, with counts and the type flag', () => {
    const c = category('c', {
      tags: [typeTag('plugin', { label: 'plugin!' }), tag('alpha', { description: 'first' }), tag('unused'), typeTag('web'), tag('beta')],
    });
    const model = build({
      categories: [c],
      projects: [
        project('c', 'p1', { tags: ['beta', 'plugin', 'alpha'] }),
        project('c', 'p2', { tags: ['plugin', 'beta'] }),
        project('c', 'p3', { tags: ['web'], webtool: { runs_in: 'browser', account: 'none', data: 'local' } }),
      ],
    });
    expect(model.categories[0]?.tags).toEqual([
      { id: 'plugin', label: 'plugin!', isType: true, count: 2 },
      { id: 'alpha', label: 'alpha', description: 'first', isType: false, count: 1 },
      { id: 'web', label: 'web', isType: true, count: 1 },
      { id: 'beta', label: 'beta', isType: false, count: 2 },
    ]);
  });

  it('carries an explicit tag layout', () => {
    const c = category('c', { tags: [typeTag('datapack', { layout: 'mod' })] });
    const model = build({
      categories: [c],
      projects: [
        project('c', 'a', {
          tags: ['datapack'],
          minecraft: { loader: 'fabric', game_versions: ['1.21'], side: 'both' },
        }),
      ],
    });
    expect(model.categories[0]?.tags[0]).toMatchObject({ id: 'datapack', layout: 'mod', isType: true });
    expect(find(model, 'a').layout).toBe('mod');
  });

  it('orders projects by default sort: active by priority then slug, retired last', () => {
    const retired = { status: 'retired', notice: { kind: 'retired', text: 'Gone.', date: '2024-01-01' } } as const;
    const model = build({
      categories: [category('c')],
      projects: [
        project('c', 'old', { priority: 1, ...retired }),
        project('c', 'zed', { priority: 5 }),
        project('c', 'bee', { priority: 5 }),
        project('c', 'top', { priority: 2 }),
      ],
    });
    expect(model.categories[0]?.projects.map((p) => p.slug)).toEqual(['top', 'bee', 'zed', 'old']);
  });

  it('gives each category its bookmarks in file order', () => {
    const model = build({
      categories: [category('c'), category('d')],
      projects: [project('c', 'a'), project('d', 'b')],
      relations: [relation('docs')],
      bookmarks: [bookmark('One', { category: 'c' }), bookmark('Two', { category: 'd' }), bookmark('Three', { category: 'c' })],
    });
    expect(model.categories[0]?.bookmarks.map((b) => b.name)).toEqual(['One', 'Three']);
    expect(model.categories[1]?.bookmarks.map((b) => b.name)).toEqual(['Two']);
  });
});

describe('projects', () => {
  it('keeps a project with zero type tags as generic with a null type tag, counted in its category', () => {
    const c = category('c', { tags: [typeTag('plugin'), tag('beta')] });
    const model = build({
      categories: [c],
      projects: [
        project('c', 'typed', { priority: 2 }),
        project('c', 'untyped', { priority: 1, tags: ['beta'], ffxiv: { requires: 'x' } }),
      ],
    });
    const untyped = find(model, 'untyped');
    expect(untyped.layout).toBe('generic');
    expect(untyped.typeTag).toBeNull();
    expect(untyped).not.toHaveProperty('details');
    expect(untyped.tags.map((t) => t.id)).toEqual(['beta']);
    expect(model.categories[0]?.projects.map((p) => p.slug)).toEqual(['untyped', 'typed']);
    expect(model.categories[0]?.tags.map((t) => [t.id, t.count])).toEqual([
      ['plugin', 1],
      ['beta', 1],
    ]);
  });

  it('resolves layout, type tag, valid tags in config order, details and the page path', () => {
    const p = one('gear', {
      tags: ['alpha', 'beta', 'web', 'nonsense'],
      webtool: { runs_in: 'browser', account: 'none', data: 'local' },
      get: [{ kind: 'external', url: 'https://gear.nessynet.io' }],
      version: undefined,
    });
    expect(p.layout).toBe('web');
    expect(p.typeTag).toMatchObject({ id: 'web', label: 'web tool', isType: true });
    expect(p.tags.map((t) => t.id)).toEqual(['web', 'beta', 'alpha']);
    expect(p).toMatchObject({ details: { runsIn: 'browser', account: 'none', data: 'local' }, path: '/mixed/gear/', categoryId: 'mixed' });
  });

  it('makes the first type tag in config order the type and keeps the others as normal tags', () => {
    const p = one('multi', { tags: ['offline', 'plugin'], ffxiv: { requires: 'Dalamud' } });
    expect(p.typeTag?.id).toBe('plugin');
    expect(p.tags.map((t) => t.id)).toEqual(['plugin', 'offline']);
  });

  it('falls back to generic for a type tag without a layout mapping', () => {
    const p = one('exp', { tags: ['experiment'] });
    expect(p.layout).toBe('generic');
    expect(p.typeTag?.id).toBe('experiment');
  });

  it('defaults a tag label to its id', () => {
    expect(one('x', { tags: ['plugin'], ffxiv: { requires: 'r' } }).typeTag?.label).toBe('plugin');
  });

  it('copies shared fields and omits absent optional ones', () => {
    const plain = one('bare', { ffxiv: { requires: 'r' } });
    for (const key of ['licence', 'source', 'issues', 'notice', 'caution', 'changelogUrl'] as const) {
      expect(plain).not.toHaveProperty(key);
    }
    const full = one('full', {
      ffxiv: { requires: 'r' },
      licence: 'MIT',
      issues: 'https://example.org/issues',
      changelog_url: 'https://example.org/changes',
      caution: 'Be careful.',
      source: { host: 'GitHub', url: 'https://github.com/x/y' },
    });
    expect(full).toMatchObject({
      slug: 'full',
      name: 'full',
      status: 'active',
      summary: 'full summary.',
      priority: 10,
      updated: '2025-01-01',
      version: '1.0.0',
      licence: 'MIT',
      issues: 'https://example.org/issues',
      changelogUrl: 'https://example.org/changes',
      caution: 'Be careful.',
      source: { host: 'GitHub', url: 'https://github.com/x/y' },
    });
  });

  it('splits the description on blank lines and keeps the changelog as authored', () => {
    const changelog = [{ version: '1.0.0', date: '2025-01-01', items: ['First.'] }];
    const p = one('desc', { ffxiv: { requires: 'r' }, description: 'One.\nStill one.\n\nTwo.\n  \n\nThree.\n', changelog });
    expect(p.description).toEqual(['One.\nStill one.', 'Two.', 'Three.']);
    expect(p.changelog).toEqual(changelog);
  });

  it('makes screenshot paths relative to the content dir and leaves none as an empty list', () => {
    const p = one('shots', {
      ffxiv: { requires: 'r' },
      screenshots: [{ file: 'screenshots/01.png', caption: 'Main window' }],
    });
    expect(p.screenshots).toEqual([{ file: 'projects/mixed/shots/screenshots/01.png', caption: 'Main window' }]);
    expect(one('noshots', { ffxiv: { requires: 'r' } }).screenshots).toEqual([]);
  });

  it('maps bot details with the camelCase model keys', () => {
    const p = one('bot1', {
      tags: ['bot'],
      bot: { platform: 'Discord', hosting: 'self', invite: false },
      get: [{ kind: 'none' }],
      notice: { kind: 'private', text: 'Private.' },
    });
    expect(p.layout).toBe('bot');
    expect(p).toMatchObject({ details: { platform: 'Discord', hosting: 'self', invite: false, commands: [] } });
  });

  it('skips a project whose category is not in the config', () => {
    const model = build({ categories: [category('c')], projects: [project('c', 'a'), project('ghost', 'b')] });
    expect([...model.projectsBySlug.keys()]).toEqual(['a']);
  });

  it('indexes projects by slug in category then default order', () => {
    const model = build({
      categories: [category('c'), category('d')],
      projects: [project('d', 'z', { priority: 1 }), project('c', 'b', { priority: 2 }), project('c', 'a', { priority: 1 })],
    });
    expect([...model.projectsBySlug.keys()]).toEqual(['a', 'b', 'z']);
  });
});

describe('modpack own mods', () => {
  const modpack = (mods: Record<string, unknown>[]) =>
    project('mc', 'pack', {
      name: 'Pack',
      tags: ['modpack'],
      minecraft: { loader: 'fabric', game_versions: ['1.21'], import_url: 'https://example.org/p', memory_gb: 4, mods_total: 3, mods },
    });
  const cats = [category('mc', { tags: [typeTag('mod'), typeTag('modpack')] }), category('other')];
  const mod = (slug: string, name: string, categoryId = 'mc') =>
    project(categoryId, slug, { name, tags: categoryId === 'mc' ? ['mod'] : ['plugin'], ...(categoryId === 'mc' ? { minecraft: { loader: 'fabric', game_versions: ['1.21'], side: 'both' }, ffxiv: undefined } : {}) });
  const modsOf = (model: ReturnType<typeof build>) => {
    const pack = find(model, 'pack');
    if (pack.layout !== 'modpack') throw new Error('not a modpack');
    return pack.details.mods;
  };

  it('sets path for a mine mod whose name exactly equals a published project name, in any category', () => {
    const model = build({
      categories: [...cats],
      projects: [mod('peat', 'Peatmoss'), project('other', 'x', { name: 'Elsewhere', tags: ['plugin'] }), modpack([
        { name: 'Peatmoss', version: '1', mine: true },
        { name: 'Elsewhere', mine: true },
      ])],
    });
    expect(modsOf(model).map((m) => m.path)).toEqual(['/mc/peat/', '/other/x/']);
  });

  it('leaves path out for an unmatched mine mod, a near-miss name, and every mine = false mod', () => {
    const model = build({
      categories: [...cats],
      projects: [mod('peat', 'Peatmoss'), modpack([
        { name: 'Unknown', mine: true },
        { name: 'peatmoss', mine: true },
        { name: 'Peatmoss', url: 'https://example.org/peatmoss', mine: false },
      ])],
    });
    for (const m of modsOf(model)) expect(m).not.toHaveProperty('path');
  });
});

describe('get, source and notice strings (ux 5.2, 6.2)', () => {
  const ffxiv = { ffxiv: { requires: 'Dalamud' } };

  it('public installable: see install, download and a source link, no notice', () => {
    const c = category('c', { repo_url: 'https://repo.example.org/repo.json' });
    const p = find(
      build({
        categories: [c],
        projects: [
          project('c', 'pub', {
            ...ffxiv,
            get: [{ kind: 'install' }, { kind: 'download', url: 'https://example.org/pub.zip' }, { kind: 'download', label: 'Modrinth', url: 'https://modrinth.com/x' }],
            source: { host: 'github.com', url: 'https://github.com/x/pub' },
          }),
        ],
      }),
      'pub',
    );
    expect(p.get).toEqual([
      { kind: 'install', label: 'see install', href: '#install', external: false },
      { kind: 'download', label: 'download v1.0.0', href: 'https://example.org/pub.zip', external: true },
      { kind: 'download', label: 'Modrinth', href: 'https://modrinth.com/x', external: true },
    ]);
    expect(p.getSlot).toEqual({ kind: 'links', links: p.get });
    expect(p.sourceSlot).toEqual({ kind: 'link', label: 'github.com', href: 'https://github.com/x/pub' });
    expect(p).not.toHaveProperty('notice');
  });

  it('treats a download on the site host as internal', () => {
    const p = one('self', { ...ffxiv, get: [{ kind: 'download', url: 'https://nessynet.io/files/self.zip' }] });
    expect(p.get[0]).toMatchObject({ external: false });
  });

  it('a download without an explicit label and without a project version is the bare "download"', () => {
    const p = one('nover', {
      ...ffxiv,
      version: undefined,
      get: [{ kind: 'download', url: 'https://example.org/nover.zip' }],
    });
    expect(p.get[0]).toMatchObject({ kind: 'download', label: 'download' });
  });

  it('download only, private source: download link and Source not available', () => {
    const p = one('dl', { ...ffxiv });
    expect(p.getSlot).toMatchObject({ kind: 'links' });
    expect(p.sourceSlot).toEqual({ kind: 'text', text: 'Source not available' });
    expect(p).not.toHaveProperty('notice');
  });

  it('local only', () => {
    const p = one('loc', {
      ...ffxiv,
      get: [{ kind: 'none' }],
      notice: { kind: 'local', text: 'Only on my machine.' },
    });
    expect(p.get).toEqual([]);
    expect(p.getSlot).toEqual({ kind: 'text', text: 'Not distributed (local only)' });
    expect(p.sourceSlot).toEqual({ kind: 'text', text: 'Source not available' });
    expect(p.notice).toEqual({ kind: 'local', label: 'local only', text: 'Only on my machine.' });
  });

  it('private bot, naming the thing from what or from the type tag label', () => {
    const base: Partial<ProjectData> = { tags: ['bot'], bot: { platform: 'Discord', hosting: 'self', invite: false }, get: [{ kind: 'none' }] };
    const byTag = one('b1', { ...base, notice: { kind: 'private', text: 'Private.' } });
    expect(byTag.getSlot).toEqual({ kind: 'text', text: 'Not distributed (private bot)' });
    expect(byTag.notice).toEqual({ kind: 'private', label: 'private bot', text: 'Private.' });
    const byWhat = one('b2', { ...base, notice: { kind: 'private', text: 'Private.', what: 'service' } });
    expect(byWhat.getSlot).toEqual({ kind: 'text', text: 'Not distributed (private service)' });
    expect(byWhat.notice?.label).toBe('private service');
  });

  it('uses the bare private label when there is no type tag and no what', () => {
    const c = category('c', { tags: [tag('beta')] });
    const p = find(
      build({ categories: [c], projects: [project('c', 'u', { tags: ['beta'], get: [{ kind: 'none' }], notice: { kind: 'private', text: 'Private.' } })] }),
      'u',
    );
    expect(p.getSlot).toEqual({ kind: 'text', text: 'Not distributed (private)' });
    expect(p.notice?.label).toBe('private');
  });

  it('retired without a working download', () => {
    const p = one('ret', {
      ...ffxiv,
      status: 'retired',
      get: [{ kind: 'none' }],
      notice: { kind: 'retired', text: 'It stopped working.', date: '2024-05-01' },
    });
    expect(p.getSlot).toEqual({ kind: 'text', text: 'No longer distributed' });
    expect(p.notice).toEqual({ kind: 'retired', label: 'retired', text: 'It stopped working.', date: '2024-05-01' });
  });

  it('retired with a working download keeps the link', () => {
    const p = one('ret2', {
      ...ffxiv,
      status: 'retired',
      notice: { kind: 'retired', text: 'Old but fine.', date: '2024-05-01' },
    });
    expect(p.getSlot).toMatchObject({ kind: 'links', links: [{ kind: 'download', label: 'download v1.0.0' }] });
    expect(p.notice?.label).toBe('retired');
  });

  it('none without a notice is the dev-only fallback: local only, or retired wording when retired', () => {
    expect(one('n1', { ...ffxiv, get: [{ kind: 'none' }] }).getSlot).toEqual({ kind: 'text', text: 'Not distributed (local only)' });
    expect(one('n2', { ...ffxiv, status: 'retired', get: [{ kind: 'none' }] }).getSlot).toEqual({ kind: 'text', text: 'No longer distributed' });
  });

  it('web tool: Open tool with the host, port kept, label fixed, separate site notice', () => {
    const p = one('gear', {
      tags: ['web'],
      webtool: { runs_in: 'browser', account: 'none', data: 'local' },
      version: undefined,
      get: [{ kind: 'external', label: 'ignored', url: 'https://gear.nessynet.io' }],
      notice: { kind: 'separate', text: 'Lives on its own site.' },
    });
    expect(p.get).toEqual([{ kind: 'external', label: 'Open tool: gear.nessynet.io', href: 'https://gear.nessynet.io', external: true }]);
    expect(p.notice).toEqual({ kind: 'separate', label: 'separate site', text: 'Lives on its own site.' });
    const ported = one('gear2', {
      tags: ['web'],
      webtool: { runs_in: 'browser', account: 'none', data: 'local' },
      get: [{ kind: 'external', url: 'https://gear.nessynet.io:8443/app' }],
    });
    expect(ported.get[0]?.label).toBe('Open tool: gear.nessynet.io:8443');
  });

  it('external entries on other layouts keep the authored label', () => {
    const p = one('store', { ...ffxiv, get: [{ kind: 'external', label: 'Store page', url: 'https://store.example.com/x' }] });
    expect(p.get).toEqual([{ kind: 'external', label: 'Store page', href: 'https://store.example.com/x', external: true }]);
  });

  it('plugin whose install entry was removed (R28) reads Not distributed yet', () => {
    const p = one('noinstall', { ...ffxiv, get: [] });
    expect(p.get).toEqual([]);
    expect(p.getSlot).toEqual({ kind: 'text', text: 'Not distributed yet' });
  });

  it('plugin with another entry left after the install was removed keeps its links', () => {
    const p = one('other', { ...ffxiv, get: [{ kind: 'download', url: 'https://example.org/o.zip' }] });
    expect(p.getSlot).toMatchObject({ kind: 'links' });
  });
});

describe('see also', () => {
  const cats = [category('c'), category('d')];

  it('lists at most 3 others from the same category in default order, never self', () => {
    const model = build({
      categories: cats,
      projects: [
        project('c', 'p1', { priority: 1 }),
        project('c', 'p2', { priority: 2 }),
        project('c', 'p3', { priority: 3 }),
        project('c', 'p4', { priority: 4 }),
        project('c', 'p5', { priority: 5, status: 'retired', notice: { kind: 'retired', text: 'x', date: '2024-01-01' } }),
        project('d', 'other', { priority: 0 }),
      ],
    });
    expect(find(model, 'p1').seeAlso.mine.map((p) => p.slug)).toEqual(['p2', 'p3', 'p4']);
    expect(find(model, 'p3').seeAlso.mine.map((p) => p.slug)).toEqual(['p1', 'p2', 'p4']);
    expect(find(model, 'p5').seeAlso.mine.map((p) => p.slug)).toEqual(['p1', 'p2', 'p3']);
    expect(find(model, 'other').seeAlso.mine).toEqual([]);
    expect(find(model, 'p1').seeAlso.mine[0]).toBe(find(model, 'p2'));
  });

  it('lists bookmarks that name the project, in file order', () => {
    const model = build({
      categories: cats,
      projects: [project('c', 'p1'), project('c', 'p2')],
      relations: [relation('docs')],
      bookmarks: [
        bookmark('First', { projects: ['p1'] }),
        bookmark('Second', { projects: ['p2'] }),
        bookmark('Third', { projects: ['p2', 'p1'] }),
        bookmark('Fourth'),
      ],
    });
    expect(find(model, 'p1').seeAlso.elsewhere.map((b) => b.name)).toEqual(['First', 'Third']);
    expect(find(model, 'p2').seeAlso.elsewhere.map((b) => b.name)).toEqual(['Second', 'Third']);
  });
});

describe('bookmarks', () => {
  const base = {
    categories: [category('alpha', { accent: 'orange' }), category('beta', { accent: 'cyan' }), category('empty')],
    projects: [project('alpha', 'a1', { name: 'Alpha One' }), project('beta', 'b1')],
    relations: [relation('docs', 'Docs I use')],
    groups: [group('reading', 'Reading'), group('unused', 'Unused'), group('inspo', 'Inspiration')],
  };

  it('orders groups categories, free groups, then general, skipping empty ones, with accents', () => {
    const model = build({
      ...base,
      bookmarks: [
        bookmark('G1'),
        bookmark('I1', { group: 'inspo' }),
        bookmark('B1', { category: 'beta' }),
        bookmark('R1', { group: 'reading' }),
        bookmark('A1', { category: 'alpha' }),
        bookmark('A2', { category: 'alpha' }),
      ],
    });
    expect(model.bookmarks.map((g) => [g.id, g.kind, g.accent, g.bookmarks.map((b) => b.name)])).toEqual([
      ['alpha', 'category', 'orange', ['A1', 'A2']],
      ['beta', 'category', 'cyan', ['B1']],
      ['reading', 'group', 'teal', ['R1']],
      ['inspo', 'group', 'teal', ['I1']],
      ['general', 'general', 'teal', ['G1']],
    ]);
    expect(model.bookmarks.map((g) => g.label)).toEqual(['ALPHA', 'BETA', 'Reading', 'Inspiration', 'general']);
  });

  it('omits general when it is empty', () => {
    const model = build({ ...base, bookmarks: [bookmark('A1', { category: 'alpha' })] });
    expect(model.bookmarks.map((g) => g.id)).toEqual(['alpha']);
  });

  it('shows a bookmark of an unpublished category under general', () => {
    const model = build({ ...base, bookmarks: [bookmark('E1', { category: 'empty' })] });
    expect(model.bookmarks).toMatchObject([{ id: 'general', bookmarks: [{ name: 'E1', groupId: 'general' }] }]);
  });

  it('fills host, relation, author, group id and project links', () => {
    const model = build({
      ...base,
      bookmarks: [
        bookmark('Full', { url: 'https://docs.example.com:8443/guide', category: 'alpha', author: 'Someone', projects: ['a1', 'b1'] }),
        bookmark('Bare', { relation: 'missing' }),
      ],
    });
    const [full] = model.categories[0]?.bookmarks ?? [];
    expect(full).toEqual({
      name: 'Full',
      url: 'https://docs.example.com:8443/guide',
      host: 'docs.example.com:8443',
      note: 'Full note',
      relation: { id: 'docs', description: 'Docs I use' },
      author: 'Someone',
      projects: [
        { slug: 'a1', name: 'Alpha One', path: '/alpha/a1/' },
        { slug: 'b1', name: 'b1', path: '/beta/b1/' },
      ],
      groupId: 'alpha',
    });
    const bare = model.bookmarks.find((g) => g.id === 'general')?.bookmarks[0];
    expect(bare).not.toHaveProperty('relation');
    expect(bare).not.toHaveProperty('author');
    expect(bare?.projects).toEqual([]);
  });
});

describe('updates log', () => {
  it('takes the 4 most recently updated, ties by slug, with the changelog note for the current version', () => {
    const log = (version: string, ...items: string[]) => [
      { version: '0.9.0', date: '2024-01-01', items: ['Old note.'] },
      { version, date: '2025-01-01', items },
    ];
    const model = build({
      categories: [category('c'), category('d')],
      projects: [
        project('c', 'p-b', { updated: '2025-03-01', version: '2.0.0', changelog: log('2.0.0', 'Shiny.', 'Second.') }),
        project('c', 'p-a', { updated: '2025-03-01', version: '3.0.0', changelog: log('2.0.0', 'Stale.') }),
        project('d', 'p-c', { updated: '2025-04-01', version: '1.0.0', changelog: [{ version: '1.0.0', date: '2025-04-01', items: [] }] }),
        project('d', 'p-d', { updated: '2025-02-01', version: '1.0.0' }),
        project('d', 'p-e', { updated: '2025-01-01', version: '1.0.0' }),
      ],
    });
    expect(model.updatesLog).toEqual([
      { date: '2025-04-01', categoryId: 'd', slug: 'p-c', version: '1.0.0', note: 'p-c summary.', path: '/d/p-c/' },
      { date: '2025-03-01', categoryId: 'c', slug: 'p-a', version: '3.0.0', note: 'p-a summary.', path: '/c/p-a/' },
      { date: '2025-03-01', categoryId: 'c', slug: 'p-b', version: '2.0.0', note: 'Shiny.', path: '/c/p-b/' },
      { date: '2025-02-01', categoryId: 'd', slug: 'p-d', version: '1.0.0', note: 'p-d summary.', path: '/d/p-d/' },
    ]);
  });

  it('omits version for a project without one', () => {
    const model = build({
      categories: [category('c', { tags: [typeTag('web')] })],
      projects: [project('c', 'w', { tags: ['web'], version: undefined, webtool: { runs_in: 'a', account: 'b', data: 'c' } })],
    });
    expect(model.updatesLog[0]).not.toHaveProperty('version');
  });
});

describe('paths, samples and freezing', () => {
  it('lists home, published categories, projects and bookmarks, sorted', () => {
    const model = build({
      categories: [category('zeta'), category('alpha'), category('hidden')],
      projects: [project('zeta', 'z1'), project('alpha', 'a2'), project('alpha', 'a1')],
    });
    expect(model.paths).toEqual(['/', '/alpha/', '/alpha/a1/', '/alpha/a2/', '/bookmarks/', '/zeta/', '/zeta/z1/']);
  });

  it('passes the sample list through', () => {
    const samples = [{ file: 'site.toml', entry: 'whoami', fields: ['bio'], assets: [] }];
    expect(build({ samples }).samples).toEqual(samples);
  });

  it('returns a deeply frozen model, including cyclic see-also links and the project map', () => {
    const model = build({
      categories: [category('c')],
      projects: [project('c', 'a'), project('c', 'b')],
      relations: [relation('docs')],
      bookmarks: [bookmark('B', { category: 'c' })],
    });
    const a = find(model, 'a');
    expect(Object.isFrozen(model)).toBe(true);
    expect(Object.isFrozen(model.categories)).toBe(true);
    expect(Object.isFrozen(a)).toBe(true);
    expect(Object.isFrozen(a.seeAlso.mine)).toBe(true);
    expect(Object.isFrozen(a.typeTag)).toBe(true);
    expect(Object.isFrozen(model.bookmarks[0]?.bookmarks[0])).toBe(true);
    expect(() => {
      (model as unknown as { paths: string[] }).paths = [];
    }).toThrow(TypeError);
    expect(() => {
      (a as { name: string }).name = 'changed';
    }).toThrow(TypeError);
    expect(() => (model.projectsBySlug as Map<string, Project>).set('x', a)).toThrow(TypeError);
    expect(() => (model.projectsBySlug as Map<string, Project>).delete('a')).toThrow(TypeError);
    expect(() => (model.projectsBySlug as Map<string, Project>).clear()).toThrow(TypeError);
  });

  it('does not mutate its input', () => {
    const input = parsedSite({ categories: [category('c')], projects: [project('c', 'a')] });
    const before = structuredClone(input);
    normalise(input);
    expect(input).toEqual(before);
  });
});
