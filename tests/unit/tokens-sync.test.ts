import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parse } from 'smol-toml';
import { renderTokens } from '../../scripts/gen-tokens.mjs';

const read = (path: string): string => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');
const palette = parse(read('src/theme/palette.toml')) as { base: Record<string, string>; accent: Record<string, string>; ansi: { bright: string[] } & Record<string, string[]> };
const rendered = renderTokens(palette);

describe('generated tokens', () => {
  it('tokens.css is in sync with palette.toml', () => {
    expect(read('src/styles/tokens.css')).toBe(rendered.css);
  });
  it('palette-data.ts is in sync with palette.toml', () => {
    expect(read('src/lib/palette-data.ts')).toBe(rendered.ts);
  });
  it('declares every base and accent key as a custom property', () => {
    const css = read('src/styles/tokens.css');
    for (const key of [...Object.keys(palette.base), ...Object.keys(palette.accent)]) {
      expect(css).toContain(`--${key.replaceAll('_', '-')}: `);
    }
  });
  it('declares the role tokens and utility classes', () => {
    const css = read('src/styles/tokens.css');
    expect(css).toContain('--text-dim: var(--muted);');
    expect(css).toContain('--control-line: var(--comment);');
    expect(css).toContain('--primary-hover: #bfe8c0;');
    expect(css).toContain('.accent-teal { --accent: var(--teal); }');
    expect(css).toContain('.acc-orange { color: var(--orange); }');
  });
  it('never uses --comment as a text colour', () => {
    const css = read('src/styles/tokens.css');
    expect(css).not.toMatch(/(^|[;{\s])color:\s*var\(--comment\)/);
    expect(css).not.toContain('.acc-comment');
  });
});
