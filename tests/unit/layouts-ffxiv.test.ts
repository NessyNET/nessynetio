// FFXIV layouts (ux 4.3, 5.6, 5.11): plugin INSTALL, offline download steps, web tool windows and stat rows,
// through the page and through ProjectRegion, against site-e2e and site-stress.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import ProjectRegion from '../../src/components/project/ProjectRegion.astro';
import { clearSiteMemo, loadSite } from '../../src/lib/content/index.ts';
import type { Project, SiteModel } from '../../src/lib/content/model.ts';
import Page from '../../src/pages/[category]/[slug]/index.astro';

// The glob in images.ts follows the `@content` alias fixed when the config loads (`content/`), not the fixture under
// test, so the page tests stand in for the optimised image; the real pipeline is covered by screenshots.test.ts.
vi.mock('../../src/lib/images.ts', () => ({
  resolveScreenshot: () => ({ src: '/stub.png', width: 1600, height: 900, format: 'png' }),
}));

const dirOf = (name: string) => fileURLToPath(new URL(`../fixtures/${name}/`, import.meta.url));
const REPO_URL = 'https://repo.example.invalid/repo.json';

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
let model: SiteModel;
type Component = Parameters<typeof container.renderToString>[0];

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

const strip = (html: string) => html.replace(/ data-astro-cid-[a-z0-9]+/g, '');
const renderPage = async (category: string, slug: string) =>
  strip(await container.renderToString(Page as unknown as Component, { params: { category, slug } }));
const renderRegion = async (project: Project, region: string, extra: { repoUrl?: string } = { repoUrl: REPO_URL }) =>
  strip(await container.renderToString(ProjectRegion, { props: { project, region, ...extra } }));
const text = (html: string) => html.replace(/<\/(li|p|tr|td|th|div|dd|dt)>/g, ' ').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
const spoken = (html: string) => text(html.replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, ''));
const slice = (html: string, from: string, to: string) => {
  const start = html.indexOf(from);
  const end = html.indexOf(to, start);
  if (start < 0 || end < 0) throw new Error(`no "${from}" ... "${to}" in the markup`);
  return html.slice(start, end + to.length);
};
const section = (html: string, id: string) => slice(html, `id="sec-w-${id}"`, '</section>');
const count = (html: string, needle: string) => html.split(needle).length - 1;
const windowIds = (html: string) => [...html.matchAll(/<section class="win[^"]*" id="sec-w-([a-z0-9-]+)"/g)].map((m) => m[1]);
const statRows = (html: string) =>
  [...section(html, 'stat').matchAll(/<tr><th scope="row">([^<]*)<\/th><td>([\s\S]*?)<\/td><\/tr>/g)].map((m) => [m[1] ?? '', m[2] ?? '']);
const project = (slug: string): Project => {
  const found = model.projectsBySlug.get(slug);
  if (found === undefined) throw new Error(`no project ${slug}`);
  return found;
};

beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://nessynet.io' } });
  const loaded = await loadSite({ dir: dirOf('site-e2e'), strict: true, allowSamples: false });
  if (loaded.model === null) throw new Error('site-e2e did not load');
  model = loaded.model;
  process.env['NESSY_CONTENT_DIR'] = dirOf('site-e2e');
  clearSiteMemo();
});
afterAll(() => {
  delete process.env['NESSY_CONTENT_DIR'];
  clearSiteMemo();
});

