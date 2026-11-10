// The rules table and the rules pass (design 3.5.2, 10.3; ux 7.12 "Validation summary"; ADR 003).
// `applyRules` grades every content problem per mode and returns a copy of the parsed site with the local
// fallbacks applied. All severity decisions live here; shape errors stay in schema.ts and variants.ts.
import { resolve, sep } from 'node:path';
import sharp from 'sharp';
import { resolveLevel, type Diagnostic, type Rule } from './diagnostics.ts';
import { classifyHref } from '../links.ts';
import { CATEGORY_ACCENTS, isCategoryAccent } from '../palette.ts';
import { RESERVED_CATEGORY_IDS } from '../routes.ts';
import type { Located, ParsedProject, ParsedSite } from './load.ts';
import {
  bookmarkSchema,
  bookmarksFileSchema,
  categoriesFileSchema,
  categorySchema,
  groupSchema,
  projectSchema,
  relationSchema,
  siteFileSchema,
  siteSectionSchema,
  tagSchema,
  whoamiSchema,
  type BookmarkData,
  type CategoryData,
  type ProjectData,
  type TagData,
  type WhoamiData,
} from './schema.ts';
import { parseTagline } from './tagline.ts';
import type { Layout } from './model.ts';
import { LAYOUTS, parseDetails, resolveLayout } from './variants.ts';

// --- The table. `local` and `strict` are the levels in each mode; `uxRow` quotes the source row.

const text = (field: string): Rule['message'] => (ctx) => ctx[field] ?? '';

