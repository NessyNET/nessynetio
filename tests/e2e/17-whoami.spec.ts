// ux check 17 (R5, ux 5.9, 4.1, 7.8): whoami. The e2e bio is within 280 characters; on the long-bio stress landing the
// links window sits beside whoami above 900 px and below it at 900 px and under, with no Discord link and a tagline
// whose spans carry the colour-cycle classes.
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
