// `test` with an error watcher (S9): any uncaught page error, console error or CSP violation fails the test.
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] as const;

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        const text = message.text();
        // The 404 page is itself a 404 response, which Chromium reports as a failed load of the document.
        if (/failed to load resource/i.test(text) && message.location().url === page.url() && /\b404\b/.test(text)) return;
        if (message.type() === 'error' || /content security policy|refused to (?:load|execute|apply)/i.test(text)) {
          problems.push(`console ${message.type()}: ${text}`);
        }
      });
      await use(problems);
      expect(problems, 'page errors, console errors or CSP violations').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** axe violations as one readable line each (id, node count, first target). */
export async function axeViolations(page: Page): Promise<string[]> {
  const { violations } = await new AxeBuilder({ page }).withTags([...AXE_TAGS]).analyze();
  return violations.map((v) => `${v.id} x${v.nodes.length} ${v.nodes[0]?.target.join(' ') ?? ''}`);
}
