// Reads the owner content files, checks their shape and returns a typed `ParsedSite` plus diagnostics
// (design 3.2, 3.3, 3.5.6). Content problems are diagnostics, never thrown. Only the known files and the
// `projects/` tree are read.
import type { Dirent } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { parse, TomlDate, TomlError } from 'smol-toml';
import type { z } from 'zod';
import type { Diagnostic } from './diagnostics.ts';
import type { SampleItem } from './model.ts';
import {
  bookmarkSchema,
  categorySchema,
  groupSchema,
  projectSchema,
  relationSchema,
  siteSectionSchema,
  validateEntity,
  whoamiSchema,
  type BookmarkData,
  type CategoryData,
  type GroupData,
  type ProjectData,
  type RelationData,
  type SiteSection,
  type WhoamiData,
} from './schema.ts';

/** Parsed data with the content-relative source file (forward slashes). */
export interface Located<T> {
  readonly file: string;
  readonly data: T;
}

export interface ParsedProject extends Located<ProjectData> {
  /** The `<category>` folder the file sits in; the rules pass compares it with `data.category`. */
  readonly folderCategory: string;
  /** The filename without `.toml`; the rules pass compares it with `data.slug`. */
  readonly fileSlug: string;
  /** Files under `projects/<category>/<slug>/`, relative to that folder, forward slashes, sorted. */
  readonly assets: readonly string[];
}

/** Entities that failed validation are absent here; their errors are in the diagnostics. */
export interface ParsedSite {
  readonly site: Located<SiteSection> | null;
  readonly whoami: Located<WhoamiData> | null;
  readonly categories: readonly Located<CategoryData>[];
  readonly projects: readonly ParsedProject[];
  readonly relations: readonly Located<RelationData>[];
  readonly groups: readonly Located<GroupData>[];
  readonly bookmarks: readonly Located<BookmarkData>[];
  /** Top-level keys of every file that parsed as TOML, so the rules pass can grade unknown ones. */
  readonly topLevelKeys: readonly { readonly file: string; readonly keys: readonly string[] }[];
  readonly samples: readonly SampleItem[];
}

export const SAMPLE_MARKER = '[sample]';
const SAMPLE_ASSET = /\.sample\.[^./]+$/;

type Table = Record<string, unknown>;

const isTable = (value: unknown): value is Table => typeof value === 'object' && value !== null && !Array.isArray(value);

/** TOML dates become `YYYY-MM-DD` strings (design 3.3); other date-times keep their ISO text and fail the date check. */
function normalise(value: unknown): unknown {
  if (value instanceof TomlDate) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalise);
  if (isTable(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalise(v)]));
  return value;
}

