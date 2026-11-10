// ux check 13 (R9, ux 5.3): bookmarks. Group order is derived from the content (categories in config order, then free
// groups in config order, then general); empty groups never appear; `other` has no bookmarks window and a full-width
// header; rows carry no project status fields. Ports r8-acceptance.mjs lines 48 to 55 and the leftover checks.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { WIDTHS } from './helpers/pages.ts';

const DIR = 'tests/fixtures/site-e2e';
const read = (file: string) => parse(readFileSync(resolve(DIR, file), 'utf8')) as Record<string, any>;
const categories = (read('categories.toml')['category'] as { id: string }[]).map((c) => c.id);
const freeGroups = ((read('bookmarks.toml')['group'] ?? []) as { id: string }[]).map((g) => g.id);
const bookmarks = read('bookmarks.toml')['bookmark'] as { category?: string; group?: string }[];

const keyOf = (b: { category?: string; group?: string }) => b.category ?? b.group ?? 'general';
const present = new Set(bookmarks.map(keyOf));
/** Categories with a bookmark (config order), then free groups with one (config order), then general. */
const EXPECTED_GROUPS = [...categories.filter((c) => present.has(c)), ...freeGroups.filter((g) => present.has(g)), ...(present.has('general') ? ['general'] : [])];

const BOOKMARKS = { name: 'bookmarks', path: '/bookmarks/', site: 'e2e' } as const;
const VIEWPORTS = WIDTHS.filter((v) => [1366, 390].includes(v.width));

for (const viewport of VIEWPORTS) {
  test(`bookmarks page: group order, jump row, link count, no status fields @${viewport.width}`, async ({ page }) => {
    await open(page, BOOKMARKS, viewport);
    const groups = await page.locator('section[aria-labelledby^="bm-"]').evaluateAll((els) => els.map((e) => e.getAttribute('aria-labelledby')));
    expect(groups).toEqual(EXPECTED_GROUPS.map((g) => `bm-${g}`));
    // The jump row lists exactly those groups, in the same order, and every anchor resolves.
    const jumps = await page.locator('.jump a').evaluateAll((els) => els.map((e) => e.getAttribute('href')));
    expect(jumps).toEqual(EXPECTED_GROUPS.map((g) => `#bm-${g}`));
    for (const group of EXPECTED_GROUPS) await expect(page.locator(`#sec-bm-${group}`)).toHaveCount(1);
    // Empty groups (the `other` category has no bookmarks) are absent from windows and from the jump row.
    for (const empty of [...categories, ...freeGroups].filter((g) => !EXPECTED_GROUPS.includes(g))) {
      await expect(page.locator(`#sec-bm-${empty}, a[href="#bm-${empty}"]`)).toHaveCount(0);
    }
    expect(await page.locator('.bms a.ext').count()).toBe(bookmarks.length);
    expect(await page.locator('.bms .st, .bms [data-updated], .bms [data-priority], .bms [data-status]').count(), 'bookmark rows have no status fields').toBe(0);
  });
}

for (const category of ['ffxiv', 'minecraft', 'linux']) {
  test(`${category} has a bookmarks window when it has bookmarks`, async ({ page }) => {
    await open(page, { name: category, path: `/${category}/`, site: 'e2e' }, VIEWPORTS[0]!);
    await expect(page.locator('#sec-w-bm')).toHaveCount(1);
  });
}

for (const viewport of VIEWPORTS) {
  test(`other (no bookmarks): no bookmarks window, the header spans the full width @${viewport.width}`, async ({ page }) => {
    await open(page, { name: 'other', path: '/other/', site: 'e2e' }, viewport);
    await expect(page.locator('#sec-w-bm')).toHaveCount(0);
    const full = await page.evaluate(() => {
      const header = document.querySelector('#sec-w-h')?.getBoundingClientRect().width ?? 0;
      const main = document.querySelector('main');
      const style = main === null ? null : getComputedStyle(main);
      const inner = (main?.getBoundingClientRect().width ?? 0) - parseFloat(style?.paddingLeft ?? '0') - parseFloat(style?.paddingRight ?? '0');
      return Math.abs(header - inner) < 2;
    });
    expect(full).toBe(true);
  });
}

test('landing links bookmarks as a symlink row and the tab bar; the empty terraria category is nowhere', async ({ page }) => {
  await open(page, { name: 'landing', path: '/', site: 'e2e' }, VIEWPORTS[0]!);
  const symlinks = await page.locator('.ls tr').evaluateAll((rows) => rows.map((r) => (r.textContent ?? '').replace(/\s+/g, ' ').trim()).filter((t) => t.startsWith('lrwx')));
  expect(symlinks).toHaveLength(1);
  expect(symlinks[0]).toContain('bookmarks');
  await expect(page.locator('.tmux a[href="/bookmarks/"]')).toHaveCount(1);
  await expect(page.locator('.tmux')).not.toContainText(/terraria/i);
  await expect(page.locator('.ls')).not.toContainText(/terraria/i);
  await expect(page.locator('#sec-w-about')).toHaveCount(0);
});

test('no leftover reading.html link, reading tab, "links only" text or About window on any page', async ({ page }) => {
  for (const path of ['/', '/bookmarks/', '/ffxiv/', '/ffxiv/loch-lantern/']) {
    await open(page, { name: path, path, site: 'e2e' }, VIEWPORTS[0]!);
    expect(await page.locator('a[href*="reading.html"]').count(), path).toBe(0);
    expect(await page.locator('.tmux a').evaluateAll((as) => as.map((a) => a.textContent ?? '').filter((t) => /reading|links only/i.test(t))), path).toEqual([]);
    expect(/links[ -]only|bookmarks-only/i.test(await page.locator('body').innerText()), path).toBe(false);
    expect(await page.locator('#sec-w-about').count(), path).toBe(0);
  }
});
