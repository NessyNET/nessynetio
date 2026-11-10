import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Meta from '../../src/components/chrome/Meta.astro';
import { bookmarksMeta, categoryMeta, homeMeta, notFoundMeta, projectMeta } from '../../src/lib/meta.ts';
import { project, siteModel } from '../helpers/chrome-model.ts';

const model = siteModel();
const [ffxiv, , linux] = model.categories;
if (ffxiv === undefined || linux === undefined) throw new Error('fixture');

// Expected titles typed out from docs/ux.md 3.2.
describe('page meta builders (ux 3.2)', () => {
  it('landing', () => {
    expect(homeMeta(model)).toEqual({
      title: 'nessynet.io',
      description: 'Plugins, mods and small tools.',
      canonicalPath: '/',
    });
  });

  it('category: label, blurb', () => {
    expect(categoryMeta(model, ffxiv)).toEqual({
      title: 'Final Fantasy XIV · nessynet.io',
      description: 'ffxiv blurb. Second sentence.',
      canonicalPath: '/ffxiv/',
    });
  });

  it('project: Name, short category label, summary', () => {
    expect(projectMeta(model, project('linux', 'lochctl', 'lochctl', 'Manage lochs from the shell.'))).toEqual({
      title: 'lochctl · Linux tools · nessynet.io',
      description: 'Manage lochs from the shell.',
      canonicalPath: '/linux/lochctl/',
    });
  });

  it('project in an unknown category fails loudly (a pages bug, not content)', () => {
    expect(() => projectMeta(model, project('nope', 'x'))).toThrow(/nope/);
  });

  it('bookmarks and 404 use the site description', () => {
    expect(bookmarksMeta(model)).toEqual({
      title: 'Bookmarks · nessynet.io',
      description: 'Plugins, mods and small tools.',
      canonicalPath: '/bookmarks/',
    });
    expect(notFoundMeta(model)).toEqual({
      title: 'Not found · nessynet.io',
      description: 'Plugins, mods and small tools.',
      canonicalPath: '/404.html',
    });
  });

  it('titles use the model host, not a constant', () => {
    const other = siteModel({ site: { url: 'https://example.org', host: 'example.org', description: 'd' } });
    expect(homeMeta(other).title).toBe('example.org');
    expect(bookmarksMeta(other).title).toBe('Bookmarks · example.org');
  });

  it('canonical paths never carry a query or fragment', () => {
    for (const m of [homeMeta(model), categoryMeta(model, ffxiv), bookmarksMeta(model), notFoundMeta(model)]) {
      expect(m.canonicalPath).not.toMatch(/[?#]/);
    }
  });
});

describe('Meta.astro', () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;
  beforeAll(async () => {
    container = await AstroContainer.create();
  });
  const render = (canonicalPath: string) =>
    container.renderToString(Meta, {
      props: { meta: { title: 'A & B · nessynet.io', description: 'Desc "quoted".', canonicalPath }, siteUrl: 'https://nessynet.io/' },
    });

  it('renders title, description and an absolute canonical link', async () => {
    const html = await render('/ffxiv/');
    expect(html).toContain('<title>A &amp; B · nessynet.io</title>');
    expect(html).toContain('<meta name="description" content="Desc &quot;quoted&quot;.">');
    expect(html).toContain('<link rel="canonical" href="https://nessynet.io/ffxiv/">');
  });

  it('canonical drops a query string and fragment', async () => {
    const html = await render('/ffxiv/?tag=plugin&sort=name#x');
    expect(html).toContain('<link rel="canonical" href="https://nessynet.io/ffxiv/">');
    expect(html).not.toContain('tag=plugin');
  });
});
