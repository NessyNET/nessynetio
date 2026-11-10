import { describe, expect, it } from 'vitest';
import * as s from '../../src/lib/strings.ts';
import type { StepPart } from '../../src/lib/strings.ts';

// Expected values are typed out literally from docs/ux.md 6.2 / 6.3 / 4.1 / 4.4 / 4.5 / 5.6 / 5.8,
// never built from the code under test.
describe('ux 6.2 fixed strings (verbatim)', () => {
  const table: [string, string, string][] = [
    ['source slot, no public source', s.SOURCE_NOT_AVAILABLE, 'Source not available'],
    ['get slot, local only', s.NOT_DISTRIBUTED_LOCAL, 'Not distributed (local only)'],
    ['get slot, private service', s.notDistributedPrivate('bot'), 'Not distributed (private bot)'],
    ['get slot, retired', s.NO_LONGER_DISTRIBUTED, 'No longer distributed'],
    ['get slot, plugin without repo_url (dev-only)', s.NOT_DISTRIBUTED_YET, 'Not distributed yet'],
    ['get link on its own page', s.SEE_INSTALL, 'see install'],
    ['get link on cards', s.INSTALL_ON_CARD, 'install'],
    ['get link, download with a version', s.downloadLabel('1.2.0'), 'download v1.2.0'],
    ['get link, download without a version', s.downloadLabel(), 'download'],
    ['get link, web tool', s.openTool('gear.nessynet.io'), 'Open tool: gear.nessynet.io'],
    ['external arrow', s.EXTERNAL_ARROW, '↗'],
    ['copy button', s.COPY_LABEL, 'copy'],
    ['copy button, success', s.COPIED_LABEL, 'copied'],
    ['copy button, failure', s.COPY_FAILED_LABEL, 'press Ctrl+C'],
    ['copy live region, success', s.COPIED_ANNOUNCEMENT, 'Copied to clipboard'],
    ['copy live region, failure', s.COPY_FAILED_ANNOUNCEMENT, 'Could not copy. The text is selected; press Ctrl+C.'],
    ['copy accessible name', s.copyName('repository URL'), 'Copy repository URL'],
    ['copy accessible name, command', s.copyName('command: yay -S lochctl'), 'Copy command: yay -S lochctl'],
    ['empty filter', s.emptyFilter('qol', 'minecraft'), '0 projects tagged #qol in minecraft.'],
    ['empty filter button', s.showAllProjects('minecraft'), 'show all minecraft projects'],
    ['more toggle', s.moreToggle(3), '+3 more'],
    ['more toggle accessible name', s.moreToggleName(3), '3 more tags'],
    ['sort label', s.SORT_LABEL, 'sort'],
    ['sort option default', s.SORT_OPTIONS.default, 'default (ranked)'],
    ['sort option name', s.SORT_OPTIONS.name, 'alphabetical'],
    ['sort option updated', s.SORT_OPTIONS.updated, 'updated'],
    ['sort direction asc', s.sortDirLabel('asc'), 'asc ↑'],
    ['sort direction desc', s.sortDirLabel('desc'), 'desc ↓'],
    ['sort direction name asc', s.sortDirName('asc'), 'Sort direction: ascending. Activate to reverse.'],
    ['sort direction name desc', s.sortDirName('desc'), 'Sort direction: descending. Activate to reverse.'],
    ['external link sr text', s.OPENS_IN_NEW_TAB, ' (opens in new tab)'],
    ['bookmarks intro, emphasised sentence', s.BOOKMARKS_INTRO_EMPHASIS, 'Every link here opens another site in a new tab.'],
    ['bookmarks intro, lead', s.BOOKMARKS_INTRO_LEAD, 'Not my projects. Things my projects run on, docs I learned from, and work that inspired me.'],
    ['see also, mine', s.SEE_ALSO_MINE, 'more by me'],
    ['see also, elsewhere', s.SEE_ALSO_ELSEWHERE, 'elsewhere (not mine)'],
    ['see also fallback link (reuses the empty-filter button)', s.showAllProjects('Final Fantasy XIV'), 'show all Final Fantasy XIV projects'],
    ['see also fallback link', s.allProjectsOf('ffxiv'), 'all ffxiv projects'],
    ['readme title', s.README_TITLE, 'README.md'],
    ['stat title', s.STAT_TITLE, 'stat'],
    ['stat command', s.statCmd('loch-lantern'), 'stat loch-lantern'],
    ['stat caption', s.statCaption('Loch Lantern'), 'Details of Loch Lantern'],
    ['issues link, with host', s.issuesLabel('GitHub'), 'GitHub issues'],
    ['issues link, no host', s.issuesLabel(), 'issues'],
    ['see also title', s.SEE_ALSO_TITLE, 'see also'],
    ['description title', s.DESCRIPTION_TITLE, 'description'],
    ['description command', s.DESCRIPTION_CMD, 'cat README.md | tail'],
    ['changelog title', s.CHANGELOG_TITLE, 'CHANGELOG'],
    ['changelog command', s.CHANGELOG_CMD, 'git log --tags'],
    ['changelog full history link', s.FULL_HISTORY, 'full history'],
    ['project aside label', s.PROJECT_DETAILS_LABEL, 'Project details'],
    ['install window title', s.INSTALL_TITLE, 'INSTALL.md'],
    ['install window command', s.INSTALL_CMD, 'cat INSTALL.md'],
    ['requires stat row', s.REQUIRES_LABEL, 'requires'],
    ['repo URL copy name', s.REPO_URL_COPY_NAME, 'repository URL'],
    ['web what window title', s.WHAT_TITLE, 'what it does'],
    ['web what window command', s.whatCmd('gorse-gearplanner'), 'gorse-gearplanner --help'],
    ['web preview window title', s.PREVIEW_TITLE, 'preview'],
    ['web preview window command', s.PREVIEW_CMD, 'ls screenshots/'],
    ['web open tool button', s.OPEN_TOOL_BUTTON, 'Open tool'],
    ['web stat host row', s.STAT_HOST, 'host'],
    ['web stat runs in row', s.STAT_RUNS_IN, 'runs in'],
    ['web stat account row', s.STAT_ACCOUNT, 'account'],
    ['web stat data row', s.STAT_DATA, 'data'],
    ['screenshots window title', s.SCREENSHOTS_TITLE, 'screenshots/'],
    ['screenshots window command', s.SCREENSHOTS_CMD, 'ls screenshots/'],
    ['404 heading', s.NOT_FOUND_HEADING, '404: no such file or directory'],
    ['404 sentence, before the path', s.NOT_FOUND_BEFORE_PATH, 'Nothing lives at '],
    ['404 sentence, after the path', s.NOT_FOUND_AFTER_PATH, '. It may have moved or been renamed, or the link has a typo.'],
    ['404 path with JS off', s.NOT_FOUND_PATH_FALLBACK, 'this address'],
    ['404 did you mean', s.DID_YOU_MEAN, 'did you mean'],
    ['404 or try', s.OR_TRY, 'or try'],
    ['404 home link', s.GO_HOME, 'Go to the home page'],
    ['empty category, lead', s.EMPTY_CATEGORY_LEAD, 'Nothing here yet.'],
    [
      'empty category, body',
      s.emptyCategoryBody('Terraria mods'),
      'This section is set up for Terraria mods, but none are published. Meanwhile, see ',
    ],
    ['empty category, link', s.EMPTY_CATEGORY_LINK, 'all projects'],
    ['skip link', s.SKIP_LINK, 'Skip to content'],
  ];

  it.each(table)('%s', (_context, actual, expected) => {
    expect(actual).toBe(expected);
  });
});

