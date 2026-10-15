import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { InsightKind } from '../types/index.js';
import {
  loadClaudeMdHeadings,
  parseHeadings,
  pickSection,
} from './claude-md.js';
import { removeTempDir } from './test-cleanup.js';

describe('parseHeadings', () => {
  it('lists levels 2-4 in order, skipping the title and code fences', () => {
    const md = [
      '# Project Rules',
      '## Workflow',
      '```bash',
      '## not a heading',
      '```',
      '### Git ###',
      '#### Notes',
      '##### too deep',
    ].join('\n');
    expect(parseHeadings(md)).toEqual(['Workflow', 'Git', 'Notes']);
  });
});

describe('pickSection', () => {
  it('returns the first heading that fits the insight topic', () => {
    const headings = ['Overview', 'Tools and commands', 'Workflow'];
    expect(pickSection(headings, InsightKind.TOOL_ERROR_LOOPS)).toBe(
      'Tools and commands',
    );
    expect(pickSection(headings, InsightKind.CORRECTIONS)).toBe('Workflow');
  });

  it('returns null when nothing fits or the kind has no topic', () => {
    expect(pickSection(['Overview', 'Roadmap'], InsightKind.CORRECTIONS)).toBe(
      null,
    );
    expect(pickSection(['Workflow'], InsightKind.MODEL_SWITCHES)).toBe(null);
  });
});

describe('loadClaudeMdHeadings', () => {
  const dirs: string[] = [];
  afterEach(async () => {
    await Promise.all(dirs.splice(0).map(removeTempDir));
  });

  it('reads the user and project files without changing them', async () => {
    const home = await mkdtemp(join(tmpdir(), 'hyntx-home-'));
    const app = await mkdtemp(join(tmpdir(), 'hyntx-app-'));
    dirs.push(home, app);
    await mkdir(join(home, '.claude'));
    const userFile = join(home, '.claude', 'CLAUDE.md');
    const projectFile = join(app, 'CLAUDE.md');
    await writeFile(userFile, '# Me\n## Style\n');
    await writeFile(projectFile, '## Commands\n');

    const headings = await loadClaudeMdHeadings(
      { app, missing: join(app, 'nope') },
      home,
    );
    expect(headings.user).toEqual(['Style']);
    expect(headings.byProject).toEqual({ app: ['Commands'], missing: [] });
    expect(await readFile(userFile, 'utf-8')).toBe('# Me\n## Style\n');
    expect(await readFile(projectFile, 'utf-8')).toBe('## Commands\n');
  });
});
