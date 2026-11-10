// Every fixed UI string (ux 6.2, notice labels from 6.3 / R24) and fixed layout copy that is not owner content.
// Templates never compose user-facing wording ad hoc (design 4 "Wording").

import type { SortDir, SortMode } from './sort.ts';

export type NoticeKind = 'local' | 'private' | 'retired' | 'separate';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const projectCount = (n: number): string => plural(n, 'project', 'projects');
export const linkCount = (n: number): string => plural(n, 'link', 'links');
export const dirCount = (n: number): string => plural(n, 'dir', 'dirs');

// --- Get and source slots (ux 5.2, 6.2)
export const SOURCE_NOT_AVAILABLE = 'Source not available';
export const NOT_DISTRIBUTED_LOCAL = 'Not distributed (local only)';
export const NO_LONGER_DISTRIBUTED = 'No longer distributed';
/** Dev-only (ux 5.11, 6.2): plugin without `repo_url` and no other get entry. `--strict` blocks it, so it never ships. */
export const NOT_DISTRIBUTED_YET = 'Not distributed yet';
export const SEE_INSTALL = 'see install';
export const INSTALL_ON_CARD = 'install';
/** Dim prefixes of the project-page get/source bar (ux 5.2, 7.10), and the source link label in category rows. */
export const GET_BAR_PREFIX = 'get: ';
export const SOURCE_BAR_PREFIX = 'source: ';
export const SOURCE_ROW_LABEL = 'source';

export const notDistributedPrivate = (kind?: string): string => `Not distributed (${privateLabel(kind)})`;
/** `download v{version}`, or bare `download` when the project has no version (ux 6.2, design 3.3 `[[get]]` table). */
export const downloadLabel = (version?: string): string => (version === undefined ? 'download' : `download v${version}`);
export const openTool = (host: string): string => `Open tool: ${host}`;

// --- Notices (ux 6.3, 7.11; R24)
export const NOTICE_LABELS = {
  local: 'local only',
  /** Bare prefix; use `privateLabel` for the full label. */
  private: 'private',
  retired: 'retired',
  separate: 'separate site',
  warn: 'warn',
} as const;

/** `private {what}`, or bare `private` when `what` is absent (only the dev-only zero-type-tag fallback). */
export const privateLabel = (what?: string): string =>
  what === undefined ? NOTICE_LABELS.private : `${NOTICE_LABELS.private} ${what}`;

export const noticeLabel = (kind: NoticeKind, what?: string): string =>
  kind === 'private' ? privateLabel(what) : NOTICE_LABELS[kind];

/** First sentence of a retired notice (ux 7.12 notice `date`). */
export const retiredOn = (date: string): string => `Retired on ${date}.`;

// --- External links (ux 7.15)
export const EXTERNAL_ARROW = '↗';
export const OPENS_IN_NEW_TAB = ' (opens in new tab)';

// --- Copy (ux 5.1, 7.16)
export const COPY_LABEL = 'copy';
export const COPIED_LABEL = 'copied';
export const COPY_FAILED_LABEL = 'press Ctrl+C';
export const COPIED_ANNOUNCEMENT = 'Copied to clipboard';
export const COPY_FAILED_ANNOUNCEMENT = 'Could not copy. The text is selected; press Ctrl+C.';
export const copyName = (what: string): string => `Copy ${what}`;

// --- Category filter, tag row and sort (ux 7.6, 7.7)
const MODE_PHRASE: Record<SortMode, string> = { default: 'default ranking', name: 'name', updated: 'last updated' };
const DIR_PHRASE: Record<SortDir, string> = { asc: 'ascending', desc: 'descending' };

export function filterAnnouncement(o: { count: number; tag?: string; mode: SortMode; dir: SortDir }): string {
  const tagged = o.tag === undefined ? '' : ` tagged ${o.tag}`;
  return `${projectCount(o.count)}${tagged}, sorted by ${MODE_PHRASE[o.mode]}, ${DIR_PHRASE[o.dir]}`;
}

/** Pieces of the empty-filter sentence, so the page can leave `#tag` to the script (`emptyFilter` composes them). */
export const EMPTY_FILTER_TAGGED = ' tagged ';
export const emptyFilterTail = (categoryLabel: string): string => ` in ${categoryLabel}.`;
export const emptyFilter = (tag: string, categoryLabel: string): string =>
  `${projectCount(0)}${EMPTY_FILTER_TAGGED}#${tag}${emptyFilterTail(categoryLabel)}`;
export const showAllProjects = (categoryLabel: string): string => `show all ${categoryLabel} projects`;

export const moreToggle = (n: number): string => `+${n} more`;
export const moreToggleName = (n: number): string => plural(n, 'more tag', 'more tags');

