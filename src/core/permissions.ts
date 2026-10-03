/**
 * Reads existing Claude Code permission rules (read-only) so the tool never
 * suggests a rule that is already allowed, or that a deny/ask rule overrides.
 *
 * Current syntax (code.claude.com/docs/en/permissions): `Bash(git status *)`,
 * where `*` matches any text and a trailing ` *` also matches the bare
 * command. `Bash(git status:*)` is the equivalent legacy suffix form. Rules
 * are evaluated deny, then ask, then allow; the first match wins.
 */

import { readFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type RuleLists = {
  /** Rules from user settings; apply to every project. */
  readonly user: readonly string[];
  /** Rules from a project's own settings files, by project name. */
  readonly byProject: Readonly<Record<string, readonly string[]>>;
};

export type AllowedRules = RuleLists & {
  /** `deny` and `ask` rules: a suggested allow must never meet one of these. */
  readonly restricted?: RuleLists;
};

export const NO_ALLOWED_RULES: AllowedRules = { user: [], byProject: {} };

const SETTINGS_FILES = ['settings.json', 'settings.local.json'] as const;

type RuleKind = 'allow' | 'deny' | 'ask';

async function readRules(
  path: string,
  kinds: readonly RuleKind[],
): Promise<readonly string[]> {
  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf-8'));
    const permissions =
      typeof parsed === 'object' && parsed !== null
        ? (parsed as { permissions?: unknown }).permissions
        : undefined;
    if (typeof permissions !== 'object' || permissions === null) {
      return [];
    }
    return kinds.flatMap((kind) => {
      const list = (permissions as Record<string, unknown>)[kind];
      return Array.isArray(list)
        ? list.filter((rule): rule is string => typeof rule === 'string')
        : [];
    });
  } catch {
    // Missing or invalid settings simply mean "no rules known".
    return [];
  }
}

async function readDirRules(
  dir: string,
  kinds: readonly RuleKind[],
): Promise<readonly string[]> {
  const lists = await Promise.all(
    SETTINGS_FILES.map((file) => readRules(join(dir, file), kinds)),
  );
  return lists.flat();
}

async function loadLists(
  projects: Readonly<Record<string, string>>,
  home: string,
  kinds: readonly RuleKind[],
): Promise<RuleLists> {
  const user = await readDirRules(join(home, '.claude'), kinds);
  const entries = await Promise.all(
    Object.entries(projects).map(
      async ([name, cwd]) =>
        [name, await readDirRules(join(cwd, '.claude'), kinds)] as const,
    ),
  );
  return { user, byProject: Object.fromEntries(entries) };
}

/** `projects` maps project name to its working directory. */
export async function loadAllowedRules(
  projects: Readonly<Record<string, string>>,
  home: string = homedir(),
): Promise<AllowedRules> {
  const [allow, restricted] = await Promise.all([
    loadLists(projects, home, ['allow']),
    loadLists(projects, home, ['deny', 'ask']),
  ]);
  return { ...allow, restricted };
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

/** True when `rule` would match `<command> <anything>`. */
export function ruleCovers(rule: string, command: string): boolean {
  const pattern = bashPattern(rule);
  if (pattern === null) {
    return false;
  }
  const probe = `${command} --probe`;
  const source = pattern.split('*').map(escapeRegExp).join('.*');
  return new RegExp(`^${source}$`, 's').test(probe);
}

/**
 * True when a deny/ask rule matches the suggested allow or sits inside the
 * space it would open (`Bash(gh pr view 12)` is narrower than `gh pr view *`).
 */
function overlaps(rule: string, command: string): boolean {
  if (ruleCovers(rule, command)) {
    return true;
  }
  const pattern = bashPattern(rule);
  return pattern?.startsWith(`${command} `) === true;
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

/**
 * Whether a deny or ask rule (user level, or in any project the command ran
 * in) touches the command. An allow suggested against one would be wrong:
 * rules are evaluated deny, then ask, then allow.
 */
export function isRestricted(
  command: string,
  projects: readonly string[],
  rules: AllowedRules,
): boolean {
  const restricted = rules.restricted;
  if (!restricted) {
    return false;
  }
  return (
    restricted.user.some((rule) => overlaps(rule, command)) ||
    projects.some((project) =>
      (restricted.byProject[project] ?? []).some((rule) =>
        overlaps(rule, command),
      ),
    )
  );
}
