/**
 * Claude interpretation engine (default): runs the user's own `claude` CLI in
 * print mode, so it reuses their existing login and needs no API key.
 *
 * The run is locked down: no tools, no CLAUDE.md/hooks/MCP/plugins/skills
 * (--safe-mode), a neutral working directory, and no session file written
 * (--no-session-persistence), so hyntx never analyses its own runs later.
 */

import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';

import {
  type Interpretation,
  type InterpretOptions,
  type Report,
} from '../types/index.js';
import {
  buildUserPrompt,
  CLAUDE_BUDGET,
  EngineOutputError,
  EngineUnavailableError,
  parseJsonObject,
  RESPONSE_SCHEMA,
  selectEvidence,
  SYSTEM_PROMPT,
  validateAnswer,
} from './shared.js';

export const CLAUDE_TIMEOUT_MS = 180_000;

export type ProcessResult = {
  readonly stdout: string;
  readonly stderr: string;
  readonly code: number | null;
};

export type RunProcess = (
  command: string,
  args: readonly string[],
  input: string,
  signal: AbortSignal,
) => Promise<ProcessResult>;

export function buildClaudeArgs(model: string | undefined): string[] {
  return [
    '-p',
    '--output-format',
    'json',
    // Structured output: the CLI validates the reply against the schema.
    '--json-schema',
    JSON.stringify(RESPONSE_SCHEMA),
    '--system-prompt',
    SYSTEM_PROMPT,
    // Read-only by construction: no built-in tools at all.
    '--tools',
    '',
    '--permission-prompts',
    'none',
    // Skip CLAUDE.md, hooks, MCP servers, plugins, skills and custom commands.
    '--safe-mode',
    '--strict-mcp-config',
    '--disable-slash-commands',
    // Keep the run out of ~/.claude/projects so hyntx never reads it back.
    '--no-session-persistence',
    ...(model ? ['--model', model] : []),
  ];
}

/** Spawns without a shell; the prompt travels over stdin, never in argv. */
export const runProcess: RunProcess = (command, args, input, signal) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, [...args], {
      cwd: tmpdir(),
      stdio: ['pipe', 'pipe', 'pipe'],
      signal,
    });
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    child.stdout.on('data', (chunk: Buffer) => out.push(chunk));
    child.stderr.on('data', (chunk: Buffer) => err.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      resolve({
        stdout: Buffer.concat(out).toString('utf-8'),
        stderr: Buffer.concat(err).toString('utf-8'),
        code,
      });
    });
    child.stdin.on('error', () => {
      // The child may exit before reading stdin; 'close' reports the result.
    });
    child.stdin.end(input);
  });

const NOT_LOGGED_IN =
  /not logged in|please run \/login|invalid api key|authentication|oauth/i;

function isErrnoCode(error: unknown, code: string): boolean {
  return error instanceof Error && (error as { code?: unknown }).code === code;
}

function describeFailure(result: ProcessResult): never {
  const detail = `${result.stdout}\n${result.stderr}`;
  if (NOT_LOGGED_IN.test(detail)) {
    throw new EngineUnavailableError(
      'the claude CLI is not logged in. Run `claude` once to log in, use --engine ollama, or pass --no-llm.',
    );
  }
  const reason = (result.stderr.trim() || result.stdout.trim()).slice(0, 200);
  throw new EngineOutputError(
    `claude exited with code ${String(result.code)}${reason ? `: ${reason}` : ''}`,
  );
}

function extractPayload(stdout: string): unknown {
  let envelope: unknown;
  try {
    envelope = JSON.parse(stdout);
  } catch {
    throw new EngineOutputError('claude returned output that is not JSON');
  }
  if (typeof envelope !== 'object' || envelope === null) {
    throw new EngineOutputError('claude returned an unexpected envelope');
  }
  const record = envelope as Record<string, unknown>;
  if (record['is_error'] === true) {
    const message =
      typeof record['result'] === 'string' ? record['result'] : 'unknown error';
    if (NOT_LOGGED_IN.test(message)) {
      throw new EngineUnavailableError(
        'the claude CLI is not logged in. Run `claude` once to log in, use --engine ollama, or pass --no-llm.',
      );
    }
    throw new EngineOutputError(
      `claude reported an error: ${message.slice(0, 200)}`,
    );
  }
  const structured = record['structured_output'];
  if (typeof structured === 'object' && structured !== null) {
    return structured;
  }
  if (typeof record['result'] === 'string') {
    return parseJsonObject(record['result']);
  }
  throw new EngineOutputError('claude returned no result');
}

export async function interpretWithClaude(
  report: Report,
  options: InterpretOptions,
  run: RunProcess = runProcess,
): Promise<Interpretation | null> {
  const evidence = selectEvidence(report, CLAUDE_BUDGET);
  if (evidence.episodes.length === 0 && evidence.insights.length === 0) {
    return null;
  }
  const timeout = AbortSignal.timeout(CLAUDE_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;

  let result: ProcessResult;
  try {
    result = await run(
      'claude',
      buildClaudeArgs(options.model),
      buildUserPrompt(evidence),
      signal,
    );
  } catch (error) {
    if (isErrnoCode(error, 'ENOENT')) {
      throw new EngineUnavailableError(
        'the claude CLI was not found on PATH. Install Claude Code, use --engine ollama, or pass --no-llm.',
      );
    }
    if (timeout.aborted) {
      throw new EngineOutputError(
        `claude did not answer within ${String(CLAUDE_TIMEOUT_MS / 1000)}s`,
      );
    }
    if (options.signal?.aborted) {
      throw new EngineOutputError('interpretation was cancelled');
    }
    throw error;
  }
  if (result.code !== 0) {
    describeFailure(result);
  }
  const answer = validateAnswer(extractPayload(result.stdout), evidence);
  return {
    engine: 'claude',
    model: options.model ?? null,
    generatedAt: new Date().toISOString(),
    ...answer,
  };
}