describe('other fixed copy (verbatim)', () => {
  it('web preview caption (ux 5.6)', () => {
    expect(s.WEB_PREVIEW_CAPTION).toBe('A screenshot, not a live embed. Use "Open tool" for the real thing.');
  });

  it('landing bookmarks row (ux 4.1)', () => {
    expect(s.BOOKMARKS_ROW_DESCRIPTION).toBe("Other people's work I use, learned from, or admire");
    expect(s.BOOKMARKS_ROW_SUFFIX).toBe('(external links)');
  });

  it('retired notice date (ux 7.12)', () => {
    expect(s.retiredOn('2025-03-04')).toBe('Retired on 2025-03-04.');
  });
});

describe('notice labels (ux 6.3, R24)', () => {
  it('fixed label set', () => {
    expect(s.NOTICE_LABELS).toEqual({
      local: 'local only',
      private: 'private',
      retired: 'retired',
      separate: 'separate site',
      warn: 'warn',
    });
  });

  it('privateLabel appends what, or is bare without it', () => {
    expect(s.privateLabel('bot')).toBe('private bot');
    expect(s.privateLabel()).toBe('private');
    expect(s.notDistributedPrivate()).toBe('Not distributed (private)');
  });

  it('noticeLabel maps a notice kind to its label', () => {
    expect(s.noticeLabel('local')).toBe('local only');
    expect(s.noticeLabel('private', 'bot')).toBe('private bot');
    expect(s.noticeLabel('private')).toBe('private');
    expect(s.noticeLabel('retired')).toBe('retired');
    expect(s.noticeLabel('separate')).toBe('separate site');
  });
});

