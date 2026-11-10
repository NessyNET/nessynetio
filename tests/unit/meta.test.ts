import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Meta from '../../src/components/chrome/Meta.astro';
import { type PageMeta, bookmarksMeta, categoryMeta, homeMeta, notFoundMeta, projectMeta } from '../../src/lib/meta.ts';
import { project, siteModel } from '../helpers/chrome-model.ts';

const model = siteModel();
const [ffxiv, , linux] = model.categories;
if (ffxiv === undefined || linux === undefined) throw new Error('fixture');

// Expected titles typed out from docs/ux.md 3.2.
describe('page meta builders (ux 3.2)', () => {
  it('landing', () => {
    expect(homeMeta(model)).toMatchObject({
      title: 'nessynet.io',
      description: 'Plugins, mods and small tools.',
      canonicalPath: '/',
    });
  });

  it('category: label, blurb', () => {
    expect(categoryMeta(model, ffxiv)).toMatchObject({
      title: 'Final Fantasy XIV · nessynet.io',
      description: 'ffxiv blurb. Second sentence.',
      canonicalPath: '/ffxiv/',
    });
  });

  it('project: Name, short category label, summary', () => {
    expect(projectMeta(model, project('linux', 'lochctl', 'lochctl', 'Manage lochs from the shell.'))).toMatchObject({
      title: 'lochctl · Linux tools · nessynet.io',
      description: 'Manage lochs from the shell.',
      canonicalPath: '/linux/lochctl/',
    });
  });

  it('project in an unknown category fails loudly (a pages bug, not content)', () => {
    expect(() => projectMeta(model, project('nope', 'x'))).toThrow(/nope/);
  });

  it('bookmarks and 404 use the site description', () => {
    expect(bookmarksMeta(model)).toMatchObject({
      title: 'Bookmarks · nessynet.io',
      description: 'Plugins, mods and small tools.',
      canonicalPath: '/bookmarks/',
    });
    expect(notFoundMeta(model)).toMatchObject({
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

describe('social-card fields (R19)', () => {
  it('mirror title and description; landing previews the plain tagline; no card yet', () => {
    const project_ = projectMeta(model, project('linux', 'lochctl', 'lochctl', 'Manage lochs from the shell.'));
    expect(project_).toMatchObject({ ogType: 'website', ogTitle: project_.title, ogDescription: 'Manage lochs from the shell.', og: null });
    const tagged = siteModel({ whoami: { ...(model.whoami as NonNullable<typeof model.whoami>), taglinePlain: 'plugins & mods' } });
    expect(homeMeta(tagged).ogDescription).toBe('plugins & mods');
    expect(homeMeta(tagged).description).toBe('Plugins, mods and small tools.');
  });

  it('landing falls back to the site description without a tagline', () => {
    expect(homeMeta(siteModel({ whoami: null })).ogDescription).toBe('Plugins, mods and small tools.');
  });
});

describe('Meta.astro', () => {
  let container: Awaited<ReturnType<typeof AstroContainer.create>>;
  beforeAll(async () => {
    container = await AstroContainer.create();
  });
  const base: PageMeta = {
    title: 'A & B · nessynet.io',
    description: 'Desc "quoted".',
    canonicalPath: '/ffxiv/',
    ogType: 'website',
    ogTitle: 'A & B · nessynet.io',
    ogDescription: 'Preview "text".',
    og: null,
  };
  const renderMeta = (meta: PageMeta) => container.renderToString(Meta, { props: { meta, siteUrl: 'https://nessynet.io/' } });
  const render = (canonicalPath: string) => renderMeta({ ...base, canonicalPath });

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

  it('renders the Open Graph and Twitter tags without image tags when no card is set', async () => {
    const html = await render('/ffxiv/?tag=plugin');
    for (const tag of [
      '<meta property="og:type" content="website">',
      '<meta property="og:site_name" content="nessynet.io">',
      '<meta property="og:title" content="A &amp; B · nessynet.io">',
      '<meta property="og:description" content="Preview &quot;text&quot;.">',
      '<meta property="og:url" content="https://nessynet.io/ffxiv/">',
      '<meta name="twitter:card" content="summary_large_image">',
      '<meta name="twitter:title" content="A &amp; B · nessynet.io">',
      '<meta name="twitter:description" content="Preview &quot;text&quot;.">',
    ]) {
      expect(html).toContain(tag);
    }
    expect(html).not.toMatch(/og:image|twitter:image/);
  });

  it('renders image tags with an absolute URL when a card is set', async () => {
    const html = await renderMeta({ ...base, og: { path: '/og/abc.png', width: 1200, height: 630, alt: 'Card "alt"' } });
    expect(html).toContain('<meta property="og:image" content="https://nessynet.io/og/abc.png">');
    expect(html).toContain('<meta property="og:image:width" content="1200">');
    expect(html).toContain('<meta property="og:image:height" content="630">');
    expect(html).toContain('<meta property="og:image:alt" content="Card &quot;alt&quot;">');
    expect(html).toContain('<meta name="twitter:image" content="https://nessynet.io/og/abc.png">');
    expect(html).toContain('<meta name="twitter:image:alt" content="Card &quot;alt&quot;">');
  });
});
