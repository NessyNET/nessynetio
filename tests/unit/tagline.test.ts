import { describe, expect, it } from 'vitest';
import { parseTagline } from '../../src/lib/content/tagline.ts';

describe('parseTagline: valid markup', () => {
  it('cycles green, yellow, cyan (index.html mock)', () => {
    const r = parseTagline('I make *plugins*, *mods* and *small tools*.');
    expect(r.segments).toEqual([
      { text: 'I make ' },
      { text: 'plugins', accent: 'green' },
      { text: ', ' },
      { text: 'mods', accent: 'yellow' },
      { text: ' and ' },
      { text: 'small tools', accent: 'cyan' },
      { text: '.' },
    ]);
    expect(r.plain).toBe('I make plugins, mods and small tools.');
    expect(r.issues).toEqual([]);
  });

  it('honours an explicit colour', () => {
    expect(parseTagline('*x*{pink}').segments).toEqual([{ text: 'x', accent: 'pink' }]);
  });

  it('does not advance the auto cycle for explicit colours', () => {
    expect(parseTagline('*a*{pink} *b*').segments).toEqual([
      { text: 'a', accent: 'pink' },
      { text: ' ' },
      { text: 'b', accent: 'green' },
    ]);
  });

  it('resolves \\* and \\\\ as literals', () => {
    const r = parseTagline('a \\* b \\\\ c');
    expect(r.segments).toEqual([{ text: 'a * b \\ c' }]);
    expect(r.plain).toBe('a * b \\ c');
    expect(r.issues).toEqual([]);
  });

  it('allows escapes inside a span', () => {
    expect(parseTagline('*a\\*b*').segments).toEqual([{ text: 'a*b', accent: 'green' }]);
  });

  it('treats other markup and a lone backslash as literal text', () => {
    const r = parseTagline('_a_ `c` \\n [d](e)');
    expect(r.plain).toBe('_a_ `c` \\n [d](e)');
    expect(r.segments).toEqual([{ text: '_a_ `c` \\n [d](e)' }]);
  });

  it('keeps an unsupported brace group after plain text literal', () => {
    expect(parseTagline('a {pink}').plain).toBe('a {pink}');
  });

  it('returns no segments for an empty source', () => {
    expect(parseTagline('')).toEqual({ segments: [], plain: '', renderedLength: 0, issues: [] });
  });
});

describe('parseTagline: malformed markup', () => {
  it('renders an unclosed * literally and reports it', () => {
    const r = parseTagline('a *b');
    expect(r.segments).toEqual([{ text: 'a *b' }]);
    expect(r.plain).toBe('a *b');
    expect(r.issues).toEqual([expect.objectContaining({ code: 'unclosed', index: 2 })]);
  });

  it('falls back to the auto colour for {red} and reports it', () => {
    const r = parseTagline('*a*{red}');
    expect(r.segments).toEqual([{ text: 'a', accent: 'green' }]);
    expect(r.plain).toBe('a');
    expect(r.issues).toEqual([expect.objectContaining({ code: 'bad-colour', index: 0 })]);
  });

  it('treats an unknown colour like {red}', () => {
    const r = parseTagline('*a*{magenta}');
    expect(r.segments).toEqual([{ text: 'a', accent: 'green' }]);
    expect(r.issues.map((x) => x.code)).toEqual(['bad-colour']);
  });

  it('leaves an unterminated {colour suffix as literal text', () => {
    const r = parseTagline('*a*{pink');
    expect(r.segments).toEqual([{ text: 'a', accent: 'green' }, { text: '{pink' }]);
    expect(r.issues).toEqual([]);
  });

  it('removes an empty ** and reports it', () => {
    const r = parseTagline('a **b');
    expect(r.plain).toBe('a b');
    expect(r.segments).toEqual([{ text: 'a b' }]);
    expect(r.issues).toEqual([expect.objectContaining({ code: 'empty', index: 2 })]);
  });

  it('renders the 4th and later accents plain and reports them', () => {
    const r = parseTagline('*a* *b* *c* *d* *e*');
    expect(r.segments.filter((s) => s.accent !== undefined).map((s) => s.accent)).toEqual(['green', 'yellow', 'cyan']);
    expect(r.plain).toBe('a b c d e');
    expect(r.segments.at(-1)).toEqual({ text: ' d e' });
    expect(r.issues.map((x) => x.code)).toEqual(['too-many', 'too-many']);
  });

  it('counts explicit accents towards the cap of 3', () => {
    const r = parseTagline('*a*{pink} *b*{blue} *c*{teal} *d*{orange}');
    expect(r.segments.filter((s) => s.accent !== undefined)).toHaveLength(3);
    expect(r.issues.map((x) => x.code)).toEqual(['too-many']);
  });

  it('yields the issues the index-longbio.html mock describes', () => {
    const r = parseTagline('I make *plugins*{red}, *mods* and *small tools');
    expect(r.issues.map((x) => x.code)).toEqual(['bad-colour', 'unclosed']);
    expect(r.plain).toBe('I make plugins, mods and *small tools');
    expect(r.segments).toEqual([
      { text: 'I make ' },
      { text: 'plugins', accent: 'green' },
      { text: ', ' },
      { text: 'mods', accent: 'yellow' },
      { text: ' and *small tools' },
    ]);
  });

  it('stays linear on adversarial input', () => {
    const start = performance.now();
    parseTagline('*a*{'.repeat(50_000));
    parseTagline('*'.repeat(100_000));
    parseTagline('\\*'.repeat(100_000));
    expect(performance.now() - start).toBeLessThan(2000);
  });
});

describe('parseTagline: lengths', () => {
  it('excludes markup from plain and renderedLength', () => {
    const r = parseTagline('*ab*{purple}cd');
    expect(r.plain).toBe('abcd');
    expect(r.renderedLength).toBe(4);
  });

  it('measures a 60-character rendered tagline whose raw form is longer', () => {
    const src = '*aaaaaaaaaaaaaaaaaaaa*{purple} *bbbbbbbbbbbbbbbbbbbb*{orange} *cccccccccccccccccc*{teal}';
    expect(src.length).toBeGreaterThan(60);
    const r = parseTagline(src);
    expect(r.renderedLength).toBe(60);
    expect(r.plain).toHaveLength(60);
  });

  it('counts code points, not UTF-16 units', () => {
    expect(parseTagline('*\u{1F600}*').renderedLength).toBe(1);
  });
});
