// Normalised SiteModel: the only shape pages consume (design 3.3.2; plan section 4). Types only.
// Field names are the contract; optional fields are absent (never `undefined`-valued) when not set.
// Dates are `YYYY-MM-DD` strings. Accent tokens are plain strings: `src/lib/palette.ts` (004) owns the allow-list.

import type { CategoryAccent, TaglineColour } from '../palette.ts';

export type Layout = 'plugin' | 'offline' | 'web' | 'mod' | 'modpack' | 'tool' | 'bot' | 'generic';
export type Status = 'active' | 'retired';

// --- Per-layout detail tables (design 3.3.1, keys camelCased). Arrays are normalised to [] when absent.

export interface PluginDetails {
  readonly requires: string;
}

export interface OfflineDetails {
  readonly requires?: string;
}

/** The stat row `host` is derived from the first `external` get entry, not stored here. */
export interface WebDetails {
  readonly runsIn: string;
  readonly account: string;
  readonly data: string;
}

export interface ModFile {
  readonly game: string;
  readonly loader: string;
  readonly file: string;
  readonly date: string;
}

export interface ModDependency {
  readonly name: string;
  readonly url?: string;
  readonly need: 'required' | 'optional';
  readonly why?: string;
}

export interface ModDetails {
  readonly loader: string;
  readonly gameVersions: readonly string[];
  readonly side: 'client' | 'server' | 'both';
  readonly files: readonly ModFile[];
  readonly dependencies: readonly ModDependency[];
}

export interface ModpackMod {
  readonly name: string;
  readonly version?: string;
  readonly url?: string;
  /** The owner's own mod: links internally and carries the `me` badge. */
  readonly mine: boolean;
  /** Page path of the published project of this name; set only for a `mine` mod whose `name` matches one exactly. */
  readonly path?: string;
}

export interface ModpackDetails {
  readonly loader: string;
  readonly gameVersions: readonly string[];
  readonly importUrl: string;
  readonly launcher?: string;
  readonly memoryGb: number;
  readonly mods: readonly ModpackMod[];
  readonly modsTotal: number;
  readonly modsUrl?: string;
}

export interface ToolInstall {
  readonly method: string;
  readonly command: string;
  readonly note?: string;
}

export interface ToolUsage {
  readonly synopsis: string;
  readonly commands: readonly { readonly name: string; readonly help: string }[];
  readonly options: readonly { readonly flag: string; readonly help: string }[];
  readonly example: string;
}

export interface ToolDistro {
  readonly name: string;
  readonly support: 'supported' | 'untested' | 'unsupported';
  readonly how?: string;
}

export interface ToolDetails {
  readonly language: string;
  readonly needs: readonly string[];
  readonly install: readonly ToolInstall[];
  readonly usage: ToolUsage;
  readonly distros: readonly ToolDistro[];
}

export interface BotCommand {
  readonly name: string;
  readonly help: string;
  readonly who: string;
}

export interface BotDetails {
  readonly platform: string;
  readonly hosting: string;
  readonly invite: boolean;
  readonly commands: readonly BotCommand[];
}

// --- Entities

export interface Tag {
  readonly id: string;
  readonly label: string;
  readonly description?: string;
  readonly isType: boolean;
  readonly layout?: Layout;
  /** Projects in the category using this tag. */
  readonly count: number;
}

/** `none` get entries are not represented here: they produce an empty `get` and a text `getSlot`. */
export interface GetEntry {
  readonly kind: 'install' | 'external' | 'download';
  /** Final fixed or authored text. */
  readonly label: string;
  readonly href?: string;
  readonly external: boolean;
}

/** Final ux 6.2 wording: templates never compose it. */
export type GetSlot =
  | { readonly kind: 'links'; readonly links: readonly GetEntry[] }
  | { readonly kind: 'text'; readonly text: string };

export type SourceSlot =
  | { readonly kind: 'link'; readonly label: string; readonly href: string }
  | { readonly kind: 'text'; readonly text: string };

export interface Notice {
  readonly kind: 'local' | 'private' | 'retired' | 'separate';
  /** Final fixed label (`strings.ts`), e.g. `private bot`. */
  readonly label: string;
  readonly text: string;
  readonly date?: string;
}

export interface Screenshot {
  /** Content-relative path `projects/<folder>/<fileSlug>/<file>` (as `normalise` produces it); `src/lib/images.ts` (022) resolves it. */
  readonly file: string;
  /** Also the alt text. */
  readonly caption: string;
}

