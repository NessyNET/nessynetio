// 404 page behaviour (design 3.4 F-404, ux 4.5): shows the requested path and up to 3 "did you mean" paths computed
// from the build-time path list. Progressive enhancement: without it the page shows generic text, the categories
// and the home link, and any failure here leaves it that way (fail closed).
import { suggest } from '../lib/suggest.ts';

export interface Suggestion {
  /** Display form, `~/ffxiv/loch-lantern`. */
  text: string;
  /** The real path, `/ffxiv/loch-lantern/`. */
  href: string;
}

export interface SuggestionView {
  /** The requested path as shown in the prompt, status line and sentence. */
  display: string;
  suggestions: Suggestion[];
}

/** `/ffxiv/loch-lantern/` -> `~/ffxiv/loch-lantern`; the root is `~`. */
const displayForm = (path: string): string => `~${path.replace(/\/+$/, '')}`;

function decoded(pathname: string): string {
  try {
    return decodeURI(pathname);
  } catch {
    return pathname;
  }
}

export function buildSuggestionView(pathname: string, knownPaths: readonly string[]): SuggestionView {
  const path = decoded(pathname);
  return {
    display: displayForm(path),
    suggestions: suggest(path, knownPaths).map((href) => ({ text: displayForm(href), href })),
  };
}

/** The build-time path list: a JSON array in `data-known-paths` on the suggestions block. `[]` when missing or malformed. */
export function readKnownPaths(doc: Document = document): string[] {
  const raw = doc.querySelector<HTMLElement>('[data-known-paths]')?.dataset['knownPaths'];
  if (raw === undefined) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.every((p): p is string => typeof p === 'string') ? parsed : [];
  } catch {
    return [];
  }
}

export function initNotFound(doc: Document = document, pathname: string = location.pathname): void {
  const view = buildSuggestionView(pathname, readKnownPaths(doc));
  for (const el of doc.querySelectorAll('[data-badpath]')) el.textContent = view.display;
  const block = doc.querySelector<HTMLElement>('[data-suggest]');
  const list = doc.querySelector<HTMLElement>('[data-suggest-list]');
  if (block === null || list === null || view.suggestions.length === 0) return;
  list.replaceChildren(
    ...view.suggestions.map(({ text, href }) => {
      const item = doc.createElement('li');
      const link = doc.createElement('a');
      link.href = href;
      link.textContent = text;
      item.append(link);
      return item;
    }),
  );
  block.hidden = false;
}

// Not run under the unit tests (no DOM there).
if (typeof document !== 'undefined') {
  try {
    initNotFound();
  } catch (error) {
    console.error('404 script failed; the static page stays as rendered', error);
  }
}
