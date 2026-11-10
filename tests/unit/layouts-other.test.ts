// Minecraft, Linux and bot layouts (ux 4.3, 7.16, 8.5): INSTALL, windows and stat rows through the page, against site-e2e.
import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { clearSiteMemo, loadSite } from '../../src/lib/content/index.ts';
import ProjectRegion from '../../src/components/project/ProjectRegion.astro';
import type { Project, SiteModel } from '../../src/lib/content/model.ts';
import Page from '../../src/pages/[category]/[slug]/index.astro';

// The glob in images.ts follows the `@content` alias fixed when the config loads (`content/`), not the fixture under
// test, so the page tests stand in for the optimised image; the real pipeline is covered by screenshots.test.ts.
vi.mock('../../src/lib/images.ts', () => ({
  resolveScreenshot: () => ({ src: '/stub.png', width: 1600, height: 900, format: 'png' }),
}));

const dirOf = (name: string) => fileURLToPath(new URL(`../fixtures/${name}/`, import.meta.url));

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
let model: SiteModel;
type Component = Parameters<typeof container.renderToString>[0];

const strip = (html: string) => html.replace(/ data-astro-cid-[a-z0-9]+/g, '');
const renderPage = async (category: string, slug: string) =>
  strip(await container.renderToString(Page as unknown as Component, { params: { category, slug } }));
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


const tables = (html: string) => [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/g)].map((m) => m[1] ?? '');
const caption = (table: string) => /<caption class="sr-only">([^<]*)<\/caption>/.exec(table)?.[1];
const heads = (table: string) => [...table.matchAll(/<th scope="col">([^<]*)<\/th>/g)].map((m) => m[1]);
const rowsOf = (table: string) =>
  [...table.matchAll(/<tr><td[\s\S]*?<\/tr>/g)].map((m) => [...m[0].matchAll(/<td>([\s\S]*?)<\/td>/g)].map((c) => spoken(c[1] ?? '')));
const statNames = (html: string) => statRows(html).map(([n]) => n);
const stat = (html: string) => Object.fromEntries(statRows(html).map(([n, v]) => [n, spoken(v ?? '')]));
const dts = (html: string) => [...html.matchAll(/<dt>([^<]*)<\/dt>/g)].map((m) => m[1]);

describe('mod layout (peatmoss)', () => {
  it('orders README, INSTALL, versions, dependencies, screenshots, description', async () => {
    const html = await renderPage('minecraft', 'peatmoss');
    expect(windowIds(html).slice(0, 6)).toEqual(['readme', 'inst', 'ver', 'dep', 'shots', 'desc']);
    expect(count(html, 'id="install"')).toBe(1);
  });

  it('has loader, get links from the get entries, and the mods/ folder in INSTALL', async () => {
    const inst = section(await renderPage('minecraft', 'peatmoss'), 'inst');
    const steps = [...inst.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => spoken(m[1] ?? ''));
    expect(steps).toEqual([
      'Install the Fabric loader for your Minecraft version (see versions).',
      'Get Peatmoss from Modrinth (opens in new tab) or CurseForge (opens in new tab).',
      'Put the .jar and its required dependencies in your mods/ folder.',
    ]);
    expect(inst).toContain('href="https://example.com/modrinth/peatmoss"');
  });

  it('has a versions table: sr-only caption, th scope=col, one row per file', async () => {
    const html = await renderPage('minecraft', 'peatmoss');
    const ver = section(html, 'ver');
    expect(ver).toContain('<h2 id="w-ver" class="tt">versions</h2>');
    const [table] = tables(ver);
    expect(caption(table ?? '')).toBe('Compatible files');
    expect(heads(table ?? '')).toEqual(['minecraft', 'loader', 'file', 'released']);
    expect(rowsOf(table ?? '')).toEqual([
      ['1.21.1', 'fabric 0.16+', 'peatmoss-0.6.0+1.21.1.jar', '2026-10-05'],
      ['1.21.0', 'fabric 0.15+', 'peatmoss-0.5.2+1.21.jar', '2026-06-12'],
    ]);
  });

  it('has a dependencies table with external links and required/optional words', async () => {
    const dep = section(await renderPage('minecraft', 'peatmoss'), 'dep');
    const [table] = tables(dep);
    expect(caption(table ?? '')).toBe('Dependencies');
    expect(heads(table ?? '')).toEqual(['mod', 'need', 'why']);
    expect(rowsOf(table ?? '')).toEqual([
      ['Fabric API (opens in new tab)', 'required', 'core hooks'],
      ['Mod Menu (opens in new tab)', 'optional', 'in-game config screen'],
    ]);
    expect(dep).toMatch(/<a href="https:\/\/example\.com\/fabric-api" target="_blank" rel="noopener noreferrer">Fabric API/);
  });

  it('adds loader, minecraft and side to stat, between updated and get', async () => {
    const html = await renderPage('minecraft', 'peatmoss');
    expect(statNames(html).slice(0, 7)).toEqual(['type', 'status', 'version', 'updated', 'loader', 'minecraft', 'side']);
    expect(stat(html)).toMatchObject({ loader: 'Fabric', minecraft: '1.21, 1.21.1', side: 'both' });
  });

  it('has no versions/dependencies windows without data, and no INSTALL without get entries (loch-ores)', async () => {
    const html = await renderPage('minecraft', 'loch-ores');
    expect(project('loch-ores').layout).toBe('mod');
    expect(windowIds(html)).not.toEqual(expect.arrayContaining(['ver']));
    expect(windowIds(html)).not.toContain('dep');
    expect(windowIds(html)).not.toContain('inst');
    expect(html).not.toContain('id="install"');
  });
});