export const RULES: readonly Rule[] = [
  { code: 'schema/required', local: 'error', strict: 'error', uxRow: 'Missing required field (any entity)', message: text('detail') },
  { code: 'schema/type', local: 'error', strict: 'error', uxRow: 'Wrong type, unknown enum value or malformed URL in a field (brief R3; design 10.3 schema/url)', message: text('detail') },
  { code: 'file/unknown-key', local: 'warning', strict: 'error', uxRow: 'Unknown top-level key in any content file (rev 4)', message: (c) => `unknown key '${c['key']}' is ignored` },
  { code: 'category/accent', local: 'error', strict: 'error', uxRow: 'accent: a palette token name (design 3.3: other value = error)', message: (c) => `accent '${c['accent']}' is not one of ${c['allowed']}` },
  { code: 'category/reserved-id', local: 'error', strict: 'error', uxRow: 'Category ids bookmarks, og, _astro, 404, fonts, licenses are reserved (design 3.5.3)', message: (c) => `category id '${c['id']}' is reserved (${c['reserved']})` },
  { code: 'category/id-format', local: 'error', strict: 'error', uxRow: 'category/id-format: category id not lowercase ASCII with - only', message: (c) => `category id '${c['id']}' must be lowercase ASCII letters and digits separated by single '-'` },
  { code: 'category/duplicate-id', local: 'error', strict: 'error', uxRow: 'category/duplicate-id', message: (c) => `category id '${c['id']}' is already used in ${c['first']}` },
  { code: 'category/repo-url', local: 'error', strict: 'error', uxRow: 'repo_url not an absolute https:// URL off the site host (rev 4)', message: (c) => c['detail'] ?? '' },
  { code: 'category/empty', local: 'note', strict: 'note', uxRow: 'Configured category with no projects: NOTE; not published', message: (c) => `category '${c['id']}' has no projects and is not published; set show_empty = true to publish it` },
  { code: 'tag/id-format', local: 'error', strict: 'error', uxRow: 'tag/id-format: tag id not lowercase ASCII with - only', message: (c) => `tag id '${c['id']}' must be lowercase ASCII letters and digits separated by single '-'` },
  { code: 'tag/duplicate', local: 'error', strict: 'error', uxRow: 'tag/duplicate: the same tag id twice within one category', message: (c) => `tag '${c['id']}' is listed twice in category '${c['category']}'` },
  { code: 'project/location', local: 'error', strict: 'error', uxRow: 'Folder or filename does not match category / slug (rev 4)', message: (c) => c['detail'] ?? '' },
  { code: 'project/unknown-category', local: 'error', strict: 'error', uxRow: 'project/unknown-category', message: (c) => `category '${c['category']}' is not defined in categories.toml` },
  { code: 'project/slug-format', local: 'error', strict: 'error', uxRow: 'slug: ^[a-z0-9]+(-[a-z0-9]+)*$ (design 3.3; slugs become URL segments)', message: (c) => `slug '${c['slug']}' must be lowercase ASCII letters and digits separated by single '-'` },
  { code: 'project/duplicate-slug', local: 'error', strict: 'error', uxRow: 'Slug not unique across the site (rev 4)', message: (c) => `slug '${c['slug']}' is already used by ${c['first']}` },
  { code: 'project/unknown-tag', local: 'warning', strict: 'error', uxRow: "Project tag not in its category's config: warning; tag not rendered", message: (c) => `tag '${c['tag']}' is not defined in category '${c['category']}'; it is not rendered` },
  { code: 'project/type-tag-count', local: 'warning', strict: 'error', uxRow: 'project/type-tag-count, zero or several type tags: still rendered (generic layout / first in config order is the type)', message: (c) => c['detail'] ?? '' },
  { code: 'project/too-many-tags', local: 'warning', strict: 'error', uxRow: 'More than 3 non-type tags on a project (rev 4)', message: (c) => `${c['count']} non-type tags; at most 3 are expected` },
  { code: 'project/layout-fallback', local: 'note', strict: 'note', uxRow: 'Type tag id with no layout mapping and no layout (design S10): generic', message: (c) => `type tag '${c['tag']}' has no layout mapping; the generic layout is used (set layout on the tag to choose one)` },
  { code: 'project/version-missing', local: 'error', strict: 'error', uxRow: 'version required on every layout except web (design 3.3)', message: (c) => `version is required for the ${c['layout']} layout` },
  { code: 'project/unknown-detail-key', local: 'warning', strict: 'error', uxRow: 'Unknown key in a category-specific table', message: (c) => `unknown key '${c['key']}' is ignored` },
  { code: 'project/get-none-not-alone', local: 'error', strict: 'error', uxRow: 'project/get-none-not-alone: a none get entry alongside other get entries', message: () => "a 'none' get entry must be the only get entry" },
  { code: 'project/external-get-own-host', local: 'warning', strict: 'warning', uxRow: "'external' get link on nessynet.io: warning; rendered as internal", message: (c) => `external link '${c['url']}' is on the site host; it is rendered as an internal link` },
  { code: 'project/install-without-repo-url', local: 'warning', strict: 'error', sampleExempt: true, uxRow: 'Plugin project with an install get entry, in a category without repo_url (rev 4, R28)', message: (c) => `install entry needs repo_url on category '${c['category']}'; the entry is dropped` },
  { code: 'project/notice-missing', local: 'warning', strict: 'error', uxRow: 'Retired project without a notice date, or get = none without a notice', message: (c) => c['detail'] ?? '' },
  { code: 'project/screenshot-file', local: 'error', strict: 'error', uxRow: 'Screenshot file must exist (design 3.3)', message: (c) => c['detail'] ?? '' },
  { code: 'project/screenshot-caption', local: 'error', strict: 'error', uxRow: 'Screenshot without a caption', message: () => 'caption is required (it is also the alt text)' },
  { code: 'project/screenshot-wide', local: 'warning', strict: 'warning', uxRow: 'Screenshot source wider than 3000 px (design 3.5.2)', message: (c) => `source is ${c['width']} px wide; more than 3000 px is wasteful` },
  { code: 'project/changelog-order', local: 'warning', strict: 'warning', uxRow: 'Changelog not newest first (rev 4)', message: (c) => `changelog entry ${c['date']} is newer than the entry before it; list newest first` },
  { code: 'project/stray-file', local: 'error', strict: 'error', uxRow: 'A .toml file outside projects/<category>/<slug>.toml (design 10.3)', message: () => 'project files must be projects/<category>/<slug>.toml; this file is not read' },
  { code: 'project/orphan-assets', local: 'warning', strict: 'warning', uxRow: 'A projects/<category>/<name>/ folder with no <name>.toml (design 10.3)', message: (c) => `no ${c['name']}.toml beside this folder; its files are not used` },
  { code: 'bookmark/unknown-category', local: 'warning', strict: 'error', uxRow: 'Bookmark unknown category: warning; shown under general', message: (c) => `category '${c['category']}' is not defined; the bookmark is shown under general` },
  { code: 'bookmark/unknown-group', local: 'warning', strict: 'error', uxRow: 'Bookmark unknown group: warning; shown under general', message: (c) => `group '${c['group']}' is not defined; the bookmark is shown under general` },
  { code: 'bookmark/category-and-group', local: 'warning', strict: 'warning', uxRow: 'Bookmark with both category and group: warning; category wins', message: () => 'category and group are both set; category wins and group is ignored' },
  { code: 'bookmark/unknown-relation', local: 'warning', strict: 'error', uxRow: 'Bookmark unknown relation: warning; badge dropped', message: (c) => `relation '${c['relation']}' is not defined; the badge is dropped` },
  { code: 'bookmark/unknown-project', local: 'warning', strict: 'error', uxRow: 'Bookmark unknown project slug: warning; link dropped', message: (c) => `project '${c['slug']}' does not exist; the link is dropped` },
  { code: 'bookmark/own-host', local: 'warning', strict: 'error', uxRow: 'Bookmark URL on nessynet.io', message: (c) => `url '${c['url']}' is on the site host; bookmarks are for other sites` },
  { code: 'whoami/name-long', local: 'warning', strict: 'warning', uxRow: 'whoami over-length name (max 24)', message: (c) => `name is ${c['length']} characters; at most 24 are expected` },
  { code: 'whoami/tagline-long', local: 'warning', strict: 'warning', uxRow: 'whoami over-length tagline (max 60 rendered chars)', message: (c) => `tagline renders ${c['length']} characters; at most 60 are expected` },
  { code: 'whoami/bio-long', local: 'warning', strict: 'warning', uxRow: 'whoami over-length bio (max 280)', message: (c) => `bio is ${c['length']} characters; at most 280 are expected` },
  { code: 'whoami/unknown-link', local: 'warning', strict: 'error', uxRow: 'whoami link key other than github or mail: warning; ignored', message: (c) => `link key '${c['key']}' is not supported (only github and mail); it is ignored` },
  { code: 'whoami/tagline-markup', local: 'warning', strict: 'error', uxRow: 'Malformed tagline markup (ux 7.14)', message: text('detail') },
  { code: 'site/url', local: 'error', strict: 'error', uxRow: 'site/url: [site] url missing or not an absolute https:// origin', message: (c) => `'${c['url']}' must be an absolute https:// origin without a path (for example https://nessynet.io)` },
  { code: 'sample/present', local: 'note', strict: 'error', sampleExempt: true, uxRow: 'Any sample item: listed; error under --strict unless --allow-samples (design 3.5.6)', message: (c) => c['detail'] ?? '' },
];

