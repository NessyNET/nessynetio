// ux check 18 (ux 5.5, R18): a click on a screenshot thumbnail opens one native modal dialog with the large image and
// its caption. Esc and a backdrop click close it and focus goes back to the thumbnail; the arrow keys step through the
// project's screenshots (wrapping); it fits a phone; with JavaScript off the thumbnail is a plain link to the image.
// @cross: firefox and webkit run it too.
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { urlOf } from './helpers/pages.ts';

const PLUGIN = { name: 'plugin', path: '/ffxiv/loch-lantern/', site: 'e2e' } as const; // 3 screenshots
const WEBTOOL = { name: 'webtool', path: '/ffxiv/gorse-gearplanner/', site: 'e2e' } as const; // 1 screenshot
const DESKTOP = { width: 1366, height: 900 };
const PHONE = { width: 390, height: 844 };

for (const spec of [PLUGIN, WEBTOOL]) {
  test(`modal: opens on click, shows the large image and caption, Esc closes and returns focus: ${spec.name} @cross`, async ({ page }) => {
    await open(page, spec, DESKTOP);
    const box = page.locator('dialog[data-shotbox]');
    await expect(box).toBeHidden();
    await expect(box.locator('img')).not.toHaveAttribute('src', /.+/);
    const thumb = page.locator('a[data-shot]').first();
    const caption = await thumb.locator('img').getAttribute('alt');
    await thumb.click();
    await expect(box).toBeVisible();
    await expect(box.locator('[data-shot-caption]')).toHaveText(caption ?? '');
    await expect.poll(() => box.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
    expect(await box.evaluate((el: HTMLDialogElement) => el.matches(':modal'))).toBe(true);
    await page.keyboard.press('Escape');
    await expect(box).toBeHidden();
    await expect(box.locator('img')).not.toHaveAttribute('src', /.+/);
    await expect(thumb).toBeFocused();
  });
}

test('modal: opens from the keyboard and the focus stays inside until it closes @cross', async ({ page }) => {
  await open(page, PLUGIN, DESKTOP);
  const thumb = page.locator('a[data-shot]').first();
  await thumb.focus();
  await page.keyboard.press('Enter');
  const box = page.locator('dialog[data-shotbox]');
  await expect(box).toBeVisible();
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('Tab');
    // Focus may leave the page for the browser's own controls (body); it never lands on the page behind the dialog.
    const behind = await page.evaluate(() => document.activeElement !== document.body && document.activeElement?.closest('dialog') === null);
    expect(behind, `Tab ${i + 1} does not reach the page behind the dialog`).toBe(false);
  }
  await page.locator('[data-shot-close]').click();
  await expect(box).toBeHidden();
  await expect(thumb).toBeFocused();
});

test('modal: arrow keys and the buttons step through the screenshots and wrap @cross', async ({ page }) => {
  await open(page, PLUGIN, DESKTOP);
  const alts = await page.locator('a[data-shot] img').evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).alt));
  expect(alts).toHaveLength(3);
  await page.locator('a[data-shot]').nth(1).click();
  const box = page.locator('dialog[data-shotbox]');
  const caption = box.locator('[data-shot-caption]');
  const counter = box.locator('[data-shot-count]');
  await expect(caption).toHaveText(alts[1] ?? '');
  await expect(counter).toHaveText('2 of 3');
  await page.keyboard.press('ArrowRight');
  await expect(caption).toHaveText(alts[2] ?? '');
  await page.keyboard.press('ArrowRight');
  await expect(caption).toHaveText(alts[0] ?? '');
  await page.keyboard.press('ArrowLeft');
  await expect(caption).toHaveText(alts[2] ?? '');
  await box.locator('[data-shot-prev]').click();
  await expect(counter).toHaveText('2 of 3');
  await box.locator('[data-shot-next]').click();
  await expect(counter).toHaveText('3 of 3');
  await page.keyboard.press('Escape');
  await expect(page.locator('a[data-shot]').nth(1)).toBeFocused();
});

test('modal: stepping is announced through a polite live region and focus stays on the button @cross', async ({ page }) => {
  await open(page, PLUGIN, DESKTOP);
  const alts = await page.locator('a[data-shot] img').evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).alt));
  await page.locator('a[data-shot]').first().click();
  const box = page.locator('dialog[data-shotbox]');
  const live = box.locator('[aria-live="polite"]');
  await expect(live).toHaveCount(1);
  await expect(live).toHaveAttribute('aria-atomic', 'true');
  await box.getByRole('button', { name: 'Next screenshot' }).click();
  await expect(live).toContainText(alts[1] ?? '');
  await expect(live).toContainText('2 of 3');
  await expect(box.getByRole('button', { name: 'Next screenshot' })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(live).toContainText('3 of 3');
  await expect(box.getByRole('button', { name: 'Next screenshot' })).toBeFocused();
});

test('modal: buttons have full accessible names @cross', async ({ page }) => {
  await open(page, PLUGIN, DESKTOP);
  await page.locator('a[data-shot]').first().click();
  const box = page.locator('dialog[data-shotbox]');
  for (const name of ['Close screenshot', 'Prev screenshot', 'Next screenshot']) {
    await expect(box.getByRole('button', { name })).toBeVisible();
  }
});

