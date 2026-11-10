import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import BookmarkRow from '../../src/components/bookmarks/BookmarkRow.astro';
import { clearSiteMemo, loadSite } from '../../src/lib/content/index.ts';
import type { Bookmark, SiteModel } from '../../src/lib/content/model.ts';
import BookmarksPage from '../../src/pages/bookmarks/index.astro';
import { bookmarkSection, bookmarkTitle, SECTIONS, TITLES } from '../helpers/hooks.ts';

const E2E_DIR = fileURLToPath(new URL('../fixtures/site-e2e', import.meta.url));

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
let model: SiteModel;
let html: string;

// Scoped styles stamp every element with a data-astro-cid-* attribute; it is not part of the markup under test.
const clean = (s: string) => s.replace(/ data-astro-cid-[a-z0-9]+/g, '');
const text = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/&gt;/g, '>').replace(/\s+/g, ' ').trim();
const asComponent = (c: unknown) => c as Parameters<typeof container.renderToString>[0];

beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://nessynet.io' } });
  const { model: loaded } = await loadSite({ dir: E2E_DIR, strict: true, allowSamples: false });
  if (loaded === null) throw new Error('site-e2e does not load');
  model = loaded;
  process.env['NESSY_CONTENT_DIR'] = E2E_DIR;
  process.env['NESSY_STRICT'] = '1';
  clearSiteMemo();
  html = clean(await container.renderToString(asComponent(BookmarksPage)));
});
afterAll(() => {
  delete process.env['NESSY_CONTENT_DIR'];
  delete process.env['NESSY_STRICT'];
  clearSiteMemo();
});

const GROUPS = ['ffxiv', 'minecraft', 'linux', 'reading', 'inspiration', 'general'];
const section = (id: string) => new RegExp(`<section[^>]*id="${bookmarkSection(id)}"[\\s\\S]*?</section>`).exec(html)?.[0] ?? '';

