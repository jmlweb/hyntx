/**
 * Pure helpers for run-analyzer.mjs, kept apart so they can be unit tested.
 */

/** Only period and project filters are forwarded; output flags are ours. */
export const VALUE_FLAGS = new Set(['--days', '--from', '--to', '--project']);

const DATE_VALUE = /^(?:\d{4}-\d{2}-\d{2}|today|yesterday)$/;
/** Project names come from directory names; no shell or option syntax. */
const PROJECT_VALUE = /^[\p{L}\p{N}][\p{L}\p{N}._@+ /-]{0,99}$/u;

export class ArgumentError extends Error {}

function validateValue(flag, value) {
  switch (flag) {
    case '--days':
      if (!/^\d{1,4}$/.test(value) || Number(value) < 1) {
        throw new ArgumentError('--days needs a positive whole number.');
      }
      return value;
    case '--from':
    case '--to':
      if (!DATE_VALUE.test(value)) {
        throw new ArgumentError(
          `${flag} needs YYYY-MM-DD, "today" or "yesterday".`,
        );
      }
      return value;
    default:
      if (!PROJECT_VALUE.test(value)) {
        throw new ArgumentError(
          '--project may contain letters, digits, spaces and . _ @ + / - only, and must not start with a symbol.',
        );
      }
      return value;
  }
}

/** Returns analyzer arguments; throws ArgumentError on anything else. */
export function parseForwardedArgs(argv) {
  const forwarded = [];
  for (let i = 0; i < argv.length; i += 1) {
    const [flag, inlineValue] = argv[i].split(/=(.*)/s);
    if (!VALUE_FLAGS.has(flag)) {
      throw new ArgumentError(
        `Unsupported argument "${argv[i]}". Allowed: ${[...VALUE_FLAGS].join(', ')}.`,
      );
    }
    const value = inlineValue ?? argv[(i += 1)];
    if (value === undefined || value === '') {
      throw new ArgumentError(`${flag} needs a value.`);
    }
    forwarded.push(`${flag}=${validateValue(flag, value)}`);
  }
  return forwarded;
}

/**
 * Tells why an `npx hyntx@N` run failed, from its stderr. Exit code 2 means
 * "no logs or sessions" and is handled by the caller; anything else that is
 * not an npm problem is the analyzer's own error and is relayed as is.
 */
export function classifyNpxFailure(stderr) {
  if (
    /E404|ETARGET|notarget|No matching version|is not in this registry/i.test(
      stderr,
    )
  ) {
    return 'not-published';
  }
  if (
    /ENOTFOUND|EAI_AGAIN|ETIMEDOUT|ECONNREFUSED|ECONNRESET|network/i.test(
      stderr,
    )
  ) {
    return 'unreachable';
  }
  return 'analyzer-error';
}

/**
 * Drops the bulky series by name and keeps everything else, so fields added
 * to the report later still reach the reader.
 */
export function toDigest(report, via, maxInlineEpisodes = 60) {
  const { daily, metrics, episodes, ...rest } = report;
  const { byDay, byProject, sessions, ...metricsRest } = metrics ?? {};
  const allEpisodes = Array.isArray(episodes) ? episodes : [];
  const referenced = new Set(
    (Array.isArray(report.insights) ? report.insights : []).flatMap(
      (insight) => insight.episodeIds ?? [],
    ),
  );
  const inlineEpisodes =
    allEpisodes.length <= maxInlineEpisodes
      ? allEpisodes
      : allEpisodes.filter((episode) => referenced.has(episode.id));
  const omitted = [
    ...(daily ? ['daily'] : []),
    ...(byDay ? ['metrics.byDay'] : []),
    ...(byProject ? ['metrics.byProject'] : []),
    ...(sessions ? ['metrics.sessions'] : []),
    ...(inlineEpisodes.length < allEpisodes.length
      ? ['episodes not referenced by an insight']
      : []),
  ];
  return {
    digest: { analyzer: via, omitted, episodesTotal: allEpisodes.length },
    ...rest,
    metrics: metricsRest,
    episodes: inlineEpisodes,
  };
}
