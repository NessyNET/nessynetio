import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import LinksTxt from '../../src/components/landing/LinksTxt.astro';
import LsHome from '../../src/components/landing/LsHome.astro';
import UpdatesLog from '../../src/components/landing/UpdatesLog.astro';
import Whoami from '../../src/components/landing/Whoami.astro';
import { clearSiteMemo, loadSite } from '../../src/lib/content/index.ts';
import type { SiteModel, Whoami as WhoamiData } from '../../src/lib/content/model.ts';
import Landing from '../../src/pages/index.astro';
import { SECTIONS, TITLES } from '../helpers/hooks.ts';

const E2E_DIR = fileURLToPath(new URL('../fixtures/site-e2e', import.meta.url));

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
let model: SiteModel;

beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://nessynet.io' } });
  const { model: loaded, diagnostics } = await loadSite({ dir: E2E_DIR, strict: true, allowSamples: false });
  if (loaded === null) throw new Error(`site-e2e does not load: ${JSON.stringify(diagnostics)}`);
  model = loaded;
});

// Scoped styles stamp every element with a data-astro-cid-* attribute; it is not part of the markup under test.
const render = async (component: Parameters<typeof container.renderToString>[0], props: Record<string, unknown>) =>
  (await container.renderToString(component, { props })).replace(/ data-astro-cid-[a-z0-9]+/g, '');
const text = (html: string) => html.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const whoamiOf = (over: Partial<WhoamiData>): WhoamiData => ({ ...(model.whoami as WhoamiData), ...over });

