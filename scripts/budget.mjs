// Performance budget over the built output (design 5.1, R18): per page, the gzip -9 bytes of the HTML plus the
// same-origin CSS and JS it references (what `gzip_static` serves), woff2 weight, 960 w screenshot variants, OG images.
// `npm run budget -- --dist dist`: exit 1 over a hard limit.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { gzip9 } from './precompress.mjs';

export const USAGE = 'Usage: npm run budget -- --dist <dir>';

const KB = 1024;
/** Hard limit (R18) and per-type targets, in bytes. */
const TOTAL_LIMIT = 100 * KB;
const TARGETS = { html: 30 * KB, css: 20 * KB, js: 15 * KB };
const FONT_LIMIT = 100 * KB;
const SCREENSHOT_WARN = 200 * KB;
const SCREENSHOT_WIDTH = '960w';
const OG_LIMIT = 300 * KB;

/** @typedef {{ file: string, html: number, css: number, js: number, total: number, fonts: number }} PageRow */
/** @typedef {{ pages: PageRow[], warnings: string[], failures: string[] }} BudgetReport */
/** @typedef {import('parse5').DefaultTreeAdapterMap['element']} El */
/** @typedef {import('parse5').DefaultTreeAdapterMap['node']} Node */

/** @param {Node} node @param {(el: El) => void} visit */
function eachElement(node, visit) {
  for (const child of 'childNodes' in node ? node.childNodes : []) {
    if (!('tagName' in child)) continue;
    visit(child);
    eachElement(child, visit);
  }
}
/** @param {El} el @param {string} name */
const attr = (el, name) => el.attrs.find((a) => a.name === name)?.value;
const kb = (/** @type {number} */ bytes) => `${(bytes / KB).toFixed(1)} KB`;

/** @param {string} dir @param {(path: string) => boolean} keep @returns {string[]} */
function filesUnder(dir, keep) {
  /** @type {string[]} */
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...filesUnder(path, keep));
    else if (keep(path)) found.push(path);
  }
  return found;
}

