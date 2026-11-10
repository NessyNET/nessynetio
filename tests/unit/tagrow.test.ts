import { describe, expect, it } from 'vitest';
import { fitChips } from '../../src/scripts/category/tagrow.ts';

// Widths include the gap after each chip; `available` is the row's content width plus one gap (so the last gap is free);
// `toggleWidth` is the "+N more" button plus its gap. The row is measured with the toggle present.
const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i);

describe('fitChips', () => {
  it('keeps every chip in the row, with no panel, when all of them fit once the toggle is gone', () => {
    // 5 chips x 100 = 500 > 460, but the toggle (60) is not needed: 500 <= 460 + 60.
    expect(fitChips([100, 100, 100, 100, 100], 460, 60, new Set([0]))).toEqual({ row: [0, 1, 2, 3, 4], panel: [] });
  });

  it('moves the overflow into the panel, in order, when they do not fit', () => {
    // pinned `all` (0) first, then 1 and 2 fit in 300 (3 x 100), the rest overflow.
    expect(fitChips([100, 100, 100, 100, 100, 100], 300, 60, new Set([0]))).toEqual({ row: [0, 1, 2], panel: [3, 4, 5] });
  });

  it('pins the active chip into the row even when it lies beyond the fold, keeping config order in the row', () => {
    const r = fitChips([100, 100, 100, 100, 100, 100], 300, 60, new Set([0, 5]));
    expect(r.row).toEqual([0, 1, 5]);
    expect(r.panel).toEqual([2, 3, 4]);
  });

  it('keeps the pinned chips even if they alone exceed the width', () => {
    expect(fitChips([200, 200, 200], 250, 60, new Set([0, 2]))).toEqual({ row: [0, 2], panel: [1] });
  });

  it('600 px mode: only the pinned chips stay in the row, however much room there is', () => {
    expect(fitChips([50, 50, 50, 50], 10_000, 60, new Set([0, 2]), true)).toEqual({ row: [0, 2], panel: [1, 3] });
    expect(fitChips([50, 50], 10_000, 60, new Set([0]), true)).toEqual({ row: [0], panel: [1] });
  });

  it('600 px mode with nothing to hide leaves no panel', () => {
    expect(fitChips([50], 10_000, 60, new Set([0]), true)).toEqual({ row: [0], panel: [] });
  });

  it('22 chips (the stress category): row and panel partition all of them, in order', () => {
    const widths = range(23).map((i) => 90 + (i % 5) * 10); // all + 22 tags
    const r = fitChips(widths, 1300, 70, new Set([0]));
    expect([...r.row, ...r.panel].sort((a, b) => a - b)).toEqual(range(23));
    expect(r.row).toEqual([...r.row].sort((a, b) => a - b));
    expect(r.panel).toEqual([...r.panel].sort((a, b) => a - b));
    expect(r.panel.length).toBeGreaterThan(0);
    expect(r.row.reduce((n, i) => n + (widths[i] ?? 0), 0)).toBeLessThanOrEqual(1300);
  });

  it('fills contiguously: stops at the first chip that does not fit, even if a later one is narrower', () => {
    expect(fitChips([100, 250, 50], 200, 60, new Set([0]))).toEqual({ row: [0], panel: [1, 2] });
  });

  it('pinned chips stay even after the fill has stopped', () => {
    expect(fitChips([100, 250, 50, 40], 200, 60, new Set([0, 3]))).toEqual({ row: [0, 3], panel: [1, 2] });
  });

  it('an empty list gives empty row and panel', () => {
    expect(fitChips([], 100, 60, new Set())).toEqual({ row: [], panel: [] });
  });
});
