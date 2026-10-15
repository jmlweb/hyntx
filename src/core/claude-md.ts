/**
 * Reads the headings of existing CLAUDE.md files (read-only) so a suggested
 * rule can say which section it belongs under. Nothing is ever written.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

import { InsightKind } from '../types/index.js';

export type ClaudeMdHeadings = {
  /** Headings of `~/.claude/CLAUDE.md`. */
  readonly user: readonly string[];
  /** Headings of each project's own `CLAUDE.md`, by project name. */
  readonly byProject: Readonly<Record<string, readonly string[]>>;
};

export const NO_CLAUDE_MD_HEADINGS: ClaudeMdHeadings = {
  user: [],
  byProject: {},
};

/** Section titles, in file order. The `#` title and headings inside code fences are skipped. */
export function parseHeadings(markdown: string): readonly string[] {
  let inFence = false;
  return markdown.split('\n').flatMap((line) => {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      return [];
    }
    const title = inFence
      ? undefined
      : /^#{2,4}\s+(.+?)\s*#*\s*$/.exec(line)?.[1];
    return title ? [title] : [];
  });
}

async function readHeadings(path: string): Promise<readonly string[]> {
  try {
    return parseHeadings(await readFile(path, 'utf-8'));
  } catch {
    // A missing or unreadable file simply means "no sections known".
    return [];
  }
}

/** `projects` maps project name to its working directory. */
export async function loadClaudeMdHeadings(
  projects: Readonly<Record<string, string>>,
  home: string = homedir(),
): Promise<ClaudeMdHeadings> {
  const [user, entries] = await Promise.all([
    readHeadings(join(home, '.claude', 'CLAUDE.md')),
    Promise.all(
      Object.entries(projects).map(
        async ([name, cwd]) =>
          [name, await readHeadings(join(cwd, 'CLAUDE.md'))] as const,
      ),
    ),
  ]);
  return { user, byProject: Object.fromEntries(entries) };
}

const TOPIC_BY_KIND: Readonly<Partial<Record<InsightKind, RegExp>>> = {
  [InsightKind.TOOL_ERROR_LOOPS]:
    /\b(tools?|commands?|shell|bash|environment|setup|troubleshooting|workflow)\b/i,
  [InsightKind.TOOL_DENIALS]:
    /\b(permissions?|safety|security|hooks?|git|commands?|workflow)\b/i,
  [InsightKind.CORRECTIONS]:
    /\b(conventions?|style|preferences?|guidelines?|rules|workflow|instructions|behaviou?r)\b/i,
  [InsightKind.REPEATED_INSTRUCTION]:
    /\b(conventions?|style|preferences?|guidelines?|rules|workflow|instructions|behaviou?r)\b/i,
  [InsightKind.REWORK]:
    /\b(conventions?|style|guidelines?|rules|workflow|testing|code)\b/i,
};

/** First heading, in file order, whose words fit the insight's topic; null when none does. */
export function pickSection(
  headings: readonly string[],
  kind: InsightKind,
): string | null {
  const topic = TOPIC_BY_KIND[kind];
  return (topic && headings.find((heading) => topic.test(heading))) ?? null;
}