describe('plugin layout', () => {
  it('has the INSTALL.md window inside one #install wrapper, after README and before description', async () => {
    const html = await renderPage('ffxiv', 'loch-lantern');
    expect(count(html, 'id="install"')).toBe(1);
    expect(html).toMatch(/<div id="install"><section class="win[^"]*" id="sec-w-inst"/);
    expect(windowIds(html).slice(0, 4)).toEqual(['readme', 'inst', 'shots', 'desc']);
    const inst = section(html, 'inst');
    expect(inst).toContain('<h2 id="w-inst" class="tt">INSTALL.md</h2>');
    expect(inst).toContain('<span class="p">$</span> cat INSTALL.md');
  });

  it('renders the Dalamud steps with code, strong and the project name, and one copy field with the repo_url', async () => {
    const inst = section(await renderPage('ffxiv', 'loch-lantern'), 'inst');
    // Spaces dropped: the copy field is a block, so its boundaries have no text space.
    const steps = [...inst.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => spoken(m[1] ?? '').replaceAll(' ', ''));
    expect(steps).toEqual([
      'Ingame,run/xlsettingsandopenExperimental.',
      `UnderCustomPluginRepositories,addthisURL,tickEnabled,save:${REPO_URL}copy`,
      'Run/xlplugins,searchLochLantern,install.',
    ]);
    expect(inst).toMatch(/<ol[^>]*>/);
    expect(inst).toContain('<code>/xlsettings</code>');
    expect(inst).toContain('<strong>Loch Lantern</strong>');
    expect(count(inst, 'data-copy=')).toBe(1);
    expect(inst).toContain(`data-copy="${REPO_URL}"`);
    expect(inst).toContain('aria-label="Copy repository URL"');
    // the copy field sits in the step flagged for it, not after the list
    expect(inst.indexOf('class="copyrow"')).toBeLessThan(inst.indexOf('</ol>'));
  });

  it('shows the caution as a warn: notice inside INSTALL.md, and none when there is no caution', async () => {
    const inst = section(await renderPage('ffxiv', 'loch-lantern'), 'inst');
    expect(inst).toMatch(/<p class="notice notice-yellow"><b>warn:<\/b> Custom repositories are not reviewed by the Dalamud team\. Only add ones you trust\.<\/p>/);
    const noCaution = { ...project('loch-lantern') } as Record<string, unknown>;
    delete noCaution['caution'];
    const html = await renderRegion(noCaution as unknown as Project, 'install');
    expect(html).toContain('id="sec-w-inst"');
    expect(html).not.toContain('class="notice');
  });

  it('adds a requires row to stat, between updated and get', async () => {
    const rows = statRows(await renderPage('ffxiv', 'loch-lantern')).map(([n]) => n);
    expect(rows.slice(0, 6)).toEqual(['type', 'status', 'version', 'updated', 'requires', 'get']);
    expect(Object.fromEntries(statRows(await renderPage('ffxiv', 'loch-lantern')))['requires']).toBe('Dalamud API 12');
  });

  it('gate: every plugin page with an install entry has exactly one #install that "see install" resolves to', async () => {
    const plugins = [...model.projectsBySlug.values()].filter((p) => p.layout === 'plugin');
    expect(plugins.length).toBeGreaterThanOrEqual(3);
    let withInstall = 0;
    for (const p of plugins) {
      const html = await renderPage(p.categoryId, p.slug);
      if (p.get.some((g) => g.kind === 'install')) {
        withInstall++;
        expect(count(html, 'id="install"'), p.slug).toBe(1);
        expect(count(html, 'href="#install"'), p.slug).toBeGreaterThanOrEqual(1);
      } else {
        expect(count(html, 'id="install"'), p.slug).toBe(0);
        expect(count(html, 'href="#install"'), p.slug).toBe(0);
        expect(html, p.slug).not.toContain('see install');
        expect(html, p.slug).not.toContain('id="sec-w-inst"');
      }
    }
    expect(withInstall).toBeGreaterThanOrEqual(2);
  });

  it('has no INSTALL and no empty wrapper for a plugin without install (retired), whose get slot says so', async () => {
    const html = await renderPage('ffxiv', 'kelpie-chat-tabs');
    expect(html).not.toContain('id="install"');
    expect(statRows(html).map(([n]) => n)).toContain('requires');
  });

  it('has no INSTALL and "Not distributed yet" for a plugin in a category without repo_url (site-stress)', async () => {
    await withContent(dirOf('site-stress'), async () => {
      const html = await renderPage('ffxiv', 'mark-board');
      expect(html).not.toContain('id="install"');
      expect(html).not.toContain('id="sec-w-inst"');
      expect(html).not.toContain('href="#install"');
      expect(html).not.toContain('data-copy');
      expect(spoken(slice(html, '<div class="getbar">', '</ul></div>'))).toContain('get: Not distributed yet');
    });
  });
});

describe('ProjectRegion with registered layouts', () => {
  it('renders the #install wrapper around a layout install region, exactly once', async () => {
    const html = await renderRegion(project('loch-lantern'), 'install');
    expect(html).toMatch(/^<div id="install"><section [^>]*id="sec-w-inst"[\s\S]*<\/section><\/div>$/);
    expect(count(html, 'id="install"')).toBe(1);
    expect(html).not.toMatch(/id="install"[\s\S]*id="install"/);
  });

  it('takes the repo URL from the repoUrl prop, not from the model', async () => {
    const html = await renderRegion(project('loch-lantern'), 'install', { repoUrl: 'https://other.example.invalid/x.json' });
    expect(html).toContain('data-copy="https://other.example.invalid/x.json"');
    expect(html).not.toContain(REPO_URL);
    expect((await renderRegion(project('loch-lantern'), 'install', {})).trim()).toBe('');
  });

  it('renders nothing for install when the project has no install entry, and for windows on a plugin', async () => {
    expect((await renderRegion(project('kelpie-chat-tabs'), 'install')).trim()).toBe('');
    expect((await renderRegion(project('loch-lantern'), 'windows')).trim()).toBe('');
  });

  it('renders only <tr> rows for the stat region', async () => {
    const html = (await renderRegion(project('loch-lantern'), 'stat')).trim();
    expect(html).toMatch(/^<tr>[\s\S]*<\/tr>$/);
    expect(html.replace(/<tr>[\s\S]*?<\/tr>/g, '')).toBe('');
  });
});