const RULE_BY_CODE: ReadonlyMap<string, Rule> = new Map(RULES.map((rule) => [rule.code, rule]));

// --- Options and reporting

export interface RulesOptions {
  readonly strict: boolean;
  readonly allowSamples: boolean;
  /** Host of `[site] url`, with any port; decides which links are on the site. */
  readonly siteHost: string;
  /** Content directory; screenshots are read from it. */
  readonly contentDir: string;
}

interface Where {
  readonly file: string;
  readonly entry?: string;
  readonly field?: string;
}

class Report {
  readonly diagnostics: Diagnostic[] = [];
  readonly #opts: RulesOptions;

  constructor(opts: RulesOptions) {
    this.#opts = opts;
  }

  add(code: string, where: Where, ctx: Record<string, string> = {}, isSample = false): void {
    const rule = RULE_BY_CODE.get(code);
    if (rule === undefined) throw new Error(`Unknown rule code ${code}`);
    const level = resolveLevel(rule, { strict: this.#opts.strict, allowSamples: this.#opts.allowSamples, isSample });
    this.diagnostics.push({ code, level, ...where, message: rule.message(ctx) });
  }
}

// --- Helpers

const ID_FORMAT = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const MAX_NAME = 24;
const MAX_TAGLINE = 60;
const MAX_BIO = 280;
const MAX_NON_TYPE_TAGS = 3;
const MAX_SCREENSHOT_WIDTH = 3000;
const LINK_KEYS: readonly string[] = ['github', 'mail'];
const GENERAL = 'general';

type Table = Record<string, unknown>;

const isTable = (value: unknown): value is Table => typeof value === 'object' && value !== null && !Array.isArray(value);
const length = (value: string): number => Array.from(value).length;

/** Own host check for absolute URLs; root-relative and relative values are not "on the host" in the rule sense. */
const onSiteHost = (url: string, siteHost: string): boolean => /^https?:\/\//.test(url) && classifyHref(url, siteHost) === 'internal';

const isHttpsOrigin = (value: string): boolean => {
  if (!URL.canParse(value)) return false;
  const url = new URL(value);
  return url.protocol === 'https:' && url.origin === value;
};

interface ShapeLike {
  readonly shape: Record<string, unknown>;
}
const keysOf = (schema: ShapeLike): ReadonlySet<string> => new Set(Object.keys(schema.shape));

const PROJECT_SHAPE = projectSchema.shape;
const KNOWN = {
  site: keysOf(siteSectionSchema),
  whoami: keysOf(whoamiSchema),
  category: keysOf(categorySchema),
  tag: keysOf(tagSchema),
  relation: keysOf(relationSchema),
  group: keysOf(groupSchema),
  bookmark: keysOf(bookmarkSchema),
  source: keysOf(PROJECT_SHAPE.source.unwrap()),
  get: keysOf(PROJECT_SHAPE.get.element),
  notice: keysOf(PROJECT_SHAPE.notice.unwrap()),
  screenshot: keysOf(PROJECT_SHAPE.screenshots.unwrap().element),
  changelog: keysOf(PROJECT_SHAPE.changelog.unwrap().element),
};

/** Known top-level keys per file kind (design 3.3). */
function topLevelKeysFor(file: string): ReadonlySet<string> | undefined {
  if (file === 'site.toml') return keysOf(siteFileSchema);
  if (file === 'categories.toml') return keysOf(categoriesFileSchema);
  if (file === 'bookmarks.toml') return keysOf(bookmarksFileSchema);
  if (file.startsWith('projects/')) return keysOf(projectSchema);
  return undefined;
}

/** Reports every key of `table` that is not in `known`; `prefix` is the dotted path of the table. */
function reportUnknownKeys(report: Report, where: Omit<Where, 'field'>, table: unknown, known: ReadonlySet<string>, prefix = ''): void {
  if (!isTable(table)) return;
  for (const key of Object.keys(table)) {
    if (!known.has(key)) report.add('file/unknown-key', { ...where, field: `${prefix}${key}` }, { key });
  }
}

function reportUnknownKeysInList(report: Report, where: Omit<Where, 'field'>, list: unknown, known: ReadonlySet<string>, name: string): void {
  if (!Array.isArray(list)) return;
  list.forEach((item, i) => reportUnknownKeys(report, where, item, known, `${name}[${i}].`));
}

// --- site.toml

function checkSite(report: Report, site: ParsedSite['site']): void {
  if (site === null) return;
  const where = { file: site.file, entry: 'site' };
  reportUnknownKeys(report, where, site.data, KNOWN.site);
  if (!isHttpsOrigin(site.data.url)) report.add('site/url', { ...where, field: 'url' }, { url: site.data.url });
}

function checkWhoami(report: Report, whoami: ParsedSite['whoami']): ParsedSite['whoami'] {
  if (whoami === null) return null;
  const where = { file: whoami.file, entry: 'whoami' };
  const { data } = whoami;
  reportUnknownKeys(report, where, data, KNOWN.whoami);

  if (length(data.name) > MAX_NAME) report.add('whoami/name-long', { ...where, field: 'name' }, { length: String(length(data.name)) });
  if (length(data.bio) > MAX_BIO) report.add('whoami/bio-long', { ...where, field: 'bio' }, { length: String(length(data.bio)) });
  if (data.tagline !== undefined) {
    const tagline = parseTagline(data.tagline);
    if (tagline.renderedLength > MAX_TAGLINE) report.add('whoami/tagline-long', { ...where, field: 'tagline' }, { length: String(tagline.renderedLength) });
    for (const issue of tagline.issues) report.add('whoami/tagline-markup', { ...where, field: 'tagline' }, { detail: issue.detail });
  }

  if (data.links === undefined) return whoami;
  const links: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data.links)) {
    if (LINK_KEYS.includes(key)) links[key] = value;
    else report.add('whoami/unknown-link', { ...where, field: `links.${key}` }, { key });
  }
  return { file: whoami.file, data: { ...data, links } as WhoamiData };
}