async function readIfPresent(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function listDir(path: string): Promise<Dirent[]> {
  try {
    return (await readdir(path, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
}

/** Every file below `dir` as a forward-slash path relative to it, sorted. */
async function listFiles(dir: string, prefix = ''): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await listDir(dir)) {
    if (entry.isDirectory()) out.push(...(await listFiles(join(dir, entry.name), `${prefix}${entry.name}/`)));
    else out.push(`${prefix}${entry.name}`);
  }
  return out;
}

/** Paths (`notice.text`, `get[1].label`) of every string containing the sample marker. */
function markerFields(value: unknown, path = ''): string[] {
  if (typeof value === 'string') return value.includes(SAMPLE_MARKER) ? [path] : [];
  if (Array.isArray(value)) return value.flatMap((item, i) => markerFields(item, `${path}[${i}]`));
  if (isTable(value)) return Object.entries(value).flatMap(([k, v]) => markerFields(v, path === '' ? k : `${path}.${k}`));
  return [];
}

class Loader {
  readonly diagnostics: Diagnostic[] = [];
  readonly samples: SampleItem[] = [];
  readonly topLevelKeys: { file: string; keys: string[] }[] = [];

  readonly dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  /** Reads and parses one TOML file; undefined when missing (reported when `required`) or malformed. */
  async readToml(file: string, required: boolean): Promise<Table | undefined> {
    const text = await readIfPresent(join(this.dir, file));
    if (text === undefined) {
      if (required) this.diagnostics.push({ code: 'schema/required', level: 'error', file, message: 'missing required file' });
      return undefined;
    }
    try {
      const table = normalise(parse(text)) as Table;
      this.topLevelKeys.push({ file, keys: Object.keys(table) });
      return table;
    } catch (error) {
      if (!(error instanceof TomlError)) throw error;
      const reason = error.message.split('\n')[0];
      this.diagnostics.push({ code: 'toml/syntax', level: 'error', file, message: `${reason} (line ${error.line}, column ${error.column})` });
      return undefined;
    }
  }

  /** Validates one entity and records its sample markers; `entry` names it in diagnostics. */
  entity<T extends Table>(schema: z.ZodType<T>, raw: unknown, file: string, entry: string, assets: readonly string[] = []): T | undefined {
    const { data, diagnostics } = validateEntity(schema, raw, { file, entry });
    this.diagnostics.push(...diagnostics);
    if (data === undefined) return undefined;
    const fields = markerFields(data);
    if (data['sample'] === true || fields.length > 0 || assets.length > 0) {
      this.samples.push({ file, entry, fields, assets });
    }
    return data;
  }

  /** Validates `table[key]` as an array of entities named by their `nameKey` field (fallback `key[i]`). */
  list<T extends Table>(schema: z.ZodType<T>, table: Table, key: string, nameKey: string, file: string): Located<T>[] {
    const raw = table[key];
    if (raw === undefined) return [];
    if (!Array.isArray(raw)) {
      this.diagnostics.push({ code: 'schema/type', level: 'error', file, field: key, message: 'must be an array of tables' });
      return [];
    }
    const out: Located<T>[] = [];
    raw.forEach((item, i) => {
      const data = this.entity(schema, item, file, entryName(item, nameKey, `${key}[${i}]`));
      if (data !== undefined) out.push({ file, data });
    });
    return out;
  }
}

/** The entity's identifying field (project slug, category id, bookmark name), or a positional fallback. */
const entryName = (raw: unknown, nameKey: string, fallback: string): string =>
  isTable(raw) && typeof raw[nameKey] === 'string' ? raw[nameKey] : fallback;

export async function loadContent(dir: string): Promise<{ parsed: ParsedSite; diagnostics: Diagnostic[] }> {
  const loader = new Loader(dir);

  const siteFile = await loader.readToml('site.toml', true);
  let site: Located<SiteSection> | null = null;
  let whoami: Located<WhoamiData> | null = null;
  if (siteFile !== undefined) {
    const data = loader.entity(siteSectionSchema, siteFile['site'] ?? {}, 'site.toml', 'site');
    if (data !== undefined) site = { file: 'site.toml', data };
    const who = loader.entity(whoamiSchema, siteFile['whoami'] ?? {}, 'site.toml', 'whoami');
    if (who !== undefined) whoami = { file: 'site.toml', data: who };
  }

  const categoriesFile = await loader.readToml('categories.toml', true);
  const categories = categoriesFile === undefined ? [] : loader.list(categorySchema, categoriesFile, 'category', 'id', 'categories.toml');

  const bookmarksFile = await loader.readToml('bookmarks.toml', false);
  const relations = bookmarksFile === undefined ? [] : loader.list(relationSchema, bookmarksFile, 'relation', 'id', 'bookmarks.toml');
  const groups = bookmarksFile === undefined ? [] : loader.list(groupSchema, bookmarksFile, 'group', 'id', 'bookmarks.toml');
  const bookmarks = bookmarksFile === undefined ? [] : loader.list(bookmarkSchema, bookmarksFile, 'bookmark', 'name', 'bookmarks.toml');

  const projects: ParsedProject[] = [];
  for (const folder of (await listDir(join(dir, 'projects'))).filter((e) => e.isDirectory())) {
    for (const entry of (await listDir(join(dir, 'projects', folder.name))).filter((e) => e.isFile() && e.name.endsWith('.toml'))) {
      const fileSlug = basename(entry.name, '.toml');
      const file = `projects/${folder.name}/${entry.name}`;
      const raw = await loader.readToml(file, true);
      if (raw === undefined) continue;
      const assets = await listFiles(join(dir, 'projects', folder.name, fileSlug));
      const sampleAssets = assets.filter((a) => SAMPLE_ASSET.test(a)).map((a) => `projects/${folder.name}/${fileSlug}/${a}`);
      const data = loader.entity(projectSchema, raw, file, entryName(raw, 'slug', fileSlug), sampleAssets);
      if (data !== undefined) projects.push({ file, data, folderCategory: folder.name, fileSlug, assets });
    }
  }

  const parsed: ParsedSite = {
    site,
    whoami,
    categories,
    projects,
    relations,
    groups,
    bookmarks,
    topLevelKeys: loader.topLevelKeys,
    samples: loader.samples,
  };
  return { parsed, diagnostics: loader.diagnostics };
}
