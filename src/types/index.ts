/**
 * Shared types for Hyntx v4.
 *
 * Two layers live here:
 * 1. The raw session model (`Session`, `Turn`, `ToolCall`...) produced by the
 *    session reader. It is in-memory only and may hold unsanitized text.
 * 2. The serializable `Report` contract. Every string in a `Report` has been
 *    sanitized; HTML report, plugin and LLM engines build on this layer.
 */

// ---------------------------------------------------------------------------
// Raw session model (in-memory, never serialized)
// ---------------------------------------------------------------------------

export type TokenUsage = {
  readonly input: number;
  readonly output: number;
  readonly cacheRead: number;
  readonly cacheCreation: number;
};

export const DenialKind = {
  /** The human rejected the tool call in the permission dialog. */
  USER: 'user',
  /** A settings permission rule denied the call. */
  RULE: 'rule',
  /** The auto-mode classifier blocked the call. */
  CLASSIFIER: 'classifier',
  /** A PreToolUse hook blocked the call. */
  HOOK: 'hook',
} as const;
export type DenialKind = (typeof DenialKind)[keyof typeof DenialKind];

export type ToolResult = {
  readonly timestamp: string;
  readonly isError: boolean;
  readonly denial: DenialKind | null;
  /** First characters of the result text; raw (unsanitized). */
  readonly excerpt: string;
};

export type ToolCall = {
  readonly id: string;
  readonly name: string;
  readonly timestamp: string;
  readonly sidechain: boolean;
  /** File path, URL, pattern or subagent type, depending on the tool. */
  readonly target: string | null;
  /** Bash command line (raw). */
  readonly command: string | null;
  readonly result: ToolResult | null;
};

export const PromptSource = {
  TYPED: 'typed',
  SUGGESTION: 'suggestion',
  UNKNOWN: 'unknown',
} as const;
export type PromptSource = (typeof PromptSource)[keyof typeof PromptSource];

export type Prompt = {
  readonly uuid: string;
  readonly timestamp: string;
  /** Raw text (unsanitized, truncated). */
  readonly text: string;
  readonly source: PromptSource;
  readonly permissionMode: string | null;
};

export type Interruption = {
  readonly timestamp: string;
  readonly duringToolUse: boolean;
};

export const TurnKind = {
  /** Started by a human-typed prompt. */
  TYPED: 'typed',
  /** Started by a prompt-expanding slash command (skill/custom command). */
  COMMAND: 'command',
} as const;
export type TurnKind = (typeof TurnKind)[keyof typeof TurnKind];

export type Turn = {
  readonly index: number;
  readonly kind: TurnKind;
  readonly command: string | null;
  readonly prompt: Prompt;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly tokens: TokenUsage;
  readonly assistantMessages: number;
  readonly toolCalls: readonly ToolCall[];
  readonly interruptions: readonly Interruption[];
  readonly models: readonly string[];
  /** Last assistant text of the turn (raw, truncated). */
  readonly assistantExcerpt: string | null;
};

export type Compaction = {
  readonly timestamp: string;
  readonly trigger: string | null;
  readonly preTokens: number | null;
};

export type ModelUsage = {
  readonly messages: number;
  readonly tokens: TokenUsage;
};

export type SlashCommandUse = {
  readonly name: string;
  readonly timestamp: string;
};

export type SubagentActivity = {
  readonly agentIds: readonly string[];
  /** Task/Agent tool calls issued by the main thread. */
  readonly invocations: number;
  readonly tokens: TokenUsage;
  readonly toolCalls: number;
};

export type Session = {
  readonly id: string;
  readonly project: string;
  readonly projectDir: string;
  readonly cwd: string | null;
  readonly gitBranch: string | null;
  readonly entrypoint: string | null;
  readonly versions: readonly string[];
  readonly title: string | null;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly turns: readonly Turn[];
  readonly toolCalls: readonly ToolCall[];
  readonly tokens: TokenUsage;
  readonly models: Readonly<Record<string, ModelUsage>>;
  readonly assistantMessages: number;
  readonly apiErrors: number;
  readonly subagents: SubagentActivity;
  /** Typed prompts per permission mode. */
  readonly permissionModes: Readonly<Record<string, number>>;
  readonly permissionModesSeen: readonly string[];
  readonly planModeUsed: boolean;
  readonly slashCommands: readonly SlashCommandUse[];
  readonly compactions: readonly Compaction[];
  readonly interruptionsOutsideTurns: number;
  readonly sourceFiles: readonly string[];
};

