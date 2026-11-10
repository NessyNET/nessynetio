// ux check 6 (R11, ux 7.15): every external link opens a new tab and says so; mail stays in the tab; arrows mean new tab.
// Ports r8-acceptance.mjs lines 56 to 63 ("new-tab rules on every page").
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { ALL_PAGES, WIDTHS } from './helpers/pages.ts';

const VIEWPORTS = WIDTHS.filter((v) => v.width === 1366 || v.width === 390);

for (const spec of ALL_PAGES) {
  for (const viewport of VIEWPORTS) {
    test(`external links: new tab, noopener noreferrer, arrow and "(opens in new tab)": ${spec.name} @${viewport.width}`, async ({ page }) => {
      await open(page, spec, viewport);
      const found = await page.evaluate(() => {
        const links = [...document.querySelectorAll('a')];
        const newTab = links.filter((a) => a.target === '_blank');
        return {
          count: newTab.length,
          badNewTab: newTab
            .filter(
              (a) =>
                !/noopener/.test(a.rel) ||
                !/noreferrer/.test(a.rel) ||
                !(a.textContent ?? '').includes('↗') ||
                !(a.textContent ?? '').includes('(opens in new tab)') ||
                !(a.querySelector('[aria-hidden="true"]')?.textContent ?? '').includes('↗'),
            )
            .map((a) => a.href),
          arrowWithoutNewTab: links.filter((a) => (a.textContent ?? '').includes('↗') && a.target !== '_blank').map((a) => a.href),
          externalWithoutNewTab: links
            .filter((a) => /^https?:$/.test(a.protocol) && a.host !== location.host && a.target !== '_blank')
            .map((a) => a.href),
          mailWithTarget: links.filter((a) => a.href.startsWith('mailto:') && a.target !== '').map((a) => a.href),
          oldWording: (document.body.textContent ?? '').includes('(external site)'),
        };
      });
      expect(found.badNewTab, 'new-tab links missing rel, arrow or hidden text').toEqual([]);
      expect(found.arrowWithoutNewTab, 'a link with an arrow must open a new tab').toEqual([]);
      expect(found.externalWithoutNewTab, 'a link to another host must open a new tab').toEqual([]);
      expect(found.mailWithTarget, 'mail links stay in the same tab').toEqual([]);
      expect(found.oldWording).toBe(false);
    });
  }
}

test('the pages together do contain external links (the checks above are not vacuous)', async ({ page }) => {
  await open(page, ALL_PAGES[0]!, { width: 1366, height: 900 });
  expect(await page.locator('a[target="_blank"]').count()).toBeGreaterThan(0);
});
