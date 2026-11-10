// Per-page meta: ux 3.2 title patterns, description, canonical and social-card fields (R19).
import type { Category, Project, SiteModel } from './content/model.ts';
import * as routes from './routes.ts';
import { TITLE_BOOKMARKS, TITLE_NOT_FOUND } from './strings.ts';

export interface PageMeta {
  title: string;
  description: string;
  /** Path only: `routes.canonical` makes it absolute and strips any query or fragment. */
  canonicalPath: string;
  ogType: 'website';
  ogTitle: string;
  ogDescription: string;
  /** Link-preview card (ADR 009); `null` until the card pipeline supplies one, and then no image tags are emitted. */
  og: OgImage | null;
}

export interface OgImage {
  path: string;
  width: 1200;
  height: 630;
  alt: string;
}

const SEPARATOR = ' · ';

/** Social tags mirror the page title and description; the image hook is filled by the card pipeline. */
const withSocial = (m: Pick<PageMeta, 'title' | 'description' | 'canonicalPath'>): PageMeta => ({
  ...m,
  ogType: 'website',
  ogTitle: m.title,
  ogDescription: m.description,
  og: null,
});

const titled = (model: SiteModel, ...parts: string[]): string => [...parts, model.site.host].join(SEPARATOR);

export const homeMeta = (model: SiteModel): PageMeta => ({
  ...withSocial({ title: model.site.host, description: model.site.description, canonicalPath: routes.home() }),
  ogDescription: model.whoami?.taglinePlain ?? model.site.description,
});

export const categoryMeta = (model: SiteModel, cat: Category): PageMeta => withSocial({
  title: titled(model, cat.label),
  description: cat.blurb,
  canonicalPath: routes.category(cat.id),
});

export function projectMeta(model: SiteModel, p: Project): PageMeta {
  const cat = model.categories.find((c) => c.id === p.categoryId);
  if (cat === undefined) throw new Error(`projectMeta: project "${p.slug}" is in category "${p.categoryId}", which is not published`);
  return withSocial({
    title: titled(model, p.name, cat.shortLabel),
    description: p.summary,
    canonicalPath: routes.project(p.categoryId, p.slug),
  });
}

export const bookmarksMeta = (model: SiteModel): PageMeta => withSocial({
  title: titled(model, TITLE_BOOKMARKS),
  description: model.site.description,
  canonicalPath: routes.bookmarks(),
});

export const notFoundMeta = (model: SiteModel): PageMeta => withSocial({
  title: titled(model, TITLE_NOT_FOUND),
  description: model.site.description,
  canonicalPath: routes.notFound(),
});
