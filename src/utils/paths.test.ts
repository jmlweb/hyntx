import { homedir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('paths', () => {
  const HOME = homedir();
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('CLAUDE_PROJECTS_DIR', () => {
    it('should point to ~/.claude/projects by default', async () => {
      delete process.env['HYNTX_CLAUDE_PROJECTS_DIR'];
      const { CLAUDE_PROJECTS_DIR } = await import('./paths.js');
      const expected = join(HOME, '.claude', 'projects');
      expect(CLAUDE_PROJECTS_DIR).toBe(expected);
    });

    it('should use HYNTX_CLAUDE_PROJECTS_DIR env variable when set', async () => {
      const customPath = '/tmp/custom-claude-projects';
      process.env['HYNTX_CLAUDE_PROJECTS_DIR'] = customPath;
      const { CLAUDE_PROJECTS_DIR } = await import('./paths.js');
      expect(CLAUDE_PROJECTS_DIR).toBe(customPath);
    });

    it('should be an absolute path', async () => {
      delete process.env['HYNTX_CLAUDE_PROJECTS_DIR'];
      const { CLAUDE_PROJECTS_DIR } = await import('./paths.js');
      expect(CLAUDE_PROJECTS_DIR.startsWith('/')).toBe(true);
    });

    it('should contain .claude directory by default', async () => {
      delete process.env['HYNTX_CLAUDE_PROJECTS_DIR'];
      const { CLAUDE_PROJECTS_DIR } = await import('./paths.js');
      expect(CLAUDE_PROJECTS_DIR).toContain('.claude');
    });
  });

  describe('LAST_RUN_FILE', () => {
    it('should point to ~/.hyntx-last-run', async () => {
      const { LAST_RUN_FILE } = await import('./paths.js');
      const expected = join(HOME, '.hyntx-last-run');
      expect(LAST_RUN_FILE).toBe(expected);
    });

    it('should be an absolute path', async () => {
      const { LAST_RUN_FILE } = await import('./paths.js');
      expect(LAST_RUN_FILE.startsWith('/')).toBe(true);
    });

    it('should be in home directory', async () => {
      const { LAST_RUN_FILE } = await import('./paths.js');
      expect(LAST_RUN_FILE.startsWith(HOME)).toBe(true);
    });
  });
});
