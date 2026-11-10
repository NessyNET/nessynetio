import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import TabBar from '../../src/components/chrome/TabBar.astro';
import { siteModel } from '../helpers/chrome-model.ts';

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
beforeAll(async () => {
  container = await AstroContainer.create();
});

type Current = { kind: 'home' | 'category' | 'project' | 'bookmarks' | 'notfound'; categoryId?: string };
// Scoped styles stamp every element with a data-astro-cid-* attribute; it is not part of the markup under test.
const render = async (current: Current, model = siteModel()) =>
  (await container.renderToString(TabBar, { props: { model, current } })).replace(/ data-astro-cid-[a-z0-9]+/g, '');

interface Tab {
  href: string;
  text: string; // visible text with tags stripped
  open: string; // the opening <a> tag
  inner: string;
  accent: string | undefined;
}

// Tabs in document order: <li class="accent-x"><a ...>inner</a></li>
function tabs(html: string): Tab[] {
  return [...html.matchAll(/<li class="([^"]*)"><a ([^>]*)>([\s\S]*?)<\/a><\/li>/g)].map((m) => ({
    href: /href="([^"]*)"/.exec(m[2] ?? '')?.[1] ?? '',
    text: (m[3] ?? '').replace(/<[^>]*>/g, ''),
    open: m[2] ?? '',
    inner: m[3] ?? '',
    accent: /accent-[a-z]+/.exec(m[1] ?? '')?.[0],
  }));
}

describe('TabBar.astro', () => {
  it('is header.tmux with a nav labelled "Main" and a brand link home', async () => {
    const html = await render({ kind: 'home' });
    expect(html).toMatch(/^<header class="tmux">/);
    expect(html).toContain('<nav aria-label="Main">');
    expect(html).toMatch(/<a href="\/" class="brand">nessynet<\/a>/);
  });

  it('lists 0:home, the published categories in model order, then bookmarks last', async () => {
    const t = tabs(await render({ kind: 'notfound' }));
    expect(t.map((x) => x.text)).toEqual(['0:home', '1:ffxiv', '2:minecraft', '3:linux', '4:bookmarks']);
    expect(t.map((x) => x.href)).toEqual(['/', '/ffxiv/', '/minecraft/', '/linux/', '/bookmarks/']);
  });

  it('indexes follow the model: an unpublished category leaves no tab and no gap', async () => {
    const full = siteModel();
    const model = siteModel({ categories: full.categories.filter((c) => c.id !== 'minecraft') });
    const t = tabs(await render({ kind: 'notfound' }, model));
    expect(t.map((x) => x.text)).toEqual(['0:home', '1:ffxiv', '2:linux', '3:bookmarks']);
    expect(t.some((x) => x.text.includes('other'))).toBe(false);
  });

  it('the index is an aria-hidden span', async () => {
    const t = tabs(await render({ kind: 'home' }));
    for (const [i, tab] of t.entries()) expect(tab.inner).toMatch(new RegExp(`^<span class="n" aria-hidden="true">${i}:</span>`));
  });

  it('category accent classes: home primary, categories their accent, bookmarks cyan', async () => {
    const t = tabs(await render({ kind: 'home' }));
    expect(t.map((x) => x.accent)).toEqual(['accent-primary', 'accent-blue', 'accent-orange', 'accent-yellow', 'accent-cyan']);
  });

  it.each<[string, Current, number]>([
    ['home', { kind: 'home' }, 0],
    ['category', { kind: 'category', categoryId: 'minecraft' }, 2],
    ['bookmarks', { kind: 'bookmarks' }, 4],
  ])('%s page: that tab has aria-current="page" and no other tab has aria-current', async (_n, current, index) => {
    const t = tabs(await render(current));
    expect(t[index]?.open).toContain('aria-current="page"');
    expect(t.filter((x) => x.open.includes('aria-current'))).toHaveLength(1);
  });

  it('project page: the parent category tab has aria-current="true" (not "page")', async () => {
    const t = tabs(await render({ kind: 'project', categoryId: 'linux' }));
    expect(t[3]?.open).toContain('aria-current="true"');
    expect(t.filter((x) => x.open.includes('aria-current'))).toHaveLength(1);
    expect(t.some((x) => x.open.includes('aria-current="page"'))).toBe(false);
  });

  it('404 page: no tab is current', async () => {
    const t = tabs(await render({ kind: 'notfound' }));
    expect(t.some((x) => x.open.includes('aria-current'))).toBe(false);
  });

  it('the current-tab * is an aria-hidden element, only in the current tab, never CSS content', async () => {
    const t = tabs(await render({ kind: 'category', categoryId: 'ffxiv' }));
    expect(t[1]?.inner).toMatch(/ffxiv<span class="mark" aria-hidden="true">\*<\/span>$/);
    expect(t.filter((x) => x.inner.includes('*'))).toHaveLength(1);
  });

  it('an unknown categoryId marks no tab rather than throwing', async () => {
    const t = tabs(await render({ kind: 'category', categoryId: 'nope' }));
    expect(t.some((x) => x.open.includes('aria-current'))).toBe(false);
  });
});
