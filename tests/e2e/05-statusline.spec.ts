// ux 11 check 5: the status line is pinned to the viewport bottom and never covers content or focus.
// Tagged @cross: it also runs in firefox and webkit.
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { ALL_PAGES, WIDTHS } from './helpers/pages.ts';

const TAB_WIDTHS = WIDTHS.filter((v) => v.width === 1366 || v.width === 390);
const MAX_TABS = 400;

for (const spec of ALL_PAGES) {
  for (const viewport of WIDTHS) {
    test(`status line pinned, last content above it: ${spec.name} @${viewport.width} @cross`, async ({ page }) => {
      await open(page, spec, viewport);
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const geometry = await page.evaluate(() => {
        const line = document.querySelector('.statusline')?.getBoundingClientRect();
        const visible = [...document.querySelectorAll('main *')].filter((el) => (el as HTMLElement).offsetParent !== null && el.closest('[hidden]') === null);
        return { top: line?.top ?? NaN, bottom: line?.bottom ?? NaN, viewport: innerHeight, last: Math.max(...visible.map((el) => el.getBoundingClientRect().bottom)) };
      });
      expect(Math.round(geometry.bottom), 'status line bottom edge').toBe(geometry.viewport);
      expect(geometry.last, 'last content bottom').toBeLessThanOrEqual(geometry.top + 0.5);
    });
  }

  for (const viewport of TAB_WIDTHS) {
    test(`tabbing never lands under the status line or above the viewport: ${spec.name} @${viewport.width} @cross`, async ({ page }) => {
      await open(page, spec, viewport);
      const { stops, bad } = await obscured(page);
      expect(stops, 'focus stops visited').toBeGreaterThan(3);
      expect(bad).toEqual([]);
    });
  }
}

/** Tabs through the page: the number of stops visited and every one that sits under the status line or above the viewport top. */
async function obscured(page: Page): Promise<{ stops: number; bad: string[] }> {
  const bad: string[] = [];
  let stops = 0;
  await page.evaluate(() => window.scrollTo(0, 0));
  for (let i = 0; i < MAX_TABS; i++) {
    await page.keyboard.press('Tab');
    const stop = await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return null;
      if (el.closest('.statusline') !== null) return { inStatusLine: true as const };
      const box = el.getBoundingClientRect();
      const line = document.querySelector('.statusline')?.getBoundingClientRect();
      return { inStatusLine: false as const, label: (el.textContent ?? '').trim().slice(0, 20), top: box.top, bottom: box.bottom, lineTop: line?.top ?? Infinity };
    });
    if (stop === null) break;
    stops++;
    if (stop.inStatusLine) continue;
    if (stop.bottom > stop.lineTop + 0.5 || stop.top < 0) bad.push(`${stop.label} (${Math.round(stop.top)}..${Math.round(stop.bottom)}, line at ${Math.round(stop.lineTop)})`);
  }
  return { stops, bad };
}
