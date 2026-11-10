import { describe, expect, it } from 'vitest';
import * as routes from '../../src/lib/routes.ts';

describe('routes', () => {
  it('builds every path with a trailing slash', () => {
    expect(routes.home()).toBe('/');
    expect(routes.category('ffxiv')).toBe('/ffxiv/');
    expect(routes.project('ffxiv', 'loch-lantern')).toBe('/ffxiv/loch-lantern/');
    expect(routes.bookmarks()).toBe('/bookmarks/');
    expect(routes.bookmarkGroup('reading')).toBe('/bookmarks/#bm-reading');
    expect(routes.install('ffxiv', 'loch-lantern')).toBe('/ffxiv/loch-lantern/#install');
    expect(routes.categoryWithTag('ffxiv', 'plugin')).toBe('/ffxiv/?tag=plugin');
    expect(routes.notFound()).toBe('/404.html');
  });

  it('percent-encodes the tag in the query', () => {
    expect(routes.categoryWithTag('linux', 'a b&c')).toBe('/linux/?tag=a%20b%26c');
  });

  it('flattens the page path into the og file name', () => {
    expect(routes.og('/', 'abcd1234')).toBe('/og/home-abcd1234.png');
    expect(routes.og('/ffxiv/', 'abcd1234')).toBe('/og/ffxiv-abcd1234.png');
    expect(routes.og('/ffxiv/loch-lantern/', 'abcd1234')).toBe('/og/ffxiv-loch-lantern-abcd1234.png');
    expect(routes.og('/bookmarks/', '00ff00ff')).toBe('/og/bookmarks-00ff00ff.png');
  });

  it('canonical never carries a query or fragment', () => {
    expect(routes.canonical('https://nessynet.io', '/ffxiv/?tag=x')).toBe('https://nessynet.io/ffxiv/');
    expect(routes.canonical('https://nessynet.io', '/ffxiv/loch-lantern/#install')).toBe(
      'https://nessynet.io/ffxiv/loch-lantern/',
    );
    expect(routes.canonical('https://nessynet.io', '/')).toBe('https://nessynet.io/');
  });

  it('canonical tolerates a trailing slash on the site url', () => {
    expect(routes.canonical('https://nessynet.io/', '/bookmarks/')).toBe('https://nessynet.io/bookmarks/');
  });

  it('lists the reserved category ids', () => {
    expect([...routes.RESERVED_CATEGORY_IDS]).toEqual(['bookmarks', 'og', '_astro', '404', 'fonts', 'licenses']);
  });
});
