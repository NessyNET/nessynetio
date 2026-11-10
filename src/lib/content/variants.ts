// Variant registry (design 3.3.1): type tag -> layout -> details table schema. Code, not config.
import { z } from 'zod';
import type { Diagnostic } from './diagnostics.ts';
import type {
  BotDetails,
  Layout,
  ModDetails,
  ModpackDetails,
  OfflineDetails,
  PluginDetails,
  ToolDetails,
  WebDetails,
} from './model.ts';

export type DetailTable = 'ffxiv' | 'webtool' | 'minecraft' | 'linux' | 'bot';
export type LayoutDetails =
  | PluginDetails
  | OfflineDetails
  | WebDetails
  | ModDetails
  | ModpackDetails
  | ToolDetails
  | BotDetails;

export interface LayoutSpec {
  readonly table: DetailTable | null;
  readonly schema: z.ZodType<LayoutDetails> | null;
  /** The shared `version` key is required, except for web tools. */
  readonly requiresVersion: boolean;
}

export const DEFAULT_LAYOUT_BY_TYPE_TAG: Readonly<Record<string, Layout>> = {
  plugin: 'plugin',
  offline: 'offline',
  web: 'web',
  mod: 'mod',
  modpack: 'modpack',
  cli: 'tool',
  tui: 'tool',
  theme: 'tool',
  bot: 'bot',
};

export function resolveLayout(typeTag: { readonly id: string; readonly layout?: Layout } | null): {
  layout: Layout;
  fellBack: boolean;
} {
  if (typeTag === null) return { layout: 'generic', fellBack: false };
  if (typeTag.layout !== undefined) return { layout: typeTag.layout, fellBack: false };
  if (Object.hasOwn(DEFAULT_LAYOUT_BY_TYPE_TAG, typeTag.id)) {
    return { layout: DEFAULT_LAYOUT_BY_TYPE_TAG[typeTag.id]!, fellBack: false };
  }
  return { layout: 'generic', fellBack: true };
}

// --- Schemas. Input is snake_case TOML; output is the camelCase type from model.ts.
// Unknown keys are rejected here and demoted to `unknownKeys` by `parseDetails`, so drift is graded by 008.

type Compact<T> = { [K in keyof T as undefined extends T[K] ? never : K]: T[K] } & {
  [K in keyof T as undefined extends T[K] ? K : never]?: Exclude<T[K], undefined>;
};

/** Drops keys whose value is `undefined`, so optional fields are absent rather than undefined-valued. */
function compact<T extends Record<string, unknown>>(value: T): Compact<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Compact<T>;
}

/** TOML dates arrive as `Date` subclasses; string dates are accepted too. Both become `YYYY-MM-DD`. */
const date = z.unknown().transform((value, ctx) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const probe = new Date(`${value}T00:00:00Z`);
    if (!Number.isNaN(probe.getTime()) && probe.toISOString().slice(0, 10) === value) return value;
  }
  ctx.issues.push({ code: 'custom', message: 'Expected a date (YYYY-MM-DD)', input: value });
  return z.NEVER;
});

const strings = z.array(z.string()).default([]);

const pluginSchema = z
  .strictObject({ requires: z.string() })
  .transform((v): PluginDetails => ({ requires: v.requires })) satisfies z.ZodType<PluginDetails>;

const offlineSchema = z
  .strictObject({ requires: z.string().optional() })
  .transform((v): OfflineDetails => compact({ requires: v.requires })) satisfies z.ZodType<OfflineDetails>;

const webSchema = z
  .strictObject({ runs_in: z.string(), account: z.string(), data: z.string() })
  .transform(
    (v): WebDetails => ({ runsIn: v.runs_in, account: v.account, data: v.data }),
  ) satisfies z.ZodType<WebDetails>;

const modSchema = z
  .strictObject({
    loader: z.string(),
    game_versions: strings,
    side: z.enum(['client', 'server', 'both']),
    files: z
      .array(z.strictObject({ game: z.string(), loader: z.string(), file: z.string(), date }))
      .default([]),
    dependencies: z
      .array(
        z.strictObject({
          name: z.string(),
          url: z.string().optional(),
          need: z.enum(['required', 'optional']),
          why: z.string().optional(),
        }),
      )
      .default([]),
  })
  .transform(
    (v): ModDetails => ({
      loader: v.loader,
      gameVersions: v.game_versions,
      side: v.side,
      files: v.files,
      dependencies: v.dependencies.map((d) => compact(d)),
    }),
  ) satisfies z.ZodType<ModDetails>;

const modpackSchema = z
  .strictObject({
    loader: z.string(),
    game_versions: strings,
    import_url: z.string(),
    launcher: z.string().optional(),
    memory_gb: z.number().positive(),
    mods: z
      .array(
        z.strictObject({
          name: z.string(),
          version: z.string().optional(),
          url: z.string().optional(),
          mine: z.boolean(),
        }),
      )
      .default([]),
    mods_total: z.number().int().nonnegative(),
    mods_url: z.string().optional(),
  })
  .transform(
    (v): ModpackDetails =>
      compact({
        loader: v.loader,
        gameVersions: v.game_versions,
        importUrl: v.import_url,
        launcher: v.launcher,
        memoryGb: v.memory_gb,
        mods: v.mods.map((m) => compact(m)),
        modsTotal: v.mods_total,
        modsUrl: v.mods_url,
      }),
  ) satisfies z.ZodType<ModpackDetails>;

