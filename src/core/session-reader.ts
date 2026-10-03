/* eslint-disable no-param-reassign --
 * Streaming ingestion deliberately mutates per-session accumulators: copying
 * them per record would be quadratic on large logs. */

/**
 * Session reader.
 *
 * Streams Claude Code JSONL logs (~/.claude/projects/**\/*.jsonl, including
 * nested subagent sidechain files) into typed `Session` objects.
 *
 * The log format changes between Claude Code versions, so parsing is tolerant:
 * unknown record types are counted and skipped, malformed lines are counted
 * and skipped, and every field is read defensively.
 */

import { createReadStream } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';

import {
  type Compaction,
  DenialKind,
  type Interruption,
  type ModelUsage,
  type Prompt,
  PromptSource,
  type ReadSessionsOptions,
  type ReadSessionsResult,
  type ReadStats,
  type Session,
  type SlashCommandUse,
  type TokenUsage,
  type ToolCall,
  type ToolResult,
  type Turn,
  TurnKind,
} from '../types/index.js';
import { CLAUDE_PROJECTS_DIR, ENCODED_HOME } from '../utils/paths.js';

const MAX_PROMPT_CHARS = 6000;
const MAX_RESULT_EXCERPT = 400;
const MAX_ASSISTANT_EXCERPT = 600;
const MAX_COMMAND_CHARS = 600;
const COMPACTION_MERGE_MS = 120_000;

/** Record types we understand but deliberately do not analyze. */
const IGNORED_RECORD_TYPES: ReadonlySet<string> = new Set([
  'attachment',
  'mode',
  'last-prompt',
  'file-history-snapshot',
  'file-history-delta',
  'queue-operation',
  'cost-state',
  'atis-latch',
  'progress',
  'custom-title',
  'agent-name',
  'tag',
  'pr-link',
]);

const SUBAGENT_TOOL_NAMES: ReadonlySet<string> = new Set(['Task', 'Agent']);
const PLAN_MODE_TOOL_NAMES: ReadonlySet<string> = new Set([
  'ExitPlanMode',
  'EnterPlanMode',
]);

const EMPTY_TOKENS: TokenUsage = {
  input: 0,
  output: 0,
  cacheRead: 0,
  cacheCreation: 0,
};

// ---------------------------------------------------------------------------
// Defensive accessors
// ---------------------------------------------------------------------------

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) : text;
}

export function addTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: a.input + b.input,
    output: a.output + b.output,
    cacheRead: a.cacheRead + b.cacheRead,
    cacheCreation: a.cacheCreation + b.cacheCreation,
  };
}

function maxTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    input: Math.max(a.input, b.input),
    output: Math.max(a.output, b.output),
    cacheRead: Math.max(a.cacheRead, b.cacheRead),
    cacheCreation: Math.max(a.cacheCreation, b.cacheCreation),
  };
}

function parseUsage(value: unknown): TokenUsage {
  if (!isRecord(value)) {
    return EMPTY_TOKENS;
  }
  return {
    input: num(value['input_tokens']),
    output: num(value['output_tokens']),
    cacheRead: num(value['cache_read_input_tokens']),
    cacheCreation: num(value['cache_creation_input_tokens']),
  };
}

// ---------------------------------------------------------------------------
// Project naming
// ---------------------------------------------------------------------------

/**
 * Claude Code names project dirs after the cwd with "/" and "." replaced by
 * "-". The encoding is ambiguous, so we only strip the (known) home prefix and
 * the conventional "projects-" folder instead of trying to decode the path.
 */
export function deriveProjectName(
  dirName: string,
  cwd: string | null = null,
  encodedHome: string = ENCODED_HOME,
): string {
  if (dirName.startsWith(encodedHome)) {
    const rest = dirName.slice(encodedHome.length).replace(/^-/, '');
    if (rest === '') {
      return '~';
    }
    const withoutProjects = rest.replace(/^projects-/, '');
    return withoutProjects.startsWith('-')
      ? `.${withoutProjects.slice(1)}`
      : withoutProjects;
  }
  return cwd ? basename(cwd) : dirName;
}

// ---------------------------------------------------------------------------
// User record classification
// ---------------------------------------------------------------------------

export type ToolResultBlock = {
  readonly toolUseId: string;
  readonly isError: boolean;
  readonly text: string;
};

