// R13: every project is reachable from the landing page in at most two clicks. Crawls internal links from `/` to depth
// two and compares with the project paths the build embedded in the 404 page (`data-known-paths`).
import { test, expect } from './helpers/fixtures.ts';
import { urlOf } from './helpers/pages.ts';

const ORIGIN_PATHS = { name: 'known', path: '/ffxiv/loch-lanter', site: 'e2e' } as const;

test('every project is within two clicks of the landing page', async ({ page }) => {
  await page.goto(urlOf(ORIGIN_PATHS));
  const known = JSON.parse((await page.locator('[data-known-paths]').getAttribute('data-known-paths')) ?? '[]') as string[];
  const projects = known.filter((p) => p.split('/').filter(Boolean).length === 2 && !p.startsWith('/bookmarks'));
  expect(projects.length, 'the site has projects').toBeGreaterThan(10);

  const internalLinks = async (path: string): Promise<string[]> => {
    await page.goto(new URL(path, urlOf(ORIGIN_PATHS)).href, { waitUntil: 'domcontentloaded' });
    return page.evaluate(() =>
      [...document.querySelectorAll('a[href]')]
        .map((a) => new URL(a.getAttribute('href') ?? '', location.href))
        .filter((u) => u.origin === location.origin)
        .map((u) => u.pathname),
    );
  };

  const clickDepth = new Map<string, number>([['/', 0]]);
  let frontier = ['/'];
  for (let depth = 1; depth <= 2; depth++) {
    const next: string[] = [];
    for (const path of frontier) {
      for (const target of await internalLinks(path)) {
        if (clickDepth.has(target)) continue;
        clickDepth.set(target, depth);
        next.push(target);
      }
    }
    frontier = next;
  }
  const farther = projects.filter((p) => !clickDepth.has(p));
  expect(farther, 'projects not reachable within two clicks').toEqual([]);
});
