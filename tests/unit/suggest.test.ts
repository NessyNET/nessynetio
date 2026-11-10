import { describe, expect, it } from 'vitest';
import { levenshtein, suggest } from '../../src/lib/suggest.ts';

const KNOWN = [
  '/',
  '/ffxiv/',
  '/ffxiv/loch-lantern/',
  '/ffxiv/loch-lamp/',
  '/minecraft/',
  '/minecraft/creeper-lens/',
  '/linux/',
  '/bookmarks/',
  '/about/',
];

describe('levenshtein', () => {
  it('computes edit distance', () => {
    expect(levenshtein('', '')).toBe(0);
    expect(levenshtein('abc', '')).toBe(3);
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('same', 'same')).toBe(0);
  });
});

describe('suggest', () => {
  it('finds the near miss first', () => {
    expect(suggest('/ffxiv/loch-lanter', KNOWN)[0]).toBe('/ffxiv/loch-lantern/');
  });

  it('ignores case, a trailing slash and repeated slashes', () => {
    expect(suggest('/FFXIV/Loch-Lanter/', KNOWN)[0]).toBe('/ffxiv/loch-lantern/');
    expect(suggest('//ffxiv//loch-lanter', KNOWN)[0]).toBe('/ffxiv/loch-lantern/');
  });

  it('returns known paths in their original form', () => {
    expect(suggest('/linx/', KNOWN)).toContain('/linux/');
  });

  it('returns at most max results, closest first then by path', () => {
    const known = ['/aa/', '/ab/', '/ac/', '/ad/', '/ae/'];
    expect(suggest('/a/', known)).toEqual(['/aa/', '/ab/', '/ac/']);
    expect(suggest('/a/', known, 2)).toEqual(['/aa/', '/ab/']);
  });

  it('returns nothing for a far-off path', () => {
    expect(suggest('/zzzzzzzzzzzzzzzz/', KNOWN)).toEqual([]);
  });

  it('never suggests the home page', () => {
    expect(suggest('/', KNOWN)).not.toContain('/');
    expect(suggest('/x/', ['/'])).toEqual([]);
  });

  it('includes a path at exactly the limit and excludes one above it', () => {
    // last(bad) has 6 chars, so the limit is max(3, 2) = 3.
    expect(suggest('/abcdef/', ['/abcxyz/'])).toEqual(['/abcxyz/']); // d = 3
    expect(suggest('/abcdef/', ['/abcwxyz/'])).toEqual([]); // d = 4
  });

  it('scales the limit with the last segment length', () => {
    // 15 chars: limit floor(15/3) = 5.
    const bad = '/abcdefghijklmno/';
    expect(suggest(bad, ['/abcdefghijxxxxx/'])).toEqual(['/abcdefghijxxxxx/']); // d = 5
    expect(suggest(bad, ['/abcdefghijyyyyyz/'])).toEqual([]); // d = 6
  });

  it('matches on the last segment alone when the parent differs', () => {
    expect(suggest('/wrongcat/loch-lantern', KNOWN)[0]).toBe('/ffxiv/loch-lantern/');
  });
});
