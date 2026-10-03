/**
 * What the user is told, before the call, about where data goes. Pure so it
 * can be tested without running an engine.
 */

import { InterpretationEngine } from '../types/index.js';
import { resolveOllamaHost } from './ollama.js';

const LOCAL_HOSTS: ReadonlySet<string> = new Set([
  'localhost',
  '127.0.0.1',
  '[::1]',
  '::1',
]);

export function isLocalHost(url: string): boolean {
  try {
    return LOCAL_HOSTS.has(new URL(url).hostname);
  } catch {
    return false;
  }
}

export function describeDataDestination(
  engine: InterpretationEngine,
  env: Readonly<Record<string, string | undefined>>,
): string {
  if (engine === InterpretationEngine.CLAUDE) {
    return (
      'hyntx: sending sanitized excerpts (prompts, assistant text, error messages and file names from flagged episodes) to Anthropic ' +
      'through your Claude Code login to confirm findings. ' +
      'Use --no-llm to keep everything local, or --engine ollama to use a local model.'
    );
  }
  const host = resolveOllamaHost(env['OLLAMA_HOST']);
  return isLocalHost(host)
    ? `hyntx: sending sanitized excerpts to Ollama at ${host} (this machine). Use --no-llm to skip.`
    : `hyntx: OLLAMA_HOST points to ${host}, which is not this machine: sanitized excerpts (prompts, assistant text, error messages and file names from flagged episodes) will leave it. Use --no-llm to skip.`;
}
