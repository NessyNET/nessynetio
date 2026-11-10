import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatBudget, measureBudget } from '../../scripts/budget.mjs';

let dist: string;
beforeEach(() => {
  dist = mkdtempSync(join(tmpdir(), 'budget-'));
});
afterEach(() => rmSync(dist, { recursive: true, force: true }));

const KB = 1024;
// Base64 of random bytes compresses to about 75 %, so `kb` of it gzips to roughly 0.75 * kb.
const noise = (kb: number) => randomBytes(Math.ceil((kb * KB * 3) / 4)).toString('base64').slice(0, kb * KB);
const put = (rel: string, content: string | Buffer) => {
  const path = join(dist, rel);
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, content);
};
const page = (body: string, head = '') => `<!DOCTYPE html><html><head><title>t</title>${head}</head><body>${body}</body></html>`;

describe('measureBudget: the hard limit', () => {
  it('passes a small page and reports its gzip bytes for html, css and js', () => {
    put('_astro/a.css', 'a{color:red}'.repeat(200));
    put('_astro/a.js', 'console.log(1);'.repeat(200));
    put('index.html', page('<p>hi</p>', '<link rel="stylesheet" href="/_astro/a.css"><script type="module" src="/_astro/a.js"></script>'));
    const report = measureBudget(dist);
    expect(report.failures).toEqual([]);
    expect(report.warnings).toEqual([]);
    const [row] = report.pages;
    expect(row?.file).toBe('index.html');
    expect(row?.css).toBeGreaterThan(0);
    expect(row?.js).toBeGreaterThan(0);
    expect(row?.total).toBe((row?.html ?? 0) + (row?.css ?? 0) + (row?.js ?? 0));
  });

  it('fails a page whose html, css and js together exceed 100 KB gzipped, naming the page', () => {
    put('_astro/a.css', noise(70));
    put('_astro/a.js', noise(70));
    put('big/index.html', page('<p>x</p>', '<link rel="stylesheet" href="/_astro/a.css"><script src="/_astro/a.js"></script>'));
    const report = measureBudget(dist);
    expect(report.failures).toHaveLength(1);
    expect(report.failures[0]).toMatch(/^big\/index\.html: .*100 KB/);
  });

  it('counts a stylesheet referenced twice once per page, and again on every other page that uses it', () => {
    put('_astro/a.css', noise(70));
    const head = '<link rel="stylesheet" href="/_astro/a.css"><link rel="stylesheet" href="/_astro/a.css">';
    put('one/index.html', page('<p>1</p>', head));
    put('two/index.html', page('<p>2</p>', head));
    const report = measureBudget(dist);
    const css = report.pages.map((p) => p.css);
    expect(css[0]).toBe(css[1]);
    expect(css[0]).toBeLessThan(60 * KB); // once, not twice (70 KB of noise is about 52 KB gzipped)
    expect(report.failures).toEqual([]);
  });

  it('ignores cross-origin stylesheets and scripts', () => {
    put('index.html', page('<p>hi</p>', '<link rel="stylesheet" href="https://cdn.example/x.css"><script src="//cdn.example/x.js"></script>'));
    const [row] = measureBudget(dist).pages;
    expect([row?.css, row?.js]).toEqual([0, 0]);
  });

  it('reports a missing referenced file as a failure', () => {
    put('index.html', page('<p>hi</p>', '<link rel="stylesheet" href="/_astro/gone.css">'));
    expect(measureBudget(dist).failures[0]).toMatch(/gone\.css/);
  });
});

describe('measureBudget: targets are warnings only', () => {
  it('warns when html exceeds 30 KB, css 20 KB or js 15 KB gzipped, without failing', () => {
    put('_astro/a.css', noise(30));
    put('_astro/a.js', noise(24));
    put('index.html', page(`<p>${noise(45)}</p>`, '<link rel="stylesheet" href="/_astro/a.css"><script src="/_astro/a.js"></script>'));
    const report = measureBudget(dist);
    expect(report.failures).toEqual([]);
    expect(report.warnings.map((w) => w.split(':')[1]?.trim().split(' ')[0])).toEqual(['HTML', 'CSS', 'JS']);
  });
});

describe('measureBudget: fonts, screenshots and OG images', () => {
  it('fails a page whose woff2 files exceed 100 KB', () => {
    put('_astro/f.woff2', randomBytes(110 * KB));
    put('index.html', page('<p>hi</p>', '<link rel="preload" as="font" type="font/woff2" href="/_astro/f.woff2" crossorigin>'));
    expect(measureBudget(dist).failures[0]).toMatch(/index\.html: .*font/i);
  });

  it('warns about a 960 w screenshot variant over 200 KB, and not about other widths', () => {
    put('_astro/big.webp', randomBytes(210 * KB));
    put('_astro/other.webp', randomBytes(210 * KB));
    put('index.html', page('<img src="/_astro/other.webp" srcset="/_astro/other.webp 480w, /_astro/big.webp 960w">'));
    const { warnings, failures } = measureBudget(dist);
    expect(failures).toEqual([]);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/big\.webp/);
  });

  it('fails an OG image over 300 KB', () => {
    put('og/home.png', randomBytes(310 * KB));
    put('og/ok.png', randomBytes(20 * KB));
    put('index.html', page('<p>hi</p>'));
    const { failures } = measureBudget(dist);
    expect(failures).toHaveLength(1);
    expect(failures[0]).toMatch(/og\/home\.png/);
  });
});

describe('formatBudget and the CLI', () => {
  it('prints a table with one row per page and the verdict last', () => {
    put('a/index.html', page('<p>hi</p>'));
    put('index.html', page('<p>hi</p>'));
    const text = formatBudget(measureBudget(dist));
    expect(text).toMatch(/page\s+html\s+css\s+js\s+total/);
    expect(text).toContain('a/index.html');
    expect(text.trim().split('\n').at(-1)).toMatch(/budget: ok/);
  });

  it('exits 1 over the hard limit, 0 otherwise, and 2 on bad usage', () => {
    const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/budget.mjs', ...args], { encoding: 'utf8' });
    put('index.html', page('<p>hi</p>'));
    expect(run('--dist', dist).status).toBe(0);
    put('_astro/a.css', noise(150));
    put('big/index.html', page('<p>x</p>', '<link rel="stylesheet" href="/_astro/a.css">'));
    const bad = run('--dist', dist);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/budget: FAILED/);
    expect(run().status).toBe(2);
  });
});
