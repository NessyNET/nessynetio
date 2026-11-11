// Screenshot modal (ux 5.5): stepping through a project's screenshots wraps at both ends.
import { describe, expect, it } from 'vitest';
import { stepIndex } from '../../src/scripts/shots.ts';

describe('stepIndex', () => {
  it('moves forward and back', () => {
    expect(stepIndex(0, 3, 1)).toBe(1);
    expect(stepIndex(2, 3, -1)).toBe(1);
  });

  it('wraps past either end', () => {
    expect(stepIndex(2, 3, 1)).toBe(0);
    expect(stepIndex(0, 3, -1)).toBe(2);
  });

  it('stays put for a single screenshot', () => {
    expect(stepIndex(0, 1, 1)).toBe(0);
    expect(stepIndex(0, 1, -1)).toBe(0);
  });
});