// --- categories.toml

function checkCategories(report: Report, categories: readonly Located<CategoryData>[], siteHost: string, projects: readonly ParsedProject[]): void {
  const firstById = new Map<string, string>();
  for (const { file, data } of categories) {
    const where = { file, entry: data.id };
    reportUnknownKeys(report, where, data, KNOWN.category);

    if (RESERVED_CATEGORY_IDS.includes(data.id)) report.add('category/reserved-id', { ...where, field: 'id' }, { id: data.id, reserved: RESERVED_CATEGORY_IDS.join(', ') });
    if (!ID_FORMAT.test(data.id)) report.add('category/id-format', { ...where, field: 'id' }, { id: data.id });
    const first = firstById.get(data.id);
    if (first === undefined) firstById.set(data.id, file);
    else report.add('category/duplicate-id', { ...where, field: 'id' }, { id: data.id, first });

    if (!isCategoryAccent(data.accent)) report.add('category/accent', { ...where, field: 'accent' }, { accent: data.accent, allowed: CATEGORY_ACCENTS.join(', ') });
    if (data.repo_url !== undefined && onSiteHost(data.repo_url, siteHost)) {
      report.add('category/repo-url', { ...where, field: 'repo_url' }, { detail: `repo_url '${data.repo_url}' is on the site host; it must point to a different host` });
    }
    if (data.show_empty !== true && !projects.some((p) => p.data.category === data.id)) report.add('category/empty', where, { id: data.id });

    checkTags(report, where, data);
  }
}