export interface ChangelogEntry {
  readonly version: string;
  readonly date: string;
  readonly items: readonly string[];
}

export interface Relation {
  readonly id: string;
  readonly description: string;
}

export interface Bookmark {
  readonly name: string;
  readonly url: string;
  readonly host: string;
  readonly note: string;
  readonly relation?: Relation;
  readonly author?: string;
  readonly projects: readonly { readonly slug: string; readonly name: string; readonly path: string }[];
  readonly groupId: string;
}

export interface BookmarkGroup {
  readonly id: string;
  readonly label: string;
  readonly kind: 'category' | 'group' | 'general';
  readonly accent: CategoryAccent;
  readonly bookmarks: readonly Bookmark[];
}

export interface UpdateEntry {
  readonly date: string;
  readonly categoryId: string;
  readonly slug: string;
  readonly version?: string;
  readonly note: string;
  readonly path: string;
}

export interface SampleItem {
  readonly file: string;
  readonly entry?: string;
  readonly fields: readonly string[];
  readonly assets: readonly string[];
}

interface ProjectBase {
  readonly slug: string;
  readonly name: string;
  readonly categoryId: string;
  readonly status: Status;
  readonly summary: string;
  readonly priority: number;
  readonly updated: string;
  readonly version?: string;
  /**
   * `null` only in the local-build fallback for a project with zero valid type tags (design 3.5.2 rev 5):
   * still rendered, layout `generic`, no type label, no type crumb, no type stat row.
   */
  readonly typeTag: Tag | null;
  /** Valid tags only, config order. */
  readonly tags: readonly Tag[];
  readonly licence?: string;
  readonly source?: { readonly host: string; readonly url: string };
  readonly issues?: string;
  readonly get: readonly GetEntry[];
  readonly getSlot: GetSlot;
  readonly sourceSlot: SourceSlot;
  readonly notice?: Notice;
  /** Text of the `warn:` notice inside INSTALL.md. */
  readonly caution?: string;
  readonly screenshots: readonly Screenshot[];
  /** Paragraphs. */
  readonly description: readonly string[];
  readonly changelog: readonly ChangelogEntry[];
  readonly changelogUrl?: string;
  readonly seeAlso: {
    /** At most 3, same category, default order, self excluded. */
    readonly mine: readonly Project[];
    readonly elsewhere: readonly Bookmark[];
  };
  readonly path: string;
}

/** Discriminated on `layout`; `generic` carries no details. */
export type Project = ProjectBase &
  (
    | { readonly layout: 'plugin'; readonly details: PluginDetails }
    | { readonly layout: 'offline'; readonly details: OfflineDetails }
    | { readonly layout: 'web'; readonly details: WebDetails }
    | { readonly layout: 'mod'; readonly details: ModDetails }
    | { readonly layout: 'modpack'; readonly details: ModpackDetails }
    | { readonly layout: 'tool'; readonly details: ToolDetails }
    | { readonly layout: 'bot'; readonly details: BotDetails }
    | { readonly layout: 'generic' }
  );

export interface Category {
  readonly id: string;
  readonly label: string;
  readonly shortLabel: string;
  readonly blurb: string;
  readonly blurbFirstSentence: string;
  readonly accent: CategoryAccent;
  readonly showEmpty: boolean;
  readonly repoUrl?: string;
  /** Used tags only, config order, with counts. */
  readonly tags: readonly Tag[];
  /** Default sort order. */
  readonly projects: readonly Project[];
  readonly bookmarks: readonly Bookmark[];
}

export interface TaglineSegment {
  readonly text: string;
  readonly accent?: TaglineColour;
}

export interface Whoami {
  readonly name: string;
  readonly tagline: readonly TaglineSegment[] | null;
  readonly taglinePlain: string | null;
  readonly bio: string;
  readonly links: { readonly github?: string; readonly mail?: string };
}

export interface SiteModel {
  readonly site: { readonly url: string; readonly host: string; readonly description: string };
  readonly whoami: Whoami | null;
  /** Published only, config order. */
  readonly categories: readonly Category[];
  readonly projectsBySlug: ReadonlyMap<string, Project>;
  /** ux 4.4 order, empty groups skipped. */
  readonly bookmarks: readonly BookmarkGroup[];
  readonly relations: readonly Relation[];
  /** Top 4 by `updated` descending, ties by slug. */
  readonly updatesLog: readonly UpdateEntry[];
  /** Every published page path (for the 404 suggestions). */
  readonly paths: readonly string[];
  readonly samples: readonly SampleItem[];
}
