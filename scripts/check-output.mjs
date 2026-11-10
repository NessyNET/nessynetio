// Output checks over the built HTML (029; design 3.4 step 4, 5.2 "Output"): the brief's "checked by searching the
// built output" criteria as findings. `npm run check-output -- --dist dist [--allow-samples] [--site <url>]`.
// Node strips the types of the imported .ts module.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { NOTICE_LABELS } from '../src/lib/strings.ts';

export const USAGE = 'Usage: npm run check-output -- --dist <dir> [--allow-samples] [--site <url>]';

/** @typedef {{ rule: string, file: string, selector: string, message: string }} Finding */
/** @typedef {import('parse5').DefaultTreeAdapterMap['element']} El */
/** @typedef {import('parse5').DefaultTreeAdapterMap['node']} Node */

const NEW_TAB_TEXT = '(opens in new tab)';
const ARROW = '↗';
const SAMPLE_MARKER = '[sample]';
const SAMPLE_PATH = '.sample.';
const DEV_ONLY_TEXT = 'Not distributed yet';
/** Hosts the chrome and the landing page must not link to (R5). Judged on the href host only: names may mention them. */
const FORBIDDEN_OWNER_HOST = /discord|ko-?fi|gitlab|bitbucket|codeberg|sr\.ht|sourcehut|gitea/i;
const NOTICE_LABEL_AT_START = new RegExp(`^(${Object.values(NOTICE_LABELS).join('|')})( [^:]{0,40})?:`);

// --- Tree helpers

/** @param {Node} node @returns {node is El} */
const isElement = (node) => 'tagName' in node;
/** @param {El} el @param {string} name */
const attr = (el, name) => el.attrs.find((a) => a.name === name)?.value;
/** @param {Node} node @returns {Node[]} */
const kids = (node) => ('childNodes' in node ? node.childNodes : []);

/** @param {Node} node @param {(el: El) => void} visit */
function eachElement(node, visit) {
  for (const child of kids(node)) {
    if (!isElement(child)) continue;
    visit(child);
    eachElement(child, visit);
  }
}

/** @param {Node} node @returns {string} */
function textOf(node) {
  if (node.nodeName === '#text') return /** @type {{ value: string }} */ (node).value;
  return kids(node).map(textOf).join('');
}

/** @param {Node} node @param {(text: string, parent: El) => void} visit @param {El} [parent] */
function eachText(node, visit, parent) {
  for (const child of kids(node)) {
    if (child.nodeName === '#text' && parent !== undefined) visit(/** @type {{ value: string }} */ (child).value, parent);
    else if (isElement(child)) eachText(child, visit, child);
  }
}

/** @param {El} el @returns {string} */
function selectorOf(el) {
  const key = ['href', 'src', 'id', 'name', 'property', 'rel']
    .map((n) => [n, attr(el, n)])
    .find(([, v]) => v !== undefined);
  return key === undefined ? el.tagName : `${el.tagName}[${key[0]}="${key[1]}"]`;
}

/** @param {El} el @param {string} cls */
const hasClass = (el, cls) => (attr(el, 'class') ?? '').split(/\s+/).includes(cls);

// --- Rules; each takes one parsed page and reports through `add(rule, el, message)`.

/** @param {Node} doc @param {string} siteHost @param {(rule: string, el: El, message: string) => void} add */
function checkLinks(doc, siteHost, add) {
  eachElement(doc, (el) => {
    if (el.tagName !== 'a') return;
    const href = attr(el, 'href') ?? '';
    const text = textOf(el);
    const target = attr(el, 'target');
    const hasArrow = text.includes(ARROW);
    const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();
    if (scheme === 'mailto' && target !== undefined) add('O1', el, 'mailto: links stay in the same tab (no target)');
    const web = scheme === 'http' || scheme === 'https';
    const host = web ? new URL(href).host : undefined;
    if (web && host !== siteHost && target !== '_blank') add('O1', el, `external link to ${host} needs target="_blank"`);
    if (web && host === siteHost && hasArrow) add('O1', el, `link to the site host must not have ${ARROW}`);
    if (hasArrow && target !== '_blank') add('O1', el, `a link with ${ARROW} needs target="_blank"`);
    if (target !== '_blank') return;
    const rel = (attr(el, 'rel') ?? '').split(/\s+/);
    if (!rel.includes('noopener') || !rel.includes('noreferrer')) add('O1', el, 'target="_blank" needs rel with noopener and noreferrer');
    let hiddenArrow = false;
    eachElement(el, (child) => {
      if (attr(child, 'aria-hidden') === 'true' && textOf(child).includes(ARROW)) hiddenArrow = true;
    });
    if (!hiddenArrow) add('O1', el, `target="_blank" needs an aria-hidden child containing ${ARROW}`);
    if (!text.includes(NEW_TAB_TEXT)) add('O1', el, `target="_blank" needs the text "${NEW_TAB_TEXT}"`);
  });
}

