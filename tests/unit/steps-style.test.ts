// One shared numbered-steps component (ux 4.3: manual, plugin and mod steps share one list style), so the layouts
// cannot drift apart again: only Steps.astro may style `.steps`.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const layouts = ['Plugin', 'Mod', 'Modpack', 'Tool'];
const read = (name: string) => readFileSync(new URL(`../../src/components/project/layouts/${name}.astro`, import.meta.url), 'utf8');

describe('shared steps list', () => {
  for (const name of layouts) {
    it(`${name} uses Steps.astro and defines no .steps rule of its own`, () => {
      const source = read(name);
      expect(source).toContain("from './Steps.astro'");
      expect(source).not.toMatch(/^\s*[.\w ,:>]*\.steps\b[^{\n]*\{/m);
    });
  }

  it('Steps.astro sets 3ch indent, 3px item padding and dim numbers', () => {
    const source = read('Steps');
    expect(source).toMatch(/padding-left:\s*3ch/);
    expect(source).toMatch(/padding:\s*3px 0/);
    expect(source).toMatch(/::marker[^}]*color:\s*var\(--text-dim\)/);
  });
});
