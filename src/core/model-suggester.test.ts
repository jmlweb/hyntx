import { describe, expect, it } from 'vitest';

import type { OllamaModelInfo, SystemInfo } from '../utils/system-detection.js';
import {
  getInstallationSuggestion,
  suggestBestModel,
} from './model-suggester.js';

describe('model-suggester', () => {
  describe('suggestBestModel', () => {
    it('should suggest qwen2.5:14b when available with 8GB+ RAM', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'qwen2.5:14b', size: 9000000000 },
        { name: 'mistral:7b', size: 4000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toBe('qwen2.5:14b');
      expect(result.reason).toContain('quality');
    });

    it('should suggest mistral:7b when qwen not available but mistral is, with 8GB+ RAM', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'mistral:7b', size: 4000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toBe('mistral:7b');
      expect(result.reason).toContain('Small Schema');
    });

    it('should suggest llama3.2 when available with low RAM', () => {
      const systemInfo: SystemInfo = { ramGB: 4 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'mistral:7b', size: 4000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toBe('llama3.2');
      expect(result.reason).toContain('lightweight');
    });

    it('should fallback to llama3.2 when no models available', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toBe('llama3.2');
      expect(result.reason).toContain('default');
    });

    it('should fallback to llama3.2 when only unknown models available', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [
        { name: 'unknown-model:latest', size: 5000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toBe('llama3.2');
    });

    it('should prefer qwen2.5:14b over mistral:7b when both available with high RAM', () => {
      const systemInfo: SystemInfo = { ramGB: 32 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'mistral:7b', size: 4000000000 },
        { name: 'qwen2.5:14b', size: 9000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toBe('qwen2.5:14b');
    });

    it('should handle models with tags (e.g., :latest)', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'mistral:7b-instruct', size: 4000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toContain('mistral');
    });

    it('should suggest llama3.2 with exactly 8GB RAM when only llama3.2 available', () => {
      const systemInfo: SystemInfo = { ramGB: 8 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toBe('llama3.2');
    });

    it('should suggest mistral:7b with exactly 8GB RAM when available', () => {
      const systemInfo: SystemInfo = { ramGB: 8 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'mistral:7b', size: 4000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toBe('mistral:7b');
    });
  });

  describe('getInstallationSuggestion', () => {
    it('should suggest mistral:7b with 8GB+ RAM when not installed', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
      ];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).not.toBeNull();
      expect(result?.suggestedModel).toBe('mistral:7b');
      expect(result?.benefits).toContain('Better analysis quality');
    });

    it('should suggest llama3.2 with 4-7GB RAM when not installed', () => {
      const systemInfo: SystemInfo = { ramGB: 6 };
      const models: OllamaModelInfo[] = [];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).not.toBeNull();
      expect(result?.suggestedModel).toBe('llama3.2');
      expect(result?.benefits).toContain('Fast and lightweight');
    });

    it('should not suggest when mistral:7b already installed with 8GB+ RAM', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'mistral:7b', size: 4000000000 },
      ];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).toBeNull();
    });

    it('should not suggest when qwen2.5:14b already installed with 8GB+ RAM', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
        { name: 'qwen2.5:14b', size: 9000000000 },
      ];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).toBeNull();
    });

    it('should not suggest when llama3.2 already installed with 4-7GB RAM', () => {
      const systemInfo: SystemInfo = { ramGB: 6 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
      ];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).toBeNull();
    });

    it('should not suggest with less than 4GB RAM', () => {
      const systemInfo: SystemInfo = { ramGB: 2 };
      const models: OllamaModelInfo[] = [];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).toBeNull();
    });

    it('should not suggest when optimal model already installed', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [
        { name: 'mistral:7b', size: 4000000000 },
      ];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).toBeNull();
    });

    it('should suggest with exactly 8GB RAM when mistral not installed', () => {
      const systemInfo: SystemInfo = { ramGB: 8 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
      ];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).not.toBeNull();
      expect(result?.suggestedModel).toBe('mistral:7b');
    });

    it('should suggest with exactly 4GB RAM when llama3.2 not installed', () => {
      const systemInfo: SystemInfo = { ramGB: 4 };
      const models: OllamaModelInfo[] = [];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).not.toBeNull();
      expect(result?.suggestedModel).toBe('llama3.2');
    });
  });

  describe('edge cases', () => {
    it('should handle empty models list gracefully', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [];

      const modelSuggestion = suggestBestModel(systemInfo, models);
      expect(modelSuggestion.suggestedModel).toBe('llama3.2');

      const installSuggestion = getInstallationSuggestion(systemInfo, models);
      expect(installSuggestion).not.toBeNull();
    });

    it('should handle very high RAM values', () => {
      const systemInfo: SystemInfo = { ramGB: 128 };
      const models: OllamaModelInfo[] = [
        { name: 'qwen2.5:14b', size: 9000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result.suggestedModel).toBe('qwen2.5:14b');
    });

    it('should handle very low RAM values', () => {
      const systemInfo: SystemInfo = { ramGB: 1 };
      const models: OllamaModelInfo[] = [
        { name: 'llama3.2:latest', size: 2000000000 },
      ];

      const modelSuggestion = suggestBestModel(systemInfo, models);
      expect(modelSuggestion.suggestedModel).toBe('llama3.2');

      const installSuggestion = getInstallationSuggestion(systemInfo, models);
      expect(installSuggestion).toBeNull(); // Too little RAM
    });

    it('should return valid InstallationSuggestion structure', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [];

      const result = getInstallationSuggestion(systemInfo, models);

      expect(result).not.toBeNull();
      expect(result).toHaveProperty('suggestedModel');
      expect(result).toHaveProperty('benefits');
      expect(result).toHaveProperty('installCommand');
      expect(typeof result?.suggestedModel).toBe('string');
      expect(typeof result?.benefits).toBe('string');
      expect(typeof result?.installCommand).toBe('string');
    });

    it('should return valid ModelRecommendation structure', () => {
      const systemInfo: SystemInfo = { ramGB: 16 };
      const models: OllamaModelInfo[] = [
        { name: 'mistral:7b', size: 4000000000 },
      ];

      const result = suggestBestModel(systemInfo, models);

      expect(result).toHaveProperty('suggestedModel');
      expect(result).toHaveProperty('reason');
      expect(typeof result.suggestedModel).toBe('string');
      expect(typeof result.reason).toBe('string');
    });
  });
});
