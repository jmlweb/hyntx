---
id: RPT-020
title: Engine failure notes bypass sanitizeReport and leak OLLAMA_HOST credentials into the Report
type: security
severity: medium
status: triaged
created: 2026-11-28
triaged: 2026-11-28
task-id: TSK-020
---

## Summary

When an interpretation engine fails or is unavailable, `interpretReport` adds the error message to `dataQuality.notes` without running `sanitizeReport` again. The success branch does sanitize (`src/engines/index.ts:54`), the catch branch at `src/engines/index.ts:63-72` returns `withNote(report, ...)` on the raw message. This breaks the "Sanitized by contract" rule (AGENTS.md, docs/SPECS.md): every string in a `Report` must be redacted before it is rendered, written to `--output`/`--html`, or stored.

Sources of unredacted text that reach the note:

- `src/engines/ollama.ts:83`: the unreachable message embeds `${host}`, the resolved `OLLAMA_HOST`, and the `fetch` error, which repeats the full URL.
- `src/engines/ollama.ts:95`: up to 200 characters of the remote HTTP body.
- `src/engines/claude.ts:110`: up to 200 characters of the claude CLI's stderr or stdout.

Related: `fetch` refuses any URL with userinfo ("Request cannot be constructed from a URL that includes credentials"), so a credentialed `OLLAMA_HOST` can never work. The stderr notice from `describeDataDestination` (`src/engines/disclosure.ts`) also prints the host with its credentials.

## Reproduction

A one-off vitest file in `src/engines/` (removed afterwards):

```ts
process.env['OLLAMA_HOST'] = 'http://admin:hunter2secret@127.0.0.1:1';
const r = await interpretReport(fixtureReport(), { engine: InterpretationEngine.OLLAMA });
console.log('RAW:', r.dataQuality.notes.at(-1));
console.log('SANITIZED:', sanitizeReport(r).dataQuality.notes.at(-1));
```

Observed output:

```text
RAW: Interpretation skipped (ollama): Ollama is not reachable at http://admin:hunter2secret@127.0.0.1:1 (Request cannot be constructed from a URL that includes credentials: http://admin:hunter2secret@127.0.0.1:1/api/chat). Start it with `ollama serve`, set OLLAMA_HOST, use --engine claude, or pass --no-llm.
SANITIZED: Interpretation skipped (ollama): Ollama is not reachable at http://[REDACTED_URL_CREDENTIAL]@127.0.0.1:1 (Request cannot be constructed from a URL that includes credentials: [REDACTED_SECRET]). Start it with `ollama serve`, set OLLAMA_HOST, use --engine claude, or pass --no-llm.
```

The CLI renders the RAW report (`src/cli.ts`). So `hyntx --engine ollama --format json --output report.json` with such a host writes the password into a file that the user may share.

## Suggested fix

Run the catch-branch result through `sanitizeReport` (or sanitize the note) in `src/engines/index.ts`. Strip userinfo from the host shown in engine messages and in the stderr notice. Add a test with a credentialed `OLLAMA_HOST` in `src/engines/index.test.ts`.
