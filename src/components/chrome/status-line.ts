// Per-page-type contents of the status line (ux 4.1 to 4.5). Plain data: the page passes the numbers, never wording.
import type { Status } from '../../lib/content/model.ts';
import { dirCount, linkCount, projectCount, STATUS_404, STATUS_EMPTY, STATUS_EXTERNAL, STATUS_NOT_FOUND } from '../../lib/strings.ts';

export type StatusLineProps =
  /** `NESSY | ~ | N projects | … | D dirs, 1 link` */
  | { kind: 'home'; projects: number; dirs: number }
  /**
   * `NESSY | ~/cat | tag:all sort:default | … | N projects`; the category script updates the live values.
   * `empty` (an opt-in empty category has no controls): `NESSY | ~/cat | 0 projects | … | empty`.
   */
  | { kind: 'category'; categoryId: string; projects: number; empty?: true }
  /** `NESSY | ~/cat/slug | status | … | vX` */
  | { kind: 'project'; categoryId: string; slug: string; status: Status; version?: string }
  /** `NESSY | ~/bookmarks | N links | … | external` */
  | { kind: 'bookmarks'; links: number }
  /** `NESSY | <bad path> | 404 | … | not found`; the 404 script fills in the path. */
  | { kind: 'notfound' };

export interface StatusCells {
  /** `null` on the 404 page: the path is the visitor's, filled in at runtime. */
  path: string | null;
  /** Plain-text state cell; empty for the category page (unless `empty`), whose two live values the template marks up. */
  mid: string;
  right: string;
}

export function statusCells(status: StatusLineProps): StatusCells {
  switch (status.kind) {
    case 'home':
      return { path: '~', mid: projectCount(status.projects), right: `${dirCount(status.dirs)}, ${linkCount(1)}` };
    case 'category':
      return status.empty === true
        ? { path: `~/${status.categoryId}`, mid: projectCount(status.projects), right: STATUS_EMPTY }
        : { path: `~/${status.categoryId}`, mid: '', right: projectCount(status.projects) };
    case 'project':
      return {
        path: `~/${status.categoryId}/${status.slug}`,
        mid: status.status,
        right: status.version === undefined ? '' : `v${status.version}`,
      };
    case 'bookmarks':
      return { path: '~/bookmarks', mid: linkCount(status.links), right: STATUS_EXTERNAL };
    case 'notfound':
      return { path: null, mid: STATUS_404, right: STATUS_NOT_FOUND };
  }
}