export const TAG_LABEL = 'tag';
export const TAG_HASH = '#';
export const MORE_TAGS_LABEL = 'More tags';
export const tagsFor = (project: string): string => `Tags for ${project}`;

export const SORT_LABEL = 'sort';
export const SORT_OPTIONS: Readonly<Record<SortMode, string>> = {
  default: 'default (ranked)',
  name: 'alphabetical',
  updated: 'updated',
};
export const sortDirLabel = (dir: SortDir): string => (dir === 'asc' ? 'asc ↑' : 'desc ↓');
export const sortDirName = (dir: SortDir): string => `Sort direction: ${DIR_PHRASE[dir]}. Activate to reverse.`;

// --- Landing and bookmarks (ux 4.1, 4.4)
export const BOOKMARKS_ROW_DESCRIPTION = "Other people's work I use, learned from, or admire";
export const BOOKMARKS_ROW_SUFFIX = '(external links)';
export const BOOKMARKS_ROW_NAME = 'bookmarks';
export const BOOKMARKS_ROW_TARGET = '-> elsewhere';
export const ALL_BOOKMARKS = 'all bookmarks';

export const WHOAMI_TITLE = 'whoami';
/** The shell named in window titles and metas (landing `whoami`, the 404 window). */
export const SHELL_NAME = 'zsh';
export const LINKS_TITLE = 'links.txt';
export const LINKS_CMD = 'cat links.txt';
export const LINK_KEY_GITHUB = 'github';
export const LINK_KEY_MAIL = 'mail';
export const LS_TITLE = 'projects';
export const LS_CMD = 'ls -l ~';
/** Screen-reader caption of the `ls` table. */
export const LS_CAPTION = 'Project categories, and the link to bookmarks';
/** Header of the `ls` table: permissions, name, count, description. */
export const LS_COLUMNS = ['mode', 'name', 'items', 'contents'] as const;
export const lsMeta = (projects: number, links: number): string => `${projectCount(projects)} · ${linkCount(links)}`;
export const LOG_TITLE = 'updates.log';
export const LOG_CMD = 'tail -n 4 updates.log';
export const BOOKMARKS_INTRO_LEAD = 'Not my projects. Things my projects run on, docs I learned from, and work that inspired me.';
export const BOOKMARKS_INTRO_EMPHASIS = 'Every link here opens another site in a new tab.';
export const BOOKMARKS_PATH = '~/bookmarks';
export const BOOKMARKS_CD_CMD = 'cd ~/bookmarks';
/** Prefix of the jump row of group links. */
export const JUMP_CD = 'cd';
export const RELATIONS_TITLE = 'relations';
export const RELATIONS_CMD = 'cat .relations';
export const RELATED_LABEL = 'related:';
export const byAuthor = (author: string): string => `by ${author}`;
export const groupTitle = (id: string): string => `${id}/`;
/** `N link(s) · external`, plus ` · group` for a free group (ux 4.4). */
export const groupMeta = (count: number, free: boolean): string => `${linkCount(count)} · ${STATUS_EXTERNAL}${free ? ' · group' : ''}`;
/** Decorative `ls -l` permission columns (landing table, bookmark rows). */
export const PERMISSIONS_DIR = 'drwxr-xr-x';
export const PERMISSIONS_LINK = 'lrwxrwxrwx';

// --- Category page (ux 4.2, 7.9; mocks ffxiv.html)
export const categoryPath = (id: string): string => `~/${id}`;
export const cdCmd = (id: string): string => `cd ${categoryPath(id)}`;
export const lsCategoryCmd = (id: string): string => `ls ${categoryPath(id)}`;
export const lsBookmarksCmd = (groupId: string): string => `ls -l ~/bookmarks/${groupId}`;
export const REPO_TITLE = 'repo.json';
export const REPO_INTRO = 'One Dalamud custom repository for every plugin:';
export const REPO_COPY_WHAT = 'repository URL';
export const CATEGORY_BOOKMARKS_TITLE = 'bookmarks';
export const AVAILABILITY_LABEL = 'Availability';
export const versionLabel = (version: string): string => `v${version}`;
export const UPDATED_PREFIX = 'updated ';