function checkTags(report: Report, where: Where, category: CategoryData): void {
  const seen = new Set<string>();
  category.tags.forEach((tag, i) => {
    const at = { ...where, field: `tags[${i}].id` };
    if (!ID_FORMAT.test(tag.id)) report.add('tag/id-format', at, { id: tag.id });
    if (seen.has(tag.id)) report.add('tag/duplicate', at, { id: tag.id, category: category.id });
    seen.add(tag.id);
    reportUnknownKeys(report, { file: where.file, entry: category.id }, tag, KNOWN.tag, `tags[${i}].`);
    if (tag.layout !== undefined && !Object.hasOwn(LAYOUTS, tag.layout)) {
      report.add('schema/type', { ...where, field: `tags[${i}].layout` }, { detail: `layout '${tag.layout}' must be one of ${Object.keys(LAYOUTS).join(', ')}` });
    }
  });
}

// --- projects

interface Graph {
  readonly categoriesById: ReadonlyMap<string, CategoryData>;
  readonly slugs: ReadonlySet<string>;
}

interface ProjectTagResult {
  readonly layout: Layout;
  readonly tags: readonly string[];
}

/** The project's valid tags in config order, and the layout of its type tag (the first in config order). */
function checkProjectTags(report: Report, where: Where, data: ProjectData, category: CategoryData): ProjectTagResult {
  const catTagIds = new Set(category.tags.map((t) => t.id));
  data.tags.forEach((tag, i) => {
    if (!catTagIds.has(tag)) report.add('project/unknown-tag', { ...where, field: `tags[${i}]` }, { tag, category: category.id });
  });

  const valid: TagData[] = category.tags.filter((t, i, all) => data.tags.includes(t.id) && all.findIndex((o) => o.id === t.id) === i);
  const typeTags = valid.filter((t) => t.type === true);
  const typeTag = typeTags[0];
  const tagsField = { ...where, field: 'tags' };

  if (typeTags.length === 0) {
    report.add('project/type-tag-count', tagsField, { detail: 'no valid type tag; the project is rendered with the generic layout and no type label' });
  } else if (typeTags.length > 1) {
    const ids = typeTags.map((t) => t.id);
    report.add('project/type-tag-count', tagsField, { detail: `${ids.length} type tags (${ids.join(', ')}); '${ids[0]}' is the type and the others render as normal tags` });
  }
  const nonType = valid.length - (typeTag === undefined ? 0 : 1);
  if (nonType > MAX_NON_TYPE_TAGS) report.add('project/too-many-tags', tagsField, { count: String(nonType) });

  const authoredLayout = typeTag?.layout !== undefined && Object.hasOwn(LAYOUTS, typeTag.layout) ? (typeTag.layout as Layout) : undefined;
  const { layout, fellBack } = resolveLayout(typeTag === undefined ? null : { id: typeTag.id, ...(authoredLayout === undefined ? {} : { layout: authoredLayout }) });
  if (fellBack && typeTag !== undefined) report.add('project/layout-fallback', tagsField, { tag: typeTag.id });
  return { layout, tags: valid.map((t) => t.id) };
}

