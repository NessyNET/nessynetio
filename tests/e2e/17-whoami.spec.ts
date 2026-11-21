// ux check 17 (R5, ux 5.9, 4.1, 7.8): whoami. The e2e bio is within 280 characters; on the long-bio stress landing the
// links window sits beside whoami above 900 px and below it at 900 px and under, with no Discord link and a tagline
// whose spans carry the colour-cycle classes.
import type { Page } from '@playwright/test';
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { WIDTHS } from './helpers/pages.ts';

const E2E_LANDING = { name: 'landing', path: '/', site: 'e2e' } as const;
const STRESS_LANDING = { name: 'landing-longbio', path: '/', site: 'stress' } as const;

test('the e2e landing bio is at most 280 characters', async ({ page }) => {
  await open(page, E2E_LANDING, WIDTHS[1]!);
  expect((await page.locator('.bio').innerText()).length).toBeLessThanOrEqual(280);
});

for (const viewport of WIDTHS) {
  for (const spec of [E2E_LANDING, STRESS_LANDING]) {
    test(`links.txt sits ${viewport.width > 900 ? 'beside' : 'below'} whoami: ${spec.name} @${viewport.width}`, async ({ page }) => {
      await open(page, spec, viewport);
      const [who, links] = await Promise.all([page.locator('#sec-w-who').boundingBox(), page.locator('#sec-w-links').boundingBox()]);
      expect(who).not.toBeNull();
      expect(links).not.toBeNull();
      if (viewport.width > 900) expect(Math.abs((who?.y ?? 0) - (links?.y ?? 0)), 'same row').toBeLessThan(2);
      else expect(links!.y, 'stacked below').toBeGreaterThanOrEqual(who!.y + who!.height - 1);
      expect(await page.locator('#sec-w-links a').count()).toBe(2);
    });
  }
}

test('stress landing: a long bio does not break the layout, no Discord link, the tagline cycles colours', async ({ page }) => {
  await open(page, STRESS_LANDING, WIDTHS[1]!);
  expect((await page.locator('.bio').innerText()).length, 'the stress bio really is long').toBeGreaterThan(280);
  expect(await page.locator('main a[href*="discord"]').count()).toBe(0);
  const accents = await page.locator('.tagline span').evaluateAll((els) => els.map((e) => [...e.classList].filter((c) => c.startsWith('acc-'))).flat());
  expect(accents.length, 'tagline spans carry acc-* classes').toBeGreaterThan(0);
  expect(accents.every((c) => /^acc-(green|yellow|cyan|orange|purple|blue|teal|pink|red)$/.test(c))).toBe(true);
  expect(accents, 'a disallowed colour falls back to the automatic cycle').not.toContain('acc-red');
});

// ux 7.14: the e2e tagline carries five accents (three explicit, two automatic) and exactly 80 rendered characters.
// Both the colours and the layout are read off the real page.
const FIVE = ['green', 'yellow', 'cyan', 'pink', 'purple'] as const;

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 900 }]) {
  test(`five tagline accents: each in its own palette colour @${viewport.width} @cross`, async ({ page }) => {
    await open(page, E2E_LANDING, viewport);
    const spans = page.locator('.tagline span');
    await expect(spans).toHaveCount(5);
    const found = await spans.evaluateAll((els) =>
      els.map((el) => {
        const name = [...el.classList].find((c) => c.startsWith('acc-'))?.slice(4) ?? '';
        const probe = document.createElement('i');
        probe.style.color = `var(--${name})`;
        document.body.append(probe);
        const token = getComputedStyle(probe).color;
        probe.remove();
        return { name, colour: getComputedStyle(el).color, token };
      }),
    );
    expect(found.map((f) => f.name)).toEqual([...FIVE]);
    for (const f of found) expect(f.colour, `${f.name} uses its own token`).toBe(f.token);
    expect(new Set(found.map((f) => f.colour)).size, 'five distinct colours').toBe(5);
  });

  test(`five tagline accents: the tagline stays inside its window @${viewport.width} @cross`, async ({ page }) => {
    await open(page, E2E_LANDING, viewport);
    expect(await taglineFits(page), 'fits as built').toBe(true);
    // Guard against a check that cannot fail: one span forced wide must be caught.
    await page.locator('.tagline span').first().evaluate((el) => {
      (el as HTMLElement).style.whiteSpace = 'nowrap';
      (el as HTMLElement).style.display = 'inline-block';
      (el as HTMLElement).style.minWidth = '3000px';
    });
    expect(await taglineFits(page), 'a 3000 px span is caught').toBe(false);
  });
}

/** Every accent span lies inside the whoami window body (the window clips overflow, so scrollWidth alone would hide it). */
const taglineFits = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const body = document.querySelector('#sec-w-who .body')?.getBoundingClientRect();
    const h1 = document.querySelector('#sec-w-who h1');
    if (body === undefined || h1 === null) return false;
    const inside = [...h1.querySelectorAll('.tagline span')].every((el) => el.getBoundingClientRect().right <= body.right + 0.5);
    return inside && h1.scrollWidth <= h1.clientWidth + 1;
  });