const toolSchema = z
  .strictObject({
    language: z.string(),
    needs: strings,
    install: z
      .array(z.strictObject({ method: z.string(), command: z.string(), note: z.string().optional() }))
      .default([]),
    usage: z.strictObject({
      synopsis: z.string(),
      commands: z.array(z.strictObject({ name: z.string(), help: z.string() })).default([]),
      options: z.array(z.strictObject({ flag: z.string(), help: z.string() })).default([]),
      example: z.string(),
    }),
    distros: z
      .array(
        z.strictObject({
          name: z.string(),
          support: z.enum(['supported', 'untested', 'unsupported']),
          how: z.string().optional(),
        }),
      )
      .default([]),
  })
  .transform(
    (v): ToolDetails => ({
      language: v.language,
      needs: v.needs,
      install: v.install.map((i) => compact(i)),
      usage: v.usage,
      distros: v.distros.map((d) => compact(d)),
    }),
  ) satisfies z.ZodType<ToolDetails>;

const botSchema = z
  .strictObject({
    platform: z.string(),
    hosting: z.string(),
    invite: z.boolean(),
    commands: z.array(z.strictObject({ name: z.string(), help: z.string(), who: z.string() })).default([]),
  })
  .transform((v): BotDetails => v) satisfies z.ZodType<BotDetails>;

export const LAYOUTS: Readonly<Record<Layout, LayoutSpec>> = {
  plugin: { table: 'ffxiv', schema: pluginSchema, requiresVersion: true },
  offline: { table: 'ffxiv', schema: offlineSchema, requiresVersion: true },
  web: { table: 'webtool', schema: webSchema, requiresVersion: false },
  mod: { table: 'minecraft', schema: modSchema, requiresVersion: true },
  modpack: { table: 'minecraft', schema: modpackSchema, requiresVersion: true },
  tool: { table: 'linux', schema: toolSchema, requiresVersion: true },
  bot: { table: 'bot', schema: botSchema, requiresVersion: true },
  generic: { table: null, schema: null, requiresVersion: true },
};

const DETAIL_TABLES: readonly DetailTable[] = ['ffxiv', 'webtool', 'minecraft', 'linux', 'bot'];

// --- Parsing

export interface DetailsContext {
  readonly file: string;
  readonly entry: string;
}

export interface ParsedDetails {
  /** Absent for `generic`, and when the table has shape errors. */
  readonly details: LayoutDetails | undefined;
  readonly diagnostics: Diagnostic[];
  /** `table.key` (nested: `table.files[0].key`) for unknown keys; a bare table name for a table of another layout. */
  readonly unknownKeys: string[];
}

function fieldPath(table: string, path: readonly PropertyKey[]): string {
  return path.reduce<string>(
    (acc, part) => (typeof part === 'number' ? `${acc}[${part}]` : `${acc}.${String(part)}`),
    table,
  );
}

/** Removes the keys named by `unrecognized_keys` issues from a deep copy, so the rest can still be parsed. */
function withoutKeys(input: unknown, removals: readonly { path: readonly PropertyKey[]; keys: readonly string[] }[]): unknown {
  const copy: unknown = structuredClone(input);
  for (const { path, keys } of removals) {
    let node: unknown = copy;
    for (const part of path) node = (node as Record<PropertyKey, unknown>)[part];
    for (const key of keys) delete (node as Record<string, unknown>)[key];
  }
  return copy;
}

/**
 * `raw` is the whole parsed project file: the layout's table is read from it, and any detail table
 * belonging to another layout is reported in `unknownKeys` by name.
 */
export function parseDetails(layout: Layout, raw: Readonly<Record<string, unknown>>, ctx: DetailsContext): ParsedDetails {
  const { table, schema } = LAYOUTS[layout];
  const unknownKeys: string[] = DETAIL_TABLES.filter((name) => name !== table && Object.hasOwn(raw, name));
  if (table === null || schema === null) return { details: undefined, diagnostics: [], unknownKeys };

  const input = raw[table] ?? {};
  let result = schema.safeParse(input);
  const diagnostics: Diagnostic[] = [];
  if (!result.success) {
    const removals: { path: readonly PropertyKey[]; keys: readonly string[] }[] = [];
    for (const issue of result.error.issues) {
      if (issue.code === 'unrecognized_keys') {
        removals.push({ path: issue.path, keys: issue.keys });
        for (const key of issue.keys) unknownKeys.push(fieldPath(table, [...issue.path, key]));
      } else {
        diagnostics.push({
          code: 'details/shape',
          level: 'error',
          file: ctx.file,
          entry: ctx.entry,
          field: fieldPath(table, issue.path),
          message: issue.message,
        });
      }
    }
    if (diagnostics.length === 0) result = schema.safeParse(withoutKeys(input, removals));
  }
  return { details: result.success ? result.data : undefined, diagnostics, unknownKeys };
}

/** Host of the first `external` get entry (the `host` stat row and `Open tool: {host}`). */
export function webHost(get: readonly { readonly kind: string; readonly url?: string }[]): string | undefined {
  const entry = get.find((g) => g.kind === 'external' && g.url !== undefined);
  if (entry?.url === undefined) return undefined;
  try {
    return new URL(entry.url).host;
  } catch {
    return undefined;
  }
}
