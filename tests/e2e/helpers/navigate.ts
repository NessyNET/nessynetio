import type { Page } from '@playwright/test';
import { type PageSpec, type Viewport, urlOf } from './pages.ts';

/** Opens `spec` at `viewport` and waits until the page and its fonts have settled. */
export async function open(page: Page, spec: PageSpec, viewport: Viewport): Promise<void> {
  await page.setViewportSize(viewport);
  await page.goto(urlOf(spec), { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
}
