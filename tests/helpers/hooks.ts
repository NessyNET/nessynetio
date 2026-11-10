// Data hooks, section ids and class names shared by components, unit tests and Playwright specs.
// Surveyed from the r8 mocks (docs/ux/mocks/terminal-iterations/v1-windows-r8/) and docs/ux/checks/r8-acceptance.mjs.
// Additions need Heimdall (plan 3.3). Selector strings use CSS syntax; ids and class names are bare.

/** Data-attribute hooks, as CSS selectors. */
export const HOOKS = {
  // Category pages (ffxiv, minecraft, linux, other): chip row, "+N more" panel and project rows.
  chiprow: '[data-chiprow]', // tag chip row
  more: '[data-more]', // the "+N more" toggle button
  morepanel: '[data-morepanel]', // overflow panel of chips
  tag: '[data-tag]', // chip and row hashtag, value = tag id (the harness reads dataset.tag)
  tags: '[data-tags]', // project row, value = space-separated tag ids
  name: '[data-name]', // project row slug (sort key)
  updated: '[data-updated]', // project row updated date (sort key)
  priority: '[data-priority]', // project row priority (sort key)
  status: '[data-status]', // project row status (sort key)
  filterTarget: '[data-filter-target]', // the rows list the script filters and sorts
  sortField: '[data-sort-field]', // the sort <select>
  sortDir: '[data-sort-dir]', // the direction button
  lsArg: '[data-ls-arg]', // flags in the `ls` prompt
  tagName: '[data-tag-name]', // status line "tag:" value
  sortName: '[data-sort-name]', // status line "sort:" value
  count: '[data-count]', // "N projects" in the window title and sort row
  empty: '[data-empty]', // empty-filter message
  term: '[data-term]', // "#tag" inside the empty-filter message
  clear: '[data-clear]', // "show all" button in the empty-filter message
  // Copy buttons (ffxiv.html repo.json, project.html INSTALL, linux-tool.html, mc-modpack.html, noshots.html).
  copy: '[data-copy]', // button, value = the text to copy
  label: '[data-label]', // the button's text span
  // `data-state` ("copied" | "failed") is set at runtime on the copy button by the mock script (all pages).
  state: '[data-state]',
  // 404.html.
  badpath: '[data-badpath]', // the requested path (body code element and status line)
  suggest: '[data-suggest]', // "did you mean" block (hidden until there are matches)
  suggestList: '[data-suggest-list]', // its list
} as const;

/** `section[aria-labelledby]` ids of windows (`sec-w-*`). The title element id is the same name without `sec-` (TITLES). */
export const SECTIONS = {
  who: 'sec-w-who', // index.html, index-longbio.html: whoami window
  links: 'sec-w-links', // index.html, index-longbio.html: links.txt
  ls: 'sec-w-ls', // category pages, index.html, empty-category.html: the projects / ls window
  h: 'sec-w-h', // category pages, empty-category.html: header window
  repo: 'sec-w-repo', // ffxiv.html: repo.json window
  bm: 'sec-w-bm', // ffxiv.html, linux.html, minecraft.html: category bookmarks window
  readme: 'sec-w-readme', // every project page: README.md
  inst: 'sec-w-inst', // project.html, noshots.html, linux-tool.html, mc-modpack.html, mc-mod.html: INSTALL.md
  stat: 'sec-w-stat', // every project page: stat window
  see: 'sec-w-see', // every project page: see also
  shots: 'sec-w-shots', // project pages with screenshots (absent in noshots.html)
  desc: 'sec-w-desc', // project pages with a description window
  log: 'sec-w-log', // index.html (updates.log) and project pages (CHANGELOG)
  what: 'sec-w-what', // webtool.html: what it does
  prev: 'sec-w-prev', // webtool.html: preview
  ver: 'sec-w-ver', // mc-mod.html: versions
  dep: 'sec-w-dep', // mc-mod.html: dependencies
  mods: 'sec-w-mods', // mc-modpack.html: mods.txt
  man: 'sec-w-man', // linux-tool.html: man page
  dist: 'sec-w-dist', // linux-tool.html: distros
  cmd: 'sec-w-cmd', // other-bot.html: commands
  rel: 'sec-w-rel', // bookmarks.html: relations legend
  bh: 'sec-w-bh', // bookmarks.html: header window
  notfound: 'sec-w-404', // 404.html: the zsh window
} as const;

