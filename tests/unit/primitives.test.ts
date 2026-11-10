import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import BookmarkMini from '../../src/components/bookmarks/BookmarkMini.astro';
import CopyField from '../../src/components/CopyField.astro';
import GetLinks from '../../src/components/GetLinks.astro';
import Notice from '../../src/components/Notice.astro';
import SourceLink from '../../src/components/SourceLink.astro';
import StatusWord from '../../src/components/StatusWord.astro';
import Prompt from '../../src/components/window/Prompt.astro';
import Window from '../../src/components/window/Window.astro';
import type { Bookmark, GetSlot, Notice as NoticeData, SourceSlot } from '../../src/lib/content/model.ts';
import * as S from '../../src/lib/strings.ts';
import { bookmarkSection, bookmarkTitle, SECTIONS, TITLES } from '../helpers/hooks.ts';

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
beforeAll(async () => {
  container = await AstroContainer.create({ astroConfig: { site: 'https://nessynet.io' } });
});

// Scoped styles stamp every element with a data-astro-cid-* attribute; it is not part of the markup under test.
const render = async (component: Parameters<typeof container.renderToString>[0], props: Record<string, unknown>, slot?: string) =>
  (await container.renderToString(component, { props, ...(slot === undefined ? {} : { slots: { default: slot } }) })).replace(
    / data-astro-cid-[a-z0-9]+/g,
    '',
  );
const text = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
// Text a screen reader would read: drops aria-hidden spans.
const spoken = (html: string) => text(html.replace(/<span[^>]*aria-hidden="true"[^>]*>[^<]*<\/span>/g, ''));
const NO_CONTROLS = /<(a|button|del|s)[\s>]/;

describe('Window', () => {
  it('renders section#sec-w-{id} labelled by an h2 title by default', async () => {
    const html = await render(Window, { id: 'inst', title: 'INSTALL.md' }, '<p>body</p>');
    expect(html).toMatch(new RegExp(`<section[^>]*id="${SECTIONS.inst}"`));
    expect(html).toMatch(new RegExp(`<section[^>]*aria-labelledby="${TITLES.inst}"`));
    expect(html).toMatch(new RegExp(`<h2 id="${TITLES.inst}" class="tt">INSTALL.md</h2>`));
    expect(html).toMatch(/<section class="win[ "]/);
    expect(html).toMatch(/<div class="body">[\s\S]*<p>body<\/p>/);
  });

  it('uses a p title when titleTag is p', async () => {
    const html = await render(Window, { id: 'readme', title: 'README.md', titleTag: 'p' });
    expect(html).toContain('<p id="w-readme" class="tt">README.md</p>');
    expect(html).not.toContain('<h2');
  });

  it('renders the decorative command line aria-hidden with the prompt, only when cmd is given', async () => {
    const withCmd = await render(Window, { id: 'inst', title: 'INSTALL.md', cmd: 'cat INSTALL.md' });
    expect(withCmd).toMatch(/<p class="cmdline" aria-hidden="true">[\s\S]*<span class="p">\$<\/span> cat INSTALL.md[\s\S]*<\/p>/);
    expect(withCmd.indexOf('class="cmdline"')).toBeGreaterThan(withCmd.indexOf('class="body"'));
    expect(await render(Window, { id: 'inst', title: 'INSTALL.md' })).not.toContain('cmdline');
  });

  it('applies the accent class and meta text', async () => {
    const html = await render(Window, { id: 'readme', title: 'README.md', accent: 'blue', meta: 'loch-lantern', class: 'extra' });
    expect(html).toMatch(/<section class="win[^"]*\baccent-blue\b[^"]*"/);
    expect(html).toMatch(/<section class="[^"]*\bextra\b/);
    expect(html).toMatch(/<span class="tbm">loch-lantern<\/span>/);
  });

  it('renders a named meta slot inside span.tbm, so the title meta can hold markup', async () => {
    const html = (
      await container.renderToString(Window, {
        props: { id: 'ls', title: 'projects' },
        slots: { meta: '<span data-count>3 projects</span>' },
      })
    ).replace(/ data-astro-cid-[a-z0-9]+/g, '');
    expect(html).toContain('<span class="tbm"><span data-count>3 projects</span></span>');
  });

  it('has no accent class without an accent and no meta span without meta', async () => {
    const html = await render(Window, { id: 'ls', title: 'projects' });
    expect(html).not.toContain('accent-');
    expect(html).not.toContain('tbm');
  });

  it('idPrefix bm renders sec-bm-{id} and bm-{id}', async () => {
    const html = await render(Window, { id: 'ffxiv', title: 'ffxiv', idPrefix: 'bm' });
    expect(html).toContain(`id="${bookmarkSection('ffxiv')}"`);
    expect(html).toContain(`id="${bookmarkTitle('ffxiv')}"`);
    expect(html).toContain(`aria-labelledby="${bookmarkTitle('ffxiv')}"`);
  });
});

