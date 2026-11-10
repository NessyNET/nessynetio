// E2E config (design 5.2, ADR 012). Environment contract, shared with the nginx-backed run (036):
//   E2E_BASE_URL / E2E_STRESS_URL  where the site-e2e / site-stress builds are served (default: two local static servers)
//   E2E_RESOLVE                    Chromium --host-resolver-rules, plus ignoreHTTPSErrors (nginx container)
//   E2E_SKIP_BUILD=1               reuse the builds already in .e2e-sites/
//   E2E_SMOKE_URL                  enables tests/e2e/smoke.spec.ts (036)
import { defineConfig, devices } from '@playwright/test';

const DEFAULT_BASE = 'http://127.0.0.1:4321';
const DEFAULT_STRESS = 'http://127.0.0.1:4322';
const baseURL = process.env['E2E_BASE_URL'] ?? DEFAULT_BASE;
const resolveRules = process.env['E2E_RESOLVE'];
const serveLocally = process.env['E2E_BASE_URL'] === undefined;

const server = (dir: string, port: number) => ({
  command: `node tests/server/static-server.mjs --dir ${dir} --port ${port}`,
  // Ready when the port accepts connections: the servers start before global setup has built the sites.
  port,
  reuseExistingServer: false,
  timeout: 30_000,
});

export default defineConfig({
  testDir: 'tests/e2e',
  // Traces and failure artefacts stay out of test-results/, where hand-made evidence used to be wiped.
  outputDir: '.builds/e2e-results',
  testIgnore: process.env['E2E_SMOKE_URL'] === undefined ? ['**/smoke.spec.ts'] : [],
  globalSetup: './tests/e2e/global-setup.ts',
  retries: process.env['CI'] === undefined ? 0 : 1,
  reporter: [['list']],
  use: {
    baseURL,
    ignoreHTTPSErrors: resolveRules !== undefined,
    ...(resolveRules === undefined ? {} : { launchOptions: { args: [`--host-resolver-rules=${resolveRules}`] } }),
  },
  ...(serveLocally ? { webServer: [server('.e2e-sites/e2e', 4321), server('.e2e-sites/stress', 4322)] } : {}),
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', grep: /@cross/, use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', grep: /@cross/, use: { ...devices['Desktop Safari'] } },
  ],
});
