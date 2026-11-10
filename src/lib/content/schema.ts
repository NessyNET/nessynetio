// Zod shape schemas for the owner content files (design 3.3, 3.5.2; ADR 003). Shape and required keys only:
// allow-lists, formats and cross-file rules belong to the rules pass (008). Objects are loose so unknown keys survive.
// Input is TOML already normalised by the loader (dates arrive as `YYYY-MM-DD` strings).
import { z } from 'zod';
import type { Diagnostic } from './diagnostics.ts';

// --- URL fields. `classifyHref` throws on other schemes, so they must stop here as content errors.

const HTTP_URL = /^https?:\/\/\S+$/;
const HTTP_URL_OR_ROOT_PATH = /^(?:https?:\/\/\S+|\/(?!\/)\S*)$/;
const HTTPS_URL = /^https:\/\/\S+$/;
const BARE_ADDRESS = /^(?!mailto:)[^\s@]+@[^\s@]+$/i;

// `URL.canParse` catches values the pattern lets through (`https://[bad`); the root-relative form has no absolute URL to parse.
const parseable = (value: string): boolean => !/^https?:/.test(value) || URL.canParse(value);
const UNPARSEABLE = 'must be a parseable URL';

const httpUrl = z.string().regex(HTTP_URL, 'must be an absolute http(s):// URL').refine(parseable, UNPARSEABLE);
const httpUrlOrRootPath = z
  .string()
  .regex(HTTP_URL_OR_ROOT_PATH, 'must be an absolute http(s):// URL or a root-relative path starting with /')
  .refine(parseable, UNPARSEABLE);
const httpsUrl = z.string().regex(HTTPS_URL, 'must be an absolute https:// URL').refine(parseable, UNPARSEABLE);
const bareAddress = z.string().regex(BARE_ADDRESS, 'must be a bare e-mail address without "mailto:"');
const date = z.iso.date();

const looseRecord = z.record(z.string(), z.unknown());

// --- site.toml

export const siteSectionSchema = z.looseObject({
  url: z.string(),
  description: z.string(),
});

export const whoamiSchema = z.looseObject({
  name: z.string(),
  tagline: z.string().optional(),
  bio: z.string(),
  sample: z.boolean().optional(),
  links: z.looseObject({ github: httpUrl.optional(), mail: bareAddress.optional() }).optional(),
});

export const siteFileSchema = z.looseObject({ site: siteSectionSchema, whoami: whoamiSchema });

// --- categories.toml

export const tagSchema = z.looseObject({
  id: z.string(),
  label: z.string().optional(),
  description: z.string().optional(),
  type: z.boolean().optional(),
  layout: z.string().optional(),
});

export const categorySchema = z.looseObject({
  id: z.string(),
  label: z.string(),
  short_label: z.string().optional(),
  blurb: z.string(),
  accent: z.string(),
  show_empty: z.boolean().optional(),
  repo_url: httpsUrl.optional(),
  sample: z.boolean().optional(),
  tags: z.array(tagSchema),
});

export const categoriesFileSchema = z.looseObject({ category: z.array(categorySchema) });

// --- projects/<category>/<slug>.toml

const getEntrySchema = z.looseObject({
  kind: z.enum(['install', 'external', 'download', 'none']),
  label: z.string().optional(),
  url: httpUrlOrRootPath.optional(),
});

const noticeSchema = z.looseObject({
  kind: z.enum(['local', 'private', 'retired', 'separate']),
  text: z.string(),
  date: date.optional(),
  what: z.string().optional(),
});

// Only the URL-bearing keys of the Minecraft table are typed here; 007 parses the rest.
const minecraftSchema = z.looseObject({
  import_url: httpUrl.optional(),
  mods_url: httpUrl.optional(),
  dependencies: z.array(z.looseObject({ url: httpUrl.optional() })).optional(),
  mods: z.array(z.looseObject({ url: httpUrl.optional() })).optional(),
});

