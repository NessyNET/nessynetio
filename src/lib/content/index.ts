// Composes load -> rules -> normalise into `loadSite`, and the per-process memo the pages read (design 3.1, 3.4).
import { resolve } from 'node:path';
import { hostOf } from '../links.ts';
import { hasErrors, type Diagnostic } from './diagnostics.ts';
import { loadContent } from './load.ts';
import type { SampleItem, SiteModel } from './model.ts';
import { normalise } from './normalise.ts';
import { applyRules } from './rules.ts';

export interface LoadSiteOptions {
  readonly dir: string;
  readonly strict: boolean;
  readonly allowSamples: boolean;
}

export interface LoadSiteResult {
  /** Null when any diagnostic is an error. Deep-frozen and cyclic: never JSON-serialise it. */
  readonly model: SiteModel | null;
  readonly diagnostics: Diagnostic[];
  /** The sample list, also when errors stopped the model from being built. */
  readonly samples: readonly SampleItem[];
}

export async function loadSite(opts: LoadSiteOptions): Promise<LoadSiteResult> {
  const { parsed, diagnostics: loadDiagnostics } = await loadContent(opts.dir);
  // A missing or unparseable [site] is already an error; '' makes every absolute link count as external meanwhile.
  const siteHost = (parsed.site === null ? null : hostOf(parsed.site.data.url)) ?? '';
  const { diagnostics: ruleDiagnostics, resolved } = await applyRules(parsed, {
    strict: opts.strict,
    allowSamples: opts.allowSamples,
    siteHost,
    contentDir: opts.dir,
  });
  const diagnostics = [...loadDiagnostics, ...ruleDiagnostics];
  return { model: hasErrors(diagnostics) ? null : normalise(resolved), diagnostics, samples: parsed.samples };
}

/** Options from the environment the build wrapper sets; defaults suit `astro dev` and a bare `astro build`. */
export function optionsFromEnv(env: NodeJS.ProcessEnv = process.env): LoadSiteOptions {
  const on = (value: string | undefined): boolean => value === '1' || value === 'true';
  return {
    dir: resolve(env['NESSY_CONTENT_DIR'] ?? 'content'),
    strict: on(env['NESSY_STRICT']),
    allowSamples: on(env['NESSY_ALLOW_SAMPLES']),
  };
}

// The memo lives on globalThis so the Astro integration and the page modules (separate module instances under
// Vite) share one load per process, and a dev reload can clear it for both.
const MEMO = Symbol.for('nessynetio.siteMemo');
type MemoHolder = { [MEMO]?: Promise<LoadSiteResult> };

/** The result of the one load of this process, started on first use. */
export function loadSiteMemoised(): Promise<LoadSiteResult> {
  const holder = globalThis as MemoHolder;
  holder[MEMO] ??= loadSite(optionsFromEnv());
  return holder[MEMO];
}

export function clearSiteMemo(): void {
  delete (globalThis as MemoHolder)[MEMO];
}

/** The model for pages; throws one summarising error when the content has errors. */
export async function getSiteModel(): Promise<SiteModel> {
  const { model, diagnostics } = await loadSiteMemoised();
  if (model === null) {
    const errors = diagnostics.filter((d) => d.level === 'error');
    throw new Error(`The content has ${errors.length} errors; fix them and reload (see the terminal for every diagnostic).`);
  }
  return model;
}

/** `N errors, N warnings, N notes`. */
export function summarise(diagnostics: readonly Diagnostic[]): string {
  const count = (level: Diagnostic['level']): number => diagnostics.filter((d) => d.level === level).length;
  return `${count('error')} errors, ${count('warning')} warnings, ${count('note')} notes`;
}

/** One line per sample item (`file [entry]: fields ...; assets ...`), then `N sample items`. */
export function formatSampleList(samples: readonly SampleItem[]): string[] {
  const lines = samples.map((item) => {
    const parts = [
      item.fields.length === 0 ? '' : `fields ${item.fields.join(', ')}`,
      item.assets.length === 0 ? '' : `assets ${item.assets.join(', ')}`,
    ].filter((part) => part !== '');
    const where = item.entry === undefined ? item.file : `${item.file} [${item.entry}]`;
    return `${where}: ${parts.length === 0 ? 'sample = true' : parts.join('; ')}`;
  });
  return [...lines, `${samples.length} sample items`];
}
