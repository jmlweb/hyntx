import { describe, expect, it } from 'vitest';

import { createLogger } from './logger.js';

function capture(): {
  lines: string[];
  logger: ReturnType<typeof createLogger>;
} {
  const lines: string[] = [];
  return {
    lines,
    logger: createLogger((line) => {
      lines.push(line);
    }),
  };
}

describe('logger', () => {
  it('writes errors, warnings and info with a label and optional context', () => {
    const { lines, logger } = capture();
    logger.error('boom', 'reader');
    logger.warn('careful');
    logger.info('hello');
    expect(lines).toHaveLength(3);
    expect(lines[0]).toContain('ERROR: [reader] boom');
    expect(lines[1]).toContain('WARN: careful');
    expect(lines[2]).toContain('INFO: hello');
  });

  it('prints debug output only in verbose mode', () => {
    const { lines, logger } = capture();
    logger.debug('hidden');
    expect(lines).toEqual([]);
    logger.setVerbose(true);
    logger.debug('shown', 'ctx');
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain('[DEBUG] [ctx] shown');
  });
});
