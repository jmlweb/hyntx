## [2.5.0](https://github.com/jmlweb/hyntx/compare/v2.4.0...v2.5.0) (2025-12-27)

### Features

- add NPM_TOKEN to release workflow ([c19e470](https://github.com/jmlweb/hyntx/commit/c19e4702eb1b1f800c5709ca1cbe306dbf185783))
- **analysis:** add configurable analysis mode with batch/individual options ([3548c24](https://github.com/jmlweb/hyntx/commit/3548c240b11d0935805c3e10010ab93c230092a3)), closes [#59](https://github.com/jmlweb/hyntx/issues/59)
- **cli:** add configurable analysis mode flag ([21e2033](https://github.com/jmlweb/hyntx/commit/21e2033c568e61414f78cc2d3bdceacc01cf1d6a)), closes [#59](https://github.com/jmlweb/hyntx/issues/59)
- don't trunctate examples ([69ff5ca](https://github.com/jmlweb/hyntx/commit/69ff5ca5e33a1f8bb6ab460e328587b7adef13de))
- **setup:** add smart model detection based on hardware and available models ([43a7083](https://github.com/jmlweb/hyntx/commit/43a70835906b77e0e3fa7d8ab1d1b4a7686a304d)), closes [#61](https://github.com/jmlweb/hyntx/issues/61)

### Bug Fixes

- **ci:** remove NPM_TOKEN for OIDC authentication ([dd92cc7](https://github.com/jmlweb/hyntx/commit/dd92cc796f4d9b1e819af63569d18d3a6e4dab45))
- **ci:** use NPM_TOKEN env var for semantic-release ([4f5a632](https://github.com/jmlweb/hyntx/commit/4f5a632f52ec009c83b99203f1d9515e2276e722))
- **ci:** use NPM_TOKEN for npm authentication ([e109ae6](https://github.com/jmlweb/hyntx/commit/e109ae60b293dc8a9248fd8f38296fb68399c845))
- **config:** ignore [skip ci] commits in commitlint ([901adc0](https://github.com/jmlweb/hyntx/commit/901adc0024c21eb3921590f83dcb1af5552dbcba))
- **core:** ensure all patterns have examples for consistent formatting ([a52ac9e](https://github.com/jmlweb/hyntx/commit/a52ac9e983beff27d3c0ff4dcbedf0c2fe1c060c))
- **release:** configure npm plugin with provenance support ([3d855d8](https://github.com/jmlweb/hyntx/commit/3d855d887326ad75861ce15f7924250b61c0b07c))

### Documentation

- add model requirements and validation tooling ([ef557ac](https://github.com/jmlweb/hyntx/commit/ef557ace43fdc978fb21068fc71078613c16dd67))
- enhance analysis mode and model documentation ([5809f2b](https://github.com/jmlweb/hyntx/commit/5809f2b6b1c1e6291b4424484627609b15d2cd24))

## [2.5.0](https://github.com/jmlweb/hyntx/compare/v2.4.0...v2.5.0) (2025-12-27)

### Features

- add NPM_TOKEN to release workflow ([c19e470](https://github.com/jmlweb/hyntx/commit/c19e4702eb1b1f800c5709ca1cbe306dbf185783))
- **analysis:** add configurable analysis mode with batch/individual options ([3548c24](https://github.com/jmlweb/hyntx/commit/3548c240b11d0935805c3e10010ab93c230092a3)), closes [#59](https://github.com/jmlweb/hyntx/issues/59)
- **cli:** add configurable analysis mode flag ([21e2033](https://github.com/jmlweb/hyntx/commit/21e2033c568e61414f78cc2d3bdceacc01cf1d6a)), closes [#59](https://github.com/jmlweb/hyntx/issues/59)
- don't trunctate examples ([69ff5ca](https://github.com/jmlweb/hyntx/commit/69ff5ca5e33a1f8bb6ab460e328587b7adef13de))
- **setup:** add smart model detection based on hardware and available models ([43a7083](https://github.com/jmlweb/hyntx/commit/43a70835906b77e0e3fa7d8ab1d1b4a7686a304d)), closes [#61](https://github.com/jmlweb/hyntx/issues/61)

### Bug Fixes

- **ci:** remove NPM_TOKEN for OIDC authentication ([dd92cc7](https://github.com/jmlweb/hyntx/commit/dd92cc796f4d9b1e819af63569d18d3a6e4dab45))
- **ci:** use NPM_TOKEN env var for semantic-release ([4f5a632](https://github.com/jmlweb/hyntx/commit/4f5a632f52ec009c83b99203f1d9515e2276e722))
- **ci:** use NPM_TOKEN for npm authentication ([e109ae6](https://github.com/jmlweb/hyntx/commit/e109ae60b293dc8a9248fd8f38296fb68399c845))
- **config:** ignore [skip ci] commits in commitlint ([901adc0](https://github.com/jmlweb/hyntx/commit/901adc0024c21eb3921590f83dcb1af5552dbcba))
- **core:** ensure all patterns have examples for consistent formatting ([a52ac9e](https://github.com/jmlweb/hyntx/commit/a52ac9e983beff27d3c0ff4dcbedf0c2fe1c060c))
- **release:** configure npm plugin with provenance support ([3d855d8](https://github.com/jmlweb/hyntx/commit/3d855d887326ad75861ce15f7924250b61c0b07c))

### Documentation

- add model requirements and validation tooling ([ef557ac](https://github.com/jmlweb/hyntx/commit/ef557ace43fdc978fb21068fc71078613c16dd67))
- enhance analysis mode and model documentation ([5809f2b](https://github.com/jmlweb/hyntx/commit/5809f2b6b1c1e6291b4424484627609b15d2cd24))

## [2.4.0](https://github.com/jmlweb/hyntx/compare/v2.3.0...v2.4.0) (2025-12-26)

### Features

- improve results ([443e978](https://github.com/jmlweb/hyntx/commit/443e97885d3c2228b35721819fd6e5aa6266626e))

### Bug Fixes

- detect existing config in shell file to prevent repeated setup ([e69902e](https://github.com/jmlweb/hyntx/commit/e69902e5a58e566306991b0262e4951a012181fb))
- update test expectations to match updated taxonomy and system prompts ([9903c4f](https://github.com/jmlweb/hyntx/commit/9903c4f09888289f40bb8ce9085a15a7c4ce96f1))

## [2.3.0](https://github.com/jmlweb/hyntx/compare/v2.2.1...v2.3.0) (2025-12-26)

### Features

- **cli:** integrate incremental results cache ([252d16b](https://github.com/jmlweb/hyntx/commit/252d16b4312e83a24264360b6cd442b189894b78))

## [2.2.1](https://github.com/jmlweb/hyntx/compare/v2.2.0...v2.2.1) (2025-12-26)

### Bug Fixes

- **ci:** add NPM_TOKEN to release workflow ([13ba589](https://github.com/jmlweb/hyntx/commit/13ba589a7b151cf62760fe73a0538bce8359575c))
- **package:** remove leading ./ from bin path ([bafccbd](https://github.com/jmlweb/hyntx/commit/bafccbd2ba7e3dfe85979d986509845cc1dcde52))

## [2.2.0](https://github.com/jmlweb/hyntx/compare/v2.1.0...v2.2.0) (2025-12-26)

### Features

- **core:** integrate incremental results cache in analyzer ([964d3d0](https://github.com/jmlweb/hyntx/commit/964d3d04dd8c43b64517610d98bd5a80b3ffd42a))

## [2.1.0](https://github.com/jmlweb/hyntx/compare/v2.0.1...v2.1.0) (2025-12-26)

### Features

- **core:** add incremental results storage module ([19728b4](https://github.com/jmlweb/hyntx/commit/19728b4c6650db8affce70b92733dccf45ca6b15)), closes [#49](https://github.com/jmlweb/hyntx/issues/49)
- **core:** add incremental results storage paths and design doc ([666a8af](https://github.com/jmlweb/hyntx/commit/666a8af95c45df266adac5f2e7be8e4dbaa1b7ec))
- **types:** add PromptResult and PromptResultMetadata types ([a672f4d](https://github.com/jmlweb/hyntx/commit/a672f4d66f90a826034ce2d70ea36d871a01d45c)), closes [#48](https://github.com/jmlweb/hyntx/issues/48)

## [2.0.1](https://github.com/jmlweb/hyntx/compare/v2.0.0...v2.0.1) (2025-12-26)

### Bug Fixes

- **core:** extract real examples from prompts instead of placeholders ([e2c41ee](https://github.com/jmlweb/hyntx/commit/e2c41ee1ef0854b98ac3e610df67b9f25e5e8444)), closes [#46](https://github.com/jmlweb/hyntx/issues/46)
- **core:** normalize overallScore from 0-100 to 0-10 scale ([be3041e](https://github.com/jmlweb/hyntx/commit/be3041ea8b98e4feb98ceeea7b9de173ac04e290)), closes [#45](https://github.com/jmlweb/hyntx/issues/45)

## [2.0.0](https://github.com/jmlweb/hyntx/compare/v1.5.0...v2.0.0) (2025-12-26)

### ⚠ BREAKING CHANGES

- All task/idea management now via GitHub Issues.
  Local file-based workflow no longer supported.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>

### Features

- Add commitlint ignore for specific refactors ([f7e7524](https://github.com/jmlweb/hyntx/commit/f7e7524c920f799eb224e15f95063571f301ffa2))
- **api:** create public ESM library API with zero CLI dependencies ([c498506](https://github.com/jmlweb/hyntx/commit/c498506667cc7be84e218c230c2a8c0d4c32ac4f)), closes [#38](https://github.com/jmlweb/hyntx/issues/38)
- **cache:** implement disk-based cache for analysis results ([f745cc6](https://github.com/jmlweb/hyntx/commit/f745cc65ba9f72623bc963b351d8886c68ab3681))
- **cli:** add --list-rules flag to display available analysis patterns ([ea40f6c](https://github.com/jmlweb/hyntx/commit/ea40f6cceac2f233d397b52050b5207506bc30b2))
- commitlint github actions ([0f2c81c](https://github.com/jmlweb/hyntx/commit/0f2c81c864bb10fe91079a6c5b9f8bd25bb15b7f))
- **config:** implement configurable analysis rules in .hyntxrc.json ([5163a79](https://github.com/jmlweb/hyntx/commit/5163a7958e67d90e3cc15b82d61e5d87c7233a75)), closes [#40](https://github.com/jmlweb/hyntx/issues/40)
- **mcp:** add three MCP tools for prompt analysis ([7af056b](https://github.com/jmlweb/hyntx/commit/7af056b6123b48c17bcd93f6142d7f63b67890bb))
- **mcp:** implement MCP server core with stdio transport ([6c9d720](https://github.com/jmlweb/hyntx/commit/6c9d72073fd89ac78bbbdb1ac664994ca1406ac4)), closes [#42](https://github.com/jmlweb/hyntx/issues/42)
- **ollama:** implement adaptive micro-batching for small models ([01b3e7c](https://github.com/jmlweb/hyntx/commit/01b3e7cfcea384d2d867294d58b7003066594450))
- **ollama:** implement progressive schema for small models ([bb7e5c2](https://github.com/jmlweb/hyntx/commit/bb7e5c26327e355cd08121329ea0fe40914771eb))
- **ollama:** improve compatibility with small local models ([368f927](https://github.com/jmlweb/hyntx/commit/368f92751b8c076b5b9e7ca00751190ba38c0547))

### Bug Fixes

- **ci:** add commitlint ignore for legacy commit ([d83d9ab](https://github.com/jmlweb/hyntx/commit/d83d9abff692712d6c1ff17c12e9764a8562020c))
- **tests:** correct e2e test imports and assertions ([901d463](https://github.com/jmlweb/hyntx/commit/901d463743e86e703025395660bde6599cefb39a))

### Documentation

- **mcp:** add comprehensive MCP integration documentation ([7f73108](https://github.com/jmlweb/hyntx/commit/7f731081ca69313a41284a3dfd615be25a07c29a)), closes [#44](https://github.com/jmlweb/hyntx/issues/44)
- **roadmap:** replace epic with subtasks in roadmap ([de80a0a](https://github.com/jmlweb/hyntx/commit/de80a0a804cfab8c47043689e933e7753f50e8f1))
- update documentation for watch mode and history features ([a7b098b](https://github.com/jmlweb/hyntx/commit/a7b098b92e9405fdba2297db18a047d4c1c14e0d))

### Code Refactoring

- Ensure backlog and ideas directories persist ([e0e4e8b](https://github.com/jmlweb/hyntx/commit/e0e4e8b9afdd531c8e4435d3626233ea136cfe12))

### Chores

- migrate task/idea management to GitHub Issues ([8972061](https://github.com/jmlweb/hyntx/commit/89720612610d62a58a520dc2edee8d477c5c2520))

## [1.5.0](https://github.com/jmlweb/hyntx/compare/v1.4.0...v1.5.0) (2025-12-25)

### Features

- **cli:** integrate watch mode for real-time prompt analysis ([19c7e2b](https://github.com/jmlweb/hyntx/commit/19c7e2b91892ca60f3ea312e56148f25776157aa))

## [1.4.0](https://github.com/jmlweb/hyntx/compare/v1.3.0...v1.4.0) (2025-12-25)

### Features

- **watcher:** implement watch mode file watcher for real-time prompt analysis ([3835d64](https://github.com/jmlweb/hyntx/commit/3835d64a3be8a47d844c4b135c7b9e668ab0ec3c))

## [1.3.0](https://github.com/jmlweb/hyntx/compare/v1.2.0...v1.3.0) (2025-12-25)

### Features

- **IDEA-015:** add watch mode for real-time prompt analysis ([aec2bc7](https://github.com/jmlweb/hyntx/commit/aec2bc739d5ede735a57e80e5bc39f2fcbad2839))

## [1.2.0](https://github.com/jmlweb/hyntx/compare/v1.1.0...v1.2.0) (2025-12-25)

### Features

- **cli:** add advanced filtering and output options ([e3623cd](https://github.com/jmlweb/hyntx/commit/e3623cd2cf7674268ce03082dd9c1b08d7848e06))
- **history:** implement analysis history and comparison features ([9488ca8](https://github.com/jmlweb/hyntx/commit/9488ca8db888c2b2614ffc05364fb2351d466ec2))
- **ideas:** add completed status and directory for implemented ideas ([ac41e81](https://github.com/jmlweb/hyntx/commit/ac41e811bc70216d11f38d0777ec2295c0639b88))

### Bug Fixes

- **error-handling:** complete error handling review and improvements ([42fa9df](https://github.com/jmlweb/hyntx/commit/42fa9df2e819fcd318a68818667c210ddbffd648))
- **lint:** resolve ESLint errors across source files ([8a78e6b](https://github.com/jmlweb/hyntx/commit/8a78e6b66923e2f4199ddb878f3985a5b0713a80))
- **security:** update vitest to resolve esbuild vulnerability ([9187039](https://github.com/jmlweb/hyntx/commit/9187039d0612edff156754bac9eb639a454da1b8))
- **test:** mock process.env.SHELL in shell-config tests ([247601e](https://github.com/jmlweb/hyntx/commit/247601eb4ea7a8aad32a21cfe18bb3942003ae3a))
- **test:** resolve E2E test failures in CLI tests ([23cbcc2](https://github.com/jmlweb/hyntx/commit/23cbcc2fa445d6a1844d5cba8922e2a1abb26767))
- tests ([b6abb0f](https://github.com/jmlweb/hyntx/commit/b6abb0fca02419a41fb4868b9315eafaf8474316))
- **tests:** resolve TypeScript errors in integration tests ([7c56cc5](https://github.com/jmlweb/hyntx/commit/7c56cc5494700826915c9d8aa9ead681b27f6d5f))

### Performance

- **log-reader:** parallelize file reading with concurrency limit ([859bd38](https://github.com/jmlweb/hyntx/commit/859bd38ca58ec1b730913533425c081e083a3f4d))

### Code Refactoring

- **core:** improve type safety in log reader ([f3a2c77](https://github.com/jmlweb/hyntx/commit/f3a2c77c1c41189a95106cc0bdd8f74628506823))
- **docs:** reorganize project documentation and implement new test structure ([fd29988](https://github.com/jmlweb/hyntx/commit/fd29988f3453ab5aec01cd4bfd3116b353750b95))
- **scripts:** reorganize test scripts and update documentation ([5560b96](https://github.com/jmlweb/hyntx/commit/5560b965ddeb12834d3074e378b4d99144451671))
- **shell-config:** simplify edge case handling with marker validation ([434aa18](https://github.com/jmlweb/hyntx/commit/434aa186be8b06f5028ef523afe3b62b145b22cf))

## [1.1.0](https://github.com/jmlweb/hyntx/compare/v1.0.0...v1.1.0) (2025-12-24)

### Features

- **cli:** add --check-config flag for configuration health checks ([88aeaef](https://github.com/jmlweb/hyntx/commit/88aeaef70bf098cf40bad2c9978ce6cf38e5898c))
- **cli:** add JSON output format with compact mode ([05e9fd8](https://github.com/jmlweb/hyntx/commit/05e9fd852648623f72648acbc16dafe44d4d8739))
- **cli:** add verbose/debug mode with --verbose flag ([a2b4bc0](https://github.com/jmlweb/hyntx/commit/a2b4bc0c058761f5c1c86de70ec34d803c7a96fc))
- **config:** add project-specific configuration file support ([df20058](https://github.com/jmlweb/hyntx/commit/df2005860bff93490f535e8f60c942b5cd4688f2))
- **core:** implement centralized logging system ([ac09452](https://github.com/jmlweb/hyntx/commit/ac0945220842cb6df38be35786178cb74bc2027f))
- **providers:** add centralized retry logic with exponential backoff ([9669ee1](https://github.com/jmlweb/hyntx/commit/9669ee16af1f7993f4773212ae329b4a05c723a3))
- **providers:** add rate limiting to prevent 429 errors ([fe0897e](https://github.com/jmlweb/hyntx/commit/fe0897e5495b79c25f433e8c9c2156e58987e7d3))
- **reporter:** add Markdown output format support ([208829e](https://github.com/jmlweb/hyntx/commit/208829e02f2fd8bbc893c16e1958e5135b1d2c3c))

### Documentation

- Add future plans for monorepo migration ([2811f09](https://github.com/jmlweb/hyntx/commit/2811f09f328a8aab60805a9695883db9da054f2d))

## 1.0.0 (2025-12-24)

### Features

- **cli:** integrate multi-provider factory with automatic fallback ([903fd4e](https://github.com/jmlweb/hyntx/commit/903fd4e8c475d8ef7ef486e9bceae17aa5ee1363))
- **core:** implement analyzer with map-reduce batching ([354cb46](https://github.com/jmlweb/hyntx/commit/354cb46274815f1f835edae8f2b9fedd36532ec8))
- **core:** implement basic CLI entry point ([f6124d1](https://github.com/jmlweb/hyntx/commit/f6124d1ed220a1e4ea8df6ea5af550cd9d07d442)), closes [#7](https://github.com/jmlweb/hyntx/issues/7)
- **core:** implement basic JSONL log reader ([a9addcc](https://github.com/jmlweb/hyntx/commit/a9addcc9e7787c8dc97dff3fe3fa47d38622c294))
- **core:** implement schema validator for log format resilience ([6681049](https://github.com/jmlweb/hyntx/commit/6681049bc86f93af5603ab6f26cc9d45fa07cc10))
- **core:** implement secret sanitizer with comprehensive PII detection ([d19e2d6](https://github.com/jmlweb/hyntx/commit/d19e2d6c04c31fe3ee484e620474d7d43c4b853b))
- **core:** implement terminal reporter with visual UI ([29f573e](https://github.com/jmlweb/hyntx/commit/29f573e30464e2bd8e20e098a6a8814dda759ba0))
- **lint:** add eslint rules to enforce code conventions ([f2ece55](https://github.com/jmlweb/hyntx/commit/f2ece55275b51f3933b8245bb1b3007a2fd6ff5c))
- **log-reader:** implement complete log reading with filters ([d7bef2e](https://github.com/jmlweb/hyntx/commit/d7bef2e85336f2e9759ab779ee8b61e5f850d085))
- **providers:** implement Anthropic provider (Claude API) ([3ca8e06](https://github.com/jmlweb/hyntx/commit/3ca8e0665b310fb410dfa3c680200213db4da073))
- **providers:** implement base provider and Ollama integration ([de5162b](https://github.com/jmlweb/hyntx/commit/de5162bf6d6c24c03400f99228dad4db79d2f4ee))
- **providers:** implement Google provider (Gemini API) ([4661a24](https://github.com/jmlweb/hyntx/commit/4661a24f590fb2df07c382235cee21e3f5afc1f5))
- **providers:** implement multi-provider factory with fallback ([5013628](https://github.com/jmlweb/hyntx/commit/5013628dd42a04f8013829d0a57150022163588d))
- **reminder:** implement periodic reminder system ([d765db9](https://github.com/jmlweb/hyntx/commit/d765db99b946d51b4c20973e0abaf7b105ea20db))
- **setup:** implement initial interactive setup ([6fa5d34](https://github.com/jmlweb/hyntx/commit/6fa5d3457928379c812e0b683a82da6e8f103268))
- **types:** implement TypeScript type system and project foundation ([a9d3faa](https://github.com/jmlweb/hyntx/commit/a9d3faa5274defa0d6a8f84ef0c3657232b3ee18))
- **utils:** implement environment config and path constants ([4f98371](https://github.com/jmlweb/hyntx/commit/4f98371de3d195ecbedd7541634d93fed048e0e5))

### Bug Fixes

- **test:** prevent mock pollution in shell-config tests ([0559343](https://github.com/jmlweb/hyntx/commit/05593439aa68ee822ac7d31219d00a7f6d511d9c))
- workflow ([19f189b](https://github.com/jmlweb/hyntx/commit/19f189b3475f51f17984d349c8b268188f05b225))

### Documentation

- add e2e task ([10277bf](https://github.com/jmlweb/hyntx/commit/10277bf699dc3b29fc4984fd552765c3766c8a37))
- add technical debt documentation and analyze-debt command ([0b86e19](https://github.com/jmlweb/hyntx/commit/0b86e1996af4eb62dbbf6ab76bfeb5bded029443))
- add three new tasks to roadmap ([2c46b17](https://github.com/jmlweb/hyntx/commit/2c46b17c465ecc600c0d68eb2b0765f37711327c))
- align Node.js version requirement to 22+ ([79d043d](https://github.com/jmlweb/hyntx/commit/79d043d1fa6aba0b936d3db0c993990d77fe7686))
- document dummy deployment ([9463bfa](https://github.com/jmlweb/hyntx/commit/9463bfafc782d032a55ca9e4bf4eedab6ef520aa))
- dummy deployment ([5217837](https://github.com/jmlweb/hyntx/commit/5217837f1dbf52059946764f1bb4d0f7a5d250a4))
- ideas ([df01d71](https://github.com/jmlweb/hyntx/commit/df01d718f30cbb4cec636dc7e72d74aeb99392d1))
- ideas management system ([8e67d59](https://github.com/jmlweb/hyntx/commit/8e67d59fa33fd4f63abafccf1a2c218a75c45193))
- **ideas:** add new ideas and fix markdown formatting ([c1306c2](https://github.com/jmlweb/hyntx/commit/c1306c2a470979a8c6ba4bf9e9a675cb4b8a62a8))
- improve backlog and docs ([d9db5c5](https://github.com/jmlweb/hyntx/commit/d9db5c5f7af959c27eb6141ce0b2ebac6a572552))
- improve docs and commands ([aca6b7c](https://github.com/jmlweb/hyntx/commit/aca6b7cc20c01e24f782699d002fe4cd5db0aa4e))
- optimize tasks management ([3ada5df](https://github.com/jmlweb/hyntx/commit/3ada5df6131943c11491fc65084f43b4cacff639))
- reprioritization ([2581a48](https://github.com/jmlweb/hyntx/commit/2581a481de8442b00440f84d1beb614cb983d59f))
- update specs and architecture for setup implementation ([e422226](https://github.com/jmlweb/hyntx/commit/e422226c671b5558a4b758a8153c25a4050e4e6d))

### Code Refactoring

- Improve PII redaction order and Chilean RUN regex ([7d6afec](https://github.com/jmlweb/hyntx/commit/7d6afec9b046f29437ae54cd7f85baa0c3ed9e18))
