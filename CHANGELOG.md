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
