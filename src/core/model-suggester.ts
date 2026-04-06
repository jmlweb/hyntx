import chalk from 'chalk';

import {
  isModelAvailable,
  type OllamaModelInfo,
  type SystemInfo,
} from '../utils/system-detection.js';

/**
 * Model recommendation result.
 */
export type ModelRecommendation = {
  suggestedModel: string;
  reason: string;
};

/**
 * Installation suggestion for a better model.
 */
export type InstallationSuggestion = {
  suggestedModel: string;
  benefits: string;
  installCommand: string;
};

/**
 * RAM threshold for suggesting better models (8GB).
 */
const HIGH_RAM_THRESHOLD = 8;

/**
 * RAM threshold for basic model recommendations (4GB).
 */
const LOW_RAM_THRESHOLD = 4;

/**
 * Suggests the best available model based on system info and available models.
 * Priority order (with 8GB+ RAM):
 * 1. qwen2.5:14b if available
 * 2. mistral:7b if available
 * 3. gemma4:e4b (default fallback)
 *
 * With less than 8GB RAM, always suggests gemma4:e4b for reliability.
 *
 * @param systemInfo - System hardware information
 * @param models - List of available Ollama models
 * @returns Model recommendation with reason
 *
 * @example
 * ```typescript
 * const systemInfo = detectSystemInfo();
 * const models = await getAvailableOllamaModels('http://localhost:11434');
 * const recommendation = suggestBestModel(systemInfo, models.models);
 * console.log(`Suggested: ${recommendation.suggestedModel}`);
 * ```
 */
export function suggestBestModel(
  systemInfo: SystemInfo,
  models: OllamaModelInfo[],
): ModelRecommendation {
  // With low RAM, suggest gemma4:e4b for reliability
  if (systemInfo.ramGB < HIGH_RAM_THRESHOLD) {
    if (isModelAvailable('gemma4:e4b', models)) {
      return {
        suggestedModel: 'gemma4:e4b',
        reason: 'Fast model with 128K context and native function calling',
      };
    }
    return {
      suggestedModel: 'gemma4:e4b',
      reason: 'Recommended default model (needs installation)',
    };
  }

  // With 8GB+ RAM, suggest better models if available
  // Priority: qwen2.5:14b > mistral:7b > gemma4:e4b

  if (isModelAvailable('qwen2.5:14b', models)) {
    return {
      suggestedModel: 'qwen2.5:14b',
      reason: 'Best quality analysis with Full Schema',
    };
  }

  if (isModelAvailable('mistral:7b', models)) {
    return {
      suggestedModel: 'mistral:7b',
      reason: 'Good analysis quality with Full Schema',
    };
  }

  // Fallback to gemma4:e4b
  if (isModelAvailable('gemma4:e4b', models)) {
    return {
      suggestedModel: 'gemma4:e4b',
      reason: 'Fast and reliable default model with 128K context',
    };
  }

  return {
    suggestedModel: 'gemma4:e4b',
    reason: 'Recommended default model (needs installation)',
  };
}

/**
 * Determines if we should suggest installing a better model.
 * Logic:
 * - 8GB+ RAM: suggest mistral:7b if not installed (and qwen2.5:14b not installed)
 * - 4-7GB RAM: suggest gemma4:e4b if not installed
 * - < 4GB RAM: no suggestion (insufficient resources)
 *
 * @param systemInfo - System hardware information
 * @param models - List of available Ollama models
 * @returns Installation suggestion or null if no suggestion needed
 *
 * @example
 * ```typescript
 * const suggestion = getInstallationSuggestion(systemInfo, models);
 * if (suggestion) {
 *   displayInstallationSuggestion(suggestion);
 * }
 * ```
 */
export function getInstallationSuggestion(
  systemInfo: SystemInfo,
  models: OllamaModelInfo[],
): InstallationSuggestion | null {
  // Don't suggest if RAM is too low
  if (systemInfo.ramGB < LOW_RAM_THRESHOLD) {
    return null;
  }

  // High RAM: suggest mistral:7b if neither mistral nor qwen installed
  if (systemInfo.ramGB >= HIGH_RAM_THRESHOLD) {
    const hasMistral = isModelAvailable('mistral:7b', models);
    const hasQwen = isModelAvailable('qwen2.5:14b', models);

    if (!hasMistral && !hasQwen) {
      return {
        suggestedModel: 'mistral:7b',
        benefits: 'Better analysis quality with Full Schema',
        installCommand: 'ollama pull mistral:7b',
      };
    }

    return null; // Already has optimal model
  }

  // Low RAM (4-7GB): suggest gemma4:e4b if not installed
  const hasDefault = isModelAvailable('gemma4:e4b', models);

  if (!hasDefault) {
    return {
      suggestedModel: 'gemma4:e4b',
      benefits: '128K context and native function calling',
      installCommand: 'ollama pull gemma4:e4b',
    };
  }

  return null; // Already has optimal model for RAM tier
}

/**
 * Displays a formatted installation suggestion to the user.
 * Creates a friendly box with the suggestion, benefits, and installation command.
 *
 * @param suggestion - Installation suggestion to display
 *
 * @example
 * ```typescript
 * const suggestion = getInstallationSuggestion(systemInfo, models);
 * if (suggestion) {
 *   displayInstallationSuggestion(suggestion);
 * }
 * ```
 */
export function displayInstallationSuggestion(
  suggestion: InstallationSuggestion,
): void {
  const boxTop = chalk.cyan(
    '╭─────────────────────────────────────────────────────────────╮',
  );
  const boxBottom = chalk.cyan(
    '╰─────────────────────────────────────────────────────────────╯',
  );
  const line = (text: string): string =>
    chalk.cyan('│') + ' ' + text.padEnd(59) + ' ' + chalk.cyan('│');

  console.log('');
  console.log(boxTop);
  console.log(line(chalk.bold('💡 Recommendation')));
  console.log(line(''));
  console.log(
    line('Your system can handle better models for improved quality.'),
  );
  console.log(line(''));
  console.log(line(chalk.bold(`Suggested: ${suggestion.suggestedModel}`)));
  console.log(line(`Benefits: ${suggestion.benefits}`));
  console.log(line(''));
  console.log(line(chalk.bold(`To install: ${suggestion.installCommand}`)));
  console.log(line(''));
  console.log(line('(You can install it later and update HYNTX_OLLAMA_MODEL)'));
  console.log(boxBottom);
  console.log('');
}