// A tall image and a 3-line caption must not push the controls out of the dialog (ux 5.5b). The large image and the
// caption are swapped in the page: the fixtures hold only landscape images with short captions.
for (const viewport of [{ width: 1366, height: 768 }, { width: 1366, height: 900 }, { width: 390, height: 844 }]) {
  test(`modal: a portrait image with a long caption keeps the controls in view @${viewport.width}x${viewport.height} @cross`, async ({ page }) => {
    await open(page, PLUGIN, viewport);
    await page.locator('a[data-shot]').first().click();
    const box = page.locator('dialog[data-shotbox]');
    await expect(box).toBeVisible();
    await box.evaluate(async (dialog: HTMLDialogElement) => {
      const canvas = document.createElement('canvas');
      canvas.width = 900;
      canvas.height = 1800;
      const ctx = canvas.getContext('2d');
      if (ctx !== null) {
        ctx.fillStyle = '#3a5';
        ctx.fillRect(0, 0, 900, 1800);
      }
      const img = dialog.querySelector('img') as HTMLImageElement;
      img.src = canvas.toDataURL('image/png');
      await img.decode();
      const caption = dialog.querySelector('[data-shot-caption]') as HTMLElement;
      caption.textContent = 'A very long caption that explains in some detail what this screenshot shows, '.repeat(6);
    });
    const fit = await box.evaluate((dialog: HTMLDialogElement) => {
      const inView = (el: Element) => {
        const r = el.getBoundingClientRect();
        return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth;
      };
      const caption = dialog.querySelector('[data-shot-caption]') as HTMLElement;
      const img = dialog.querySelector('img') as HTMLImageElement;
      const dialogRect = dialog.getBoundingClientRect();
      const captionRect = caption.getBoundingClientRect();
      return {
        overflow: dialog.scrollHeight - dialog.clientHeight,
        buttons: [...dialog.querySelectorAll('button')].map(inView),
        captionLines: Math.round(captionRect.height / parseFloat(getComputedStyle(caption).lineHeight)),
        imgInside: img.getBoundingClientRect().bottom <= captionRect.top + 1,
        dialogInView: dialogRect.bottom <= innerHeight && dialogRect.top >= 0,
        imgHeight: img.getBoundingClientRect().height,
      };
    });
    expect(fit.overflow, 'the dialog does not scroll').toBeLessThanOrEqual(0);
    expect(fit.buttons, 'close, prev and next are inside the viewport').toEqual([true, true, true]);
    expect(fit.captionLines, 'the modal caption is clamped').toBeLessThanOrEqual(3);
    expect(fit.imgInside, 'the image sits above the caption').toBe(true);
    expect(fit.dialogInView).toBe(true);
    expect(fit.imgHeight, 'the image keeps a useful size').toBeGreaterThan(100);
  });
}

test('modal: the grid has two thumbnail columns on a phone', async ({ page }) => {
  await open(page, PLUGIN, PHONE);
  const columns = await page.locator('a[data-shot]').evaluateAll((links) => new Set(links.map((l) => Math.round(l.getBoundingClientRect().left))).size);
  expect(columns).toBe(2);
});

test('modal: a click on the backdrop closes it, a click inside does not @cross', async ({ page }) => {
  await open(page, PLUGIN, DESKTOP);
  await page.locator('a[data-shot]').first().click();
  const box = page.locator('dialog[data-shotbox]');
  await expect(box).toBeVisible();
  await box.locator('[data-shot-caption]').click();
  await expect(box).toBeVisible();
  await page.mouse.click(2, 2);
  await expect(box).toBeHidden();
});

test('modal: a single screenshot has no prev/next', async ({ page }) => {
  await open(page, WEBTOOL, DESKTOP);
  await page.locator('a[data-shot]').first().click();
  await expect(page.locator('[data-shot-nav]')).toBeHidden();
});

test('modal: the thumbnail shows a focus ring', async ({ page }) => {
  await open(page, PLUGIN, DESKTOP);
  const thumb = page.locator('a[data-shot]').first();
  await thumb.focus();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Tab');
  const outline = await thumb.evaluate((el) => {
    const style = getComputedStyle(el);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });
  expect(outline.style).not.toBe('none');
  expect(parseFloat(outline.width)).toBeGreaterThan(0);
});

test('modal: fits a phone with no sideways scroll and the whole image visible @cross', async ({ page }) => {
  await open(page, PLUGIN, PHONE);
  await page.locator('a[data-shot]').first().click();
  const box = page.locator('dialog[data-shotbox]');
  await expect(box).toBeVisible();
  await expect.poll(() => box.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBeGreaterThan(0);
  const fit = await page.evaluate(() => {
    const dialog = document.querySelector('dialog[data-shotbox]') as HTMLDialogElement;
    const rect = dialog.getBoundingClientRect();
    const img = dialog.querySelector('img') as HTMLImageElement;
    const imgRect = img.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width: innerWidth,
      height: innerHeight,
      imgRight: imgRect.right,
      scrollX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  expect(fit.left).toBeGreaterThanOrEqual(0);
  expect(fit.right).toBeLessThanOrEqual(fit.width);
  expect(fit.bottom).toBeLessThanOrEqual(fit.height);
  expect(fit.imgRight).toBeLessThanOrEqual(fit.right);
  expect(fit.scrollX).toBe(0);
  for (const button of await box.locator('button').all()) {
    const size = await button.boundingBox();
    expect(size?.height ?? 0, 'tap target height').toBeGreaterThan(39.5);
  }
});

test.describe('JavaScript off', () => {
  test.use({ javaScriptEnabled: false });

  test('a thumbnail is a plain link that opens the image @cross', async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto(urlOf(PLUGIN));
    await expect(page.locator('dialog[data-shotbox]')).toBeHidden();
    const thumb = page.locator('a[data-shot]').first();
    const href = await thumb.getAttribute('href');
    expect(href).toMatch(/\.webp$/);
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith(href ?? 'missing')), thumb.click()]);
    expect(response?.ok()).toBe(true);
    expect(page.url()).toContain(href ?? 'missing');
    expect(response?.headers()['content-type']).toMatch(/image\//);
  });
});