describe('modpack layout (highland-pack)', () => {
  it('has INSTALL with launcher, one import-link copy field and RAM', async () => {
    const html = await renderPage('minecraft', 'highland-pack');
    expect(windowIds(html).slice(0, 3)).toEqual(['readme', 'inst', 'mods']);
    const inst = section(html, 'inst');
    expect(count(inst, 'data-copy=')).toBe(1);
    expect(inst).toContain('data-copy="https://example.com/modrinth/highland-pack"');
    expect(inst).toContain('aria-label="Copy import link"');
    const text1 = spoken(inst);
    expect(text1).toContain('Prism Launcher');
    expect(text1).toContain('6 GB');
  });

  it('has mods.txt: first 5 mods, "Showing 5 of 42 mods", link to the full list', async () => {
    const mods = section(await renderPage('minecraft', 'highland-pack'), 'mods');
    expect(mods).toContain('<span class="tbm">42 mods</span>');
    expect(mods).toContain('<span class="p">$</span> head -n 5 mods.txt');
    const [table] = tables(mods);
    expect(caption(table ?? '')).toBe('Mods in this pack');
    expect(heads(table ?? '')).toEqual(['mod', 'version', 'by']);
    expect(rowsOf(table ?? '')).toHaveLength(5);
    expect(spoken(mods)).toContain('Showing 5 of 42 mods.');
    expect(mods).toMatch(/<a href="https:\/\/example\.com\/highland-pack\/mods\.txt"[^>]*>Full list \(mods\.txt\)/);
  });

  it('links own mods internally with a me badge, and others externally', async () => {
    const mods = section(await renderPage('minecraft', 'highland-pack'), 'mods');
    expect(mods).toMatch(/<a href="\/minecraft\/peatmoss\/">Peatmoss<\/a><\/td><td>0\.6\.0<\/td><td><span class="me">me<\/span>/);
    expect(mods).toMatch(/<a href="https:\/\/example\.com\/sodium" target="_blank"/);
    const internal = [...mods.matchAll(/<a href="(\/minecraft\/[^"]*)"/g)].map((m) => m[1]);
    expect(internal.length).toBeGreaterThan(0);
    for (const href of internal) expect(model.paths, href).toContain(href);
  });

  it('adds loader, minecraft, mods and memory to stat', async () => {
    const html = await renderPage('minecraft', 'highland-pack');
    expect(statNames(html).slice(0, 8)).toEqual(['type', 'status', 'version', 'updated', 'loader', 'minecraft', 'mods', 'memory']);
    expect(stat(html)).toMatchObject({ loader: 'Fabric 0.16', minecraft: '1.21.1', mods: '42', memory: '6 GB' });
  });
});

describe('modpack own mods without a matching project', () => {
  it('shows an unmatched mine mod as plain text with the me badge, not a link', async () => {
    const pack = project('highland-pack');
    if (pack.layout !== 'modpack') throw new Error('not a modpack');
    const synthetic = { ...pack, details: { ...pack.details, mods: [{ name: 'Missing Mod', version: '0.1.0', mine: true }] } };
    const html = strip(await container.renderToString(ProjectRegion, { props: { project: synthetic, region: 'windows' } }));
    expect(html).toContain('<td>Missing Mod</td><td>0.1.0</td><td><span class="me">me</span></td>');
    expect(html).not.toMatch(/<a [^>]*>Missing Mod/);
  });
});

