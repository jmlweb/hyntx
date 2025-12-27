import * as os from 'node:os';

/**
 * System information including hardware resources.
 */
export type SystemInfo = {
  ramGB: number;
};

/**
 * Information about an Ollama model.
 */
export type OllamaModelInfo = {
  name: string;
  size: number;
};

/**
 * Result from querying Ollama for available models.
 */
export type OllamaModelsResult = {
  success: boolean;
  models: OllamaModelInfo[];
};

/**
 * Timeout for Ollama API queries (3 seconds).
 */
const OLLAMA_TIMEOUT_MS = 3000;

/**
 * Detects system hardware information.
 * Currently detects available RAM rounded to whole GB.
 *
 * @returns System information object
 *
 * @example
 * ```typescript
 * const info = detectSystemInfo();
 * console.log(`System has ${info.ramGB}GB RAM`);
 * ```
 */
export function detectSystemInfo(): SystemInfo {
  const totalMemBytes = os.totalmem();
  const ramGB = Math.round(totalMemBytes / (1024 * 1024 * 1024));

  return { ramGB };
}

/**
 * Type guard to check if a value is a valid model object.
 */
function isValidModel(model: unknown): model is { name: string; size: number } {
  return (
    !!model &&
    typeof model === 'object' &&
    'name' in model &&
    'size' in model &&
    typeof model.name === 'string' &&
    typeof model.size === 'number' &&
    model.name.trim() !== '' &&
    model.size >= 0
  );
}

/**
 * Queries Ollama API to get list of available models.
 * Uses a 3-second timeout to avoid blocking.
 * Fails gracefully by returning empty models list on any error.
 *
 * @param host - Ollama host URL (e.g., 'http://localhost:11434')
 * @returns Promise resolving to models result
 *
 * @example
 * ```typescript
 * const result = await getAvailableOllamaModels('http://localhost:11434');
 * if (result.success) {
 *   console.log(`Found ${result.models.length} models`);
 * }
 * ```
 */
export async function getAvailableOllamaModels(
  host: string,
): Promise<OllamaModelsResult> {
  let timeoutId: NodeJS.Timeout | undefined;
  try {
    const controller = new AbortController();
    timeoutId = setTimeout(() => {
      controller.abort();
    }, OLLAMA_TIMEOUT_MS);

    const response = await fetch(`${host}/api/tags`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    timeoutId = undefined;

    if (!response.ok) {
      return { success: false, models: [] };
    }

    const data: unknown = await response.json();

    // Validate response structure
    if (
      !data ||
      typeof data !== 'object' ||
      !('models' in data) ||
      !Array.isArray(data.models)
    ) {
      return { success: false, models: [] };
    }

    const models: OllamaModelInfo[] = [];
    for (const model of data.models) {
      // Validate each model has required fields with correct types
      if (isValidModel(model)) {
        models.push({
          name: model.name,
          size: model.size,
        });
      }
    }

    return { success: true, models };
  } catch {
    // Network errors, timeouts, or JSON parse errors
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    return { success: false, models: [] };
  }
}

/**
 * Checks if a specific model is available in the models list.
 * Supports partial matching (e.g., 'mistral:7b' matches 'mistral:7b-instruct-v0.1').
 *
 * @param modelName - Name or partial name of the model to check
 * @param models - List of available models
 * @returns True if model is available, false otherwise
 *
 * @example
 * ```typescript
 * const models = [{ name: 'llama3.2:latest', size: 2000000000 }];
 * isModelAvailable('llama3.2', models); // true
 * isModelAvailable('mistral', models);  // false
 * ```
 */
export function isModelAvailable(
  modelName: string,
  models: OllamaModelInfo[],
): boolean {
  return models.some((model) => model.name.includes(modelName));
}
