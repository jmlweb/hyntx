/**
 * HTML report renderer. Stub: phase 2 implements the real report.
 */

import { type Report } from '../types/index.js';

export function renderHtml(report: Report): string {
  const title = `Hyntx report ${report.period.from} - ${report.period.to}`;
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>${title}</title></head>
<body><p>The HTML report is not available yet. Use --format json or markdown.</p></body>
</html>
`;
}
