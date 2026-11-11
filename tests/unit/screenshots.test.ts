// Screenshots pipeline (design 3.5.4, ADR 011): key lookup unit tests, then a real build of site-e2e into a temp
// directory (so a parallel `dist/` is never touched) whose output is parsed with parse5.
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import sharp from 'sharp';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { findImage, resolveScreenshot } from '../../src/lib/images.ts';

describe('findImage', () => {
  const images = {
    '/content/projects/ffxiv/loch-lantern/01.png': 'in-repo',
    '../../../tmp/site/projects/ffxiv/gorse/02.png': 'outside',
    '/home/a/projects/site/projects/linux/lochctl/01.webp': 'path with projects/ in it',
  };

  it('finds an entry whose key is root-relative with a leading slash (content dir inside the repo)', () => {
    expect(findImage(images, 'projects/ffxiv/loch-lantern/01.png')).toBe('in-repo');
  });

  it('finds an entry whose key is ../-relative (content dir outside the repo)', () => {
    expect(findImage(images, 'projects/ffxiv/gorse/02.png')).toBe('outside');
  });

  it('is not confused by the content dir path containing projects/', () => {
    expect(findImage(images, 'projects/linux/lochctl/01.webp')).toBe('path with projects/ in it');
  });

  it('does not match a file that only shares a name suffix', () => {
    expect(() => findImage(images, 'projects/ffxiv/loch-lantern/1.png')).toThrow(/projects\/ffxiv\/loch-lantern\/1\.png/);
    expect(() => findImage(images, 'ects/ffxiv/loch-lantern/01.png')).toThrow(/ects\/ffxiv/);
  });

  it('names the file when it is missing', () => {
    expect(() => findImage(images, 'projects/nowhere/x/01.png')).toThrow(/screenshot "projects\/nowhere\/x\/01\.png" not found/);
  });
});

describe('resolveScreenshot', () => {
  it('names the file when the glob has no such image', () => {
    expect(() => resolveScreenshot('projects/nowhere/x/01.png')).toThrow(/projects\/nowhere\/x\/01\.png/);
  });
});

// --- build output -------------------------------------------------------------------------------------------------

interface Node {
  nodeName: string;
  attrs?: { name: string; value: string }[];
  childNodes?: Node[];
  value?: string;
}
const attr = (n: Node, name: string) => n.attrs?.find((a) => a.name === name)?.value;
const walk = (n: Node, visit: (n: Node) => void) => {
  visit(n);
  n.childNodes?.forEach((c) => walk(c, visit));
};
const all = (root: Node, pred: (n: Node) => boolean) => {
  const found: Node[] = [];
  walk(root, (n) => pred(n) && found.push(n));
  return found;
};
const el = (root: Node, name: string) => all(root, (n) => n.nodeName === name);
const byId = (root: Node, id: string) => all(root, (n) => attr(n, 'id') === id)[0];

const SITE_E2E = fileURLToPath(new URL('../fixtures/site-e2e/', import.meta.url));
let out = '';
let buildSeconds = 0;
const page = (path: string): Node => parse(readFileSync(join(out, path, 'index.html'), 'utf8')) as unknown as Node;

beforeAll(async () => {
  // Inside the repo (gitignored): Astro renames between its cache and the out dir, which fails across devices.
  await mkdir('test-results', { recursive: true });
  out = await mkdtemp(join('test-results', 'screenshots-build-'));
  out = join(process.cwd(), out);
  // The content gate stays silent under Vitest, so the child must not look like Vitest.
  const { VITEST: _vitest, ...env } = process.env;
  const started = Date.now();
  const script = `const { build } = await import('astro'); await build({ root: process.cwd(), outDir: process.argv[1] });`;
  const result = spawnSync(process.execPath, ['--input-type=module', '-e', script, out], {
    encoding: 'utf8',
    env: { ...env, NESSY_CONTENT_DIR: SITE_E2E, NESSY_STRICT: '1', NESSY_ALLOW_SAMPLES: '0' },
  });
  buildSeconds = (Date.now() - started) / 1000;
  if (result.status !== 0) throw new Error(`build failed:\n${result.stdout}\n${result.stderr}`);
}, 240_000);
afterAll(async () => {
  if (out !== '') await rm(out, { recursive: true, force: true });
});

