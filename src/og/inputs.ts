// Card inputs per page and the hashed card URL (design 3.5.5, ADR 009). Inputs are built from plain fields only: the
// frozen site model is cyclic (`seeAlso.mine`) and must never be serialised.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Category, Project, SiteModel } from '../lib/content/model.ts';
import * as routes from '../lib/routes.ts';
import { TITLE_BOOKMARKS } from '../lib/strings.ts';
import type { OgCardInput } from './types.ts';

export const OG_WIDTH = 1200;
export const OG_HEIGHT = 630;

/** Where the hooks in `PageMeta` point: `og:image` and its dimensions and alt text. */
export interface OgImageRef {
  path: string;
  width: typeof OG_WIDTH;
  height: typeof OG_HEIGHT;
  alt: string;
}

/** Drops unset optional fields so they are absent (not `undefined`) in the input and in its hash. */
const defined = (fields: { [K in keyof OgCardInput]: OgCardInput[K] | undefined }): OgCardInput =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined)) as unknown as OgCardInput;

export const defaultCard = (model: SiteModel): OgCardInput => ({
  kind: 'default',
  title: model.site.host,
  subtitle: model.site.description,
});

export const homeCard = (model: SiteModel): OgCardInput => ({
  kind: 'home',
  title: model.site.host,
  subtitle: model.whoami?.taglinePlain ?? model.site.description,
});

export const categoryCard = (cat: Category): OgCardInput => ({
  kind: 'category',
  title: cat.label,
  subtitle: cat.blurb,
  categoryLabel: cat.shortLabel,
  accent: cat.accent,
});

export const bookmarksCard = (model: SiteModel): OgCardInput => ({
  kind: 'bookmarks',
  title: TITLE_BOOKMARKS,
  subtitle: model.site.description,
});

export function projectCard(model: SiteModel, p: Project): OgCardInput {
  const cat = model.categories.find((c) => c.id === p.categoryId);
  const first = p.screenshots[0];
  return defined({
    kind: 'project',
    title: p.name,
    subtitle: p.summary,
    categoryLabel: cat?.shortLabel,
    accent: cat?.accent,
    status: p.status,
    version: p.version,
    screenshot: first === undefined ? undefined : { file: first.file, alt: first.caption },
  });
}

/** One card input per page path: every published page plus the 404 (which uses the default card). */
export function ogInputsFor(model: SiteModel): Map<string, OgCardInput> {
  const inputs = new Map<string, OgCardInput>();
  inputs.set(routes.home(), homeCard(model));
  inputs.set(routes.bookmarks(), bookmarksCard(model));
  for (const cat of model.categories) {
    inputs.set(routes.category(cat.id), categoryCard(cat));
    for (const p of cat.projects) inputs.set(p.path, projectCard(model, p));
  }
  inputs.set(routes.notFound(), defaultCard(model));
  return inputs;
}

/** The screenshot's bytes, or `undefined` when the card has none. */
export function readScreenshot(input: OgCardInput, contentDir: string): Uint8Array | undefined {
  return input.screenshot === undefined ? undefined : readFileSync(join(contentDir, input.screenshot.file));
}

/** Hashed card URL: changes whenever the card text, accent or screenshot bytes change, so scrapers refetch. */
export function ogPathFor(pagePath: string, input: OgCardInput, contentDir: string): string {
  const hash = createHash('sha256').update(JSON.stringify(input));
  const shot = readScreenshot(input, contentDir);
  if (shot !== undefined) hash.update(createHash('sha256').update(shot).digest());
  return routes.og(pagePath, hash.digest('hex').slice(0, 8));
}

export const ogAlt = (input: OgCardInput): string => `${input.title}: ${input.subtitle}`;

export function ogRef(pagePath: string, input: OgCardInput, contentDir: string): OgImageRef {
  return { path: ogPathFor(pagePath, input, contentDir), width: OG_WIDTH, height: OG_HEIGHT, alt: ogAlt(input) };
}
