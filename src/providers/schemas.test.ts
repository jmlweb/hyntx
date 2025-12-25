/**
 * Tests for schema definitions and issue taxonomy.
 */

import { describe, it, expect } from 'vitest';
import {
  ISSUE_TAXONOMY,
  SYSTEM_PROMPT_MINIMAL,
  SYSTEM_PROMPT_SIMPLE,
  SYSTEM_PROMPT_FULL,
  type IssueMetadata,
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
      expect(vague?.exampleAfter).toContain('TypeScript function');

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
      expect(SYSTEM_PROMPT_SIMPLE).toContain('Schema:');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('{"issues"');
    });

    it('should require issue objects with name, example, fix', () => {
      expect(SYSTEM_PROMPT_SIMPLE).toContain('"name"');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('"example"');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('"fix"');
    });

    it('should include rules section', () => {
      expect(SYSTEM_PROMPT_SIMPLE).toContain('Rules:');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('- issues:');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('- score:');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('- tip:');
    });

    it('should specify JSON-only output', () => {
      expect(SYSTEM_PROMPT_SIMPLE).toContain('ONLY JSON');
      expect(SYSTEM_PROMPT_SIMPLE).toContain('no other text');
    });
  });

  describe('SYSTEM_PROMPT_FULL', () => {
    it('should be same as simple for now', () => {
      // Current implementation uses same prompt for simple and full
      expect(SYSTEM_PROMPT_FULL).toBe(SYSTEM_PROMPT_SIMPLE);
    });

    it('should contain schema definition', () => {
      expect(SYSTEM_PROMPT_FULL).toContain('Schema:');
      expect(SYSTEM_PROMPT_FULL).toContain('issues');
      expect(SYSTEM_PROMPT_FULL).toContain('score');
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
});
