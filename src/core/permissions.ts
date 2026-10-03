/**
 * Reads existing Claude Code permission rules (read-only) so the tool never
 * suggests a rule that is already allowed.
 *
 * Current syntax (code.claude.com/docs/en/permissions): `Bash(git status *)`,
 * where `*` matches any text and a trailing ` *` also matches the bare
 * command. `Bash(git status:*)` is the equivalent legacy suffix form.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type AllowedRules = {
  /** Rules from user settings; apply to every project. */
  readonly user: readonly string[];
  /** Rules from a project's own settings files, by project name. */
  readonly byProject: Readonly<Record<string, readonly string[]>>;
};

export const NO_ALLOWED_RULES: AllowedRules = { user: [], byProject: {} };

const SETTINGS_FILES = ['settings.json', 'settings.local.json'] as const;

async function readAllowList(path: string): Promise<readonly string[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf-8'));
    const permissions =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { permissions?: unknown }).permissions
        : undefined;
    const allow =
      typeof permissions === 'object' && permissions !== null
        ? (permissions as { allow?: unknown }).allow
        : undefined;
    return Array.isArray(allow)
      ? allow.filter((rule): rule is string => typeof rule === 'string')
      : [];
  } catch {
    // Missing or invalid settings simply mean "no rules known".
    return [];
  }
}

async function readDirAllowList(dir: string): Promise<readonly string[]> {
  const lists = await Promise.all(
    SETTINGS_FILES.map((file) => readAllowList(join(dir, file))),
  );
  return lists.flat();
}

/** `projects` maps project name to its working directory. */
export async function loadAllowedRules(
  projects: Readonly<Record<string, string>>,
  home: string = homedir(),
): Promise<AllowedRules> {
  const user = await readDirAllowList(join(home, '.claude'));
  const entries = await Promise.all(
    Object.entries(projects).map(
      async ([name, cwd]) =>
        [name, await readDirAllowList(join(cwd, '.claude'))] as const,
    ),
  );
  return { user, byProject: Object.fromEntries(entries) };
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
}

function bashPattern(rule: string): string | null {
  if (rule === 'Bash' || rule === 'Bash(*)') {
    return '*';
  }
  const match = /^Bash\((.*)\)$/s.exec(rule);
  const inner = match?.[1];
  if (inner === undefined) {
    return null;
  }
  return inner.endsWith(':*') ? `${inner.slice(0, -2)} *` : inner;
}

/** True when `rule` would auto-approve `<command> <anything>`. */
export function ruleCovers(rule: string, command: string): boolean {
  const pattern = bashPattern(rule);
  if (pattern === null) {
    return false;
  }
  const probe = `${command} --probe`;
  const source = pattern.split('*').map(escapeRegExp).join('.*');
  return new RegExp(`^${source}$`, 's').test(probe);
}

export function toPermissionRule(command: string): string {
  return `Bash(${command} *)`;
}

/**
 * Whether every project the command ran in already allows it, either through
 * user settings or that project's own settings.
 */
export function isAlreadyAllowed(
  command: string,
  projects: readonly string[],
  rules: AllowedRules,
): boolean {
  if (rules.user.some((rule) => ruleCovers(rule, command))) {
    return true;
  }
  return (
    projects.length > 0 &&
    projects.every((project) =>
      (rules.byProject[project] ?? []).some((rule) =>
        ruleCovers(rule, command),
      ),
    )
  );
}
