// Builds both fixture sites into `.e2e-sites/` (never the shared `dist/`) unless E2E_SKIP_BUILD=1.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '../..');

function build(content: string, out: string, strict: boolean): void {
  const args = ['scripts/build.mjs', ...(strict ? ['--strict'] : []), '--content', resolve(ROOT, content), '--out', resolve(ROOT, out)];
  // The content gate stays silent under Vitest, which Playwright children may inherit; keep the env clean.
  const { VITEST: _vitest, ...env } = process.env;
  const result = spawnSync(process.execPath, args, { cwd: ROOT, encoding: 'utf8', env });
  if (result.status !== 0) throw new Error(`build of ${content} failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
}

export default function globalSetup(): void {
  if (process.env['E2E_SKIP_BUILD'] === '1') return;
  build('tests/fixtures/site-e2e', '.e2e-sites/e2e', true);
  build('tests/fixtures/site-stress', '.e2e-sites/stress', false);
}
