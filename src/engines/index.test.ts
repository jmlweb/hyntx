import { describe, expect, it } from 'vitest';

import { buildReport } from '../core/report.js';
import { at, makeSession, makeTurn } from '../core/test-helpers.js';
import { InterpretationEngine, type Report } from '../types/index.js';
import { interpretReport } from './index.js';

function baseReport(): Report {
  return buildReport({
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
}

describe('interpretReport (phase 1 stubs)', () => {
  it.each([InterpretationEngine.CLAUDE, InterpretationEngine.OLLAMA])(
    'returns the report unchanged plus a note for engine %s',
    async (engine) => {
      const report = baseReport();
      const result = await interpretReport(report, { engine });
      expect(result.interpretation).toBeNull();
      expect(result.metrics).toEqual(report.metrics);
      expect(result.insights).toEqual(report.insights);
      const added = result.dataQuality.notes.slice(
        report.dataQuality.notes.length,
      );
      expect(added).toHaveLength(1);
      expect(added[0]).toContain('not available yet');
      expect(added[0]).toContain(engine);
    },
  );
});
