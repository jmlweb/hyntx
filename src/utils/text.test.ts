import { describe, expect, it } from 'vitest';

import {
  contentTokens,
  excerpt,
  jaccard,
  stripControlChars,
  wordCount,
} from './text.js';

describe('excerpt', () => {
  it('sanitizes before truncating so secrets are never cut into fragments', () => {
    const secret = `sk-${'a1B2c3D4'.repeat(6)}`;
    const result = excerpt(`use ${secret} now`, 20);
    expect(result).not.toContain('sk-');
    expect(result.length).toBeLessThanOrEqual(20);
  });

  it('collapses whitespace and adds an ellipsis when truncated', () => {
    expect(excerpt('a\n\n  b   c')).toBe('a b c');
    expect(excerpt('x'.repeat(50), 10)).toBe(`${'x'.repeat(9)}…`);
  });
});

describe('contentTokens / jaccard', () => {
  it('drops stopwords, accents and numbers in English and Spanish', () => {
    expect(
      contentTokens('Please run the TESTS, and fix #123 lint errors'),
    ).toEqual(['run', 'tests', 'fix', 'lint', 'errors']);
    expect(
      contentTokens('Por favor, ejecuta los tests y arregla el lint'),
    ).toEqual(['ejecuta', 'tests', 'arregla', 'lint']);
  });

  it('computes set similarity', () => {
    expect(jaccard(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1);
    expect(jaccard(new Set(['a', 'b']), new Set(['b', 'c']))).toBeCloseTo(
      1 / 3,
    );
    expect(jaccard(new Set(), new Set(['a']))).toBe(0);
  });

  it('counts words', () => {
    expect(wordCount('  one two\nthree ')).toBe(3);
    expect(wordCount('')).toBe(0);
  });
});

describe('stripControlChars', () => {
  it('removes ANSI, OSC and other control sequences', () => {
    const esc = String.fromCharCode(27);
    const bel = String.fromCharCode(7);
    const raw = `${esc}[31mred${esc}[0m ${esc}]0;evil title${bel}ok ${esc}]8;;http://x${esc}\\link${esc}[2J${String.fromCharCode(0)}end`;
    expect(stripControlChars(raw)).toBe('red ok link' + 'end');
    expect(excerpt(raw)).not.toContain(esc);
  });

  it('keeps newlines and tabs and strips bidi overrides', () => {
    expect(stripControlChars('a\n\tb\u202ec')).toBe('a\n\tbc');
  });
});
