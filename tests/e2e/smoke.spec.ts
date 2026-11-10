// Smoke test of the owner's real `content/` build (ux 11 check 19, design 5.2 Smoke row). Runs only when
// E2E_SMOKE_URL points at a `--strict --allow-samples` build of `content/`; the page list comes from its sitemap.
// Axe and overflow at 1366 and 390 on every page, and the external-link rule (ux 11 check 6).
import { axeViolations, expect, test } from './helpers/fixtures.ts';

const SMOKE_URL = process.env['E2E_SMOKE_URL'];
const SMOKE_WIDTHS = [
  { width: 1366, height: 900 },
  { width: 390, height: 844 },
] as const;
/** A path no page has: the build's 404 page is checked too. */
const NOT_FOUND_PATH = '/__smoke-not-found__/';

async function pagePaths(base: string): Promise<string[]> {
  const sitemap = await (await fetch(new URL('/sitemap-0.xml', base))).text();
  const paths = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1] ?? '').pathname);
  if (paths.length === 0) throw new Error(`no pages found in ${base}/sitemap-0.xml`);
  return [...paths, NOT_FOUND_PATH];
}

if (SMOKE_URL !== undefined) {
  const paths = await pagePaths(SMOKE_URL);
  for (const path of paths) {
    for (const viewport of SMOKE_WIDTHS) {
      test(`smoke: ${path} @${viewport.width}`, async ({ page }) => {
        await page.setViewportSize(viewport);
        await page.goto(new URL(path, SMOKE_URL).href, { waitUntil: 'networkidle' });
        await page.evaluate(() => document.fonts.ready);

        expect(await axeViolations(page), 'axe').toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth), 'scrollWidth').toBeLessThanOrEqual(viewport.width);

        const broken = await page.evaluate(() => {
          const own = location.host;
          return [...document.querySelectorAll('a')].flatMap((a) => {
            const problems: string[] = [];
            const label = `${(a.textContent ?? '').trim().slice(0, 30)} -> ${a.getAttribute('href')}`;
            const newTab = a.target === '_blank';
            const text = a.textContent ?? '';
            if (newTab) {
              if (!/noopener/.test(a.rel) || !/noreferrer/.test(a.rel)) problems.push('rel lacks noopener noreferrer');
              if (!(a.querySelector('[aria-hidden="true"]')?.textContent ?? '').includes('↗')) problems.push('no aria-hidden arrow');
              if (!text.includes('(opens in new tab)')) problems.push('no "(opens in new tab)" text');
            }
            if (text.includes('↗') && !newTab) problems.push('arrow without target=_blank');
            if (a.protocol === 'mailto:' && a.target !== '') problems.push('mailto link has a target');
            if (/^https?:$/.test(a.protocol) && a.host !== own && !newTab) problems.push('off-host link without target=_blank');
            return problems.map((p) => `${label}: ${p}`);
          });
        });
        expect(broken, 'external links').toEqual([]);
      });
    }
  }
} else {
  test.skip('smoke (set E2E_SMOKE_URL)', () => {});
}
