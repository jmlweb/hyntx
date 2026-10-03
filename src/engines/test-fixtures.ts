import { buildReport } from '../core/report.js';
import { at, makeSession, makeTurn } from '../core/test-helpers.js';
import {
  type Episode,
  EpisodeType,
  type Insight,
  InsightKind,
  type Report,
} from '../types/index.js';

export const EPISODE_ID = 'correction:abcd1234:3';
export const INSIGHT_ID = 'corrections';

const episode: Episode = {
  id: EPISODE_ID,
  type: EpisodeType.CORRECTION,
  sessionId: 'abcd1234-0000',
  project: 'app',
  timestamp: at(1),
  confidence: 0.7,
  count: 1,
  prompt: 'no, I said only the invoice helpers',
  summary: 'Prompt right after an assistant turn reads like a correction',
  context: {
    previousPrompt: 'refactor the billing module',
    assistantExcerpt: 'I rewrote the whole module',
    tools: { Edit: 4 },
    detail: { heuristic: 'pushback phrase at start' },
  },
  related: [],
};

const insight: Insight = {
  id: INSIGHT_ID,
  kind: InsightKind.CORRECTIONS,
  title: 'Many prompts push back on the previous answer',
  severity: 'medium',
  finding: '3 of 40 typed prompts read as corrections.',
  evidence: {
    count: 3,
    sessions: 2,
    projects: ['app'],
    outOf: 40,
    examples: [],
  },
  action: {
    kind: 'prompt-habit',
    habit: 'State constraints first',
    before: null,
    after: null,
  },
  confidence: 0.7,
  score: 3,
  episodeIds: [EPISODE_ID],
};

export function fixtureReport(): Report {
  const base = buildReport({
    sessions: [makeSession([makeTurn(0, 'hello', { ts: at(1) })])],
    stats: {
      filesRead: 1,
      subagentFilesRead: 0,
      recordsRead: 1,
      recordsSkipped: 0,
      unknownRecordTypes: {},
      duplicateRecords: 0,
      orphanToolResults: 0,
      claudeCodeVersions: [],
    },
    from: new Date(2026, 8, 1),
    to: new Date(2026, 8, 7),
    project: null,
    version: '4.0.0',
  });
  return { ...base, episodes: [episode], insights: [insight] };
}

export const GOOD_ANSWER = {
  summary:
    'You typed 40 prompts over the week and three read as pushback on large rewrites.',
  verdicts: [
    {
      id: EPISODE_ID,
      verdict: 'confirmed',
      reason: 'You said "only the invoice helpers" right after a full rewrite.',
    },
  ],
  recommendations: [
    {
      title: 'Scope refactors up front',
      body: 'Name the files that may change in the first prompt.',
      basedOn: [INSIGHT_ID, EPISODE_ID],
    },
  ],
};
