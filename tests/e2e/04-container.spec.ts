// ux 11 check 4: at 1920 the content width (container minus gutters) is 1336 px.
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { E2E_PAGES, WIDTHS } from './helpers/pages.ts';

const WIDE = WIDTHS[0]!;
const CONTENT_WIDTH = 1336;

for (const spec of E2E_PAGES) {
  test(`container width: ${spec.name} @1920`, async ({ page }) => {
    await open(page, spec, WIDE);
    const width = await page.evaluate(() => {
      const main = document.querySelector('main');
      if (main === null) return -1;
      const style = getComputedStyle(main);
      return Math.round(main.getBoundingClientRect().width - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight));
    });
    expect(width).toBe(CONTENT_WIDTH);
  });
}
