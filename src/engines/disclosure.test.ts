import { describe, expect, it } from 'vitest';

import { InterpretationEngine } from '../types/index.js';
import { describeDataDestination, isLocalHost } from './disclosure.js';

describe('describeDataDestination', () => {
  it('tells a bare claude run that excerpts go to Anthropic and how to avoid it', () => {
    const message = describeDataDestination(InterpretationEngine.CLAUDE, {});
    expect(message).toContain('Anthropic');
    expect(message).toContain('Claude Code login');
    expect(message).toContain('--no-llm');
    expect(message).toContain('--engine ollama');
  });

  it('says ollama stays on this machine by default', () => {
    const message = describeDataDestination(InterpretationEngine.OLLAMA, {});
    expect(message).toContain('http://localhost:11434');
    expect(message).toContain('this machine');
  });

  it('warns when OLLAMA_HOST points elsewhere', () => {
    const message = describeDataDestination(InterpretationEngine.OLLAMA, {
      OLLAMA_HOST: 'gpu-box.example.com:11434',
    });
    expect(message).toContain('gpu-box.example.com');
    expect(message).toContain('will leave it');
  });

  it('recognises loopback hosts', () => {
    expect(isLocalHost('http://127.0.0.1:11434')).toBe(true);
    expect(isLocalHost('http://[::1]:11434')).toBe(true);
    expect(isLocalHost('http://10.0.0.5:11434')).toBe(false);
  });
});
