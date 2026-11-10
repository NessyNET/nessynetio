import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { beforeAll, describe, expect, it } from 'vitest';
import Link from '../../src/components/Link.astro';

let container: Awaited<ReturnType<typeof AstroContainer.create>>;
beforeAll(async () => {
  container = await AstroContainer.create();
});

const render = (props: Record<string, unknown>, text = 'label') =>
  container.renderToString(Link, { props, slots: { default: text } });

const opts = { siteHost: 'nessynet.io' };

describe('Link.astro', () => {
  it('external: new tab, rel, aria-hidden arrow, sr-only text', async () => {
    const html = await render({ ...opts, href: 'https://gear.nessynet.io/' }, 'Gear');
    expect(html).toContain('href="https://gear.nessynet.io/"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain('<span class="xa" aria-hidden="true">↗</span>');
    expect(html).toContain('<span class="sr-only"> (opens in new tab)</span>');
    expect(html).toMatch(/>\s*Gear\s*<span class="xa"/);
  });

  it('internal absolute (own host): no target, rel or arrow', async () => {
    const html = await render({ ...opts, href: 'https://nessynet.io/downloads/pack.mrpack' });
    expect(html).not.toMatch(/target=|rel=|xa|sr-only|↗/);
  });

  it('internal relative, fragment and mailto: no target, rel or arrow', async () => {
    for (const href of ['/ffxiv/', '#install', 'mailto:hello@nessynet.io']) {
      const html = await render({ ...opts, href });
      expect(html, href).toContain(`href="${href}"`);
      expect(html, href).not.toMatch(/target=|rel=|xa|sr-only|↗/);
    }
  });

  it('passes class, aria-label and aria-current through', async () => {
    const html = await render({ ...opts, href: '/ffxiv/', class: 'tab', ariaLabel: 'FFXIV', current: 'page' });
    expect(html).toContain('class="tab"');
    expect(html).toContain('aria-label="FFXIV"');
    expect(html).toContain('aria-current="page"');
  });

  it('external with ariaLabel: the accessible name still ends with " (opens in new tab)"', async () => {
    const html = await render({ ...opts, href: 'https://gear.nessynet.io/', ariaLabel: 'Gear page' });
    expect(html).toContain('aria-label="Gear page (opens in new tab)"');
  });

  it('internal with ariaLabel: the label is passed through unchanged', async () => {
    const html = await render({ ...opts, href: '/ffxiv/', ariaLabel: 'FFXIV' });
    expect(html).toContain('aria-label="FFXIV"');
    expect(html).not.toContain('opens in new tab');
  });

  it('omits optional attributes when not given', async () => {
    const html = await render({ ...opts, href: '/ffxiv/' });
    expect(html).not.toMatch(/class=|aria-label=|aria-current=/);
  });

  it('defaults the site host from Astro.site', async () => {
    const withSite = await AstroContainer.create({ astroConfig: { site: 'https://nessynet.io' } });
    const own = await withSite.renderToString(Link, { props: { href: 'https://nessynet.io/x' }, slots: { default: 'x' } });
    const sub = await withSite.renderToString(Link, { props: { href: 'https://repo.nessynet.io/x' }, slots: { default: 'x' } });
    expect(own).not.toContain('target=');
    expect(sub).toContain('target="_blank"');
  });

  it('throws a clear error without siteHost and Astro.site', async () => {
    await expect(render({ href: '/ffxiv/' })).rejects.toThrow(/siteHost.*Astro\.site|Astro\.site.*siteHost/);
  });
});
