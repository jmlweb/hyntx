import { describe, expect, it } from 'vitest';

import { InterpretationEngine } from '../types/index.js';
import { interpretReport } from './index.js';
import { fixtureReport } from './test-fixtures.js';

describe('interpretReport', () => {
  it('keeps the deterministic report and adds a fixable note when the engine is unavailable', async () => {
    const original = process.env['OLLAMA_HOST'];
    process.env['OLLAMA_HOST'] = '127.0.0.1:1';
    try {
      const report = fixtureReport();
      const result = await interpretReport(report, {
        engine: InterpretationEngine.OLLAMA,
      });
      expect(result.interpretation).toBeNull();
      expect(result.insights).toEqual(report.insights);
      const added = result.dataQuality.notes.slice(
        report.dataQuality.notes.length,
      );
      expect(added).toHaveLength(1);
      expect(added[0]).toContain('ollama');
      expect(added[0]).toContain('--no-llm');
    } finally {
      if (original === undefined) {
        delete process.env['OLLAMA_HOST'];
      } else {
        process.env['OLLAMA_HOST'] = original;
      }
    }
  });

  it('notes when there is nothing to interpret', async () => {
    const report = { ...fixtureReport(), episodes: [], insights: [] };
    const result = await interpretReport(report, {
      engine: InterpretationEngine.CLAUDE,
    });
    expect(result.dataQuality.notes.at(-1)).toContain('Nothing to interpret');
  });
});
