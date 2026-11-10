// Page map for the e2e specs: page type to real URL in the site-e2e build (and site-stress). Slugs come from the
// fixtures in tests/fixtures/site-e2e; the comment names the variant each one stands for (ux 0.2, design 5.2).

export interface PageSpec {
  readonly name: string;
  readonly path: string;
  /** Which build serves it. */
  readonly site: 'e2e' | 'stress';
}

const e2e = (name: string, path: string): PageSpec => ({ name, path, site: 'e2e' });
const stress = (name: string, path: string): PageSpec => ({ name, path, site: 'stress' });

export const E2E_PAGES: readonly PageSpec[] = [
  e2e('landing', '/'),
  e2e('ffxiv', '/ffxiv/'),
  e2e('minecraft', '/minecraft/'),
  e2e('linux', '/linux/'),
  e2e('other', '/other/'),
  e2e('bookmarks', '/bookmarks/'),
  e2e('plugin', '/ffxiv/loch-lantern/'),
  e2e('local', '/ffxiv/peat-fishing-log/'),
  e2e('retired', '/ffxiv/kelpie-chat-tabs/'),
  e2e('noshots', '/ffxiv/mist-macro-editor/'),
  e2e('webtool', '/ffxiv/gorse-gearplanner/'),
  e2e('mc-mod', '/minecraft/peatmoss/'),
  e2e('mc-modpack', '/minecraft/highland-pack/'),
  e2e('linux-tool', '/linux/lochctl/'),
  e2e('other-bot', '/other/ripple-bot/'),
  e2e('generic', '/other/loch-depth/'),
  e2e('404', '/ffxiv/loch-lanter'),
];

export const STRESS_PAGES: readonly PageSpec[] = [
  stress('landing-longbio', '/'),
  stress('empty-category', '/terraria/'),
  stress('many-tags', '/ffxiv/'),
];

export const ALL_PAGES: readonly PageSpec[] = [...E2E_PAGES, ...STRESS_PAGES];

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

/** ux 11 check 1 widths. */
export const WIDTHS: readonly Viewport[] = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 900 },
  { width: 1024, height: 768 },
  { width: 768, height: 1024 },
  { width: 390, height: 844 },
];

/** Widths just above the 900 px breakpoint (1024 is already in WIDTHS), where wide content first has to fit the narrow desktop layout. */
export const OVERFLOW_WIDTHS: readonly Viewport[] = [901, 950, 1100].map((width) => ({ width, height: 800 }));

/** The extra width for the overflow check (SC 1.4.10). */
export const NARROW: Viewport = { width: 320, height: 640 };

export const STRESS_URL = process.env['E2E_STRESS_URL'] ?? 'http://127.0.0.1:4322';
export const BASE_URL = process.env['E2E_BASE_URL'] ?? 'http://127.0.0.1:4321';

/** Absolute URL of a page (the stress pages live on their own origin). */
export const urlOf = (page: PageSpec): string => new URL(page.path, page.site === 'stress' ? STRESS_URL : BASE_URL).href;
