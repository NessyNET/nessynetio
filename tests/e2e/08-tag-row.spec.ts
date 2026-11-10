// ux check 8 (R6, R7, ux 7.6): the tag row. Chip order is config order (used tags only), the row is one line at every
// width, "+N more" counts the panel, and at 390 px the row is [all] or [all, #active]. Ports r8-acceptance.mjs 31 to 75.
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'smol-toml';
import { test, expect } from './helpers/fixtures.ts';
import { lineCount } from './helpers/dom.ts';
import { open } from './helpers/navigate.ts';
import { type PageSpec, WIDTHS } from './helpers/pages.ts';

type Content = { dir: string; categories: string[] };
const E2E: Content = { dir: 'tests/fixtures/site-e2e', categories: ['ffxiv', 'minecraft', 'linux', 'other'] };
const STRESS: Content = { dir: 'tests/fixtures/site-stress', categories: ['ffxiv'] };

/** Configured tag ids in config order, and the tag ids some project of the category actually carries. */
function expectedChips({ dir }: Content, category: string): string[] {
  const config = parse(readFileSync(resolve(dir, 'categories.toml'), 'utf8')) as { category: { id: string; tags: { id: string }[] }[] };
  const configured = config.category.find((c) => c.id === category)?.tags.map((t) => t.id) ?? [];
  const folder = resolve(dir, 'projects', category);
  const used = new Set<string>();
  for (const file of readdirTomls(folder)) {
    const project = parse(readFileSync(resolve(folder, file), 'utf8')) as { tags?: string[] };
    for (const tag of project.tags ?? []) used.add(tag);
  }
  return configured.filter((tag) => used.has(tag));
}

const readdirTomls = (folder: string): string[] => readdirSync(folder).filter((f) => f.endsWith('.toml'));

const spec = (site: 'e2e' | 'stress', category: string): PageSpec => ({ name: `${site} ${category}`, path: `/${category}/`, site });

const SETS: [Content, 'e2e' | 'stress'][] = [[E2E, 'e2e'], [STRESS, 'stress']];

for (const [content, site] of SETS) {
  for (const category of content.categories) {
    const want = expectedChips(content, category);

    for (const viewport of WIDTHS) {
      test(`tag row: ${site} ${category} @${viewport.width}: config order, used tags only, one line, +N more = panel`, async ({ page }) => {
        await open(page, spec(site, category), viewport);
        const chips = await page.locator('[data-chiprow] .chip').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['tag'] ?? ''));
        const panel = await page.locator('[data-morepanel] .chip').evaluateAll((els) => els.map((e) => (e as HTMLElement).dataset['tag'] ?? ''));
        // Row then panel is the full list, in config order, with exactly the used configured tags. (The fixtures use every
        // configured tag, so "absent when unused" is covered by the unit tests, not here.)
        expect([...chips, ...panel]).toEqual(['all', ...want]);
        expect(await lineCount(page, '[data-chiprow]'), 'the chip row wraps').toBe(1);
        const rowBox = await page.locator('[data-chiprow]').boundingBox();
        const lastChip = await page.locator('[data-chiprow] .chip').last().boundingBox();
        expect((lastChip?.x ?? 0) + (lastChip?.width ?? 0)).toBeLessThanOrEqual((rowBox?.x ?? 0) + (rowBox?.width ?? 0) + 0.5);
        const more = page.locator('[data-more]');
        if (panel.length === 0) await expect(more).toBeHidden();
        else await expect(more).toHaveText(`+${panel.length} more`);
        if (viewport.width <= 390) {
          // Phone: only [all] stays in the row; everything else is behind the toggle.
          expect(chips).toEqual(['all']);
          expect(panel.length).toBe(want.length);
        }
      });
    }
  }
}

test('phone with an active tag: the row is [all, #tag] on one line, the count drops by one, descriptions show in the panel', async ({ page }) => {
  const phone = WIDTHS[4]!;
  await open(page, spec('e2e', 'ffxiv'), phone);
  const panelTags = expectedChips(E2E, 'ffxiv');
  await page.locator('[data-more]').click();
  const first = page.locator('[data-morepanel] .chip').first();
  const descriptions = await page.locator('[data-morepanel] .chip .desc').evaluateAll((els) => els.filter((e) => getComputedStyle(e).display !== 'none').length);
  expect(descriptions, 'panel chips show their config descriptions').toBe(panelTags.length);
  const tag = await first.getAttribute('data-tag');
  await first.click();
  const row = await page.locator('[data-chiprow] .chip').evaluateAll((els) => els.map((e) => ({ tag: (e as HTMLElement).dataset['tag'], pressed: e.getAttribute('aria-pressed') })));
  expect(row.map((c) => c.tag)).toEqual(['all', tag]);
  expect(row.filter((c) => c.pressed === 'true').map((c) => c.tag)).toEqual([tag]);
  expect(await lineCount(page, '[data-chiprow]')).toBe(1);
  await expect(page.locator('[data-more]')).toHaveText(`+${panelTags.length - 1} more`);
});
