// ux check 15 (R22, ux 4.5, 5.7): the 404 page. The local static server answers 404 with the 404 page body; that is
// NOT R23 acceptance, which needs the nginx run in CI (design 10.1 item 1).
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { urlOf } from './helpers/pages.ts';

const NOT_FOUND = { name: '404', path: '/ffxiv/loch-lanter', site: 'e2e' } as const;
const VIEWPORTS = [{ width: 1366, height: 900 }, { width: 390, height: 844 }];

for (const viewport of VIEWPORTS) {
  test(`typo path: 404 status, shows the path, suggests the near match, lists categories and bookmarks, links home @${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const response = await page.goto(urlOf(NOT_FOUND), { waitUntil: 'networkidle' });
    expect(response?.status()).toBe(404);
    await expect(page.locator('code[data-badpath]')).toHaveText('~/ffxiv/loch-lanter');
    await expect(page.locator('.statusline [data-badpath]')).toHaveText('~/ffxiv/loch-lanter');
    await expect(page.locator('h1')).toContainText('404');

    const suggestions = page.locator('[data-suggest]:not([hidden]) [data-suggest-list] a');
    await expect(suggestions.first()).toHaveText('~/ffxiv/loch-lantern');
    await expect(suggestions.first()).toHaveAttribute('href', '/ffxiv/loch-lantern/');

    // "or try": every published category and bookmarks, from the known-path list the build embedded.
    const known = JSON.parse((await page.locator('[data-known-paths]').getAttribute('data-known-paths')) ?? '[]') as string[];
    const top = [...new Set(known.filter((p) => p !== '/').map((p) => p.split('/')[1]))].map((s) => `/${s}/`);
    expect(top.length).toBe(5);
    expect(await page.locator('.tree404 a').evaluateAll((as) => as.map((a) => a.getAttribute('href')))).toEqual(expect.arrayContaining(top));
    expect(await page.locator('.tree404 a').count()).toBe(top.length);
    await expect(page.locator('.home404 a[href="/"]')).toHaveCount(1);
    await expect(page.locator('.statusline')).toBeVisible();
  });
}

test('a hidden empty category answers 404 and shows its path', async ({ page }) => {
  const response = await page.goto(urlOf({ name: 'terraria', path: '/terraria/', site: 'e2e' }), { waitUntil: 'networkidle' });
  expect(response?.status()).toBe(404);
  await expect(page.locator('code[data-badpath]')).toHaveText('~/terraria');
});

test('an unknown path far from any page shows no suggestion block', async ({ page }) => {
  await open(page, { name: 'far', path: '/zzzzqqqq/', site: 'e2e' }, VIEWPORTS[0]!);
  await expect(page.locator('[data-suggest]')).toBeHidden();
});

test('/404.html requested directly is also a 404', async ({ page }) => {
  const response = await page.goto(urlOf({ name: 'direct', path: '/404.html', site: 'e2e' }));
  expect(response?.status()).toBe(404);
});
