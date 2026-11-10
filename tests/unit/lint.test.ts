import { describe, expect, it } from 'vitest';
import { lintFiles } from '../../scripts/lint.mjs';

interface Hit { path: string; line: number; rule: string; message: string }
const run = (path: string, text: string): Hit[] => lintFiles([{ path, text }]);
const rules = (path: string, text: string): string[] => run(path, text).map((h) => h.rule);

describe('L1 set:html', () => {
  it('flags set:html in any src file', () => {
    expect(rules('src/components/A.astro', '<div set:html={x} />')).toEqual(['L1']);
  });
  it('passes plain markup', () => {
    expect(rules('src/components/A.astro', '<div>{x}</div>')).toEqual([]);
  });
  it('reports the line number', () => {
    expect(run('src/components/A.astro', '<p>\n<div set:html={x} />')[0]?.line).toBe(2);
  });
});

describe('L2 style attribute', () => {
  it('flags style= in .astro', () => {
    expect(rules('src/components/A.astro', '<div style="color:red">x</div>')).toEqual(['L2']);
  });
  it('does not flag <style> blocks or non-astro files', () => {
    expect(rules('src/components/A.astro', '<style>a{color:red}</style>')).toEqual([]);
    expect(rules('src/lib/x.ts', 'const s = \'style="x"\';')).toEqual([]);
  });
});

describe('L3 astro: imports in content core', () => {
  it('flags import and from of astro: modules under src/lib/content/', () => {
    expect(rules('src/lib/content/a.ts', "import { x } from 'astro:assets';")).toEqual(['L3']);
    expect(rules('src/lib/content/a.ts', 'const m = await import("astro:content");')).toEqual(['L3']);
  });
  it('ignores files outside src/lib/content/', () => {
    expect(rules('src/lib/images.ts', "import { x } from 'astro:assets';")).toEqual([]);
  });
  it('allows other imports in the content core', () => {
    expect(rules('src/lib/content/a.ts', "import { z } from 'zod';")).toEqual([]);
  });
});

describe('L4 raw external anchors', () => {
  it('flags absolute http(s) href and target= in .astro', () => {
    expect(rules('src/pages/a.astro', '<a href="https://x.io">x</a>')).toEqual(['L4']);
    expect(rules('src/pages/a.astro', '<a href="http://x.io">x</a>')).toEqual(['L4']);
    expect(rules('src/pages/a.astro', '<a href="/p/" target="_blank">x</a>')).toEqual(['L4']);
  });
  it('allows internal anchors', () => {
    expect(rules('src/pages/a.astro', '<a href="/projects/">x</a>')).toEqual([]);
  });
  it('exempts Link.astro', () => {
    expect(rules('src/components/Link.astro', '<a href="https://x.io" target="_blank">x</a>')).toEqual([]);
  });
});

describe('L5 is:inline scripts', () => {
  it('flags is:inline scripts without a JSON type', () => {
    expect(rules('src/layouts/B.astro', '<script is:inline>1</script>')).toEqual(['L5']);
    expect(rules('src/layouts/B.astro', '<script is:inline type="text/javascript">1</script>')).toEqual(['L5']);
  });
  it('accepts application/json', () => {
    expect(rules('src/layouts/B.astro', '<script is:inline type="application/json">{}</script>')).toEqual([]);
  });
  it('ignores normal bundled scripts', () => {
    expect(rules('src/layouts/B.astro', '<script>import "x";</script>')).toEqual([]);
  });
});

describe('L6 CSS content text', () => {
  it('flags non-empty content strings in .css and astro <style>', () => {
    expect(rules('src/styles/base.css', 'a::before { content: "*"; }')).toEqual(['L6']);
    expect(rules('src/styles/base.css', "a::before{content:'x'}")).toEqual(['L6']);
    expect(rules('src/components/A.astro', '<style>a::after { content: "hi"; }</style>')).toEqual(['L6']);
  });
  it('accepts empty content', () => {
    expect(rules('src/styles/base.css', 'a::before { content: ""; }')).toEqual([]);
    expect(rules('src/styles/base.css', "a::before { content: ''; }")).toEqual([]);
  });
  it('does not flag content: outside CSS or astro style blocks', () => {
    expect(rules('src/lib/x.ts', 'const o = { content: "hello" };')).toEqual([]);
    expect(rules('src/components/A.astro', '<p>content: "x"</p>')).toEqual([]);
  });
});
