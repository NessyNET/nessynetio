// Turns resolved content (a `ParsedSite` with the 008 fallbacks applied, no error diagnostics) into the frozen
// `SiteModel` that pages render without composing wording or order themselves (design 3.3.2). Pure: no I/O,
// no diagnostics (008 reports every content problem; this assumes a valid tree and stays defensive only where
// a fallback can leave a gap).
import { classifyHref, hostOf } from '../links.ts';
import * as routes from '../routes.ts';
import { sortRows, compareSlug } from '../sort.ts';
import {
  NOT_DISTRIBUTED_LOCAL,
  NOT_DISTRIBUTED_YET,
  NO_LONGER_DISTRIBUTED,
  SEE_INSTALL,
  SOURCE_NOT_AVAILABLE,
  downloadLabel,
  noticeLabel,
  notDistributedPrivate,
  openTool,
} from '../strings.ts';
import type { ParsedProject, ParsedSite } from './load.ts';
import type {
  Bookmark,
  BookmarkGroup,
  Category,
  GetEntry,
  GetSlot,
  Layout,
  Notice,
  Project,
  Relation,
  SiteModel,
  SourceSlot,
  Tag,
  UpdateEntry,
  Whoami,
} from './model.ts';
import type { BookmarkData, CategoryData, ProjectData, TagData } from './schema.ts';
import { parseTagline } from './tagline.ts';
import { parseDetails, resolveLayout, webHost } from './variants.ts';

const UPDATES_LOG_SIZE = 4;
const SEE_ALSO_MINE_MAX = 3;
const GENERAL_GROUP = 'general';
const FREE_GROUP_ACCENT = 'teal';

/** `{ [key]: value }`, or `{}` when the value is absent, so optional model fields are never `undefined`-valued. */
const maybe = <K extends string, V>(key: K, value: V | undefined): { [P in K]?: V } =>
  (value === undefined ? {} : { [key]: value }) as { [P in K]?: V };

/** Everything up to and including the first `.`, `!` or `?` followed by whitespace or the end. */
function firstSentence(text: string): string {
  const trimmed = text.trim();
  return /^[\s\S]*?[.!?](?=\s|$)/.exec(trimmed)?.[0] ?? trimmed;
}

const paragraphs = (text: string): string[] =>
  text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p !== '');

/** Freezes every reachable object (the model is cyclic through `seeAlso`); the project map also rejects mutation. */
function deepFreeze<T>(root: T, seen = new WeakSet<object>()): T {
  if (typeof root !== 'object' || root === null || seen.has(root)) return root;
  seen.add(root);
  if (root instanceof Map) {
    for (const [key, value] of root) {
      deepFreeze(key, seen);
      deepFreeze(value, seen);
    }
    for (const method of ['set', 'delete', 'clear'] as const) {
      Object.defineProperty(root, method, {
        value: () => {
          throw new TypeError(`Cannot call ${method} on a frozen SiteModel map`);
        },
      });
    }
  }
  for (const value of Object.values(root)) deepFreeze(value, seen);
  return Object.freeze(root);
}

function buildWhoami(parsed: ParsedSite['whoami']): Whoami | null {
  if (parsed === null) return null;
  const { name, tagline, bio, links } = parsed.data;
  const parsedTagline = tagline === undefined ? null : parseTagline(tagline);
  return {
    name,
    tagline: parsedTagline?.segments ?? null,
    taglinePlain: parsedTagline?.plain ?? null,
    bio,
    links: { ...maybe('github', links?.github), ...maybe('mail', links?.mail) },
  };
}

// --- Tags

const toTag = (data: TagData, count: number): Tag => ({
  id: data.id,
  label: data.label ?? data.id,
  ...maybe('description', data.description),
  isType: data.type === true,
  ...maybe('layout', data.layout as Layout | undefined),
  count,
});

/** The category's tags the project uses, as config entries in config order (unknown ids are ignored). */
const validTagData = (cfg: CategoryData, project: ProjectData): TagData[] => cfg.tags.filter((t) => project.tags.includes(t.id));

