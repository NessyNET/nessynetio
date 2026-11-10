import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import ProjectRow from '../../src/components/category/ProjectRow.astro';
import ProjectPage from '../../src/pages/[category]/[slug]/index.astro';
import CategoryPage, { getStaticPaths } from '../../src/pages/[category]/index.astro';
import { clearSiteMemo, loadSite } from '../../src/lib/content/index.ts';
import type { Project, SiteModel } from '../../src/lib/content/model.ts';
import { SECTIONS } from '../helpers/hooks.ts';

// Project pages import optimised screenshots through a glob fixed to `content/`; stand in for it (see project-page.test.ts).
vi.mock('../../src/lib/images.ts', () => ({
  resolveScreenshot: () => ({ src: '/stub.png', width: 1600, height: 900, format: 'png' }),
}));

const E2E_DIR = fileURLToPath(new URL('../fixtures/site-e2e', import.meta.url));
const STRESS_DIR = fileURLToPath(new URL('../fixtures/site-stress', import.meta.url));
const NOJS_CSS = fileURLToPath(new URL('../../src/styles/nojs.css', import.meta.url));

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
let model: SiteModel;

beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://nessynet.io' } });
  const { model: loaded } = await loadSite({ dir: E2E_DIR, strict: true, allowSamples: false });
  if (loaded === null) throw new Error('site-e2e does not load');
  model = loaded;
});
afterAll(() => {
  delete process.env['NESSY_CONTENT_DIR'];
  delete process.env['NESSY_STRICT'];
  clearSiteMemo();
});

// Scoped styles stamp every element with a data-astro-cid-* attribute; it is not part of the markup under test.
const clean = (html: string) => html.replace(/ data-astro-cid-[a-z0-9]+/g, '');
const text = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

async function page(dir: string, categoryId: string, strict = true): Promise<string> {
  process.env['NESSY_CONTENT_DIR'] = dir;
  process.env['NESSY_STRICT'] = strict ? '1' : '0';
  clearSiteMemo();
  return clean(await container.renderToString(CategoryPage as unknown as Parameters<typeof container.renderToString>[0], { params: { category: categoryId } }));
}

const attr = (open: string, name: string) => new RegExp(`\\s${name}(?:="([^"]*)")?[\\s>]`).exec(open + ' ')?.[1];
const rowOpens = (html: string) => [...html.matchAll(/<li ([^>]*\bdata-tags=[^>]*)>/g)].map((m) => m[1] ?? '');
const chips = (html: string) => [...html.matchAll(/<button [^>]*class="chip"[^>]*>/g)].map((m) => m[0]);

describe('getStaticPaths', () => {
  it('lists the published categories only', async () => {
    process.env['NESSY_CONTENT_DIR'] = E2E_DIR;
    process.env['NESSY_STRICT'] = '1';
    clearSiteMemo();
    const paths = await getStaticPaths();
    expect(paths.map((p: { params: { category: string } }) => p.params.category)).toEqual(['ffxiv', 'minecraft', 'linux', 'other']);
  });
});

