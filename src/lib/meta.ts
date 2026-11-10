// Basic per-page meta (ux 3.2 title patterns, R19). 027 extends this with the social-card fields.
import type { Category, Project, SiteModel } from './content/model.ts';
import * as routes from './routes.ts';
import { TITLE_BOOKMARKS, TITLE_NOT_FOUND } from './strings.ts';

export interface PageMeta {
  title: string;
  description: string;
  /** Path only: `routes.canonical` makes it absolute and strips any query or fragment. */
  canonicalPath: string;
}

const SEPARATOR = ' · ';
const titled = (model: SiteModel, ...parts: string[]): string => [...parts, model.site.host].join(SEPARATOR);

export const homeMeta = (model: SiteModel): PageMeta => ({
  title: model.site.host,
  description: model.site.description,
  canonicalPath: routes.home(),
});

export const categoryMeta = (model: SiteModel, cat: Category): PageMeta => ({
  title: titled(model, cat.label),
  description: cat.blurb,
  canonicalPath: routes.category(cat.id),
});

export function projectMeta(model: SiteModel, p: Project): PageMeta {
  const cat = model.categories.find((c) => c.id === p.categoryId);
  if (cat === undefined) throw new Error(`projectMeta: project "${p.slug}" is in category "${p.categoryId}", which is not published`);
  return {
    title: titled(model, p.name, cat.shortLabel),
    description: p.summary,
    canonicalPath: routes.project(p.categoryId, p.slug),
  };
}

export const bookmarksMeta = (model: SiteModel): PageMeta => ({
  title: titled(model, TITLE_BOOKMARKS),
  description: model.site.description,
  canonicalPath: routes.bookmarks(),
});

export const notFoundMeta = (model: SiteModel): PageMeta => ({
  title: titled(model, TITLE_NOT_FOUND),
  description: model.site.description,
  canonicalPath: routes.notFound(),
});
