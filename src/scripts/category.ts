// Category page behaviour (design 3.4 F-category): reads `?tag/sort/dir`, filters and sorts the rows the build rendered,
// and keeps the prompt, status line, counts, controls, URL and live region in step. Progressive enhancement: the static
// DOM is complete without it, so any failure here leaves the page as rendered (fail closed).
import { announce } from './announce.ts';
import { initTagRow } from './category/tagrow.ts';
import { changeMode, lsArg, parseState, serializeState, sortName, tagName, toggleTag } from './category/state.ts';
import type { CategoryState } from './category/state.ts';
import { sortRows } from '../lib/sort.ts';
import type { SortDir, SortMode, SortableRow } from '../lib/sort.ts';
import { filterAnnouncement, projectCount, sortDirLabel, sortDirName } from '../lib/strings.ts';

/** What the tag-row module (024) uses: the current state, a way to choose a tag, and a change notification. */
export interface CategoryController {
  getState(): CategoryState;
  /** `null` selects `all`; the active tag again clears it (ux 7.6). */
  selectTag(tag: string | null): void;
  /** Called after every state change, including the initial application. */
  onChange(callback: (state: CategoryState) => void): void;
}

interface Row extends SortableRow {
  el: HTMLElement;
  tags: readonly string[];
}

const MODES: readonly SortMode[] = ['default', 'name', 'updated'];
const isMode = (value: string): value is SortMode => (MODES as readonly string[]).includes(value);

const reverse = (dir: SortDir): SortDir => (dir === 'asc' ? 'desc' : 'asc');

const all = <T extends Element>(root: ParentNode, selector: string): T[] => [...root.querySelectorAll<T>(selector)];

/** Replaces a plain-text hashtag with a filter button, keeping its attributes (including the scoped-style stamp) and children. */
function upgradeHashtag(span: HTMLElement): HTMLButtonElement {
  const button = document.createElement('button');
  for (const { name, value } of [...span.attributes]) button.setAttribute(name, value);
  button.type = 'button';
  button.setAttribute('aria-pressed', 'false');
  button.append(...span.childNodes);
  span.replaceWith(button);
  return button;
}

export function initCategory(doc: Document = document): CategoryController | null {
  const list = doc.querySelector<HTMLElement>('[data-filter-target]');
  if (list === null) return null;

  const rows: Row[] = all<HTMLElement>(list, '[data-tags]').map((el) => ({
    el,
    tags: (el.dataset['tags'] ?? '').split(' ').filter(Boolean),
    slug: el.dataset['name'] ?? '',
    priority: Number(el.dataset['priority']),
    updated: el.dataset['updated'] ?? '',
    status: el.dataset['status'] === 'retired' ? 'retired' : 'active',
  }));
  const knownTags = all<HTMLElement>(doc, '.chip[data-tag]').map((chip) => chip.dataset['tag'] ?? '').filter((t) => t !== 'all');
  for (const span of all<HTMLElement>(list, 'span.tag[data-tag]')) upgradeHashtag(span);

  const select = doc.querySelector<HTMLSelectElement>('[data-sort-field]');
  const dirButton = doc.querySelector<HTMLElement>('[data-sort-dir]');
  const empty = doc.querySelector<HTMLElement>('[data-empty]');
  const callbacks: ((state: CategoryState) => void)[] = [];

  const initial = parseState(location.search, knownTags);
  let state = initial.state;

  const setText = (selector: string, text: string): void => {
    for (const el of all(doc, selector)) el.textContent = text;
  };

  function apply(announceResult: boolean, writeUrl: boolean): void {
    const focused = doc.activeElement;
    const shown = rows.filter((row) => state.tag === null || row.tags.includes(state.tag));
    const sorted = sortRows(rows, state.mode, state.dir);
    list!.append(...sorted.map((row) => row.el));
    for (const row of rows) row.el.hidden = !shown.includes(row);

    for (const button of all<HTMLElement>(doc, 'button[data-tag]')) {
      const tag = button.dataset['tag'];
      button.setAttribute('aria-pressed', String(state.tag === null ? tag === 'all' : tag === state.tag));
    }
    if (select !== null) select.value = state.mode;
    if (dirButton !== null) {
      dirButton.textContent = sortDirLabel(state.dir);
      dirButton.setAttribute('aria-label', sortDirName(state.dir));
    }
    setText('[data-ls-arg]', lsArg(state));
    setText('[data-count]', projectCount(shown.length));
    setText('[data-tag-name]', tagName(state));
    setText('[data-sort-name]', sortName(state));
    if (empty !== null) {
      empty.hidden = shown.length > 0;
      setText('[data-term]', state.tag === null ? '' : `#${state.tag}`);
    }
    // Moving a node drops focus, so give it back to the element the visitor was using.
    if (focused instanceof HTMLElement && focused.isConnected && doc.activeElement !== focused) focused.focus();

    if (writeUrl) {
      try {
        history.replaceState(null, '', `${location.pathname}${serializeState(state)}${location.hash}`);
      } catch {
        // The URL is a convenience; a browser that refuses the update keeps working.
      }
    }
    if (announceResult) {
      announce(filterAnnouncement({ count: shown.length, ...(state.tag === null ? {} : { tag: state.tag }), mode: state.mode, dir: state.dir }), doc);
    }
    for (const callback of callbacks) callback(state);
  }

  const update = (next: CategoryState): void => {
    state = next;
    apply(true, true);
  };

  doc.addEventListener('click', (event) => {
    const target = event.target instanceof Element ? event.target : null;
    const tagButton = target?.closest<HTMLElement>('button[data-tag]');
    if (tagButton !== null && tagButton !== undefined) {
      const tag = tagButton.dataset['tag'];
      update(toggleTag(state, tag === undefined || tag === 'all' ? null : tag));
      return;
    }
    if (target?.closest('[data-sort-dir]')) update({ ...state, dir: reverse(state.dir) });
    if (target?.closest('[data-clear]')) {
      update({ ...state, tag: null });
      doc.querySelector<HTMLElement>('.chip[data-tag="all"]')?.focus();
    }
  });
  select?.addEventListener('change', () => {
    if (isMode(select.value)) update(changeMode(state, select.value));
  });

  apply(false, false);
  return {
    getState: () => state,
    selectTag: (tag) => update(toggleTag(state, tag)),
    onChange: (callback) => {
      callbacks.push(callback);
    },
  };
}

let controller: CategoryController | null = null;
try {
  controller = initCategory();
  const controls = document.querySelector<HTMLElement>('.controls');
  if (controller !== null && controls !== null) initTagRow(controls, controller);
} catch (error) {
  console.error('category script failed; the static page stays as rendered', error);
}
export { controller };