/** A same-origin reference as a path inside `distDir`, or undefined for cross-origin and non-file URLs. */
function localPath(distDir, pageDir, ref) {
  if (/^([a-z][a-z0-9+.-]*:|\/\/)/i.test(ref)) return undefined;
  const clean = ref.split(/[?#]/)[0] ?? '';
  return ref.startsWith('/') ? join(distDir, clean) : resolve(pageDir, clean);
}

/** @param {string} distDir @returns {BudgetReport} */
export function measureBudget(distDir) {
  /** @type {BudgetReport} */
  const report = { pages: [], warnings: [], failures: [] };
  const gzSize = new Map();
  /** @param {string} path */
  const gzBytes = (path) => {
    if (!gzSize.has(path)) gzSize.set(path, gzip9(readFileSync(path)).length);
    return gzSize.get(path);
  };

  for (const pagePath of filesUnder(distDir, (p) => p.endsWith('.html'))) {
    const file = relative(distDir, pagePath).split('\\').join('/');
    const doc = parse(readFileSync(pagePath, 'utf8'));
    const pageDir = dirname(pagePath);
    const sheets = new Set();
    const scripts = new Set();
    const fonts = new Set();
    const variants = new Set();
    eachElement(doc, (el) => {
      const rel = attr(el, 'rel');
      const href = attr(el, 'href');
      if (el.tagName === 'link' && rel === 'stylesheet' && href !== undefined) sheets.add(href);
      if (el.tagName === 'link' && rel === 'preload' && attr(el, 'as') === 'font' && href !== undefined) fonts.add(localPath(distDir, pageDir, href));
      if (el.tagName === 'script' && attr(el, 'src') !== undefined) scripts.add(attr(el, 'src'));
      for (const candidate of (attr(el, 'srcset') ?? '').split(',')) {
        const [ref, descriptor] = candidate.trim().split(/\s+/);
        if (ref !== undefined && descriptor === SCREENSHOT_WIDTH) variants.add(ref);
      }
    });

    /** @param {Set<string>} refs @returns {number} */
    const sum = (refs) => {
      let total = 0;
      for (const ref of refs) {
        const path = localPath(distDir, pageDir, ref);
        if (path === undefined) continue;
        if (!existsSync(path)) report.failures.push(`${file}: referenced file ${ref} is missing from the build`);
        else total += gzBytes(path);
      }
      return total;
    };
    const css = sum(sheets);
    const js = sum(scripts);
    for (const sheet of sheets) {
      const path = localPath(distDir, pageDir, sheet);
      if (path === undefined || !existsSync(path)) continue;
      for (const m of readFileSync(path, 'utf8').matchAll(/url\(\s*["']?([^"')\s]+\.woff2)/g)) fonts.add(localPath(distDir, dirname(path), m[1] ?? ''));
    }
    let fontBytes = 0;
    for (const path of fonts) if (path !== undefined && existsSync(path)) fontBytes += statSync(path).size;
    const html = gzBytes(pagePath);
    const total = html + css + js;
    report.pages.push({ file, html, css, js, total, fonts: fontBytes });

    if (total > TOTAL_LIMIT) report.failures.push(`${file}: HTML + CSS + JS is ${kb(total)} gzipped, over the 100 KB hard limit`);
    for (const [label, key] of [['HTML', 'html'], ['CSS', 'css'], ['JS', 'js']]) {
      const value = { html, css, js }[key];
      if (value > TARGETS[key]) report.warnings.push(`${file}: ${label} is ${kb(value)} gzipped, over the ${TARGETS[key] / KB} KB target`);
    }
    if (fontBytes > FONT_LIMIT) report.failures.push(`${file}: woff2 font files total ${kb(fontBytes)}, over the 100 KB limit`);
    for (const ref of variants) {
      const path = localPath(distDir, pageDir, ref);
      if (path !== undefined && existsSync(path) && statSync(path).size > SCREENSHOT_WARN) {
        report.warnings.push(`${file}: screenshot variant ${ref} (960 w) is ${kb(statSync(path).size)}, over 200 KB`);
      }
    }
  }

  const ogDir = join(distDir, 'og');
  if (existsSync(ogDir)) {
    for (const path of filesUnder(ogDir, (p) => p.endsWith('.png'))) {
      const size = statSync(path).size;
      if (size > OG_LIMIT) report.failures.push(`${relative(distDir, path).split('\\').join('/')}: OG image is ${kb(size)}, over the 300 KB limit`);
    }
  }
  return report;
}

/** @param {BudgetReport} report @returns {string} */
export function formatBudget(report) {
  const width = Math.max(4, ...report.pages.map((p) => p.file.length));
  const cell = (/** @type {string} */ s) => s.padStart(9);
  const lines = [`${'page'.padEnd(width)}${['html', 'css', 'js', 'total'].map(cell).join('')}   (KB, gzip -9)`];
  for (const p of report.pages) lines.push(`${p.file.padEnd(width)}${[p.html, p.css, p.js, p.total].map((n) => cell((n / KB).toFixed(1))).join('')}`);
  for (const w of report.warnings) lines.push(`WARNING ${w}`);
  for (const f of report.failures) lines.push(`ERROR ${f}`);
  lines.push(
    report.failures.length === 0
      ? `budget: ok (${report.pages.length} pages, ${report.warnings.length} warnings)`
      : `budget: FAILED (${report.failures.length} failures, ${report.warnings.length} warnings)`,
  );
  return lines.join('\n');
}

function main() {
  const argv = process.argv.slice(2);
  const at = argv.indexOf('--dist');
  const dist = at === -1 ? undefined : argv[at + 1];
  if (dist === undefined || argv.length !== 2 || !existsSync(dist)) {
    console.error(USAGE);
    process.exit(2);
  }
  const report = measureBudget(resolve(dist));
  console.log(formatBudget(report));
  process.exit(report.failures.length === 0 ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
