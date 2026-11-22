// `test` with an error watcher (S9): any uncaught page error, console error or CSP violation fails the test.
import AxeBuilder from '@axe-core/playwright';
import { test as base, expect, type Page } from '@playwright/test';

export const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'] as const;

export const test = base.extend<{ problems: string[] }>({
  problems: [
    async ({ page }, use) => {
      const problems: string[] = [];
      // The 404 page is itself a 404 response, which browsers report as a failed load of the document. WebKit logs it
      // before the navigation commits (page.url() is still the old page), so the message is matched against the
      // documents that answered 404, once the test is over.
      const notFoundDocuments = new Set<string>();
      const failedLoads: { url: string; problem: string }[] = [];
      page.on('response', (response) => {
        if (response.status() === 404 && response.request().isNavigationRequest()) notFoundDocuments.add(response.url());
      });
      page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
      page.on('console', (message) => {
        const text = message.text();
        const problem = `console ${message.type()}: ${text}`;
        if (/failed to load resource/i.test(text) && /\b404\b/.test(text)) failedLoads.push({ url: message.location().url, problem });
        else if (message.type() === 'error' || /content security policy|refused to (?:load|execute|apply)/i.test(text)) problems.push(problem);
      });
      await use(problems);
      for (const { url, problem } of failedLoads) if (!notFoundDocuments.has(url)) problems.push(problem);
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
