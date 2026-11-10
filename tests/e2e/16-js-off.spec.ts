// ux check 16 (R14, R18 JS off, ux 5.10): with JavaScript off the page is complete and static: no tag row, sort row,
// "+N more" or copy buttons; every row shows in the default order even with ?tag=; commands are visible as text; the
// 404 page still lists the categories. @cross: firefox and webkit run it too.
import { test, expect } from './helpers/fixtures.ts';
import { urlOf } from './helpers/pages.ts';
import { compareSlug } from '../../src/lib/sort.ts';

test.use({ javaScriptEnabled: false });

const VIEWPORTS = [{ width: 1366, height: 900 }, { width: 390, height: 844 }];
const PAGES = [
  { name: 'ffxiv ?tag=plugin', path: '/ffxiv/?tag=plugin' },
  { name: 'plugin', path: '/ffxiv/loch-lantern/' },
  { name: 'linux-tool', path: '/linux/lochctl/' },
  { name: '404', path: '/ffxiv/loch-lanter' },
] as const;

for (const viewport of VIEWPORTS) {
  for (const spec of PAGES) {
    test(`JS off: ${spec.name} @${viewport.width} @cross`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.goto(urlOf({ name: spec.name, path: spec.path, site: 'e2e' }));
      const state = await page.evaluate(() => {
        const shown = (el: Element) => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        const rows = [...document.querySelectorAll('li.row[data-tags]')];
        return {
          controlsShown: [...document.querySelectorAll('.controls, .copy, .more, [data-js-only]')].filter(shown).length,
          tagButtons: document.querySelectorAll('button.tag').length,
          rows: rows.length,
          rowsShown: rows.filter(shown).length,
          order: rows.map((r) => ({ slug: (r as HTMLElement).dataset['name'] ?? '', priority: Number((r as HTMLElement).dataset['priority']), status: (r as HTMLElement).dataset['status'] })),
          commandsShown: [...document.querySelectorAll('.copyrow code')].filter(shown).length,
          h1: document.querySelector('h1')?.textContent ?? '',
          categoriesShown: [...document.querySelectorAll('.tree404 a')].filter(shown).length,
        };
      });
      expect(state.controlsShown, 'controls, copy buttons and the more toggle are hidden').toBe(0);
      expect(state.tagButtons, 'no tag buttons').toBe(0);
      expect(state.h1.length).toBeGreaterThan(0);
      if (spec.path.startsWith('/ffxiv/?')) {
        expect(state.rows).toBe(8);
        expect(state.rowsShown, '?tag= is ignored: every row stays visible').toBe(8);
        const active = state.order.filter((r) => r.status === 'active').sort((a, b) => a.priority - b.priority || compareSlug(a.slug, b.slug));
        const retired = state.order.filter((r) => r.status === 'retired').sort((a, b) => a.priority - b.priority || compareSlug(a.slug, b.slug));
        expect(state.order.map((r) => r.slug), 'rows are in the default order').toEqual([...active, ...retired].map((r) => r.slug));
      }
      if (spec.name !== '404' && spec.name !== 'ffxiv ?tag=plugin') expect(state.commandsShown, 'commands stay visible as text').toBeGreaterThan(0);
      if (spec.name === '404') expect(state.categoriesShown, 'the 404 page lists categories').toBeGreaterThanOrEqual(4);
    });
  }
}

test('JS off: no script ran (the copy script and category script have no effect) @cross', async ({ page }) => {
  await page.goto(urlOf({ name: 'x', path: '/ffxiv/', site: 'e2e' }));
  expect(await page.locator('[data-js-only]').first().isVisible()).toBe(false);
  expect(await page.locator('#live').evaluate((el) => el.textContent)).toBe('');
});
