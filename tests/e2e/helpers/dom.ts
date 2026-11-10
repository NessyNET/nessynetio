// Small DOM readers shared by the 035 specs (they run inside the page).
import type { Locator, Page } from '@playwright/test';

/** What a screen reader says for an element: text with `aria-hidden` parts removed, blocks separated, whitespace collapsed. */
export const spoken = (target: Locator): Promise<string> =>
  target.evaluate((el) => {
    const copy = el.cloneNode(true) as Element;
    copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => hidden.remove());
    copy.querySelectorAll('li, p, div, tr, td, th, dt, dd').forEach((block) => block.append(' '));
    return (copy.textContent ?? '').replace(/\s+/g, ' ').trim();
  });

/** Number of distinct vertical positions among the children of `selector` (1 means a single line). */
export const lineCount = (page: Page, selector: string): Promise<number> =>
  page.evaluate((sel) => {
    const row = document.querySelector(sel);
    return new Set([...(row?.children ?? [])].map((child) => Math.round(child.getBoundingClientRect().top))).size;
  }, selector);

/** The visible text of the polite live region. */
export const liveText = (page: Page): Promise<string> => page.locator('#live').evaluate((el) => (el.textContent ?? '').trim());