// --- Project page (ux 4.3, 5.6)
export const SEE_ALSO_MINE = 'more by me';
export const SEE_ALSO_ELSEWHERE = 'elsewhere (not mine)';
export const README_TITLE = 'README.md';
export const STAT_TITLE = 'stat';
export const statCmd = (slug: string): string => `stat ${slug}`;
export const statCaption = (name: string): string => `Details of ${name}`;
export const issuesLabel = (host?: string): string => (host === undefined ? 'issues' : `${host} issues`);
/** Fallback link of "more by me" when the category has no other project (ux 5.1). */
export const allProjectsOf = (categoryId: string): string => `all ${categoryId} projects`;
export const SEE_ALSO_TITLE = 'see also';
export const DESCRIPTION_TITLE = 'description';
export const DESCRIPTION_CMD = 'cat README.md | tail';
export const CHANGELOG_TITLE = 'CHANGELOG';
export const CHANGELOG_CMD = 'git log --tags';
export const FULL_HISTORY = 'full history';
export const PROJECT_DETAILS_LABEL = 'Project details';
export const INSTALL_TITLE = 'INSTALL.md';
export const INSTALL_CMD = 'cat INSTALL.md';
export const REQUIRES_LABEL = 'requires';
export const REPO_URL_COPY_NAME = 'repository URL';
/** Offline layout: one step per download get entry, then the requirement. */
/** Offline install: the prerequisite comes first, then one step listing every download. */
export const offlineRequiresStep = (requires: string): string => `Check that you have ${requires}.`;
export const offlineGetLead = (name: string): string => `Get ${name}: `;
/** Joins several download links in one step (offline and mod). */
export const GET_OR = ' or ';
export const WHAT_TITLE = 'what it does';
export const whatCmd = (slug: string): string => `${slug} --help`;
export const PREVIEW_TITLE = 'preview';
export const PREVIEW_CMD = 'ls screenshots/';
export const OPEN_TOOL_BUTTON = 'Open tool';
export const STAT_HOST = 'host';
export const STAT_RUNS_IN = 'runs in';
export const STAT_ACCOUNT = 'account';
export const STAT_DATA = 'data';
export const SCREENSHOTS_TITLE = 'screenshots/';
export const SCREENSHOTS_CMD = 'ls screenshots/';
export const WEB_PREVIEW_CAPTION = 'A screenshot, not a live embed. Use "Open tool" for the real thing.';

/** A run of text inside a step; `projectName` is replaced by the project's name. */
export type StepPart =
  | { readonly kind: 'text' | 'code' | 'strong'; readonly text: string }
  | { readonly kind: 'projectName' };

export interface DalamudStep {
  readonly parts: readonly StepPart[];
  /** The category repo URL copy field follows this step. */
  readonly repoUrlCopy?: true;
}

const t = (text: string): StepPart => ({ kind: 'text', text });
const code = (text: string): StepPart => ({ kind: 'code', text });
const strong = (text: string): StepPart => ({ kind: 'strong', text });

/** Shared Dalamud custom-repo steps (design 3.3.1; wording from the r8 `project.html` INSTALL window). */
export const DALAMUD_STEPS: readonly DalamudStep[] = [
  { parts: [t('In game, run '), code('/xlsettings'), t(' and open '), strong('Experimental'), t('.')] },
  {
    parts: [
      t('Under '),
      strong('Custom Plugin Repositories'),
      t(', add this URL, tick '),
      strong('Enabled'),
      t(', save:'),
    ],
    repoUrlCopy: true,
  },
  { parts: [t('Run '), code('/xlplugins'), t(', search '), { kind: 'projectName' }, t(', install.')] },
];

// --- 404 (ux 4.5)
export const NOT_FOUND_EXIT = 'exit 1';
/** Decorative prompt text before the visible bad path. */
export const CD_PROMPT = 'cd ';
/** Dim note after the `bookmarks/` entry of the "or try" list. */
export const OR_TRY_BOOKMARKS_NOTE = 'external links';
export const NOT_FOUND_HEADING = '404: no such file or directory';
export const NOT_FOUND_BEFORE_PATH = 'Nothing lives at ';
export const NOT_FOUND_AFTER_PATH = '. It may have moved or been renamed, or the link has a typo.';
/** Shown in place of the path when JavaScript is off (ux 5.10). */
export const NOT_FOUND_PATH_FALLBACK = 'this address';
export const DID_YOU_MEAN = 'did you mean';
export const OR_TRY = 'or try';
export const GO_HOME = 'Go to the home page';

// --- Empty category (ux 5.8)
export const EMPTY_CATEGORY_LEAD = 'Nothing here yet.';
export const emptyCategoryBody = (what: string): string =>
  `This section is set up for ${what}, but none are published. Meanwhile, see `;
export const EMPTY_CATEGORY_LINK = 'all projects';

