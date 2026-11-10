// ux 11 check 2: no horizontal overflow at the five widths, at 320 px (R17, SC 1.4.10) and around the 900 px layout switch
// (901 to 1100 px caught a nowrap bookmark name in 041).
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { ALL_PAGES, NARROW, OVERFLOW_WIDTHS, WIDTHS } from './helpers/pages.ts';

for (const spec of ALL_PAGES) {
  for (const viewport of [...WIDTHS, ...OVERFLOW_WIDTHS, NARROW]) {
    test(`no horizontal overflow: ${spec.name} @${viewport.width}`, async ({ page }) => {
      await open(page, spec, viewport);
      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(scrollWidth).toBeLessThanOrEqual(viewport.width);
    });
  }
}
