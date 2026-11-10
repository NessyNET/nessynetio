import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// No YAML parser is installed (and none may be added), so the workflow is checked as text.
const WORKFLOW = readFileSync(fileURLToPath(new URL('../../.github/workflows/deploy.yml', import.meta.url)), 'utf8');

/** The text of one top-level job: from its `  name:` line to the next job or the end. */
function job(name: string): string {
  const match = new RegExp(`^  ${name}:\\n([\\s\\S]*?)(?=^  [a-z][a-z-]*:\\n|(?![\\s\\S]))`, 'm').exec(WORKFLOW);
  if (match === null) throw new Error(`job ${name} not found`);
  return match[1] ?? '';
}

describe('deploy.yml triggers and policy', () => {
  it('runs after ci on main and on manual dispatch with action and release_id inputs', () => {
    expect(WORKFLOW).toMatch(/^on:\n {2}workflow_run:\n {4}workflows: \[ci\]\n {4}types: \[completed\]\n {4}branches: \[main\]\n {2}workflow_dispatch:\n/m);
    expect(WORKFLOW).toMatch(/action:\n[\s\S]*?type: choice\n[\s\S]*?options: \[deploy, rollback\]/);
    expect(WORKFLOW).toMatch(/release_id:\n[\s\S]*?required: false/);
  });

  it('has read-only contents permission and never cancels a running deploy', () => {
    expect(WORKFLOW).toMatch(/^permissions:\n {2}contents: read$/m);
    expect(WORKFLOW).toMatch(/^concurrency:\n {2}group: production\n {2}cancel-in-progress: false$/m);
  });

  it('pins every action to a full commit SHA with its version in a comment', () => {
    const uses = [...WORKFLOW.matchAll(/^\s*(?:- )?uses: (\S+)(.*)$/gm)];
    expect(uses.length).toBeGreaterThanOrEqual(2);
    for (const [, ref, rest] of uses) {
      expect(ref, 'uses').toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
      expect(rest, `${ref} version comment`).toMatch(/^\s+# v\d+/);
    }
  });
});

describe('release job guard', () => {
  const release = job('release');
  // The job-level `if:` is the text between `    if:` and the next job-level key.
  const condition = release.slice(release.indexOf('    if:'), release.indexOf('    environment:'));

  it('only runs for a successful push-triggered main run of this repository, with DEPLOY_ENABLED on', () => {
    for (const clause of [
      "vars.DEPLOY_ENABLED == 'true'",
      "github.event_name == 'workflow_run'",
      "github.event.workflow_run.conclusion == 'success'",
      "github.event.workflow_run.event == 'push'",
      "github.event.workflow_run.head_branch == 'main'",
      'github.event.workflow_run.head_repository.full_name == github.repository',
    ]) {
      expect(condition, clause).toContain(clause);
    }
  });

  it('also accepts a manual deploy, only from refs/heads/main and only with DEPLOY_ENABLED on', () => {
    const manual = condition.slice(condition.indexOf('|| ('));
    expect(manual).toContain("vars.DEPLOY_ENABLED == 'true'");
    expect(condition).toContain("github.event_name == 'workflow_dispatch'");
    expect(condition).toContain("github.ref == 'refs/heads/main'");
    expect(condition).toContain("inputs.action == 'deploy'");
  });

  it('uses the production environment', () => {
    expect(release).toMatch(/^ {4}environment: production$/m);
  });

  it('takes the SHA from the triggering run (or the dispatch ref) and checks out exactly that', () => {
    expect(release).toMatch(/DEPLOY_SHA: \$\{\{ github\.event\.workflow_run\.head_sha \|\| github\.sha \}\}/);
    expect(release).toMatch(/ref: \$\{\{ env\.DEPLOY_SHA \}\}\n\s+fetch-depth: 0/);
  });
});

describe('release job steps', () => {
  const release = job('release');
  const index = (needle: string): number => {
    const at = release.indexOf(needle);
    expect(at, needle).toBeGreaterThanOrEqual(0);
    return at;
  };

  it('checks for a superseded commit before anything is installed, and ends green when it is', () => {
    const superseded = index('id: tip');
    expect(superseded).toBeLessThan(index('run: npm ci'));
    const step = release.slice(superseded, index('run: npm ci'));
    expect(step).toContain('git fetch origin main');
    expect(step).toMatch(/git rev-parse origin\/main/);
    expect(step).toContain('superseded by a newer main commit');
    expect(step).toContain('$GITHUB_STEP_SUMMARY');
    expect(step).toContain('$GITHUB_OUTPUT');
    expect(step).not.toMatch(/exit [1-9]/);
  });

  it('conditions every step after the superseded check on it not being superseded', () => {
    const after = release.slice(index('id: tip'));
    const steps = after.split(/^ {6}- /m).slice(1); // steps following the superseded one
    expect(steps.length).toBeGreaterThanOrEqual(3);
    for (const step of steps) {
      if (/^ *if: always\(\)/m.test(step) || /Remove the key files/.test(step)) continue;
      expect(step, step.split('\n')[0]).toContain("steps.tip.outputs.superseded != 'true'");
    }
  });

  it('writes the key and the pinned host key to mode-600 files and never echoes them', () => {
    expect(release).toContain('umask 077');
    expect(release).toContain('$RUNNER_TEMP/deploy_key');
    expect(release).toContain('$RUNNER_TEMP/known_hosts');
    expect(release).not.toMatch(/echo[^\n]*\$\{?DEPLOY_SSH_KEY/);
    expect(release).not.toMatch(/echo[^\n]*secrets\./);
    expect(release).not.toMatch(/run:[^\n]*\$\{\{ *secrets\./);
  });

  it('installs and runs the release script, with the host key file and host from the environment', () => {
    expect(index('run: npm ci')).toBeLessThan(index('run: npm run deploy'));
    expect(release).toMatch(/DEPLOY_SSH_KEY_FILE=/);
    expect(release).toMatch(/DEPLOY_KNOWN_HOSTS: \$\{\{ runner\.temp \}\}\/known_hosts/);
    expect(release).toMatch(/DEPLOY_HOST: \$\{\{ vars\.DEPLOY_HOST \}\}/);
  });
});

describe('rollback job', () => {
  const rollback = job('rollback');

  it('runs only for a manual rollback from main, in the production environment, whatever DEPLOY_ENABLED says', () => {
    expect(rollback).not.toContain('DEPLOY_ENABLED');
    expect(rollback).toMatch(/^ {4}if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main' && inputs\.action == 'rollback'$/m);
    expect(rollback).toMatch(/^ {4}environment: production$/m);
  });

  it('passes the release id through the environment, validates it, and smoke-tests afterwards', () => {
    expect(rollback).toMatch(/RELEASE_ID: \$\{\{ inputs\.release_id \}\}/);
    expect(rollback).not.toMatch(/run:[^\n]*\$\{\{ *inputs\./);
    expect(rollback).toMatch(/\[0-9\]\{8\}T\[0-9\]\{6\}Z-\[0-9a-f\]\{7,12\}/);
    expect(rollback).toMatch(/StrictHostKeyChecking=yes/);
    expect(rollback).toMatch(/curl[^\n]*https:\/\/nessynet\.io\//);
  });
});
