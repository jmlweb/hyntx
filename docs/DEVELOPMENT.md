# Development

## Requirements

- Node.js 22 or later (`.nvmrc`)
- pnpm 9 (`packageManager` in `package.json`)
- Claude Code, to test the plugin and the default interpretation engine
- Ollama, only to test `--engine ollama`

## Setup

```bash
git clone https://github.com/jmlweb/hyntx.git
cd hyntx
pnpm install
pnpm build
node dist/cli.js --days 30 --no-llm
```

## Scripts

| Script               | Purpose                                 |
| -------------------- | --------------------------------------- |
| `pnpm dev`           | Build in watch mode                     |
| `pnpm build`         | Production build with tsup into `dist/` |
| `pnpm start`         | Run `dist/cli.js`                       |
| `pnpm typecheck`     | `tsc --noEmit`                          |
| `pnpm lint`          | ESLint on `src/`                        |
| `pnpm format`        | Prettier, write                         |
| `pnpm format:check`  | Prettier, check                         |
| `pnpm check`         | typecheck + lint + format check         |
| `pnpm test`          | Vitest                                  |
| `pnpm test:coverage` | Vitest with coverage                    |

Before committing: `pnpm check && pnpm test && pnpm build`.

## Tooling

- **TypeScript**: strict, ESM, `tsconfig.json` extends `@jmlweb/tsconfig-base`. Imports need the `.js` extension.
- **Build**: tsup (`tsup.config.ts`), two entries: `src/cli.ts` (the `hyntx` binary, with shebang) and `src/index.ts` (the library). `chalk` and `ora` are the only runtime dependencies and stay external.
- **Lint and format**: ESLint (`@jmlweb/eslint-config-base`) on `src/`, Prettier everywhere else too, including Markdown and the plugin files.
- **Tests**: Vitest, colocated `*.test.ts`. See [TESTING.md](TESTING.md).
- **Commits**: Conventional Commits, enforced by commitlint through Husky; lint-staged formats staged files.
- **Releases**: semantic-release on `main`. See [RELEASE.md](RELEASE.md).

## Layout

```text
src/
  cli.ts, cli-args.ts     CLI entry and argument helpers
  index.ts                library API
  types/index.ts          session model and Report contract
  core/                   session reader, metrics, friction, insights, report, sanitizer, history
  engines/                optional interpretation: claude, ollama
  report/                 terminal, markdown and HTML renderers
  utils/                  paths, dates, text, logger
.claude-plugin/           plugin and marketplace manifests
skills/hyntx/             the /hyntx:hyntx skill and its analyzer runner
docs/                     these documents
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for how the pieces fit.

## Working on the analyzer

Useful while changing detectors or insights:

```bash
node dist/cli.js --days 60 --no-llm                      # read the findings
node dist/cli.js --days 60 --no-llm --format json | jq '.episodes[] | {type, summary, confidence}'
node dist/cli.js --days 60 --no-llm --verbose            # reader statistics on stderr
```

To run against other logs or keep your own `~/.hyntx/` untouched:

```bash
HYNTX_CLAUDE_PROJECTS_DIR=/path/to/projects HYNTX_HOME=/tmp/hyntx-dev node dist/cli.js --no-llm
```

## Testing the plugin locally

The plugin is `.claude-plugin/` plus `skills/hyntx/`. The skill runs an analyzer through `skills/hyntx/scripts/run-analyzer.mjs`, which looks for one in this order:

1. `HYNTX_CLI`, a path to a `dist/cli.js`
2. `dist/cli.js` of the checkout that contains the skill
3. a global `hyntx` whose version is 4 or later
4. `npx hyntx@4`

Inside a built checkout, step 2 always wins, so the plugin runs the code you are working on whatever is published on npm.

```bash
pnpm install && pnpm build

# 1. Validate the manifests and the skill
claude plugin validate .            # marketplace.json and plugin.json
claude plugin validate ./skills     # SKILL.md frontmatter

# 2. Check the runner on its own
node skills/hyntx/scripts/run-analyzer.mjs --days 30 | head -40

# 3. Load the plugin for one session, without installing it
claude --plugin-dir .
```

In that session, run `/hyntx:hyntx` or `/hyntx:hyntx 60d my-project`. After editing `SKILL.md`, run `/reload-plugins`. `claude --plugin-dir . plugin details hyntx` shows what was loaded.

`claude plugin validate .` reports one warning, that `plugin.json` has no `version`. That is deliberate: without a version, every commit counts as an update. A version would pin installed copies until it is bumped, and the release automation does not write to `plugin.json`.

To test the install path that users take, add the checkout as a marketplace:

```bash
claude plugin marketplace add /absolute/path/to/hyntx
claude plugin install hyntx@hyntx
# afterwards
claude plugin marketplace remove hyntx
```

A marketplace added from a local directory is read in place, so the checkout's `dist/` is still used. Installed from GitHub, the plugin is copied without `dist/` (it is not committed) and the runner falls through to a global `hyntx` or `npx hyntx@4`. Until version 4 is on npm, that path ends with exit code 3 and a message explaining how to point `HYNTX_CLI` at a build.

When the `Report` shape changes, update the "What you get back" section of `skills/hyntx/SKILL.md` and, if a new bulky series was added, the digest in `run-analyzer.mjs`.
