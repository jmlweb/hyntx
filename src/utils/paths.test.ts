import { homedir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CLAUDE_PROJECTS_DIR, LAST_RUN_FILE } from './paths.js';

describe('paths', () => {
  const HOME = homedir();

  describe('CLAUDE_PROJECTS_DIR', () => {
    it('should point to ~/.claude/projects', () => {
      const expected = join(HOME, '.claude', 'projects');
      expect(CLAUDE_PROJECTS_DIR).toBe(expected);
    });

    it('should be an absolute path', () => {
      expect(CLAUDE_PROJECTS_DIR.startsWith('/')).toBe(true);
    });

    it('should contain .claude directory', () => {
      expect(CLAUDE_PROJECTS_DIR).toContain('.claude');
    });
  });

  describe('LAST_RUN_FILE', () => {
    it('should point to ~/.hyntx-last-run', () => {
      const expected = join(HOME, '.hyntx-last-run');
      expect(LAST_RUN_FILE).toBe(expected);
    });

    it('should be an absolute path', () => {
      expect(LAST_RUN_FILE.startsWith('/')).toBe(true);
    });

    it('should be in home directory', () => {
      expect(LAST_RUN_FILE.startsWith(HOME)).toBe(true);
    });
  });
});
