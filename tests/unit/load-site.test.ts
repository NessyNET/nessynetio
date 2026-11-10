import { describe, expect, it } from 'vitest';
import { formatSampleList, loadSite, summarise } from '../../src/lib/content/index.ts';
import { withFixture } from '../helpers/content-fixture.ts';

const load = (name: string, opts: { strict?: boolean; allowSamples?: boolean } = {}) =>
  withFixture(name, (dir) => loadSite({ dir, strict: opts.strict ?? false, allowSamples: opts.allowSamples ?? false }));

describe('loadSite', () => {
  it('turns the _base content into a model with no diagnostics', async () => {
    const { model, diagnostics } = await load('_base');
    expect(diagnostics).toEqual([]);
    expect(model?.site.url).toBe('https://nessynet.io');
    expect(model?.projectsBySlug.has('gear-tweaks')).toBe(true);
  });

  it('returns no model when any diagnostic is an error', async () => {
    const { model, diagnostics } = await load('project__screenshot-file');
    expect(model).toBeNull();
    expect(diagnostics.some((d) => d.code === 'project/screenshot-file' && d.level === 'error')).toBe(true);
  });

  it('returns no model for load-time errors (missing required file)', async () => {
    const result = await withFixture('_base', async (dir) => {
      const { rm } = await import('node:fs/promises');
      await rm(`${dir}/categories.toml`);
      return loadSite({ dir, strict: false, allowSamples: false });
    });
    expect(result.model).toBeNull();
    expect(result.diagnostics.map((d) => d.code)).toContain('schema/required');
  });

  it('reports a bad [site] url as an error and still finishes (empty site host)', async () => {
    const { model, diagnostics } = await load('site__url');
    expect(model).toBeNull();
    expect(diagnostics.map((d) => d.code)).toContain('site/url');
  });

  it('strict turns a warning fixture into an error', async () => {
    const local = await load('project__unknown-tag');
    expect(local.model).not.toBeNull();
    expect(local.diagnostics.find((d) => d.code === 'project/unknown-tag')?.level).toBe('warning');
    const strict = await load('project__unknown-tag', { strict: true });
    expect(strict.model).toBeNull();
    expect(strict.diagnostics.find((d) => d.code === 'project/unknown-tag')?.level).toBe('error');
  });

  it('a sample fixture under strict with allow-samples is a warning and the model is present', async () => {
    const { model, diagnostics } = await load('r28-a-sample-allow', { strict: true, allowSamples: true });
    expect(diagnostics.filter((d) => d.level === 'error')).toEqual([]);
    expect(diagnostics.find((d) => d.code === 'sample/present')?.level).toBe('warning');
    expect(model?.samples.length).toBeGreaterThan(0);
  });

  it('the same fixture under strict alone is an error', async () => {
    const { model, diagnostics } = await load('r28-b-sample-strict', { strict: true });
    expect(model).toBeNull();
    expect(diagnostics.find((d) => d.code === 'sample/present')?.level).toBe('error');
  });
});

describe('summarise', () => {
  it('counts errors, warnings and notes in the specified wording', () => {
    const d = (level: 'error' | 'warning' | 'note') => ({ code: 'x/y', level, file: 'f', message: 'm' });
    expect(summarise([d('error'), d('warning'), d('warning'), d('note')])).toBe('1 errors, 2 warnings, 1 notes');
    expect(summarise([])).toBe('0 errors, 0 warnings, 0 notes');
  });
});

describe('formatSampleList', () => {
  it('prints one line per item with fields and assets, and a count', () => {
    const lines = formatSampleList([
      { file: 'a.toml', entry: 'a', fields: ['notice.text', 'summary'], assets: ['projects/x/y/01.sample.png'] },
      { file: 'site.toml', entry: 'whoami', fields: [], assets: [] },
      { file: 'b.toml', fields: ['bio'], assets: [] },
    ]);
    expect(lines).toEqual([
      'a.toml [a]: fields notice.text, summary; assets projects/x/y/01.sample.png',
      'site.toml [whoami]: sample = true',
      'b.toml: fields bio',
      '3 sample items',
    ]);
  });

  it('is just the count when there are none', () => {
    expect(formatSampleList([])).toEqual(['0 sample items']);
  });
});
