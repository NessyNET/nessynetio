// Project page shell (ux 4.3, 5.2, 7.10, 7.11; plan section 8): rendered through the Astro container against the
// frozen site-e2e content, plus component-level renders for states the content does not contain.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import Changelog from '../../src/components/project/Changelog.astro';
import ProjectRegion from '../../src/components/project/ProjectRegion.astro';
import { clearSiteMemo, loadSite } from '../../src/lib/content/index.ts';
import type { Project, SiteModel } from '../../src/lib/content/model.ts';
import Page, { getStaticPaths } from '../../src/pages/[category]/[slug]/index.astro';
import { withFixture } from '../helpers/content-fixture.ts';
import { SECTIONS, TITLES } from '../helpers/hooks.ts';

const E2E_DIR = fileURLToPath(new URL('../fixtures/site-e2e/', import.meta.url));

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
let model: SiteModel;

/** Points the page's memoised model at `dir` for the duration of `fn` (the gate is skipped under Vitest). */
async function withContent<T>(dir: string, fn: () => Promise<T>): Promise<T> {
  const before = process.env['NESSY_CONTENT_DIR'];
  process.env['NESSY_CONTENT_DIR'] = dir;
  clearSiteMemo();
  try {
    return await fn();
  } finally {
    if (before === undefined) delete process.env['NESSY_CONTENT_DIR'];
    else process.env['NESSY_CONTENT_DIR'] = before;
    clearSiteMemo();
  }
}

// Scoped styles stamp every element with a data-astro-cid-* attribute; it is not part of the markup under test.
const strip = (html: string) => html.replace(/ data-astro-cid-[a-z0-9]+/g, '');
type Component = Parameters<typeof container.renderToString>[0];
const renderPage = async (category: string, slug: string) =>
  strip(await container.renderToString(Page as unknown as Component, { params: { category, slug } }));
const render = async (component: Component, props: Record<string, unknown>) =>
  strip(await container.renderToString(component, { props }));

// Block-level boundaries read as a space, like they do for a screen reader.
const text = (html: string) => html.replace(/<\/(li|p|tr|td|th|div|dd|dt)>/g, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
// What a screen reader reads: drops aria-hidden spans.
const spoken = (html: string) => text(html.replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, ''));
const slice = (html: string, from: string, to: string) => {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`no "${from}" ... "${to}" in the markup`);
  return html.slice(start, end + to.length);
};
const main = (html: string) => slice(html, '<main ', '</main>');
const windowIds = (html: string) => [...html.matchAll(/<section class="win[^"]*" id="sec-w-([a-z0-9-]+)"/g)].map((m) => m[1]);
const mainColumn = (html: string) => main(html).split('<aside')[0] ?? '';
const sideColumn = (html: string) => '<aside' + (main(html).split('<aside')[1] ?? '');
const getbar = (html: string) => slice(html, '<div class="getbar">', '</ul></div>');
const project = (slug: string): Project => {
  const found = model.projectsBySlug.get(slug);
  if (found === undefined) throw new Error(`site-e2e has no project ${slug}`);
  return found;
};
const allProjects = () => [...model.projectsBySlug.values()];

beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://nessynet.io' } });
  const loaded = await loadSite({ dir: E2E_DIR, strict: true, allowSamples: false });
  if (loaded.model === null) throw new Error('site-e2e did not load');
  model = loaded.model;
  process.env['NESSY_CONTENT_DIR'] = E2E_DIR;
  clearSiteMemo();
});
afterAll(() => {
  delete process.env['NESSY_CONTENT_DIR'];
  clearSiteMemo();
});

describe('getStaticPaths', () => {
  it('has one path per project of every published category', async () => {
    const paths = await getStaticPaths();
    expect(paths.map((p: { params: { category: string; slug: string } }) => `${p.params.category}/${p.params.slug}`).sort()).toEqual(
      allProjects().map((p) => `${p.categoryId}/${p.slug}`).sort(),
    );
    expect(paths).toHaveLength(19);
  });

  it('builds a page with its name as the only h1 for every project in site-e2e', async () => {
    for (const p of allProjects()) {
      const html = await renderPage(p.categoryId, p.slug);
      expect([...html.matchAll(/<h1[ >]/g)], p.slug).toHaveLength(1);
      expect(html, p.slug).toContain(`<h1>${p.name}</h1>`);
    }
  });
});

