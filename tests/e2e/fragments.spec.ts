// Every in-page link resolves: each `a[href^="#"]`, and each same-page href with a fragment, has an element with that
// id (catches a dangling `#install`). Runs on every page of both fixture sites.
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { ALL_PAGES } from './helpers/pages.ts';

for (const spec of ALL_PAGES) {
  test(`fragment links resolve: ${spec.name}`, async ({ page }) => {
    await open(page, spec, { width: 1366, height: 900 });
    const dangling = await page.evaluate(() => {
      const here = location.pathname + location.search;
      const missing: string[] = [];
      for (const a of document.querySelectorAll('a[href]')) {
        const url = new URL(a.getAttribute('href') ?? '', location.href);
        if (url.hash === '' || url.hash === '#') continue;
        if (url.origin !== location.origin || url.pathname + url.search !== here) continue;
        const id = decodeURIComponent(url.hash.slice(1));
        if (document.getElementById(id) === null) missing.push(a.getAttribute('href') ?? '');
      }
      return missing;
    });
    expect(dangling).toEqual([]);
  });
}

test('the check is not vacuous: project pages do link to #install and the target exists', async ({ page }) => {
  await open(page, { name: 'plugin', path: '/ffxiv/loch-lantern/', site: 'e2e' }, { width: 1366, height: 900 });
  expect(await page.locator('a[href="#install"]').count()).toBeGreaterThan(0);
  expect(await page.locator('#install').count()).toBe(1);
});