describe('ffxiv page (repo_url set)', () => {
  let html: string;
  beforeAll(async () => {
    html = await page(E2E_DIR, 'ffxiv');
  });

  it('header window h: p title ~/ffxiv, hidden cd command, plain h1 label, blurb', () => {
    expect(html).toContain(`id="${SECTIONS.h}"`);
    expect(html).toContain('<p id="w-h" class="tt">~/ffxiv</p>');
    expect(html).toMatch(/<p class="cmdline" aria-hidden="true">[\s\S]*?cd ~\/ffxiv/);
    expect(html).toContain('<h1>Final Fantasy XIV</h1>');
    expect([...html.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
    expect(html).toContain('<p class="out">Dalamud plugins, browser tools, and desktop apps.');
  });

  it('repo window sits beside the header in .pair and holds the repo URL copy field', () => {
    expect(html).toMatch(/<div class="pair">\s*<section[^>]*id="sec-w-h"[\s\S]*<section[^>]*id="sec-w-repo"[\s\S]*<\/div>\s*<section[^>]*id="sec-w-ls"/);
    expect(html).toContain('<h2 id="w-repo" class="tt">repo.json</h2>');
    expect(html).toContain('<code>https://repo.example.invalid/repo.json</code>');
    expect(html).toContain('aria-label="Copy repository URL"');
  });

  it('the bookmarks window goes below projects, not beside the header', () => {
    expect(html.indexOf(`id="${SECTIONS.bm}"`)).toBeGreaterThan(html.indexOf(`id="${SECTIONS.ls}"`));
    expect(html).toContain('ls -l ~/bookmarks/ffxiv');
    expect(html).toContain('href="/bookmarks/#bm-ffxiv"');
  });

  it('projects window: title, count meta hook, ls prompt with an empty flag hook', () => {
    expect(html).toContain('<h2 id="w-ls" class="tt">projects</h2>');
    expect(html).toMatch(/<span class="tbm"><span data-count>8 projects<\/span><\/span>/);
    expect(html).toMatch(/<p class="cmdline lsline" aria-hidden="true">[\s\S]*?ls ~\/ffxiv<\/span><span class="arg" data-ls-arg><\/span>/);
  });

  it('chips: all first (pressed, N), then used tags in config order with counts and descriptions', () => {
    const cs = chips(html);
    const tags = cs.map((c) => attr(c, 'data-tag'));
    expect(tags).toEqual(['all', 'plugin', 'web', 'offline', 'dalamud', 'api12', 'windows', 'linux', 'gear']);
    expect(cs.map((c) => attr(c, 'aria-pressed'))).toEqual(['true', ...Array(8).fill('false')]);
    expect(cs.every((c) => c.includes('type="button"'))).toBe(true);
    expect(html).toMatch(/data-tag="all" aria-pressed="true">all <span class="c">8<\/span>/);
    expect(html).toMatch(/data-tag="plugin"[^>]*><span class="h" aria-hidden="true">#<\/span>plugin <span class="c">3<\/span><span class="desc"> Dalamud plugin; installs from the custom repo<\/span>/);
    expect(html).not.toContain('qol');
  });

  it('tag row: labelled group, hidden +more toggle with controls, hidden empty panel', () => {
    expect(html).toMatch(/<span class="flabel">tag<\/span>/);
    expect(html).toMatch(/<div class="chips" role="group" aria-label="tag" data-chiprow>/);
    expect(html).toMatch(/<button type="button" class="more" data-more aria-expanded="false" aria-controls="more-tags" hidden>/);
    expect(html).toMatch(/<div class="morepanel" id="more-tags" role="group" aria-label="More tags" data-morepanel hidden><\/div>/);
  });

  it('sort row: select with three modes, direction button with its name, count', () => {
    expect(html).toContain('<label for="sort-field">sort</label>');
    expect(html).toMatch(/<select id="sort-field" data-sort-field>\s*<option value="default">default \(ranked\)<\/option>\s*<option value="name">alphabetical<\/option>\s*<option value="updated">updated<\/option>\s*<\/select>/);
    expect(html).toContain('data-sort-dir');
    expect(html).toContain('aria-label="Sort direction: ascending. Activate to reverse."');
    expect(html).toContain('asc ↑');
    expect(html).toMatch(/<span class="count m" data-count aria-hidden="true">8 projects<\/span>/);
  });

  it('empty-filter state is hidden by default with a clear button', () => {
    expect(html).toMatch(/<div class="empty" data-empty hidden><p><span class="r">0 projects<\/span> tagged <span data-term><\/span> in Final Fantasy XIV\. <button type="button" class="linkbtn" data-clear>show all Final Fantasy XIV projects<\/button><\/p><\/div>/);
  });

  it('rows are in default order, retired last, with data attributes', () => {
    const opens = rowOpens(html);
    expect(opens.map((o) => attr(o, 'data-name'))).toEqual(model.categories[0]?.projects.map((p) => p.slug));
    expect(opens.map((o) => attr(o, 'data-status'))).toEqual([...Array(6).fill('active'), 'retired', 'retired']);
    expect(opens.map((o) => attr(o, 'data-priority'))).toEqual(['1', '2', '3', '4', '5', '6', '7', '8']);
    expect(opens[0]).toContain('data-tags="plugin dalamud api12"');
    expect(opens[0]).toContain('data-updated="2026-10-28"');
    expect(html).toMatch(/<ul class="rows" data-filter-target>/);
  });

  it('hashtags are plain text spans with a literal #, including the type tag; there are no button.tag', () => {
    expect([...html.matchAll(/<button [^>]*class="[^"]*\btag\b/g)]).toHaveLength(0);
    const first = /<div class="tags" role="group" aria-label="Tags for loch-lantern">([\s\S]*?)<\/div>/.exec(html)?.[1] ?? '';
    expect([...first.matchAll(/<span class="tag rt" data-tag="([^"]*)">/g)].map((m) => m[1])).toEqual(['plugin', 'dalamud', 'api12']);
    expect([...first.matchAll(/<span class="tag rt"[^>]*>(<span[^>]*>#<\/span>[^<]*)<\/span>/g)].map((m) => text(m[1] ?? ''))).toEqual(['#plugin', '#dalamud', '#api12']);
  });

  it('a row: status word, slug link, type label, version, summary, updated, actions list', () => {
    const row = /<li [^>]*data-name="loch-lantern"[\s\S]*?<\/li><\/ul><\/li>|<li [^>]*data-name="loch-lantern"[\s\S]*?<ul class="acts"[\s\S]*?<\/ul>/.exec(html)?.[0] ?? '';
    expect(row).toContain('<span class="st st-active">');
    expect(row).toMatch(/<h3><a href="\/ffxiv\/loch-lantern\/">loch-lantern<\/a> <span class="k">plugin<\/span> <span class="ver">v2\.3\.1<\/span><\/h3>/);
    expect(row).toContain('updated <time datetime="2026-10-28">2026-10-28</time>');
    expect(row).toMatch(/<ul class="acts" aria-label="Availability"><li><span class="slot-get">/);
    expect(row).toMatch(/<\/span><\/li><li><span class="slot-src">/);
  });

  it('a retired row marks itself for the dimmer name style', () => {
    expect(html).toMatch(/<li [^>]*data-status="retired"[^>]*class="row r-retired"|<li [^>]*class="row r-retired"[^>]*data-status="retired"/);
  });

  it('status line carries the live-value hooks', () => {
    expect(html).toContain('<span data-tag-name>all</span>');
    expect(html).toContain('<span data-sort-name>default</span>');
    expect(html).toMatch(/<span data-count>8 projects<\/span><\/span><a /);
    expect(html).toContain('<title>Final Fantasy XIV · nessynet.io</title>');
  });

  it('every control is inside an element nojs.css hides', async () => {
    const css = await readFile(NOJS_CSS, 'utf8');
    const hidden = ['.controls', '.copy', '.more', '[data-ls-arg]', '[data-js-only]'].filter((s) => css.includes(s));
    expect(hidden).toHaveLength(5);
    const controls = /<div class="controls" data-js-only>([\s\S]*?)<\/div><\/div><ul class="rows"/.exec(html)?.[1] ?? '';
    expect(controls).toContain('data-chiprow');
    expect(controls).toContain('data-sort-field');
    const outside = html.replace(/<div class="controls" data-js-only>[\s\S]*?<\/div><\/div><ul class="rows"/, '<ul class="rows"');
    const visibleButtons = [...outside.matchAll(/<(button|select)\b[^>]*>/g)].map((m) => m[0]).filter((b) => !/class="copy"|data-clear/.test(b));
    expect(visibleButtons).toEqual([]);
    expect(outside).toMatch(/<div class="empty" data-empty hidden>/);
  });
});

describe('row install links (C1)', () => {
  it('every #install href on a category page points at a project page that has an install section', async () => {
    const projectHtml = async (categoryId: string, slug: string) => {
      process.env['NESSY_CONTENT_DIR'] = E2E_DIR;
      process.env['NESSY_STRICT'] = '1';
      clearSiteMemo();
      return container.renderToString(ProjectPage as unknown as Parameters<typeof container.renderToString>[0], { params: { category: categoryId, slug } });
    };
    let checked = 0;
    for (const cat of model.categories) {
      const hrefs = [...(await page(E2E_DIR, cat.id)).matchAll(/href="([^"]*#install)"/g)].map((m) => m[1] ?? '');
      for (const href of hrefs) {
        const m = /^\/([^/]+)\/([^/]+)\/#install$/.exec(href);
        expect(m, href).not.toBeNull();
        expect(await projectHtml(m?.[1] ?? '', m?.[2] ?? ''), href).toContain('id="install"');
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });
});

describe('other categories (e2e)', () => {
  it('minecraft: no repo_url, so bookmarks sit beside the header and nothing is below projects', async () => {
    const html = await page(E2E_DIR, 'minecraft');
    expect(html).not.toContain('sec-w-repo');
    expect(html).toMatch(/<div class="pair">\s*<section[^>]*id="sec-w-h"[\s\S]*<section[^>]*id="sec-w-bm"[\s\S]*<\/div>\s*<section[^>]*id="sec-w-ls"/);
    expect([...html.matchAll(/id="sec-w-bm"/g)]).toHaveLength(1);
  });

  it('other: no bookmarks window, header spans the full width (no .pair)', async () => {
    const html = await page(E2E_DIR, 'other');
    expect(html).not.toContain('sec-w-bm');
    expect(html).not.toContain('sec-w-repo');
    expect(html).not.toContain('class="pair"');
    expect(html).toContain('<h1>Other projects</h1>');
    expect(html).toContain('3 projects');
  });
});

describe('stress site', () => {
  it('ffxiv without repo_url: no repo window, bookmarks beside the header', async () => {
    const html = await page(STRESS_DIR, 'ffxiv', false);
    expect(html).not.toContain('sec-w-repo');
    expect(html).not.toContain('repo.json');
    expect(html).toMatch(/<div class="pair">\s*<section[^>]*id="sec-w-h"[\s\S]*<section[^>]*id="sec-w-bm"/);
  });

  it('opt-in empty category: .emptycat message, no controls, no rows, link to all projects', async () => {
    const html = await page(STRESS_DIR, 'terraria', false);
    expect(html).toContain('<h2 id="w-ls" class="tt">projects</h2>');
    expect(html).toContain('<span class="tbm">0 projects</span>');
    expect(html).toContain('<p class="emptycat"><b>Nothing here yet.</b> This section is set up for Terraria, but none are published. Meanwhile, see <a href="/">all projects</a>.</p>');
    expect(html).not.toContain('class="controls"');
    expect(html).not.toContain('class="rows"');
    expect(html).not.toContain('data-chiprow');
    expect(html).not.toContain('data-empty');
    expect(html).toMatch(/ls ~\/terraria/);
    const footer = /<footer[\s\S]*<\/footer>/.exec(html)?.[0] ?? '';
    expect(footer).toMatch(/<span class="mid">0 projects<\/span><span class="sp"><\/span><span class="rt">empty<\/span>/);
    expect(footer).not.toContain('data-tag-name');
  });
});

describe('ProjectRow', () => {
  let loch: Project;
  beforeAll(() => {
    loch = model.categories[0]?.projects[0] as Project;
  });

  it('a project with no type tag renders a full row without any type label', async () => {
    const p = { ...loch, typeTag: null } as Project;
    const html = clean(await container.renderToString(ProjectRow, { props: { project: p } }));
    expect(html).not.toContain('class="k"');
    expect(html).toMatch(/<h3><a href="\/ffxiv\/loch-lantern\/">loch-lantern<\/a> <span class="ver">v2\.3\.1<\/span><\/h3>/);
    expect(html).toContain(p.summary);
    expect(html).toContain('class="acts"');
  });

  it('a project with no version omits the version span', async () => {
    const { version: _v, ...rest } = loch;
    const html = clean(await container.renderToString(ProjectRow, { props: { project: rest as Project } }));
    expect(html).not.toContain('class="ver"');
  });
});
