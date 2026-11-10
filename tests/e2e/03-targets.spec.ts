// ux 11 check 3: every non-inline link or button is at least 24 x 24 px (SC 2.5.8).
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { ALL_PAGES, WIDTHS } from './helpers/pages.ts';

for (const spec of ALL_PAGES) {
  for (const viewport of WIDTHS) {
    test(`target size: ${spec.name} @${viewport.width}`, async ({ page }) => {
      await open(page, spec, viewport);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll('a, button')]
          .filter((el) => {
            const box = el.getBoundingClientRect();
            return box.width > 0 && (box.height < 24 || box.width < 24) && getComputedStyle(el).display !== 'inline';
          })
          .map((el) => `${(el.textContent ?? '').trim().slice(0, 20)}: ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)}`),
      );
      expect(small).toEqual([]);
    });
  }
}
