// ux check 11 (R7, ux 5.1, 5.4): a category URL reproduces the view; an unknown tag shows the empty state and
// "show all" restores; every change is announced in the live region.
import { test, expect } from './helpers/fixtures.ts';
import { liveText } from './helpers/dom.ts';
import { open } from './helpers/navigate.ts';
import { urlOf } from './helpers/pages.ts';

const FFXIV = { name: 'ffxiv', path: '/ffxiv/', site: 'e2e' } as const;
const VIEWPORT = { width: 1366, height: 900 };
const ROWS = 'li.row[data-tags]:not([hidden])';
const names = (page: import('@playwright/test').Page) => page.locator(ROWS).evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['name']));

test('?tag=offline&sort=updated&dir=desc reproduces the filtered, sorted view', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`${urlOf(FFXIV)}?tag=offline&sort=updated&dir=desc`, { waitUntil: 'networkidle' });
  expect(await names(page)).toEqual(['peat-fishing-log', 'mist-macro-editor', 'urquhart-crafting-sim']);
  await expect(page.locator('[data-sort-field]')).toHaveValue('updated');
  await expect(page.locator('[data-chiprow] .chip[data-tag="offline"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('[data-ls-arg]')).toHaveText(' --tag=offline --sort=time');
  await expect(page.locator('[data-tag-name]').first()).toHaveText('#offline');
});

test('?tag=nope shows the empty state naming the tag, and "show all" restores every row and the plain URL', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`${urlOf(FFXIV)}?tag=nope`, { waitUntil: 'networkidle' });
  const empty = page.locator('[data-empty]');
  await expect(empty).toBeVisible();
  await expect(empty).toContainText('#nope');
  expect(await names(page)).toEqual([]);
  await page.locator('[data-clear]').click();
  await expect(empty).toBeHidden();
  expect((await names(page)).length).toBe(8);
  expect(new URL(page.url()).search).toBe('');
});

test('unknown sort values fall back silently to the default view', async ({ page }) => {
  await page.setViewportSize(VIEWPORT);
  await page.goto(`${urlOf(FFXIV)}?sort=banana&dir=sideways`, { waitUntil: 'networkidle' });
  await expect(page.locator('[data-sort-field]')).toHaveValue('default');
  expect((await names(page)).length).toBe(8);
});

test('the live region announces the result of a filter or sort change', async ({ page }) => {
  await open(page, FFXIV, VIEWPORT);
  await page.locator('[data-chiprow] .chip[data-tag="web"]').click();
  await expect.poll(() => liveText(page)).toBe('2 projects tagged web, sorted by default ranking, ascending');
  await page.locator('[data-sort-field]').selectOption('name');
  await expect.poll(() => liveText(page)).toBe('2 projects tagged web, sorted by name, ascending');
});
