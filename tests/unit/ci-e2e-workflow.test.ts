import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Text assertions on the e2e job of ci.yml (no YAML parser is installed, and none may be added).
const WORKFLOW = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8');
const e2e = /^ {2}e2e:\n([\s\S]*?)(?=^ {2}[a-z][a-z-]*:\n|(?![\s\S]))/m.exec(WORKFLOW)?.[1] ?? '';
const at = (needle: string | RegExp): number => {
  const index = typeof needle === 'string' ? e2e.indexOf(needle) : e2e.search(needle);
  expect(index, String(needle)).toBeGreaterThanOrEqual(0);
  return index;
};

describe('ci.yml e2e job', () => {
  it('exists and waits for the check job', () => {
    expect(e2e).not.toBe('');
    expect(e2e).toMatch(/^ {4}needs: check$/m);
  });

  it('builds both fixture sites into .e2e-sites (e2e strict, stress not) before anything uses them', () => {
    const strict = at('npm run build -- --strict --content tests/fixtures/site-e2e --out .e2e-sites/e2e');
    const stress = at('npm run build -- --content tests/fixtures/site-stress --out .e2e-sites/stress');
    expect(e2e.slice(stress, stress + 120)).not.toMatch(/--strict/);
    expect(strict).toBeLessThan(at('tests/server/run.sh'));
    expect(stress).toBeLessThan(at('tests/server/run.sh'));
  });

  it('runs the server checks against the site-e2e build in the container with the unchanged deploy/nginx files', () => {
    expect(e2e).toMatch(/DIST: \.e2e-sites\/e2e\n[\s\S]*?run: bash tests\/server\/run\.sh\n/);
    // run.sh mounts deploy/nginx read-only itself; the job must not copy or edit those files.
    expect(e2e).not.toMatch(/deploy\/nginx/);
    const run = readFileSync(fileURLToPath(new URL('../server/run.sh', import.meta.url)), 'utf8');
    expect(run).toMatch(/-v "\$ROOT\/deploy\/nginx:\/mnt\/nginx:ro,z"/);
    expect(run).toContain('tests/server/Containerfile');
  });

  it('serves the container on 443 and 80, maps the host names, then runs the suite and Lighthouse against it', () => {
    const serve = at('HTTPS_PORT: 443');
    expect(e2e).toMatch(/HTTP_PORT: 80/);
    expect(e2e).toMatch(/run: bash tests\/server\/run\.sh --serve/);
    expect(e2e).toMatch(/127\.0\.0\.1 nessynet\.io www\.nessynet\.io/);
    const suite = at('run: npm run e2e');
    expect(suite).toBeGreaterThan(serve);
    expect(e2e).toMatch(/E2E_BASE_URL: https:\/\/nessynet\.io\n/);
    expect(e2e).toMatch(/E2E_RESOLVE: MAP nessynet\.io 127\.0\.0\.1:443, MAP www\.nessynet\.io 127\.0\.0\.1:443/);
    expect(e2e).toMatch(/E2E_SKIP_BUILD: 1/);
    expect(at('run: npm run lhci')).toBeGreaterThan(suite);
  });

  it('caches the Playwright browsers by Playwright version and the Astro cache by lockfile and content', () => {
    expect(e2e).toMatch(/path: ~\/\.cache\/ms-playwright\n\s+key: playwright-\$\{\{ runner\.os \}\}-\$\{\{ steps\.pw\.outputs\.version \}\}/);
    expect(e2e).toMatch(/path: node_modules\/\.astro\n\s+key: astro-\$\{\{ hashFiles\('package-lock\.json'\) \}\}-\$\{\{ hashFiles\('content\/\*\*'\) \}\}/);
    // The caches restore into node_modules, so they come after the install that recreates it.
    expect(at('node_modules/.astro')).toBeGreaterThan(at('run: npm ci'));
  });

  it('installs chromium, firefox and webkit with their system dependencies', () => {
    expect(e2e).toMatch(/npx playwright install --with-deps chromium firefox webkit/);
  });

  it('pins every action to a full commit SHA with its version in a comment', () => {
    const uses = [...e2e.matchAll(/^\s*(?:- )?uses: (\S+)(.*)$/gm)];
    expect(uses.length).toBeGreaterThanOrEqual(5);
    for (const [, ref, rest] of uses) {
      expect(ref, 'uses').toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(rest, `${ref} version comment`).toMatch(/^\s+# v\d+/);
    }
  });

  it('uploads the test output when something fails, and does not pass without running the browsers', () => {
    expect(e2e).toMatch(/if: failure\(\)\n\s+uses: actions\/upload-artifact@/);
    expect(e2e).not.toMatch(/continue-on-error/);
  });
});
