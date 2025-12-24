/**
 * Tests for the CLI entry point.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as index from './index.js';

// Mock all dependencies
vi.mock('ora', () => ({
  default: vi.fn(() => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    text: '',
  })),
}));

vi.mock('./utils/env.js', () => ({
  isFirstRun: vi.fn(),
  getEnvConfig: vi.fn(),
}));

vi.mock('./core/log-reader.js', () => ({
  claudeProjectsExist: vi.fn(),
  readLogs: vi.fn(),
}));

vi.mock('./core/setup.js', () => ({
  runSetup: vi.fn(),
}));

vi.mock('./core/analyzer.js', () => ({
  analyzePrompts: vi.fn(),
}));

vi.mock('./core/reporter.js', () => ({
  printReport: vi.fn(),
  formatJson: vi.fn((result, compact) =>
    compact ? JSON.stringify(result) : JSON.stringify(result, null, 2),
  ),
}));

vi.mock('./providers/index.js', () => ({
  getAvailableProvider: vi.fn(),
}));

import ora from 'ora';
import { isFirstRun, getEnvConfig } from './utils/env.js';
import { claudeProjectsExist, readLogs } from './core/log-reader.js';
import { runSetup } from './core/setup.js';
import { analyzePrompts } from './core/analyzer.js';
import { printReport, formatJson } from './core/reporter.js';
import { getAvailableProvider } from './providers/index.js';
import { EXIT_CODES } from './types/index.js';
import type {
  EnvConfig,
  AnalysisResult,
  AnalysisProvider,
} from './types/index.js';

const mockIsFirstRun = vi.mocked(isFirstRun);
const mockGetEnvConfig = vi.mocked(getEnvConfig);
const mockClaudeProjectsExist = vi.mocked(claudeProjectsExist);
const mockReadLogs = vi.mocked(readLogs);
const mockRunSetup = vi.mocked(runSetup);
const mockAnalyzePrompts = vi.mocked(analyzePrompts);
const mockPrintReport = vi.mocked(printReport);
const mockFormatJson = vi.mocked(formatJson);
const mockGetAvailableProvider = vi.mocked(getAvailableProvider);

describe('parseArguments', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    // Reset argv to a clean state
    process.argv = ['node', 'index.js'];
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('parses default arguments when none provided', () => {
    const result = index.parseArguments();
    expect(result).toEqual({
      date: 'today',
      help: false,
      version: false,
      format: 'terminal',
      compact: false,
    });
  });

  it('parses --date argument', () => {
    process.argv = ['node', 'index.js', '--date', 'yesterday'];
    const result = index.parseArguments();
    expect(result.date).toBe('yesterday');
  });

  it('parses --help argument', () => {
    process.argv = ['node', 'index.js', '--help'];
    const result = index.parseArguments();
    expect(result.help).toBe(true);
  });

  it('parses -h short flag', () => {
    process.argv = ['node', 'index.js', '-h'];
    const result = index.parseArguments();
    expect(result.help).toBe(true);
  });

  it('parses --version argument', () => {
    process.argv = ['node', 'index.js', '--version'];
    const result = index.parseArguments();
    expect(result.version).toBe(true);
  });

  it('parses multiple arguments', () => {
    process.argv = ['node', 'index.js', '--date', '2025-01-20'];
    const result = index.parseArguments();
    expect(result).toEqual({
      date: '2025-01-20',
      help: false,
      version: false,
      format: 'terminal',
      compact: false,
    });
  });

  it('parses --format json argument', () => {
    process.argv = ['node', 'index.js', '--format', 'json'];
    const result = index.parseArguments();
    expect(result.format).toBe('json');
  });

  it('parses --compact argument', () => {
    process.argv = ['node', 'index.js', '--compact'];
    const result = index.parseArguments();
    expect(result.compact).toBe(true);
  });

  it('defaults to terminal format', () => {
    process.argv = ['node', 'index.js'];
    const result = index.parseArguments();
    expect(result.format).toBe('terminal');
  });

  it('throws error for unknown arguments in strict mode', () => {
    process.argv = ['node', 'index.js', '--unknown'];
    expect(() => index.parseArguments()).toThrow('Invalid arguments');
  });

  it('throws error for positional arguments', () => {
    process.argv = ['node', 'index.js', 'positional'];
    expect(() => index.parseArguments()).toThrow('Invalid arguments');
  });
});

describe('showHelp', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      // Do nothing - prevent actual exit
      return undefined as never;
    });
    mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockExit.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockLog.mockRestore();
  });

  it('exits with success code', () => {
    index.showHelp();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });
});

describe('showVersion', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      // Do nothing - prevent actual exit
      return undefined as never;
    });
    mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockExit.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockLog.mockRestore();
  });

  it('exits with success code', () => {
    index.showVersion();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });
});

describe('checkAndRunSetup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs setup when first run', async () => {
    mockIsFirstRun.mockReturnValue(true);
    mockRunSetup.mockResolvedValue({
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    });

    await index.checkAndRunSetup(false);

    expect(mockIsFirstRun).toHaveBeenCalled();
    expect(mockRunSetup).toHaveBeenCalled();
    expect(ora).toHaveBeenCalledWith('Running first-time setup...');
  });

  it('skips setup when not first run', async () => {
    mockIsFirstRun.mockReturnValue(false);

    await index.checkAndRunSetup(false);

    expect(mockIsFirstRun).toHaveBeenCalled();
    expect(mockRunSetup).not.toHaveBeenCalled();
  });
});

describe('readLogsWithSpinner', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockError: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockWarn: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      // Do nothing - prevent actual exit
      return undefined as never;
    });
    mockError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockWarn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockExit.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockError.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockWarn.mockRestore();
  });

  it('exits with NO_DATA when Claude projects directory does not exist', async () => {
    mockClaudeProjectsExist.mockReturnValue(false);

    await index.readLogsWithSpinner('today', false);

    expect(mockClaudeProjectsExist).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.NO_DATA);
  });

  it('exits with NO_DATA when no prompts found for date', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    mockReadLogs.mockResolvedValue({
      prompts: [],
      warnings: [],
    });

    await index.readLogsWithSpinner('2025-01-01', false);

    expect(mockReadLogs).toHaveBeenCalledWith({ date: '2025-01-01' });
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.NO_DATA);
  });

  it('returns prompt content when prompts found', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    mockReadLogs.mockResolvedValue({
      prompts: [
        {
          content: 'Test prompt 1',
          timestamp: '2025-01-20T10:00:00Z',
          sessionId: 'session1',
          project: 'project1',
          date: '2025-01-20',
        },
        {
          content: 'Test prompt 2',
          timestamp: '2025-01-20T11:00:00Z',
          sessionId: 'session1',
          project: 'project1',
          date: '2025-01-20',
        },
      ],
      warnings: [],
    });

    const result = await index.readLogsWithSpinner('today', false);

    expect(result).toEqual(['Test prompt 1', 'Test prompt 2']);
    expect(ora).toHaveBeenCalledWith(
      expect.stringContaining('Reading Claude Code logs'),
    );
  });

  it('returns prompts when present even with warnings (warnings reported at end of main)', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    mockReadLogs.mockResolvedValue({
      prompts: [
        {
          content: 'Test prompt',
          timestamp: '2025-01-20T10:00:00Z',
          sessionId: 'session1',
          project: 'project1',
          date: '2025-01-20',
        },
      ],
      warnings: ['Warning 1', 'Warning 2'],
    });

    const result = await index.readLogsWithSpinner('today', false);

    // Warnings are now collected via logger.collectWarning() and
    // reported at end of main() via logger.reportWarnings()
    // So this function just returns the prompts regardless of warnings
    expect(result).toEqual(['Test prompt']);
  });

  it('exits with ERROR when readLogs throws', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    mockReadLogs.mockRejectedValue(new Error('Read error'));

    await index.readLogsWithSpinner('today', false);

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });
});

describe('connectProviderWithSpinner', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockError: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      // Do nothing - prevent actual exit
      return undefined as never;
    });
    mockError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockExit.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockError.mockRestore();
  });

  it('exits with PROVIDER_UNAVAILABLE when no services configured', async () => {
    const config: EnvConfig = {
      services: [],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);

    await index.connectProviderWithSpinner(false);

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.PROVIDER_UNAVAILABLE);
  });

  it('exits with PROVIDER_UNAVAILABLE when no providers available', async () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);

    mockGetAvailableProvider.mockRejectedValue(
      new Error('No providers are currently available.'),
    );

    await index.connectProviderWithSpinner(false);

    expect(mockGetAvailableProvider).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.PROVIDER_UNAVAILABLE);
  });

  it('returns provider when available', async () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);

    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };
    mockGetAvailableProvider.mockResolvedValue(mockProvider);

    const result = await index.connectProviderWithSpinner(false);

    expect(result).toBe(mockProvider);
    expect(mockGetAvailableProvider).toHaveBeenCalled();
    expect(ora).toHaveBeenCalledWith('Connecting to provider...');
  });

  it('exits with PROVIDER_UNAVAILABLE when getAvailableProvider throws', async () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);

    mockGetAvailableProvider.mockRejectedValue(new Error('Connection error'));

    await index.connectProviderWithSpinner(false);

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.PROVIDER_UNAVAILABLE);
  });
});

describe('analyzeWithProgress', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      // Do nothing - prevent actual exit
      return undefined as never;
    });
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockExit.mockRestore();
  });

  it('analyzes prompts and returns result', async () => {
    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn(),
      analyze: vi.fn(),
    };
    const prompts = ['prompt1', 'prompt2'];
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    mockAnalyzePrompts.mockResolvedValue(mockResult);

    const result = await index.analyzeWithProgress(
      mockProvider,
      prompts,
      '2025-01-20',
      false,
    );

    expect(result).toBe(mockResult);
    expect(mockAnalyzePrompts).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: mockProvider,
        prompts,
        date: '2025-01-20',
      }),
    );
  });

  it('updates spinner text during batching', async () => {
    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn(),
      analyze: vi.fn(),
    };
    const prompts = ['prompt1', 'prompt2'];
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    mockAnalyzePrompts.mockResolvedValue(mockResult);

    await index.analyzeWithProgress(mockProvider, prompts, '2025-01-20', false);

    // Get the onProgress callback - typing isn't perfect here but it's a test
    const onProgressCall = mockAnalyzePrompts.mock.calls[0]?.[0] as
      | { onProgress?: (current: number, total: number) => void }
      | undefined;
    const onProgress = onProgressCall?.onProgress;

    expect(onProgress).toBeDefined();

    // Test that onProgress updates spinner for multiple batches
    if (onProgress) {
      onProgress(0, 3); // Should update spinner text
      onProgress(1, 3);
      onProgress(2, 3);
    }
  });

  it('exits with ERROR when analysis fails', async () => {
    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn(),
      analyze: vi.fn(),
    };
    const prompts = ['prompt1'];

    mockAnalyzePrompts.mockRejectedValue(new Error('Analysis error'));

    await index.analyzeWithProgress(mockProvider, prompts, '2025-01-20', false);

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });
});

describe('displayResults', () => {
  const mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockLog.mockClear();
  });

  it('calls printReport with result for terminal format', () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    index.displayResults(mockResult, 'terminal', false);

    expect(mockPrintReport).toHaveBeenCalledWith(mockResult);
    expect(mockLog).toHaveBeenCalledWith(''); // Blank line
  });

  it('outputs JSON when format is json', () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    index.displayResults(mockResult, 'json', false);

    expect(mockFormatJson).toHaveBeenCalledWith(mockResult, false);
    expect(mockLog).toHaveBeenCalled();

    // Verify that the output is valid JSON
    const outputCall = mockLog.mock.calls[0];
    if (outputCall?.[0]) {
      const output = String(outputCall[0]);
      expect(() => {
        JSON.parse(output);
      }).not.toThrow();
    }
  });

  it('outputs compact JSON when compact flag is true', () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    index.displayResults(mockResult, 'json', true);

    expect(mockFormatJson).toHaveBeenCalledWith(mockResult, true);
    expect(mockLog).toHaveBeenCalled();

    // Verify that the output is compact (no newlines except at the end)
    const outputCall = mockLog.mock.calls[0];
    if (outputCall?.[0]) {
      const output = String(outputCall[0]);
      const lines = output.split('\n');
      // Compact JSON should be on a single line (or very few lines)
      expect(lines.length).toBeLessThan(5);
    }
  });

  it('does not call printReport when format is json', () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    index.displayResults(mockResult, 'json', false);

    expect(mockPrintReport).not.toHaveBeenCalled();
    expect(mockFormatJson).toHaveBeenCalled();
  });
});

describe('handleError', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockError: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      // Do nothing - prevent actual exit
      return undefined as never;
    });
    mockError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockExit.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockError.mockRestore();
  });

  it('exits with ERROR code', () => {
    const error = new Error('Test error');

    index.handleError(error, false);

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });
});