export type UserClassification =
  | {
      readonly kind: 'tool-results';
      readonly results: readonly ToolResultBlock[];
    }
  | { readonly kind: 'interruption'; readonly duringToolUse: boolean }
  | {
      readonly kind: 'command';
      readonly name: string;
      readonly args: string;
    }
  | { readonly kind: 'local-output' }
  | { readonly kind: 'bash-input' }
  | { readonly kind: 'compact-summary' }
  | { readonly kind: 'injected' }
  | {
      readonly kind: 'prompt';
      readonly text: string;
      readonly source: PromptSource;
      readonly permissionMode: string | null;
    };

const INJECTED_PREFIXES: readonly string[] = [
  '<local-command-caveat>',
  '<system-reminder>',
  '<task-notification>',
  '<user-prompt-submit-hook>',
  '<bash-stdout>',
  '<bash-stderr>',
  'Base directory for this skill',
  '[Image: source:',
  'Caveat: The messages below were generated by the user while running local commands',
];

function contentBlocks(content: unknown): readonly unknown[] {
  return Array.isArray(content) ? (content as unknown[]) : [];
}

function blockText(block: unknown): string {
  if (typeof block === 'string') {
    return block;
  }
  if (isRecord(block) && block['type'] === 'text') {
    return str(block['text']) ?? '';
  }
  return '';
}

function toolResultText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  return contentBlocks(content).map(blockText).filter(Boolean).join('\n');
}

export function extractUserText(content: unknown): string {
  if (typeof content === 'string') {
    return content;
  }
  return contentBlocks(content).map(blockText).filter(Boolean).join('\n');
}

/**
 * Decides what a `type: "user"` record really is. In Claude Code logs a user
 * record is often not a human: it can be a tool result, injected context, an
 * interruption marker, or a wrapped slash command.
 */
export function classifyUserRecord(record: JsonRecord): UserClassification {
  const message = isRecord(record['message']) ? record['message'] : {};
  const content = message['content'];

  const results = contentBlocks(content).flatMap((block): ToolResultBlock[] => {
    if (!isRecord(block) || block['type'] !== 'tool_result') {
      return [];
    }
    const toolUseId = str(block['tool_use_id']);
    return toolUseId
      ? [
          {
            toolUseId,
            isError: block['is_error'] === true,
            text: toolResultText(block['content']),
          },
        ]
      : [];
  });
  if (results.length > 0) {
    return { kind: 'tool-results', results };
  }

  if (record['isCompactSummary'] === true) {
    return { kind: 'compact-summary' };
  }

  const text = extractUserText(content).trim();
  if (text === '') {
    return { kind: 'injected' };
  }

  if (text.startsWith('[Request interrupted by user')) {
    return { kind: 'interruption', duringToolUse: text.includes('tool use') };
  }

  if (text.startsWith('<local-command-stdout>')) {
    return { kind: 'local-output' };
  }
  if (text.startsWith('<bash-input>')) {
    return { kind: 'bash-input' };
  }

  const commandMatch = /<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/.exec(
    text.slice(0, 600),
  );
  if (commandMatch?.[1]) {
    const argsMatch = /<command-args>([\s\S]*?)<\/command-args>/.exec(text);
    return {
      kind: 'command',
      name: commandMatch[1],
      args: (argsMatch?.[1] ?? '').trim(),
    };
  }

  if (record['isMeta'] === true) {
    return { kind: 'injected' };
  }
  if (INJECTED_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    return { kind: 'injected' };
  }

  const origin = record['origin'];
  if (isRecord(origin) && str(origin['kind']) && origin['kind'] !== 'human') {
    return { kind: 'injected' };
  }

  const promptSource = str(record['promptSource']);
  return {
    kind: 'prompt',
    text: truncate(text, MAX_PROMPT_CHARS),
    source:
      promptSource === 'suggestion_accepted'
        ? PromptSource.SUGGESTION
        : promptSource === 'typed'
          ? PromptSource.TYPED
          : PromptSource.UNKNOWN,
    permissionMode: str(record['permissionMode']),
  };
}

const USER_DENIAL =
  /doesn'?t want to (proceed|take this action)|tool use was rejected|user rejected tool use|rejected by the user/i;
const CLASSIFIER_DENIAL =
  /denied by the claude code auto mode classifier|auto mode classifier/i;
