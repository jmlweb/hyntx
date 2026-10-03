/**
 * Tool-error accounting: separates real failures from non-zero exits that are
 * normal (grep with no match), and classifies failures into causes general
 * enough to be worth a CLAUDE.md rule.
 */

import { type ToolCall } from '../types/index.js';

const EXIT_ONE = /^\s*Exit code 1\b/;

/** Commands whose exit code 1 means "no match / differs", not a failure. */
const STATUS_BY_DESIGN: ReadonlySet<string> = new Set([
  'grep',
  'egrep',
  'fgrep',
  'rg',
  'diff',
  'cmp',
  'test',
  '[',
  '[[',
  'pgrep',
  'which',
]);

const ERROR_VOCABULARY =
  /\b(error|fatal|failed|cannot|can't|unable|denied|refused|not found|no such|invalid|unexpected|exception|timed out|traceback)\b/i;

function statementBinaries(command: string): readonly string[] {
  return command
    .split(/&&|\|\||;|\||\n/)
    .map(
      (segment) =>
        segment
          .replace(/^\s*(?:[A-Za-z_]\w*=\S*\s+)+/, '')
          .trim()
          .split(/\s+/)[0],
    )
    .filter((bin): bin is string => bin !== undefined && bin !== '');
}

/**
 * Exit code 1 from a compound command containing grep/diff/test and no
 * error-looking output is the tool answering "no match", not breaking.
 */
export function isBenignNonZeroExit(call: ToolCall): boolean {
  const result = call.result;
  if (
    call.name !== 'Bash' ||
    !call.command ||
    !result?.isError ||
    result.denial !== null ||
    !EXIT_ONE.test(result.excerpt)
  ) {
    return false;
  }
  const hasStatusCommand = statementBinaries(call.command).some((bin) =>
    STATUS_BY_DESIGN.has(bin),
  );
  const body = result.excerpt.replace(EXIT_ONE, '');
  return hasStatusCommand && !ERROR_VOCABULARY.test(body);
}

export function isRealToolError(call: ToolCall): boolean {
  return (
    call.result?.isError === true &&
    call.result.denial === null &&
    !isBenignNonZeroExit(call)
  );
}

/** First line that looks like an error message, else the first content line. */
export function errorLine(text: string): string {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(
      (line) => !/^[-=_*#~\s]*$/.test(line) && !/^exit code \d+$/i.test(line),
    );
  return lines.find((line) => ERROR_VOCABULARY.test(line)) ?? lines[0] ?? '';
}

export const ErrorClass = {
  GLOB_NO_MATCH: 'glob-no-match',
  COMMAND_NOT_FOUND: 'command-not-found',
  DAEMON_DOWN: 'daemon-down',
  AUTH_FAILED: 'auth-failed',
  EDIT_MISMATCH: 'edit-mismatch',
  FILE_MISSING: 'file-missing',
  TIMEOUT: 'timeout',
  UNCLASSIFIED: 'unclassified',
} as const;
export type ErrorClass = (typeof ErrorClass)[keyof typeof ErrorClass];

type Classified = { readonly id: ErrorClass; readonly param: string | null };

export function classifyToolError(call: ToolCall): Classified {
  const text = call.result?.excerpt ?? '';
  if (/no matches found/i.test(text)) {
    return { id: ErrorClass.GLOB_NO_MATCH, param: null };
  }
  const missing =
    /command not found: ([\w.+-]+)/.exec(text) ??
    /(?:^|[\s:])([\w.+-]+): (?:command )?not found/m.exec(text);
  if (missing?.[1]) {
    return { id: ErrorClass.COMMAND_NOT_FOUND, param: missing[1] };
  }
  if (
    /cannot connect to the docker daemon|failed to connect to the docker api/i.test(
      text,
    )
  ) {
    return { id: ErrorClass.DAEMON_DOWN, param: 'docker' };
  }
  if (
    /authentication failed|permission denied \(publickey|host key verification failed/i.test(
      text,
    )
  ) {
    return { id: ErrorClass.AUTH_FAILED, param: null };
  }
  if (
    /string to replace not found|found \d+ matches|file has been modified|has not been read yet/i.test(
      text,
    ) ||
    (['Edit', 'MultiEdit'].includes(call.name) &&
      /not found|unique/i.test(text))
  ) {
    return { id: ErrorClass.EDIT_MISMATCH, param: null };
  }
  if (/no such file or directory|ENOENT|file does not exist/i.test(text)) {
    return { id: ErrorClass.FILE_MISSING, param: null };
  }
  if (/timed out|ETIMEDOUT|timeout/i.test(text)) {
    return { id: ErrorClass.TIMEOUT, param: null };
  }
  return { id: ErrorClass.UNCLASSIFIED, param: null };
}

/** Dominant class of a group of failed calls, with merged parameters. */
export function summarizeToolErrors(calls: readonly ToolCall[]): Classified {
  const counts = new Map<ErrorClass, number>();
  const params = new Set<string>();
  for (const call of calls) {
    const { id, param } = classifyToolError(call);
    counts.set(id, (counts.get(id) ?? 0) + 1);
    if (param) {
      params.add(param);
    }
  }
  const classified = [...counts.entries()]
    .filter(([id]) => id !== ErrorClass.UNCLASSIFIED)
    .sort((a, b) => b[1] - a[1])[0];
  if (!classified || classified[1] * 2 < calls.length) {
    return { id: ErrorClass.UNCLASSIFIED, param: null };
  }
  const id = classified[0];
  return {
    id,
    param:
      id === ErrorClass.COMMAND_NOT_FOUND || id === ErrorClass.DAEMON_DOWN
        ? [...params].sort().slice(0, 3).join(', ') || null
        : null,
  };
}
