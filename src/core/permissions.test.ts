import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  isAlreadyAllowed,
  isRestricted,
  loadAllowedRules,
  ruleCovers,
  toPermissionRule,
} from './permissions.js';

describe('ruleCovers', () => {
  it('understands the space and legacy colon wildcard forms', () => {
    expect(toPermissionRule('git status')).toBe('Bash(git status *)');
    expect(ruleCovers('Bash(git status *)', 'git status')).toBe(true);
    expect(ruleCovers('Bash(git status:*)', 'git status')).toBe(true);
    expect(ruleCovers('Bash(git *)', 'git status')).toBe(true);
    expect(ruleCovers('Bash', 'ls')).toBe(true);
    expect(ruleCovers('Bash(git status)', 'git status')).toBe(false);
    expect(ruleCovers('Bash(git log *)', 'git status')).toBe(false);
    expect(ruleCovers('Read(./x)', 'ls')).toBe(false);
  });
});

describe('isAlreadyAllowed', () => {
  it('needs every project covered unless the user settings allow it', () => {
    const rules = { user: [], byProject: { a: ['Bash(ls *)'] } };
    expect(isAlreadyAllowed('ls', ['a'], rules)).toBe(true);
    expect(isAlreadyAllowed('ls', ['a', 'b'], rules)).toBe(false);
    expect(isAlreadyAllowed('ls', [], rules)).toBe(false);
  });
});

describe('loadAllowedRules', () => {
  it('reads user and project settings and tolerates missing or broken files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hyntx-perm-'));
    const home = join(root, 'home');
    const project = join(root, 'proj');
    await mkdir(join(home, '.claude'), { recursive: true });
    await mkdir(join(project, '.claude'), { recursive: true });
    await writeFile(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Bash(ls *)', 3] } }),
    );
    await writeFile(join(project, '.claude', 'settings.local.json'), '{broken');
    await writeFile(
      join(project, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Bash(git diff *)'] } }),
    );
    const rules = await loadAllowedRules(
      { app: project, gone: join(root, 'x') },
      home,
    );
    expect(rules.user).toEqual(['Bash(ls *)']);
    expect(rules.byProject['app']).toEqual(['Bash(git diff *)']);
    expect(rules.byProject['gone']).toEqual([]);
  });

  it('also reads deny and ask rules, kept apart from allow rules', async () => {
    const root = await mkdtemp(join(tmpdir(), 'hyntx-perm-'));
    const home = join(root, 'home');
    const project = join(root, 'proj');
    await mkdir(join(home, '.claude'), { recursive: true });
    await mkdir(join(project, '.claude'), { recursive: true });
    await writeFile(
      join(home, '.claude', 'settings.json'),
      JSON.stringify({
        permissions: { allow: ['Bash(ls *)'], deny: ['Bash(gh pr merge *)'] },
      }),
    );
    await writeFile(
      join(project, '.claude', 'settings.local.json'),
      JSON.stringify({ permissions: { ask: ['Bash(gh pr view *)'] } }),
    );
    const rules = await loadAllowedRules({ app: project }, home);
    expect(rules.user).toEqual(['Bash(ls *)']);
    expect(rules.restricted?.user).toEqual(['Bash(gh pr merge *)']);
    expect(rules.restricted?.byProject['app']).toEqual(['Bash(gh pr view *)']);
    expect(isRestricted('gh pr view', ['app'], rules)).toBe(true);
    expect(isRestricted('gh pr view', ['other'], rules)).toBe(false);
    expect(isRestricted('gh pr list', ['app'], rules)).toBe(false);
  });
});
