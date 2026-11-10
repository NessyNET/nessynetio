// Builds the site into a throwaway copy of the project so tests never touch the shared `dist/`.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');
const COPIED = ['src', 'public', 'scripts', 'astro.config.mjs', 'package.json', 'tsconfig.json'];

// The content gate stays silent under Vitest (which inherits into children), so the child must not look like Vitest.
const { VITEST: _vitest, ...childEnv } = process.env;

/** Copies the project into a temp dir and builds `contentDir` there; `dist` is the output, `cleanup` removes the copy. */
export function buildInScratch(contentDir: string, flags: string[] = ['--strict']): { dist: string; cleanup: () => void } {
  const scratch = mkdtempSync(join(tmpdir(), 'nessy-build-'));
  for (const entry of COPIED) cpSync(join(ROOT, entry), join(scratch, entry), { recursive: true });
  symlinkSync(join(ROOT, 'node_modules'), join(scratch, 'node_modules'));
  const cleanup = () => rmSync(scratch, { recursive: true, force: true });
  const result = spawnSync(process.execPath, ['scripts/build.mjs', ...flags, '--content', resolve(contentDir)], {
    cwd: scratch,
    encoding: 'utf8',
    env: childEnv,
  });
  if (result.status !== 0) {
    cleanup();
    throw new Error(`scratch build failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  }
  return { dist: join(scratch, 'dist'), cleanup };
}
