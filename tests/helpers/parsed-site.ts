// Builders for `ParsedSite` test inputs (005's shape, snake_case data as authored). Every builder takes the
// fields a test cares about and fills the rest with valid defaults, so tests read as the scenario they set up.
import type { Located, ParsedProject, ParsedSite } from '../../src/lib/content/load.ts';
import type { BookmarkData, CategoryData, GroupData, ProjectData, RelationData, TagData } from '../../src/lib/content/schema.ts';

export const SITE_URL = 'https://nessynet.io';

const located = <T>(file: string, data: T): Located<T> => ({ file, data });

/** A category with a single `plugin` type tag unless `tags` is overridden. */
export function category(id: string, over: Partial<CategoryData> = {}): Located<CategoryData> {
  return located('categories.toml', {
    id,
    label: id.toUpperCase(),
    blurb: `${id} blurb.`,
    accent: 'blue',
    tags: [{ id: 'plugin', type: true }],
    ...over,
  });
}

export const tag = (id: string, over: Partial<TagData> = {}): TagData => ({ id, ...over });
export const typeTag = (id: string, over: Partial<TagData> = {}): TagData => ({ id, type: true, ...over });

/** A valid active `plugin` project (with its `[ffxiv]` table) and a `download` get entry; `categoryId` also names the folder. */
export function project(categoryId: string, slug: string, over: Partial<ProjectData> = {}): ParsedProject {
  const data: ProjectData = {
    slug,
    name: slug,
    category: categoryId,
    status: 'active',
    summary: `${slug} summary.`,
    priority: 10,
    updated: '2025-01-01',
    description: `About ${slug}.`,
    tags: ['plugin'],
    version: '1.0.0',
    ffxiv: { requires: 'Dalamud' },
    get: [{ kind: 'download', url: `https://example.org/${slug}.zip` }],
    ...over,
  };
  return { file: `projects/${categoryId}/${slug}.toml`, data, folderCategory: categoryId, fileSlug: slug, assets: [] };
}

export const relation = (id: string, description = `${id} description`): Located<RelationData> =>
  located('bookmarks.toml', { id, description });

export const group = (id: string, label = id): Located<GroupData> => located('bookmarks.toml', { id, label });

export const bookmark = (name: string, over: Partial<BookmarkData> = {}): Located<BookmarkData> =>
  located('bookmarks.toml', {
    name,
    url: `https://example.com/${name.toLowerCase().replaceAll(' ', '-')}`,
    note: `${name} note`,
    relation: 'docs',
    ...over,
  });

/** A valid site with the given entities; unspecified collections are empty. */
export function parsedSite(over: Partial<ParsedSite> = {}): ParsedSite {
  return {
    site: located('site.toml', { url: SITE_URL, description: 'A site.' }),
    whoami: located('site.toml', { name: 'Nessy', bio: 'Bio.' }),
    categories: [],
    projects: [],
    relations: [],
    groups: [],
    bookmarks: [],
    topLevelKeys: [],
    samples: [],
    strays: [],
    orphanAssetDirs: [],
    ...over,
  };
}
