/**
 * Text helpers. Everything that ends up in a Report goes through `excerpt`,
 * which sanitizes before truncating so a secret is never cut into an
 * undetectable fragment.
 */

import { sanitize } from '../core/sanitizer.js';

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

export function excerpt(text: string, max = 200): string {
  const clean = collapseWhitespace(sanitize(text).text);
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed === '' ? 0 : trimmed.split(/\s+/).length;
}

export function stripDiacritics(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const STOPWORDS: ReadonlySet<string> = new Set(
  (
    'the a an and or but to of in on at for with from by is are was were be been it this that these those ' +
    'i you we me my your our us please can could would should will just also so then than as if do does did ' +
    'not no yes ok okay now there here what which who how why when where into out up down over all any some ' +
    'el la los las un una unos unas y o pero de del al en con por para es son fue ser lo le les se me te nos ' +
    'mi tu su sus que como si no ya muy mas menos esto eso esta este estos estas ese esa esos esas entonces ' +
    'puedes puede por favor tambien solo hay ha han he'
  ).split(' '),
);

/** Lowercased, accent-free content tokens used for near-duplicate detection. */
export function contentTokens(text: string): readonly string[] {
  return stripDiacritics(text.toLowerCase())
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t.length > 1 && !/^\d+$/.test(t) && !STOPWORDS.has(t));
}

export function jaccard(
  a: ReadonlySet<string>,
  b: ReadonlySet<string>,
): number {
  if (a.size === 0 || b.size === 0) {
    return 0;
  }
  const [small, large] = a.size <= b.size ? [a, b] : [b, a];
  let shared = 0;
  for (const token of small) {
    if (large.has(token)) {
      shared++;
    }
  }
  return shared / (a.size + b.size - shared);
}
