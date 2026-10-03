import { describe, expect, it, vi } from 'vitest';

import {
  buildClaudeArgs,
  interpretWithClaude,
  type RunProcess,
} from './claude.js';
import { EngineOutputError, EngineUnavailableError } from './shared.js';
import { fixtureReport, GOOD_ANSWER } from './test-fixtures.js';

const ok = (stdout: string): RunProcess =>
  vi.fn().mockResolvedValue({ stdout, stderr: '', code: 0 });

const envelope = (extra: Record<string, unknown>): string =>
  JSON.stringify({ is_error: false, ...extra });

const options = { engine: 'claude' as const };

describe('buildClaudeArgs', () => {
  it('locks the run down and passes the model only when given', () => {
    const args = buildClaudeArgs(undefined);
    expect(args).toEqual(
      expect.arrayContaining([
        '-p',
        '--no-session-persistence',
        '--safe-mode',
        '--strict-mcp-config',
      ]),
    );
    expect(args[args.indexOf('--tools') + 1]).toBe('');
    expect(args).not.toContain('--model');
    expect(buildClaudeArgs('haiku').slice(-2)).toEqual(['--model', 'haiku']);
  });
});

describe('interpretWithClaude', () => {
  it('returns the structured output, sending the prompt over stdin', async () => {
    const run = ok(envelope({ structured_output: GOOD_ANSWER }));
    const result = await interpretWithClaude(
      fixtureReport(),
      { ...options, model: 'sonnet' },
      run,
    );
    expect(result?.engine).toBe('claude');
    expect(result?.model).toBe('sonnet');
    expect(result?.recommendations).toHaveLength(1);
    const [command, args, input] = vi.mocked(run).mock.calls[0] ?? [];
    expect(command).toBe('claude');
    expect(args).toContain('sonnet');
    expect(input).toContain('Evidence (JSON)');
    expect(args?.join(' ')).not.toContain('Evidence (JSON)');
  });

  it('falls back to a JSON string in result, even inside a code fence', async () => {
    const run = ok(
      envelope({
        result: `\`\`\`json\n${JSON.stringify(GOOD_ANSWER)}\n\`\`\``,
      }),
    );
    expect(
      (await interpretWithClaude(fixtureReport(), options, run))?.summary,
    ).toContain('40 prompts');
  });

  it('fails on malformed, placeholder or unusable output', async () => {
    await expect(
      interpretWithClaude(fixtureReport(), options, ok('not json')),
    ).rejects.toThrow(EngineOutputError);
    await expect(
      interpretWithClaude(
        fixtureReport(),
        options,
        ok(
          envelope({
            structured_output: { ...GOOD_ANSWER, summary: 'string' },
          }),
        ),
      ),
    ).rejects.toThrow(/summary/);
  });

  it('ignores unknown ids in the answer', async () => {
    const answer = {
      ...GOOD_ANSWER,
      recommendations: [
        { title: 'Ghost', body: 'Invented', basedOn: ['made-up'] },
      ],
    };
    const result = await interpretWithClaude(
      fixtureReport(),
      options,
      ok(envelope({ structured_output: answer })),
    );
    expect(result?.recommendations).toEqual([]);
  });

  it('reports a missing CLI and a missing login as unavailable with a fix', async () => {
    const missing = vi
      .fn()
      .mockRejectedValue(
        Object.assign(new Error('spawn claude ENOENT'), { code: 'ENOENT' }),
      );
    await expect(
      interpretWithClaude(fixtureReport(), options, missing),
    ).rejects.toThrow(EngineUnavailableError);
    const loggedOut: RunProcess = vi.fn().mockResolvedValue({
      stdout: envelope({
        is_error: true,
        result: 'Not logged in - Please run /login',
      }),
      stderr: '',
      code: 1,
    });
    await expect(
      interpretWithClaude(fixtureReport(), options, loggedOut),
    ).rejects.toThrow(/not logged in/);
  });

  it('turns a caller abort and a timeout into clear errors', async () => {
    const controller = new AbortController();
    const hang: RunProcess = (_c, _a, _i, signal) =>
      new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      });
    const pending = interpretWithClaude(
      fixtureReport(),
      { ...options, signal: controller.signal },
      hang,
    );
    controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/);

    const timeoutController = new AbortController();
    const spy = vi
      .spyOn(AbortSignal, 'timeout')
      .mockReturnValue(timeoutController.signal);
    try {
      const slow = interpretWithClaude(fixtureReport(), options, hang);
      timeoutController.abort();
      await expect(slow).rejects.toThrow(/did not answer within/);
    } finally {
      spy.mockRestore();
    }
  });

  it('skips the call when there is nothing to interpret', async () => {
    const run = ok('{}');
    const empty = { ...fixtureReport(), episodes: [], insights: [] };
    expect(await interpretWithClaude(empty, options, run)).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });
});
