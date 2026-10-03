const ESCAPES: Readonly<Record<string, string>> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
  '`': '&#96;',
};

/** Escapes text for both element content and quoted attribute values. */
export function esc(value: string | number | null | undefined): string {
  return String(value ?? '').replace(
    /[&<>"'`]/g,
    (char) => ESCAPES[char] ?? char,
  );
}

/** Non-finite numbers would print as NaN/Infinity and break SVG geometry. */
export function safeNumber(value: number): number {
  return Number.isFinite(value) ? value : 0;
}

export function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(safeNumber(value) * factor) / factor;
}
