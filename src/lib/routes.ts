// The only place paths are built (design 3.5.3). Trailing slash always.

/** Category ids that would collide with top-level routes or asset directories (error if used). */
export const RESERVED_CATEGORY_IDS: readonly string[] = ['bookmarks', 'og', '_astro', '404', 'fonts', 'licenses'];

export const home = (): string => '/';
export const category = (id: string): string => `/${id}/`;
export const project = (categoryId: string, slug: string): string => `/${categoryId}/${slug}/`;
export const bookmarks = (): string => '/bookmarks/';
export const bookmarkGroup = (id: string): string => `/bookmarks/#bm-${id}`;
export const install = (categoryId: string, slug: string): string => `${project(categoryId, slug)}#install`;
export const categoryWithTag = (id: string, tag: string): string => `${category(id)}?tag=${encodeURIComponent(tag)}`;
export const notFound = (): string => '/404.html';

/** Called only by the OG module, which computes `hash8` from the card input. */
export function og(pagePath: string, hash8: string): string {
  const flattened = pagePath.replace(/^\/+|\/+$/g, '').replaceAll('/', '-') || 'home';
  return `/og/${flattened}-${hash8}.png`;
}

/** Absolute canonical URL: never a query string or fragment (R19). */
export function canonical(siteUrl: string, path: string): string {
  const [pathname = ''] = path.split(/[?#]/);
  return siteUrl.replace(/\/+$/, '') + pathname;
}
