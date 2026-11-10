import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { parse } from 'parse5';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { loadSite } from '../../src/lib/content/index.ts';
import { buildInScratch } from '../helpers/scratch-build.ts';

const SLOW = 300_000;
const FIXTURE = fileURLToPath(new URL('../fixtures/site-e2e', import.meta.url));

type Node = { nodeName: string; attrs?: { name: string; value: string }[]; childNodes?: Node[]; value?: string };
const attr = (n: Node, name: string) => n.attrs?.find((a) => a.name === name)?.value;
function walk(n: Node, visit: (n: Node) => void) {
  visit(n);
  for (const c of n.childNodes ?? []) walk(c, visit);
}

interface PageTags {
  titles: string[];
  metas: Map<string, string[]>;
  canonicals: string[];
}
function tagsOf(html: string): PageTags {
  const out: PageTags = { titles: [], metas: new Map(), canonicals: [] };
  walk(parse(html) as unknown as Node, (n) => {
    if (n.nodeName === 'title') out.titles.push((n.childNodes ?? []).map((c) => c.value ?? '').join(''));
    if (n.nodeName === 'meta') {
      const key = attr(n, 'name') ?? attr(n, 'property');
      if (key !== undefined) out.metas.set(key, [...(out.metas.get(key) ?? []), attr(n, 'content') ?? '']);
    }
    if (n.nodeName === 'link' && attr(n, 'rel') === 'canonical') out.canonicals.push(attr(n, 'href') ?? '');
  });
  return out;
}

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '_astro' ? [] : htmlFiles(p);
    return name.endsWith('.html') ? [p] : [];
  });
}

describe('meta tags in the built site (R19)', () => {
  let dist: string;
  let cleanup: () => void;
  const pages = new Map<string, PageTags>(); // keyed by path relative to dist
  beforeAll(() => {
    ({ dist, cleanup } = buildInScratch(FIXTURE));
    for (const f of htmlFiles(dist)) pages.set(relative(dist, f), tagsOf(readFileSync(f, 'utf8')));
  }, SLOW);
  afterAll(() => cleanup?.());

  const only = (page: PageTags, key: string) => {
    const values = page.metas.get(key) ?? [];
    expect(values, key).toHaveLength(1);
    return values[0] as string;
  };

  it('every page has exactly one of each required tag', () => {
    expect(pages.size).toBeGreaterThan(20);
    for (const [file, page] of pages) {
      expect(page.titles, `${file} title`).toHaveLength(1);
      expect(page.canonicals, `${file} canonical`).toHaveLength(1);
      for (const key of ['description', 'og:title', 'og:description', 'og:url', 'og:type', 'og:site_name', 'twitter:card', 'twitter:title', 'twitter:description']) {
        only(page, key);
      }
      expect(only(page, 'twitter:card'), file).toBe('summary_large_image');
      expect(only(page, 'og:type'), file).toBe('website');
      expect(only(page, 'og:url'), file).toBe(page.canonicals[0]);
      expect(only(page, 'og:title'), file).toBe(only(page, 'twitter:title'));
    }
  });

  it('omits image tags while no card is configured', () => {
    for (const [file, page] of pages) {
      expect(page.metas.has('og:image'), file).toBe(false);
      expect(page.metas.has('twitter:image'), file).toBe(false);
    }
  });

  it('titles are unique, canonicals are unique and carry no query or fragment', () => {
    const titles = [...pages.values()].map((p) => p.titles[0]);
    expect(new Set(titles).size).toBe(titles.length);
    const canonicals = [...pages.values()].map((p) => p.canonicals[0] as string);
    expect(new Set(canonicals).size).toBe(canonicals.length);
    for (const c of canonicals) {
      expect(c.startsWith('https://nessynet.io/'), c).toBe(true);
      expect(c, c).not.toMatch(/[?#]/);
    }
  });

  it('a project description is its summary; the landing preview has no tagline markup', async () => {
    const { model } = await loadSite({ dir: FIXTURE, strict: true, allowSamples: false });
    if (model === null) throw new Error('site-e2e does not load');
    const p = model.categories[0]?.projects[0];
    if (p === undefined) throw new Error('fixture has no project');
    const page = pages.get(join(p.categoryId, p.slug, 'index.html')) as PageTags;
    expect(only(page, 'description')).toBe(p.summary);
    expect(only(page, 'og:description')).toBe(p.summary);
    const landing = pages.get('index.html') as PageTags;
    expect(only(landing, 'og:description')).toBe(model.whoami?.taglinePlain ?? model.site.description);
    expect(only(landing, 'og:description')).not.toMatch(/[<>]/);
  });

  it('the sitemap lists every page except 404; robots.txt is exact', async () => {
    const index = readFileSync(join(dist, 'sitemap-index.xml'), 'utf8');
    const shard = /<loc>([^<]*sitemap-0\.xml)<\/loc>/.exec(index)?.[1];
    expect(shard).toBe('https://nessynet.io/sitemap-0.xml');
    const locs = [...readFileSync(join(dist, 'sitemap-0.xml'), 'utf8').matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]);
    const expected = [...pages.values()].map((p) => p.canonicals[0]).filter((c) => !c?.includes('/404'));
    expect([...locs].sort()).toEqual([...expected].sort());
    expect(readFileSync(join(dist, 'robots.txt'), 'utf8')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://nessynet.io/sitemap-index.xml\n',
    );
  });
});
