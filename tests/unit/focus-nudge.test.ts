import { describe, expect, it } from 'vitest';
import { nudgeDistance } from '../../src/scripts/focus-nudge.ts';

// statusTop 800: anything whose bottom edge is below 788 (800 - 12) must scroll.
describe('nudgeDistance', () => {
  it('is 0 for an element clear of the status line', () => {
    expect(nudgeDistance({ top: 100, bottom: 140 }, 800)).toBe(0);
    expect(nudgeDistance({ top: 700, bottom: 788 }, 800)).toBe(0);
  });

  it('scrolls by the difference when the bottom edge is within the 12 px threshold', () => {
    expect(nudgeDistance({ top: 700, bottom: 789 }, 800)).toBe(1);
    expect(nudgeDistance({ top: 700, bottom: 795 }, 800)).toBe(7);
  });

  it('scrolls by the overlap plus the threshold when the element sits under the status line', () => {
    expect(nudgeDistance({ top: 790, bottom: 830 }, 800)).toBe(42);
    expect(nudgeDistance({ top: 850, bottom: 890 }, 800)).toBe(102);
  });

  it('never scrolls for an element above the viewport (the browser and scroll-padding handle that)', () => {
    expect(nudgeDistance({ top: -80, bottom: -40 }, 800)).toBe(0);
  });

  it('honours a custom threshold', () => {
    expect(nudgeDistance({ top: 700, bottom: 780 }, 800, 24)).toBe(4);
    expect(nudgeDistance({ top: 700, bottom: 780 }, 800, 0)).toBe(0);
  });
});