export const projectSchema = z.looseObject({
  slug: z.string(),
  name: z.string(),
  category: z.string(),
  status: z.enum(['active', 'retired']),
  summary: z.string(),
  priority: z.int(),
  updated: date,
  description: z.string(),
  tags: z.array(z.string()).min(1),
  version: z.string().optional(),
  licence: z.string().optional(),
  issues: httpUrl.optional(),
  changelog_url: httpUrl.optional(),
  source: z.looseObject({ host: z.string(), url: httpUrl }).optional(),
  get: z.array(getEntrySchema).min(1),
  notice: noticeSchema.optional(),
  caution: z.string().optional(),
  screenshots: z.array(z.looseObject({ file: z.string(), caption: z.string() })).optional(),
  changelog: z.array(z.looseObject({ version: z.string(), date, items: z.array(z.string()) })).optional(),
  sample: z.boolean().optional(),
  ffxiv: looseRecord.optional(),
  webtool: looseRecord.optional(),
  minecraft: minecraftSchema.optional(),
  linux: looseRecord.optional(),
  bot: looseRecord.optional(),
});

// --- bookmarks.toml

export const relationSchema = z.looseObject({ id: z.string(), description: z.string() });
export const groupSchema = z.looseObject({ id: z.string(), label: z.string() });

export const bookmarkSchema = z.looseObject({
  name: z.string(),
  url: httpUrl,
  note: z.string(),
  relation: z.string(),
  category: z.string().optional(),
  group: z.string().optional(),
  author: z.string().optional(),
  projects: z.array(z.string()).optional(),
  sample: z.boolean().optional(),
});

export const bookmarksFileSchema = z.looseObject({
  relation: z.array(relationSchema).optional(),
  group: z.array(groupSchema).optional(),
  bookmark: z.array(bookmarkSchema).optional(),
});

export type SiteSection = z.infer<typeof siteSectionSchema>;
export type WhoamiData = z.infer<typeof whoamiSchema>;
export type TagData = z.infer<typeof tagSchema>;
export type CategoryData = z.infer<typeof categorySchema>;
export type ProjectData = z.infer<typeof projectSchema>;
export type RelationData = z.infer<typeof relationSchema>;
export type GroupData = z.infer<typeof groupSchema>;
export type BookmarkData = z.infer<typeof bookmarkSchema>;

// --- Validation to diagnostics

/** Dotted path with bracketed indices: `get[1].url`. */
export function formatPath(path: readonly PropertyKey[]): string {
  return path.reduce<string>(
    (out, key) => (typeof key === 'number' ? `${out}[${key}]` : out === '' ? String(key) : `${out}.${String(key)}`),
    '',
  );
}

const valueAt = (root: unknown, path: readonly PropertyKey[]): unknown =>
  path.reduce<unknown>((value, key) => (typeof value === 'object' && value !== null ? (value as Record<PropertyKey, unknown>)[key] : undefined), root);

function toDiagnostic(issue: z.core.$ZodIssue, raw: unknown, where: { file: string; entry?: string }): Diagnostic {
  const missing = (issue.code === 'invalid_type' || issue.code === 'invalid_value') && valueAt(raw, issue.path) === undefined;
  const empty = issue.code === 'too_small' && issue.origin === 'array';
  const field = formatPath(issue.path);
  return {
    code: missing || empty ? 'schema/required' : 'schema/type',
    level: 'error',
    file: where.file,
    ...(where.entry === undefined ? {} : { entry: where.entry }),
    ...(field === '' ? {} : { field }),
    message: missing ? 'missing required field' : empty ? 'at least one entry is required' : issue.message,
  };
}

/** Parses one entity. On any issue `data` is undefined; `diagnostics` is empty exactly when parsing succeeded. */
export function validateEntity<T>(
  schema: z.ZodType<T>,
  raw: unknown,
  where: { file: string; entry?: string },
): { data: T | undefined; diagnostics: Diagnostic[] } {
  const result = schema.safeParse(raw);
  if (result.success) return { data: result.data, diagnostics: [] };
  return { data: undefined, diagnostics: result.error.issues.map((issue) => toDiagnostic(issue, raw, where)) };
}
