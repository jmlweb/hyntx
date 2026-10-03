import { describe, expect, it } from 'vitest';

import {
  DenialKind,
  EpisodeType,
  PromptSource,
  TurnKind,
} from '../types/index.js';
import {
  analyzePromptTraits,
  callSignature,
  detectContextPressure,
  detectCorrections,
  detectDenials,
  detectFriction,
  detectInterruptions,
  detectModelSwitches,
  detectReadonlyCommands,
  detectRepeatedInstructions,
  detectRework,
  detectToolErrorLoops,
  MIN_TRAIT_SAMPLE,
  readOnlyKeys,
  scoreCorrection,
} from './friction.js';
import { at, makeCall, makeSession, makeTurn } from './test-helpers.js';

const err = (command: string): ReturnType<typeof makeCall> =>
  makeCall('Bash', {
    command,
    error: true,
    text: 'Exit code 1\nboom happened',
  });

describe('detectInterruptions', () => {
  it('emits one high-confidence episode per interruption with follow-up context', () => {
    const session = makeSession([
      makeTurn(0, 'refactor the whole module', {
        calls: [makeCall('Edit', { target: '/a.ts' })],
        interruptions: [{ timestamp: at(1, 3), duringToolUse: true }],
        assistantExcerpt: 'Starting with the parser',
      }),
      makeTurn(1, 'only touch utils please'),
    ]);
    const [episode] = detectInterruptions(session);
    expect(episode).toMatchObject({
      type: EpisodeType.INTERRUPTION,
      confidence: 0.95,
      prompt: 'refactor the whole module',
    });
    expect(episode?.context.detail['followUp']).toBe('only touch utils please');
    expect(episode?.context.detail['duringToolUse']).toBe(true);
    expect(episode?.context.assistantExcerpt).toBe('Starting with the parser');
  });
});

describe('scoreCorrection', () => {
  it.each([
    'no, that is not what I asked',
    "that's wrong, revert it",
    'I said only the header',
    'undo that',
    'stop',
    'wait, I just want ssh from anywhere',
    'No. Así no, te dije que usara otro archivo',
    'eso no es lo que pedí',
    'deshaz el último cambio',
    'revierte eso por favor',
    'sigue fallando el build',
  ])('detects pushback: %s', (text) => {
    expect(scoreCorrection(text, undefined).matched).toBe(true);
  });

  it.each([
    'looks good, now add tests',
    'no problem, go ahead',
    'now deploy it',
    'añade un botón de guardar',
  ])('does not flag neutral prompts: %s', (text) => {
    expect(scoreCorrection(text, undefined).matched).toBe(false);
  });

  it('raises confidence right after an interruption and lowers it for long prompts', () => {
    const interrupted = makeTurn(0, 'x', {
      interruptions: [{ timestamp: at(1), duringToolUse: false }],
    });
    const base = scoreCorrection('no, wrong file', undefined).confidence;
    expect(
      scoreCorrection('no, wrong file', interrupted).confidence,
    ).toBeGreaterThan(base);
    const long = `no, ${'word '.repeat(70)}`;
    expect(scoreCorrection(long, undefined).confidence).toBeLessThan(base);
  });

  it('weak mid-sentence matches stay below the insight threshold', () => {
    const signal = scoreCorrection(
      'please use pnpm instead of npm here',
      undefined,
    );
    expect(signal.matched).toBe(true);
    expect(signal.confidence).toBeLessThan(0.6);
  });
});

describe('detectCorrections', () => {
  it('flags a typed prompt following assistant work and skips the first turn and suggestions', () => {
    const session = makeSession([
      makeTurn(0, 'no, stop that'),
      makeTurn(1, 'add a login form', {
        calls: [makeCall('Write', { target: '/x' })],
      }),
      makeTurn(2, 'no, I said a signup form', {
        assistantExcerpt: null,
      }),
      makeTurn(3, 'no way', { source: PromptSource.SUGGESTION }),
    ]);
    const episodes = detectCorrections(session);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      type: EpisodeType.CORRECTION,
      prompt: 'no, I said a signup form',
    });
    expect(episodes[0]?.context.previousPrompt).toBe('add a login form');
  });
});