function checkGet(report: Report, where: Where, data: ProjectData, layout: Layout | null, category: CategoryData | undefined, opts: RulesOptions): ProjectData['get'] {
  const { get } = data;
  if (get.some((g) => g.kind === 'none') && get.length > 1) report.add('project/get-none-not-alone', { ...where, field: 'get' });
  get.forEach((entry, i) => {
    if (entry.kind === 'external' && entry.url !== undefined && onSiteHost(entry.url, opts.siteHost)) {
      report.add('project/external-get-own-host', { ...where, field: `get[${i}].url` }, { url: entry.url });
    }
  });

  if (layout !== 'plugin' || category === undefined || category.repo_url !== undefined) return get;
  const first = get.findIndex((g) => g.kind === 'install');
  if (first === -1) return get;
  report.add('project/install-without-repo-url', { ...where, field: `get[${first}]` }, { category: category.id }, data.sample === true);
  return get.filter((g) => g.kind !== 'install');
}

function checkNotice(report: Report, where: Where, data: ProjectData): void {
  const hasNone = data.get.some((g) => g.kind === 'none');
  if (data.notice === undefined) {
    if (data.status === 'retired') report.add('project/notice-missing', { ...where, field: 'notice' }, { detail: 'a retired project needs a notice with a date' });
    else if (hasNone) report.add('project/notice-missing', { ...where, field: 'notice' }, { detail: "a project whose get entry is 'none' needs a notice" });
  } else if (data.status === 'retired' && data.notice.date === undefined) {
    report.add('project/notice-missing', { ...where, field: 'notice.date' }, { detail: 'a retired project needs a notice date' });
  }
}

function checkChangelog(report: Report, where: Where, data: ProjectData): void {
  const entries = data.changelog ?? [];
  entries.forEach((entry, i) => {
    const previous = entries[i - 1];
    if (previous !== undefined && entry.date > previous.date) report.add('project/changelog-order', { ...where, field: `changelog[${i}].date` }, { date: entry.date });
  });
}