// --- Chrome (ux 3.3, 4.1 to 4.5, 7.5)
export const SKIP_LINK = 'Skip to content';
export const BRAND = 'nessynet';
export const MODE_CELL = 'NESSY';
export const TAB_HOME = 'home';
export const TAB_BOOKMARKS = 'bookmarks';
export const STATUS_EXTERNAL = 'external';
export const STATUS_404 = '404';
/** Right cell of the status line on an opt-in empty category (r8 `empty-category.html`). */
export const STATUS_EMPTY = 'empty';
export const STATUS_NOT_FOUND = 'not found';
export const TAG_PREFIX = 'tag:';
export const SORT_PREFIX = 'sort:';
/** Initial values of the live status-line cells, before the category script runs. */
export const TAG_INITIAL = 'all';
export const SORT_INITIAL = 'default';

// --- Page titles (ux 3.2)
export const TITLE_BOOKMARKS = 'Bookmarks';
export const TITLE_NOT_FOUND = 'Not found';

// --- Other project layouts (ux 4.3): mod, modpack, tool, bot. Wording is provisional (Freya).
export const modLoaderStep = (loader: string): readonly StepPart[] => [
  t('Install the '),
  strong(loader),
  t(' loader for your Minecraft version (see '),
  strong('versions'),
  t(').'),
];
export const modGetLead = (name: string) => `Get ${name} from `;
export const MOD_DROP_STEP: readonly StepPart[] = [t('Put the '), code('.jar'), t(' and its required dependencies in your '), code('mods/'), t(' folder.')];
export const MOD_VERSIONS_TITLE = 'versions';
export const MOD_VERSIONS_CMD = 'ls releases/';
export const MOD_VERSIONS_CAPTION = 'Compatible files';
export const MOD_VERSIONS_COLUMNS = ['minecraft', 'loader', 'file', 'released'] as const;
export const MOD_DEPS_TITLE = 'dependencies';
export const MOD_DEPS_CMD = 'cat fabric.mod.json | jq .depends';
export const MOD_DEPS_CAPTION = 'Dependencies';
export const MOD_DEPS_COLUMNS = ['mod', 'need', 'why'] as const;
export const MOD_STAT = { loader: 'loader', minecraft: 'minecraft', side: 'side' } as const;
export const packLauncherStep = (launcher: string | undefined) => `Install ${launcher ?? 'a launcher that can import modpacks'}.`;
export const PACK_IMPORT_STEP: readonly StepPart[] = [t('Choose '), strong('Add Instance'), t(', then '), strong('Import'), t(', and paste this link:')];
export const PACK_IMPORT_COPY_NAME = 'import link';
export const packRamStep = (gb: number) => `Allocate at least ${gb} GB of RAM to the instance, then launch it.`;
export const PACK_MODS_TITLE = 'mods.txt';
export const packModsMeta = (n: number) => `${n} ${n === 1 ? 'mod' : 'mods'}`;
export const packModsCmd = (n: number): string => `head -n ${n} mods.txt`;
export const PACK_MODS_CAPTION = 'Mods in this pack';
export const PACK_MODS_COLUMNS = ['mod', 'version', 'by'] as const;
export const PACK_BY_ME = 'me';
export const PACK_BY_OTHER = 'other';
export const packShowing = (shown: number, total: number) => `Showing ${shown} of ${total} ${total === 1 ? 'mod' : 'mods'}.`;
export const PACK_FULL_LIST = 'Full list (mods.txt)';
export const PACK_STAT = { loader: 'loader', minecraft: 'minecraft', mods: 'mods', memory: 'memory' } as const;
export const packMemory = (gb: number) => `${gb} GB`;
export const toolCommandCopyName = (command: string) => `command: ${command}`;
export const toolManTitle = (slug: string) => `man ${slug}`;
export const TOOL_MAN_SECTIONS = { synopsis: 'SYNOPSIS', commands: 'COMMANDS', options: 'OPTIONS', example: 'EXAMPLE' } as const;
export const TOOL_EXAMPLE_COPY_NAME = 'example command';
export const TOOL_DIST_TITLE = 'distros';
export const TOOL_DIST_CMD = 'cat SUPPORT.md';
export const TOOL_DIST_CAPTION = 'Supported distributions';
export const TOOL_DIST_COLUMNS = ['distro', 'support', 'how'] as const;
export const TOOL_SUPPORT_WORDS = { supported: 'supported', untested: 'works, untested', unsupported: 'not supported' } as const;
export const TOOL_NO_VALUE = '-';
export const TOOL_STAT = { language: 'language', needs: 'needs', distros: 'distros' } as const;
export const BOT_COMMANDS_TITLE = 'commands';
export const botCommandsCmd = (slug: string) => `${slug} --help`;
export const BOT_COMMANDS_CAPTION = 'Bot commands';
export const BOT_COMMANDS_COLUMNS = ['command', 'what it does', 'who'] as const;
export const BOT_STAT = { platform: 'platform', hosting: 'hosting', invite: 'invite' } as const;
export const BOT_INVITE = { open: 'public', closed: 'not public' } as const;