export type ReadStats = {
  readonly filesRead: number;
  readonly subagentFilesRead: number;
  readonly recordsRead: number;
  /** Lines that were not valid JSON objects. */
  readonly recordsSkipped: number;
  readonly unknownRecordTypes: Readonly<Record<string, number>>;
  /** Assistant/user records already seen (resumed or streamed copies). */
  readonly duplicateRecords: number;
  readonly orphanToolResults: number;
  readonly claudeCodeVersions: readonly string[];
};

export type ReadSessionsOptions = {
  readonly projectsDir?: string;
  readonly from?: Date;
  readonly to?: Date;
  /** Case-insensitive substring of the project name or directory. */
  readonly project?: string;
  readonly onProgress?: (filesRead: number) => void;
};

export type ReadSessionsResult = {
  readonly sessions: readonly Session[];
  readonly stats: ReadStats;
};

// ---------------------------------------------------------------------------
// Metrics (serializable)
// ---------------------------------------------------------------------------

export type TokenTotals = TokenUsage & {
  /** input + output + cacheRead + cacheCreation */
  readonly total: number;
  /** cacheRead / (input + cacheRead + cacheCreation); null without input. */
  readonly cacheHitRatio: number | null;
};

export type ToolStat = {
  readonly name: string;
  readonly calls: number;
  /** Failed calls, excluding denials. */
  readonly errors: number;
  readonly denied: number;
  readonly errorRate: number;
};

export type ModelMix = {
  readonly model: string;
  readonly messages: number;
  readonly tokens: number;
  readonly share: number;
};

export type Distribution = {
  readonly median: number;
  readonly p90: number;
  readonly max: number;
  readonly buckets: readonly {
    readonly label: string;
    readonly count: number;
  }[];
};

export type AggregateMetrics = {
  readonly sessions: number;
  readonly turns: number;
  readonly typedPrompts: number;
  readonly acceptedSuggestions: number;
  readonly assistantMessages: number;
  readonly toolCalls: number;
  readonly toolErrors: number;
  readonly toolDenied: number;
  readonly toolErrorRate: number;
  readonly tools: readonly ToolStat[];
  readonly tokens: TokenTotals;
  readonly models: readonly ModelMix[];
  readonly subagents: {
    readonly invocations: number;
    readonly sessionsUsing: number;
    readonly tokens: number;
    readonly toolCalls: number;
  };
  readonly permissionModes: Readonly<Record<string, number>>;
  readonly planMode: {
    readonly sessionsUsing: number;
    readonly typedPrompts: number;
  };
  readonly slashCommands: readonly {
    readonly name: string;
    readonly count: number;
  }[];
  readonly interruptions: number;
  readonly compactions: number;
  readonly apiErrors: number;
  /** Distribution of active minutes per session (idle gaps > 10m excluded). */
  readonly sessionMinutes: Distribution;
  readonly sessionTurns: Distribution;
};

export type SessionMetrics = {
  readonly sessionId: string;
  readonly project: string;
  readonly title: string | null;
  readonly startedAt: string;
  readonly endedAt: string;
  /** Wall-clock span. */
  readonly durationMinutes: number;
  /** Span excluding idle gaps longer than 10 minutes. */
  readonly activeMinutes: number;
  readonly turns: number;
  readonly typedPrompts: number;
  readonly toolCalls: number;
  readonly toolErrors: number;
  readonly toolDenied: number;
  readonly tokens: TokenTotals;
  readonly primaryModel: string | null;
  readonly subagentInvocations: number;
  readonly interruptions: number;
  readonly compactions: number;
  readonly planModeUsed: boolean;
};

export type Metrics = {
  readonly overall: AggregateMetrics;
  readonly byProject: readonly (AggregateMetrics & {
    readonly project: string;
  })[];
  readonly byDay: readonly (AggregateMetrics & { readonly date: string })[];
  readonly sessions: readonly SessionMetrics[];
  readonly activity: {
    /** Typed prompts per local hour, index 0-23. */
    readonly byHour: readonly number[];
    /** Typed prompts per weekday, index 0 = Sunday. */
    readonly byWeekday: readonly number[];
  };
};