describe('Whoami', () => {
  it('is window who with a p title, holding the page h1 and p.bio', async () => {
    const html = await render(Whoami, { whoami: model.whoami });
    expect(html).toContain(`id="${SECTIONS.who}"`);
    expect(html).toContain(`<p id="${TITLES.who}" class="tt">whoami</p>`);
    expect([...html.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
    expect(html).not.toMatch(/<h1[^>]*class=/);
    expect(html).toMatch(/<p class="out bio">FFXIV plugins and web tools/);
  });

  it('h1 reads "{name}. {plain tagline}" and its cursor is aria-hidden', async () => {
    const html = await render(Whoami, { whoami: model.whoami });
    const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '';
    expect(text(h1)).toBe('Nessy. I make plugins, mods and small tools.');
    expect(h1).toMatch(/<span class="cursor" aria-hidden="true"><\/span>$/);
  });

  it('tagline accents are acc-* spans in order, never em or strong', async () => {
    const html = await render(Whoami, { whoami: model.whoami });
    const h1 = /<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '';
    expect([...h1.matchAll(/<span class="(acc-[a-z]+)">([^<]*)<\/span>/g)].map((m) => [m[1], m[2]])).toEqual([
      ['acc-green', 'plugins'],
      ['acc-yellow', 'mods'],
      ['acc-cyan', 'small tools'],
    ]);
    expect(html).not.toMatch(/<(em|strong)[\s>]/);
  });

  it('has no tagline wrapper content when the tagline is absent', async () => {
    const html = await render(Whoami, { whoami: whoamiOf({ tagline: null, taglinePlain: null }) });
    expect(text(/<h1>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '')).toBe('Nessy.');
  });

  it('keeps a long bio whole', async () => {
    const bio = 'word '.repeat(86).trim();
    expect(text(await render(Whoami, { whoami: whoamiOf({ bio }) }))).toContain(bio);
  });

  it('has no "about" window or text', async () => {
    expect(text(await render(Whoami, { whoami: model.whoami })).toLowerCase()).not.toContain('about');
  });
});

describe('LinksTxt', () => {
  const rows = (html: string) => [...html.matchAll(/<dt>([\s\S]*?)<\/dt><dd>([\s\S]*?)<\/dd>/g)].map((m) => [text(m[1] ?? ''), m[2] ?? '']);

  it('is window links with h2 title, hidden cat command and exactly github and mail rows', async () => {
    const html = await render(LinksTxt, { links: model.whoami?.links });
    expect(html).toContain(`id="${SECTIONS.links}"`);
    expect(html).toContain(`<h2 id="${TITLES.links}" class="tt">links.txt</h2>`);
    expect(html).toMatch(/<p class="cmdline" aria-hidden="true">[\s\S]*cat links.txt/);
    expect(rows(html).map(([k]) => k)).toEqual(['github:', 'mail:']);
  });

  it('github is an external Link showing host and path, mail is a mailto link', async () => {
    const [github, mail] = rows(await render(LinksTxt, { links: model.whoami?.links }));
    expect(github?.[1]).toMatch(/<a href="https:\/\/github.com\/example" target="_blank" rel="noopener noreferrer">github.com\/example\u00a0/);
    expect(mail?.[1]).toBe('<a href="mailto:hello@nessynet.io">hello@nessynet.io</a>');
  });

  it('displays the GitHub URL without scheme and trailing slash', async () => {
    const [github] = rows(await render(LinksTxt, { links: { github: 'https://github.com/nessy/' } }));
    expect(text(github?.[1] ?? '')).toMatch(/^github\.com\/nessy( |$)/);
    expect(github?.[1]).toContain('href="https://github.com/nessy/"');
  });

  it('a missing key omits its row', async () => {
    const onlyMail = rows(await render(LinksTxt, { links: { mail: 'a@b.test' } }));
    expect(onlyMail.map(([k]) => k)).toEqual(['mail:']);
    const onlyGithub = rows(await render(LinksTxt, { links: { github: 'https://github.com/x' } }));
    expect(onlyGithub.map(([k]) => k)).toEqual(['github:']);
  });

  it('renders nothing when both are missing', async () => {
    expect((await render(LinksTxt, { links: {} })).trim()).toBe('');
  });

  it('has no Discord, Ko-fi or other link', async () => {
    const html = await render(LinksTxt, { links: model.whoami?.links });
    expect(html).not.toMatch(/discord|ko-fi/i);
    expect([...html.matchAll(/<a /g)]).toHaveLength(2);
  });
});

describe('LsHome', () => {
  let html: string;
  beforeAll(async () => {
    html = await render(LsHome, { categories: model.categories, bookmarkCount: 16 });
  });
  const trs = () => [...html.matchAll(/<tbody>([\s\S]*)<\/tbody>/g)].flatMap((m) => [...(m[1] ?? '').matchAll(/<tr[\s\S]*?<\/tr>/g)].map((r) => r[0]));

  it('is window ls titled projects, with the ls -l ~ command and a labelled table', async () => {
    expect(html).toContain(`id="${SECTIONS.ls}"`);
    expect(html).toContain(`<h2 id="${TITLES.ls}" class="tt">projects</h2>`);
    expect(html).toContain('<span class="tbm">19 projects · 16 links</span>');
    expect(html).toMatch(/<p class="cmdline" aria-hidden="true">[\s\S]*ls -l ~/);
    expect(html).toMatch(/<table class="ls">\s*<caption class="sr-only">/);
    expect([...html.matchAll(/<th[^>]*scope="col"/g)]).toHaveLength(4);
  });

  it('has one drwxr-xr-x row per published category, in order, hidden terraria absent', () => {
    const dirRows = trs().filter((r) => r.includes('drwxr-xr-x'));
    expect(dirRows).toHaveLength(model.categories.length);
    expect(dirRows.map((r) => /<td class="dir"><a href="([^"]*)"/.exec(r)?.[1])).toEqual(['/ffxiv/', '/minecraft/', '/linux/', '/other/']);
    expect(html).not.toContain('terraria');
  });

  it('category rows: aria-hidden perms, name in the category accent, N projects, first blurb sentence', () => {
    const rows = trs().filter((r) => r.includes('drwxr-xr-x'));
    const [ffxiv] = rows;
    expect(ffxiv).toContain('<td class="perm" aria-hidden="true">drwxr-xr-x</td>');
    expect(ffxiv).toMatch(/^<tr class="accent-blue">/);
    expect(ffxiv).toContain('<td class="sz">8 projects</td>');
    expect(ffxiv).toContain('<td>Dalamud plugins, browser tools, and desktop apps</td>');
    expect(rows.every((r) => !/\.<\/td><\/tr>$/.test(r))).toBe(true);
    expect(rows.map((r) => /<td class="sz">([^<]*)</.exec(r)?.[1])).toEqual(
      model.categories.map((c) => `${c.projects.length} ${c.projects.length === 1 ? 'project' : 'projects'}`),
    );
    expect(rows.map((r) => /class="(accent-[a-z]+)"/.exec(r)?.[1])).toEqual(model.categories.map((c) => `accent-${c.accent}`));
  });

  it('has exactly one lrwxrwxrwx row: bookmarks -> elsewhere, N links, fixed description with a dim suffix', () => {
    const links = trs().filter((r) => r.includes('lrwxrwxrwx'));
    expect(links).toHaveLength(1);
    const row = links[0] ?? '';
    expect(row).toContain('<td class="perm" aria-hidden="true">lrwxrwxrwx</td>');
    expect(row).toMatch(/<a href="\/bookmarks\/">bookmarks<\/a>/);
    expect(row).toContain('<span class="m" aria-hidden="true">-&gt; elsewhere</span>');
    expect(row).toContain('<td class="sz">16 links</td>');
    expect(text(row)).toContain("Other people's work I use, learned from, or admire (external links)");
    expect(row).toMatch(/<span class="m">\(external links\)<\/span>/);
    expect(html.match(/lrwxrwxrwx/g)).toHaveLength(1);
  });

  it('singular counts', async () => {
    const one = await render(LsHome, { categories: [{ ...model.categories[0], projects: model.categories[0]?.projects.slice(0, 1) }], bookmarkCount: 1 });
    expect(one).toContain('<td class="sz">1 project</td>');
    expect(one).toContain('<td class="sz">1 link</td>');
  });
});

describe('UpdatesLog', () => {
  let html: string;
  beforeAll(async () => {
    html = await render(UpdatesLog, { entries: model.updatesLog });
  });
  const items = () => [...html.matchAll(/<li>([\s\S]*?)<\/li>/g)].map((m) => m[1] ?? '');

  it('is window log with the tail command and 4 rows, newest first', () => {
    expect(html).toContain(`id="${SECTIONS.log}"`);
    expect(html).toContain(`<h2 id="${TITLES.log}" class="tt">updates.log</h2>`);
    expect(html).toMatch(/<p class="cmdline" aria-hidden="true">[\s\S]*tail -n 4 updates.log/);
    expect(items()).toHaveLength(4);
    const dates = items().map((i) => /<time datetime="([^"]*)">/.exec(i)?.[1] ?? '');
    expect(dates).toEqual([...dates].sort().reverse());
  });

  it('each row is date, category/slug link to the project, version and note', () => {
    const first = model.updatesLog[0];
    const row = items()[0] ?? '';
    expect(row).toContain(`<time datetime="${first?.date}">${first?.date}</time>`);
    expect(row).toContain(`<a href="${first?.path}">${first?.categoryId}/${first?.slug}</a>`);
    expect(row).toContain(`<span class="y">v${first?.version}</span>`);
    expect(row).toContain(first?.note ?? 'missing');
  });

  it('omits the version cell when the project has none', async () => {
    const { version: _drop, ...bare } = model.updatesLog[0] as NonNullable<(typeof model.updatesLog)[number]>;
    expect(await render(UpdatesLog, { entries: [bare] })).not.toContain('class="y"');
  });
});

describe('landing page', () => {
  let html: string;
  beforeAll(async () => {
    process.env['NESSY_CONTENT_DIR'] = E2E_DIR;
    process.env['NESSY_STRICT'] = '1';
    clearSiteMemo();
    html = (await container.renderToString(Landing)).replace(/ data-astro-cid-[a-z0-9]+/g, '');
  });
  afterAll(() => {
    delete process.env['NESSY_CONTENT_DIR'];
    delete process.env['NESSY_STRICT'];
    clearSiteMemo();
  });

  it('has the home title and exactly one h1', () => {
    expect(html).toContain('<title>nessynet.io</title>');
    expect([...html.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
  });

  it('places whoami and links.txt in one .pair, then ls, then updates.log', () => {
    expect(html).toMatch(/<div class="pair">\s*<section[^>]*id="sec-w-who"[\s\S]*<section[^>]*id="sec-w-links"[\s\S]*<\/div>\s*<section[^>]*id="sec-w-ls"/);
    const order = ['sec-w-who', 'sec-w-links', 'sec-w-ls', 'sec-w-log'].map((id) => html.indexOf(`id="${id}"`));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i > 0)).toBe(true);
  });

  it('status line: NESSY | ~ | N projects | dirs, 1 link | github | mail', () => {
    const cells = /<footer[^>]*><div class="in">([\s\S]*)<\/div><\/footer>/.exec(html)?.[1] ?? '';
    expect(text(cells.replace(/<\/(span|a)>/g, ' | ')).replace(/( \|)+ ?$/, '')).toBe(
      'NESSY | ~ | 19 projects | | 4 dirs, 1 link | github ↗ | (opens in new tab) | | mail',
    );
  });

  it('the home tab is current', () => {
    expect(html).toMatch(/<a href="\/" aria-current="page">/);
  });
});

describe('landing page without links', () => {
  let dir: string;
  let html: string;
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'nessy-nolinks-'));
    await cp(E2E_DIR, dir, { recursive: true });
    const site = await readFile(join(dir, 'site.toml'), 'utf8');
    await writeFile(join(dir, 'site.toml'), site.replace(/\[whoami\.links\][^[]*/, ''));
    process.env['NESSY_CONTENT_DIR'] = dir;
    process.env['NESSY_STRICT'] = '1';
    clearSiteMemo();
    html = (await container.renderToString(Landing)).replace(/ data-astro-cid-[a-z0-9]+/g, '');
  });
  afterAll(async () => {
    delete process.env['NESSY_CONTENT_DIR'];
    delete process.env['NESSY_STRICT'];
    clearSiteMemo();
    await rm(dir, { recursive: true, force: true });
  });

  it('renders whoami on its own, outside .pair, with no links.txt window', () => {
    expect(html).toContain(`id="${SECTIONS.who}"`);
    expect(html).not.toContain('class="pair"');
    expect(html).not.toContain(SECTIONS.links);
    expect(html).not.toContain('links.txt');
  });

  it('status line has no github or mail cell', () => {
    const footer = /<footer[\s\S]*<\/footer>/.exec(html)?.[0] ?? '';
    expect(footer).not.toContain('<a ');
  });
});
