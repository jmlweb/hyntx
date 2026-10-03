# Testing

Vitest, with tests next to the code they cover: `src/**/*.test.ts`.

```bash
pnpm test             # run once
pnpm test:watch       # watch mode
pnpm test:coverage    # with coverage (text, html, lcov)
```

There is no separate end-to-end suite. CI builds the package and smoke-tests `dist/cli.js --help` and `--version`.

## What is tested where

| Area          | File                              | Approach                                                           |
| ------------- | --------------------------------- | ------------------------------------------------------------------ |
| Log parsing   | `src/core/session-reader.test.ts` | Synthetic JSONL written to a temp projects directory               |
| Metrics       | `src/core/metrics.test.ts`        | `Session` objects built in memory                                  |
| Detectors     | `src/core/friction.test.ts`       | Sessions with and without each kind of friction                    |
| Insights      | `src/core/insights.test.ts`       | Episodes in, insights and actions out; minimum-evidence thresholds |
| Report        | `src/core/report.test.ts`         | Data quality, history merge, sanitization of the final object      |
| Sanitizer     | `src/core/sanitizer.test.ts`      | One group per redaction type, plus false-positive cases            |
| Engines       | `src/engines/*.test.ts`           | Degradation to a note when an engine is missing or fails           |
| Renderers     | `src/report/*.test.ts`            | Output contains the findings; HTML escapes untrusted text          |
| CLI arguments | `src/cli-args.test.ts`            | Period resolution and validation                                   |
| Plugin runner | `src/plugin/run-analyzer.test.ts` | Argument validation, digest, temp-dir cleanup (with a fake CLI)    |

## Helpers

`src/core/test-helpers.ts` builds synthetic log records and `Session` objects (`userRecord`, `at(day, minutes)` for stable timestamps, and similar). Use them instead of hand-written JSON, and add a builder when a new record shape is needed. The file is test-only and must not be imported by production code.

## Rules

- **No real logs and no real home directory.** Tests point `HYNTX_CLAUDE_PROJECTS_DIR` and `HYNTX_HOME` (or the function's path argument) at a temp directory. Never commit excerpts of real sessions as fixtures.
- **No network and no real model.** Engine tests stub the subprocess or HTTP call.
- **Test both directions for detectors.** Each detector needs a case that fires and a near-miss that must not. False positives are the main risk in this codebase: "no problem, go ahead" is not a correction.
- **Test thresholds at the boundary**, using the exported constants rather than copied numbers.
- **Every new string field in the `Report` needs a sanitization test**, or an entry in the list of identifier keys in `report.ts` with a reason.
- **Parsing must stay tolerant.** When a new Claude Code record type appears, add a test that it is either understood or counted and skipped.
- **Timestamps** are built in local time through the helpers so tests pass in any time zone.

## Checking against real data

Synthetic tests cannot prove that findings are useful. Before a release, run the built CLI against your own logs and read the output critically:

```bash
pnpm build && node dist/cli.js --days 30 --no-llm
```

Look for findings you disagree with, text that should have been redacted, and `dataQuality.notes` about unknown record types.

Formats that so far exist only as synthetic fixtures, and should be confirmed the first time real logs contain them: interruption markers, user-rejected tool calls, permission-rule denials and compaction records. The interpretation engines cost money or time to run, so check them deliberately (`--engine claude`, `--engine ollama`) rather than in the test suite. Open verification gaps are listed in [TECHNICAL_DEBT.md](TECHNICAL_DEBT.md).
