// The one sort comparator, shared by the build and the browser (ux 7.7). No DOM, no Node APIs.
export type SortMode = 'default' | 'name' | 'updated';
export type SortDir = 'asc' | 'desc';

export interface SortableRow {
  slug: string;
  priority: number;
  /** YYYY-MM-DD, so string order is date order. */
  updated: string;
  status: 'active' | 'retired';
}

const MODES: readonly SortMode[] = ['default', 'name', 'updated'];
const DIRS: readonly SortDir[] = ['asc', 'desc'];

/** Code-point comparison; unlike localeCompare it is identical in every runtime. */
export const compareSlug = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const byPriority = (a: SortableRow, b: SortableRow): number => a.priority - b.priority || compareSlug(a.slug, b.slug);
const byUpdated = (a: SortableRow, b: SortableRow): number => compareSlug(a.updated, b.updated) || compareSlug(a.slug, b.slug);
const byName = (a: SortableRow, b: SortableRow): number => compareSlug(a.slug, b.slug);

function sortDefault<T extends SortableRow>(rows: readonly T[], dir: SortDir): T[] {
  const active = rows.filter((r) => r.status === 'active').sort(byPriority);
  const retired = rows.filter((r) => r.status === 'retired').sort(byPriority);
  if (dir === 'desc') {
    active.reverse();
    retired.reverse();
  }
  return [...active, ...retired];
}

/** Returns a new array; the input is never mutated. */
export function sortRows<T extends SortableRow>(rows: readonly T[], mode: SortMode, dir: SortDir): T[] {
  if (mode === 'default') return sortDefault(rows, dir);
  const sorted = [...rows].sort(mode === 'name' ? byName : byUpdated);
  return dir === 'desc' ? sorted.reverse() : sorted;
}

export const naturalDir = (mode: SortMode): SortDir => (mode === 'updated' ? 'desc' : 'asc');

/** Unknown values fall back silently (ux 5.1). */
export function parseSort(sort: string | null, dir: string | null): { mode: SortMode; dir: SortDir } {
  const mode = MODES.find((m) => m === sort) ?? 'default';
  return { mode, dir: DIRS.find((d) => d === dir) ?? naturalDir(mode) };
}
