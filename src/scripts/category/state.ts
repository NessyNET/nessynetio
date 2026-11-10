// Category page state (ux 7.6 to 7.8): pure functions, no DOM. The URL is the only place the state lives (design 4).
import { naturalDir, parseSort } from '../../lib/sort.ts';
import type { SortDir, SortMode } from '../../lib/sort.ts';
import { SORT_PREFIX, TAG_INITIAL, TAG_PREFIX } from '../../lib/strings.ts';

export interface CategoryState {
  /** `null` is `all`. An unknown tag from the URL is kept as given. */
  tag: string | null;
  mode: SortMode;
  dir: SortDir;
}

export interface ParsedState {
  state: CategoryState;
  /** The URL names a tag the category does not use: the page shows the empty state (ux 5.4). */
  unknownTag: boolean;
}

const LS_SORT: Record<SortMode, string> = { default: '', name: ' --sort=name', updated: ' --sort=time' };

export function parseState(search: string, knownTags: readonly string[]): ParsedState {
  const params = new URLSearchParams(search);
  const tag = params.get('tag') || null;
  const { mode, dir } = parseSort(params.get('sort'), params.get('dir'));
  return { state: { tag, mode, dir }, unknownTag: tag !== null && !knownTags.includes(tag) };
}

/** Query string for `history.replaceState`: tag first, then sort and dir; empty for the initial state. */
export function serializeState(state: CategoryState): string {
  const params = new URLSearchParams();
  if (state.tag !== null) params.set('tag', state.tag);
  if (state.mode !== 'default' || state.dir !== 'asc') {
    params.set('sort', state.mode);
    params.set('dir', state.dir);
  }
  const query = params.toString();
  return query === '' ? '' : `?${query}`;
}

/**
 * Flags shown after `ls ~/<category>` (ux 7.8): `--tag`, then `--sort`, then `--reverse`.
 * `ls --sort=time` is newest first, so `updated` descending needs no `--reverse` and ascending does.
 */
export function lsArg(state: CategoryState): string {
  const tag = state.tag === null ? '' : ` --tag=${state.tag}`;
  const reversed = state.mode === 'updated' ? state.dir === 'asc' : state.dir === 'desc';
  return `${tag}${LS_SORT[state.mode]}${reversed ? ' --reverse' : ''}`;
}

export const changeMode = (state: CategoryState, mode: SortMode): CategoryState => ({ ...state, mode, dir: naturalDir(mode) });

/** Pressing the active tag clears it; `null` (the `all` chip) always clears. */
export const toggleTag = (state: CategoryState, tag: string | null): CategoryState => ({
  ...state,
  tag: tag === state.tag ? null : tag,
});

export const tagName = (state: CategoryState): string => (state.tag === null ? TAG_INITIAL : `#${state.tag}`);

/** `sort:` value of the status line: the direction only when it differs from the mode's natural one. */
export const sortName = (state: CategoryState): string =>
  state.dir === naturalDir(state.mode) ? state.mode : `${state.mode} (${state.dir})`;

export const statusText = (state: CategoryState): string => `${TAG_PREFIX}${tagName(state)} ${SORT_PREFIX}${sortName(state)}`;
