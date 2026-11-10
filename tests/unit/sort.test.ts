import { describe, expect, it } from 'vitest';
import { compareSlug, naturalDir, parseSort, sortRows, type SortDir, type SortMode, type SortableRow } from '../../src/lib/sort.ts';

const row = (slug: string, priority: number, updated: string, status: SortableRow['status']): SortableRow => ({ slug, priority, updated, status });

const ROWS: SortableRow[] = [
  row('hotel', 2, '2025-01-01', 'active'),
  row('golf', 1, '2025-04-04', 'retired'),
  row('alpha', 1, '2025-03-01', 'active'),
  row('foxtrot', 5, '2024-12-01', 'retired'),
  row('charlie', 2, '2025-03-01', 'active'),
  row('bravo-two', 1, '2025-01-10', 'active'),
  row('echo', 0, '2025-05-05', 'active'),
  row('delta', 3, '2025-02-01', 'active'),
];

const slugs = (rows: readonly SortableRow[]): string[] => rows.map((r) => r.slug);

const EXPECTED: Record<string, string[]> = {
  'default asc': ['echo', 'alpha', 'bravo-two', 'charlie', 'hotel', 'delta', 'golf', 'foxtrot'],
  'default desc': ['delta', 'hotel', 'charlie', 'bravo-two', 'alpha', 'echo', 'foxtrot', 'golf'],
  'name asc': ['alpha', 'bravo-two', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel'],
  'name desc': ['hotel', 'golf', 'foxtrot', 'echo', 'delta', 'charlie', 'bravo-two', 'alpha'],
  'updated desc': ['echo', 'golf', 'charlie', 'alpha', 'delta', 'bravo-two', 'hotel', 'foxtrot'],
  'updated asc': ['foxtrot', 'hotel', 'bravo-two', 'delta', 'alpha', 'charlie', 'golf', 'echo'],
};

// Independent re-implementation of docs/ux/checks/r8-acceptance.mjs lines 102 to 103.
function harnessOrder(rows: readonly SortableRow[], sort: SortMode, dir: SortDir): string[] {
  const by = {
    default: (a: SortableRow, b: SortableRow) =>
      Number(a.status === 'retired') - Number(b.status === 'retired') || a.priority - b.priority || compareSlug(a.slug, b.slug),
    name: (a: SortableRow, b: SortableRow) => compareSlug(a.slug, b.slug),
    updated: (a: SortableRow, b: SortableRow) => compareSlug(a.updated, b.updated) || compareSlug(a.slug, b.slug),
  };
  let r = [...rows].sort(by[sort]);
  if (sort === 'default' && dir === 'desc') {
    r = r.filter((x) => x.status !== 'retired').reverse().concat(r.filter((x) => x.status === 'retired').reverse());
  } else if (dir === 'desc') {
    r.reverse();
  }
  return slugs(r);
}

describe('sortRows', () => {
  for (const [label, expected] of Object.entries(EXPECTED)) {
    const [mode, dir] = label.split(' ') as [SortMode, SortDir];
    it(`${label} matches the hand-written order`, () => {
      expect(slugs(sortRows(ROWS, mode, dir))).toEqual(expected);
    });
    it(`${label} agrees with the harness formula`, () => {
      expect(slugs(sortRows(ROWS, mode, dir))).toEqual(harnessOrder(ROWS, mode, dir));
    });
  }

  it('does not mutate the input array', () => {
    const before = slugs(ROWS);
    const out = sortRows(ROWS, 'name', 'asc');
    expect(slugs(ROWS)).toEqual(before);
    expect(out).not.toBe(ROWS);
  });

  it('keeps extra row fields', () => {
    const out = sortRows([{ ...row('a', 0, '2025-01-01', 'active'), title: 'A' }], 'default', 'asc');
    expect(out[0]?.title).toBe('A');
  });
});

describe('compareSlug', () => {
  it('compares by code point', () => {
    expect(compareSlug('a', 'b')).toBe(-1);
    expect(compareSlug('b', 'a')).toBe(1);
    expect(compareSlug('a', 'a')).toBe(0);
    expect(compareSlug('Z', 'a')).toBe(-1);
    expect(compareSlug('a-b', 'ab')).toBe(-1);
  });
});

describe('naturalDir', () => {
  it('is desc only for updated', () => {
    expect(naturalDir('default')).toBe('asc');
    expect(naturalDir('name')).toBe('asc');
    expect(naturalDir('updated')).toBe('desc');
  });
});

describe('parseSort', () => {
  it('accepts valid values', () => {
    expect(parseSort('name', 'desc')).toEqual({ mode: 'name', dir: 'desc' });
  });
  it('falls back to default for an unknown sort', () => {
    expect(parseSort('bogus', 'desc')).toEqual({ mode: 'default', dir: 'desc' });
    expect(parseSort(null, null)).toEqual({ mode: 'default', dir: 'asc' });
  });
  it('falls back to the natural dir for an unknown dir', () => {
    expect(parseSort('name', 'sideways')).toEqual({ mode: 'name', dir: 'asc' });
  });
  it('uses desc for updated when dir is missing', () => {
    expect(parseSort('updated', null)).toEqual({ mode: 'updated', dir: 'desc' });
  });
});