const RULE_DENIAL =
  /permission to use .{0,80} has been denied|denied by (a )?(permission )?rule/i;
const HOOK_DENIAL =
  /(PreToolUse|PostToolUse)[:\w]* hook error|blocked by .{0,40}hook/i;

export function classifyDenial(
  text: string,
  isError: boolean,
): DenialKind | null {
  if (!isError) {
    return null;
  }
  if (USER_DENIAL.test(text)) {
    return DenialKind.USER;
  }
  if (CLASSIFIER_DENIAL.test(text)) {
    return DenialKind.CLASSIFIER;
  }
  if (RULE_DENIAL.test(text)) {
    return DenialKind.RULE;
  }
  if (HOOK_DENIAL.test(text)) {
    return DenialKind.HOOK;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Events collected while streaming
// ---------------------------------------------------------------------------

type ToolUse = {
  readonly id: string;
  readonly name: string;
  readonly target: string | null;
  readonly command: string | null;
};

type AssistantEvent = {
  readonly kind: 'assistant';
  readonly seq: number;
  readonly ts: string;
  readonly msgId: string;
  readonly model: string | null;
  readonly usage: TokenUsage;
  readonly toolUses: readonly ToolUse[];
  readonly text: string | null;
  readonly sidechain: boolean;
  readonly isApiError: boolean;
};

type PromptEvent = {
  readonly kind: 'prompt';
  readonly seq: number;
  readonly ts: string;
  readonly uuid: string;
  readonly promptId: string | null;
  readonly prompt: Omit<Prompt, 'uuid' | 'timestamp'>;
};

type CommandEvent = {
  readonly kind: 'command';
  readonly seq: number;
  readonly ts: string;
  readonly uuid: string;
  readonly promptId: string | null;
  readonly name: string;
  readonly args: string;
  readonly permissionMode: string | null;
  /** Mutated when its local stdout arrives; local commands start no turn. */
  local: boolean;
};

type ResultEvent = {
  readonly kind: 'result';
  readonly seq: number;
  readonly ts: string;
  readonly toolUseId: string;
  readonly isError: boolean;
  readonly text: string;
};

type InterruptionEvent = {
  readonly kind: 'interruption';
  readonly seq: number;
  readonly ts: string;
  readonly duringToolUse: boolean;
};

type CompactionEvent = {
  readonly kind: 'compaction';
  readonly seq: number;
  readonly ts: string;
  readonly trigger: string | null;
  readonly preTokens: number | null;
};

type SessionEvent =
  | AssistantEvent
  | PromptEvent
  | CommandEvent
  | ResultEvent
  | InterruptionEvent
  | CompactionEvent;

type SessionAccumulator = {
  readonly id: string;
  projectDir: string;
  cwd: string | null;
  gitBranch: string | null;
  entrypoint: string | null;
  title: string | null;
  readonly versions: Set<string>;
  readonly permissionModesSeen: Set<string>;
  readonly agentIds: Set<string>;
  readonly sourceFiles: Set<string>;
  readonly events: SessionEvent[];
  readonly assistantById: Map<string, number>;
  lastCommand: CommandEvent | null;
};

type ReaderState = {
  readonly sessions: Map<string, SessionAccumulator>;
  readonly seenUuids: Set<string>;
  readonly messageOwner: Map<string, string>;
  readonly unknownTypes: Map<string, number>;
  readonly versions: Set<string>;
  seq: number;
  recordsRead: number;
  recordsSkipped: number;
  duplicateRecords: number;
};

function createAccumulator(id: string, projectDir: string): SessionAccumulator {
  return {
    id,
    projectDir,
    cwd: null,
    gitBranch: null,
    entrypoint: null,
    title: null,
    versions: new Set(),
    permissionModesSeen: new Set(),
    agentIds: new Set(),
    sourceFiles: new Set(),
    events: [],
    assistantById: new Map(),
    lastCommand: null,
  };
}

function summarizeToolInput(
  name: string,
  input: unknown,
): { target: string | null; command: string | null } {
  if (!isRecord(input)) {
    return { target: null, command: null };
  }
  const command =
    name === 'Bash'
      ? truncate(str(input['command']) ?? '', MAX_COMMAND_CHARS)
      : '';
  const target =
    str(input['file_path']) ??
    str(input['notebook_path']) ??
    str(input['path']) ??
    str(input['url']) ??
    str(input['subagent_type']) ??
    str(input['skill']) ??
    str(input['pattern']) ??
    null;
  return { target, command: command === '' ? null : command };
}

function parseAssistantContent(content: unknown): {
  toolUses: ToolUse[];
  text: string | null;
} {
  const toolUses: ToolUse[] = [];
  let text: string | null = null;
  for (const block of contentBlocks(content)) {
    if (!isRecord(block)) {
      continue;
    }
    if (block['type'] === 'tool_use') {
      const id = str(block['id']);
      const name = str(block['name']);
      if (id && name) {
        toolUses.push({
          id,
          name,
          ...summarizeToolInput(name, block['input']),
        });
      }
    } else if (block['type'] === 'text') {
      const value = str(block['text']);
      if (value && value.trim() !== '') {
        text = value;
      }
    }
  }
  return { toolUses, text };
}

type IngestContext = {
  readonly state: ReaderState;
  readonly projectDir: string;
  readonly filePath: string;
  readonly fallbackSessionId: string;
  readonly isSubagentFile: boolean;
  readonly from: number;
  readonly to: number;
};

function isWithinPeriod(ts: string | null, ctx: IngestContext): ts is string {
  if (!ts) {
    return false;
  }
  const time = Date.parse(ts);
  return !Number.isNaN(time) && time >= ctx.from && time <= ctx.to;
}

function getAccumulator(
  ctx: IngestContext,
  record: JsonRecord,
): SessionAccumulator {
  const id =
    str(record['sessionId']) ??
    str(record['session_id']) ??
    ctx.fallbackSessionId;
  const existing = ctx.state.sessions.get(id);
  if (existing) {
    return existing;
  }
  const created = createAccumulator(id, ctx.projectDir);
  ctx.state.sessions.set(id, created);
  return created;
}

function absorbMetadata(acc: SessionAccumulator, record: JsonRecord): void {
  acc.cwd ??= str(record['cwd']);
  acc.entrypoint ??= str(record['entrypoint']);
  const branch = str(record['gitBranch']);
  if (branch && branch !== 'HEAD') {
    acc.gitBranch ??= branch;
  }
  const version = str(record['version']);
  if (version) {
    acc.versions.add(version);
  }
  const agentId = str(record['agentId']);
  if (agentId && record['isSidechain'] === true) {
    acc.agentIds.add(agentId);
  }
}

function ingestAssistant(
  acc: SessionAccumulator,
  record: JsonRecord,
  ctx: IngestContext,
  ts: string,
): void {
  const message = isRecord(record['message']) ? record['message'] : {};
  const msgId = str(message['id']) ?? str(record['uuid']);
  if (!msgId) {
    return;
  }
  const owner = ctx.state.messageOwner.get(msgId);
  if (owner !== undefined && owner !== acc.id) {
    ctx.state.duplicateRecords++;
    return;
  }
  ctx.state.messageOwner.set(msgId, acc.id);

  const usage = parseUsage(message['usage']);
  const { toolUses, text } = parseAssistantContent(message['content']);
  const model = str(message['model']);
  const existingIndex = acc.assistantById.get(msgId);

  // The same assistant message is written once per content block, each time
  // repeating `usage`. Merge instead of summing.
  if (existingIndex !== undefined) {
    ctx.state.duplicateRecords++;
    const previous = acc.events[existingIndex] as AssistantEvent;
    const knownIds = new Set(previous.toolUses.map((use) => use.id));
    acc.events[existingIndex] = {
      ...previous,
      usage: maxTokens(previous.usage, usage),
      toolUses: [
        ...previous.toolUses,
        ...toolUses.filter((use) => !knownIds.has(use.id)),
      ],
      text: text ?? previous.text,
      model: previous.model ?? model,
    };
    return;
  }

  acc.assistantById.set(msgId, acc.events.length);
  acc.events.push({
    kind: 'assistant',
    seq: ctx.state.seq++,
    ts,
    msgId,
    model,
    usage,
    toolUses,
    text,
    sidechain: record['isSidechain'] === true || ctx.isSubagentFile,
    isApiError: record['isApiErrorMessage'] === true || model === '<synthetic>',
  });
}

function ingestUser(
  acc: SessionAccumulator,
  record: JsonRecord,
  ctx: IngestContext,
  ts: string,
): void {
  const uuid = str(record['uuid']);
  if (uuid) {
    if (ctx.state.seenUuids.has(uuid)) {
      ctx.state.duplicateRecords++;
      return;
    }
    ctx.state.seenUuids.add(uuid);
  }

  const classified = classifyUserRecord(record);
  const sidechain = record['isSidechain'] === true || ctx.isSubagentFile;
  const seq = ctx.state.seq++;
  const promptId = str(record['promptId']);

  switch (classified.kind) {
    case 'tool-results':
      for (const result of classified.results) {
        acc.events.push({
          kind: 'result',
          seq,
          ts,
          toolUseId: result.toolUseId,
          isError: result.isError,
          text: truncate(result.text, MAX_RESULT_EXCERPT),
        });
      }
      return;
    case 'local-output':
      if (acc.lastCommand) {
        acc.lastCommand.local = true;
      }
      return;
    case 'compact-summary':
      acc.events.push({
        kind: 'compaction',
        seq,
        ts,
        trigger: null,
        preTokens: null,
      });
      return;
    case 'bash-input':
    case 'injected':
      return;
    case 'interruption':
      if (!sidechain) {
        acc.events.push({
          kind: 'interruption',
          seq,
          ts,
          duringToolUse: classified.duringToolUse,
        });
      }
      return;
    case 'command': {
      if (sidechain) {
        return;
      }
      const event: CommandEvent = {
        kind: 'command',
        seq,
        ts,
        uuid: uuid ?? `${acc.id}:${String(seq)}`,
        promptId,
        name: classified.name,
        args: truncate(classified.args, MAX_PROMPT_CHARS),
        permissionMode: str(record['permissionMode']),
        local: false,
      };
      acc.lastCommand = event;
      acc.events.push(event);
      return;
    }
    case 'prompt':
      // A sidechain's first user record is the parent's delegation prompt,
      // not something the human typed.
      if (sidechain) {
        return;
      }
      acc.events.push({
        kind: 'prompt',
        seq,
        ts,
        uuid: uuid ?? `${acc.id}:${String(seq)}`,
        promptId,
        prompt: {
          text: classified.text,
          source: classified.source,
          permissionMode: classified.permissionMode,
        },
      });
      return;
  }
}

function ingestRecord(
  record: JsonRecord,
  type: string,
  ctx: IngestContext,
): void {
  const acc = getAccumulator(ctx, record);
  acc.sourceFiles.add(ctx.filePath);
  absorbMetadata(acc, record);
  if (ctx.state.sessions.get(acc.id) === acc) {
    const version = str(record['version']);
    if (version) {
      ctx.state.versions.add(version);
    }
  }

  switch (type) {
    case 'ai-title':
      acc.title = str(record['aiTitle']) ?? acc.title;
      return;
    case 'summary':
      acc.title ??= str(record['summary']);
      return;
    case 'permission-mode': {
      const mode = str(record['permissionMode']);
      if (mode) {
        acc.permissionModesSeen.add(mode);
      }
      return;
    }
    default:
      break;
  }

  const ts = str(record['timestamp']);
  if (!isWithinPeriod(ts, ctx)) {
    return;
  }

  if (type === 'assistant') {
    ingestAssistant(acc, record, ctx, ts);
  } else if (type === 'user') {
    ingestUser(acc, record, ctx, ts);
  } else if (type === 'system' && record['subtype'] === 'compact_boundary') {
    const metadata = isRecord(record['compactMetadata'])
      ? record['compactMetadata']
      : {};
    acc.events.push({
      kind: 'compaction',
      seq: ctx.state.seq++,
      ts,
      trigger: str(metadata['trigger']),
      preTokens: num(metadata['preTokens']) || null,
    });
  }
}

async function readFileInto(ctx: IngestContext): Promise<void> {
  const lines = createInterface({
    input: createReadStream(ctx.filePath, { encoding: 'utf-8' }),
    crlfDelay: Infinity,
  });
  for await (const line of lines) {
    if (line.trim() === '') {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      ctx.state.recordsSkipped++;
      continue;
    }
    if (!isRecord(parsed)) {
      ctx.state.recordsSkipped++;
      continue;
    }
    ctx.state.recordsRead++;
    const type = str(parsed['type']);
    if (!type) {
      ctx.state.recordsSkipped++;
      continue;
    }
    const isKnown =
      IGNORED_RECORD_TYPES.has(type) ||
      [
        'user',
        'assistant',
        'system',
        'summary',
        'ai-title',
        'permission-mode',
      ].includes(type);
    if (!isKnown) {
      ctx.state.unknownTypes.set(
        type,
        (ctx.state.unknownTypes.get(type) ?? 0) + 1,
      );
      continue;
    }
    if (IGNORED_RECORD_TYPES.has(type)) {
      continue;
    }
    ingestRecord(parsed, type, ctx);
  }
}

// ---------------------------------------------------------------------------
// Folding events into turns
// ---------------------------------------------------------------------------

type TurnDraft = {
  index: number;
  kind: TurnKind;
  command: string | null;
  prompt: Prompt;
  promptId: string | null;
  startedAt: string;
  endedAt: string;
  tokens: TokenUsage;
  assistantMessages: number;
  toolCalls: ToolCall[];
  interruptions: Interruption[];
  models: Set<string>;
  assistantExcerpt: string | null;
};

function finalizeTurn(draft: TurnDraft): Turn {
  return {
    index: draft.index,
    kind: draft.kind,
    command: draft.command,
    prompt: draft.prompt,
    startedAt: draft.startedAt,
    endedAt: draft.endedAt,
    tokens: draft.tokens,
    assistantMessages: draft.assistantMessages,
    toolCalls: draft.toolCalls,
    interruptions: draft.interruptions,
    models: [...draft.models],
    assistantExcerpt: draft.assistantExcerpt,
  };
}

function laterOf(a: string, b: string): string {
  return Date.parse(b) > Date.parse(a) ? b : a;
}

function mergeCompactions(events: readonly CompactionEvent[]): Compaction[] {
  return events.reduce<Compaction[]>((merged, event) => {
    const last = merged.at(-1);
    if (
      last &&
      Math.abs(Date.parse(event.ts) - Date.parse(last.timestamp)) <=
        COMPACTION_MERGE_MS
    ) {
      merged[merged.length - 1] = {
        timestamp: last.timestamp,
        trigger: last.trigger ?? event.trigger,
        preTokens: last.preTokens ?? event.preTokens,
      };
      return merged;
    }
    return [
      ...merged,
      {
        timestamp: event.ts,
        trigger: event.trigger,
        preTokens: event.preTokens,
      },
    ];
  }, []);
}

type FoldResult = {
  readonly session: Session | null;
  readonly orphanResults: number;
};

function foldSession(acc: SessionAccumulator): FoldResult {
  const events = [...acc.events].sort(
    (a, b) => Date.parse(a.ts) - Date.parse(b.ts) || a.seq - b.seq,
  );
  if (events.length === 0) {
    return { session: null, orphanResults: 0 };
  }

  const resultsById = new Map<string, ToolResult>();
  for (const event of events) {
    if (event.kind === 'result') {
      resultsById.set(event.toolUseId, {
        timestamp: event.ts,
        isError: event.isError,
        denial: classifyDenial(event.text, event.isError),
        excerpt: event.text,
      });
    }
  }

  const turns: TurnDraft[] = [];
  const allCalls: ToolCall[] = [];
  const seenCallIds = new Set<string>();
  const compactionEvents: CompactionEvent[] = [];
  const slashCommands: SlashCommandUse[] = [];
  const models = new Map<string, ModelUsage>();
  const permissionModes = new Map<string, number>();
  const cursor: { turn: TurnDraft | null } = { turn: null };
  let sessionTokens = EMPTY_TOKENS;
  let subagentTokens = EMPTY_TOKENS;
  let assistantMessages = 0;
  let apiErrors = 0;
  let subagentToolCalls = 0;
  let subagentInvocations = 0;
  let interruptionsOutsideTurns = 0;
  let planModeUsed = acc.permissionModesSeen.has('plan');

  const startTurn = (
    kind: TurnKind,
    command: string | null,
    promptId: string | null,
    prompt: Prompt,
  ): void => {
    const draft: TurnDraft = {
      index: turns.length,
      kind,
      command,
      prompt,
      promptId,
      startedAt: prompt.timestamp,
      endedAt: prompt.timestamp,
      tokens: EMPTY_TOKENS,
      assistantMessages: 0,
      toolCalls: [],
      interruptions: [],
      models: new Set(),
      assistantExcerpt: null,
    };
    turns.push(draft);
    cursor.turn = draft;
    if (prompt.permissionMode) {
      permissionModes.set(
        prompt.permissionMode,
        (permissionModes.get(prompt.permissionMode) ?? 0) + 1,
      );
      if (prompt.permissionMode === 'plan') {
        planModeUsed = true;
      }
    }
  };

  for (const event of events) {
    if (cursor.turn) {
      cursor.turn.endedAt = laterOf(cursor.turn.endedAt, event.ts);
    }
    switch (event.kind) {
      case 'prompt': {
        const draft = cursor.turn;
        if (draft && event.promptId && draft.promptId === event.promptId) {
          break;
        }
        startTurn(TurnKind.TYPED, null, event.promptId, {
          uuid: event.uuid,
          timestamp: event.ts,
          ...event.prompt,
        });
        break;
      }
      case 'command': {
        slashCommands.push({ name: event.name, timestamp: event.ts });
        if (event.local) {
          break;
        }
        const draft = cursor.turn;
        if (draft && event.promptId && draft.promptId === event.promptId) {
          break;
        }
        startTurn(TurnKind.COMMAND, event.name, event.promptId, {
          uuid: event.uuid,
          timestamp: event.ts,
          text: truncate(
            `/${event.name} ${event.args}`.trim(),
            MAX_PROMPT_CHARS,
          ),
          source: PromptSource.UNKNOWN,
          permissionMode: event.permissionMode,
        });
        break;
      }
      case 'interruption': {
        const draft = cursor.turn;
        if (draft) {
          draft.interruptions.push({
            timestamp: event.ts,
            duringToolUse: event.duringToolUse,
          });
        } else {
          interruptionsOutsideTurns++;
        }
        break;
      }
      case 'compaction':
        compactionEvents.push(event);
        break;
      case 'result':
        break;
      case 'assistant': {
        if (event.isApiError) {
          apiErrors++;
          break;
        }
        assistantMessages++;
        sessionTokens = addTokens(sessionTokens, event.usage);
        if (event.sidechain) {
          subagentTokens = addTokens(subagentTokens, event.usage);
        }
        const modelName = event.model ?? 'unknown';
        const previousModel = models.get(modelName);
        models.set(modelName, {
          messages: (previousModel?.messages ?? 0) + 1,
          tokens: addTokens(previousModel?.tokens ?? EMPTY_TOKENS, event.usage),
        });

        const calls = event.toolUses
          .filter((use) => !seenCallIds.has(use.id))
          .map(
            (use): ToolCall => ({
              id: use.id,
              name: use.name,
              timestamp: event.ts,
              sidechain: event.sidechain,
              target: use.target,
              command: use.command,
              result: resultsById.get(use.id) ?? null,
            }),
          );
        for (const call of calls) {
          seenCallIds.add(call.id);
          allCalls.push(call);
          if (call.sidechain) {
            subagentToolCalls++;
          } else if (SUBAGENT_TOOL_NAMES.has(call.name)) {
            subagentInvocations++;
          }
          if (PLAN_MODE_TOOL_NAMES.has(call.name)) {
            planModeUsed = true;
          }
        }

        const draft = cursor.turn;
        if (draft) {
          draft.tokens = addTokens(draft.tokens, event.usage);
          draft.assistantMessages++;
          draft.toolCalls.push(...calls);
          if (event.model) {
            draft.models.add(event.model);
          }
          if (!event.sidechain && event.text) {
            draft.assistantExcerpt = truncate(
              event.text,
              MAX_ASSISTANT_EXCERPT,
            );
          }
        }
        break;
      }
    }
  }

  let orphanResults = 0;
  for (const id of resultsById.keys()) {
    if (!seenCallIds.has(id)) {
      orphanResults++;
    }
  }

  const first = events[0];
  const last = events.at(-1);
  if (!first || !last) {
    return { session: null, orphanResults };
  }

  const session: Session = {
    id: acc.id,
    project: deriveProjectName(acc.projectDir, acc.cwd),
    projectDir: acc.projectDir,
    cwd: acc.cwd,
    gitBranch: acc.gitBranch,
    entrypoint: acc.entrypoint,
    versions: [...acc.versions],
    title: acc.title,
    startedAt: first.ts,
    endedAt: last.ts,
    turns: turns.map(finalizeTurn),
    toolCalls: allCalls,
    tokens: sessionTokens,
    models: Object.fromEntries(models),
    assistantMessages,
    apiErrors,
    subagents: {
      agentIds: [...acc.agentIds],
      invocations: subagentInvocations,
      tokens: subagentTokens,
      toolCalls: subagentToolCalls,
    },
    permissionModes: Object.fromEntries(permissionModes),
    permissionModesSeen: [...acc.permissionModesSeen],
    planModeUsed,
    slashCommands,
    compactions: mergeCompactions(compactionEvents),
    interruptionsOutsideTurns,
    sourceFiles: [...acc.sourceFiles],
  };
  return { session, orphanResults };
}

// ---------------------------------------------------------------------------
// File discovery and public entry point
// ---------------------------------------------------------------------------

async function listJsonlFiles(dir: string): Promise<readonly string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const nested = await Promise.all(
    entries.map(async (entry): Promise<readonly string[]> => {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        return listJsonlFiles(fullPath);
      }
      return entry.isFile() && entry.name.endsWith('.jsonl') ? [fullPath] : [];
    }),
  );
  return nested.flat();
}

