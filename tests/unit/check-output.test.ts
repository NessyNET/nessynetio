// Output checks (029, design 3.4 step 4 and 5.2 "Output"): each rule has a clean fixture and a bad one, then the real
// site-e2e build must be clean.
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { checkOutput } from '../../scripts/check-output.mjs';

const SITE = 'https://nessynet.io';
const fixture = (name: string) => resolve('tests/fixtures/output', name);
const check = (name: string, samplesAllowed = false) => checkOutput({ distDir: fixture(name), siteUrl: SITE, samplesAllowed });
const rules = (name: string, samplesAllowed = false) => [...new Set(check(name, samplesAllowed).map((f) => f.rule))];

describe('clean fixture', () => {
  it('has no findings, even though it holds external links, a notice, JSON data and a module script', () => {
    expect(check('clean')).toEqual([]);
  });
});

describe('O1 external links (R11)', () => {
  it.each([
    ['o1-no-noreferrer', /noreferrer/],
    ['o1-no-new-tab-text', /\(opens in new tab\)/],
    ['o1-arrow-without-target', /target="_blank"/],
    ['o1-external-without-target', /target="_blank"/],
    ['o1-mailto-with-target', /mailto/],
    ['o1-own-host-arrow', /site host/],
    ['o1-arrow-not-aria-hidden', /aria-hidden child/],
  ])('%s', (name, message) => {
    const found = check(name);
    expect(found.map((f) => f.rule)).toEqual(['O1']);
    expect(found[0]?.message).toMatch(message);
    expect(found[0]?.file).toBe('index.html');
    expect(found[0]?.selector).toContain('a');
  });
});

describe('O2 owner links (R5)', () => {
  it.each([['o2-discord-in-status-line'], ['o2-gitlab-on-landing'], ['o2-links-txt-extra']])('%s', (name) => {
    expect(rules(name)).toEqual(['O2']);
  });
});

describe('O2 looks at where a link goes, not at its text', () => {
  it('a Discord mention in an internal link text is not a finding', () => {
    expect(check('o2-discord-text-internal-link')).toEqual([]);
  });
});

describe('O3 meta and uniqueness (R19)', () => {
  it.each([['o3-no-description'], ['o3-no-og-image-alt'], ['o3-canonical-query'], ['o3-canonical-other-host']])('%s', (name) => {
    expect(rules(name)).toEqual(['O3']);
  });

  it.each([
    ['o3-two-titles', /expected one <title>, found 2/],
    ['o3-no-title', /expected one <title>, found 0/],
    ['o3-two-canonicals', /expected one canonical link, found 2/],
    ['o3-no-canonical', /expected one canonical link, found 0/],
  ])('%s', (name, message) => {
    const found = check(name);
    expect(found.map((f) => f.rule)).toEqual(['O3']);
    expect(found[0]?.message).toMatch(message);
  });

  it('flags a title used by two pages, on the second', () => {
    const found = check('o3-duplicate-title');
    expect(found.map((f) => [f.rule, f.file])).toEqual([['O3', 'two/index.html']]);
    expect(found[0]?.message).toMatch(/title/);
  });

  it('flags a canonical used by two pages', () => {
    const found = check('o3-duplicate-canonical');
    expect(found.map((f) => [f.rule, f.file])).toEqual([['O3', 'two/index.html']]);
    expect(found[0]?.message).toMatch(/canonical/);
  });
});

describe('O4 notice labels are never links (R24)', () => {
  it('flags a link whose text starts with a notice label and a colon', () => {
    expect(rules('o4-notice-label-link')).toEqual(['O4']);
  });
});

describe('O5 and O7 sample markers (R26, R28)', () => {
  it.each([['o5-sample-marker', 'O5'], ['o5-sample-path', 'O5'], ['o7-not-distributed-yet', 'O7']])('%s is a finding by default', (name, rule) => {
    expect(rules(name)).toEqual([rule]);
  });

  it.each([['o5-sample-marker'], ['o5-sample-path'], ['o7-not-distributed-yet']])('%s is allowed with samplesAllowed', (name) => {
    expect(check(name, true)).toEqual([]);
  });
});

describe('O6 no inline script, style or handlers (CSP)', () => {
  it.each([['o6-inline-script'], ['o6-style-element'], ['o6-style-attribute'], ['o6-event-handler']])('%s', (name) => {
    expect(rules(name)).toEqual(['O6']);
  });
});

describe('CLI', () => {
  const run = (...args: string[]) => spawnSync(process.execPath, ['scripts/check-output.mjs', ...args], { encoding: 'utf8' });

  it('exits 0 on a clean directory and 1 with findings printed as "rule file selector message"', () => {
    expect(run('--dist', fixture('clean'), '--site', SITE).status).toBe(0);
    const bad = run('--dist', fixture('o6-inline-script'), '--site', SITE);
    expect(bad.status).toBe(1);
    expect(bad.stdout).toMatch(/^O6 index\.html .+ /m);
  });

  it('--allow-samples turns O5 and O7 off', () => {
    expect(run('--dist', fixture('o5-sample-marker'), '--site', SITE).status).toBe(1);
    expect(run('--dist', fixture('o5-sample-marker'), '--site', SITE, '--allow-samples').status).toBe(0);
  });

  it('exits 2 without a usable site or on a bad argument', () => {
    expect(run('--dist', fixture('clean'), '--bogus').status).toBe(2);
    expect(run('--dist', resolve('tests/fixtures/output/nope')).status).toBe(2);
  });
});

describe('the real site-e2e build (slow: runs Astro)', () => {
  let out: string;
  beforeAll(() => {
    mkdirSync('.builds', { recursive: true });
    out = mkdtempSync(resolve('.builds', 'check-output-'));
    const { VITEST: _vitest, ...env } = process.env;
    const result = spawnSync(process.execPath, ['scripts/build.mjs', '--strict', '--content', 'tests/fixtures/site-e2e', '--out', out], { encoding: 'utf8', env });
    if (result.status !== 0) throw new Error(`build failed:\n${result.stdout}\n${result.stderr}`);
  }, 180_000);
  afterAll(() => rmSync(out, { recursive: true, force: true }));

  it('has zero findings', () => {
    expect(checkOutput({ distDir: out, siteUrl: SITE, samplesAllowed: false })).toEqual([]);
  });
});