/** Compact per-day record; persisted under ~/.hyntx so trends outlive logs. */
export type DailyPoint = {
  readonly date: string;
  readonly sessions: number;
  readonly turns: number;
  readonly typedPrompts: number;
  readonly toolCalls: number;
  readonly toolErrors: number;
  readonly toolDenied: number;
  readonly interruptions: number;
  readonly corrections: number;
  readonly compactions: number;
  readonly subagentInvocations: number;
  readonly activeMinutes: number;
  readonly tokens: TokenUsage;
};

// ---------------------------------------------------------------------------
// Friction episodes (serializable, sanitized)
// ---------------------------------------------------------------------------

export const EpisodeType = {
  INTERRUPTION: 'interruption',
  CORRECTION: 'correction',
  TOOL_ERROR_LOOP: 'tool-error-loop',
  TOOL_DENIED: 'tool-denied',
  REWORK: 'rework',
  CONTEXT_PRESSURE: 'context-pressure',
  REPEATED_INSTRUCTION: 'repeated-instruction',
  READONLY_COMMAND: 'frequent-readonly-command',
  MODEL_SWITCH: 'model-switch',
} as const;
export type EpisodeType = (typeof EpisodeType)[keyof typeof EpisodeType];

export type EpisodeRef = {
  readonly sessionId: string;
  readonly project: string;
  readonly timestamp: string;
  readonly prompt: string;
};

export type EpisodeContext = {
  /** Prompt that opened the previous turn (what the user originally asked). */
  readonly previousPrompt: string | null;
  /** Tail of the assistant's last text before the episode. */
  readonly assistantExcerpt: string | null;
  /** Tool usage counts in the surrounding turn. */
  readonly tools: Readonly<Record<string, number>>;
  /** Type-specific facts (counts, file, command, reason...). */
  readonly detail: Readonly<Record<string, string | number | boolean | null>>;
};

export type Episode = {
  readonly id: string;
  readonly type: EpisodeType;
  readonly sessionId: string;
  readonly project: string;
  readonly timestamp: string;
  /** 0-1. Heuristic detectors say so explicitly; the LLM step confirms. */
  readonly confidence: number;
  /** Occurrences collapsed into this episode (>= 1). */
  readonly count: number;
  /** Sanitized excerpt of the triggering prompt, when there is one. */
  readonly prompt: string | null;
  readonly summary: string;
  readonly context: EpisodeContext;
  /** Other occurrences (repeated instructions); at most a few. */
  readonly related: readonly EpisodeRef[];
};

export type PromptTraitFinding = {
  readonly trait: string;
  readonly outcome: string;
  readonly withTrait: { readonly n: number; readonly value: number };
  readonly withoutTrait: { readonly n: number; readonly value: number };
  /** Smallest group size used to decide significance. */
  readonly sampleSize: number;
  /** True only when both groups are large enough and the gap is material. */
  readonly significant: boolean;
  readonly description: string;
};

// ---------------------------------------------------------------------------
// Insights (serializable, sanitized)
// ---------------------------------------------------------------------------

export const Severity = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];

export const InsightKind = {
  INTERRUPTIONS: 'interruptions',
  CORRECTIONS: 'corrections',
  TOOL_ERROR_LOOPS: 'tool-error-loops',
  TOOL_DENIALS: 'tool-denials',
  REWORK: 'rework',
  CONTEXT_PRESSURE: 'context-pressure',
  REPEATED_INSTRUCTION: 'repeated-instruction',
  READONLY_COMMANDS: 'readonly-commands',
  MODEL_SWITCHES: 'model-switches',
  PROMPT_TRAIT: 'prompt-trait',
} as const;
export type InsightKind = (typeof InsightKind)[keyof typeof InsightKind];

export type EvidenceExample = {
  readonly project: string;
  /** YYYY-MM-DD, local time. */
  readonly date: string;
  readonly sessionId: string;
  readonly quote: string;
  readonly note: string | null;
};

export type InsightEvidence = {
  readonly count: number;
  readonly sessions: number;
  readonly projects: readonly string[];
  /** Out of how many comparable items (e.g. typed prompts); null if n/a. */
  readonly outOf: number | null;
  readonly examples: readonly EvidenceExample[];
};