describe('tool error detectors', () => {
  it('detects 3+ consecutive tool errors', () => {
    const session = makeSession([
      makeTurn(0, 'fix the build', {
        calls: [
          err('make a'),
          err('make b'),
          err('npm test'),
          makeCall('Bash', { command: 'ls' }),
        ],
      }),
    ]);
    const episodes = detectToolErrorLoops(session);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ count: 3 });
    expect(episodes[0]?.context.detail['kind']).toBe('consecutive');
    expect(episodes[0]?.context.detail['firstError']).toBe('boom happened');
  });

  it('detects the same signature failing repeatedly with successes in between', () => {
    const session = makeSession([
      makeTurn(0, 'deploy', {
        calls: [
          err('docker compose up'),
          makeCall('Read', { target: '/x' }),
          err('docker compose up -d'),
          makeCall('Read', { target: '/y' }),
          err('docker compose up --build'),
        ],
      }),
    ]);
    const [episode] = detectToolErrorLoops(session);
    expect(episode?.context.detail['kind']).toBe('repeated');
    expect(episode?.context.detail['signature']).toBe('docker compose');
    expect(episode?.count).toBe(3);
  });

  it('ignores denials and sidechain calls and short streaks', () => {
    const session = makeSession([
      makeTurn(0, 'x', {
        calls: [
          err('a'),
          err('b'),
          makeCall('Bash', { denial: DenialKind.USER }),
          makeCall('Bash', { error: true, sidechain: true }),
        ],
      }),
    ]);
    expect(detectToolErrorLoops(session)).toHaveLength(0);
  });
});

describe('callSignature', () => {
  it('uses the binary, plus subcommand for known multi-command tools', () => {
    expect(
      callSignature(makeCall('Bash', { command: 'git push origin main' })),
    ).toBe('git push');
    expect(
      callSignature(makeCall('Bash', { command: 'FOO=1 cat file.txt' })),
    ).toBe('cat');
    expect(
      callSignature(makeCall('Bash', { command: 'T=$(cat x); curl y' })),
    ).toBe('curl');
    expect(callSignature(makeCall('Edit', { target: '/a/b.ts' }))).toBe(
      'Edit b.ts',
    );
  });
});

describe('detectDenials', () => {
  it('groups denials by kind and command and keeps the reason', () => {
    const session = makeSession([
      makeTurn(0, 'clean up', {
        calls: [
          makeCall('Bash', {
            command: 'shred a',
            denial: DenialKind.USER,
            text: "The user doesn't want to proceed",
          }),
          makeCall('Bash', {
            command: 'shred b',
            denial: DenialKind.USER,
            text: "The user doesn't want to proceed",
          }),
          makeCall('Bash', {
            command: 'dig x',
            denial: DenialKind.CLASSIFIER,
            text: 'Permission for this action was denied by the Claude Code auto mode classifier. Reason: [DNS Changes]. Other tasks may continue.',
          }),
        ],
      }),
    ]);
    const episodes = detectDenials(session);
    expect(episodes).toHaveLength(2);
    const user = episodes.find((e) => e.context.detail['denial'] === 'user');
    expect(user).toMatchObject({ count: 2, confidence: 0.9 });
    const classifier = episodes.find(
      (e) => e.context.detail['denial'] === 'classifier',
    );
    expect(classifier?.context.detail['reason']).toBe('DNS Changes');
  });
});

describe('detectRework', () => {
  it('flags a file edited 5+ times and ignores failed edits', () => {
    const edits = Array.from({ length: 5 }, () =>
      makeCall('Edit', { target: '/work/app/src/a.ts' }),
    );
    const failed = makeCall('Edit', {
      target: '/work/app/src/b.ts',
      error: true,
    });
    const session = makeSession([
      makeTurn(0, 'build it', { calls: edits.slice(0, 3) }),
      makeTurn(1, 'fix it', {
        calls: [...edits.slice(3), failed, failed, failed, failed, failed],
      }),
    ]);
    const episodes = detectRework(session);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ count: 5, type: EpisodeType.REWORK });
    expect(episodes[0]?.context.detail).toMatchObject({
      file: 'src/a.ts',
      turns: 2,
    });
  });

  it('does not flag 4 edits', () => {
    const edits = Array.from({ length: 4 }, () =>
      makeCall('Edit', { target: '/a.ts' }),
    );
    expect(
      detectRework(makeSession([makeTurn(0, 'x', { calls: edits })])),
    ).toHaveLength(0);
  });
});

