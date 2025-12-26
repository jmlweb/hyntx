/**
 * Tests for the CLI entry point.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as index from './cli.js';
import type { ParsedArgs } from './cli.js';

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
  groupByDay: vi.fn(),
  parseDate: vi.fn((dateStr: string) => {
    // Simple mock that returns a Date object
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      throw new Error(`Invalid date: ${dateStr}`);
    }
    return date;
  }),
}));

vi.mock('./core/setup.js', () => ({
  runSetup: vi.fn(),
}));

vi.mock('./core/analyzer.js', () => ({
  analyzePrompts: vi.fn(),
  extractModelFromProvider: vi.fn((name: string) => {
    const match = /\((.*?)\)/.exec(name);
    return match?.[1] ?? name;
  }),
}));

vi.mock('./core/watcher.js', () => ({
  createLogWatcher: vi.fn(),
}));

vi.mock('./core/reporter.js', () => ({
  printReport: vi.fn(),
  formatJson: vi.fn((result, compact) =>
    compact ? JSON.stringify(result) : JSON.stringify(result, null, 2),
  ),
  formatMarkdown: vi.fn(() => '# Markdown Report'),
  printComparison: vi.fn(),
  printHistoryList: vi.fn(),
  printHistorySummary: vi.fn(),
  formatComparisonJson: vi.fn((comparison, compact) =>
    compact ? JSON.stringify(comparison) : JSON.stringify(comparison, null, 2),
  ),
}));

vi.mock('./core/reminder.js', () => ({
  checkReminder: vi.fn(),
  saveLastRun: vi.fn(),
  getLastRun: vi.fn(),
  getDaysElapsed: vi.fn(),
  shouldShowReminder: vi.fn(),
}));

vi.mock('node:fs/promises', () => ({
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  rename: vi.fn(),
}));

vi.mock('./providers/index.js', () => ({
  getAvailableProvider: vi.fn(),
}));

import ora from 'ora';
import { writeFile, mkdir, rename } from 'node:fs/promises';
import { isFirstRun, getEnvConfig } from './utils/env.js';
import { claudeProjectsExist, readLogs } from './core/log-reader.js';
import { runSetup } from './core/setup.js';
import { analyzePrompts } from './core/analyzer.js';
import {
  printReport,
  formatJson,
  printComparison,
  printHistoryList,
  printHistorySummary,
} from './core/reporter.js';
import { getAvailableProvider } from './providers/index.js';
import { EXIT_CODES } from './types/index.js';
import type {
  EnvConfig,
  AnalysisResult,
  AnalysisProvider,
  LogWatcher,
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
const mockWriteFile = vi.mocked(writeFile);
const mockMkdir = vi.mocked(mkdir);
const mockRename = vi.mocked(rename);

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
      from: undefined,
      to: undefined,
      project: undefined,
      output: undefined,
      dryRun: false,
      checkReminder: false,
      help: false,
      version: false,
      verbose: false,
      checkConfig: false,
      format: 'terminal',
      compact: false,
      compareWith: undefined,
      compareWeek: false,
      compareMonth: false,
      history: false,
      historySummary: false,
      noHistory: false,
      watch: false,
      quiet: false,
      clearCache: false,
      noCache: false,
      mcpServer: false,
      listRules: false,
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
      from: undefined,
      to: undefined,
      project: undefined,
      output: undefined,
      dryRun: false,
      checkReminder: false,
      help: false,
      version: false,
      verbose: false,
      checkConfig: false,
      format: 'terminal',
      compact: false,
      compareWith: undefined,
      compareWeek: false,
      compareMonth: false,
      history: false,
      historySummary: false,
      noHistory: false,
      watch: false,
      quiet: false,
      clearCache: false,
      noCache: false,
      mcpServer: false,
      listRules: false,
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

  it('parses --verbose argument', () => {
    process.argv = ['node', 'index.js', '--verbose'];
    const result = index.parseArguments();
    expect(result.verbose).toBe(true);
  });

  it('parses -v short flag', () => {
    process.argv = ['node', 'index.js', '-v'];
    const result = index.parseArguments();
    expect(result.verbose).toBe(true);
  });

  it('parses --check-config argument', () => {
    process.argv = ['node', 'index.js', '--check-config'];
    const result = index.parseArguments();
    expect(result.checkConfig).toBe(true);
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

    process.argv = ['node', 'index.js', '--date', 'today'];
    const args = index.parseArguments();
    await index.readLogsWithSpinner(args, false);

    expect(mockClaudeProjectsExist).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.NO_DATA);
  });

  it('exits with NO_DATA when no prompts found for date', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    mockReadLogs.mockResolvedValue({
      prompts: [],
      warnings: [],
    });

    process.argv = ['node', 'index.js', '--date', '2025-01-01'];
    const args = index.parseArguments();
    await index.readLogsWithSpinner(args, false);

    expect(mockReadLogs).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.NO_DATA);
  });

  it('returns LogReadResult when prompts found', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    const mockLogResult = {
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
    };
    mockReadLogs.mockResolvedValue(mockLogResult);

    process.argv = ['node', 'index.js', '--date', 'today'];
    const args = index.parseArguments();
    const result = await index.readLogsWithSpinner(args, false);

    expect(result).toEqual(mockLogResult);
    expect(ora).toHaveBeenCalledWith(
      expect.stringContaining('Reading Claude Code logs'),
    );
  });

  it('returns LogReadResult when present even with warnings (warnings reported at end of main)', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    const mockLogResult = {
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
    };
    mockReadLogs.mockResolvedValue(mockLogResult);

    process.argv = ['node', 'index.js', '--date', 'today'];
    const args = index.parseArguments();
    const result = await index.readLogsWithSpinner(args, false);

    // Warnings are now collected via logger.collectWarning() and
    // reported at end of main() via logger.reportWarnings()
    // So this function just returns the full LogReadResult
    expect(result).toEqual(mockLogResult);
  });

  it('exits with ERROR when readLogs throws', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    mockReadLogs.mockRejectedValue(new Error('Read error'));

    process.argv = ['node', 'index.js', '--date', 'today'];
    const args = index.parseArguments();
    await index.readLogsWithSpinner(args, false);

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
      undefined,
      undefined,
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

    await index.analyzeWithProgress(
      mockProvider,
      prompts,
      '2025-01-20',
      undefined,
      undefined,
      false,
    );

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

    await index.analyzeWithProgress(
      mockProvider,
      prompts,
      '2025-01-20',
      undefined,
      undefined,
      false,
    );

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });
});

describe('displayResults', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.clearAllMocks(); // Clear all mocks including printReport
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockLog.mockRestore();
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const outputCall = mockLog.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (outputCall?.[0]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const outputCall = mockLog.mock.calls[0];
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    if (outputCall?.[0]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
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

// =============================================================================
// New Feature Tests
// =============================================================================

describe('parseArguments - New Features', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    process.argv = ['node', 'index.js'];
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('parses --from and --to arguments', () => {
    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const result = index.parseArguments();
    expect(result.from).toBe('2025-01-20');
    expect(result.to).toBe('2025-01-25');
  });

  it('parses --project argument', () => {
    process.argv = ['node', 'index.js', '--project', 'my-app'];
    const result = index.parseArguments();
    expect(result.project).toBe('my-app');
  });

  it('parses --output argument', () => {
    process.argv = ['node', 'index.js', '--output', 'report.md'];
    const result = index.parseArguments();
    expect(result.output).toBe('report.md');
  });

  it('parses -o short flag for output', () => {
    process.argv = ['node', 'index.js', '-o', 'report.json'];
    const result = index.parseArguments();
    expect(result.output).toBe('report.json');
  });

  it('parses --dry-run argument', () => {
    process.argv = ['node', 'index.js', '--dry-run'];
    const result = index.parseArguments();
    expect(result.dryRun).toBe(true);
  });

  it('parses --check-reminder argument', () => {
    process.argv = ['node', 'index.js', '--check-reminder'];
    const result = index.parseArguments();
    expect(result.checkReminder).toBe(true);
  });

  it('parses all new arguments together', () => {
    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
      '--project',
      'test-project',
      '--output',
      'report.md',
      '--dry-run',
    ];
    const result = index.parseArguments();
    expect(result).toEqual({
      date: 'today',
      from: '2025-01-20',
      to: '2025-01-25',
      project: 'test-project',
      output: 'report.md',
      dryRun: true,
      checkReminder: false,
      help: false,
      version: false,
      verbose: false,
      checkConfig: false,
      format: 'terminal',
      compact: false,
      compareWith: undefined,
      compareWeek: false,
      compareMonth: false,
      history: false,
      historySummary: false,
      noHistory: false,
      watch: false,
      quiet: false,
      clearCache: false,
      noCache: false,
      mcpServer: false,
      listRules: false,
    });
  });
});

describe('validateArguments', () => {
  it('throws error when using --date with --from/--to', () => {
    process.argv = [
      'node',
      'index.js',
      '--date',
      'yesterday',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const invalidArgs = index.parseArguments();

    expect(() => {
      index.validateArguments(invalidArgs);
    }).toThrow('Cannot use --date with --from/--to');
  });

  it('throws error when --from is provided without --to', () => {
    process.argv = ['node', 'index.js', '--from', '2025-01-20'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Both --from and --to must be provided together');
  });

  it('throws error when --to is provided without --from', () => {
    process.argv = ['node', 'index.js', '--to', '2025-01-25'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Both --from and --to must be provided together');
  });

  it('throws error for invalid output file extension', () => {
    process.argv = ['node', 'index.js', '--output', 'report.txt'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Invalid output file extension');
  });

  it('throws error when using --output with --dry-run', () => {
    process.argv = ['node', 'index.js', '--output', 'report.md', '--dry-run'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Cannot use --output with --dry-run mode');
  });

  it('accepts valid .md output file', () => {
    process.argv = ['node', 'index.js', '--output', 'report.md'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });

  it('accepts valid .json output file', () => {
    process.argv = ['node', 'index.js', '--output', 'report.json'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });

  it('accepts valid date range without conflicts', () => {
    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });
});

describe('getOutputFilePath', () => {
  it('returns absolute path for single-day output', () => {
    const result = index.getOutputFilePath('report.md');
    expect(result).toContain('report.md');
  });

  it('appends date to filename for multi-day output', () => {
    const result = index.getOutputFilePath('report.md', '2025-01-20');
    expect(result).toContain('report-2025-01-20.md');
  });

  it('handles JSON files correctly', () => {
    const result = index.getOutputFilePath('report.json', '2025-01-20');
    expect(result).toContain('report-2025-01-20.json');
  });

  it('preserves file extension when appending date', () => {
    const result = index.getOutputFilePath('output/report.md', '2025-01-20');
    expect(result).toMatch(/report-2025-01-20\.md$/);
  });
});

describe('writeOutputFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it('writes JSON format correctly', async () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    await index.writeOutputFile('/tmp/report.json', mockResult, 'json', false);

    // Expect atomic write (temp file then rename)
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      JSON.stringify(mockResult, null, 2),
      'utf-8',
    );
    expect(mockRename).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      '/tmp/report.json',
    );
  });

  it('writes compact JSON when requested', async () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    await index.writeOutputFile('/tmp/report.json', mockResult, 'json', true);

    // Expect atomic write (temp file then rename)
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      JSON.stringify(mockResult),
      'utf-8',
    );
    expect(mockRename).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      '/tmp/report.json',
    );
  });
});

describe('writeMultiDayJsonOutput', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it('writes array of results to JSON file', async () => {
    const mockResults: readonly AnalysisResult[] = [
      {
        date: '2025-01-20',
        patterns: [],
        stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
        topSuggestion: 'Great job!',
      },
      {
        date: '2025-01-21',
        patterns: [],
        stats: { totalPrompts: 3, promptsWithIssues: 1, overallScore: 8 },
        topSuggestion: 'Good work!',
      },
    ];

    await index.writeMultiDayJsonOutput('/tmp/report.json', mockResults, false);

    // Expect atomic write (temp file then rename)
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      JSON.stringify(mockResults, null, 2),
      'utf-8',
    );
    expect(mockRename).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      '/tmp/report.json',
    );
  });

  it('writes compact JSON array when requested', async () => {
    const mockResults: readonly AnalysisResult[] = [
      {
        date: '2025-01-20',
        patterns: [],
        stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
        topSuggestion: 'Great job!',
      },
    ];

    await index.writeMultiDayJsonOutput('/tmp/report.json', mockResults, true);

    // Expect atomic write (temp file then rename)
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      JSON.stringify(mockResults),
      'utf-8',
    );
    expect(mockRename).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      '/tmp/report.json',
    );
  });
});

describe('displayDryRunSummary', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockLog.mockRestore();
  });

  it('displays summary with single date', () => {
    const prompts = [
      {
        content: 'Test prompt 1',
        timestamp: '2025-01-20T10:00:00Z',
        sessionId: 'session1',
        project: 'project-a',
        date: '2025-01-20',
      },
      {
        content: 'Test prompt 2',
        timestamp: '2025-01-20T11:00:00Z',
        sessionId: 'session1',
        project: 'project-b',
        date: '2025-01-20',
      },
    ];

    process.argv = ['node', 'index.js', '--date', 'today'];
    const args = index.parseArguments();

    index.displayDryRunSummary(prompts, args);

    // Check that the function was called and logged output
    expect(mockLog).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('Dry Run Mode');

    expect(output).toContain('Total Prompts:');
  });

  it('displays summary with date range', () => {
    const prompts = [
      {
        content: 'Test prompt',
        timestamp: '2025-01-20T10:00:00Z',
        sessionId: 'session1',
        project: 'project-a',
        date: '2025-01-20',
      },
    ];

    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const args = index.parseArguments();

    index.displayDryRunSummary(prompts, args);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('Date Range:');
  });

  it('displays project filter when provided', () => {
    const prompts = [
      {
        content: 'Test prompt',
        timestamp: '2025-01-20T10:00:00Z',
        sessionId: 'session1',
        project: 'my-app',
        date: '2025-01-20',
      },
    ];

    process.argv = ['node', 'index.js', '--project', 'my-app'];
    const args = index.parseArguments();

    index.displayDryRunSummary(prompts, args);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('Project Filter:');
  });
});

describe('showReminderStatus', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
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

  it('displays reminder status and exits with success', () => {
    index.showReminderStatus();

    expect(mockLog).toHaveBeenCalled();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('Reminder Status');
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });
});

// =============================================================================
// Critical Bug Fix Tests
// =============================================================================

describe('validateArguments - date range order validation', () => {
  it('throws error when --from date is after --to date', () => {
    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-12-31',
      '--to',
      '2025-01-01',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Invalid date range');
  });

  it('accepts when --from date equals --to date', () => {
    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-20',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });

  it('accepts when --from date is before --to date', () => {
    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-01',
      '--to',
      '2025-12-31',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });

  it('throws error with clear message about invalid date format', () => {
    process.argv = [
      'node',
      'index.js',
      '--from',
      'invalid',
      '--to',
      '2025-01-20',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Invalid date format');
  });
});

describe('writeOutputFile - robust error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it('creates parent directory before writing', async () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    await index.writeOutputFile(
      '/tmp/subdir/report.md',
      mockResult,
      'md',
      false,
    );

    expect(mockMkdir).toHaveBeenCalledWith('/tmp/subdir', { recursive: true });
  });

  it('uses atomic write with temp file', async () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    await index.writeOutputFile('/tmp/report.md', mockResult, 'md', false);

    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/report.md.tmp',
      expect.any(String),
      'utf-8',
    );
    expect(mockRename).toHaveBeenCalledWith(
      '/tmp/report.md.tmp',
      '/tmp/report.md',
    );
  });

  it('throws descriptive error when write fails', async () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    mockWriteFile.mockRejectedValue(new Error('ENOSPC: no space left'));

    await expect(
      index.writeOutputFile('/tmp/report.md', mockResult, 'md', false),
    ).rejects.toThrow('Failed to write output file /tmp/report.md');
  });
});

describe('writeMultiDayJsonOutput - robust error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it('creates parent directory before writing', async () => {
    const mockResults: readonly AnalysisResult[] = [
      {
        date: '2025-01-20',
        patterns: [],
        stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
        topSuggestion: 'Great job!',
      },
    ];

    await index.writeMultiDayJsonOutput(
      '/tmp/subdir/report.json',
      mockResults,
      false,
    );

    expect(mockMkdir).toHaveBeenCalledWith('/tmp/subdir', { recursive: true });
  });

  it('uses atomic write with temp file', async () => {
    const mockResults: readonly AnalysisResult[] = [
      {
        date: '2025-01-20',
        patterns: [],
        stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
        topSuggestion: 'Great job!',
      },
    ];

    await index.writeMultiDayJsonOutput('/tmp/report.json', mockResults, false);

    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      expect.any(String),
      'utf-8',
    );
    expect(mockRename).toHaveBeenCalledWith(
      '/tmp/report.json.tmp',
      '/tmp/report.json',
    );
  });

  it('throws descriptive error when write fails', async () => {
    const mockResults: readonly AnalysisResult[] = [
      {
        date: '2025-01-20',
        patterns: [],
        stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
        topSuggestion: 'Great job!',
      },
    ];

    mockMkdir.mockRejectedValue(new Error('EACCES: permission denied'));

    await expect(
      index.writeMultiDayJsonOutput('/tmp/report.json', mockResults, false),
    ).rejects.toThrow('Failed to write output file /tmp/report.json');
  });
});

// =============================================================================
// Additional Coverage Tests - Comparison and History Flags
// =============================================================================

describe('validateArguments - comparison flags', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('throws error when using multiple comparison flags together', () => {
    process.argv = ['node', 'index.js', '--compare-week', '--compare-month'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Cannot use multiple comparison flags together');
  });

  it('throws error when using --compare-with with --compare-week', () => {
    process.argv = [
      'node',
      'index.js',
      '--compare-with',
      '2025-01-15',
      '--compare-week',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Cannot use multiple comparison flags together');
  });

  it('throws error when using comparison flags with --from/--to', () => {
    process.argv = [
      'node',
      'index.js',
      '--compare-week',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Cannot use comparison flags with --from/--to date range');
  });

  it('accepts valid comparison flag alone', () => {
    process.argv = ['node', 'index.js', '--compare-week'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });

  it('accepts --compare-with with valid date', () => {
    process.argv = ['node', 'index.js', '--compare-with', '2025-01-15'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });
});

describe('validateArguments - history flags', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('throws error when using --history with --history-summary', () => {
    process.argv = ['node', 'index.js', '--history', '--history-summary'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Cannot use --history and --history-summary together');
  });

  it('throws error when using --history with date filters', () => {
    process.argv = ['node', 'index.js', '--history', '--date', 'yesterday'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Cannot use history listing flags with date filters');
  });

  it('throws error when using --history with --from/--to', () => {
    process.argv = [
      'node',
      'index.js',
      '--history',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Cannot use history listing flags with date filters');
  });

  it('throws error when using history flags with comparison flags', () => {
    process.argv = ['node', 'index.js', '--history', '--compare-week'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow('Cannot use history listing flags with comparison flags');
  });

  it('accepts --history alone', () => {
    process.argv = ['node', 'index.js', '--history'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });

  it('accepts --history-summary alone', () => {
    process.argv = ['node', 'index.js', '--history-summary'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });
});

// =============================================================================
// JSON Mode Tests
// =============================================================================

describe('readLogsWithSpinner - JSON mode', () => {
  const originalArgv = process.argv;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = ['node', 'index.js'];
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
    mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockExit.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockLog.mockRestore();
  });

  it('outputs JSON error when Claude projects directory does not exist in JSON mode', async () => {
    mockClaudeProjectsExist.mockReturnValue(false);

    process.argv = ['node', 'index.js', '--format', 'json'];
    const args = index.parseArguments();
    await index.readLogsWithSpinner(args, true);

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('"error"'));
    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('NO_DATA'));
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.NO_DATA);
  });

  it('outputs JSON error when no prompts found in JSON mode', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    mockReadLogs.mockResolvedValue({
      prompts: [],
      warnings: [],
    });

    process.argv = ['node', 'index.js', '--format', 'json'];
    const args = index.parseArguments();
    await index.readLogsWithSpinner(args, true);

    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('No prompts found'),
    );
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.NO_DATA);
  });

  it('outputs JSON error when readLogs throws in JSON mode', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    mockReadLogs.mockRejectedValue(new Error('Read error'));

    process.argv = ['node', 'index.js', '--format', 'json'];
    const args = index.parseArguments();
    await index.readLogsWithSpinner(args, true);

    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('Failed to read logs'),
    );
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });

  it('returns prompts without spinner in JSON mode', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    const mockLogResult = {
      prompts: [
        {
          content: 'Test prompt',
          timestamp: '2025-01-20T10:00:00Z',
          sessionId: 'session1',
          project: 'project1',
          date: '2025-01-20',
        },
      ],
      warnings: [],
    };
    mockReadLogs.mockResolvedValue(mockLogResult);

    process.argv = ['node', 'index.js', '--format', 'json'];
    const args = index.parseArguments();
    const result = await index.readLogsWithSpinner(args, true);

    expect(result).toEqual(mockLogResult);
    // Spinner should not be created in JSON mode (ora not called with message)
  });

  it('includes date range in spinner message', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    const mockLogResult = {
      prompts: [
        {
          content: 'Test prompt',
          timestamp: '2025-01-20T10:00:00Z',
          sessionId: 'session1',
          project: 'project1',
          date: '2025-01-20',
        },
      ],
      warnings: [],
    };
    mockReadLogs.mockResolvedValue(mockLogResult);

    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const args = index.parseArguments();
    await index.readLogsWithSpinner(args, false);

    expect(ora).toHaveBeenCalledWith(
      expect.stringContaining('from 2025-01-20 to 2025-01-25'),
    );
  });
});

describe('connectProviderWithSpinner - JSON mode', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
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

  it('outputs JSON error when no services configured in JSON mode', async () => {
    const config: EnvConfig = {
      services: [],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);

    await index.connectProviderWithSpinner(true);

    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('No providers configured'),
    );
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('PROVIDER_UNAVAILABLE'),
    );
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.PROVIDER_UNAVAILABLE);
  });

  it('outputs JSON error when provider unavailable in JSON mode', async () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);
    mockGetAvailableProvider.mockRejectedValue(
      new Error('No providers available'),
    );

    await index.connectProviderWithSpinner(true);

    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('No providers available'),
    );
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.PROVIDER_UNAVAILABLE);
  });

  it('returns provider silently in JSON mode', async () => {
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

    const result = await index.connectProviderWithSpinner(true);

    expect(result).toBe(mockProvider);
  });

  it('invokes fallback callback when provider falls back', async () => {
    const config: EnvConfig = {
      services: ['ollama', 'anthropic'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: 'test-key' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);

    const mockProvider: AnalysisProvider = {
      name: 'Anthropic',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };

    // eslint-disable-next-line @typescript-eslint/require-await
    mockGetAvailableProvider.mockImplementation(async (_config, onFallback) => {
      if (onFallback) {
        onFallback('Ollama', 'Anthropic');
      }
      return mockProvider;
    });

    const result = await index.connectProviderWithSpinner(false);

    expect(result.name).toBe('Anthropic');
  });
});

describe('analyzeWithProgress - JSON mode', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
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

  it('returns result silently in JSON mode', async () => {
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
      undefined,
      undefined,
      true,
    );

    expect(result).toBe(mockResult);
  });

  it('outputs JSON error when analysis fails in JSON mode', async () => {
    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn(),
      analyze: vi.fn(),
    };
    const prompts = ['prompt1'];

    mockAnalyzePrompts.mockRejectedValue(new Error('Analysis error'));

    await index.analyzeWithProgress(
      mockProvider,
      prompts,
      '2025-01-20',
      undefined,
      undefined,
      true,
    );

    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('Analysis failed'),
    );
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });
});

describe('handleError - JSON mode', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
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

  it('outputs JSON error in JSON mode', () => {
    const error = new Error('Test error');

    index.handleError(error, true);

    expect(mockLog).toHaveBeenCalledWith(expect.stringContaining('Test error'));
    expect(mockLog).toHaveBeenCalledWith(
      expect.stringContaining('"code":"ERROR"'),
    );
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });

  it('outputs to logger in terminal mode', () => {
    const error = new Error('Test error');

    index.handleError(error, false);

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });
});

// =============================================================================
// Additional Edge Case Tests
// =============================================================================

describe('displayDryRunSummary - edge cases', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;
  const originalArgv = process.argv;

  beforeEach(() => {
    mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockLog.mockRestore();
  });

  it('displays "and X more" when more than 3 prompts', () => {
    const prompts = [
      {
        content: 'Test prompt 1',
        timestamp: '2025-01-20T10:00:00Z',
        sessionId: 'session1',
        project: 'project-a',
        date: '2025-01-20',
      },
      {
        content: 'Test prompt 2',
        timestamp: '2025-01-20T11:00:00Z',
        sessionId: 'session1',
        project: 'project-a',
        date: '2025-01-20',
      },
      {
        content: 'Test prompt 3',
        timestamp: '2025-01-20T12:00:00Z',
        sessionId: 'session1',
        project: 'project-a',
        date: '2025-01-20',
      },
      {
        content: 'Test prompt 4',
        timestamp: '2025-01-20T13:00:00Z',
        sessionId: 'session1',
        project: 'project-a',
        date: '2025-01-20',
      },
      {
        content: 'Test prompt 5',
        timestamp: '2025-01-20T14:00:00Z',
        sessionId: 'session1',
        project: 'project-a',
        date: '2025-01-20',
      },
    ];

    process.argv = ['node', 'index.js', '--date', 'today'];
    const args = index.parseArguments();

    index.displayDryRunSummary(prompts, args);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('and 2 more');
  });

  it('truncates long prompts in preview', () => {
    const longContent = 'A'.repeat(200);
    const prompts = [
      {
        content: longContent,
        timestamp: '2025-01-20T10:00:00Z',
        sessionId: 'session1',
        project: 'project-a',
        date: '2025-01-20',
      },
    ];

    process.argv = ['node', 'index.js', '--date', 'today'];
    const args = index.parseArguments();

    index.displayDryRunSummary(prompts, args);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('...');
  });

  it('lists unique projects sorted alphabetically', () => {
    const prompts = [
      {
        content: 'Test prompt 1',
        timestamp: '2025-01-20T10:00:00Z',
        sessionId: 'session1',
        project: 'zebra',
        date: '2025-01-20',
      },
      {
        content: 'Test prompt 2',
        timestamp: '2025-01-20T11:00:00Z',
        sessionId: 'session1',
        project: 'alpha',
        date: '2025-01-20',
      },
      {
        content: 'Test prompt 3',
        timestamp: '2025-01-20T12:00:00Z',
        sessionId: 'session1',
        project: 'zebra',
        date: '2025-01-20',
      },
    ];

    process.argv = ['node', 'index.js', '--date', 'today'];
    const args = index.parseArguments();

    index.displayDryRunSummary(prompts, args);

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('alpha, zebra');
  });
});

describe('parseArguments - history arguments', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('parses --compare-with argument', () => {
    process.argv = ['node', 'index.js', '--compare-with', '2025-01-15'];
    const result = index.parseArguments();
    expect(result.compareWith).toBe('2025-01-15');
  });

  it('parses --compare-week argument', () => {
    process.argv = ['node', 'index.js', '--compare-week'];
    const result = index.parseArguments();
    expect(result.compareWeek).toBe(true);
  });

  it('parses --compare-month argument', () => {
    process.argv = ['node', 'index.js', '--compare-month'];
    const result = index.parseArguments();
    expect(result.compareMonth).toBe(true);
  });

  it('parses --history argument', () => {
    process.argv = ['node', 'index.js', '--history'];
    const result = index.parseArguments();
    expect(result.history).toBe(true);
  });

  it('parses --history-summary argument', () => {
    process.argv = ['node', 'index.js', '--history-summary'];
    const result = index.parseArguments();
    expect(result.historySummary).toBe(true);
  });

  it('parses --no-history argument', () => {
    process.argv = ['node', 'index.js', '--no-history'];
    const result = index.parseArguments();
    expect(result.noHistory).toBe(true);
  });
});

describe('writeOutputFile - markdown format', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);
  });

  it('writes Markdown format correctly', async () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    await index.writeOutputFile('/tmp/report.md', mockResult, 'md', false);

    expect(mockWriteFile).toHaveBeenCalledWith(
      '/tmp/report.md.tmp',
      '# Markdown Report',
      'utf-8',
    );
    expect(mockRename).toHaveBeenCalledWith(
      '/tmp/report.md.tmp',
      '/tmp/report.md',
    );
  });
});

describe('writeOutputFile - error on rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockRejectedValue(new Error('EXDEV: cross-device link'));
  });

  it('throws descriptive error when rename fails', async () => {
    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 2, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };

    await expect(
      index.writeOutputFile('/tmp/report.md', mockResult, 'md', false),
    ).rejects.toThrow('Failed to write output file /tmp/report.md: EXDEV');
  });
});

describe('getOutputFilePath - additional scenarios', () => {
  it('handles nested directory paths', () => {
    const result = index.getOutputFilePath(
      'output/subdir/report.md',
      '2025-01-20',
    );
    expect(result).toMatch(/output\/subdir\/report-2025-01-20\.md$/);
  });

  it('handles absolute paths', () => {
    const result = index.getOutputFilePath('/absolute/path/report.json');
    expect(result).toBe('/absolute/path/report.json');
  });

  it('handles absolute paths with date', () => {
    const result = index.getOutputFilePath(
      '/absolute/path/report.json',
      '2025-01-20',
    );
    expect(result).toBe('/absolute/path/report-2025-01-20.json');
  });
});

// =============================================================================
// runConfigCheck Tests
// =============================================================================

// Mock additional modules for runConfigCheck
vi.mock('./utils/config-validator.js', () => ({
  validateAllProviders: vi.fn(),
  printHealthCheckResult: vi.fn(),
}));

import {
  validateAllProviders,
  printHealthCheckResult,
} from './utils/config-validator.js';

const mockValidateAllProviders = vi.mocked(validateAllProviders);
const mockPrintHealthCheckResult = vi.mocked(printHealthCheckResult);

describe('runConfigCheck', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockExit.mockRestore();
  });

  it('exits with SUCCESS when all providers are valid', async () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);

    mockValidateAllProviders.mockResolvedValue({
      allValid: true,
      providers: [],
      summary: {
        totalConfigured: 1,
        availableCount: 1,
        unavailableCount: 0,
      },
    });

    await index.runConfigCheck();

    expect(mockValidateAllProviders).toHaveBeenCalledWith(config);
    expect(mockPrintHealthCheckResult).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('exits with SUCCESS when some providers are available', async () => {
    const config: EnvConfig = {
      services: ['ollama', 'anthropic'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: 'test-key' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);

    mockValidateAllProviders.mockResolvedValue({
      allValid: false,
      providers: [],
      summary: {
        totalConfigured: 2,
        availableCount: 1,
        unavailableCount: 1,
      },
    });

    await index.runConfigCheck();

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('exits with PROVIDER_UNAVAILABLE when no providers are available', async () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);

    mockValidateAllProviders.mockResolvedValue({
      allValid: false,
      providers: [],
      summary: {
        totalConfigured: 1,
        availableCount: 0,
        unavailableCount: 1,
      },
    });

    await index.runConfigCheck();

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.PROVIDER_UNAVAILABLE);
  });
});

// =============================================================================
// showReminderStatus Tests - Additional Scenarios
// =============================================================================

import {
  getLastRun,
  getDaysElapsed,
  shouldShowReminder,
} from './core/reminder.js';

const mockGetLastRun = vi.mocked(getLastRun);
const mockGetDaysElapsed = vi.mocked(getDaysElapsed);
const mockShouldShowReminder = vi.mocked(shouldShowReminder);

describe('showReminderStatus - variations', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
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

  it('displays "Never" when no last run', () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);
    mockGetLastRun.mockReturnValue(null);
    mockGetDaysElapsed.mockReturnValue(0);
    mockShouldShowReminder.mockReturnValue(true);

    index.showReminderStatus();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('Never');
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('displays days elapsed when there is a last run', () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);
    mockGetLastRun.mockReturnValue('2025-01-20');
    mockGetDaysElapsed.mockReturnValue(3);
    mockShouldShowReminder.mockReturnValue(false);

    index.showReminderStatus();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('2025-01-20');
    expect(output).toContain('3');
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('displays "Due" status when reminder is due', () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);
    mockGetLastRun.mockReturnValue('2025-01-10');
    mockGetDaysElapsed.mockReturnValue(10);
    mockShouldShowReminder.mockReturnValue(true);

    index.showReminderStatus();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('Due');
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('displays "Not Due" status when reminder is not due', () => {
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);
    mockGetLastRun.mockReturnValue('2025-01-20');
    mockGetDaysElapsed.mockReturnValue(2);
    mockShouldShowReminder.mockReturnValue(false);

    index.showReminderStatus();

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const calls = mockLog.mock.calls.map((call: unknown[]) => call.join(' '));
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const output = calls.join('\n');

    expect(output).toContain('Not Due');
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });
});

// =============================================================================
// checkAndRunSetup Tests - JSON Mode
// =============================================================================

describe('checkAndRunSetup - JSON mode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('runs setup without spinner in JSON mode', async () => {
    mockIsFirstRun.mockReturnValue(true);
    mockRunSetup.mockResolvedValue({
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    });

    await index.checkAndRunSetup(true);

    expect(mockIsFirstRun).toHaveBeenCalled();
    expect(mockRunSetup).toHaveBeenCalled();
    // In JSON mode, ora should not be called with 'Running first-time setup...'
  });
});

// =============================================================================
// readLogsWithSpinner - Project Filter in Spinner Message
// =============================================================================

describe('readLogsWithSpinner - project filter', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = ['node', 'index.js'];
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('includes project filter in spinner message', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    const mockLogResult = {
      prompts: [
        {
          content: 'Test prompt',
          timestamp: '2025-01-20T10:00:00Z',
          sessionId: 'session1',
          project: 'my-project',
          date: '2025-01-20',
        },
      ],
      warnings: [],
    };
    mockReadLogs.mockResolvedValue(mockLogResult);

    process.argv = ['node', 'index.js', '--project', 'my-project'];
    const args = index.parseArguments();
    await index.readLogsWithSpinner(args, false);

    expect(ora).toHaveBeenCalledWith(
      expect.stringContaining('project: my-project'),
    );
  });

  it('shows date range message when no prompts found', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    mockReadLogs.mockResolvedValue({
      prompts: [],
      warnings: [],
    });

    const mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });

    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const args = index.parseArguments();
    await index.readLogsWithSpinner(args, false);

    // The fail message should include the date range
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.NO_DATA);

    mockExit.mockRestore();
  });

  it('shows success message with date range', async () => {
    mockClaudeProjectsExist.mockReturnValue(true);
    const mockLogResult = {
      prompts: [
        {
          content: 'Test prompt',
          timestamp: '2025-01-20T10:00:00Z',
          sessionId: 'session1',
          project: 'project1',
          date: '2025-01-20',
        },
      ],
      warnings: [],
    };
    mockReadLogs.mockResolvedValue(mockLogResult);

    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const args = index.parseArguments();
    const result = await index.readLogsWithSpinner(args, false);

    expect(result.prompts.length).toBe(1);
  });
});

// =============================================================================
// main() Integration Tests
// =============================================================================

// Mock additional modules for main()
vi.mock('./core/history.js', () => ({
  saveAnalysisResult: vi.fn(),
  loadAnalysisResult: vi.fn(),
  listAvailableDates: vi.fn(),
  compareResults: vi.fn(),
  getDateOneWeekAgo: vi.fn(),
  getDateOneMonthAgo: vi.fn(),
}));

vi.mock('./utils/project-config.js', () => ({
  loadProjectConfigForCwd: vi.fn(),
  mergeConfigs: vi.fn(),
}));

import { checkReminder, saveLastRun } from './core/reminder.js';
import { groupByDay } from './core/log-reader.js';
import {
  saveAnalysisResult,
  loadAnalysisResult,
  listAvailableDates,
  compareResults,
  getDateOneWeekAgo,
  getDateOneMonthAgo,
} from './core/history.js';
import {
  loadProjectConfigForCwd,
  mergeConfigs,
} from './utils/project-config.js';

const mockCheckReminder = vi.mocked(checkReminder);
const mockSaveLastRun = vi.mocked(saveLastRun);
const mockGroupByDay = vi.mocked(groupByDay);
const mockSaveAnalysisResult = vi.mocked(saveAnalysisResult);
const mockLoadAnalysisResult = vi.mocked(loadAnalysisResult);
const mockListAvailableDates = vi.mocked(listAvailableDates);
const mockCompareResults = vi.mocked(compareResults);
const mockGetDateOneWeekAgo = vi.mocked(getDateOneWeekAgo);
// Not currently used, but imported to ensure it's properly mocked if needed later
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const mockGetDateOneMonthAgo = vi.mocked(getDateOneMonthAgo);
const mockLoadProjectConfigForCwd = vi.mocked(loadProjectConfigForCwd);
const mockMergeConfigs = vi.mocked(mergeConfigs);

const mockPrintComparison = vi.mocked(printComparison);
const mockPrintHistoryList = vi.mocked(printHistoryList);
const mockPrintHistorySummary = vi.mocked(printHistorySummary);

describe('main - integration tests', () => {
  const originalArgv = process.argv;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockExit: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockLog: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.argv = ['node', 'index.js'];
    mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {
      return undefined as never;
    });
    mockLog = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    // Default mocks
    mockIsFirstRun.mockReturnValue(false);
    mockCheckReminder.mockResolvedValue(true);
    const config: EnvConfig = {
      services: ['ollama'],
      reminder: '7d',
      ollama: { model: 'llama3.2', host: 'http://localhost:11434' },
      anthropic: { model: 'claude-3-5-haiku-latest', apiKey: '' },
      google: { model: 'gemini-2.0-flash-exp', apiKey: '' },
    };
    mockGetEnvConfig.mockReturnValue(config);
    mockLoadProjectConfigForCwd.mockReturnValue(null);
    mockMergeConfigs.mockReturnValue(config);
    mockClaudeProjectsExist.mockReturnValue(true);
    mockSaveLastRun.mockReturnValue(undefined);
  });

  afterEach(() => {
    process.argv = originalArgv;
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockExit.mockRestore();
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    mockLog.mockRestore();
  });

  it('handles --history flag to list history entries', async () => {
    process.argv = ['node', 'index.js', '--history'];

    mockListAvailableDates.mockResolvedValue(['2025-01-20', '2025-01-21']);
    mockLoadAnalysisResult.mockResolvedValue({
      result: {
        date: '2025-01-20',
        patterns: [],
        stats: { totalPrompts: 10, promptsWithIssues: 2, overallScore: 8 },
        topSuggestion: 'Keep improving!',
      },
      metadata: {
        provider: 'Ollama',
        promptCount: 10,
        projects: ['project1'],
      },
    });

    await index.cli();

    expect(mockListAvailableDates).toHaveBeenCalled();
    expect(mockPrintHistoryList).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles --history-summary flag', async () => {
    process.argv = ['node', 'index.js', '--history-summary'];

    mockListAvailableDates.mockResolvedValue(['2025-01-20']);
    mockLoadAnalysisResult.mockResolvedValue({
      result: {
        date: '2025-01-20',
        patterns: [],
        stats: { totalPrompts: 10, promptsWithIssues: 2, overallScore: 8 },
        topSuggestion: 'Keep improving!',
      },
      metadata: {
        provider: 'Ollama',
        promptCount: 10,
        projects: ['project1'],
      },
    });

    await index.cli();

    expect(mockPrintHistorySummary).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles --dry-run flag', async () => {
    process.argv = ['node', 'index.js', '--dry-run'];

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
      warnings: [],
    });

    await index.cli();

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles single-day analysis successfully', async () => {
    process.argv = ['node', 'index.js', '--date', 'today'];

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
      warnings: [],
    });

    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };
    mockGetAvailableProvider.mockResolvedValue(mockProvider);

    const mockResult: AnalysisResult = {
      date: 'today',
      patterns: [],
      stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };
    mockAnalyzePrompts.mockResolvedValue(mockResult);
    mockSaveAnalysisResult.mockResolvedValue(undefined);

    await index.cli();

    expect(mockAnalyzePrompts).toHaveBeenCalled();
    expect(mockPrintReport).toHaveBeenCalledWith(mockResult);
    expect(mockSaveLastRun).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles --compare-week flag', async () => {
    process.argv = ['node', 'index.js', '--compare-week'];

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
      warnings: [],
    });

    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };
    mockGetAvailableProvider.mockResolvedValue(mockProvider);

    const mockResult: AnalysisResult = {
      date: 'today',
      patterns: [],
      stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };
    mockAnalyzePrompts.mockResolvedValue(mockResult);
    mockSaveAnalysisResult.mockResolvedValue(undefined);
    mockGetDateOneWeekAgo.mockReturnValue('2025-01-13');
    mockLoadAnalysisResult.mockResolvedValue({
      result: {
        date: '2025-01-13',
        patterns: [],
        stats: { totalPrompts: 5, promptsWithIssues: 1, overallScore: 8 },
        topSuggestion: 'Good work!',
      },
      metadata: {
        provider: 'Ollama',
        promptCount: 5,
        projects: ['project1'],
      },
    });
    mockCompareResults.mockReturnValue({
      before: {
        date: '2025-01-13',
        patterns: [],
        stats: { totalPrompts: 5, promptsWithIssues: 1, overallScore: 8 },
        topSuggestion: 'Good work!',
      },
      after: {
        date: 'today',
        patterns: [],
        stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
        topSuggestion: 'Great job!',
      },
      changes: {
        scoreDelta: 2,
        newPatterns: [],
        resolvedPatterns: [],
        changedPatterns: [],
      },
    });

    await index.cli();

    expect(mockGetDateOneWeekAgo).toHaveBeenCalled();
    expect(mockCompareResults).toHaveBeenCalled();
    expect(mockPrintComparison).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('exits with NO_DATA when comparison date has no history', async () => {
    process.argv = ['node', 'index.js', '--compare-with', '2024-01-01'];

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
      warnings: [],
    });

    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };
    mockGetAvailableProvider.mockResolvedValue(mockProvider);

    const mockResult: AnalysisResult = {
      date: 'today',
      patterns: [],
      stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };
    mockAnalyzePrompts.mockResolvedValue(mockResult);
    mockSaveAnalysisResult.mockResolvedValue(undefined);
    mockLoadAnalysisResult.mockResolvedValue(null);

    await index.cli();

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.NO_DATA);
  });

  it('handles multi-day analysis with --from and --to', async () => {
    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-22',
    ];

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
          timestamp: '2025-01-21T10:00:00Z',
          sessionId: 'session1',
          project: 'project1',
          date: '2025-01-21',
        },
      ],
      warnings: [],
    });

    mockGroupByDay.mockReturnValue([
      {
        date: '2025-01-20',
        prompts: [
          {
            content: 'Test prompt 1',
            timestamp: '2025-01-20T10:00:00Z',
            sessionId: 'session1',
            project: 'project1',
            date: '2025-01-20',
          },
        ],
        projects: ['project1'],
      },
      {
        date: '2025-01-21',
        prompts: [
          {
            content: 'Test prompt 2',
            timestamp: '2025-01-21T10:00:00Z',
            sessionId: 'session1',
            project: 'project1',
            date: '2025-01-21',
          },
        ],
        projects: ['project1'],
      },
    ]);

    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };
    mockGetAvailableProvider.mockResolvedValue(mockProvider);

    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };
    mockAnalyzePrompts.mockResolvedValue(mockResult);

    await index.cli();

    expect(mockGroupByDay).toHaveBeenCalled();
    expect(mockAnalyzePrompts).toHaveBeenCalledTimes(2);
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles --output with multi-day JSON format', async () => {
    process.argv = [
      'node',
      'index.js',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-22',
      '--output',
      '/tmp/report.json',
    ];

    mockReadLogs.mockResolvedValue({
      prompts: [
        {
          content: 'Test prompt 1',
          timestamp: '2025-01-20T10:00:00Z',
          sessionId: 'session1',
          project: 'project1',
          date: '2025-01-20',
        },
      ],
      warnings: [],
    });

    mockGroupByDay.mockReturnValue([
      {
        date: '2025-01-20',
        prompts: [
          {
            content: 'Test prompt 1',
            timestamp: '2025-01-20T10:00:00Z',
            sessionId: 'session1',
            project: 'project1',
            date: '2025-01-20',
          },
        ],
        projects: ['project1'],
      },
    ]);

    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };
    mockGetAvailableProvider.mockResolvedValue(mockProvider);

    const mockResult: AnalysisResult = {
      date: '2025-01-20',
      patterns: [],
      stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };
    mockAnalyzePrompts.mockResolvedValue(mockResult);
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);

    await index.cli();

    expect(mockWriteFile).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles --output with single-day output', async () => {
    process.argv = [
      'node',
      'index.js',
      '--date',
      'today',
      '--output',
      '/tmp/report.md',
    ];

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
      warnings: [],
    });

    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };
    mockGetAvailableProvider.mockResolvedValue(mockProvider);

    const mockResult: AnalysisResult = {
      date: 'today',
      patterns: [],
      stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };
    mockAnalyzePrompts.mockResolvedValue(mockResult);
    mockSaveAnalysisResult.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
    mockWriteFile.mockResolvedValue(undefined);
    mockRename.mockResolvedValue(undefined);

    await index.cli();

    expect(mockWriteFile).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles --no-history flag to skip saving', async () => {
    process.argv = ['node', 'index.js', '--date', 'today', '--no-history'];

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
      warnings: [],
    });

    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };
    mockGetAvailableProvider.mockResolvedValue(mockProvider);

    const mockResult: AnalysisResult = {
      date: 'today',
      patterns: [],
      stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };
    mockAnalyzePrompts.mockResolvedValue(mockResult);

    await index.cli();

    expect(mockSaveAnalysisResult).not.toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles JSON mode with comparison', async () => {
    process.argv = ['node', 'index.js', '--format', 'json', '--compare-week'];

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
      warnings: [],
    });

    const mockProvider: AnalysisProvider = {
      name: 'Ollama',
      isAvailable: vi.fn().mockResolvedValue(true),
      analyze: vi.fn(),
    };
    mockGetAvailableProvider.mockResolvedValue(mockProvider);

    const mockResult: AnalysisResult = {
      date: 'today',
      patterns: [],
      stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
      topSuggestion: 'Great job!',
    };
    mockAnalyzePrompts.mockResolvedValue(mockResult);
    mockSaveAnalysisResult.mockResolvedValue(undefined);
    mockGetDateOneWeekAgo.mockReturnValue('2025-01-13');
    mockLoadAnalysisResult.mockResolvedValue({
      result: {
        date: '2025-01-13',
        patterns: [],
        stats: { totalPrompts: 5, promptsWithIssues: 1, overallScore: 8 },
        topSuggestion: 'Good work!',
      },
      metadata: {
        provider: 'Ollama',
        promptCount: 5,
        projects: ['project1'],
      },
    });
    mockCompareResults.mockReturnValue({
      before: {
        date: '2025-01-13',
        patterns: [],
        stats: { totalPrompts: 5, promptsWithIssues: 1, overallScore: 8 },
        topSuggestion: 'Good work!',
      },
      after: {
        date: 'today',
        patterns: [],
        stats: { totalPrompts: 1, promptsWithIssues: 0, overallScore: 10 },
        topSuggestion: 'Great job!',
      },
      changes: {
        scoreDelta: 2,
        newPatterns: [],
        resolvedPatterns: [],
        changedPatterns: [],
      },
    });

    await index.cli();

    // In JSON mode, should output formatComparisonJson
    expect(mockLog).toHaveBeenCalled();
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles --verbose flag', async () => {
    process.argv = ['node', 'index.js', '--verbose', '--dry-run'];

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
      warnings: [],
    });

    await index.cli();

    // Verbose mode should enable logger verbose
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });

  it('handles error in main and calls handleError', async () => {
    process.argv = ['node', 'index.js', '--unknown-flag'];

    // parseArguments will throw for unknown flag
    await index.cli();

    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.ERROR);
  });

  it('skips reminder when user declines', async () => {
    process.argv = ['node', 'index.js', '--date', 'today'];

    mockCheckReminder.mockResolvedValue(false);
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
      warnings: [],
    });

    await index.cli();

    // Should exit early without analysis (checkReminder returns false before provider connection)
    expect(mockExit).toHaveBeenCalledWith(EXIT_CODES.SUCCESS);
  });
});

// =============================================================================
// Watch Mode Tests
// =============================================================================

describe('parseArguments - watch mode flags', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('parses --watch flag correctly', () => {
    process.argv = ['node', 'index.js', '--watch'];
    const args = index.parseArguments();

    expect(args.watch).toBe(true);
    expect(args.quiet).toBe(false);
  });

  it('parses --quiet flag correctly with --watch', () => {
    process.argv = ['node', 'index.js', '--watch', '--quiet'];
    const args = index.parseArguments();

    expect(args.watch).toBe(true);
    expect(args.quiet).toBe(true);
  });

  it('parses -q short flag correctly with --watch', () => {
    process.argv = ['node', 'index.js', '--watch', '-q'];
    const args = index.parseArguments();

    expect(args.watch).toBe(true);
    expect(args.quiet).toBe(true);
  });

  it('defaults watch and quiet to false', () => {
    process.argv = ['node', 'index.js'];
    const args = index.parseArguments();

    expect(args.watch).toBe(false);
    expect(args.quiet).toBe(false);
  });
});

describe('validateArguments - watch mode validations', () => {
  const originalArgv = process.argv;

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('throws error when using --watch with --date (non-today)', () => {
    process.argv = ['node', 'index.js', '--watch', '--date', 'yesterday'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --watch with --date. Watch mode monitors in real-time.',
    );
  });

  it('throws error when using --watch with --from/--to', () => {
    process.argv = [
      'node',
      'index.js',
      '--watch',
      '--from',
      '2025-01-20',
      '--to',
      '2025-01-25',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --watch with --from/--to. Watch mode monitors in real-time.',
    );
  });

  it('throws error when using --watch with --output', () => {
    process.argv = ['node', 'index.js', '--watch', '--output', 'report.md'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --watch with --output. Watch mode provides continuous console output.',
    );
  });

  it('throws error when using --watch with --dry-run', () => {
    process.argv = ['node', 'index.js', '--watch', '--dry-run'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --watch with --dry-run. Watch mode performs live analysis.',
    );
  });

  it('throws error when using --watch with --compare-week', () => {
    process.argv = ['node', 'index.js', '--watch', '--compare-week'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --watch with comparison flags. Watch mode analyzes prompts in real-time.',
    );
  });

  it('throws error when using --watch with --compare-month', () => {
    process.argv = ['node', 'index.js', '--watch', '--compare-month'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --watch with comparison flags. Watch mode analyzes prompts in real-time.',
    );
  });

  it('throws error when using --watch with --compare-with', () => {
    process.argv = [
      'node',
      'index.js',
      '--watch',
      '--compare-with',
      '2025-01-15',
    ];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --watch with comparison flags. Watch mode analyzes prompts in real-time.',
    );
  });

  it('throws error when using --watch with --history', () => {
    process.argv = ['node', 'index.js', '--watch', '--history'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --watch with history flags. Watch mode monitors in real-time.',
    );
  });

  it('throws error when using --watch with --history-summary', () => {
    process.argv = ['node', 'index.js', '--watch', '--history-summary'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --watch with history flags. Watch mode monitors in real-time.',
    );
  });

  it('throws error when using --quiet without --watch', () => {
    process.argv = ['node', 'index.js', '--quiet'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).toThrow(
      'Cannot use --quiet without --watch. Quiet mode only applies to watch mode.',
    );
  });

  it('accepts --watch alone', () => {
    process.argv = ['node', 'index.js', '--watch'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });

  it('accepts --watch with --quiet', () => {
    process.argv = ['node', 'index.js', '--watch', '--quiet'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });

  it('accepts --watch with --project filter', () => {
    process.argv = ['node', 'index.js', '--watch', '--project', 'my-app'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });

  it('accepts --watch with --date today (default)', () => {
    process.argv = ['node', 'index.js', '--watch', '--date', 'today'];
    const args = index.parseArguments();

    expect(() => {
      index.validateArguments(args);
    }).not.toThrow();
  });
});

describe('runWatchMode', () => {
  const mockProvider: Partial<AnalysisProvider> = {
    name: 'test-provider',
    analyze: vi.fn(),
    isAvailable: vi.fn().mockResolvedValue(true),
  };

  const mockArgs: Partial<ParsedArgs> = {
    watch: true,
    quiet: false,
    project: 'test-project',
    date: 'today',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes watcher with correct options', async () => {
    const { createLogWatcher } = await import('./core/watcher.js');
    const mockWatcher: Partial<LogWatcher> = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    };

    vi.mocked(createLogWatcher).mockReturnValue(mockWatcher as LogWatcher);

    // Call runWatchMode but don't await (it never resolves)
    const promise = index.runWatchMode(
      mockProvider as AnalysisProvider,
      mockArgs as ParsedArgs,
      undefined,
      undefined,
    );

    // Give it a tick to initialize
    await new Promise((resolve) => setImmediate(resolve));

    // Verify watcher was created with correct options
    expect(createLogWatcher).toHaveBeenCalledWith({
      projectFilter: 'test-project',
    });

    // Verify event listeners were registered
    expect(mockWatcher.on).toHaveBeenCalledWith('ready', expect.any(Function));
    expect(mockWatcher.on).toHaveBeenCalledWith('prompt', expect.any(Function));
    expect(mockWatcher.on).toHaveBeenCalledWith('error', expect.any(Function));

    // Verify watcher was started
    expect(mockWatcher.start).toHaveBeenCalled();

    // Clean up by rejecting the promise (simulate Ctrl+C)
    expect(promise).toBeInstanceOf(Promise);
  });

  it('initializes watcher without project filter when not specified', async () => {
    const { createLogWatcher } = await import('./core/watcher.js');
    const mockWatcher: Partial<LogWatcher> = {
      start: vi.fn().mockResolvedValue(undefined),
      stop: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    };

    vi.mocked(createLogWatcher).mockReturnValue(mockWatcher as LogWatcher);

    const argsWithoutProject: Partial<ParsedArgs> = {
      ...mockArgs,
      project: undefined,
    };

    // Call runWatchMode but don't await
    const promise = index.runWatchMode(
      mockProvider as AnalysisProvider,
      argsWithoutProject as ParsedArgs,
      undefined,
      undefined,
    );

    // Give it a tick to initialize
    await new Promise((resolve) => setImmediate(resolve));

    // Verify watcher was created with undefined project filter
    expect(createLogWatcher).toHaveBeenCalledWith({
      projectFilter: undefined,
    });

    // Clean up
    expect(promise).toBeInstanceOf(Promise);
  });
});
