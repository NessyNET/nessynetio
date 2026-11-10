// Project lint rules (design section 4 "Lint"). Pattern-based by design; no ESLint.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const LINK_COMPONENT = 'src/components/Link.astro';
const CONTENT_CORE = 'src/lib/content/';
const TEXT_EXTENSIONS = /\.(astro|ts|mjs|js|css|json|md|html)$/;

const lineAt = (text, index) => text.slice(0, index).split('\n').length;

// Yields { index, ...match } for every match of a global regex.
function* matches(regex, text) {
  for (const m of text.matchAll(regex)) yield m;
}

// CSS text to scan for L6, with its offset into the file (whole file for .css, <style> bodies for .astro).
function cssRegions(path, text) {
  if (path.endsWith('.css')) return [{ offset: 0, css: text }];
  if (!path.endsWith('.astro')) return [];
  return [...matches(/<style\b[^>]*>([\s\S]*?)<\/style>/g, text)].map((m) => ({
    offset: m.index + m[0].indexOf(m[1]),
    css: m[1],
  }));
}

const RULES = [
  {
    id: 'L1',
    message: 'set:html is not allowed in src/',
    find: (_path, text) => [...matches(/\bset:html\b/g, text)].map((m) => m.index),
  },
  {
    id: 'L2',
    message: 'style= attributes are not allowed in .astro files; use a scoped <style> block',
    find: (path, text) =>
      path.endsWith('.astro')
        ? [...matches(/<[A-Za-z][^<>]*?\sstyle\s*=/g, text)].map((m) => m.index)
        : [],
  },
  {
    id: 'L3',
    message: 'content core (src/lib/content/) must not import astro: modules',
    find: (path, text) =>
      path.startsWith(CONTENT_CORE)
        ? [...matches(/\b(?:from|import)\s*\(?\s*['"]astro:/g, text)].map((m) => m.index)
        : [],
  },
  {
    id: 'L4',
    message: 'raw external <a> (absolute href or target=) is only allowed in src/components/Link.astro',
    find: (path, text) =>
      !path.endsWith('.astro') || path === LINK_COMPONENT
        ? []
        : [...matches(/<a\b[^>]*>/g, text)]
            .filter((m) => /\bhref\s*=\s*["']?https?:/i.test(m[0]) || /\btarget\s*=/.test(m[0]))
            .map((m) => m.index),
  },
  {
    id: 'L5',
    message: 'is:inline scripts must have type="application/json"',
    find: (_path, text) =>
      [...matches(/<script\b[^>]*>/g, text)]
        .filter((m) => /\bis:inline\b/.test(m[0]) && !/\btype\s*=\s*["']?application\/json["']?/.test(m[0]))
        .map((m) => m.index),
  },
  {
    id: 'L6',
    message: 'CSS content: with text is read by screen readers; use aria-hidden markup',
    find: (path, text) =>
      cssRegions(path, text).flatMap(({ offset, css }) =>
        [...matches(/\bcontent\s*:\s*(["'])(?!\1)[\s\S]*?\1/g, css)].map((m) => offset + m.index),
      ),
  },
];

/** @param {{ path: string, text: string }[]} files
 *  @returns {{ path: string, line: number, rule: string, message: string }[]} */
export function lintFiles(files) {
  const hits = [];
  for (const { path, text } of files) {
    for (const rule of RULES) {
      for (const index of rule.find(path, text)) {
        hits.push({ path, line: lineAt(text, index), rule: rule.id, message: rule.message });
      }
    }
  }
  return hits;
}

function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return TEXT_EXTENSIONS.test(entry.name) ? [full] : [];
  });
}

function main() {
  const root = process.cwd();
  const files = walk(join(root, 'src')).map((full) => ({
    path: relative(root, full).split(sep).join('/'),
    text: readFileSync(full, 'utf8'),
  }));
  const hits = lintFiles(files);
  for (const h of hits) console.error(`${h.path}:${h.line} ${h.rule} ${h.message}`);
  process.exit(hits.length > 0 ? 1 : 0);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