describe('detectContextPressure', () => {
  it('flags compactions with high confidence and very long sessions with lower', () => {
    const compacted = makeSession([makeTurn(0, 'x')], {
      compactions: [
        { timestamp: at(1, 9), trigger: 'auto', preTokens: 160000 },
      ],
    });
    expect(detectContextPressure(compacted)[0]).toMatchObject({
      confidence: 0.9,
      count: 1,
    });

    const long = makeSession(
      Array.from({ length: 41 }, (_, i) => makeTurn(i, `p${String(i)}`)),
    );
    expect(detectContextPressure(long)[0]).toMatchObject({ confidence: 0.6 });

    expect(detectContextPressure(makeSession([makeTurn(0, 'x')]))).toHaveLength(
      0,
    );
  });
});

describe('detectRepeatedInstructions', () => {
  const prompt = (text: string, day: number): ReturnType<typeof makeSession> =>
    makeSession([makeTurn(0, text, { ts: at(day) })]);

  it('clusters near-identical prompts across sessions', () => {
    const sessions = [
      prompt('run the tests and fix any lint errors before committing', 1),
      prompt('Run the tests, and fix any lint errors before committing!', 2),
      prompt('run tests and fix lint errors before committing', 3),
      prompt('write a poem about autumn leaves', 4),
    ];
    const episodes = detectRepeatedInstructions(sessions);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({
      type: EpisodeType.REPEATED_INSTRUCTION,
      count: 3,
    });
    expect(episodes[0]?.context.detail['sessions']).toBe(3);
    expect(episodes[0]?.related.length).toBeGreaterThan(0);
  });

  it('requires multiple sessions and ignores slash commands and suggestions', () => {
    const one = makeSession([
      makeTurn(0, 'run the tests and fix lint errors', { ts: at(1) }),
      makeTurn(1, 'run the tests and fix lint errors', { ts: at(1, 10) }),
      makeTurn(2, 'run the tests and fix lint errors', { ts: at(1, 20) }),
    ]);
    expect(detectRepeatedInstructions([one])).toHaveLength(0);
    const suggested = [1, 2, 3].map((d) =>
      makeSession([
        makeTurn(0, 'run the tests and fix lint errors', {
          ts: at(d),
          source: PromptSource.SUGGESTION,
        }),
      ]),
    );
    expect(detectRepeatedInstructions(suggested)).toHaveLength(0);
    const commands = [1, 2, 3].map((d) =>
      makeSession([
        makeTurn(0, '/flow:next-task now please do it', { ts: at(d) }),
      ]),
    );
    expect(detectRepeatedInstructions(commands)).toHaveLength(0);
  });

  it('supports Spanish prompts', () => {
    const sessions = [1, 2, 3].map((d) =>
      prompt(
        'ejecuta los tests y arregla los errores de lint antes de hacer commit',
        d,
      ),
    );
    expect(detectRepeatedInstructions(sessions)).toHaveLength(1);
  });
});

describe('readOnlyKeys', () => {
  it('returns keys for read-only compound commands', () => {
    expect(readOnlyKeys('git status')).toEqual(['git status']);
    expect(readOnlyKeys('cd /x && git diff --stat | head -5')).toEqual([
      'git diff',
      'head',
    ]);
    expect(readOnlyKeys('ls -la 2>/dev/null')).toEqual(['ls']);
    expect(readOnlyKeys('gh pr view 12 --json title')).toEqual(['gh pr view']);
  });

  it.each([
    'git push',
    'git commit -m x',
    'ls > out.txt',
    'cat a | tee b',
    'find . -name x -delete',
    'sed -i s/a/b/ f',
    'echo $(whoami)',
    'pnpm install',
  ])('rejects mutating or unknown commands: %s', (command) => {
    expect(readOnlyKeys(command)).toBeNull();
  });
});