describe('Prompt', () => {
  it('is an aria-hidden fragment with an accent $', async () => {
    const html = await render(Prompt, { cmd: 'ls -l ~' });
    expect(html).toMatch(/^\s*<span class="prompt" aria-hidden="true"><span class="p">\$<\/span> ls -l ~<\/span>\s*$/);
  });
});

const notice = (over: Partial<NoticeData> & Pick<NoticeData, 'kind' | 'label'>): NoticeData => ({ text: 'Body text.', ...over });

describe('Notice', () => {
  const cases: [NoticeData, string, string][] = [
    [notice({ kind: 'local', label: S.NOTICE_LABELS.local }), 'local only', 'notice-cyan'],
    [notice({ kind: 'private', label: S.privateLabel('bot') }), 'private bot', 'notice-cyan'],
    [notice({ kind: 'retired', label: S.NOTICE_LABELS.retired, date: '2025-03-04' }), 'retired', 'notice-orange'],
    [notice({ kind: 'separate', label: S.NOTICE_LABELS.separate }), 'separate site', 'notice-cyan'],
  ];
  it.each(cases)('%j: bold label, colon, colour class', async (n, label, colour) => {
    const html = await render(Notice, { notice: n });
    expect(html).toContain(`<b>${label}:</b>`);
    expect(html).toMatch(new RegExp(`class="notice[^"]*\\b${colour}\\b`));
    expect(html).toContain('Body text.');
    expect(html).not.toMatch(NO_CONTROLS);
  });

  it('retired puts the fixed date sentence before the text', async () => {
    const html = await render(Notice, { notice: notice({ kind: 'retired', label: 'retired', date: '2025-03-04', text: 'It no longer loads.' }) });
    expect(text(html)).toBe(`retired: ${S.retiredOn('2025-03-04')} It no longer loads.`);
  });

  it('only the separate-site notice carries .leaves', async () => {
    expect(await render(Notice, { notice: notice({ kind: 'separate', label: 'separate site' }) })).toMatch(/class="notice[^"]*\bleaves\b/);
    expect(await render(Notice, { notice: notice({ kind: 'local', label: 'local only' }) })).not.toContain('leaves');
  });

  it('warn is yellow with the fixed label', async () => {
    const html = await render(Notice, { kind: 'warn', text: 'Custom repositories are not reviewed.' });
    expect(html).toContain(`<b>${S.NOTICE_LABELS.warn}:</b>`);
    expect(html).toMatch(/class="notice[^"]*\bnotice-yellow\b/);
    expect(text(html)).toBe('warn: Custom repositories are not reviewed.');
  });
});

