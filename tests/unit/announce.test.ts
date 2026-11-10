import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { announce } from '../../src/scripts/announce.ts';

// No DOM library: a fake document whose only region records every write to textContent.
function fakeDoc(region: { textContent: string } | null) {
  return { getElementById: vi.fn((id: string) => (id === 'live' ? region : null)) } as unknown as Document;
}

let frames: (() => void)[];
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (cb: () => void) => frames.push(cb));
});
afterEach(() => vi.unstubAllGlobals());

describe('announce', () => {
  it('clears the region at once and sets the message on the next frame', () => {
    const region = { textContent: 'old message' };
    announce('Copied to clipboard', fakeDoc(region));
    expect(region.textContent).toBe('');
    expect(frames).toHaveLength(1);
    frames[0]?.();
    expect(region.textContent).toBe('Copied to clipboard');
  });

  it('re-announces a repeated message: it is cleared again before it is set again', () => {
    const region = { textContent: '' };
    const doc = fakeDoc(region);
    announce('same', doc);
    frames.shift()?.();
    announce('same', doc);
    expect(region.textContent).toBe('');
    frames.shift()?.();
    expect(region.textContent).toBe('same');
  });

  it('is a no-op without a live region: no frame is scheduled', () => {
    expect(() => announce('x', fakeDoc(null))).not.toThrow();
    expect(frames).toHaveLength(0);
  });
});
