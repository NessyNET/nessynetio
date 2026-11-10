// ux check 10 (R7, ux 7.7): six sort combinations against an independently computed order, the `ls` text and the URL,
// and tag + sort together. The expected order is built from the build's own row keys with `compareSlug` (plan 8).
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { compareSlug } from '../../src/lib/sort.ts';

const FFXIV = { name: 'ffxiv', path: '/ffxiv/', site: 'e2e' } as const;
const VIEWPORT = { width: 1366, height: 900 };

interface Row { slug: string; updated: string; priority: number; status: string }

const byPriority = (a: Row, b: Row) => a.priority - b.priority || compareSlug(a.slug, b.slug);
const byUpdated = (a: Row, b: Row) => compareSlug(a.updated, b.updated) || compareSlug(a.slug, b.slug);

function expectedOrder(rows: Row[], sort: string, dir: string): string[] {
  if (sort === 'default') {
    const active = rows.filter((r) => r.status !== 'retired').sort(byPriority);
    const retired = rows.filter((r) => r.status === 'retired').sort(byPriority);
    if (dir === 'desc') {
      active.reverse();
      retired.reverse();
    }
    return [...active, ...retired].map((r) => r.slug);
  }
  const sorted = [...rows].sort(sort === 'name' ? (a, b) => compareSlug(a.slug, b.slug) : byUpdated);
  return (dir === 'desc' ? sorted.reverse() : sorted).map((r) => r.slug);
}

const COMBOS = [
  ['default', 'asc', ''],
  ['default', 'desc', ' --reverse'],
  ['name', 'asc', ' --sort=name'],
  ['name', 'desc', ' --sort=name --reverse'],
  ['updated', 'desc', ' --sort=time'],
  ['updated', 'asc', ' --sort=time --reverse'],
] as const;

const readRows = (page: import('@playwright/test').Page) =>
  page.locator('li.row[data-tags]').evaluateAll((els) =>
    els.map((e) => {
      const li = e as HTMLElement;
      return { slug: li.dataset['name'] ?? '', updated: li.dataset['updated'] ?? '', priority: Number(li.dataset['priority']), status: li.dataset['status'] ?? '', hidden: li.hidden };
    }),
  );
const visibleNames = (page: import('@playwright/test').Page) => page.locator('li.row[data-tags]:not([hidden])').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['name']));

for (const [sort, dir, ls] of COMBOS) {
  test(`sort ${sort} ${dir}: order, ls text and URL`, async ({ page }) => {
    await open(page, FFXIV, VIEWPORT);
    const rows = await readRows(page);
    await page.locator('[data-sort-field]').selectOption(sort);
    const current = (await page.locator('[data-sort-dir]').textContent())?.startsWith('asc') ? 'asc' : 'desc';
    if (current !== dir) await page.locator('[data-sort-dir]').click();
    expect(await visibleNames(page)).toEqual(expectedOrder(rows, sort, dir));
    await expect(page.locator('[data-ls-arg]')).toHaveText(ls);
    const search = new URL(page.url()).search;
    expect(search).toBe(sort === 'default' && dir === 'asc' ? '' : `?sort=${sort}&dir=${dir}`);
    const natural = sort === 'updated' ? 'desc' : 'asc';
    await expect(page.locator('[data-sort-name]').first()).toHaveText(dir === natural ? sort : `${sort} (${dir})`);
  });
}

test('tag and sort combine: the plugin tag, newest first reversed to oldest first', async ({ page }) => {
  await open(page, FFXIV, VIEWPORT);
  const rows = await readRows(page);
  await page.locator('[data-sort-field]').selectOption('updated');
  await page.locator('[data-sort-dir]').click(); // updated starts descending; one press makes it ascending
  await page.locator('[data-chiprow] .chip[data-tag="plugin"]').click();
  const tagged = await page.locator('li.row[data-tags]').evaluateAll((els) => els.filter((e) => ((e as HTMLElement).dataset['tags'] ?? '').split(' ').includes('plugin')).map((e) => (e as HTMLElement).dataset['name']));
  const want = expectedOrder(rows, 'updated', 'asc').filter((slug) => tagged.includes(slug));
  expect(await visibleNames(page)).toEqual(want);
  await expect(page.locator('[data-ls-arg]')).toHaveText(' --tag=plugin --sort=time --reverse');
  const params = new URL(page.url()).searchParams;
  expect([params.get('tag'), params.get('sort'), params.get('dir')]).toEqual(['plugin', 'updated', 'asc']);
});