// --- Project slots

function buildGet(project: ProjectData, layout: Layout): GetEntry[] {
  const webToolHost = layout === 'web' ? webHost(project.get.map((g) => ({ kind: g.kind, ...maybe('url', g.url) }))) : undefined;
  let openToolUsed = false;
  const entries: GetEntry[] = [];
  for (const entry of project.get) {
    if (entry.kind === 'none') continue;
    if (entry.kind === 'install') {
      entries.push({ kind: 'install', label: SEE_INSTALL, href: '#install', external: false });
      continue;
    }
    const isOpenTool = entry.kind === 'external' && entry.url !== undefined && webToolHost !== undefined && !openToolUsed;
    if (isOpenTool) openToolUsed = true;
    const label = isOpenTool
      ? openTool(webToolHost)
      : (entry.label ?? (entry.kind === 'download' ? downloadLabel(project.version) : (entry.url ?? '')));
    entries.push({ kind: entry.kind, label, ...maybe('href', entry.url), external: false });
  }
  return entries;
}

/** Fills `external` once the site host is known (kept apart so `buildGet` stays about labels). */
const classify = (entries: readonly GetEntry[], siteHost: string): GetEntry[] =>
  entries.map((e) => ({ ...e, external: e.href !== undefined && classifyHref(e.href, siteHost) === 'external' }));

/** The text for a get slot with nothing to link (ux 5.2, 6.2). */
function unavailableText(project: ProjectData, typeTag: Tag | null): string {
  const notice = project.notice;
  if (notice?.kind === 'local') return NOT_DISTRIBUTED_LOCAL;
  if (notice?.kind === 'private') return notDistributedPrivate(notice.what ?? typeTag?.label);
  if (notice?.kind === 'retired') return NO_LONGER_DISTRIBUTED;
  return project.status === 'retired' ? NO_LONGER_DISTRIBUTED : NOT_DISTRIBUTED_LOCAL;
}

function buildGetSlot(project: ProjectData, layout: Layout, links: readonly GetEntry[], typeTag: Tag | null): GetSlot {
  if (links.length > 0) return { kind: 'links', links };
  const hasNone = project.get.some((g) => g.kind === 'none');
  if (!hasNone && layout === 'plugin') return { kind: 'text', text: NOT_DISTRIBUTED_YET };
  return { kind: 'text', text: unavailableText(project, typeTag) };
}

const buildSourceSlot = (source: ProjectData['source']): SourceSlot =>
  source === undefined ? { kind: 'text', text: SOURCE_NOT_AVAILABLE } : { kind: 'link', label: source.host, href: source.url };

function buildNotice(notice: ProjectData['notice'], typeTag: Tag | null): Notice | undefined {
  if (notice === undefined) return undefined;
  return {
    kind: notice.kind,
    label: noticeLabel(notice.kind, notice.what ?? typeTag?.label),
    text: notice.text,
    ...maybe('date', notice.date),
  };
}

// --- Bookmarks

interface BookmarkContext {
  readonly relations: ReadonlyMap<string, Relation>;
  readonly projectRefs: ReadonlyMap<string, { slug: string; name: string; path: string }>;
}

function buildBookmark(data: BookmarkData, groupId: string, ctx: BookmarkContext): Bookmark {
  const relation = ctx.relations.get(data.relation);
  return {
    name: data.name,
    url: data.url,
    host: hostOf(data.url) ?? data.url,
    note: data.note,
    ...maybe('relation', relation),
    ...maybe('author', data.author),
    projects: (data.projects ?? []).flatMap((slug) => ctx.projectRefs.get(slug) ?? []),
    groupId,
  };
}

// --- Whole site

