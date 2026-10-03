/**
 * Text helpers. Everything that ends up in a Report goes through `excerpt`,
 * which sanitizes before truncating so a secret is never cut into an
 * undetectable fragment.
 */

import { sanitize } from '../core/sanitizer.js';

// Built from strings so the control characters stay out of regex literals.
const ESCAPE_SEQUENCES = new RegExp(
  [
    // CSI: ESC [ params intermediates final (also the 8-bit form, 0x9b)
    '(?:\\u001b\\[|\\u009b)[0-?]*[ -/]*[@-~]',
    // OSC / DCS / SOS / PM / APC strings, up to BEL or ST
    '\\u001b[\\]PX^_][^\\u0007\\u001b]*(?:\\u0007|\\u001b\\\\)?',
    // Two-character escapes
    '\\u001b[@-Z\\\\-_]',
  ].join('|'),
  'g',
);
const CONTROL_CHARS = new RegExp(
  '[\\u0000-\\u0008\\u000b-\\u001f\\u007f-\\u009f\\u200e\\u200f\\u202a-\\u202e\\u2066-\\u2069]',
  'g',
);

/**
 * Removes terminal escape sequences and control characters (keeping newline
 * and tab) so text from tool output cannot drive the user's terminal.
 */
export function stripControlChars(text: string): string {
  return text.replace(ESCAPE_SEQUENCES, '').replace(CONTROL_CHARS, '');
}

export function collapseWhitespace(text: string): string {
  return stripControlChars(text).replace(/\s+/g, ' ').trim();
}

export function excerpt(text: string, max = 200): string {
  const clean = collapseWhitespace(sanitize(stripControlChars(text)).text);
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

const ATTACHMENT_PLACEHOLDERS =
  /\[(?:Image|Pasted text|Pasted image|Image source)[^\]]*\]/gi;

/** False for turns made only of `[Image #3]` or `[Pasted text #1 +20 lines]`. */
export function hasTypedContent(text: string): boolean {
  return text.replace(ATTACHMENT_PLACEHOLDERS, '').trim() !== '';
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

/** "1 session", "3 sessions". */
export function plural(count: number, one: string, many = `${one}s`): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}
