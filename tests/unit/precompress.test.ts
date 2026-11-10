import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gunzipSync } from 'node:zlib';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { precompress } from '../../scripts/precompress.mjs';

let dist: string;
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'precompress-'));
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

const big = (word: string) => word.repeat(Math.ceil(2000 / word.length));
const put = (rel: string, content: string | Buffer) => {
  const path = join(dist, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
  return path;
};

describe('precompress', () => {
  it('writes <file>.gz for text formats from 1 KB up, and it decompresses to the same bytes', () => {
    const files = ['index.html', 'a/b/index.html', '_astro/site.css', '_astro/app.js', 'data.json', 'sitemap.xml', 'logo.svg', 'robots.txt'];
    for (const f of files) put(f, big('<p>hello</p>'));
    const written = precompress(dist);
    expect(written.sort()).toEqual(files.map((f) => `${f}.gz`).sort());
    for (const f of files) expect(gunzipSync(readFileSync(join(dist, `${f}.gz`))).toString()).toBe(big('<p>hello</p>'));
  });

  it('skips images, fonts and other already compressed formats', () => {
    for (const f of ['a.png', 'a.webp', 'a.avif', 'a.woff2', 'a.gz', 'a.jpg']) put(f, Buffer.alloc(4096, 1));
    expect(precompress(dist)).toEqual([]);
    expect(existsSync(join(dist, 'a.png.gz'))).toBe(false);
  });

  it('skips files under 1 KB, and takes a file of exactly 1 KB', () => {
    put('small.html', 'x'.repeat(1023));
    put('edge.html', 'x'.repeat(1024));
    expect(precompress(dist)).toEqual(['edge.html.gz']);
  });

  it('uses the maximum compression level (smaller than the default) and is deterministic', () => {
    const text = Array.from({ length: 4000 }, (_, i) => `row ${i % 97} <td>${i % 13}</td>`).join('\n');
    put('index.html', text);
    precompress(dist);
    const first = readFileSync(join(dist, 'index.html.gz'));
    precompress(dist);
    expect(readFileSync(join(dist, 'index.html.gz')).equals(first)).toBe(true);
    expect(first.length).toBeLessThan(gunzipSync(first).length / 3);
    expect(first[8]).toBe(2); // gzip header XFL 2: slowest compression, i.e. level 9
  });
});