describe('page frame', () => {
  it('sets title, canonical and the project status line', async () => {
    const html = await renderPage('ffxiv', 'loch-lantern');
    expect(html).toContain('<title>Loch Lantern · FFXIV · nessynet.io</title>');
    expect(html).toContain('<link rel="canonical" href="https://nessynet.io/ffxiv/loch-lantern/">');
    const status = slice(html, '<footer class="statusline"', '</footer>');
    expect(status).toContain('<span class="pth">~/ffxiv/loch-lantern</span>');
    expect(status).toContain('<span class="mid">active</span>');
    expect(status).toContain('<span class="rt">v2.3.1</span>');
  });

  it('marks the parent category tab aria-current=true', async () => {
    const html = await renderPage('ffxiv', 'loch-lantern');
    expect(slice(html, '<header class="tmux">', '</header>')).toMatch(/<a href="\/ffxiv\/"[^>]*aria-current="true"/);
  });
});

describe('breadcrumb', () => {
  it('is nav[aria-label=Breadcrumb]: ~ / category / type tag / slug, last crumb current and not a link', async () => {
    const html = await renderPage('ffxiv', 'loch-lantern');
    const nav = slice(html, '<nav class="crumb" aria-label="Breadcrumb">', '</nav>');
    const links = [...nav.matchAll(/<a href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(links).toEqual([
      ['/', '~'],
      ['/ffxiv/', 'ffxiv'],
      ['/ffxiv/?tag=plugin', 'plugin'],
    ]);
    expect(nav).toMatch(/<li aria-current="page"><span class="sep" aria-hidden="true">\/<\/span>loch-lantern<\/li><\/ol>/);
    expect(nav.match(/aria-current/g)).toHaveLength(1);
  });

  it('sits before the columns, as a direct child of main', async () => {
    const html = await renderPage('ffxiv', 'loch-lantern');
    expect(main(html).indexOf('class="crumb"')).toBeLessThan(main(html).indexOf('class="cols"'));
  });

  it('has no type crumb for a project with no type tag (local zero-type fallback)', async () => {
    await withFixture('project__type-tag-count', async (dir) =>
      withContent(dir, async () => {
        const html = await renderPage('ffxiv', 'gear-tweaks');
        const nav = slice(html, '<nav class="crumb" aria-label="Breadcrumb">', '</nav>');
        expect(text(nav).replaceAll(' ', '')).toBe('~/ffxiv/gear-tweaks');
        expect([...nav.matchAll(/<a /g)]).toHaveLength(2);
      }),
    );
  });
});

describe('main column', () => {
  it('orders README.md, INSTALL, screenshots, description, CHANGELOG, and drops what a project lacks', async () => {
    const RANK = ['readme', 'inst', 'shots', 'desc', 'log'];
    for (const p of allProjects()) {
      const ids = windowIds(mainColumn(await renderPage(p.categoryId, p.slug))).filter((id) => RANK.includes(id ?? ''));
      const ranks = ids.map((id) => RANK.indexOf(id ?? ''));
      expect(ranks, p.slug).toEqual([...ranks].sort((x, y) => x - y));
      expect(ids.includes('readme') && ids.includes('desc'), p.slug).toBe(true);
      expect(ids.includes('log'), p.slug).toBe(p.changelog.length > 0);
    }
  });

  it('has exactly README.md and description for a generic project without a changelog', async () => {
    const generic = allProjects().filter((p) => p.layout === 'generic' && p.changelog.length === 0);
    expect(generic.length).toBeGreaterThan(0);
    for (const p of generic) {
      expect(windowIds(mainColumn(await renderPage(p.categoryId, p.slug))), p.slug).toEqual(['readme', 'desc']);
    }
  });

  it('has the side column stat then see also, after the main column', async () => {
    const html = await renderPage('ffxiv', 'loch-lantern');
    expect(windowIds(sideColumn(html))).toEqual(['stat', 'see']);
    expect(main(html)).toMatch(/<div class="cols">\s*<div>[\s\S]*<\/div>\s*<aside aria-label="Project details">/);
  });

  it('renders no #install wrapper, no empty wrapper and no screenshots window while no layout adds them', async () => {
    const html = await renderPage('ffxiv', 'heather-hotbar');
    expect(project('heather-hotbar').screenshots).toHaveLength(0);
    expect(html).not.toContain('id="install"');
    expect(html).not.toContain(SECTIONS.shots);
  });

  it('uses the window title description, never about', async () => {
    const html = await renderPage('ffxiv', 'loch-lantern');
    expect(html).toContain(`<h2 id="${TITLES.desc}" class="tt">description</h2>`);
    expect(spoken(html)).not.toMatch(/\babout\b/i);
  });

  it('puts the README title in a p, with the slug as window meta', async () => {
    const html = await renderPage('ffxiv', 'loch-lantern');
    expect(html).toContain(`<p id="${TITLES.readme}" class="tt">README.md</p>`);
    expect(html).toContain('<span class="tbm">loch-lantern</span>');
  });

  it('renders the description as one paragraph per entry', async () => {
    const p = project('loch-lantern');
    const section = slice(await renderPage('ffxiv', 'loch-lantern'), `id="${SECTIONS.desc}"`, '</section>');
    expect([...section.matchAll(/<p class="out">/g)]).toHaveLength(p.description.length);
    expect(p.description.length).toBeGreaterThan(1);
  });
});

describe('README window', () => {
  it('has the lede, then a metaline with status word, version, updated and every tag as #tag links (type tag included)', async () => {
    const html = await renderPage('ffxiv', 'loch-lantern');
    const readme = slice(html, `id="${SECTIONS.readme}"`, '</section>');
    expect(readme).toContain('<p class="out">Hunt marks and FATEs glow on your minimap.</p>');
    const meta = slice(readme, '<p class="metaline">', '</p>');
    expect(text(meta)).toBe('[active] v2.3.1 updated 2026-10-28 #plugin #dalamud #api12');
    expect(spoken(meta)).toBe('active v2.3.1 updated 2026-10-28 plugin dalamud api12');
    const tags = [...meta.matchAll(/<a href="([^"]*)" class="tag">(.*?)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(tags).toEqual([
      ['/ffxiv/?tag=plugin', '<span aria-hidden="true">#</span>plugin'],
      ['/ffxiv/?tag=dalamud', '<span aria-hidden="true">#</span>dalamud'],
      ['/ffxiv/?tag=api12', '<span aria-hidden="true">#</span>api12'],
    ]);
  });

  it('has the get bar directly after the metaline, then the notice, as ul.acts with one li per slot', async () => {
    const html = await renderPage('ffxiv', 'peat-fishing-log');
    const readme = slice(html, `id="${SECTIONS.readme}"`, '</section>');
    expect(readme).toMatch(/<\/p><div class="getbar"><ul class="acts" aria-label="Availability"><li><span class="slot-get">[\s\S]*<\/span><\/li><li><span class="slot-src">[\s\S]*<\/span><\/li><\/ul><\/div><p class="notice /);
    expect(readme.indexOf('class="metaline"')).toBeLessThan(readme.indexOf('class="getbar"'));
    expect(readme.indexOf('class="getbar"')).toBeLessThan(readme.indexOf('class="notice '));
    expect([...getbar(html).matchAll(/<li>/g)]).toHaveLength(2);
  });

  it('has no notice for a public project', async () => {
    const readme = slice(await renderPage('ffxiv', 'loch-lantern'), `id="${SECTIONS.readme}"`, '</section>');
    expect(readme).not.toContain('class="notice');
  });
});

describe('availability variants (ux 5.2)', () => {
  const VARIANTS: { name: string; category: string; slug: string; bar: string; notice: string | null }[] = [
    { name: 'public, installable', category: 'ffxiv', slug: 'loch-lantern', bar: 'get: see install source: GitHub (opens in new tab)', notice: null },
    { name: 'download only, private source', category: 'minecraft', slug: 'bracken-biomes', bar: 'get: Modrinth (opens in new tab) Source not available', notice: null },
    { name: 'local only', category: 'ffxiv', slug: 'peat-fishing-log', bar: 'get: Not distributed (local only) Source not available', notice: 'local only:' },
    { name: 'private service', category: 'other', slug: 'ripple-bot', bar: 'get: Not distributed (private bot) Source not available', notice: 'private bot:' },
    { name: 'retired', category: 'ffxiv', slug: 'kelpie-chat-tabs', bar: 'get: No longer distributed source: GitHub (opens in new tab)', notice: 'retired: Retired on 2025-03-04.' },
    { name: 'web tool', category: 'ffxiv', slug: 'gorse-gearplanner', bar: 'get: Open tool: gear.nessynet.io (opens in new tab) source: GitHub (opens in new tab)', notice: 'separate site:' },
  ];

  for (const v of VARIANTS) {
    it(`${v.name}: exact get/source/notice strings, text slots are never links`, async () => {
      const html = await renderPage(v.category, v.slug);
      const bar = getbar(html);
      expect(spoken(bar)).toBe(v.bar);
      for (const slot of ['slot-get', 'slot-src']) {
        const inner = slice(bar, `<span class="${slot}">`, '</li>');
        if (inner.includes('class="na"')) expect(slice(inner, 'class="na"', '</span>')).not.toMatch(/<(a|button|del|s)[\s>]/);
      }
      const readme = slice(html, `id="${SECTIONS.readme}"`, '</section>');
      const notices = [...readme.matchAll(/<p class="notice [^"]*"><b>[^<]*<\/b>[^<]*<\/p>/g)].map((m) => spoken(m[0]));
      if (v.notice === null) expect(notices).toEqual([]);
      else {
        expect(notices).toHaveLength(1);
        expect(notices[0]?.startsWith(v.notice)).toBe(true);
      }
    });
  }

  it('says the retirement date once: the notice text does not repeat it', async () => {
    const html = await renderPage('ffxiv', 'kelpie-chat-tabs');
    const notice = slice(html, '<p class="notice ', '</p>');
    expect(notice.match(/2025-03-04/g)).toHaveLength(1);
  });
});

describe('stat window', () => {
  const rows = (html: string) =>
    [...slice(html, `id="${SECTIONS.stat}"`, '</section>').matchAll(/<tr><th scope="row">([^<]*)<\/th><td>([\s\S]*?)<\/td><\/tr>/g)].map((m) => [m[1] ?? '', m[2] ?? '']);
  const CORE = ['type', 'status', 'version', 'updated', 'get', 'source', 'issues', 'licence'];

  it('is a table with an sr-only caption, titled stat, with the command line stat <slug>', async () => {
    const stat = slice(await renderPage('ffxiv', 'loch-lantern'), `id="${SECTIONS.stat}"`, '</section>');
    expect(stat).toContain(`<h2 id="${TITLES.stat}" class="tt">stat</h2>`);
    expect(stat).toContain('<span class="p">$</span> stat loch-lantern');
    expect(stat).toMatch(/<table[^>]*><caption class="sr-only">[^<]+<\/caption><tbody>/);
  });

  it('orders type, status, version, updated, get, source, issues, licence when all exist', async () => {
    const p = project('loch-lantern');
    expect(p.issues).toBeDefined();
    expect(p.licence).toBeDefined();
    const names = rows(await renderPage('ffxiv', 'loch-lantern')).map(([name]) => name);
    expect(names.filter((n) => CORE.includes(n ?? ''))).toEqual(CORE);
  });

  it('drops issues and licence when absent, and shows the values', async () => {
    const p = project('peat-fishing-log');
    expect(p.issues).toBeUndefined();
    expect(p.licence).toBeUndefined();
    const found = rows(await renderPage('ffxiv', 'peat-fishing-log'));
    expect(found.map(([name]) => name).filter((n) => CORE.includes(n ?? ''))).toEqual(['type', 'status', 'version', 'updated', 'get', 'source']);
    const byName = Object.fromEntries(found);
    expect(text(byName['type'] ?? '')).toBe('offline tool');
    expect(text(byName['version'] ?? '')).toBe('0.4.0');
    expect(text(byName['updated'] ?? '')).toBe('2026-09-12');
    expect(spoken(byName['get'] ?? '')).toBe('Not distributed (local only)');
    expect(spoken(byName['source'] ?? '')).toBe('Source not available');
  });

  it('shows the source host and issues as links and the install link as "see install"', async () => {
    const byName = Object.fromEntries(rows(await renderPage('ffxiv', 'loch-lantern')));
    expect(spoken(byName['get'] ?? '')).toBe('see install');
    expect(byName['get']).toContain('href="#install"');
    expect(spoken(byName['source'] ?? '')).toBe('GitHub (opens in new tab)');
    expect(byName['issues']).toContain('href="https://example.com/loch-lantern/issues"');
    expect(text(byName['licence'] ?? '')).toBe('MIT');
  });

  it('omits the type row for a project with no type tag, and renders no empty element', async () => {
    await withFixture('project__type-tag-count', async (dir) =>
      withContent(dir, async () => {
        const html = await renderPage('ffxiv', 'gear-tweaks');
        const names = rows(html).map(([name]) => name);
        expect(names).not.toContain('type');
        expect(names.slice(0, 2)).toEqual(['status', 'version']);
        expect(main(html)).not.toMatch(/<(p|li|ul|ol|td|th|tr|dd|dt|div|section|span|a|h1|h2)\b[^>]*><\/\1>/);
        const loaded = await loadSite({ dir, strict: false, allowSamples: false });
        const p = loaded.model?.projectsBySlug.get('gear-tweaks');
        expect(p?.typeTag).toBeNull();
        expect(p?.layout).toBe('generic');
        expect(windowIds(html)).toContain('readme');
      }),
    );
  });
});

describe('see also', () => {
  const links = (html: string) => [...html.matchAll(/<li><a href="([^"]*)"[^>]*>([^<]*)<\/a><\/li>/g)].map((m) => [m[1], m[2]]);

  it('lists at most 3 other projects of the same category and never the page itself', async () => {
    for (const p of allProjects()) {
      const see = slice(await renderPage(p.categoryId, p.slug), `id="${SECTIONS.see}"`, '</section>');
      const mine = links(see);
      expect(mine.length, p.slug).toBeLessThanOrEqual(3);
      expect(mine, p.slug).toEqual(p.seeAlso.mine.map((m) => [`/${m.categoryId}/${m.slug}/`, m.name]));
      expect(mine.map(([href]) => href), p.slug).not.toContain(`/${p.categoryId}/${p.slug}/`);
    }
  });

  it('shows "elsewhere (not mine)" with the linked bookmarks, and omits it when there are none', async () => {
    const withBookmarks = project('loch-lantern');
    expect(withBookmarks.seeAlso.elsewhere.length).toBeGreaterThan(0);
    const see = slice(await renderPage('ffxiv', 'loch-lantern'), `id="${SECTIONS.see}"`, '</section>');
    expect(see).toContain('elsewhere (not mine)');
    expect([...see.matchAll(/<li><span class="lnk"/g)]).toHaveLength(withBookmarks.seeAlso.elsewhere.length);
    expect(see).toContain('href="/bookmarks/#bm-ffxiv"');
    const without = allProjects().find((p) => p.seeAlso.elsewhere.length === 0);
    expect(without).toBeDefined();
    const bare = slice(await renderPage(without?.categoryId ?? '', without?.slug ?? ''), `id="${SECTIONS.see}"`, '</section>');
    expect(bare).not.toContain('elsewhere');
    expect(bare).not.toContain('bmini');
  });

  it('falls back to "all <category> projects" for the only project of its category', async () => {
    await withFixture('_base', async (dir) =>
      withContent(dir, async () => {
        const html = await renderPage('ffxiv', 'gear-tweaks');
        const see = slice(html, `id="${SECTIONS.see}"`, '</section>');
        expect(see).toContain('more by me');
        expect(see).toMatch(/<a href="\/ffxiv\/">all ffxiv projects<\/a>/);
        expect(see).not.toContain('show all');
      }),
    );
  });
});

describe('changelog window', () => {
  const entry = (n: number) => ({ version: `1.${n}.0`, date: `2026-0${n}-01`, items: [`Change ${n}.`] });

  it('shows the newest 3 entries, newest first, with versions and dates', async () => {
    const p = { ...project('loch-lantern'), changelog: [entry(1), entry(5), entry(3), entry(4), entry(2)] };
    const html = await render(Changelog, { project: p });
    expect(html).toContain('<h2 id="w-log" class="tt">CHANGELOG</h2>');
    expect(html).toContain('<span class="p">$</span> git log --tags');
    expect([...html.matchAll(/<span class="v">(v[^<]*)<\/span>/g)].map((m) => m[1])).toEqual(['v1.5.0', 'v1.4.0', 'v1.3.0']);
    expect(html).toContain('<time datetime="2026-05-01">2026-05-01</time>');
    expect(html).not.toContain('<a ');
  });

  it('links to the full history when changelogUrl is set', async () => {
    const p = { ...project('loch-lantern'), changelogUrl: 'https://example.com/changes' };
    const html = await render(Changelog, { project: p });
    expect(html).toMatch(/<a href="https:\/\/example\.com\/changes"[^>]*>full history/);
  });

  it('renders nothing for an empty changelog', async () => {
    const html = await render(Changelog, { project: { ...project('loch-lantern'), changelog: [] } });
    expect(html.trim()).toBe('');
  });

  it('renders the page window only when the project has entries', async () => {
    const without = allProjects().find((p) => p.changelog.length === 0);
    if (without !== undefined) expect(await renderPage(without.categoryId, without.slug)).not.toContain(SECTIONS.log);
    expect(await renderPage('ffxiv', 'loch-lantern')).toContain(SECTIONS.log);
  });
});

describe('ProjectRegion', () => {
  it('renders nothing for any region of the generic layout, and of a layout that is not registered yet', async () => {
    for (const slug of ['urquhart-dice', 'loch-lantern', 'ripple-bot']) {
      for (const region of ['install', 'windows', 'stat']) {
        const html = await render(ProjectRegion, { project: project(slug), region });
        expect(html.trim(), `${slug} ${region}`).toBe('');
      }
    }
  });
});
