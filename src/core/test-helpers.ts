/**
 * Builders for synthetic Claude Code JSONL records and Session objects.
 * Test-only: never imported by production code.
 */

import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

import {
  type Interruption,
  type Prompt,
  PromptSource,
  type Session,
  type TokenUsage,
  type ToolCall,
  type ToolResult,
  type Turn,
  TurnKind,
} from '../types/index.js';

export const SESSION_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

type Json = Record<string, unknown>;

let counter = 0;
const nextId = (prefix: string): string => `${prefix}-${String(++counter)}`;

/** ISO timestamp at local noon + offset minutes, stable across time zones. */
export function at(day: number, minutes = 0): string {
  return new Date(2026, 8, day, 12, minutes, 0).toISOString();
}

export function userRecord(
  content: unknown,
  ts: string,
  extra: Json = {},
): Json {
  return {
    type: 'user',
    uuid: nextId('u'),
    sessionId: SESSION_ID,
    timestamp: ts,
    cwd: '/work/app',
    version: '2.1.278',
    gitBranch: 'main',
    isSidechain: false,
    message: { role: 'user', content },
    ...extra,
  };
}

export function typedPrompt(text: string, ts: string, extra: Json = {}): Json {
  return userRecord(text, ts, {
    promptId: nextId('p'),
    origin: { kind: 'human' },
    promptSource: 'typed',
    permissionMode: 'default',
    ...extra,
  });
}

export function toolResultRecord(
  toolUseId: string,
  text: string,
  ts: string,
  isError = false,
  extra: Json = {},
): Json {
  return userRecord(
    [
      {
        type: 'tool_result',
        tool_use_id: toolUseId,
        content: text,
        is_error: isError,
      },
    ],
    ts,
    extra,
  );
}

export function assistantRecord(opts: {
  readonly msgId: string;
  readonly ts: string;
  readonly content: readonly Json[];
  readonly usage?: Partial<Record<string, number>>;
  readonly model?: string;
  readonly extra?: Json;
}): Json {
  return {
    type: 'assistant',
    uuid: nextId('a'),
    sessionId: SESSION_ID,
    timestamp: opts.ts,
    cwd: '/work/app',
    isSidechain: false,
    message: {
      id: opts.msgId,
      role: 'assistant',
      model: opts.model ?? 'claude-test-1',
      content: opts.content,
      usage: {
        input_tokens: 10,
        output_tokens: 20,
        cache_read_input_tokens: 100,
        cache_creation_input_tokens: 5,
        ...opts.usage,
      },
    },
    ...opts.extra,
  };
}

export const textBlock = (text: string): Json => ({ type: 'text', text });

export const toolUseBlock = (id: string, name: string, input: Json): Json => ({
  type: 'tool_use',
  id,
  name,
  input,
});

export async function writeJsonl(
  projectsDir: string,
  projectDir: string,
  relativeFile: string,
  records: readonly (Json | string)[],
): Promise<string> {
  const filePath = join(projectsDir, projectDir, relativeFile);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(
    filePath,
    `${records.map((r) => (typeof r === 'string' ? r : JSON.stringify(r))).join('\n')}\n`,
  );
  return filePath;
}

export function makeTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'hyntx-test-'));
}

// ---------------------------------------------------------------------------
// Session object builders
// ---------------------------------------------------------------------------

export const NO_TOKENS: TokenUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheCreation: 0,
};

export function makeCall(
  name: string,
  opts: {
    readonly id?: string;
    readonly ts?: string;
    readonly command?: string;
    readonly target?: string;
    readonly error?: boolean;
    readonly denial?: ToolResult['denial'];
    readonly text?: string;
    readonly sidechain?: boolean;
    readonly unanswered?: boolean;
  } = {},
): ToolCall {
  const ts = opts.ts ?? at(1);
  return {
    id: opts.id ?? nextId('toolu'),
    name,
    timestamp: ts,
    sidechain: opts.sidechain ?? false,
    target: opts.target ?? null,
    command: opts.command ?? null,
    result: opts.unanswered
      ? null
      : {
          timestamp: ts,
          isError: opts.error === true || opts.denial != null,
          denial: opts.denial ?? null,
          excerpt: opts.text ?? '',
        },
  };
}

export function makeTurn(
  index: number,
  text: string,
  opts: {
    readonly ts?: string;
    readonly source?: PromptSource;
    readonly kind?: TurnKind;
    readonly calls?: readonly ToolCall[];
    readonly interruptions?: readonly Interruption[];
    readonly permissionMode?: string | null;
    readonly assistantMessages?: number;
    readonly assistantExcerpt?: string | null;
    readonly tokens?: Partial<TokenUsage>;
    readonly models?: readonly string[];
  } = {},
): Turn {
  const ts = opts.ts ?? at(1, index * 5);
  const prompt: Prompt = {
    uuid: nextId('prompt'),
    timestamp: ts,
    text,
    source: opts.source ?? PromptSource.TYPED,
    permissionMode:
      opts.permissionMode === undefined ? 'default' : opts.permissionMode,
  };
  return {
    index,
    kind: opts.kind ?? TurnKind.TYPED,
    command: null,
    prompt,
    startedAt: ts,
    endedAt: ts,
    tokens: { ...NO_TOKENS, ...opts.tokens },
    assistantMessages: opts.assistantMessages ?? 1,
    toolCalls: opts.calls ?? [],
    interruptions: opts.interruptions ?? [],
    models: opts.models ?? ['claude-test-1'],
    assistantExcerpt: opts.assistantExcerpt ?? null,
  };
}

export function makeSession(
  turns: readonly Turn[],
  opts: Partial<Session> = {},
): Session {
  const calls = turns.flatMap((t) => t.toolCalls);
  const tokens = turns.reduce<TokenUsage>(
    (acc, t) => ({
      input: acc.input + t.tokens.input,
      output: acc.output + t.tokens.output,
      cacheRead: acc.cacheRead + t.tokens.cacheRead,
      cacheCreation: acc.cacheCreation + t.tokens.cacheCreation,
    }),
    NO_TOKENS,
  );
  const first = turns[0]?.startedAt ?? at(1);
  const last = turns.at(-1)?.endedAt ?? first;
  return {
    id: nextId('session'),
    project: 'app',
    projectDir: '-work-app',
    cwd: '/work/app',
    gitBranch: 'main',
    entrypoint: 'cli',
    versions: ['2.1.278'],
    title: null,
    startedAt: first,
    endedAt: last,
    turns,
    toolCalls: calls,
    tokens,
    models: {
      'claude-test-1': { messages: turns.length, tokens },
    },
    assistantMessages: turns.reduce((n, t) => n + t.assistantMessages, 0),
    apiErrors: 0,
    subagents: {
      agentIds: [],
      invocations: 0,
      tokens: NO_TOKENS,
      toolCalls: 0,
    },
    permissionModes: {},
    permissionModesSeen: [],
    planModeUsed: false,
    slashCommands: [],
    compactions: [],
    interruptionsOutsideTurns: 0,
    sourceFiles: [],
    ...opts,
  };
}
