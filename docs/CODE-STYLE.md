# Code Style Guide

The rules that are enforced or expected in `src/`. [AGENTS.md](../AGENTS.md) has the short version; ESLint and Prettier enforce most of the mechanical parts.

## Functional approach

Favor functions over classes and build behaviour by composition.

```typescript
// ✅ Pure function: sessions in, episodes out
export function detectRework(session: Session): readonly Episode[] {
  // ...
}

// ❌ A class for stateless logic
class ReworkDetector {
  detect(session: Session): Episode[] {
    // ...
  }
}
```

Classes are used only for custom errors and the logger.

Keep IO at the edges. `cli.ts`, the session reader, history, permissions and the engines do IO. Metrics, detectors, insights, report building and renderers take data and return data, which is what makes them easy to test.

## Immutability

Do not mutate arguments or shared state. Types use `readonly` fields and `readonly T[]`.

```typescript
// ✅ New object
return {
  ...report,
  dataQuality: { ...report.dataQuality, notes: [...notes, note] },
};

// ❌ Mutation
report.dataQuality.notes.push(note);
```

The one exception is the streaming session reader, which mutates per-session accumulators because copying them per record would be quadratic. Such exceptions carry a comment that says why.

## TypeScript

- Strict mode. No `any`; use `unknown` at boundaries and narrow it.
- `type`, not `interface`.
- Const maps instead of enums:

```typescript
export const Severity = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
export type Severity = (typeof Severity)[keyof typeof Severity];
```

- Explicit return types on exported functions.
- Inline type imports: `import { type Report, Severity } from './types/index.js';`
- Shared types live in `src/types/index.ts`. A type used by one module stays in that module.
- Parsed JSON is `unknown` until checked. Log records are read field by field, defensively.

## Naming

| Kind                 | Convention                       | Example                          |
| -------------------- | -------------------------------- | -------------------------------- |
| Variables, functions | `camelCase`, verbs for functions | `detectFriction`, `readOnlyKeys` |
| Booleans             | auxiliary verb                   | `isError`, `hasEnoughData`       |
| Types                | `PascalCase`                     | `EpisodeContext`                 |
| Constants            | `UPPER_SNAKE_CASE`               | `REWORK_MIN_EDITS`               |
| Files and folders    | `kebab-case`                     | `session-reader.ts`              |

Thresholds are named, exported constants so tests and docs can refer to them.

## Modules

- Named exports only. No default exports.
- ESM: relative imports include the `.js` extension.
- Import order is enforced by `eslint-plugin-simple-import-sort`: Node built-ins, packages, then relative imports.
- Tests sit next to the code: `friction.ts` and `friction.test.ts`.

## Error handling

- Custom error classes that extend `Error`; never throw strings.
- Fail fast inside the pipeline. Be defensive at the boundaries: log parsing, file reads, engine calls.
- Errors are handled once, at the CLI level, where they become a message on stderr and an exit code (`0` ok, `1` error, `2` no data).
- Some failures are expected and are not errors: an unknown log record is counted and skipped, a missing history file means an empty history, an unavailable engine becomes a note in the report. Say so in a comment when a `catch` is intentionally quiet.

```typescript
try {
  return JSON.parse(await readFile(filePath, 'utf-8'));
} catch {
  // Missing or corrupt history is not fatal: it is rebuilt from the logs.
  return [];
}
```

## CLI output

- Report data goes to stdout. Everything else goes to stderr: spinner, logs, warnings, "written to" messages.
- `chalk` for color and `ora` for the spinner. These are the only UI dependencies.
- Use the logger (`src/utils/logger.ts`) for warnings and errors. No `console.log`.
- Renderers return strings and do not print.
- Colors are off when writing to a file.

## Privacy

- Anything placed in an `Episode`, an `Insight` or elsewhere in a `Report` is sanitized.
- Excerpts are truncated; reports carry short quotes, not whole prompts or outputs.
- HTML output escapes every report string; log text is untrusted input.

## Comments and documentation

- English.
- Comment the why, not the what. A file header that states the module's job and its constraints is welcome; restating the code is not.
- JSDoc on exported functions when the name and types do not already say it.

## Performance

- Logs can be large: stream them, do not load whole files.
- Chain array operations rather than building intermediate variables.
- Use `Map` and `Set` for lookups.
- Prefer early returns to nested conditionals.