/** @param {Node} doc @param {string} file @param {(rule: string, el: El, message: string) => void} add */
function checkOwnerLinks(doc, file, add) {
  /** @param {El} scope */
  const scan = (scope) =>
    eachElement(scope, (el) => {
      if (el.tagName !== 'a') return;
      const href = attr(el, 'href') ?? '';
      const host = /^https?:/i.test(href) ? new URL(href).hostname : '';
      if (FORBIDDEN_OWNER_HOST.test(host)) add('O2', el, `owner links are GitHub and mail only; found a link to ${host}`);
    });
  eachElement(doc, (el) => {
    if (el.tagName === 'header' && hasClass(el, 'tmux')) scan(el);
    else if (el.tagName === 'footer' && hasClass(el, 'statusline')) scan(el);
    else if (el.tagName === 'body' && file === 'index.html') scan(el);
    else if (attr(el, 'id') === 'sec-w-links') {
      /** @type {string[]} */
      const hosts = [];
      eachElement(el, (a) => {
        if (a.tagName !== 'a') return;
        const href = attr(a, 'href') ?? '';
        hosts.push(href.startsWith('mailto:') ? 'mailto' : /^https?:/.test(href) ? new URL(href).host : href);
      });
      if (hosts.length !== 2 || !hosts.includes('mailto') || !hosts.includes('github.com')) add('O2', el, `links.txt must hold exactly GitHub and mail; found [${hosts.join(', ')}]`);
    }
  });
}

const REQUIRED_META = [
  ['name', 'description'],
  ['property', 'og:title'],
  ['property', 'og:description'],
  ['property', 'og:url'],
  ['property', 'og:image'],
  ['property', 'og:image:width'],
  ['property', 'og:image:height'],
  ['property', 'og:image:alt'],
  ['name', 'twitter:card'],
];

/**
 * @param {Node} doc @param {string} siteHost @param {(rule: string, el: El, message: string) => void} add
 * @returns {{ title: string | undefined, canonical: string | undefined, head: El | undefined }}
 */
function checkMeta(doc, siteHost, add) {
  /** @type {El | undefined} */
  let head;
  /** @type {El[]} */
  const titles = [];
  /** @type {El[]} */
  const canonicals = [];
  /** @type {El[]} */
  const metas = [];
  eachElement(doc, (el) => {
    if (el.tagName === 'head') head = el;
    else if (el.tagName === 'title') titles.push(el);
    else if (el.tagName === 'meta') metas.push(el);
    else if (el.tagName === 'link' && attr(el, 'rel') === 'canonical') canonicals.push(el);
  });
  const anchor = head ?? /** @type {El} */ (doc.childNodes.find(isElement));
  if (titles.length !== 1) add('O3', anchor, `expected one <title>, found ${titles.length}`);
  else if (textOf(titles[0] ?? anchor).trim() === '') add('O3', titles[0] ?? anchor, '<title> is empty');
  for (const [key, name] of REQUIRED_META) {
    const found = metas.find((m) => attr(m, key) === name);
    if (found === undefined || (attr(found, 'content') ?? '').trim() === '') add('O3', anchor, `missing or empty meta ${key}="${name}"`);
  }
  let canonical;
  if (canonicals.length !== 1) add('O3', anchor, `expected one canonical link, found ${canonicals.length}`);
  else {
    canonical = attr(canonicals[0] ?? anchor, 'href') ?? '';
    let url;
    try {
      url = new URL(canonical);
    } catch {
      add('O3', canonicals[0] ?? anchor, `canonical "${canonical}" is not an absolute URL`);
    }
    if (url !== undefined && (url.host !== siteHost || url.search !== '' || url.hash !== '')) {
      add('O3', canonicals[0] ?? anchor, `canonical "${canonical}" must be on ${siteHost} and carry no query or fragment`);
    }
  }
  return { title: titles[0] === undefined ? undefined : textOf(titles[0]).trim(), canonical, head: anchor };
}

/** @param {Node} doc @param {(rule: string, el: El, message: string) => void} add */
function checkNoticeLabels(doc, add) {
  eachElement(doc, (el) => {
    if (el.tagName === 'a' && NOTICE_LABEL_AT_START.test(textOf(el).trim())) add('O4', el, 'a notice label is never a link');
  });
}

