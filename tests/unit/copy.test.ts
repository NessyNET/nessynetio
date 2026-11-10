import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { handleCopy, type CopyDeps, type CopyTarget } from '../../src/scripts/copy.ts';

// A minimal stand-in for a copy button: records what the handler shows and selects.
function fakeTarget(value = 'yay -S lochctl') {
  const log = { labels: [] as string[], states: [] as (string | null)[], selected: 0 };
  const target: CopyTarget = {
    value,
    timer: undefined,
    showLabel: (text) => log.labels.push(text),
    showState: (state) => log.states.push(state),
    selectText: () => {
      log.selected++;
    },
  };
  return { target, log };
}

function fakeDeps(writeText: CopyDeps['writeText']) {
  const announced: string[] = [];
  const deps: CopyDeps = {
    writeText,
    announce: (message) => announced.push(message),
    setTimer: (fn, ms) => setTimeout(fn, ms),
    clearTimer: (id) => clearTimeout(id as ReturnType<typeof setTimeout>),
  };
  return { deps, announced };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('handleCopy', () => {
  it('writes the exact value, shows copied, and announces success', async () => {
    const written: string[] = [];
    const { deps, announced } = fakeDeps(async (text) => {
      written.push(text);
    });
    const { target, log } = fakeTarget('curl -LO https://x.example/a && tar xf a');
    await handleCopy(target, deps);
    expect(written).toEqual(['curl -LO https://x.example/a && tar xf a']);
    expect(log.labels).toEqual(['copied']);
    expect(log.states).toEqual(['copied']);
    expect(log.selected).toBe(0);
    expect(announced).toEqual(['Copied to clipboard']);
  });

  it('on a rejected write selects the text, shows press Ctrl+C, the failed state and announces the failure', async () => {
    const { deps, announced } = fakeDeps(() => Promise.reject(new Error('denied')));
    const { target, log } = fakeTarget();
    await handleCopy(target, deps);
    expect(log.selected).toBe(1);
    expect(log.labels).toEqual(['press Ctrl+C']);
    expect(log.states).toEqual(['failed']);
    expect(announced).toEqual(['Could not copy. The text is selected; press Ctrl+C.']);
  });

  it('without a Clipboard API behaves like a failure', async () => {
    const { deps, announced } = fakeDeps(undefined);
    const { target, log } = fakeTarget();
    await handleCopy(target, deps);
    expect(log.selected).toBe(1);
    expect(log.labels).toEqual(['press Ctrl+C']);
    expect(announced).toEqual(['Could not copy. The text is selected; press Ctrl+C.']);
  });

  it('a write that throws synchronously is a failure too', async () => {
    const { deps } = fakeDeps(() => {
      throw new Error('blocked');
    });
    const { target, log } = fakeTarget();
    await handleCopy(target, deps);
    expect(log.labels).toEqual(['press Ctrl+C']);
  });

  it('puts the label back to copy and clears the state after 2 s, not before', async () => {
    const { deps } = fakeDeps(async () => {});
    const { target, log } = fakeTarget();
    await handleCopy(target, deps);
    vi.advanceTimersByTime(1999);
    expect(log.labels).toEqual(['copied']);
    vi.advanceTimersByTime(1);
    expect(log.labels).toEqual(['copied', 'copy']);
    expect(log.states).toEqual(['copied', null]);
  });

  it('resets the failure label after 2 s as well', async () => {
    const { deps } = fakeDeps(undefined);
    const { target, log } = fakeTarget();
    await handleCopy(target, deps);
    vi.advanceTimersByTime(2000);
    expect(log.labels).toEqual(['press Ctrl+C', 'copy']);
    expect(log.states).toEqual(['failed', null]);
  });

  it('a second click restarts the 2 s window instead of resetting early', async () => {
    const { deps, announced } = fakeDeps(async () => {});
    const { target, log } = fakeTarget();
    await handleCopy(target, deps);
    vi.advanceTimersByTime(1500);
    await handleCopy(target, deps);
    vi.advanceTimersByTime(1500);
    expect(log.labels).toEqual(['copied', 'copied']);
    vi.advanceTimersByTime(500);
    expect(log.labels).toEqual(['copied', 'copied', 'copy']);
    expect(announced).toEqual(['Copied to clipboard', 'Copied to clipboard']);
  });
});
