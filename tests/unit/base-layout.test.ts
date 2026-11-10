import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Base from '../../src/layouts/Base.astro';
import { homeMeta } from '../../src/lib/meta.ts';
import { siteModel } from '../helpers/chrome-model.ts';
import { IDS } from '../helpers/hooks.ts';

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
let html: string;
const model = siteModel();

beforeAll(async () => {
  container = await AstroContainer.create();
  const rendered = await container.renderToString(Base, {
    props: {
      model,
      meta: homeMeta(model),
      current: { kind: 'home' },
      status: { kind: 'home', projects: 0, dirs: 3 },
    },
    slots: { default: '<h1>Page</h1>' },
  });
  // Scoped styles stamp every element with a data-astro-cid-* attribute; it is not part of the markup under test.
  html = rendered.replace(/ data-astro-cid-[a-z0-9]+/g, '');
});

const count = (re: RegExp, text = html) => [...text.matchAll(re)].length;

describe('Base.astro', () => {
  it('is an English document with a charset and viewport', () => {
    expect(html).toMatch(/<html lang="en"/);
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toMatch(/<meta name="viewport" content="width=device-width,\s*initial-scale=1">/);
  });

  it('has the page title, description and canonical from the meta prop', () => {
    expect(html).toContain('<title>nessynet.io</title>');
    expect(html).toContain('<meta name="description" content="Plugins, mods and small tools.">');
    expect(html).toContain('<link rel="canonical" href="https://nessynet.io/">');
  });

  it('has exactly one main#main.screen holding the slot', () => {
    expect(count(/<main\b/g)).toBe(1);
    expect(html).toMatch(new RegExp(`<main id="${IDS.main}" class="screen">\\s*<h1>Page</h1>\\s*</main>`));
  });

  it('the skip link is the first focusable element and targets #main', () => {
    const firstFocusable = /<(a|button|input|select|textarea)\b[^>]*>/.exec(html);
    expect(firstFocusable?.[0]).toMatch(/^<a href="#main" class="skip">/);
    expect(html).toContain('Skip to content</a>');
  });

  it('orders skip link, tab bar, main, status line, live region', () => {
    const at = (s: string) => html.indexOf(s);
    const order = ['class="skip"', '<header class="tmux">', '<main ', '<footer class="statusline"', `id="${IDS.live}"`];
    expect(order.map(at)).toEqual([...order.map(at)].sort((a, b) => a - b));
    expect(order.every((s) => at(s) > 0)).toBe(true);
  });

  it('has exactly one polite live region, #live.sr-only', () => {
    expect(count(/aria-live=/g)).toBe(1);
    expect(html).toContain(`<div id="${IDS.live}" class="sr-only" aria-live="polite"></div>`);
  });

  it('links the nojs stylesheet inside <noscript> in the head, and not outside it', () => {
    const head = /<head>([\s\S]*)<\/head>/.exec(html)?.[1] ?? '';
    const noscript = /<noscript>([\s\S]*?)<\/noscript>/.exec(head)?.[1] ?? '';
    // vitest stubs `?url` CSS imports to an empty string, so the hashed href itself is checked on the build output.
    expect(noscript).toMatch(/^<link rel="stylesheet" href(="[^"]*")?>$/);
    expect(count(/rel="stylesheet"/g, head.replace(/<noscript>[\s\S]*?<\/noscript>/, ''))).toBe(0);
  });

  it('preloads the Latin woff2 as a font with crossorigin', () => {
    expect(html).toMatch(/<link rel="preload" as="font" type="font\/woff2" href="[^"]*latin-wght-normal[^"]*\.woff2" crossorigin/);
  });

  it('renders no inline script or style and no style attributes', () => {
    const inline = [...html.matchAll(/<script\b([^>]*)>/g)].filter((m) => !/\bsrc=/.test(m[1] ?? ''));
    expect(inline).toHaveLength(0);
    expect(html).not.toMatch(/<style\b/);
    expect(html).not.toMatch(/\sstyle\s*=/);
  });
});
