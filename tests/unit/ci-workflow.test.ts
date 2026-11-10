import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// No YAML parser is installed (and none may be added), so the workflow is checked as text.
const WORKFLOW = readFileSync(fileURLToPath(new URL('../../.github/workflows/ci.yml', import.meta.url)), 'utf8');

/** The text of one top-level job: from its `  name:` line to the next job or the end. */
function job(name: string): string {
  const match = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z-]*:\\n|(?![\\s\\S]))`, 'm').exec(WORKFLOW);
  if (match === null) throw new Error(`job ${name} not found`);
  return match[1] ?? '';
}

describe('ci.yml', () => {
  it('runs on pull requests and pushes to main', () => {
    expect(WORKFLOW).toMatch(/^on:\n {2}pull_request:\n {2}push:\n {4}branches: \[main\]$/m);
  });

  it('has read-only contents permission at the top level', () => {
    expect(WORKFLOW).toMatch(/^permissions:\n {2}contents: read$/m);
  });

  it('cancels superseded runs per ref', () => {
    expect(WORKFLOW).toMatch(/^concurrency:\n {2}group: ci-\$\{\{ github\.ref \}\}\n {2}cancel-in-progress: true$/m);
  });

  it('pins every action to a full commit SHA with its version in a comment', () => {
    const uses = [...WORKFLOW.matchAll(/^\s*(?:- )?uses: (\S+)(.*)$/gm)];
    expect(uses.length).toBeGreaterThanOrEqual(4);
    for (const [, ref, rest] of uses) {
      expect(ref, 'uses').toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(rest, `${ref} version comment`).toMatch(/^\s+# v\d+/);
    }
  });

  it('check job: Node from .nvmrc with the npm cache, then ci, lint, types, tests', () => {
    const check = job('check');
    expect(check).toMatch(/runs-on: ubuntu-latest/);
    expect(check).toMatch(/node-version-file: \.nvmrc/);
    expect(check).toMatch(/cache: npm/);
    const order = ['npm ci', 'npm run lint', 'npm run check', 'npm test'].map((cmd) => check.indexOf(`run: ${cmd}\n`));
    expect(order.every((i) => i >= 0), 'every command present').toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });

  it('check job: strict build allowing samples, sample list in the summary, preview artifact for 7 days', () => {
    const check = job('check');
    expect(check).toMatch(/run: npm run build -- --strict --allow-samples\n/);
    expect(check).toMatch(/npm run --silent samples\n[\s\S]*\} >> "\$GITHUB_STEP_SUMMARY"/);
    expect(check).toMatch(/name: site-preview\n\s+path: dist\/\n\s+retention-days: 7/);
  });

  it('release-readiness: only on pushes to main, never blocking, strict build without samples', () => {
    const readiness = job('release-readiness');
    expect(readiness).toMatch(/if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/);
    expect(readiness).toMatch(/continue-on-error: true/);
    expect(readiness).toMatch(/npm run build -- --strict(?! --allow-samples)/);
    expect(readiness).not.toMatch(/--allow-samples/);
    expect(readiness).toMatch(/GITHUB_STEP_SUMMARY/);
  });

  it('the check job does not run on the readiness condition, and readiness does not upload', () => {
    expect(job('check')).not.toMatch(/continue-on-error/);
    expect(job('release-readiness')).not.toMatch(/upload-artifact/);
  });
});
