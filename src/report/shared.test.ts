import { describe, expect, it } from 'vitest';

import { type InsightAction } from '../types/index.js';
import { describeAction } from './shared.js';

const rule = (extra: { section?: string }): InsightAction => ({
  kind: 'claude-md-rule',
  scope: 'project',
  project: 'app',
  file: 'CLAUDE.md',
  text: '- Check with ls first.',
  ...extra,
});

describe('describeAction', () => {
  it('names the CLAUDE.md section only when the action has one', () => {
    expect(describeAction(rule({ section: 'Commands' })).label).toBe(
      'Add to CLAUDE.md in project "app" under "Commands"',
    );
    expect(describeAction(rule({})).label).toBe(
      'Add to CLAUDE.md in project "app"',
    );
  });
});