describe('CopyField', () => {
  const value = 'yay  -S   lochctl'; // runs of spaces survive byte for byte
  it('puts the exact value in a code field and in data-copy', async () => {
    const html = await render(CopyField, { value, what: 'command: yay -S lochctl' });
    expect(html).toContain(`<code>${value}</code>`);
    expect(html).toContain(`data-copy="${value}"`);
    expect(html).toMatch(/<div class="copyrow">/);
  });

  it('button has the accessible name, label, type and data-js-only', async () => {
    const html = await render(CopyField, { value: 'https://repo.nessynet.io/repo.json', what: 'repository URL' });
    const button = /<button\b[^>]*>[\s\S]*?<\/button>/.exec(html)?.[0] ?? '';
    expect(button).toContain('class="copy"');
    expect(button).toContain('type="button"');
    expect(button).toContain(`aria-label="${S.copyName('repository URL')}"`);
    expect(button).toMatch(/\sdata-js-only(=""|\s|>)/);
    expect(button).toContain(`<span data-label>${S.COPY_LABEL}</span>`);
  });

  it('escapes markup in the value', async () => {
    const html = await render(CopyField, { value: 'a "q" <b>', what: 'x' });
    // `<` is legal inside a quoted attribute value; only the quote needs escaping there.
    expect(html).toContain('<code>a &quot;q&quot; &lt;b&gt;</code>');
    expect(html).toContain('data-copy="a &quot;q&quot; <b>"');
  });
});

describe('StatusWord', () => {
  it.each(['active', 'retired'] as const)('%s: word present, brackets hidden, class', async (status) => {
    const html = await render(StatusWord, { status });
    expect(html).toMatch(new RegExp(`class="st st-${status}"`));
    expect(spoken(html)).toBe(status);
    expect(text(html)).toBe(`[${status}]`);
    expect([...html.matchAll(/<span[^>]*aria-hidden="true"[^>]*>/g)]).toHaveLength(2);
  });
});

const link = (label: string, href: string, kind: 'install' | 'external' | 'download', external: boolean) => ({ kind, label, href, external });
const links = (...entries: ReturnType<typeof link>[]): GetSlot => ({ kind: 'links', links: entries });

describe('GetLinks', () => {
  it('bar: get: prefix, links in file order, install is "see install"', async () => {
    const slot = links(link(S.SEE_INSTALL, '#install', 'install', false), link('Modrinth', 'https://modrinth.com/x', 'external', true));
    const html = await render(GetLinks, { value: slot, context: 'bar' });
    expect(text(html)).toBe(`${S.GET_BAR_PREFIX}${S.SEE_INSTALL} Modrinth ${S.EXTERNAL_ARROW} (opens in new tab)`);
    expect(html.indexOf('see install')).toBeLessThan(html.indexOf('Modrinth'));
    expect(html).toContain('href="#install"');
    expect(html).toMatch(/href="https:\/\/modrinth.com\/x" target="_blank"/);
    expect(html).toContain('class="xa"');
  });

  it('row: install entry uses the card label and there is no get: prefix', async () => {
    const html = await render(GetLinks, { value: links(link(S.SEE_INSTALL, '#install', 'install', false)), context: 'row' });
    expect(text(html)).toBe(S.INSTALL_ON_CARD);
    expect(html).not.toContain(S.GET_BAR_PREFIX);
  });

  it('row: other entries keep their label', async () => {
    const html = await render(GetLinks, { value: links(link(S.downloadLabel('1.2.0'), 'https://x.test/a.jar', 'download', true)), context: 'row' });
    expect(text(html)).toContain('download v1.2.0');
  });

  it('web tool: Open tool label from the entry, external with arrow', async () => {
    const slot = links(link(S.openTool('gear.nessynet.io'), 'https://gear.nessynet.io', 'external', true));
    const html = await render(GetLinks, { value: slot, context: 'bar' });
    expect(spoken(html)).toBe(`${S.GET_BAR_PREFIX}${S.openTool('gear.nessynet.io')} (opens in new tab)`);
  });

  const texts = [S.NOT_DISTRIBUTED_LOCAL, S.notDistributedPrivate('bot'), S.NO_LONGER_DISTRIBUTED, S.NOT_DISTRIBUTED_YET];
  it.each(texts)('text slot %s is plain text, never a control', async (t) => {
    for (const context of ['bar', 'row'] as const) {
      const html = await render(GetLinks, { value: { kind: 'text', text: t }, context });
      expect(html).toContain(t);
      expect(html).not.toMatch(NO_CONTROLS);
      expect(text(html)).toBe(context === 'bar' ? `${S.GET_BAR_PREFIX}${t}` : t);
    }
  });
});