export function normalise(resolved: ParsedSite): SiteModel {
  if (resolved.site === null) throw new Error('normalise needs a valid [site] section; the content gate must stop earlier');
  const { url: siteUrl, description } = resolved.site.data;
  const siteHost = hostOf(siteUrl) ?? siteUrl;

  const configs = resolved.categories.map((c) => c.data);
  const byCategory = new Map<string, ParsedProject[]>(configs.map((c) => [c.id, []]));
  for (const parsed of resolved.projects) byCategory.get(parsed.data.category)?.push(parsed);

  const projectsBySlug = new Map<string, Project>();
  const categoryProjects = new Map<string, Project[]>();
  const categoryTags = new Map<string, Tag[]>();
  const seeAlsoElsewhere = new Map<string, Bookmark[]>();
  const seeAlsoMine = new Map<string, Project[]>();

  for (const cfg of configs) {
    const parsedProjects = byCategory.get(cfg.id) ?? [];
    const counts = new Map<string, number>();
    for (const p of parsedProjects) for (const t of validTagData(cfg, p.data)) counts.set(t.id, (counts.get(t.id) ?? 0) + 1);
    const tags = cfg.tags.filter((t) => counts.has(t.id)).map((t) => toTag(t, counts.get(t.id) ?? 0));
    categoryTags.set(cfg.id, tags);
    const tagById = new Map(tags.map((t) => [t.id, t]));

    const projects = parsedProjects.map((p) => {
      const elsewhere: Bookmark[] = [];
      const mine: Project[] = [];
      const project = buildProject(p, cfg, tagById, siteHost, { mine, elsewhere });
      seeAlsoElsewhere.set(project.slug, elsewhere);
      seeAlsoMine.set(project.slug, mine);
      return project;
    });
    categoryProjects.set(cfg.id, sortRows(projects, 'default', 'asc'));
  }

  const published = configs.filter((c) => (categoryProjects.get(c.id)?.length ?? 0) > 0 || c.show_empty === true);
  const publishedIds = new Set(published.map((c) => c.id));

  for (const cfg of published) {
    const projects = categoryProjects.get(cfg.id) ?? [];
    for (const project of projects) {
      projectsBySlug.set(project.slug, project);
      seeAlsoMine.get(project.slug)?.push(...projects.filter((p) => p !== project).slice(0, SEE_ALSO_MINE_MAX));
    }
  }

  const relations: Relation[] = resolved.relations.map((r) => ({ id: r.data.id, description: r.data.description }));
  const bookmarkCtx: BookmarkContext = {
    relations: new Map(relations.map((r) => [r.id, r])),
    projectRefs: new Map([...projectsBySlug.values()].map((p) => [p.slug, { slug: p.slug, name: p.name, path: p.path }])),
  };

  const freeGroupIds = new Set(resolved.groups.map((g) => g.data.id));
  const bookmarksByGroup = new Map<string, Bookmark[]>();
  for (const { data } of resolved.bookmarks) {
    const groupId =
      data.category !== undefined && publishedIds.has(data.category)
        ? data.category
        : data.category === undefined && data.group !== undefined && freeGroupIds.has(data.group)
          ? data.group
          : GENERAL_GROUP;
    const bookmark = buildBookmark(data, groupId, bookmarkCtx);
    bookmarksByGroup.set(groupId, [...(bookmarksByGroup.get(groupId) ?? []), bookmark]);
    for (const ref of bookmark.projects) seeAlsoElsewhere.get(ref.slug)?.push(bookmark);
  }

  const categories: Category[] = published.map((cfg) => ({
    id: cfg.id,
    label: cfg.label,
    shortLabel: cfg.short_label ?? cfg.label,
    blurb: cfg.blurb,
    blurbFirstSentence: firstSentence(cfg.blurb),
    accent: cfg.accent,
    showEmpty: cfg.show_empty === true,
    ...maybe('repoUrl', cfg.repo_url),
    tags: categoryTags.get(cfg.id) ?? [],
    projects: categoryProjects.get(cfg.id) ?? [],
    bookmarks: bookmarksByGroup.get(cfg.id) ?? [],
  }));

  const groups: BookmarkGroup[] = [
    ...published.map((cfg) => ({
      id: cfg.id,
      label: cfg.label,
      kind: 'category' as const,
      accent: cfg.accent,
      bookmarks: bookmarksByGroup.get(cfg.id) ?? [],
    })),
    ...resolved.groups.map(({ data }) => ({
      id: data.id,
      label: data.label,
      kind: 'group' as const,
      accent: FREE_GROUP_ACCENT,
      bookmarks: bookmarksByGroup.get(data.id) ?? [],
    })),
    {
      id: GENERAL_GROUP,
      label: GENERAL_GROUP,
      kind: 'general' as const,
      accent: FREE_GROUP_ACCENT,
      bookmarks: bookmarksByGroup.get(GENERAL_GROUP) ?? [],
    },
  ].filter((g) => g.bookmarks.length > 0);

  const model: SiteModel = {
    site: { url: siteUrl, host: siteHost, description },
    whoami: buildWhoami(resolved.whoami),
    categories,
    projectsBySlug,
    bookmarks: groups,
    relations,
    updatesLog: buildUpdatesLog([...projectsBySlug.values()]),
    paths: [
      ...new Set([
        routes.home(),
        ...categories.map((c) => routes.category(c.id)),
        ...[...projectsBySlug.values()].map((p) => p.path),
        routes.bookmarks(),
      ]),
    ].sort(compareSlug),
    samples: resolved.samples,
  };
  return deepFreeze(model);
}

