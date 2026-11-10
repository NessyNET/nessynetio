// ux check 12 (R10, ux 7.16, 5.1): every copy button puts the exact text on the clipboard, shows "copied", sets the
// state and announces it (the browser test of announce.ts). @cross: firefox and webkit run it too. Reading the
// clipboard back needs a permission only Chromium grants through Playwright, so the other engines assert the label,
// the state and the live region (the visible effect of a successful write) instead of the clipboard contents.
import { test, expect } from './helpers/fixtures.ts';
import { liveText } from './helpers/dom.ts';
import { open } from './helpers/navigate.ts';

const PAGES = [
  { name: 'ffxiv repo window', path: '/ffxiv/', site: 'e2e' },
  { name: 'plugin', path: '/ffxiv/loch-lantern/', site: 'e2e' },
  { name: 'mc-modpack', path: '/minecraft/highland-pack/', site: 'e2e' },
  { name: 'linux-tool', path: '/linux/lochctl/', site: 'e2e' },
] as const;

for (const spec of PAGES) {
  test(`copy buttons: ${spec.name} @cross`, async ({ page, context, browserName }) => {
    if (browserName === 'chromium') await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, spec, { width: 1366, height: 900 });
    const buttons = page.locator('button[data-copy]');
    const count = await buttons.count();
    expect(count, 'the page has copy buttons').toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const button = buttons.nth(i);
      const value = await button.getAttribute('data-copy');
      await button.scrollIntoViewIfNeeded();
      await button.click();
      await expect(button.locator('[data-label]')).toHaveText('copied');
      await expect(button).toHaveAttribute('data-state', 'copied');
      await expect.poll(() => liveText(page), { message: `live region after copy #${i}` }).toBe('Copied to clipboard');
      if (browserName === 'chromium') {
        expect(await page.evaluate(() => navigator.clipboard.readText()), `clipboard after copy #${i}`).toBe(value);
      }
      // The value is the text shown next to the button.
      expect((await button.locator('xpath=preceding-sibling::code').textContent())?.trim()).toBe(value);
      await expect(button.locator('[data-label]')).toHaveText('copy', { timeout: 4000 });
      await expect(button).not.toHaveAttribute('data-state', /./);
    }
  });
}

test('with no Clipboard API the text is selected and the button says to press Ctrl+C @cross', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }));
  await open(page, PAGES[3], { width: 1366, height: 900 });
  const button = page.locator('button[data-copy]').first();
  await button.click();
  await expect(button.locator('[data-label]')).toHaveText('press Ctrl+C');
  await expect(button).toHaveAttribute('data-state', 'failed');
  expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(await button.getAttribute('data-copy'));
  await expect.poll(() => liveText(page)).toBe('Could not copy. The text is selected; press Ctrl+C.');
});