/** Window title ids (`w-*`), the targets of `aria-labelledby`. Same keys as SECTIONS. */
export const TITLES = {
  who: 'w-who',
  links: 'w-links',
  ls: 'w-ls',
  h: 'w-h',
  repo: 'w-repo',
  bm: 'w-bm',
  readme: 'w-readme',
  inst: 'w-inst',
  stat: 'w-stat',
  see: 'w-see',
  shots: 'w-shots',
  desc: 'w-desc',
  log: 'w-log',
  what: 'w-what',
  prev: 'w-prev',
  ver: 'w-ver',
  dep: 'w-dep',
  mods: 'w-mods',
  man: 'w-man',
  dist: 'w-dist',
  cmd: 'w-cmd',
  rel: 'w-rel',
  bh: 'w-bh',
  notfound: 'w-404',
} as const satisfies Record<keyof typeof SECTIONS, string>;

/** bookmarks.html: one window per non-empty group; section id and title id (the title id is the `routes.bookmarkGroup` anchor). */
export const bookmarkSection = (groupId: string): string => `sec-bm-${groupId}`;
export const bookmarkTitle = (groupId: string): string => `bm-${groupId}`;

/** Other fixed element ids. */
export const IDS = {
  main: 'main', // every page: <main id="main"> (skip-link target)
  live: 'live', // every page: the aria-live region
  install: 'install', // project pages with INSTALL.md: wrapper (target of `#install`)
  knownPaths: 'known-paths', // 404.html: <script type="application/json"> with the published paths
  moreTags: 'more-tags', // category pages: id of the overflow panel (aria-controls of the "+N more" button)
  sortField: 'sort-field', // category pages: the sort <select> (label target)
  flabel: 'flabel', // category pages: id of the tag row label (aria-labelledby of the chip group)
} as const;

/** Class names the harness selects (bare names; prefix with `.` for selectors). */
export const CLASSES = {
  statusline: 'statusline', // every page: footer
  tmux: 'tmux', // every page: tab bar
  screen: 'screen', // every page: content wrapper (width checks)
  win: 'win', // every window
  tt: 'tt', // window title
  ls: 'ls', // index.html: the `ls -l` table
  bms: 'bms', // bookmarks.html: bookmark rows
  jump: 'jump', // bookmarks.html: jump row
  chip: 'chip', // category pages: tag chip
  desc: 'desc', // category pages: tag description inside a panel chip
  tag: 'tag', // row hashtag button / metaline tag
  getbar: 'getbar', // project pages: get/source bar
  btnOpen: 'btn-open', // webtool.html: primary "Open tool" button
  leaves: 'leaves', // webtool.html: separate site notice
  emptycat: 'emptycat', // empty-category.html: "Nothing here yet."
  controls: 'controls', // category pages: tag and sort controls (hidden without JS)
  rows: 'rows', // category pages: project rows list
  copy: 'copy', // copy button
  more: 'more', // "+N more" button
  copyrow: 'copyrow', // code field + copy button
  tree404: 'tree404', // 404.html: "or try" list
  home404: 'home404', // 404.html: home link
  bio: 'bio', // index.html: bio paragraph
  st: 'st', // status word ([active] / [retired])
  ext: 'ext', // external bookmark link
  xa: 'xa', // external arrow span (Link.astro)
  srOnly: 'sr-only', // visually hidden text (Link.astro)
  cmdline: 'cmdline', // decorative prompt line
} as const;
