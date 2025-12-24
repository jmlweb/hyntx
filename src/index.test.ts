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
}));

vi.mock('./core/reporter.js', () => ({
  printReport: vi.fn(),
  formatJson: vi.fn((result, compact) =>
    compact ? JSON.stringify(result) : JSON.stringify(result, null, 2),
  ),
  formatMarkdown: vi.fn(() => '# Markdown Report'),
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
      false,
    );

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