describe('plurals', () => {
  it('projectCount', () => {
    expect([0, 1, 2, 12].map(s.projectCount)).toEqual(['0 projects', '1 project', '2 projects', '12 projects']);
  });

  it('linkCount', () => {
    expect([0, 1, 2].map(s.linkCount)).toEqual(['0 links', '1 link', '2 links']);
  });

  it('moreToggleName is singular for one tag', () => {
    expect(s.moreToggleName(1)).toBe('1 more tag');
  });
});

describe('filterAnnouncement', () => {
  it('all projects, default order, ascending', () => {
    expect(s.filterAnnouncement({ count: 8, mode: 'default', dir: 'asc' })).toBe(
      '8 projects, sorted by default ranking, ascending',
    );
  });

  it('tagged, updated, descending', () => {
    expect(s.filterAnnouncement({ count: 3, tag: 'plugin', mode: 'updated', dir: 'desc' })).toBe(
      '3 projects tagged plugin, sorted by last updated, descending',
    );
  });

  it('singular and name sort', () => {
    expect(s.filterAnnouncement({ count: 1, tag: 'web', mode: 'name', dir: 'asc' })).toBe(
      '1 project tagged web, sorted by name, ascending',
    );
  });
});

describe('DALAMUD_STEPS', () => {
  const flat = (parts: readonly StepPart[], name: string) =>
    parts.map((p) => (p.kind === 'projectName' ? name : p.text)).join('');

  it('reads as the r8 INSTALL window (project.html)', () => {
    expect(s.DALAMUD_STEPS.map((step) => flat(step.parts, 'Loch Lantern'))).toEqual([
      'In game, run /xlsettings and open Experimental.',
      'Under Custom Plugin Repositories, add this URL, tick Enabled, save:',
      'Run /xlplugins, search Loch Lantern, install.',
    ]);
  });

  it('marks the repo URL copy field after step 2 only', () => {
    expect(s.DALAMUD_STEPS.map((step) => step.repoUrlCopy === true)).toEqual([false, true, false]);
  });

  it('types the emphasised parts', () => {
    expect(s.DALAMUD_STEPS[0]?.parts.flatMap((p) => (p.kind === 'code' || p.kind === 'strong' ? [[p.kind, p.text]] : []))).toEqual([
      ['code', '/xlsettings'],
      ['strong', 'Experimental'],
    ]);
  });
});

