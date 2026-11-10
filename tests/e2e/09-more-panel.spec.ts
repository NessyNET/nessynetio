// ux check 9 (R6, ux 7.6): the "+N more" panel. @cross: also runs in firefox and webkit.
import { test, expect } from './helpers/fixtures.ts';
import { lineCount } from './helpers/dom.ts';
import { open } from './helpers/navigate.ts';
import { WIDTHS } from './helpers/pages.ts';

const MANY_TAGS = { name: 'many-tags', path: '/ffxiv/', site: 'stress' } as const;
const VIEWPORTS = WIDTHS.filter((v) => [1366, 390].includes(v.width));

for (const viewport of VIEWPORTS) {
  test(`more panel: aria-expanded, focus into the panel, Esc returns focus @${viewport.width} @cross`, async ({ page }) => {
    await open(page, MANY_TAGS, viewport);
    const toggle = page.locator('[data-more]');
    const panel = page.locator('[data-morepanel]');
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(panel).toBeVisible();
    expect(await page.evaluate(() => document.activeElement?.closest('[data-morepanel]') !== null), 'focus moves into the panel').toBe(true);

    await page.keyboard.press('Escape');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(panel).toBeHidden();
    expect(await page.evaluate(() => document.activeElement?.matches('[data-more]')), 'Esc returns focus to the toggle').toBe(true);
  });

  test(`a tag chosen from the panel is pinned in the row, pressed, keeps focus and shows in ls @${viewport.width} @cross`, async ({ page }) => {
    await open(page, MANY_TAGS, viewport);
    await page.locator('[data-more]').click();
    const chip = page.locator('[data-morepanel] .chip').nth(2);
    const tag = await chip.getAttribute('data-tag');
    expect(tag).not.toBeNull();
    await chip.click();
    await expect(page.locator(`[data-chiprow] .chip[data-tag="${tag}"]`)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset['tag'])).toBe(tag);
    await expect(page.locator('[data-ls-arg]')).toHaveText(new RegExp(`--tag=${tag}\\b`));
    expect(await lineCount(page, '[data-chiprow]'), 'the pinned chip must not wrap the row').toBe(1);
  });
}
