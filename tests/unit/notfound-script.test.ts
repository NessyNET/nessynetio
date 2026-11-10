import { describe, expect, it } from 'vitest';
import { buildSuggestionView, readKnownPaths } from '../../src/scripts/notfound.ts';

const PATHS = ['/', '/ffxiv/', '/minecraft/', '/linux/', '/other/', '/bookmarks/', '/ffxiv/loch-lantern/', '/ffxiv/heather-hotbar/', '/linux/lochctl/'];

describe('buildSuggestionView', () => {
  it('shows the path as ~ + path without the trailing slash and suggests the near miss first', () => {
    const view = buildSuggestionView('/ffxiv/loch-lanter', PATHS);
    expect(view.display).toBe('~/ffxiv/loch-lanter');
    expect(view.suggestions[0]).toEqual({ text: '~/ffxiv/loch-lantern', href: '/ffxiv/loch-lantern/' });
  });

  it('gives at most 3 suggestions, with ~ forms and real hrefs', () => {
    const view = buildSuggestionView('/ffxiv/loch-lanter', PATHS);
    expect(view.suggestions.length).toBeLessThanOrEqual(3);
    for (const s of view.suggestions) expect(s.text).toBe('~' + s.href.replace(/\/$/, ''));
  });

  it('an unpublished category (hidden empty one) is shown but never suggested as itself', () => {
    const view = buildSuggestionView('/terraria', PATHS);
    expect(view.display).toBe('~/terraria');
    expect(view.suggestions.map((s) => s.href)).not.toContain('/terraria/');
  });

  it('shows ~ for the site root and a trailing-slash path without it', () => {
    expect(buildSuggestionView('/', PATHS).display).toBe('~');
    expect(buildSuggestionView('/ffxiv/nope/', PATHS).display).toBe('~/ffxiv/nope');
  });

  it('decodes a percent-encoded path for display and matching, and survives a malformed one', () => {
    expect(buildSuggestionView('/ffxiv/loch%2Dlanter', PATHS).display).toBe('~/ffxiv/loch-lanter');
    expect(buildSuggestionView('/ffxiv/%E0%A4%A', PATHS).display).toBe('~/ffxiv/%E0%A4%A');
  });

  it('has no suggestions when nothing is close or the list is empty', () => {
    expect(buildSuggestionView('/zzzzzzzzzzzzzzzz/qqqqqqqqqqqqqqqqqq', PATHS).suggestions).toEqual([]);
    expect(buildSuggestionView('/ffxiv/loch-lanter', []).suggestions).toEqual([]);
  });
});

describe('readKnownPaths', () => {
  const doc = (value: string | undefined) =>
    ({ querySelector: (sel: string) => (sel === '[data-known-paths]' && value !== undefined ? { dataset: { knownPaths: value } } : null) }) as unknown as Document;

  it('parses the data attribute into the path list', () => {
    expect(readKnownPaths(doc(JSON.stringify(PATHS)))).toEqual(PATHS);
  });

  it('returns [] when the element is missing, the JSON is malformed, or it is not an array of strings', () => {
    expect(readKnownPaths(doc(undefined))).toEqual([]);
    expect(readKnownPaths(doc('{nope'))).toEqual([]);
    expect(readKnownPaths(doc('{"a":1}'))).toEqual([]);
    expect(readKnownPaths(doc('[1,2]'))).toEqual([]);
  });
});