export async function claudeProjectsExist(
  projectsDir: string = CLAUDE_PROJECTS_DIR,
): Promise<boolean> {
  const info = await stat(projectsDir).catch(() => null);
  return info?.isDirectory() ?? false;
}

export async function readSessions(
  options: ReadSessionsOptions = {},
): Promise<ReadSessionsResult> {
  const projectsDir = options.projectsDir ?? CLAUDE_PROJECTS_DIR;
  const from = options.from?.getTime() ?? Number.NEGATIVE_INFINITY;
  const to = options.to?.getTime() ?? Number.POSITIVE_INFINITY;
  const projectFilter = options.project?.toLowerCase();

  const state: ReaderState = {
    sessions: new Map(),
    seenUuids: new Set(),
    messageOwner: new Map(),
    unknownTypes: new Map(),
    versions: new Set(),
    seq: 0,
    recordsRead: 0,
    recordsSkipped: 0,
    duplicateRecords: 0,
  };

  const projectEntries = await readdir(projectsDir, {
    withFileTypes: true,
  }).catch(() => []);
  const projectDirs = projectEntries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .filter((dirName) => {
      if (!projectFilter) {
        return true;
      }
      return (
        dirName.toLowerCase().includes(projectFilter) ||
        deriveProjectName(dirName).toLowerCase().includes(projectFilter)
      );
    });

  let filesRead = 0;
  let subagentFilesRead = 0;

  for (const projectDir of projectDirs) {
    const files = [
      ...(await listJsonlFiles(join(projectsDir, projectDir))),
    ].sort();
    for (const filePath of files) {
      const info = await stat(filePath).catch(() => null);
      if (!info || info.mtimeMs < from) {
        continue;
      }
      const isSubagentFile = filePath
        .slice(join(projectsDir, projectDir).length)
        .split(/[\\/]/)
        .includes('subagents');
      await readFileInto({
        state,
        projectDir,
        filePath,
        fallbackSessionId: isSubagentFile
          ? (filePath.split(/[\\/]/).at(-3) ?? basename(filePath, '.jsonl'))
          : basename(filePath, '.jsonl'),
        isSubagentFile,
        from,
        to,
      });
      filesRead++;
      if (isSubagentFile) {
        subagentFilesRead++;
      }
      options.onProgress?.(filesRead);
    }
  }

  const folded = [...state.sessions.values()].map(foldSession);
  const sessions = folded
    .flatMap((result) => (result.session ? [result.session] : []))
    .sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));

  const stats: ReadStats = {
    filesRead,
    subagentFilesRead,
    recordsRead: state.recordsRead,
    recordsSkipped: state.recordsSkipped,
    unknownRecordTypes: Object.fromEntries(state.unknownTypes),
    duplicateRecords: state.duplicateRecords,
    orphanToolResults: folded.reduce(
      (sum, result) => sum + result.orphanResults,
      0,
    ),
    claudeCodeVersions: [...state.versions].sort(),
  };
  return { sessions, stats };
}