// Chrome, primitive and landing wording (design 4 "Wording"), typed out literally from the r8 mocks / ux 4.1, 6.2.
describe('chrome and landing wording', () => {
  it('chrome literals', () => {
    expect([s.BRAND, s.MODE_CELL, s.TAB_HOME, s.TAB_BOOKMARKS]).toEqual(['nessynet', 'NESSY', 'home', 'bookmarks']);
    expect([s.STATUS_EXTERNAL, s.STATUS_404, s.STATUS_NOT_FOUND]).toEqual(['external', '404', 'not found']);
    expect([s.TAG_PREFIX, s.SORT_PREFIX, s.TAG_INITIAL, s.SORT_INITIAL]).toEqual(['tag:', 'sort:', 'all', 'default']);
    expect([s.TITLE_BOOKMARKS, s.TITLE_NOT_FOUND]).toEqual(['Bookmarks', 'Not found']);
  });

  it('dirCount is singular for one', () => {
    expect([s.dirCount(0), s.dirCount(1), s.dirCount(4)]).toEqual(['0 dirs', '1 dir', '4 dirs']);
  });

  it('primitive literals', () => {
    expect([s.GET_BAR_PREFIX, s.SOURCE_BAR_PREFIX, s.SOURCE_ROW_LABEL, s.ALL_BOOKMARKS]).toEqual(['get: ', 'source: ', 'source', 'all bookmarks']);
  });

  it('landing windows', () => {
    expect([s.WHOAMI_TITLE, s.SHELL_NAME, s.LINKS_TITLE, s.LINKS_CMD]).toEqual(['whoami', 'zsh', 'links.txt', 'cat links.txt']);
    expect([s.LINK_KEY_GITHUB, s.LINK_KEY_MAIL]).toEqual(['github', 'mail']);
    expect([s.LS_TITLE, s.LS_CMD, s.LS_COLUMNS]).toEqual(['projects', 'ls -l ~', ['mode', 'name', 'items', 'contents']]);
    expect([s.LOG_TITLE, s.LOG_CMD]).toEqual(['updates.log', 'tail -n 4 updates.log']);
    expect(s.LS_CAPTION).toBe('Project categories, and the link to bookmarks');
    expect(s.lsMeta(19, 16)).toBe('19 projects · 16 links');
    expect([s.BOOKMARKS_ROW_NAME, s.BOOKMARKS_ROW_TARGET]).toEqual(['bookmarks', '-> elsewhere']);
  });
});

describe('404 wording', () => {
  it('fixed 404 window strings', () => {
    expect([s.SHELL_NAME, s.NOT_FOUND_EXIT, s.CD_PROMPT, s.OR_TRY_BOOKMARKS_NOTE]).toEqual(['zsh', 'exit 1', 'cd ', 'external links']);
  });
});

describe('bookmarks page and permission wording', () => {
  it('bookmarks page strings', () => {
    expect([s.BOOKMARKS_PATH, s.BOOKMARKS_CD_CMD, s.JUMP_CD]).toEqual(['~/bookmarks', 'cd ~/bookmarks', 'cd']);
    expect([s.RELATIONS_TITLE, s.RELATIONS_CMD]).toEqual(['relations', 'cat .relations']);
    expect([s.RELATED_LABEL, s.byAuthor('Kovid Goyal')]).toEqual(['related:', 'by Kovid Goyal']);
  });

  it('group title and meta: free groups add " · group"', () => {
    expect(s.groupTitle('ffxiv')).toBe('ffxiv/');
    expect(s.groupMeta(3, false)).toBe('3 links · external');
    expect(s.groupMeta(1, true)).toBe('1 link · external · group');
  });

  it('permission strings and the empty status word', () => {
    expect([s.PERMISSIONS_DIR, s.PERMISSIONS_LINK, s.STATUS_EMPTY]).toEqual(['drwxr-xr-x', 'lrwxrwxrwx', 'empty']);
  });
});

// Flattens step parts to text with `**strong**` and `code` markers, so the pins read like Freya's wording.
const marked = (parts: readonly s.StepPart[]): string =>
  parts.map((p) => (p.kind === 'strong' ? `**${p.text}**` : p.kind === 'code' ? `\`${p.text}\`` : p.kind === 'text' ? p.text : '{name}')).join('');

describe('offline install steps', () => {
  it('check requirement first, then get the file', () => {
    expect(s.offlineRequiresStep('Windows 10 or Linux')).toBe('Check that you have Windows 10 or Linux.');
    expect(s.offlineGetLead('Mist Macro Editor')).toBe('Get Mist Macro Editor: ');
  });
});