describe('SourceLink', () => {
  const link_: SourceSlot = { kind: 'link', label: 'GitHub', href: 'https://github.com/nessy/x' };
  const none: SourceSlot = { kind: 'text', text: S.SOURCE_NOT_AVAILABLE };

  it('bar link: source: prefix, label, external arrow', async () => {
    const html = await render(SourceLink, { value: link_, context: 'bar' });
    expect(spoken(html)).toBe(`${S.SOURCE_BAR_PREFIX}GitHub (opens in new tab)`);
    expect(text(html)).toContain(`GitHub ${S.EXTERNAL_ARROW}`);
    expect(html).toContain('target="_blank"');
  });

  it('row link: source label, no prefix', async () => {
    const html = await render(SourceLink, { value: link_, context: 'row' });
    expect(spoken(html)).toBe(`${S.SOURCE_ROW_LABEL} (opens in new tab)`);
    expect(text(html)).toBe(`${S.SOURCE_ROW_LABEL} ${S.EXTERNAL_ARROW} (opens in new tab)`);
  });

  it.each(['bar', 'row'] as const)('%s text: exact string, no source: prefix, never a control', async (context) => {
    const html = await render(SourceLink, { value: none, context });
    expect(text(html)).toBe(S.SOURCE_NOT_AVAILABLE);
    expect(html).not.toMatch(NO_CONTROLS);
    expect(html).not.toContain(S.SOURCE_BAR_PREFIX);
  });
});

const bm = (n: number, over: Partial<Bookmark> = {}): Bookmark => ({
  name: `Name${n}`,
  url: `https://host${n}.example/path`,
  host: `host${n}.example/path`,
  note: 'note',
  projects: [],
  groupId: 'ffxiv',
  ...over,
});

describe('BookmarkMini', () => {
  it('renders arrow (aria-hidden), name link with arrow, relation and host', async () => {
    const html = await render(BookmarkMini, {
      bookmarks: [bm(1, { relation: { id: 'uses', description: 'Dependency' } })],
      groupId: 'ffxiv',
    });
    expect(html).toContain('<span class="lnk" aria-hidden="true">-&gt;</span>');
    expect(html).toContain('href="https://host1.example/path"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('<span class="rel">uses</span>');
    expect(text(html)).toContain(`-&gt; Name1 ${S.EXTERNAL_ARROW} (opens in new tab) uses host1.example/path`);
  });

  it('omits the relation badge when there is none', async () => {
    expect(await render(BookmarkMini, { bookmarks: [bm(1)], groupId: 'ffxiv' })).not.toContain('class="rel"');
  });

  it('shows at most 4 by default and links to all bookmarks of the group', async () => {
    const html = await render(BookmarkMini, { bookmarks: [1, 2, 3, 4, 5, 6].map((n) => bm(n)), groupId: 'ffxiv' });
    expect([...html.matchAll(/class="ext"/g)]).toHaveLength(4);
    expect(html).not.toContain('Name5');
    expect(html).toMatch(new RegExp(`<a [^>]*href="/bookmarks/#bm-ffxiv"[^>]*>${S.ALL_BOOKMARKS}</a>`));
    expect(html).not.toMatch(/href="\/bookmarks\/#bm-ffxiv"[^>]*target=/);
  });

  it('respects max', async () => {
    const html = await render(BookmarkMini, { bookmarks: [1, 2, 3].map((n) => bm(n)), groupId: 'linux', max: 2 });
    expect([...html.matchAll(/class="ext"/g)]).toHaveLength(2);
    expect(html).toContain('href="/bookmarks/#bm-linux"');
  });
});
