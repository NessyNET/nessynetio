// ux check 14 (R20, ux 5.2, 5.5, 5.6, 6.2): each availability variant shows its exact get, source and notice text;
// text slots are never links; a project without screenshots has no screenshots window; a web tool has no INSTALL and
// its get link carries the host and opens a new tab. Expected strings are typed out from ux 5.2 / 6.2.
import { test, expect } from './helpers/fixtures.ts';
import { spoken } from './helpers/dom.ts';
import { open } from './helpers/navigate.ts';

const VIEWPORT = { width: 1366, height: 900 };

const VARIANTS = [
  { name: 'public, installable', path: '/ffxiv/loch-lantern/', bar: 'get: see install source: GitHub (opens in new tab)', notice: null },
  { name: 'download only, private source', path: '/minecraft/bracken-biomes/', bar: 'get: Modrinth (opens in new tab) Source not available', notice: null },
  { name: 'local only', path: '/ffxiv/peat-fishing-log/', bar: 'get: Not distributed (local only) Source not available', notice: 'local only:' },
  { name: 'private service', path: '/other/ripple-bot/', bar: 'get: Not distributed (private bot) Source not available', notice: 'private bot:' },
  { name: 'retired', path: '/ffxiv/kelpie-chat-tabs/', bar: 'get: No longer distributed source: GitHub (opens in new tab)', notice: 'retired: Retired on 2025-03-04.' },
  { name: 'web tool', path: '/ffxiv/gorse-gearplanner/', bar: 'get: Open tool: gear.nessynet.io (opens in new tab) source: GitHub (opens in new tab)', notice: 'separate site:' },
] as const;

for (const variant of VARIANTS) {
  test(`${variant.name}: exact get/source/notice strings, text slots are not links`, async ({ page }) => {
    await open(page, { name: variant.name, path: variant.path, site: 'e2e' }, VIEWPORT);
    expect(await spoken(page.locator('.getbar'))).toBe(variant.bar);
    // The "not available" slots are plain text: never a link, button, or struck-through link.
    expect(await page.locator('.getbar .na a, .getbar .na button, .getbar .na del, .getbar .na s').count()).toBe(0);
    const notices = await page.locator('#sec-w-readme .notice').evaluateAll((els) =>
      els.map((e) => (e.textContent ?? '').replace(/\s+/g, ' ').trim()),
    );
    if (variant.notice === null) expect(notices).toEqual([]);
    else {
      expect(notices).toHaveLength(1);
      expect(notices[0]?.startsWith(variant.notice)).toBe(true);
      // A notice label is never a link (R24).
      expect(await page.locator('#sec-w-readme .notice a b, #sec-w-readme .notice b a').count()).toBe(0);
    }
  });
}

test('noshots: no screenshots window, the rest of the page is complete', async ({ page }) => {
  await open(page, { name: 'noshots', path: '/ffxiv/mist-macro-editor/', site: 'e2e' }, VIEWPORT);
  await expect(page.locator('#sec-w-shots, .shots')).toHaveCount(0);
  await expect(page.locator('#sec-w-readme')).toHaveCount(1);
  await expect(page.locator('#sec-w-stat')).toHaveCount(1);
});

test('a project with screenshots has the window', async ({ page }) => {
  await open(page, { name: 'plugin', path: '/ffxiv/loch-lantern/', site: 'e2e' }, VIEWPORT);
  await expect(page.locator('#sec-w-shots')).toHaveCount(1);
});

test('web tool: no INSTALL block, the get link carries the host and opens a new tab, the open-tool button too', async ({ page }) => {
  await open(page, { name: 'webtool', path: '/ffxiv/gorse-gearplanner/', site: 'e2e' }, VIEWPORT);
  await expect(page.locator('#install, #sec-w-inst')).toHaveCount(0);
  const get = page.locator('.getbar .slot-get a').first();
  await expect(get).toContainText('gear.nessynet.io');
  await expect(get).toHaveAttribute('target', '_blank');
  await expect(get).toHaveAttribute('rel', /noopener/);
  const button = page.locator('.btn-open');
  await expect(button).toHaveCount(1);
  await expect(button).toHaveAttribute('target', '_blank');
});
