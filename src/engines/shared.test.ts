import { describe, expect, it } from 'vitest';

import {
  EngineOutputError,
  loosensSafety,
  OLLAMA_BUDGET,
  parseJsonObject,
  selectEvidence,
  validateAnswer,
} from './shared.js';
import {
  EPISODE_ID,
  fixtureReport,
  GOOD_ANSWER,
  INSIGHT_ID,
} from './test-fixtures.js';

const evidence = selectEvidence(fixtureReport(), OLLAMA_BUDGET);

describe('selectEvidence', () => {
  it('caps episodes and text regardless of log size', () => {
    const base = fixtureReport();
    const [first] = base.episodes;
    if (!first) {
      throw new Error('fixture has an episode');
    }
    const many = Array.from({ length: 100 }, (_, i) => ({
      ...first,
      id: `correction:x:${String(i)}`,
      prompt: 'p'.repeat(2000),
    }));
    const selected = selectEvidence({ ...base, episodes: many }, OLLAMA_BUDGET);
    expect(selected.episodes).toHaveLength(OLLAMA_BUDGET.maxEpisodes);
    expect(JSON.stringify(selected).length).toBeLessThan(10_000);
  });

  it('only asks for verdicts on heuristic episodes', () => {
    const base = fixtureReport();
    const [first] = base.episodes;
    if (!first) {
      throw new Error('fixture has an episode');
    }
    const denied = {
      ...first,
      id: 'tool-denied:x:1',
      type: 'tool-denied' as const,
    };
    const selected = selectEvidence(
      { ...base, episodes: [first, denied] },
      OLLAMA_BUDGET,
    );
    expect(selected.episodes.map((e) => e.id)).toEqual([EPISODE_ID]);
  });
});

describe('validateAnswer', () => {
  it('accepts a grounded answer', () => {
    const answer = validateAnswer(GOOD_ANSWER, evidence);
    expect(answer.episodeVerdicts).toHaveLength(1);
    expect(answer.recommendations[0]?.basedOn).toEqual([
      INSIGHT_ID,
      EPISODE_ID,
    ]);
  });

  it('drops verdicts and references to ids that were never sent', () => {
    const answer = validateAnswer(
      {
        ...GOOD_ANSWER,
        verdicts: [
          ...GOOD_ANSWER.verdicts,
          {
            id: 'correction:made:up',
            verdict: 'confirmed',
            reason: 'invented',
          },
        ],
        recommendations: [
          { title: 'Ghost', body: 'Based on nothing real', basedOn: ['nope'] },
          {
            title: 'Mixed',
            body: 'One real id and one fake',
            basedOn: ['nope', INSIGHT_ID],
          },
        ],
      },
      evidence,
    );
    expect(answer.episodeVerdicts.map((v) => v.episodeId)).toEqual([
      EPISODE_ID,
    ]);
    expect(answer.recommendations).toEqual([
      {
        title: 'Mixed',
        body: 'One real id and one fake',
        basedOn: [INSIGHT_ID],
      },
    ]);
  });

  it('rejects placeholder or echoed-schema text', () => {
    expect(() =>
      validateAnswer({ ...GOOD_ANSWER, summary: 'string' }, evidence),
    ).toThrow(EngineOutputError);
    expect(() =>
      validateAnswer(
        { ...GOOD_ANSWER, summary: '<2 to 4 plain sentences>' },
        evidence,
      ),
    ).toThrow(EngineOutputError);
    const answer = validateAnswer(
      {
        ...GOOD_ANSWER,
        verdicts: [
          { id: EPISODE_ID, verdict: 'confirmed', reason: 'one-line reason' },
        ],
        recommendations: [
          { title: 'title', body: 'body', basedOn: [INSIGHT_ID] },
        ],
      },
      evidence,
    );
    expect(answer.episodeVerdicts).toEqual([]);
    expect(answer.recommendations).toEqual([]);
  });

  it('rejects circular verdict reasons and bad verdict values', () => {
    const answer = validateAnswer(
      {
        ...GOOD_ANSWER,
        verdicts: [
          {
            id: EPISODE_ID,
            verdict: 'confirmed',
            reason: "The episode type is 'correction'.",
          },
        ],
      },
      evidence,
    );
    expect(answer.episodeVerdicts).toEqual([]);
    expect(
      validateAnswer(
        {
          ...GOOD_ANSWER,
          verdicts: [
            { id: EPISODE_ID, verdict: 'maybe', reason: 'You pushed back.' },
          ],
        },
        evidence,
      ).episodeVerdicts,
    ).toEqual([]);
  });

  it('drops recommendations that advise weakening a hook or auto-mode block', () => {
    const answer = validateAnswer(
      {
        ...GOOD_ANSWER,
        recommendations: [
          {
            title: 'Review auto-mode blocking',
            body: 'Consider allowing DNS changes.',
            basedOn: [INSIGHT_ID],
          },
          {
            title: 'Update hook rules',
            body: 'Adjust the hook so deletes pass.',
            basedOn: [INSIGHT_ID],
          },
        ],
      },
      evidence,
    );
    expect(answer.recommendations).toEqual([]);
  });

  it('rejects non-objects', () => {
    expect(() => validateAnswer('hi', evidence)).toThrow(EngineOutputError);
    expect(() => validateAnswer(null, evidence)).toThrow(EngineOutputError);
  });
});

describe('parseJsonObject', () => {
  it('tolerates code fences and surrounding prose', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
    expect(parseJsonObject('Here you go: {"a":2} thanks')).toEqual({ a: 2 });
    expect(() => parseJsonObject('not json')).toThrow(EngineOutputError);
  });
});

describe('loosensSafety', () => {
  it.each([
    'Disable the hook that blocks rm',
    'Allow the classifier to pass these commands',
    'Relax auto mode for deploys',
    'Add an exception: bypass hooks for this repo',
  ])('flags advice that weakens a guardrail: %s', (text) => {
    expect(loosensSafety(text)).toBe(true);
  });

  it.each([
    'Review your hooks to see which message repeats',
    'Update CLAUDE.md so Claude reads the hook message first',
    'Never disable the hook, follow the message instead',
    'Do not bypass auto mode; ask for approval',
    'Reconsider how you word the prompt',
  ])('keeps benign advice: %s', (text) => {
    expect(loosensSafety(text)).toBe(false);
  });
});
