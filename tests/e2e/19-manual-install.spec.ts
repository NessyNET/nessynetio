// ux 4.3 (Linux tool): an install method with no command is manual steps, so it has no copy button; the methods that
// have a command keep theirs. @cross: firefox and webkit run it too.
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';

for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
  test(`install: a command-less method has no copy button, the others keep theirs @${viewport.width} @cross`, async ({ page }) => {
    await open(page, { name: 'theme', path: '/linux/nessy-theme/', site: 'e2e' }, viewport);
    const methods = page.locator('#sec-w-inst .method');
    await expect(methods).toHaveCount(2);
    await expect(methods.nth(0).locator('.copyrow')).toHaveCount(1);
    await expect(methods.nth(0).locator('button.copy')).toHaveCount(1);
    await expect(methods.nth(1).locator('h3')).toHaveText('VS Code');
    await expect(methods.nth(1).locator('.copyrow')).toHaveCount(0);
    await expect(methods.nth(1).locator('button.copy')).toHaveCount(0);
    await expect(methods.nth(1).locator('ol > li')).toHaveCount(3);
    await expect(methods.nth(1).locator('ol')).toBeVisible();
  });
}

for (const viewport of [{ width: 1366, height: 900 }, { width: 390, height: 844 }]) {
  test(`install: backtick text is code, and the manual list matches the plugin steps @${viewport.width} @cross`, async ({ page }) => {
    await open(page, { name: 'theme', path: '/linux/nessy-theme/', site: 'e2e' }, viewport);
    const manual = page.locator('#sec-w-inst .method').nth(1);
    await expect(manual.locator('li code')).toHaveText(['dist/vscode', '~/.vscode/extensions/nessy-theme']);
    await expect(manual.locator('.note code')).toHaveText('include nessy.conf');
    expect(await manual.innerText()).not.toContain('`include');
    const style = (selector: string) =>
      page.locator(selector).first().evaluate((ol) => {
        const li = ol.querySelector('li') as HTMLElement;
        const cs = getComputedStyle(ol);
        return { padding: cs.paddingLeft, item: getComputedStyle(li).paddingTop, marker: getComputedStyle(li, '::marker').color };
      });
    const manualStyle = await style('#sec-w-inst .method:nth-of-type(2) ol');
    // The reference is the plugin page's Dalamud steps, on the same site.
    await page.goto(new URL('/ffxiv/loch-lantern/', page.url()).toString());
    const pluginStyle = await style('#sec-w-inst ol');
    expect(manualStyle).toEqual(pluginStyle);
    expect(manualStyle.item).toBe('3px');
  });

  test(`install: the numbers sit inside the window, right of the method heading edge @${viewport.width} @cross`, async ({ page }) => {
    await open(page, { name: 'theme', path: '/linux/nessy-theme/', site: 'e2e' }, viewport);
    const manual = page.locator('#sec-w-inst .method').nth(1);
    const heading = await manual.locator('h3').boundingBox();
    const first = await manual.locator('li').first().boundingBox();
    expect(first?.x ?? 0, 'step text starts to the right of the heading edge').toBeGreaterThan(heading?.x ?? 0);
    const marker = await manual.locator('ol').evaluate((ol) => ol.getBoundingClientRect().left + parseFloat(getComputedStyle(ol).paddingLeft));
    expect(marker).toBeGreaterThan(heading?.x ?? 0);
  });
}
