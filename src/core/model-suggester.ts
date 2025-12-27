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
 * 3. llama3.2 (default fallback)
 *
 * With less than 8GB RAM, always suggests llama3.2 for reliability.
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
  // With low RAM, always suggest llama3.2 for reliability
  if (systemInfo.ramGB < HIGH_RAM_THRESHOLD) {
    if (isModelAvailable('llama3.2', models)) {
      return {
        suggestedModel: 'llama3.2',
        reason: 'Fast and lightweight model, optimal for your system',
      };
    }
    return {
      suggestedModel: 'llama3.2',
      reason: 'Recommended default model (needs installation)',
    };
  }

  // With 8GB+ RAM, suggest better models if available
  // Priority: qwen2.5:14b > mistral:7b > llama3.2

  if (isModelAvailable('qwen2.5:14b', models)) {
    return {
      suggestedModel: 'qwen2.5:14b',
      reason: 'Best quality analysis with Full Schema',
    };
  }

  if (isModelAvailable('mistral:7b', models)) {
    return {
      suggestedModel: 'mistral:7b',
      reason: 'Better analysis quality with Small Schema',
    };
  }

  // Fallback to llama3.2
  if (isModelAvailable('llama3.2', models)) {
    return {
      suggestedModel: 'llama3.2',
      reason: 'Fast and reliable default model',
    };
  }

  return {
    suggestedModel: 'llama3.2',
    reason: 'Recommended default model (needs installation)',
  };
}

/**
 * Determines if we should suggest installing a better model.
 * Logic:
 * - 8GB+ RAM: suggest mistral:7b if not installed (and qwen2.5:14b not installed)
 * - 4-7GB RAM: suggest llama3.2 if not installed
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
        benefits: 'Better analysis quality with Small Schema',
        installCommand: 'ollama pull mistral:7b',
      };
    }

    return null; // Already has optimal model
  }

  // Low RAM (4-7GB): suggest llama3.2 if not installed
  const hasLlama = isModelAvailable('llama3.2', models);

  if (!hasLlama) {
    return {
      suggestedModel: 'llama3.2',
      benefits: 'Fast and lightweight model for your system',
      installCommand: 'ollama pull llama3.2',
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
