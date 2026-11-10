// deploy/deploy-gate (design 3.6.4): the forced command of the CI key. Stubs stand in for rrsync and activate.
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const GATE = resolve('deploy/deploy-gate');
const ID = '20261109T120000Z-abc1234';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'gate-'));
  for (const name of ['rrsync', 'activate']) {
    writeFileSync(join(dir, name), `#!/usr/bin/env bash\necho "${name} $*"\n`);
    chmodSync(join(dir, name), 0o755);
  }
});
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const gate = (command: string | undefined) => {
  const env: NodeJS.ProcessEnv = { ...process.env, GATE_RRSYNC: join(dir, 'rrsync'), GATE_ACTIVATE: join(dir, 'activate'), GATE_RELEASES: '/srv/nessynet/releases' };
  if (command === undefined) delete env['SSH_ORIGINAL_COMMAND'];
  else env['SSH_ORIGINAL_COMMAND'] = command;
  return spawnSync('bash', [GATE], { encoding: 'utf8', env });
};

describe('allowed forms', () => {
  it('an rsync server invocation goes to rrsync, write-only, rooted at releases/', () => {
    const result = gate(`rsync --server -logDtpre.iLsfxCIvu . ${ID}/`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe('rrsync -wo /srv/nessynet/releases');
  });

  it('activate <id> goes to activate', () => {
    const result = gate(`activate ${ID}`);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout.trim()).toBe(`activate ${ID}`);
  });

  it('rollback goes to activate --rollback, with or without an id', () => {
    expect(gate('rollback').stdout.trim()).toBe('activate --rollback');
    expect(gate(`rollback ${ID}`).stdout.trim()).toBe(`activate --rollback ${ID}`);
  });
});

describe('refusals (exit 1, nothing executed, a message on stderr)', () => {
  it.each([
    ['no command (an interactive shell)', undefined],
    ['an empty command', ''],
    ['id', 'id'],
    ['bash', 'bash'],
    ['bash -c id', 'bash -c id'],
    ['a path traversal in the id', 'activate ../x'],
    ['an id with a path in it', `activate ${ID}/../${ID}`],
    ['a malformed id', 'activate 2026-11-09'],
    ['an upper-case id', `activate ${ID.toUpperCase()}`],
    ['no id', 'activate'],
    ['a second argument', `activate ${ID} extra`],
    ['a chained command', `activate ${ID}; id`],
    ['a command substitution', `activate $(id)`],
    ['a newline-separated command', `activate ${ID}\nid`],
    ['rollback with a malformed id', 'rollback ../x'],
    ['rollback with extra arguments', `rollback ${ID} now`],
    ['an rsync target outside releases/ (absolute)', 'rsync --server -logDtpre.iLsfxCIvu . /etc/'],
    ['an rsync target outside releases/ (parent)', 'rsync --server -logDtpre.iLsfxCIvu . ../current/'],
    ['an rsync download (sender)', `rsync --server --sender -logDtpre.iLsfxCIvu . ${ID}/`],
    ['rsync with shell metacharacters', `rsync --server -logDtpre.iLsfxCIvu . ${ID}/;id`],
    ['rsync without --server', `rsync -a . ${ID}/`],
    ['scp', 'scp -t /tmp'],
    ['sftp', 'internal-sftp'],
  ])('%s', (_name, command) => {
    const result = gate(command);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toMatch(/deploy-gate: refused/);
  });
});
