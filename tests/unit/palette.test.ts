import { describe, expect, it } from 'vitest';
import { CATEGORY_ACCENTS, TAGLINE_AUTO_CYCLE, TAGLINE_COLOURS, isCategoryAccent, isTaglineColour, paletteHex } from '../../src/lib/palette.ts';

describe('palette allow-lists', () => {
  it('category accents are exact', () => {
    expect([...CATEGORY_ACCENTS]).toEqual(['blue', 'orange', 'yellow', 'purple', 'cyan', 'teal', 'pink']);
  });
  it('tagline colours are exact and red is excluded', () => {
    expect([...TAGLINE_COLOURS]).toEqual(['green', 'yellow', 'cyan', 'teal', 'blue', 'purple', 'pink', 'orange']);
    expect(isTaglineColour('red')).toBe(false);
  });
  it('auto cycle is green yellow cyan', () => {
    expect([...TAGLINE_AUTO_CYCLE]).toEqual(['green', 'yellow', 'cyan']);
  });
  it('type guards accept members and reject others', () => {
    expect(isCategoryAccent('teal')).toBe(true);
    expect(isCategoryAccent('red')).toBe(false);
    expect(isCategoryAccent('green')).toBe(false);
    expect(isCategoryAccent(3)).toBe(false);
    expect(isTaglineColour('green')).toBe(true);
    expect(isTaglineColour('primary')).toBe(false);
  });
});

describe('paletteHex', () => {
  it('resolves accent tokens', () => {
    expect(paletteHex('blue')).toBe('#7fa8d6');
    expect(paletteHex('primary')).toBe('#a3d9a5');
  });
  it('resolves base tokens', () => {
    expect(paletteHex('bg_dark')).toBe('#0e1a1c');
  });
});
