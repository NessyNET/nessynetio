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
    expect([s.WHOAMI_TITLE, s.WHOAMI_META, s.LINKS_TITLE, s.LINKS_CMD]).toEqual(['whoami', 'zsh', 'links.txt', 'cat links.txt']);
    expect([s.LINK_KEY_GITHUB, s.LINK_KEY_MAIL]).toEqual(['github', 'mail']);
    expect([s.LS_TITLE, s.LS_CMD, s.LS_COLUMNS]).toEqual(['projects', 'ls -l ~', ['mode', 'name', 'items', 'contents']]);
    expect([s.LOG_TITLE, s.LOG_CMD]).toEqual(['updates.log', 'tail -n 4 updates.log']);
    expect(s.LS_CAPTION).toBe('Project categories, and the link to bookmarks');
    expect(s.lsMeta(19, 16)).toBe('19 projects · 16 links');
    expect([s.BOOKMARKS_ROW_NAME, s.BOOKMARKS_ROW_TARGET]).toEqual(['bookmarks', '-> elsewhere']);
  });
});
