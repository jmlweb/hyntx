/**
 * Hyntx - public library API.
 */

export { detectFriction } from './core/friction.js';
export {
  loadDailyHistory,
  mergeDaily,
  saveDailyHistory,
} from './core/history.js';
export { generateInsights } from './core/insights.js';
export { computeMetrics } from './core/metrics.js';
export { buildReport, sanitizeReport } from './core/report.js';
export { sanitize } from './core/sanitizer.js';
export { readSessions } from './core/session-reader.js';
export { interpretReport } from './engines/index.js';
export { renderHtml } from './report/html.js';
export { renderMarkdown } from './report/markdown.js';
export { renderTerminal } from './report/terminal.js';
export * from './types/index.js';
