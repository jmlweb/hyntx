import { describe, expect, it } from 'vitest';

import { makeCall } from './test-helpers.js';
import {
  classifyToolError,
  ErrorClass,
  isBenignNonZeroExit,
  isRealToolError,
  summarizeToolErrors,
} from './tool-errors.js';

const bash = (command: string, text: string): ReturnType<typeof makeCall> =>
  makeCall('Bash', { command, error: true, text });

describe('isRealToolError', () => {
  it('does not count grep with no match or a diff as failures', () => {
    expect(isRealToolError(bash('grep -n foo src/a.ts', 'Exit code 1'))).toBe(
      false,
    );
    expect(
      isBenignNonZeroExit(
        bash('cat a.md; echo ---; grep -c x a.md', 'Exit code 1\n---\n0'),
      ),
    ).toBe(true);
    expect(isRealToolError(bash('diff a b', 'Exit code 1\n1c1'))).toBe(false);
  });

  it('keeps real failures: other exit codes, error text, non-status commands', () => {
    expect(
      isRealToolError(bash('grep x f', 'Exit code 2\ngrep: f: No such file')),
    ).toBe(true);
    expect(
      isRealToolError(
        bash(
          'cat f; grep x f',
          'Exit code 1\ncat: f: No such file or directory',
        ),
      ),
    ).toBe(true);
    expect(isRealToolError(bash('pnpm test', 'Exit code 1\n3 failed'))).toBe(
      true,
    );
  });

  it('never counts denials or successes', () => {
    expect(
      isRealToolError(
        makeCall('Bash', {
          command: 'rm x',
          error: true,
          denial: 'hook',
          text: 'blocked',
        }),
      ),
    ).toBe(false);
    expect(isRealToolError(makeCall('Bash', { command: 'ls' }))).toBe(false);
  });
});

describe('classifyToolError', () => {
  it('recognises general causes and extracts the missing binary', () => {
    expect(
      classifyToolError(bash('x', '(eval):1: no matches found: *.md')).id,
    ).toBe(ErrorClass.GLOB_NO_MATCH);
    expect(
      classifyToolError(bash('jqq .', 'zsh: command not found: jqq')),
    ).toEqual({
      id: ErrorClass.COMMAND_NOT_FOUND,
      param: 'jqq',
    });
    expect(
      classifyToolError(
        bash('docker ps', 'failed to connect to the docker API at unix:///x'),
      ).id,
    ).toBe(ErrorClass.DAEMON_DOWN);
    expect(classifyToolError(bash('make', 'boom')).id).toBe(
      ErrorClass.UNCLASSIFIED,
    );
  });

  it('splits modified-since-read out of edit mismatches', () => {
    const changed = makeCall('Edit', {
      error: true,
      text: '<tool_use_error>File has been modified since read, either by the user or by a linter. Read it again before attempting to write it.</tool_use_error>',
    });
    expect(classifyToolError(changed).id).toBe(ErrorClass.FILE_CHANGED);
    const mismatch = makeCall('Edit', {
      error: true,
      text: '<tool_use_error>String to replace not found in file.</tool_use_error>',
    });
    expect(classifyToolError(mismatch).id).toBe(ErrorClass.EDIT_MISMATCH);
  });

  it('recognises reads rejected because the file is too large', () => {
    const tokens = makeCall('Read', {
      error: true,
      text: 'File content (31200 tokens) exceeds maximum allowed tokens (25000). Please use offset and limit parameters to read specific portions of the file, or use the GrepTool to search for specific content.',
    });
    expect(classifyToolError(tokens).id).toBe(ErrorClass.FILE_TOO_LARGE);
    const bytes = makeCall('Read', {
      error: true,
      text: 'File is too large to read (3.1MB). Use offset and limit.',
    });
    expect(classifyToolError(bytes).id).toBe(ErrorClass.FILE_TOO_LARGE);
  });

  it('summarises a group by its dominant cause only when it dominates', () => {
    const globs = [1, 2, 3].map(() => bash('ls *.x', 'no matches found: *.x'));
    expect(summarizeToolErrors(globs).id).toBe(ErrorClass.GLOB_NO_MATCH);
    const mixed = [
      bash('a', 'no matches found'),
      bash('b', 'boom'),
      bash('c', 'bang'),
    ];
    expect(summarizeToolErrors(mixed).id).toBe(ErrorClass.UNCLASSIFIED);
  });
});
