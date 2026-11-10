import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { clearSiteMemo, loadSite } from '../../src/lib/content/index.ts';
import type { SiteModel } from '../../src/lib/content/model.ts';
import NotFoundPage from '../../src/pages/404.astro';
import { SECTIONS, TITLES } from '../helpers/hooks.ts';

const E2E_DIR = fileURLToPath(new URL('../fixtures/site-e2e', import.meta.url));

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
let model: SiteModel;
let html: string;

// Scoped styles stamp every element with a data-astro-cid-* attribute; it is not part of the markup under test.
const clean = (s: string) => s.replace(/ data-astro-cid-[a-z0-9]+/g, '');
const text = (s: string) => s.replace(/<[^>]*>/g, '').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://nessynet.io' } });
  const { model: loaded } = await loadSite({ dir: E2E_DIR, strict: true, allowSamples: false });
  if (loaded === null) throw new Error('site-e2e does not load');
  model = loaded;
  process.env['NESSY_CONTENT_DIR'] = E2E_DIR;
  process.env['NESSY_STRICT'] = '1';
  clearSiteMemo();
  html = clean(await container.renderToString(NotFoundPage as unknown as Parameters<typeof container.renderToString>[0]));
});
afterAll(() => {
  delete process.env['NESSY_CONTENT_DIR'];
  delete process.env['NESSY_STRICT'];
  clearSiteMemo();
});

const win = () => /<section[^>]*id="sec-w-404"[\s\S]*?<\/section>/.exec(html)?.[0] ?? '';

describe('404 page', () => {
  it('has the Not found title and exactly one plain h1 with the heading text', () => {
    expect(html).toContain('<title>Not found · nessynet.io</title>');
    expect([...html.matchAll(/<h1[\s>]/g)]).toHaveLength(1);
    expect(html).toContain('<h1>404: no such file or directory</h1>');
  });

  it('is one red zsh window 404 with meta exit 1, and no tab is current', () => {
    expect(html).toContain(`id="${SECTIONS.notfound}"`);
    expect(html).toMatch(/<section class="win accent-red"/);
    expect(html).toContain(`<p id="${TITLES.notfound}" class="tt">zsh</p>`);
    expect(html).toContain('<span class="tbm">exit 1</span>');
    expect(html).not.toContain('aria-current');
    expect(html.match(/<section\b/g)).toHaveLength(1);
  });

  it('prompt fragments are aria-hidden but the path in `cd` is visible, with the generic default', () => {
    expect(win()).toMatch(/<p class="cmdline"><span class="p" aria-hidden="true">\$<\/span> <span aria-hidden="true">cd <\/span><span data-badpath>this address<\/span><\/p>/);
  });

  it('has the sentence around a code[data-badpath] defaulting to "this address"', () => {
    expect(win()).toContain('Nothing lives at <code data-badpath>this address</code>. It may have moved or been renamed, or the link has a typo.');
  });

  it('status line has the generic path cell, 404 and not found', () => {
    const footer = /<footer[\s\S]*<\/footer>/.exec(html)?.[0] ?? '';
    expect(footer).toContain('<span data-badpath>this address</span>');
    expect(footer).toContain('<span class="mid">404</span>');
    expect(footer).toContain('<span class="rt">not found</span>');
  });

  it('did-you-mean container is hidden by default, with the heading and an empty list', () => {
    expect(win()).toMatch(/<div data-suggest data-known-paths="[^"]*" hidden><p class="sub">did you mean<\/p><ul class="plain sugg" data-suggest-list><\/ul><\/div>/);
  });

  it('"or try" lists every published category with its count, then bookmarks/, then the home link', () => {
    const tree = /<ul class="plain tree404">([\s\S]*?)<\/ul>/.exec(win())?.[1] ?? '';
    const links = [...tree.matchAll(/<a [^>]*href="([^"]*)"[^>]*>([^<]*)<\/a>/g)].map((m) => [m[1], m[2]]);
    expect(links).toEqual([...model.categories.map((c) => [`/${c.id}/`, `${c.id}/`]), ['/bookmarks/', 'bookmarks/']]);
    expect(links).toHaveLength(5);
    expect(tree).toContain('8 projects');
    expect(text(tree)).toContain('bookmarks/ external links');
    expect(win()).toMatch(/<p class="out home404"><a href="\/">Go to the home page<\/a><\/p>/);
  });

  it('carries the path list as JSON in data-known-paths on [data-suggest]: model.paths, under 2 KB', () => {
    const raw = /<div data-suggest data-known-paths="([^"]*)" hidden>/.exec(win())?.[1] ?? '';
    const json = raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
    expect(JSON.parse(json)).toEqual(model.paths);
    expect(Buffer.byteLength(json)).toBeLessThan(2048);
    expect(model.paths.length).toBeGreaterThan(20);
  });

  it('has no inline script at all (the path list is an attribute)', () => {
    const inline = [...html.matchAll(/<script\b([^>]*)>/g)].filter((m) => !/\bsrc=/.test(m[1] ?? ''));
    expect(inline).toHaveLength(0);
  });

  it('has no style attributes', () => {
    expect(html).not.toMatch(/\sstyle=/);
  });
});
