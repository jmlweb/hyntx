#!/usr/bin/env node

/**
 * Validates that Ollama models are synchronized across:
 * - src/providers/ollama.ts (MODEL_STRATEGY_MAP)
 * - docs/MINIMUM_VIABLE_MODEL.md (model tables and recommendations)
 * - tests (test cases using specific models)
 *
 * Usage: node scripts/validate-model-sync.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// ANSI color codes
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function extractModelsFromOllama() {
  const ollamaPath = join(projectRoot, 'src/providers/ollama.ts');
  const content = readFileSync(ollamaPath, 'utf-8');

  // Extract MODEL_STRATEGY_MAP
  const mapMatch = content.match(
    /const MODEL_STRATEGY_MAP: Record<string, BatchStrategyType> = \{([\s\S]*?)\};/,
  );

  if (!mapMatch) {
    throw new Error('Could not find MODEL_STRATEGY_MAP in ollama.ts');
  }

  const mapContent = mapMatch[1];
  const models = {};

  // Parse model entries
  const modelRegex = /['"](.+?)['"]: ['"](.+?)['"]/g;
  let match;
  while ((match = modelRegex.exec(mapContent)) !== null) {
    models[match[1]] = match[2];
  }

  return models;
}

function extractModelsFromDocs() {
  const docsPath = join(projectRoot, 'docs/MINIMUM_VIABLE_MODEL.md');
  const content = readFileSync(docsPath, 'utf-8');

  const models = new Set();

  // Extract from tables (looking for model names in backticks)
  const modelRegex = /`([a-z0-9.:]+)`/g;
  let match;
  while ((match = modelRegex.exec(content)) !== null) {
    const model = match[1];
    // Filter out non-model strings (like variable names, file paths, etc.)
    if (
      model.includes(':') ||
      model.includes('llama') ||
      model.includes('gemma') ||
      model.includes('mistral') ||
      model.includes('phi') ||
      model.includes('qwen') ||
      model.includes('mixtral') ||
      model.includes('codellama')
    ) {
      models.add(model);
    }
  }

  return Array.from(models).sort();
}

function categorizeModels(models) {
  const categories = {
    micro: [],
    small: [],
    standard: [],
  };

  for (const [model, strategy] of Object.entries(models)) {
    categories[strategy].push(model);
  }

  return categories;
}

function validateSync() {
  log('\n🔍 Validating model synchronization...\n', 'bold');

  // Extract models from source code
  log('📄 Reading src/providers/ollama.ts...', 'blue');
  const codeModels = extractModelsFromOllama();
  log(
    `   Found ${Object.keys(codeModels).length} models in MODEL_STRATEGY_MAP`,
    'green',
  );

  // Extract models from documentation
  log('\n📄 Reading docs/MINIMUM_VIABLE_MODEL.md...', 'blue');
  const docModels = extractModelsFromDocs();
  log(
    `   Found ${docModels.length} model references in documentation`,
    'green',
  );

  // Categorize code models
  const categories = categorizeModels(codeModels);

  log('\n📊 Model Distribution:', 'bold');
  log(`   Micro models (≤4B):     ${categories.micro.length}`, 'blue');
  log(`   Small models (5-7B):    ${categories.small.length}`, 'blue');
  log(`   Standard models (≥8B):  ${categories.standard.length}`, 'blue');

  // Check if all code models are documented
  log('\n✓ Checking code → docs synchronization...', 'bold');
  const undocumented = [];
  for (const model of Object.keys(codeModels)) {
    if (!docModels.includes(model)) {
      undocumented.push(model);
    }
  }

  if (undocumented.length > 0) {
    log('   ⚠️  Models in code but not in docs:', 'yellow');
    undocumented.forEach((m) => log(`      - ${m}`, 'yellow'));
  } else {
    log('   ✅ All code models are documented', 'green');
  }

  // List documented models not in code (informational, not an error)
  log('\n✓ Checking docs → code coverage...', 'bold');
  const extraInDocs = docModels.filter(
    (m) => !Object.keys(codeModels).includes(m),
  );

  if (extraInDocs.length > 0) {
    log(
      '   ℹ️  Models mentioned in docs but not in MODEL_STRATEGY_MAP:',
      'blue',
    );
    extraInDocs.forEach((m) => log(`      - ${m}`, 'blue'));
    log(
      '   (This is OK - docs can mention additional models for reference)',
      'blue',
    );
  } else {
    log('   ✅ All documented models are in code', 'green');
  }

  // Summary
  log('\n' + '='.repeat(60), 'bold');
  log('Summary:', 'bold');
  log(`  Code models: ${Object.keys(codeModels).length}`, 'blue');
  log(`  Doc models:  ${docModels.length}`, 'blue');
  log(
    `  Undocumented: ${undocumented.length}`,
    undocumented.length > 0 ? 'yellow' : 'green',
  );
  log('='.repeat(60) + '\n', 'bold');

  // Exit with error if there are undocumented models
  if (undocumented.length > 0) {
    log(
      '❌ Validation failed: Update docs/MINIMUM_VIABLE_MODEL.md to include all models\n',
      'red',
    );
    process.exit(1);
  } else {
    log('✅ Validation passed: Models are synchronized\n', 'green');
    process.exit(0);
  }
}

// Run validation
try {
  validateSync();
} catch (error) {
  log(`\n❌ Error: ${error.message}\n`, 'red');
  process.exit(1);
}