describe('screenshots in the built site-e2e', () => {
  it('renders section#sec-w-shots with one optimised picture per screenshot, in order, with caption alt', () => {
    const doc = page('ffxiv/loch-lantern');
    const section = byId(doc, 'sec-w-shots');
    expect(section).toBeDefined();
    expect(attr(section as Node, 'aria-labelledby')).toBe('w-shots');
    const pictures = el(section as Node, 'picture');
    expect(pictures).toHaveLength(3);
    const alts = pictures.map((p) => attr(el(p, 'img')[0] as Node, 'alt'));
    expect(alts).toEqual(['Hunt marks glowing on the minimap', 'Settings window', 'Zone overlay']);
    for (const p of pictures) {
      const img = el(p, 'img')[0] as Node;
      expect(Number(attr(img, 'width'))).toBeGreaterThan(0);
      expect(Number(attr(img, 'height'))).toBeGreaterThan(0);
      expect(attr(img, 'loading')).toBe('lazy');
      expect(attr(img, 'decoding')).toBe('async');
      const types = el(p, 'source').map((s) => attr(s, 'type'));
      expect(types).toEqual(expect.arrayContaining(['image/avif', 'image/webp']));
      for (const s of el(p, 'source')) expect(attr(s, 'srcset')).toMatch(/480w.*960w.*1440w|480w, .*960w/s);
    }
    expect(el(section as Node, 'figcaption').map((f) => (f.childNodes?.[0]?.value ?? ''))).toEqual(alts);
  });

  it('puts the window after the layout windows and before the description', () => {
    const html = readFileSync(join(out, 'ffxiv/loch-lantern/index.html'), 'utf8');
    const at = (id: string) => html.indexOf(`id="sec-w-${id}"`);
    expect(at('inst')).toBeLessThan(at('shots'));
    expect(at('shots')).toBeLessThan(at('desc'));
  });

  it('has no screenshots window for a project without screenshots', () => {
    expect(byId(page('ffxiv/heather-hotbar'), 'sec-w-shots')).toBeUndefined();
  });

  it('shows a web tool\'s screenshot in the screenshots window like any other project, with no preview window', () => {
    const doc = page('ffxiv/gorse-gearplanner');
    expect(byId(doc, 'sec-w-prev')).toBeUndefined();
    const win = byId(doc, 'sec-w-shots') as Node;
    expect(el(win, 'picture')).toHaveLength(1);
    const img = el(win, 'img')[0] as Node;
    expect(attr(img, 'alt')).toBe('The gear planner with a job selected and melds shown');
    expect(attr(img, 'loading')).toBe('lazy');
  });

  it('links each thumbnail to a built image of at most 1440 px, and the dialog loads nothing until opened', async () => {
    const doc = page('ffxiv/loch-lantern');
    const links = all(doc, (n) => n.nodeName === 'a' && attr(n, 'data-shot') !== undefined);
    expect(links).toHaveLength(3);
    for (const link of links) {
      const href = attr(link, 'href') as string;
      expect(href).toMatch(/^\/_astro\/.+\.webp$/);
      expect(existsSync(join(out, href)), href).toBe(true);
      expect((await sharp(join(out, href)).metadata()).width, href).toBeLessThanOrEqual(1440);
    }
    const dialog = el(doc, 'dialog');
    expect(dialog).toHaveLength(1);
    expect(all(dialog[0] as Node, (n) => n.nodeName === 'img' && attr(n, 'src') !== undefined)).toHaveLength(0);
  });

  it('wrote avif and webp variants under _astro, and each 960 px variant is at most 200 KB', () => {
    const files = readdirSync(join(out, '_astro'));
    expect(files.some((f) => f.endsWith('.avif'))).toBe(true);
    expect(files.some((f) => f.endsWith('.webp'))).toBe(true);
    const html = readFileSync(join(out, 'ffxiv/loch-lantern/index.html'), 'utf8');
    const urls = [...html.matchAll(/(\/_astro\/[^\s",]+) 960w/g)].map((m) => m[1] as string);
    expect(urls.length).toBeGreaterThanOrEqual(6);
    for (const url of urls) {
      const file = join(out, url);
      expect(existsSync(file), url).toBe(true);
      expect(statSync(file).size, url).toBeLessThanOrEqual(200 * 1024);
    }
  });

  it('builds the whole site (clean cache not guaranteed) well inside the 60 s budget', () => {
    console.log(`site-e2e build with image processing: ${buildSeconds.toFixed(1)} s`);
    expect(buildSeconds).toBeLessThan(60);
  });
});
