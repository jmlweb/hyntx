/**
 * Tests for schema definitions and issue taxonomy.
 */

import { describe, expect, it } from 'vitest';

import type { RulesConfig } from '../types/index.js';
import {
  applyRulesConfig,
  getEnabledPatternIds,
  ISSUE_TAXONOMY,
  type IssueMetadata,
  SYSTEM_PROMPT_FULL,
  SYSTEM_PROMPT_MINIMAL,
  SYSTEM_PROMPT_SIMPLE,
} from './schemas.js';

describe('schemas', () => {
  describe('ISSUE_TAXONOMY', () => {
    it('should contain all predefined issue types', () => {
      const expectedIssues = [
        'vague',
        'no-context',
        'too-broad',
        'no-goal',
        'imperative',
        'missing-technical-details',
        'unclear-priorities',
        'insufficient-constraints',
      ];

      for (const issue of expectedIssues) {
        expect(ISSUE_TAXONOMY[issue]).toBeDefined();
      }
    });

    it('should have valid metadata for each issue', () => {
      for (const metadata of Object.values(ISSUE_TAXONOMY)) {
        expect(metadata.name).toBeTruthy();
        expect(metadata.severity).toMatch(/^(low|medium|high)$/);
        expect(metadata.suggestion).toBeTruthy();

        // Metadata should be readonly
        const typedMetadata: IssueMetadata = metadata;
        expect(typedMetadata).toBeDefined();
      }
    });

    it('should have high severity for critical issues', () => {
      const criticalIssues = ['vague', 'no-context', 'no-goal'];

      for (const issue of criticalIssues) {
        const metadata = ISSUE_TAXONOMY[issue];
        expect(metadata?.severity).toBe('high');
      }
    });

    it('should have examples for all issues', () => {
      for (const metadata of Object.values(ISSUE_TAXONOMY)) {
        // All predefined issues should have before/after examples
        expect(metadata.exampleBefore).toBeTruthy();
        expect(metadata.exampleAfter).toBeTruthy();
      }
    });

    it('should have meaningful suggestions', () => {
      const vague = ISSUE_TAXONOMY['vague'];
      expect(vague?.suggestion).toContain('specific');

      const noContext = ISSUE_TAXONOMY['no-context'];
      expect(noContext?.suggestion).toContain('background');

      const tooBroad = ISSUE_TAXONOMY['too-broad'];
      expect(tooBroad?.suggestion).toContain('smaller');
    });

    it('should have clear before/after examples', () => {
      const vague = ISSUE_TAXONOMY['vague'];
      expect(vague?.exampleBefore).toBe('Help me with my code');
      expect(vague?.exampleAfter).toContain('calculateTotal()');

      // After examples should be more specific than before
      for (const metadata of Object.values(ISSUE_TAXONOMY)) {
        if (metadata.exampleBefore && metadata.exampleAfter) {
          expect(metadata.exampleAfter.length).toBeGreaterThan(
            metadata.exampleBefore.length,
          );
        }
      }
    });
  });

  describe('SYSTEM_PROMPT_MINIMAL', () => {
    it('should contain JSON schema definition', () => {
      expect(SYSTEM_PROMPT_MINIMAL).toContain('{"issues"');
      expect(SYSTEM_PROMPT_MINIMAL).toContain('"score"');
    });

    it('should list all valid issue IDs', () => {
      const validIssueIds = [
        'vague',
        'no-context',
        'too-broad',
        'no-goal',
        'imperative',
        'missing-technical-details',
        'unclear-priorities',
        'insufficient-constraints',
      ];

      for (const id of validIssueIds) {
        expect(SYSTEM_PROMPT_MINIMAL).toContain(id);
      }
    });

    it('should include examples', () => {
      expect(SYSTEM_PROMPT_MINIMAL).toContain('Examples:');
      expect(SYSTEM_PROMPT_MINIMAL).toContain('Input:');
      expect(SYSTEM_PROMPT_MINIMAL).toContain('Output:');
    });

    it('should specify score range', () => {
      expect(SYSTEM_PROMPT_MINIMAL).toContain('0-100');
    });

    it('should be concise for small models', () => {
      // Minimal prompt should be shorter than full prompt
      expect(SYSTEM_PROMPT_MINIMAL.length).toBeLessThan(
        SYSTEM_PROMPT_FULL.length,
      );
    });

    it('should instruct JSON-only response', () => {
      expect(SYSTEM_PROMPT_MINIMAL.toLowerCase()).toContain('json');
    });
  });

  describe('SYSTEM_PROMPT_SIMPLE', () => {
    it('should contain schema definition', () => {
      expect(SYSTEM_PROMPT_SIMPLE).toContain('schema');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('{"issues"');
    });

    it('should require issue objects with name, example, fix', () => {
      expect(SYSTEM_PROMPT_SIMPLE).toContain('"name"');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('"example"');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('"fix"');
    });

    it('should include analysis criteria and guidelines', () => {
      expect(SYSTEM_PROMPT_SIMPLE).toContain('Analysis criteria');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('Issue types to look for');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('Score guidelines');
    });

    it('should specify JSON-only output', () => {
      expect(SYSTEM_PROMPT_SIMPLE.toLowerCase()).toContain('only');
      expect(SYSTEM_PROMPT_SIMPLE.toLowerCase()).toContain('json');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('no other text');
    });
  });

  describe('SYSTEM_PROMPT_FULL', () => {
    it('should be different from simple (more detailed)', () => {
      // Full prompt should be more comprehensive than simple
      expect(SYSTEM_PROMPT_FULL).not.toBe(SYSTEM_PROMPT_SIMPLE);
      expect(SYSTEM_PROMPT_FULL.length).toBeGreaterThan(
        SYSTEM_PROMPT_SIMPLE.length,
      );
    });

    it('should contain full schema definition with patterns', () => {
      expect(SYSTEM_PROMPT_FULL).toContain('Schema:');
      expect(SYSTEM_PROMPT_FULL).toContain('patterns');
      expect(SYSTEM_PROMPT_FULL).toContain('stats');
      expect(SYSTEM_PROMPT_FULL).toContain('overallScore');
    });

    it('should include quality dimensions', () => {
      expect(SYSTEM_PROMPT_FULL).toContain('QUALITY DIMENSIONS');
      expect(SYSTEM_PROMPT_FULL).toContain('SPECIFICITY');
      expect(SYSTEM_PROMPT_FULL).toContain('CONTEXT PROVISION');
    });
  });

  describe('schema progression', () => {
    it('should have minimal schema simpler than full schema', () => {
      // Minimal should not require as many fields
      const minimalFields = SYSTEM_PROMPT_MINIMAL.match(/"[^"]+"/g) ?? [];
      const fullFields = SYSTEM_PROMPT_FULL.match(/"[^"]+"/g) ?? [];

      expect(minimalFields.length).toBeLessThan(fullFields.length);
    });

    it('should have consistent score range across all schemas', () => {
      expect(SYSTEM_PROMPT_MINIMAL).toContain('0-100');
      expect(SYSTEM_PROMPT_FULL).toContain('0-100');
    });

    it('should all emphasize JSON-only output', () => {
      const prompts = [
        SYSTEM_PROMPT_MINIMAL,
        SYSTEM_PROMPT_SIMPLE,
        SYSTEM_PROMPT_FULL,
      ];

      for (const prompt of prompts) {
        expect(prompt.toLowerCase()).toContain('json');
      }
    });
  });

  describe('applyRulesConfig', () => {
    it('should return base taxonomy when no rules provided', () => {
      const result = applyRulesConfig(undefined);
      expect(result).toEqual(ISSUE_TAXONOMY);
    });

    it('should return base taxonomy when empty rules object provided', () => {
      const result = applyRulesConfig({});
      expect(result).toEqual(ISSUE_TAXONOMY);
    });

    it('should filter out disabled rules', () => {
      const rules: RulesConfig = {
        'no-context': { enabled: false },
      };

      const result = applyRulesConfig(rules);

      expect(result['no-context']).toBeUndefined();
      expect(result['vague']).toBeDefined();
      expect(result['too-broad']).toBeDefined();
      expect(result['no-goal']).toBeDefined();
      expect(result['imperative']).toBeDefined();
    });

    it('should override severity for specific rules', () => {
      const rules: RulesConfig = {
        vague: { severity: 'low' },
        imperative: { severity: 'high' },
      };

      const result = applyRulesConfig(rules);

      expect(result['vague']?.severity).toBe('low');
      expect(result['imperative']?.severity).toBe('high');
      expect(result['no-context']?.severity).toBe('high'); // Unchanged
    });

    it('should handle both enabled:false and severity override', () => {
      const rules: RulesConfig = {
        'no-context': { enabled: false },
        vague: { severity: 'medium' },
        imperative: { enabled: true, severity: 'high' },
      };

      const result = applyRulesConfig(rules);

      expect(result['no-context']).toBeUndefined();
      expect(result['vague']?.severity).toBe('medium');
      expect(result['imperative']?.severity).toBe('high');
      expect(result['too-broad']).toBeDefined(); // Unchanged
    });

    it('should preserve all metadata fields when overriding severity', () => {
      const rules: RulesConfig = {
        vague: { severity: 'low' },
      };

      const result = applyRulesConfig(rules);
      const vague = result['vague'];

      expect(vague).toBeDefined();
      expect(vague?.name).toBe('Vague Request');
      expect(vague?.severity).toBe('low'); // Overridden
      expect(vague?.suggestion).toContain('specific');
      expect(vague?.exampleBefore).toBe('Help me with my code');
      expect(vague?.exampleAfter).toContain('calculateTotal()');
    });

    it('should handle enabled:true explicitly (no-op)', () => {
      const rules: RulesConfig = {
        vague: { enabled: true },
      };

      const result = applyRulesConfig(rules);

      expect(result['vague']).toBeDefined();
      expect(result['vague']).toEqual(ISSUE_TAXONOMY['vague']);
    });

    it('should handle multiple disabled rules', () => {
      const rules: RulesConfig = {
        vague: { enabled: false },
        'no-context': { enabled: false },
        'too-broad': { enabled: false },
      };

      const result = applyRulesConfig(rules);

      expect(result['vague']).toBeUndefined();
      expect(result['no-context']).toBeUndefined();
      expect(result['too-broad']).toBeUndefined();
      expect(result['no-goal']).toBeDefined();
      expect(result['imperative']).toBeDefined();
    });

    it('should work with custom base taxonomy', () => {
      const customTaxonomy = {
        custom: {
          name: 'Custom Issue',
          severity: 'medium' as const,
          suggestion: 'Custom suggestion',
        },
      };

      const rules: RulesConfig = {
        custom: { severity: 'high' },
      };

      const result = applyRulesConfig(rules, customTaxonomy);

      expect(result['custom']?.severity).toBe('high');
      expect(result['custom']?.name).toBe('Custom Issue');
    });
  });

  describe('getEnabledPatternIds', () => {
    it('should return all pattern IDs when no rules provided', () => {
      const result = getEnabledPatternIds(undefined);

      expect(result).toEqual([
        'vague',
        'no-context',
        'too-broad',
        'no-goal',
        'imperative',
        'missing-technical-details',
        'unclear-priorities',
        'insufficient-constraints',
      ]);
    });

    it('should return all pattern IDs when empty rules object provided', () => {
      const result = getEnabledPatternIds({});

      expect(result).toEqual([
        'vague',
        'no-context',
        'too-broad',
        'no-goal',
        'imperative',
        'missing-technical-details',
        'unclear-priorities',
        'insufficient-constraints',
      ]);
    });

    it('should exclude disabled patterns', () => {
      const rules: RulesConfig = {
        'no-context': { enabled: false },
      };

      const result = getEnabledPatternIds(rules);

      expect(result).toEqual([
        'vague',
        'too-broad',
        'no-goal',
        'imperative',
        'missing-technical-details',
        'unclear-priorities',
        'insufficient-constraints',
      ]);
      expect(result).not.toContain('no-context');
    });

    it('should include explicitly enabled patterns', () => {
      const rules: RulesConfig = {
        vague: { enabled: true },
      };

      const result = getEnabledPatternIds(rules);

      expect(result).toContain('vague');
      expect(result).toEqual([
        'vague',
        'no-context',
        'too-broad',
        'no-goal',
        'imperative',
        'missing-technical-details',
        'unclear-priorities',
        'insufficient-constraints',
      ]);
    });

    it('should handle multiple disabled patterns', () => {
      const rules: RulesConfig = {
        vague: { enabled: false },
        'no-context': { enabled: false },
        'too-broad': { enabled: false },
      };

      const result = getEnabledPatternIds(rules);

      expect(result).toEqual([
        'no-goal',
        'imperative',
        'missing-technical-details',
        'unclear-priorities',
        'insufficient-constraints',
      ]);
    });

    it('should ignore severity overrides for enabled check', () => {
      const rules: RulesConfig = {
        vague: { severity: 'low' },
        'no-context': { enabled: false },
      };

      const result = getEnabledPatternIds(rules);

      expect(result).toContain('vague'); // Has severity but not disabled
      expect(result).not.toContain('no-context'); // Explicitly disabled
    });

    it('should handle all patterns disabled', () => {
      const rules: RulesConfig = {
        vague: { enabled: false },
        'no-context': { enabled: false },
        'too-broad': { enabled: false },
        'no-goal': { enabled: false },
        imperative: { enabled: false },
        'missing-technical-details': { enabled: false },
        'unclear-priorities': { enabled: false },
        'insufficient-constraints': { enabled: false },
      };

      const result = getEnabledPatternIds(rules);

      expect(result).toEqual([]);
    });
  });
});
