// ux check 7 (R5): the chrome and the landing page carry no Discord, Ko-fi or self-hosted Git link; links.txt is
// exactly GitHub and mail. The stress landing page configures a Discord link, which must be ignored.
import { test, expect } from './helpers/fixtures.ts';
import { open } from './helpers/navigate.ts';
import { ALL_PAGES, E2E_PAGES, STRESS_PAGES, WIDTHS } from './helpers/pages.ts';

const FORBIDDEN = /discord|ko-?fi|gitlab|bitbucket|codeberg|sr\.ht|sourcehut|gitea/i;
const VIEWPORT = WIDTHS[1]!;
const landings = [E2E_PAGES[0]!, STRESS_PAGES[0]!];

for (const spec of ALL_PAGES) {
  test(`no forbidden owner link in the tab bar or status line: ${spec.name}`, async ({ page }) => {
    await open(page, spec, VIEWPORT);
    const links = await page.locator('.tmux a, .statusline a').evaluateAll((as) => as.map((a) => `${(a as HTMLAnchorElement).href} ${a.textContent ?? ''}`));
    expect(links.length).toBeGreaterThan(0);
    expect(links.filter((l) => FORBIDDEN.test(l))).toEqual([]);
  });
}

for (const spec of landings) {
  test(`landing has no forbidden link anywhere, and links.txt is exactly GitHub and mail: ${spec.name}`, async ({ page }) => {
    await open(page, spec, VIEWPORT);
    const all = await page.locator('main a').evaluateAll((as) => as.map((a) => `${(a as HTMLAnchorElement).href} ${a.textContent ?? ''}`));
    expect(all.filter((l) => FORBIDDEN.test(l))).toEqual([]);
    const links = await page.locator('#sec-w-links a').evaluateAll((as) =>
      as.map((a) => (a as HTMLAnchorElement).protocol === 'mailto:' ? 'mail' : (a as HTMLAnchorElement).host),
    );
    expect(links.sort()).toEqual(['github.com', 'mail']);
    expect(await page.locator('#sec-w-links dt').allTextContents()).toEqual(['github:', 'mail:']);
  });
}