/** Existence and width through sharp's header read; no pixel decoding. */
async function checkScreenshots(report: Report, where: Where, project: ParsedProject, contentDir: string): Promise<void> {
  const screenshots = project.data.screenshots ?? [];
  const base = resolve(contentDir, 'projects', project.folderCategory, project.fileSlug);
  for (const [i, shot] of screenshots.entries()) {
    if (shot.caption.trim() === '') report.add('project/screenshot-caption', { ...where, field: `screenshots[${i}].caption` });
    const path = resolve(base, shot.file);
    const at = { ...where, field: `screenshots[${i}].file` };
    if (!path.startsWith(`${base}${sep}`)) {
      report.add('project/screenshot-file', at, { detail: `'${shot.file}' must be inside projects/${project.folderCategory}/${project.fileSlug}/` });
      continue;
    }
    try {
      const { width } = await sharp(path).metadata();
      if (width !== undefined && width > MAX_SCREENSHOT_WIDTH) report.add('project/screenshot-wide', at, { width: String(width) });
    } catch {
      report.add('project/screenshot-file', at, { detail: `'${shot.file}' is missing or not a readable image in projects/${project.folderCategory}/${project.fileSlug}/` });
    }
  }
}

function checkNestedUnknownKeys(report: Report, where: Where, data: ProjectData): void {
  reportUnknownKeys(report, where, data.source, KNOWN.source, 'source.');
  reportUnknownKeysInList(report, where, data.get, KNOWN.get, 'get');
  reportUnknownKeys(report, where, data.notice, KNOWN.notice, 'notice.');
  reportUnknownKeysInList(report, where, data.screenshots, KNOWN.screenshot, 'screenshots');
  reportUnknownKeysInList(report, where, data.changelog, KNOWN.changelog, 'changelog');
}

async function checkProjects(report: Report, projects: readonly ParsedProject[], graph: Graph, opts: RulesOptions): Promise<ParsedProject[]> {
  const resolved: ParsedProject[] = [];
  const firstBySlug = new Map<string, string>();
  for (const project of projects) {
    const { data, file } = project;
    const where = { file, entry: data.slug };
    const category = graph.categoriesById.get(data.category);

    if (project.folderCategory !== data.category) {
      report.add('project/location', { ...where, field: 'category' }, { detail: `category '${data.category}' does not match the folder 'projects/${project.folderCategory}/'` });
    }
    if (project.fileSlug !== data.slug) {
      report.add('project/location', { ...where, field: 'slug' }, { detail: `slug '${data.slug}' does not match the filename '${project.fileSlug}.toml'` });
    }
    if (!ID_FORMAT.test(data.slug)) report.add('project/slug-format', { ...where, field: 'slug' }, { slug: data.slug });
    const first = firstBySlug.get(data.slug);
    if (first === undefined) firstBySlug.set(data.slug, file);
    else report.add('project/duplicate-slug', { ...where, field: 'slug' }, { slug: data.slug, first });
    if (category === undefined) report.add('project/unknown-category', { ...where, field: 'category' }, { category: data.category });

    checkNestedUnknownKeys(report, where, data);
    const tagResult = category === undefined ? null : checkProjectTags(report, where, data, category);
    const layout = tagResult?.layout ?? null;

    if (layout !== null) {
      if (LAYOUTS[layout].requiresVersion && data.version === undefined) {
        report.add('project/version-missing', { ...where, field: 'version' }, { layout });
      }
      const details = parseDetails(layout, data, { file, entry: data.slug });
      report.diagnostics.push(...details.diagnostics);
      for (const key of details.unknownKeys) report.add('project/unknown-detail-key', { ...where, field: key }, { key });
    }

    const get = checkGet(report, where, data, layout, category, opts);
    checkNotice(report, where, data);
    checkChangelog(report, where, data);
    await checkScreenshots(report, where, project, opts.contentDir);

    resolved.push({ ...project, data: { ...data, get, ...(tagResult === null ? {} : { tags: [...tagResult.tags] }) } });
  }
  return resolved;
}

// --- bookmarks.toml

