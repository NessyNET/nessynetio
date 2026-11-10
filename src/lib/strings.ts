// Every fixed UI string (ux 6.2, notice labels from 6.3 / R24) and fixed layout copy that is not owner content.
// Templates never compose user-facing wording ad hoc (design 4 "Wording").

import type { SortDir, SortMode } from './sort.ts';

export type NoticeKind = 'local' | 'private' | 'retired' | 'separate';

const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

export const projectCount = (n: number): string => plural(n, 'project', 'projects');
export const linkCount = (n: number): string => plural(n, 'link', 'links');

// --- Get and source slots (ux 5.2, 6.2)
export const SOURCE_NOT_AVAILABLE = 'Source not available';
export const NOT_DISTRIBUTED_LOCAL = 'Not distributed (local only)';
export const NO_LONGER_DISTRIBUTED = 'No longer distributed';
/** Dev-only (ux 5.11, 6.2): plugin without `repo_url` and no other get entry. `--strict` blocks it, so it never ships. */
export const NOT_DISTRIBUTED_YET = 'Not distributed yet';
export const SEE_INSTALL = 'see install';
export const INSTALL_ON_CARD = 'install';

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

export const emptyFilter = (tag: string, categoryLabel: string): string =>
  `${projectCount(0)} tagged #${tag} in ${categoryLabel}.`;
export const showAllProjects = (categoryLabel: string): string => `show all ${categoryLabel} projects`;

export const moreToggle = (n: number): string => `+${n} more`;
export const moreToggleName = (n: number): string => plural(n, 'more tag', 'more tags');

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
export const BOOKMARKS_INTRO_LEAD = 'Not my projects. Things my projects run on, docs I learned from, and work that inspired me.';
export const BOOKMARKS_INTRO_EMPHASIS = 'Every link here opens another site in a new tab.';

// --- Project page (ux 4.3, 5.6)
export const SEE_ALSO_MINE = 'more by me';
export const SEE_ALSO_ELSEWHERE = 'elsewhere (not mine)';
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

// --- Chrome
export const SKIP_LINK = 'Skip to content';
