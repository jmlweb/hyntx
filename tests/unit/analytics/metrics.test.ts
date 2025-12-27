/**
 * Unit tests for metrics module
 */

import { describe, expect, it } from 'vitest';

import {
  computeLexicalComplexity,
  computePromptSpecificity,
} from '../../../src/analytics/metrics.js';

describe('metrics', () => {
  describe('computePromptSpecificity', () => {
    it('should detect file paths', () => {
      const prompt =
        'Fix the bug in src/components/Login.tsx and update tests/login.test.ts';
      const score = computePromptSpecificity(prompt);

      expect(score.filePathCount).toBe(2);
      expect(score.overall).toBeGreaterThan(0);
    });

    it('should detect function references', () => {
      const prompt =
        'Update the handleLogin() function and add validateInput() method';
      const score = computePromptSpecificity(prompt);

      expect(score.functionMentions).toBeGreaterThan(0);
    });

    it('should detect error messages', () => {
      const prompt =
        'Fix the TypeError: Cannot read property of undefined error';
      const score = computePromptSpecificity(prompt);

      expect(score.hasErrorMessage).toBe(true);
    });

    it('should detect code snippets', () => {
      const prompt =
        'Add this code: `const result = await fetch(url)` to the handler';
      const score = computePromptSpecificity(prompt);

      expect(score.hasCodeSnippet).toBe(true);
    });

    it('should detect action verbs', () => {
      const prompt =
        'Fix the login bug, implement validation, and refactor the handler';
      const score = computePromptSpecificity(prompt);

      expect(score.actionVerbClarity).toBeGreaterThan(0);
    });

    it('should score specific prompts highly', () => {
      const specificPrompt = `
        Fix the null pointer exception in src/auth/login.ts at line 42.
        The error occurs in the validateUser() function.
        Add proper null checks before accessing user.email property.
      `;
      const score = computePromptSpecificity(specificPrompt);

      expect(score.overall).toBeGreaterThan(50);
      expect(score.filePathCount).toBeGreaterThan(0);
      expect(score.hasErrorMessage).toBe(true);
    });

    it('should score vague prompts lowly', () => {
      const vaguePrompt = 'Make it better and fix the issues';
      const score = computePromptSpecificity(vaguePrompt);

      expect(score.overall).toBeLessThan(30);
      expect(score.filePathCount).toBe(0);
      expect(score.hasErrorMessage).toBe(false);
    });

    it('should handle empty prompts', () => {
      const prompt = '';
      const score = computePromptSpecificity(prompt);

      expect(score.overall).toBe(0);
      expect(score.filePathCount).toBe(0);
      expect(score.functionMentions).toBe(0);
    });

    it('should count characters and words correctly', () => {
      const prompt = 'Fix the login bug in auth.ts';
      const score = computePromptSpecificity(prompt);

      expect(score.wordCount).toBe(6);
      expect(score.characterCount).toBe(prompt.length);
    });

    it('should detect multiple file extensions', () => {
      const prompt = 'Update index.js, styles.css, config.json, and README.md';
      const score = computePromptSpecificity(prompt);

      expect(score.filePathCount).toBeGreaterThan(2);
    });
  });

  describe('computeLexicalComplexity', () => {
    it('should compute unique word ratio', () => {
      const prompt = 'fix the bug fix the issue fix the problem';
      const metrics = computeLexicalComplexity(prompt);

      // Only 'fix', 'the', 'bug', 'issue', 'problem' are unique (5 out of 9 words)
      expect(metrics.uniqueWordRatio).toBeCloseTo(5 / 9, 2);
    });

    it('should compute average word length', () => {
      const prompt = 'a bb ccc dddd';
      const metrics = computeLexicalComplexity(prompt);

      // Average: (1 + 2 + 3 + 4) / 4 = 2.5
      expect(metrics.averageWordLength).toBe(2.5);
    });

    it('should detect technical terms', () => {
      const prompt =
        'Implement API endpoint with JWT authentication using Redis cache';
      const metrics = computeLexicalComplexity(prompt);

      expect(metrics.technicalTermDensity).toBeGreaterThan(0);
    });

    it('should handle empty prompts', () => {
      const prompt = '';
      const metrics = computeLexicalComplexity(prompt);

      expect(metrics.uniqueWordRatio).toBe(0);
      expect(metrics.averageWordLength).toBe(0);
      expect(metrics.technicalTermDensity).toBe(0);
    });

    it('should handle single word', () => {
      const prompt = 'refactor';
      const metrics = computeLexicalComplexity(prompt);

      expect(metrics.uniqueWordRatio).toBe(1);
      expect(metrics.averageWordLength).toBe(8);
    });

    it('should be case-insensitive for uniqueness', () => {
      const prompt = 'Fix the Fix THE fix';
      const metrics = computeLexicalComplexity(prompt);

      // 'fix' and 'the' are unique (2 out of 5 words)
      expect(metrics.uniqueWordRatio).toBeCloseTo(2 / 5, 2);
    });

    it('should handle prompts with high lexical diversity', () => {
      const prompt =
        'Implement comprehensive authentication system with advanced security features';
      const metrics = computeLexicalComplexity(prompt);

      expect(metrics.uniqueWordRatio).toBeGreaterThan(0.8);
      expect(metrics.averageWordLength).toBeGreaterThan(5);
    });

    it('should detect multiple technical terms', () => {
      const prompt = `
        Create a REST API endpoint with GraphQL support.
        Use JWT tokens for authentication and Redis for caching.
        Deploy to Kubernetes cluster with CI/CD pipeline.
      `;
      const metrics = computeLexicalComplexity(prompt);

      expect(metrics.technicalTermDensity).toBeGreaterThan(0.2);
    });
  });
});