function buildProject(
  parsed: ParsedProject,
  cfg: CategoryData,
  tagById: ReadonlyMap<string, Tag>,
  siteHost: string,
  seeAlso: { mine: Project[]; elsewhere: Bookmark[] },
): Project {
  const { data } = parsed;
  const tags = validTagData(cfg, data).flatMap((t) => tagById.get(t.id) ?? []);
  const typeTag = tags.find((t) => t.isType) ?? null;
  const { layout } = resolveLayout(typeTag);
  const links = classify(buildGet(data, layout), siteHost);

  const base = {
    slug: data.slug,
    name: data.name,
    categoryId: cfg.id,
    status: data.status,
    summary: data.summary,
    priority: data.priority,
    updated: data.updated,
    ...maybe('version', data.version),
    typeTag,
    tags,
    ...maybe('licence', data.licence),
    ...maybe('source', data.source === undefined ? undefined : { host: data.source.host, url: data.source.url }),
    ...maybe('issues', data.issues),
    get: links,
    getSlot: buildGetSlot(data, layout, links, typeTag),
    sourceSlot: buildSourceSlot(data.source),
    ...maybe('notice', buildNotice(data.notice, typeTag)),
    ...maybe('caution', data.caution),
    screenshots: (data.screenshots ?? []).map((s) => ({
      file: `projects/${parsed.folderCategory}/${parsed.fileSlug}/${s.file}`,
      caption: s.caption,
    })),
    description: paragraphs(data.description),
    changelog: (data.changelog ?? []).map((c) => ({ version: c.version, date: c.date, items: [...c.items] })),
    ...maybe('changelogUrl', data.changelog_url),
    seeAlso,
    path: routes.project(cfg.id, data.slug),
  };

  if (layout === 'generic') return { ...base, layout } as Project;
  const { details } = parseDetails(layout, data, { file: parsed.file, entry: data.slug });
  if (details === undefined) throw new Error(`Project "${data.slug}" has no valid ${layout} details; the content gate must stop earlier`);
  return { ...base, layout, details } as Project;
}

/** Top projects by `updated`, newest first, ties by slug. The note is the first item of the current version's changelog entry. */
function buildUpdatesLog(projects: readonly Project[]): UpdateEntry[] {
  return [...projects]
    .sort((a, b) => compareSlug(b.updated, a.updated) || compareSlug(a.slug, b.slug))
    .slice(0, UPDATES_LOG_SIZE)
    .map((p) => ({
      date: p.updated,
      categoryId: p.categoryId,
      slug: p.slug,
      ...maybe('version', p.version),
      note: p.changelog.find((c) => c.version === p.version)?.items[0] ?? p.summary,
      path: p.path,
    }));
}
