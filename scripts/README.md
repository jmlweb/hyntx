# Scripts

Utility scripts for development and validation.

## validate-model-sync.mjs

Validates synchronization between Ollama models defined in code and documentation.

**What it checks**:

- All models in `src/providers/ollama.ts` (MODEL_STRATEGY_MAP) are documented in `docs/MINIMUM_VIABLE_MODEL.md`
- Model distribution across categories (micro/small/standard)
- Reports any undocumented models

**Usage**:

```bash
pnpm validate:models
```

**When to run**:

- Before adding a new model to MODEL_STRATEGY_MAP
- Before updating MINIMUM_VIABLE_MODEL.md
- As part of CI/CD pipeline
- When documentation seems out of sync with code

**Exit codes**:

- `0`: All models are synchronized
- `1`: Validation failed (undocumented models found)

**Example output**:

```text
🔍 Validating model synchronization...

📄 Reading src/providers/ollama.ts...
   Found 9 models in MODEL_STRATEGY_MAP

📄 Reading docs/MINIMUM_VIABLE_MODEL.md...
   Found 10 model references in documentation

📊 Model Distribution:
   Micro models (≤4B):     4
   Small models (5-7B):    3
   Standard models (≥8B):  2

✓ Checking code → docs synchronization...
   ✅ All code models are documented

✅ Validation passed: Models are synchronized
```
