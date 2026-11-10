// Astro integration: runs the content gate at the start of every build and in dev (design 3.1, 3.4 F-build, F-dev).
import { relative } from 'node:path';
import type { AstroIntegration } from 'astro';
import { formatDiagnostic } from '../lib/content/diagnostics.ts';
import { clearSiteMemo, formatSampleList, loadSiteMemoised, optionsFromEnv, summarise } from '../lib/content/index.ts';

/** Loads (memoised), prints every diagnostic, the sample list and the summary line; returns the error count. */
async function runAndPrint(print: (line: string) => void): Promise<{ errors: number; siteUrl: string | undefined }> {
  const { model, diagnostics, samples } = await loadSiteMemoised();
  for (const d of diagnostics) print(formatDiagnostic(d));
  for (const line of formatSampleList(samples)) print(line);
  print(summarise(diagnostics));
  return { errors: diagnostics.filter((d) => d.level === 'error').length, siteUrl: model?.site.url };
}

export function contentGate(): AstroIntegration {
  const { dir } = optionsFromEnv();
  return {
    name: 'content-gate',
    hooks: {
      'astro:config:setup': async ({ command, updateConfig }) => {
        // Vitest loads this config through getViteConfig (as a dev command); the gate would only print noise there.
        if (process.env['VITEST'] !== undefined) return;
        clearSiteMemo();
        const { errors, siteUrl } = await runAndPrint((line) => console.log(line));
        if (errors > 0 && command === 'build') throw new Error(`Content gate failed: ${errors} errors (listed above); nothing was built.`);
        if (siteUrl !== undefined) updateConfig({ site: siteUrl });
      },
      'astro:server:setup': ({ server }) => {
        server.watcher.add(dir);
        const onChange = (path: string): void => {
          if (relative(dir, path).startsWith('..')) return;
        clearSiteMemo();
          void runAndPrint((line) => console.log(line)).then(() => server.hot.send({ type: 'full-reload' }));
        };
        for (const event of ['add', 'change', 'unlink'] as const) server.watcher.on(event, onChange);
      },
    },
  };
}