export type InsightAction =
  | {
      readonly kind: 'claude-md-rule';
      readonly scope: 'project' | 'user';
      readonly project: string | null;
      readonly file: string;
      /** Exact line(s) to append. */
      readonly text: string;
    }
  | {
      readonly kind: 'permission-allow';
      readonly patterns: readonly string[];
      readonly file: string;
      /** JSON fragment to merge into the settings file. */
      readonly snippet: string;
    }
  | {
      readonly kind: 'slash-command';
      readonly name: string;
      readonly file: string;
      readonly content: string;
    }
  | {
      readonly kind: 'prompt-habit';
      readonly habit: string;
      readonly before: string | null;
      readonly after: string | null;
    }
  | {
      readonly kind: 'workflow';
      readonly suggestion: string;
      readonly steps: readonly string[];
    };

export type Insight = {
  readonly id: string;
  readonly kind: InsightKind;
  readonly title: string;
  readonly severity: Severity;
  /** One line, with real numbers. */
  readonly finding: string;
  readonly evidence: InsightEvidence;
  readonly action: InsightAction;
  readonly confidence: number;
  /** Ranking score; higher first. */
  readonly score: number;
  readonly episodeIds: readonly string[];
};

// ---------------------------------------------------------------------------
// Report contract
// ---------------------------------------------------------------------------

export const REPORT_SCHEMA_VERSION = 1 as const;

export type DataQuality = {
  readonly filesRead: number;
  readonly subagentFilesRead: number;
  readonly recordsRead: number;
  readonly recordsSkipped: number;
  readonly unknownRecordTypes: Readonly<Record<string, number>>;
  readonly duplicateRecords: number;
  readonly orphanToolResults: number;
  readonly claudeCodeVersions: readonly string[];
  readonly sessionsInPeriod: number;
  readonly typedPrompts: number;
  /** False when there is too little data for trustworthy findings. */
  readonly enoughData: boolean;
  /** Human-readable caveats; engines append theirs. */
  readonly notes: readonly string[];
};

export type InterpretationVerdict = 'confirmed' | 'rejected' | 'unclear';

/** Filled by the LLM interpretation step (phase 2). */
export type Interpretation = {
  readonly engine: string;
  readonly model: string | null;
  readonly generatedAt: string;
  readonly summary: string;
  readonly episodeVerdicts: readonly {
    readonly episodeId: string;
    readonly verdict: InterpretationVerdict;
    readonly note: string;
  }[];
  readonly recommendations: readonly {
    readonly title: string;
    readonly body: string;
    readonly basedOn: readonly string[];
  }[];
};

export type ReportPeriod = {
  /** YYYY-MM-DD, local time, inclusive. */
  readonly from: string;
  readonly to: string;
  readonly days: number;
};

export type Report = {
  readonly schemaVersion: typeof REPORT_SCHEMA_VERSION;
  readonly generator: { readonly name: 'hyntx'; readonly version: string };
  readonly generatedAt: string;
  readonly period: ReportPeriod;
  readonly filters: { readonly project: string | null };
  readonly dataQuality: DataQuality;
  readonly metrics: Metrics;
  /** Merged daily history (persisted + current run), ascending by date. */
  readonly daily: readonly DailyPoint[];
  readonly episodes: readonly Episode[];
  readonly promptTraits: readonly PromptTraitFinding[];
  readonly insights: readonly Insight[];
  readonly interpretation: Interpretation | null;
};

// ---------------------------------------------------------------------------
// Phase 2 extension points
// ---------------------------------------------------------------------------

export const InterpretationEngine = {
  CLAUDE: 'claude',
  OLLAMA: 'ollama',
} as const;
export type InterpretationEngine =
  (typeof InterpretationEngine)[keyof typeof InterpretationEngine];

export type InterpretOptions = {
  readonly engine: InterpretationEngine;
  readonly model?: string;
  readonly verbose?: boolean;
  readonly signal?: AbortSignal;
};

export const OutputFormat = {
  TERMINAL: 'terminal',
  JSON: 'json',
  MARKDOWN: 'markdown',
} as const;
export type OutputFormat = (typeof OutputFormat)[keyof typeof OutputFormat];
