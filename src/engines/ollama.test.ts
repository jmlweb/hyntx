import { afterEach, describe, expect, it, vi } from 'vitest';

import { interpretWithOllama, resolveOllamaHost } from './ollama.js';
import { EngineOutputError, EngineUnavailableError } from './shared.js';
import { fixtureReport, GOOD_ANSWER } from './test-fixtures.js';

const options = { engine: 'ollama' as const };
const reply = (content: unknown, init?: ResponseInit): Response =>
  new Response(
    JSON.stringify({
      message: {
        content:
          typeof content === 'string' ? content : JSON.stringify(content),
      },
    }),
    init,
  );

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('resolveOllamaHost', () => {
  it('normalises OLLAMA_HOST values', () => {
    expect(resolveOllamaHost(undefined)).toBe('http://localhost:11434');
    expect(resolveOllamaHost('127.0.0.1:11500')).toBe('http://127.0.0.1:11500');
    expect(resolveOllamaHost('https://box:1/')).toBe('https://box:1');
    expect(resolveOllamaHost('0.0.0.0:11434')).toBe('http://localhost:11434');
  });
});

describe('interpretWithOllama', () => {
  it('calls /api/chat with the default model and schema, honouring OLLAMA_HOST', async () => {
    vi.stubEnv('OLLAMA_HOST', 'box:9');
    const fetchFn = vi.fn().mockResolvedValue(reply(GOOD_ANSWER));
    const result = await interpretWithOllama(fixtureReport(), options, fetchFn);
    expect(result?.model).toBe('gemma4:e4b');
    expect(result?.engine).toBe('ollama');
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://box:9/api/chat');
    const body = JSON.parse(init.body as string) as {
      model: string;
      stream: boolean;
      format: { type: string };
      options: { num_ctx: number };
    };
    expect(body).toMatchObject({
      model: 'gemma4:e4b',
      stream: false,
      format: { type: 'object' },
    });
    expect(body.options.num_ctx).toBeGreaterThanOrEqual(8192);
  });

  it('uses --model when given', async () => {
    const fetchFn = vi.fn().mockResolvedValue(reply(GOOD_ANSWER));
    const result = await interpretWithOllama(
      fixtureReport(),
      { ...options, model: 'gemma4:26b' },
      fetchFn,
    );
    expect(result?.model).toBe('gemma4:26b');
  });

  it('fails on malformed or placeholder content', async () => {
    await expect(
      interpretWithOllama(
        fixtureReport(),
        options,
        vi.fn().mockResolvedValue(reply('I cannot do that')),
      ),
    ).rejects.toThrow(EngineOutputError);
    await expect(
      interpretWithOllama(
        fixtureReport(),
        options,
        vi
          .fn()
          .mockResolvedValue(
            reply({ summary: '...', verdicts: [], recommendations: [] }),
          ),
      ),
    ).rejects.toThrow(/summary/);
  });

  it('reports a down server and a missing model as unavailable with a fix', async () => {
    const down = vi.fn().mockRejectedValue(new TypeError('fetch failed'));
    await expect(
      interpretWithOllama(fixtureReport(), options, down),
    ).rejects.toThrow(/ollama serve/);
    await expect(
      interpretWithOllama(fixtureReport(), options, down),
    ).rejects.toThrow(EngineUnavailableError);
    const missing = vi
      .fn()
      .mockResolvedValue(
        new Response('{"error":"model not found"}', { status: 404 }),
      );
    await expect(
      interpretWithOllama(fixtureReport(), options, missing),
    ).rejects.toThrow(/ollama pull gemma4:e4b/);
  });

  it('turns an abort into a clear error', async () => {
    const controller = new AbortController();
    const hang = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            reject(new DOMException('aborted', 'AbortError'));
          });
        }),
    );
    const pending = interpretWithOllama(
      fixtureReport(),
      { ...options, signal: controller.signal },
      hang as unknown as typeof fetch,
    );
    controller.abort();
    await expect(pending).rejects.toThrow(/cancelled/);
  });
});
