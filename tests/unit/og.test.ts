import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSite } from '../../src/lib/content/index.ts';
import type { SiteModel } from '../../src/lib/content/model.ts';
import { renderCard } from '../../src/og/card.ts';
import { ogInputsFor, ogPathFor } from '../../src/og/inputs.ts';
import type { OgCardInput } from '../../src/og/types.ts';
import { buildInScratch } from '../helpers/scratch-build.ts';

const E2E_DIR = fileURLToPath(new URL('../fixtures/site-e2e', import.meta.url));
const SLOW = 300_000;
const MAX_BYTES = 300 * 1024;

const input = (over: Partial<OgCardInput> = {}): OgCardInput => ({
  kind: 'project',
  title: 'gorse-gearplanner',
  subtitle: 'Plan best-in-slot gear sets and materia melds in the browser.',
  categoryLabel: 'FFXIV',
  accent: 'blue',
  status: 'active',
  version: '2026.10',
  ...over,
});

describe('ogPathFor', () => {
  it('is stable for equal input and changes when the summary or the accent changes', () => {
    const a = ogPathFor('/ffxiv/gorse/', input(), E2E_DIR);
    expect(ogPathFor('/ffxiv/gorse/', input(), E2E_DIR)).toBe(a);
    expect(a).toMatch(/^\/og\/ffxiv-gorse-[0-9a-f]{8}\.png$/);
    expect(ogPathFor('/ffxiv/gorse/', input({ subtitle: 'Changed.' }), E2E_DIR)).not.toBe(a);
    expect(ogPathFor('/ffxiv/gorse/', input({ accent: 'teal' }), E2E_DIR)).not.toBe(a);
  });

  it('changes when the screenshot bytes change, not only its name', () => {
    const shot = (file: string) => input({ screenshot: { file, alt: 'a' } });
    const one = ogPathFor('/linux/lochctl/', shot('projects/linux/lochctl/01.png'), E2E_DIR);
    expect(ogPathFor('/linux/lochctl/', shot('projects/linux/lochctl/01.png'), E2E_DIR)).toBe(one);
    expect(ogPathFor('/linux/lochctl/', shot('projects/linux/lochctl/02.png'), E2E_DIR)).not.toBe(one);
    expect(one).not.toBe(ogPathFor('/linux/lochctl/', input(), E2E_DIR));
  });
});