describe('bookmarks page frame', () => {
  it('has the bookmarks title, one plain h1, the bookmarks tab current and the bookmarks status line', () => {
    expect(html).toContain('<title>Bookmarks · nessynet.io</title>');
    expect([...html.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
    expect(html).toContain('<h1>Bookmarks</h1>');
    expect(html).toMatch(/<a href="\/bookmarks\/" aria-current="page">/);
    const footer = /<footer[\s\S]*<\/footer>/.exec(html)?.[0] ?? '';
    expect(text(footer.replace(/<\/(span|a)>/g, ' | '))).toContain('NESSY | ~/bookmarks | 16 links | | external | github');
  });
});

describe('intro window bh', () => {
  it('is titled ~/bookmarks in a p, with the fixed intro and the emphasised sentence', () => {
    expect(html).toContain(`id="${SECTIONS.bh}"`);
    expect(html).toContain('<p id="w-bh" class="tt">~/bookmarks</p>');
    expect(html).toMatch(/<p class="cmdline" aria-hidden="true">[\s\S]*?cd ~\/bookmarks/);
    expect(html).toContain('Not my projects. Things my projects run on, docs I learned from, and work that inspired me. <strong>Every link here opens another site in a new tab.</strong>');
  });

  it('jump row lists every non-empty group in order and each link resolves to a section id', () => {
    const jump = /<p class="jump">([\s\S]*?)<\/p>/.exec(html)?.[1] ?? '';
    expect(text(jump)).toBe(`cd ${GROUPS.join(' ')}`);
    const targets = [...jump.matchAll(/href="#([^"]*)"/g)].map((m) => m[1]);
    expect(targets).toEqual(GROUPS.map(bookmarkTitle));
    for (const t of targets) expect(html).toContain(`id="${t}"`);
  });

  it('omits an empty group from the jump row and from the sections', async () => {
    const trimmed = { ...model, bookmarks: model.bookmarks.filter((g) => g.id !== 'general') };
    const BookmarksIntro = (await import('../../src/components/bookmarks/BookmarksIntro.astro')).default;
    const out = clean(await container.renderToString(asComponent(BookmarksIntro), { props: { groups: trimmed.bookmarks } }));
    expect(out).not.toContain('#bm-general');
    expect(out).toContain('#bm-reading');
  });
});

describe('relations legend', () => {
  it('lists each relation badge with its description in config order', () => {
    const rel = /<section[^>]*id="sec-w-rel"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';
    expect(rel).toContain(`<h2 id="${TITLES.rel}" class="tt">relations</h2>`);
    expect(rel).toMatch(/<p class="cmdline" aria-hidden="true">[\s\S]*?cat \.relations/);
    const items = [...rel.matchAll(/<span class="rel">([^<]*)<\/span><\/dt><dd>([^<]*)<\/dd>/g)].map((m) => [m[1], m[2]]);
    expect(items).toEqual(model.relations.map((r) => [r.id, r.description]));
    expect(items.length).toBeGreaterThan(0);
  });
});

describe('group windows', () => {
  it('there is one section per non-empty group in the specified order', () => {
    expect([...html.matchAll(/<section[^>]*id="(sec-bm-[^"]*)"/g)].map((m) => m[1])).toEqual(GROUPS.map(bookmarkSection));
    expect(model.bookmarks.map((g) => g.id)).toEqual(GROUPS);
  });

  it('title is `group/` in an h2 with the bm- id, cmd is ls -l ~/bookmarks/<group>', () => {
    const s = section('ffxiv');
    expect(s).toContain('<h2 id="bm-ffxiv" class="tt">ffxiv/</h2>');
    expect(s).toMatch(/<p class="cmdline" aria-hidden="true">[\s\S]*?ls -l ~\/bookmarks\/ffxiv/);
    expect(s).toMatch(/<section class="win accent-blue"/);
  });

  it('meta is N links · external, plus · group for free groups only', () => {
    expect(section('ffxiv')).toContain('<span class="tbm">3 links · external</span>');
    expect(section('reading')).toMatch(/<span class="tbm">\d+ links · external · group<\/span>/);
    expect(section('inspiration')).toContain('· external · group');
    expect(section('general')).not.toContain('· group');
    expect(section('general')).toMatch(/accent-teal/);
  });

  it('every bookmark is an external a.ext link with the arrow: 16 in total', () => {
    const exts = [...html.matchAll(/<a [^>]*class="ext nm"[^>]*>/g)].map((m) => m[0]);
    expect(exts).toHaveLength(16);
    expect(exts.every((a) => a.includes('target="_blank"') && a.includes('rel="noopener noreferrer"'))).toBe(true);
    expect([...html.matchAll(/<span class="xa" aria-hidden="true">↗<\/span>/g)].length).toBeGreaterThanOrEqual(16);
  });

  it('rows carry no status, updated, priority, version, get or source', () => {
    const bms = [...html.matchAll(/<ul class="bms">[\s\S]*?<\/ul>/g)].map((m) => m[0]).join('');
    expect(bms).not.toMatch(/class="st[ "]|data-updated|data-priority|data-status|class="ver"|slot-get|slot-src|updated/);
  });
});

describe('BookmarkRow', () => {
  const base: Bookmark = {
    name: 'Dalamud',
    url: 'https://github.com/goatcorp/Dalamud',
    host: 'github.com/goatcorp/Dalamud',
    note: 'The plugin framework.',
    relation: { id: 'uses', description: 'a dependency' },
    author: 'goatcorp',
    projects: [
      { slug: 'loch-lantern', name: 'Loch Lantern', path: '/ffxiv/loch-lantern/' },
      { slug: 'heather-hotbar', name: 'Heather Hotbar', path: '/ffxiv/heather-hotbar/' },
    ],
    groupId: 'ffxiv',
  };
  const row = async (b: Bookmark) => clean(await container.renderToString(asComponent(BookmarkRow), { props: { bookmark: b } }));

  it('symlink format: hidden permissions, name link, arrow, host, note, badge, author, related links', async () => {
    const out = await row(base);
    expect(out).toContain('<span class="perm" aria-hidden="true">lrwxrwxrwx</span>');
    expect(out).toMatch(/<a href="https:\/\/github.com\/goatcorp\/Dalamud" class="ext nm" target="_blank" rel="noopener noreferrer">Dalamud\u00a0/);
    expect(out).toContain('<span class="lnk" aria-hidden="true">-&gt;</span> <span class="host">github.com/goatcorp/Dalamud</span>');
    expect(out).toContain('<p>The plugin framework.</p>');
    expect(out).toContain('<span class="rel">uses</span>');
    expect(text(out)).toContain('by goatcorp');
    expect(text(out)).toContain('related: Loch Lantern, Heather Hotbar');
    expect(out).toContain('<a href="/ffxiv/loch-lantern/">Loch Lantern</a>, <a href="/ffxiv/heather-hotbar/">');
  });

  it('a bookmark without a relation (dropped) has no badge; without author or projects no by/related', async () => {
    const { relation: _r, author: _a, ...rest } = base;
    const out = await row({ ...rest, projects: [] });
    expect(out).not.toContain('class="rel"');
    expect(out).not.toContain('by ');
    expect(out).not.toContain('related');
    expect(out).not.toContain('class="bmeta"');
  });
});

describe('relation badge style', () => {
  const src = (rel: string) => readFile(fileURLToPath(new URL(`../../src/${rel}`, import.meta.url)), 'utf8');

  it('is defined once, in base.css, not in the components that render `.rel`', async () => {
    expect(await src('styles/base.css')).toMatch(/^\.rel \{/m);
    for (const f of ['components/bookmarks/RelationsLegend.astro', 'components/bookmarks/BookmarkRow.astro', 'components/bookmarks/BookmarkMini.astro']) {
      expect(await src(f), f).not.toMatch(/^\s*\.rel\s*\{/m);
    }
  });
});