describe('detectReadonlyCommands', () => {
  const sessionWith = (
    mode: string | null,
    count: number,
  ): ReturnType<typeof makeSession> =>
    makeSession([
      makeTurn(0, 'look around', {
        permissionMode: mode,
        calls: Array.from({ length: count }, () =>
          makeCall('Bash', { command: 'git status' }),
        ),
      }),
    ]);

  it('flags frequent read-only commands run with permission prompts across sessions', () => {
    const episodes = detectReadonlyCommands([
      sessionWith('default', 4),
      sessionWith('acceptEdits', 4),
    ]);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]?.context.detail).toMatchObject({
      key: 'git status',
      runs: 8,
      sessions: 2,
    });
    expect(episodes[0]?.confidence).toBe(0.8);
  });

  it('ignores sessions where permissions are not prompting (auto mode) and rare commands', () => {
    expect(
      detectReadonlyCommands([
        sessionWith('auto', 10),
        sessionWith('auto', 10),
      ]),
    ).toHaveLength(0);
    expect(
      detectReadonlyCommands([
        sessionWith('default', 2),
        sessionWith('default', 2),
      ]),
    ).toHaveLength(0);
  });

  it('lowers confidence when the permission mode is unknown', () => {
    const episodes = detectReadonlyCommands([
      sessionWith(null, 4),
      sessionWith(null, 4),
    ]);
    expect(episodes[0]?.confidence).toBe(0.5);
  });
});

describe('analyzePromptTraits', () => {
  const turns = (
    n: number,
    short: boolean,
    withError: boolean,
  ): ReturnType<typeof makeSession> =>
    makeSession(
      Array.from({ length: n }, (_, i) =>
        makeTurn(
          i,
          short
            ? 'fix it'
            : 'please fix the failing build in the checkout module today',
          {
            calls: withError
              ? [err('x')]
              : [makeCall('Bash', { command: 'ls' })],
          },
        ),
      ),
    );

  it('does not surface correlations with a small sample, and states the sample size', () => {
    const findings = analyzePromptTraits(
      [turns(5, true, true), turns(5, false, false)],
      [],
    );
    const short = findings.find(
      (f) => f.trait.startsWith('short') && f.outcome.startsWith('tool errors'),
    );
    expect(short?.significant).toBe(false);
    expect(short?.sampleSize).toBe(5);
    expect(short?.description).toContain('n=5');
  });

  it('surfaces a material difference once both groups are large enough', () => {
    const n = MIN_TRAIT_SAMPLE;
    const findings = analyzePromptTraits(
      [turns(n, true, true), turns(n, false, false)],
      [],
    );
    const short = findings.find(
      (f) => f.trait.startsWith('short') && f.outcome.startsWith('tool errors'),
    );
    expect(short).toMatchObject({ significant: true, sampleSize: n });
    expect(short?.withTrait.value).toBe(1);
    expect(short?.withoutTrait.value).toBe(0);
  });

  it('ignores non-typed turns', () => {
    const session = makeSession([
      makeTurn(0, 'fix it', { kind: TurnKind.COMMAND }),
    ]);
    const findings = analyzePromptTraits([session], []);
    expect(findings.every((f) => f.withTrait.n === 0)).toBe(true);
  });
});

describe('detectFriction', () => {
  it('combines detectors in chronological order', () => {
    const session = makeSession([
      makeTurn(0, 'start', {
        ts: at(1, 0),
        interruptions: [{ timestamp: at(1, 2), duringToolUse: false }],
      }),
      makeTurn(1, 'no, wrong', { ts: at(1, 5) }),
    ]);
    const { episodes } = detectFriction([session]);
    expect(episodes.map((e) => e.type)).toEqual([
      EpisodeType.INTERRUPTION,
      EpisodeType.CORRECTION,
    ]);
  });
});

describe('detectModelSwitches', () => {
  it('counts a switch only when the cache was re-written on the new model', () => {
    const big = { input: 10, output: 50, cacheRead: 0, cacheCreation: 120_000 };
    const session = makeSession([
      makeTurn(0, 'start', { models: ['claude-opus-5'] }),
      makeTurn(1, 'continue', { models: ['claude-opus-5'] }),
      makeTurn(2, 'now cheaper', { models: ['claude-sonnet-5'], tokens: big }),
      makeTurn(3, 'tiny switch back', {
        models: ['claude-opus-5'],
        tokens: { ...big, cacheCreation: 100 },
      }),
    ]);
    const episodes = detectModelSwitches(session);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]).toMatchObject({ count: 1 });
    expect(episodes[0]?.context.detail['cacheWriteTokens']).toBe(120_000);
  });
});