describe('ogPathFor, screenshot bytes', () => {
  it('changes when the bytes change under the same file name', () => {
    const dir = mkdtempSync(join(tmpdir(), 'nessy-og-'));
    try {
      const card = input({ screenshot: { file: 'shot.png', alt: 'a' } });
      writeFileSync(join(dir, 'shot.png'), 'first bytes');
      const before = ogPathFor('/ffxiv/gorse/', card, dir);
      expect(ogPathFor('/ffxiv/gorse/', card, dir)).toBe(before);
      writeFileSync(join(dir, 'shot.png'), 'other bytes');
      expect(ogPathFor('/ffxiv/gorse/', card, dir)).not.toBe(before);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe('renderCard', () => {
  const shot = readFileSync(join(E2E_DIR, 'projects/linux/lochctl/01.png'));
  const long = input({ title: 'a-very-long-project-name-that-has-to-wrap-onto-lines', subtitle: 'x'.repeat(90) });

  it.each([
    ['without a screenshot', input(), undefined],
    ['with a screenshot', input({ screenshot: { file: 'x', alt: 'x' } }), shot],
    ['with a long title and summary', long, shot],
  ] as const)('returns a 1200x630 PNG under 300 KB %s', async (_name, card, bytes) => {
    const png = await renderCard(card, bytes);
    expect([...png.slice(1, 4)]).toEqual([0x50, 0x4e, 0x47]);
    const meta = await sharp(png).metadata();
    expect([meta.width, meta.height, meta.format]).toEqual([1200, 630, 'png']);
    expect(png.length).toBeLessThan(MAX_BYTES);
  });

  it('draws the screenshot: the card differs from the one without it', async () => {
    const withShot = await renderCard(input({ screenshot: { file: 'x', alt: 'x' } }), shot);
    expect(Buffer.from(withShot).equals(Buffer.from(await renderCard(input())))).toBe(false);
  });

  it('is deterministic', async () => {
    expect(Buffer.from(await renderCard(input())).equals(Buffer.from(await renderCard(input())))).toBe(true);
  });
});

describe('ogInputsFor', () => {
  let model: SiteModel;
  beforeAll(async () => {
    const loaded = await loadSite({ dir: E2E_DIR, strict: true, allowSamples: false });
    if (loaded.model === null) throw new Error('site-e2e does not load');
    model = loaded.model;
  });

  it('has an input for every published page and the 404, which uses the default card', () => {
    const inputs = ogInputsFor(model);
    for (const path of model.paths) expect(inputs.has(path), path).toBe(true);
    expect(inputs.get('/404.html')?.kind).toBe('default');
    expect(ogPathFor('/404.html', inputs.get('/404.html') as OgCardInput, E2E_DIR)).toMatch(/^\/og\/404-[0-9a-f]{8}\.png$/);
    expect(inputs.size).toBe(model.paths.length + 1);
  });

  it('home card: whoami name as title, plain tagline (or description) as subtitle, not the host twice', () => {
    const home = ogInputsFor(model).get('/');
    expect(home).toMatchObject({ kind: 'home', title: model.whoami?.name });
    expect(home?.subtitle).toBe(model.whoami?.taglinePlain ?? model.site.description);
    expect(home?.title).not.toBe(model.site.host);
  });

  it('builds plain inputs that serialise (the model itself is cyclic)', () => {
    for (const card of ogInputsFor(model).values()) expect(() => JSON.stringify(card)).not.toThrow();
  });

  it('project inputs carry name, summary, category and the first screenshot', () => {
    const p = model.categories.flatMap((c) => c.projects).find((x) => x.screenshots.length > 0);
    if (p === undefined) throw new Error('fixture has no project with a screenshot');
    expect(ogInputsFor(model).get(p.path)).toMatchObject({ kind: 'project', title: p.name, subtitle: p.summary, screenshot: { file: p.screenshots[0]?.file } });
  });
});

describe('og in the built site', () => {
  let dist: string;
  let cleanup: () => void;
  beforeAll(() => {
    ({ dist, cleanup } = buildInScratch(E2E_DIR));
  }, SLOW);
  afterAll(() => cleanup?.());

  const pages = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === '_astro' || e.name === 'og' ? [] : pages(join(dir, e.name))) : e.name.endsWith('.html') ? [join(dir, e.name)] : []));
  const content = (html: string, key: string) => new RegExp(`<meta (?:property|name)="${key}" content="([^"]*)"`).exec(html)?.[1];

  it('every page links an og:image that exists in dist/og, with width, height and alt', async () => {
    const files = pages(dist);
    expect(files.length).toBeGreaterThan(20);
    for (const file of files) {
      const html = readFileSync(file, 'utf8');
      const url = content(html, 'og:image');
      expect(url, file).toMatch(/^https:\/\/nessynet\.io\/og\/[a-z0-9.-]+-[0-9a-f]{8}\.png$/);
      expect(content(html, 'twitter:image'), file).toBe(url);
      expect(content(html, 'og:image:width'), file).toBe('1200');
      expect(content(html, 'og:image:height'), file).toBe('630');
      expect(content(html, 'og:image:alt')?.length, file).toBeGreaterThan(0);
      const png = join(dist, new URL(url as string).pathname);
      const meta = await sharp(png).metadata();
      expect([meta.width, meta.height], file).toEqual([1200, 630]);
    }
  });

  it('dist/og has exactly one card per page', () => {
    expect(readdirSync(join(dist, 'og'))).toHaveLength(pages(dist).length);
  });
});
