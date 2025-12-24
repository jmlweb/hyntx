# Fix Node Version Documentation Inconsistency

## Metadata

- **Priority**: P0
- **Phase**: 1
- **Dependencies**: none
- **Estimation**: 15 minutes

## Description

Fix inconsistency between documentation and package.json regarding Node.js version requirement. Currently:

- `docs/SPECS.md` says: "Node.js >= 18"
- `package.json` says: `"node": ">=22.0.0"`

The codebase doesn't use Node 22-specific APIs - all features used (`parseArgs`, native `fetch`, ESM) are available in Node 18+.

## Objective

Align documentation with package.json OR lower the requirement to broaden compatibility.

## Options

### Option A: Lower to Node 20+ (Recommended)

- Broadens user base (Node 20 is current active LTS)
- No code changes required (no Node 22-specific APIs used)
- Update: `package.json`, `.nvmrc`, all docs

### Option B: Keep Node 22+ and Update Docs

- Maintain current requirement
- Update `docs/SPECS.md` to say "Node 22+"
- Add justification (e.g., "for Corepack bundled by default")

## Scope

- Includes: Updating version requirement documentation
- Includes: Updating `.nvmrc` if lowering requirement
- Excludes: Code changes

## Files to Create/Modify

- `package.json` - Update engines.node (if Option A)
- `.nvmrc` - Update version (if Option A)
- `docs/SPECS.md` - Update Node version reference
- `README.md` - Check for version mentions

## Implementation (Option A - Recommended)

### 1. Update package.json

```json
"engines": {
  "node": ">=20.0.0"
}
```

### 2. Update .nvmrc

```text
20
```

### 3. Update docs/SPECS.md

Change "Node.js >= 18" to "Node.js >= 20" for consistency.

### 4. Verify

```bash
pnpm check && pnpm build && pnpm test:run
```

## Acceptance Criteria

- [ ] All documentation references same Node version
- [ ] package.json engines.node matches documentation
- [ ] .nvmrc matches chosen version
- [ ] Build and tests pass

## References

- Technical Validation Report (December 2024)
- Node.js release schedule: https://nodejs.org/en/about/releases/