/** @param {Node} doc @param {(rule: string, el: El, message: string) => void} add */
function checkSamples(doc, add) {
  eachElement(doc, (el) => {
    for (const name of ['src', 'srcset', 'href']) {
      if ((attr(el, name) ?? '').includes(SAMPLE_PATH)) add('O5', el, `${name} points at a sample file`);
    }
  });
  eachText(doc, (text, parent) => {
    if (text.includes(SAMPLE_MARKER)) add('O5', parent, `text contains ${SAMPLE_MARKER}`);
    if (text.includes(DEV_ONLY_TEXT)) add('O7', parent, `dev-only text "${DEV_ONLY_TEXT}"`);
  });
}

/** @param {Node} doc @param {(rule: string, el: El, message: string) => void} add */
function checkCsp(doc, add) {
  eachElement(doc, (el) => {
    if (el.tagName === 'script' && attr(el, 'src') === undefined && !/json$/i.test(attr(el, 'type') ?? '')) add('O6', el, 'inline script (only type=application/json is allowed)');
    if (el.tagName === 'style') add('O6', el, 'inline <style> element');
    if (attr(el, 'style') !== undefined) add('O6', el, 'style attribute');
    for (const { name } of el.attrs) if (name.length > 2 && name.startsWith('on')) add('O6', el, `inline event handler ${name}`);
  });
}

// --- Entry points

/** @param {string} dir @returns {string[]} */
function htmlFiles(dir) {
  /** @type {string[]} */
  const found = [];
  for (const name of readdirSync(dir).sort()) {
    if (name.startsWith('.')) continue;
    const path = join(dir, name);
    if (statSync(path).isDirectory()) found.push(...htmlFiles(path));
    else if (name.endsWith('.html')) found.push(path);
  }
  return found;
}

/**
 * @param {{ distDir: string, siteUrl: string, samplesAllowed: boolean }} options
 * @returns {Finding[]}
 */
export function checkOutput({ distDir, siteUrl, samplesAllowed }) {
  const siteHost = new URL(siteUrl).host;
  /** @type {Finding[]} */
  const findings = [];
  const titles = new Map();
  const canonicals = new Map();
  for (const path of htmlFiles(distDir)) {
    const file = relative(distDir, path).split('\\').join('/');
    const doc = parse(readFileSync(path, 'utf8'));
    /** @type {(rule: string, el: El, message: string) => void} */
    const add = (rule, el, message) => findings.push({ rule, file, selector: selectorOf(el), message });
    checkLinks(doc, siteHost, add);
    checkOwnerLinks(doc, file, add);
    const { title, canonical, head } = checkMeta(doc, siteHost, add);
    for (const [seen, value, what] of [[titles, title, 'title'], [canonicals, canonical, 'canonical']]) {
      if (value === undefined || value === '' || head === undefined) continue;
      const first = seen.get(value);
      if (first === undefined) seen.set(value, file);
      else add('O3', head, `${what} "${value}" is already used by ${first}`);
    }
    checkNoticeLabels(doc, add);
    if (!samplesAllowed) checkSamples(doc, add);
    checkCsp(doc, add);
  }
  return findings;
}

/** @param {string[]} argv @returns {{ dist: string, site: string | undefined, allowSamples: boolean }} */
export function parseArgs(argv) {
  const args = { dist: '', site: undefined, allowSamples: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--allow-samples') args.allowSamples = true;
    else if (arg === '--dist' || arg === '--site') {
      const value = argv[++i];
      if (value === undefined || value.startsWith('--')) throw new Error(`${arg} requires a value`);
      if (arg === '--dist') args.dist = resolve(value);
      else args.site = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (args.dist === '') throw new Error('--dist is required');
  return args;
}

/**
 * The site URL: `--site`, else `site` in `<dist>/.build-meta.json`, else the origin of the landing page's canonical
 * (until the build writes the meta file, task 030).
 * @param {string} dist @param {string | undefined} site @returns {string}
 */
function siteUrlOf(dist, site) {
  if (site !== undefined) return site;
  try {
    const meta = JSON.parse(readFileSync(join(dist, '.build-meta.json'), 'utf8'));
    if (typeof meta.site === 'string') return meta.site;
  } catch {
    // no meta file: fall through
  }
  const canonical = /<link rel="canonical" href="([^"]+)"/.exec(readFileSync(join(dist, 'index.html'), 'utf8'))?.[1];
  if (canonical === undefined) throw new Error('cannot tell the site URL: pass --site');
  return new URL(canonical).origin;
}

function main() {
  let findings;
  try {
    const args = parseArgs(process.argv.slice(2));
    findings = checkOutput({ distDir: args.dist, siteUrl: siteUrlOf(args.dist, args.site), samplesAllowed: args.allowSamples });
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : error}\n${USAGE}`);
    process.exit(2);
  }
  for (const f of findings) console.log(`${f.rule} ${f.file} ${f.selector} ${f.message}`);
  console.log(`${findings.length} output finding${findings.length === 1 ? '' : 's'}`);
  process.exit(findings.length === 0 ? 0 : 1);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
