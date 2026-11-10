import { describe, expect, it } from 'vitest';
import {
  changeMode,
  lsArg,
  parseState,
  serializeState,
  statusText,
  toggleTag,
  type CategoryState,
} from '../../src/scripts/category/state.ts';

const st = (over: Partial<CategoryState> = {}): CategoryState => ({ tag: null, mode: 'default', dir: 'asc', ...over });
const KNOWN = ['plugin', 'web', 'offline'];

// Expected strings are the ones of docs/ux/checks/r8-acceptance.mjs (sort modes and combined checks).
describe('lsArg (ux 7.8)', () => {
  it.each([
    ['default', 'asc', ''],
    ['default', 'desc', ' --reverse'],
    ['name', 'asc', ' --sort=name'],
    ['name', 'desc', ' --sort=name --reverse'],
    ['updated', 'desc', ' --sort=time'],
    ['updated', 'asc', ' --sort=time --reverse'],
  ] as const)('%s %s -> "%s"', (mode, dir, expected) => {
    expect(lsArg(st({ mode, dir }))).toBe(expected);
  });

  it('puts --tag before --sort before --reverse', () => {
    expect(lsArg(st({ tag: 'plugin', mode: 'updated', dir: 'asc' }))).toBe(' --tag=plugin --sort=time --reverse');
    expect(lsArg(st({ tag: 'web' }))).toBe(' --tag=web');
  });
});

describe('serializeState', () => {
  it('is empty for no tag, default sort, ascending', () => {
    expect(serializeState(st())).toBe('');
  });

  it('writes sort and dir together unless default+asc (harness: ?sort=updated&dir=desc)', () => {
    expect(serializeState(st({ mode: 'updated', dir: 'desc' }))).toBe('?sort=updated&dir=desc');
    expect(serializeState(st({ mode: 'name', dir: 'asc' }))).toBe('?sort=name&dir=asc');
    expect(serializeState(st({ mode: 'default', dir: 'desc' }))).toBe('?sort=default&dir=desc');
  });

  it('writes the tag first, then sort and dir', () => {
    expect(serializeState(st({ tag: 'plugin' }))).toBe('?tag=plugin');
    expect(serializeState(st({ tag: 'plugin', mode: 'updated', dir: 'asc' }))).toBe('?tag=plugin&sort=updated&dir=asc');
  });

  it('encodes a tag taken from the URL', () => {
    expect(serializeState(st({ tag: 'a b&c' }))).toBe('?tag=a+b%26c');
  });
});

describe('parseState', () => {
  it('reads tag, sort and dir (harness deep link)', () => {
    expect(parseState('?tag=offline&sort=updated&dir=desc', KNOWN)).toEqual({
      state: st({ tag: 'offline', mode: 'updated', dir: 'desc' }),
      unknownTag: false,
    });
  });

  it('defaults to no tag, default sort, ascending', () => {
    expect(parseState('', KNOWN)).toEqual({ state: st(), unknownTag: false });
  });

  it('falls back silently on a bad sort or dir, keeping the natural direction of the mode', () => {
    expect(parseState('?sort=bogus&dir=up', KNOWN).state).toEqual(st());
    expect(parseState('?sort=updated&dir=sideways', KNOWN).state).toEqual(st({ mode: 'updated', dir: 'desc' }));
  });

  it('flags an unknown tag and keeps it as given, never resetting it', () => {
    expect(parseState('?tag=nope', KNOWN)).toEqual({ state: st({ tag: 'nope' }), unknownTag: true });
  });

  it('treats an empty tag parameter as no tag', () => {
    expect(parseState('?tag=', KNOWN)).toEqual({ state: st(), unknownTag: false });
  });

  it('round-trips through serializeState', () => {
    const s = st({ tag: 'web', mode: 'name', dir: 'desc' });
    expect(parseState(serializeState(s), KNOWN).state).toEqual(s);
  });
});

describe('changeMode', () => {
  it('resets the direction to the natural one of the new mode and keeps the tag', () => {
    expect(changeMode(st({ tag: 'web', mode: 'name', dir: 'desc' }), 'updated')).toEqual(st({ tag: 'web', mode: 'updated', dir: 'desc' }));
    expect(changeMode(st({ mode: 'updated', dir: 'asc' }), 'name')).toEqual(st({ mode: 'name', dir: 'asc' }));
    expect(changeMode(st({ mode: 'name', dir: 'desc' }), 'default')).toEqual(st());
  });
});

describe('toggleTag', () => {
  it('selects a tag, and pressing the active tag again clears it', () => {
    const on = toggleTag(st(), 'plugin');
    expect(on.tag).toBe('plugin');
    expect(toggleTag(on, 'plugin').tag).toBeNull();
  });

  it('switches directly from one tag to another and keeps the sort', () => {
    expect(toggleTag(st({ tag: 'web', mode: 'name' }), 'plugin')).toEqual(st({ tag: 'plugin', mode: 'name' }));
  });

  it('`all` (null) always clears', () => {
    expect(toggleTag(st({ tag: 'web' }), null).tag).toBeNull();
    expect(toggleTag(st(), null).tag).toBeNull();
  });
});

describe('statusText', () => {
  it('reads tag:<#tag|all> sort:<mode>[ (dir)] with the direction only when it is not the natural one', () => {
    expect(statusText(st())).toBe('tag:all sort:default');
    expect(statusText(st({ tag: 'plugin' }))).toBe('tag:#plugin sort:default');
    expect(statusText(st({ mode: 'updated', dir: 'desc' }))).toBe('tag:all sort:updated');
    expect(statusText(st({ mode: 'updated', dir: 'asc' }))).toBe('tag:all sort:updated (asc)');
    expect(statusText(st({ mode: 'default', dir: 'desc' }))).toBe('tag:all sort:default (desc)');
  });
});
