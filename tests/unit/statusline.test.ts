import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import StatusLine from '../../src/components/chrome/StatusLine.astro';
import type { StatusLineProps } from '../../src/components/chrome/status-line.ts';
import { SITE_HOST } from '../helpers/chrome-model.ts';

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const links = { github: 'https://github.com/nessy', mail: 'hello@nessynet.io' };
// Scoped styles stamp every element with a data-astro-cid-* attribute; it is not part of the markup under test.
const render = async (status: StatusLineProps, l: { github?: string; mail?: string } = links) =>
  (await container.renderToString(StatusLine, { props: { status, links: l, siteHost: SITE_HOST } })).replace(/ data-astro-cid-[a-z0-9]+/g, '');

// The direct children of div.in, as [opening tag, text without tags].
function cells(html: string): { cls: string; text: string }[] {
  const inner = /<div class="in">([\s\S]*)<\/div><\/footer>/.exec(html)?.[1] ?? '';
  const out: { cls: string; text: string }[] = [];
  let depth = 0;
  let current: { cls: string; start: number } | undefined;
  for (const m of inner.matchAll(/<(\/?)(span|a)\b([^>]*)>/g)) {
    if (m[1] === '') {
      if (depth === 0) current = { cls: /class="([^"]*)"/.exec(m[3] ?? '')?.[1] ?? m[2] ?? '', start: m.index };
      depth++;
    } else {
      depth--;
      if (depth === 0 && current) {
        const raw = inner.slice(current.start, m.index);
        out.push({ cls: current.cls, text: raw.replace(/<[^>]*>/g, '').trim() });
      }
    }
  }
  return out;
}

describe('StatusLine.astro', () => {
  it('is footer.statusline labelled "Status line"', async () => {
    const html = await render({ kind: 'home', projects: 19, dirs: 4 });
    expect(html).toMatch(/^<footer class="statusline" aria-label="Status line">/);
  });

  it('home: NESSY | ~ | N projects | spacer | dirs, 1 link | github | mail, in that order', async () => {
    const c = cells(await render({ kind: 'home', projects: 19, dirs: 4 }));
    expect(c.map((x) => x.cls)).toEqual(['mode', 'pth', 'mid', 'sp', 'rt', 'a', 'a']);
    expect(c.map((x) => x.text)).toEqual(['NESSY', '~', '19 projects', '', '4 dirs, 1 link', 'github ↗ (opens in new tab)', 'mail']);
  });

  it('github goes through Link (external: new tab, rel, arrow); mail is a mailto link', async () => {
    const html = await render({ kind: 'home', projects: 1, dirs: 1 });
    expect(html).toMatch(/<a href="https:\/\/github.com\/nessy"[^>]*target="_blank"[^>]*rel="noopener noreferrer"/);
    expect(html).toContain('<span class="xa" aria-hidden="true">↗</span>');
    expect(html).toMatch(/<a href="mailto:hello@nessynet.io"[^>]*>mail<\/a>/);
    expect(html).not.toMatch(/mailto:[^"]*"[^>]*target=/);
  });

  it('omits the github cell when it is not configured, and the mail cell likewise', async () => {
    const noGithub = cells(await render({ kind: 'home', projects: 1, dirs: 1 }, { mail: 'hello@nessynet.io' }));
    expect(noGithub.map((x) => x.text)).toEqual(['NESSY', '~', '1 project', '', '1 dir, 1 link', 'mail']);
    const noMail = cells(await render({ kind: 'home', projects: 1, dirs: 1 }, { github: 'https://github.com/nessy' }));
    expect(noMail.map((x) => x.text).at(-1)).toBe('github ↗ (opens in new tab)');
    expect(noMail.some((x) => x.text === 'mail')).toBe(false);
    const none = cells(await render({ kind: 'home', projects: 1, dirs: 1 }, {}));
    expect(none.map((x) => x.cls)).toEqual(['mode', 'pth', 'mid', 'sp', 'rt']);
  });

  it('category: path, tag and sort hooks, count hook', async () => {
    const html = await render({ kind: 'category', categoryId: 'ffxiv', projects: 8 });
    const c = cells(html);
    expect(c.slice(0, 5).map((x) => x.text)).toEqual(['NESSY', '~/ffxiv', 'tag:all sort:default', '', '8 projects']);
    expect(html).toContain('tag:<span data-tag-name>all</span> sort:<span data-sort-name>default</span>');
    expect(html).toContain('<span data-count>8 projects</span>');
  });

  it('project: path with slug, status word, version', async () => {
    const c = cells(await render({ kind: 'project', categoryId: 'ffxiv', slug: 'loch-lantern', status: 'active', version: '2.3.1' }));
    expect(c.slice(0, 5).map((x) => x.text)).toEqual(['NESSY', '~/ffxiv/loch-lantern', 'active', '', 'v2.3.1']);
  });

  it('project without a version leaves the right cell empty but present', async () => {
    const c = cells(await render({ kind: 'project', categoryId: 'ffxiv', slug: 'gear', status: 'retired' }));
    expect(c.slice(0, 5).map((x) => x.text)).toEqual(['NESSY', '~/ffxiv/gear', 'retired', '', '']);
  });

  it('bookmarks: ~/bookmarks | N links | external', async () => {
    const c = cells(await render({ kind: 'bookmarks', links: 16 }));
    expect(c.slice(0, 5).map((x) => x.text)).toEqual(['NESSY', '~/bookmarks', '16 links', '', 'external']);
  });

  it('404: the path cell carries the data-badpath hook with the JS-off fallback; 404 | not found', async () => {
    const html = await render({ kind: 'notfound' });
    expect(html).toContain('<span data-badpath>this address</span>');
    const c = cells(html);
    expect(c.slice(0, 5).map((x) => x.text)).toEqual(['NESSY', 'this address', '404', '', 'not found']);
  });
});