describe('tool layout (lochctl)', () => {
  it('has one install block per method, each with its own copy field, and the long command unchanged', async () => {
    const html = await renderPage('linux', 'lochctl');
    expect(windowIds(html).slice(0, 4)).toEqual(['readme', 'inst', 'man', 'dist']);
    const inst = section(html, 'inst');
    const lochctl = project('lochctl');
    const methods = lochctl.layout === 'tool' ? lochctl.details.install : [];
    expect(methods).toHaveLength(3);
    expect([...inst.matchAll(/<h3>([^<]*)<\/h3>/g)].map((m) => m[1])).toEqual(methods.map((m) => m.method));
    expect(count(inst, 'data-copy=')).toBe(3);
    const long = methods[2]?.command ?? '';
    expect(long.length).toBeGreaterThan(100);
    const decode = (v: string) => v.replaceAll('&#38;', '&').replaceAll('&amp;', '&').replaceAll('&quot;', '"').replaceAll('&#39;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>');
    const codes = [...inst.matchAll(/<code>([\s\S]*?)<\/code>/g)].map((m) => decode(m[1] ?? ''));
    const copies = [...inst.matchAll(/data-copy="([^"]*)"/g)].map((m) => decode(m[1] ?? ''));
    expect(codes[2]).toBe(long);
    expect(copies[2]).toBe(long);
    expect(inst).toContain(`aria-label="Copy command: yay -S lochctl"`);
  });

  it('has 4 copy buttons on the page: 3 install methods and the example', async () => {
    expect(count(await renderPage('linux', 'lochctl'), 'data-copy=')).toBe(4);
  });

  it('has the man window: SYNOPSIS, COMMANDS, OPTIONS, EXAMPLE with a copy field', async () => {
    const man = section(await renderPage('linux', 'lochctl'), 'man');
    expect(man).toContain('<h2 id="w-man" class="tt">man lochctl</h2>');
    expect(dts(man.replace(/<dl class="opts">[\s\S]*?<\/dl>/g, ''))).toEqual(['SYNOPSIS', 'COMMANDS', 'OPTIONS', 'EXAMPLE']);
    expect(man).toContain('<code>lochctl [check | update | rollback | status] [options]</code>');
    expect(man).toContain('show pending updates and news that needs reading');
    expect(man).toContain('-n, --dry-run');
    expect(count(man, 'data-copy=')).toBe(1);
    expect(man).toContain('aria-label="Copy example command"');
  });

  it('has the distros table with support words', async () => {
    const dist = section(await renderPage('linux', 'lochctl'), 'dist');
    const [table] = tables(dist);
    expect(caption(table ?? '')).toBe('Supported distributions');
    expect(heads(table ?? '')).toEqual(['distro', 'support', 'how']);
    expect(rowsOf(table ?? '')).toEqual([
      ['Arch, EndeavourOS, CachyOS', 'supported', 'AUR'],
      ['Fedora, Debian, Ubuntu', 'works, untested', 'cargo / manual'],
      ['NixOS', 'not supported', '-'],
    ]);
  });

  it('adds language, needs and distros to stat', async () => {
    const html = await renderPage('linux', 'lochctl');
    expect(statNames(html).slice(0, 7)).toEqual(['type', 'status', 'version', 'updated', 'language', 'needs', 'distros']);
    // only `supported` distros: Fedora (untested) and NixOS (unsupported) are left out
    expect(stat(html)).toMatchObject({ language: 'Rust', needs: 'pacman, systemd', distros: 'Arch, EndeavourOS, CachyOS' });
  });

  it('has no distros window when the tool lists none, and the #install gate holds for every tool', async () => {
    const html = await renderPage('linux', 'peat-top');
    expect(windowIds(html)).not.toContain('dist');
    for (const p of [...model.projectsBySlug.values()].filter((x) => x.layout === 'tool')) {
      const page = await renderPage(p.categoryId, p.slug);
      expect(count(page, 'href="#install"') > 0, p.slug).toBe(count(page, 'id="install"') > 0);
    }
  });
});

describe('bot layout (ripple-bot)', () => {
  it('has no INSTALL, the private-bot get slot and notice, then the commands window', async () => {
    const html = await renderPage('other', 'ripple-bot');
    expect(html).not.toContain('id="install"');
    expect(windowIds(html).slice(0, 2)).toEqual(['readme', 'cmd']);
    expect(spoken(slice(html, '<div class="getbar">', '</ul></div>'))).toContain('get: Not distributed (private bot)');
    expect(html).toContain('<b>private bot:</b>');
  });

  it('has a commands table', async () => {
    const cmd = section(await renderPage('other', 'ripple-bot'), 'cmd');
    expect(cmd).toContain('<h2 id="w-cmd" class="tt">commands</h2>');
    const [table] = tables(cmd);
    expect(caption(table ?? '')).toBe('Bot commands');
    expect(heads(table ?? '')).toEqual(['command', 'what it does', 'who']);
    expect(rowsOf(table ?? '')).toEqual([
      ['/event new', 'create an FC event with a sign-up button', 'officers'],
      ['/remind', 'DM a reminder 30 minutes before an event', 'everyone'],
      ['/raid roster', 'show who signed up, by job', 'everyone'],
    ]);
  });

  it('adds platform, hosting and invite to stat', async () => {
    const html = await renderPage('other', 'ripple-bot');
    expect(statNames(html).slice(0, 7)).toEqual(['type', 'status', 'version', 'updated', 'platform', 'hosting', 'invite']);
    expect(stat(html)).toMatchObject({ platform: 'Discord', hosting: 'self-hosted', invite: 'not public' });
  });
});