describe('offline layout', () => {
  it('renders download steps from the download get entries, inside #install', async () => {
    const html = await renderPage('ffxiv', 'mist-macro-editor');
    expect(count(html, 'id="install"')).toBe(1);
    const inst = section(html, 'inst');
    expect(inst).toContain('<span class="p">$</span> cat INSTALL.md');
    expect(inst).toContain('href="https://example.com/downloads/mist-macro-editor-1.2.0.zip"');
    expect(count(inst, '<li>')).toBeGreaterThanOrEqual(1);
    expect(windowIds(html).slice(0, 2)).toEqual(['readme', 'inst']);
  });

  it('renders no INSTALL for an offline project without a download (local only, or retired)', async () => {
    for (const slug of ['peat-fishing-log']) {
      const html = await renderPage('ffxiv', slug);
      expect(html, slug).not.toContain('id="install"');
      expect(html, slug).not.toContain('id="sec-w-inst"');
    }
  });

  it('adds requires to stat when the project has it', async () => {
    const rows = Object.fromEntries(statRows(await renderPage('ffxiv', 'peat-fishing-log')));
    expect(rows['requires']).toBe('Windows or Linux, Python 3.12');
  });
});

describe('web layout', () => {
  it('has no INSTALL; what-it-does and preview windows follow README, then the changelog; no description window', async () => {
    const html = await renderPage('ffxiv', 'gorse-gearplanner');
    expect(html).not.toContain('id="install"');
    expect(windowIds(html).slice(0, 4)).toEqual(['readme', 'what', 'prev', 'log']);
    expect(windowIds(html)).not.toContain('desc');
  });

  it('what it does holds the description and ends with the primary Open tool button, in a new tab', async () => {
    const what = section(await renderPage('ffxiv', 'gorse-gearplanner'), 'what');
    expect(what).toContain('<h2 id="w-what" class="tt">what it does</h2>');
    expect(what).toContain('Pick a job and a raid tier');
    const button = slice(what, '<a href="https://gear.nessynet.io"', '</a>');
    expect(button).toMatch(/class="btn-open"/);
    expect(button).toMatch(/target="_blank" rel="noopener noreferrer"/);
    expect(spoken(button)).toBe('Open tool gear.nessynet.io (opens in new tab)');
    expect(what.lastIndexOf('btn-open')).toBeGreaterThan(what.lastIndexOf('<p class="out">'));
  });

  it('preview holds the static-screenshot caption; no preview window without screenshots', async () => {
    const prev = section(await renderPage('ffxiv', 'gorse-gearplanner'), 'prev');
    expect(prev).toContain('<h2 id="w-prev" class="tt">preview</h2>');
    expect(prev).toContain('A screenshot, not a live embed. Use &quot;Open tool&quot; for the real thing.');
    const ledger = await renderPage('ffxiv', 'retainer-ledger');
    expect(project('retainer-ledger').screenshots).toHaveLength(0);
    expect(windowIds(ledger)).not.toContain('prev');
  });

  it('has the get link naming the host in a new tab, and the separate-site notice', async () => {
    const html = await renderPage('ffxiv', 'gorse-gearplanner');
    const bar = slice(html, '<div class="getbar">', '</ul></div>');
    expect(bar).toMatch(/<a href="https:\/\/gear\.nessynet\.io" target="_blank" rel="noopener noreferrer">Open tool: gear\.nessynet\.io/);
    expect(html).toMatch(/<p class="notice notice-cyan leaves"><b>separate site:<\/b>/);
  });

  it('adds host, runs in, account and data rows to stat, between updated and get', async () => {
    const rows = statRows(await renderPage('ffxiv', 'gorse-gearplanner'));
    expect(rows.map(([n]) => n).slice(0, 8)).toEqual(['type', 'status', 'version', 'updated', 'host', 'runs in', 'account', 'data']);
    const by = Object.fromEntries(rows);
    expect(by['host']).toBe('gear.nessynet.io');
    expect(by['runs in']).toBe('any modern browser');
    expect(by['account']).toBe('none');
    expect(by['data']).toBe('stays in your browser');
  });
});