function checkBookmarks(report: Report, parsed: ParsedSite, graph: Graph, siteHost: string): Located<BookmarkData>[] {
  const relationIds = new Set(parsed.relations.map((r) => r.data.id));
  const groupIds = new Set([GENERAL, ...parsed.groups.map((g) => g.data.id)]);
  for (const { file, data } of parsed.relations) reportUnknownKeys(report, { file, entry: data.id }, data, KNOWN.relation);
  for (const { file, data } of parsed.groups) reportUnknownKeys(report, { file, entry: data.id }, data, KNOWN.group);

  return parsed.bookmarks.map(({ file, data }) => {
    const where = { file, entry: data.name };
    reportUnknownKeys(report, where, data, KNOWN.bookmark);
    const { relation } = data;
    let { category, group, projects } = data;

    if (category !== undefined && group !== undefined) {
      report.add('bookmark/category-and-group', { ...where, field: 'group' });
      group = undefined;
    }
    if (category !== undefined && !graph.categoriesById.has(category)) {
      report.add('bookmark/unknown-category', { ...where, field: 'category' }, { category });
      category = undefined;
    } else if (group !== undefined && !groupIds.has(group)) {
      report.add('bookmark/unknown-group', { ...where, field: 'group' }, { group });
      group = undefined;
    }
    if (!relationIds.has(relation)) {
      report.add('bookmark/unknown-relation', { ...where, field: 'relation' }, { relation });
    }
    if (projects !== undefined) {
      projects.forEach((slug, i) => {
        if (!graph.slugs.has(slug)) report.add('bookmark/unknown-project', { ...where, field: `projects[${i}]` }, { slug });
      });
      projects = projects.filter((slug) => graph.slugs.has(slug));
    }
    if (onSiteHost(data.url, siteHost)) report.add('bookmark/own-host', { ...where, field: 'url' }, { url: data.url });

    // An unknown relation is dropped (no badge). The type keeps `relation` required, so the key is only left out here.
    const kept: Record<string, unknown> = { ...data };
    for (const [key, value] of Object.entries({ category, group, projects, relation: relationIds.has(relation) ? relation : undefined })) {
      if (value === undefined) delete kept[key];
      else kept[key] = value;
    }
    return { file, data: kept as BookmarkData };
  });
}

// --- Structure: top-level keys, strays, orphans, samples

function checkStructure(report: Report, parsed: ParsedSite): void {
  for (const { file, keys } of parsed.topLevelKeys) {
    const known = topLevelKeysFor(file);
    if (known === undefined) continue;
    for (const key of keys) if (!known.has(key)) report.add('file/unknown-key', { file, field: key }, { key });
  }
  for (const file of parsed.strays) report.add('project/stray-file', { file });
  for (const dir of parsed.orphanAssetDirs) report.add('project/orphan-assets', { file: dir }, { name: dir.slice(dir.lastIndexOf('/') + 1) });
  for (const item of parsed.samples) {
    const parts = [...item.fields.map((f) => `field ${f}`), ...item.assets.map((a) => `asset ${a}`)];
    const detail = `sample content${parts.length === 0 ? ' (sample = true)' : `: ${parts.join(', ')}`}`;
    report.add('sample/present', { file: item.file, ...(item.entry === undefined ? {} : { entry: item.entry }) }, { detail }, true);
  }
}

// --- Entry point

/**
 * Grades `parsed` and returns the diagnostics plus a copy with the local fallbacks applied; `parsed` is not mutated.
 * Asynchronous only because screenshots are read with sharp.
 */
export async function applyRules(parsed: ParsedSite, opts: RulesOptions): Promise<{ diagnostics: Diagnostic[]; resolved: ParsedSite }> {
  const report = new Report(opts);
  const categoriesById = new Map<string, CategoryData>();
  for (const { data } of parsed.categories) if (!categoriesById.has(data.id)) categoriesById.set(data.id, data);
  const graph: Graph = { categoriesById, slugs: new Set(parsed.projects.map((p) => p.data.slug)) };

  checkSite(report, parsed.site);
  const whoami = checkWhoami(report, parsed.whoami);
  checkCategories(report, parsed.categories, opts.siteHost, parsed.projects);
  const projects = await checkProjects(report, parsed.projects, graph, opts);
  const bookmarks = checkBookmarks(report, parsed, graph, opts.siteHost);
  checkStructure(report, parsed);

  return { diagnostics: report.diagnostics, resolved: { ...parsed, whoami, projects, bookmarks } };
}