describe('other project layouts (mod, modpack, tool, bot)', () => {
  it('mod strings', () => {
    expect(marked(s.modLoaderStep('Fabric'))).toBe('Install the **Fabric** loader for your Minecraft version (see **versions**).');
    expect([s.modGetLead('Loch Lantern'), s.GET_OR]).toEqual(['Get Loch Lantern from ', ' or ']);
    expect(marked(s.MOD_DROP_STEP)).toBe('Put the `.jar` and its required dependencies in your `mods/` folder.');
    expect([s.MOD_VERSIONS_TITLE, s.MOD_VERSIONS_CMD, s.MOD_VERSIONS_CAPTION]).toEqual(['versions', 'ls releases/', 'Compatible files']);
    expect([...s.MOD_VERSIONS_COLUMNS]).toEqual(['minecraft', 'loader', 'file', 'released']);
    expect([s.MOD_DEPS_TITLE, s.MOD_DEPS_CMD, s.MOD_DEPS_CAPTION]).toEqual(['dependencies', 'cat fabric.mod.json | jq .depends', 'Dependencies']);
    expect([...s.MOD_DEPS_COLUMNS]).toEqual(['mod', 'need', 'why']);
    expect(s.MOD_STAT).toEqual({ loader: 'loader', minecraft: 'minecraft', side: 'side' });
  });

  it('modpack strings', () => {
    expect(s.packLauncherStep('Prism Launcher')).toBe('Install Prism Launcher.');
    expect(s.packLauncherStep(undefined)).toBe('Install a launcher that can import modpacks.');
    expect([marked(s.PACK_IMPORT_STEP), s.PACK_IMPORT_COPY_NAME]).toEqual(['Choose **Add Instance**, then **Import**, and paste this link:', 'import link']);
    expect(s.packRamStep(6)).toBe('Allocate at least 6 GB of RAM to the instance, then launch it.');
    expect([s.PACK_MODS_TITLE, s.packModsMeta(1), s.packModsMeta(12), s.packModsCmd(5)]).toEqual(['mods.txt', '1 mod', '12 mods', 'head -n 5 mods.txt']);
    expect([s.PACK_MODS_CAPTION, s.PACK_BY_ME, s.PACK_BY_OTHER, s.PACK_FULL_LIST]).toEqual(['Mods in this pack', 'me', 'other', 'Full list (mods.txt)']);
    expect([...s.PACK_MODS_COLUMNS]).toEqual(['mod', 'version', 'by']);
    expect([s.packShowing(5, 1), s.packShowing(5, 12), s.packMemory(6)]).toEqual(['Showing 5 of 1 mod.', 'Showing 5 of 12 mods.', '6 GB']);
    expect(s.PACK_STAT).toEqual({ loader: 'loader', minecraft: 'minecraft', mods: 'mods', memory: 'memory' });
  });

  it('tool strings', () => {
    expect([s.toolCommandCopyName('lochctl sync'), s.toolManTitle('lochctl')]).toEqual(['command: lochctl sync', 'man lochctl']);
    expect(s.TOOL_MAN_SECTIONS).toEqual({ synopsis: 'SYNOPSIS', commands: 'COMMANDS', options: 'OPTIONS', example: 'EXAMPLE' });
    expect([s.TOOL_EXAMPLE_COPY_NAME, s.TOOL_DIST_TITLE, s.TOOL_DIST_CMD, s.TOOL_DIST_CAPTION]).toEqual(['example command', 'distros', 'cat SUPPORT.md', 'Supported distributions']);
    expect([...s.TOOL_DIST_COLUMNS]).toEqual(['distro', 'support', 'how']);
    expect(s.TOOL_SUPPORT_WORDS).toEqual({ supported: 'supported', untested: 'works, untested', unsupported: 'not supported' });
    expect([s.TOOL_NO_VALUE, s.TOOL_STAT]).toEqual(['-', { language: 'language', needs: 'needs', distros: 'distros' }]);
  });

  it('link-preview card strings', () => {
    expect([s.OG_SITE_NAME, s.OG_RETIRED]).toEqual(['nessynet.io', 'retired']);
  });

  it('bot strings', () => {
    expect([s.BOT_COMMANDS_TITLE, s.botCommandsCmd('lochbot'), s.BOT_COMMANDS_CAPTION]).toEqual(['commands', 'lochbot --help', 'Bot commands']);
    expect([...s.BOT_COMMANDS_COLUMNS]).toEqual(['command', 'what it does', 'who']);
    expect(s.BOT_STAT).toEqual({ platform: 'platform', hosting: 'hosting', invite: 'invite' });
    expect(s.BOT_INVITE).toEqual({ open: 'public', closed: 'not public' });
  });
});
