import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadContent, type ParsedSite } from '../../src/lib/content/load.ts';
import { normalise } from '../../src/lib/content/normalise.ts';
import { applyRules } from '../../src/lib/content/rules.ts';
import { fixtureNames, SITE_HOST, validateFixture, VALIDATION_DIR, withFixture, type FixtureExpectation, type Validated } from '../helpers/content-fixture.ts';

const local = (name: string): Promise<Validated> => validateFixture(name, { strict: false });

const projectOf = (v: Validated, slug: string) => {
  const found = v.resolved.projects.find((p) => p.data.slug === slug);
  if (found === undefined) throw new Error(`project ${slug} is not in the resolved site`);
  return found;
};
const bookmarkOf = (v: Validated, name: string) => {
  const found = v.resolved.bookmarks.find((b) => b.data.name === name);
  if (found === undefined) throw new Error(`bookmark ${name} is not in the resolved site`);
  return found.data;
};

/** Assertions on `resolved`, named by the `resolvedCheck` key of a fixture's expect.json. */
const CHECKS: Record<string, (v: Validated) => void> = {
  droppedTag: (v) => {
    expect(projectOf(v, 'gear-tweaks').data.tags).toEqual(['plugin', 'ui']);
    expect(projectOf(v, 'gear-tweaks').data.tags).not.toContain('nope');
  },
  noTypeTag: (v) => {
    expect(projectOf(v, 'gear-tweaks').data.tags).toEqual(['ui']);
    const model = normalise(v.resolved);
    const project = model.projectsBySlug.get('gear-tweaks');
    expect(project).toMatchObject({ layout: 'generic', typeTag: null });
    expect(project?.tags.map((t) => t.id)).toEqual(['ui']);
    expect(model.categories.find((c) => c.id === 'ffxiv')?.projects.map((p) => p.slug)).toEqual(['gear-tweaks']);
  },
  severalTypeTags: (v) => {
    expect(projectOf(v, 'lochctl').data.tags).toEqual(['cli', 'web', 'shell']);
    const project = normalise(v.resolved).projectsBySlug.get('lochctl');
    expect(project?.typeTag?.id).toBe('cli');
    expect(project?.layout).toBe('tool');
    expect(project?.tags.map((t) => t.id)).toEqual(expect.arrayContaining(['web', 'shell']));
  },
  installDropped: (v) => {
    expect(projectOf(v, 'gear-tweaks').data.get).toEqual([]);
    expect(normalise(v.resolved).projectsBySlug.get('gear-tweaks')?.getSlot).toEqual({ kind: 'text', text: 'Not distributed yet' });
  },
  installStepsDropped: (v) => {
    expect(projectOf(v, 'lochctl').data.get).toEqual([]);
    const project = normalise(v.resolved).projectsBySlug.get('lochctl');
    expect(project?.get).toEqual([]);
    expect(project?.getSlot.kind).toBe('text');
  },
  bookmarkToGeneral: (v) => {
    const data = bookmarkOf(v, 'Dalamud docs');
    expect(data.category).toBeUndefined();
    expect(data.group).toBeUndefined();
    const general = normalise(v.resolved).bookmarks.find((g) => g.id === 'general');
    expect(general?.bookmarks.map((b) => b.name)).toEqual(['Dalamud docs']);
  },
  categoryWins: (v) => {
    const data = bookmarkOf(v, 'Dalamud docs');
    expect(data.category).toBe('ffxiv');
    expect(data.group).toBeUndefined();
  },
  relationDropped: (v) => {
    const data = bookmarkOf(v, 'Dalamud docs');
    expect(Object.hasOwn(data, 'relation')).toBe(false);
    expect(normalise(v.resolved).bookmarks.flatMap((g) => g.bookmarks).find((b) => b.name === 'Dalamud docs')?.relation).toBeUndefined();
  },
  projectLinkDropped: (v) => {
    expect(bookmarkOf(v, 'Dalamud docs').projects).toEqual(['gear-tweaks']);
  },
  whoamiLinkRemoved: (v) => {
    expect(Object.keys(v.resolved.whoami?.data.links ?? {}).sort()).toEqual(['github', 'mail']);
  },
};

const names = await fixtureNames();
const expectations = new Map(
  await Promise.all(names.map(async (n) => [n, JSON.parse(await readFile(join(VALIDATION_DIR, n, 'expect.json'), 'utf8')) as FixtureExpectation] as const)),
);
const checked = [...expectations].filter(([, e]) => e.resolvedCheck !== undefined);

describe('resolved fallbacks', () => {
  it('every named check exists and every check is used', () => {
    const used = new Set(checked.map(([, e]) => e.resolvedCheck!));
    expect([...used].filter((c) => !(c in CHECKS))).toEqual([]);
    expect(Object.keys(CHECKS).filter((c) => !used.has(c))).toEqual([]);
  });

  it.each(checked.map(([name, e]) => [name, e.resolvedCheck!] as const))('%s: %s', async (name, check) => {
    CHECKS[check]!(await local(name));
  });

  it('the zero-type-tag project is reported with the layout table as an unknown detail key', async () => {
    const { diagnostics } = await local('project__type-tag-count');
    expect(diagnostics.filter((d) => d.code === 'project/unknown-detail-key')).toMatchObject([
      { level: 'warning', file: 'projects/ffxiv/gear-tweaks.toml', entry: 'gear-tweaks', field: 'ffxiv' },
    ]);
  });

  it('_base resolves to the same content', async () => {
    const v = await local('_base');
    expect(v.resolved).toEqual(v.parsed);
  });
});

function deepFreeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}

describe('applyRules does not mutate its input', () => {
  it.each(checked.map(([name]) => name))('%s: a deep-frozen input does not throw and is unchanged', async (name) => {
    await withFixture(name, async (dir) => {
      const { parsed } = await loadContent(dir);
      const before = JSON.stringify(parsed);
      const frozen: ParsedSite = deepFreeze(parsed);
      const { resolved } = await applyRules(frozen, { strict: false, allowSamples: false, siteHost: SITE_HOST, contentDir: dir });
      expect(JSON.stringify(frozen)).toBe(before);
      expect(resolved).not.toBe(frozen);
    });
  });
});
