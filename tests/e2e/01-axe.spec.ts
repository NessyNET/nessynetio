// ux 11 check 1: axe-core, 0 violations on every page type at five widths (R16).
import { axeViolations, test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { ALL_PAGES, WIDTHS } from './helpers/pages.ts';

for (const spec of ALL_PAGES) {
  for (const viewport of WIDTHS) {
    test(`axe: ${spec.name} @${viewport.width}`, async ({ page }) => {
      await open(page, spec, viewport);
      expect(await axeViolations(page)).toEqual([]);
    });
  }
}
