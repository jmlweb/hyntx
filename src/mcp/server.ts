/**
 * Hyntx MCP Server
 *
 * Implements the Model Context Protocol server for hyntx, enabling
 * integration with MCP-compatible clients for prompt analysis.
 */

import { Server as McpServerInternal } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { analyzePrompts } from '../core/analyzer.js';
import type { AnalysisProvider } from '../types/index.js';
import type { AnalysisPattern } from '../types/index.js';
import { logger } from '../utils/logger-base.js';
import type { McpServerOptions, McpServerState } from './types.js';

/**
 * MCP tool response type.
 */
type McpToolResponse = {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
};

/**
 * Validates prompt input from tool arguments.
 *
 * @param args - Tool arguments
 * @returns Error response if validation fails, null otherwise
 */
function validatePromptInput(
  args: Record<string, unknown>,
): McpToolResponse | null {
  if (typeof args['prompt'] !== 'string' || !args['prompt'].trim()) {
    return {
      content: [
        {
          type: 'text',
          text: 'Invalid input: prompt must be a non-empty string',
        },
      ],
      isError: true,
    };
  }
  return null;
}

/**
 * Extracts date from tool arguments or returns current date.
 *
 * @param args - Tool arguments
 * @returns ISO date string
 */
function extractDate(args: Record<string, unknown>): string {
  return typeof args['date'] === 'string' && args['date']
    ? args['date']
    : new Date().toISOString();
}

/**
 * Formats error response for tool calls.
 *
 * @param toolName - Name of the tool that failed
 * @param error - The error that occurred
 * @returns Formatted error response
 */
function formatToolError(toolName: string, error: unknown): McpToolResponse {
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(`${toolName} error: ${errorMessage}`, 'mcp');
  return {
    content: [
      {
        type: 'text' as const,
        text: `Analysis failed: ${errorMessage}`,
      },
    ],
    isError: true,
  };
}

/**
 * Determines if a pattern is related to context issues.
 *
 * @param pattern - The analysis pattern to check
 * @returns True if pattern is context-related
 */
function isContextRelatedPattern(pattern: AnalysisPattern): boolean {
  const id = pattern.id.toLowerCase();
  const name = pattern.name.toLowerCase();
  return (
    id === 'no-context' ||
    name.includes('context') ||
    name.includes('vague') ||
    id.includes('vague')
  );
}

/**
 * Hyntx MCP Server implementation.
 *
 * This server provides MCP-compatible access to hyntx's prompt analysis
 * functionality. It connects via stdio transport for JSON-RPC communication.
 *
 * Note: We use the low-level Server API from the SDK as it provides the necessary
 * control for our use case. The high-level McpServer is designed for simpler scenarios.
 *
 * @example
 * ```typescript
 * const provider = await getAvailableProvider(config);
 * const server = new HyntxMcpServer(provider, {
 *   name: 'hyntx',
 *   version: '1.5.0'
 * });
 * await server.start();
 * ```
 */
export class HyntxMcpServer {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private readonly server: McpServerInternal;
  private readonly provider: AnalysisProvider;
  private state: McpServerState = 'stopped';
  private transport?: StdioServerTransport;
  private shutdownHandler?: () => void;

  /**
   * Creates a new MCP server instance.
   *
   * @param provider - The analysis provider to use for prompt analysis
   * @param options - Server configuration options
   */
  constructor(provider: AnalysisProvider, options: McpServerOptions) {
    this.provider = provider;

    // Initialize the MCP server with metadata
    // We use the low-level Server API for advanced control
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    this.server = new McpServerInternal(
      {
        name: options.name,
        version: options.version,
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Register tool list handler
    this.server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: [
        {
          name: 'analyze-prompt',
          description:
            'Analyze a prompt to detect patterns, issues, and suggest improvements',
          inputSchema: {
            type: 'object' as const,
            properties: {
              prompt: {
                type: 'string',
                description: 'The prompt text to analyze',
              },
              date: {
                type: 'string',
                description:
                  'Optional date context (ISO format). Defaults to current date.',
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'suggest-improvements',
          description: 'Provide before/after rewrites for improving a prompt',
          inputSchema: {
            type: 'object' as const,
            properties: {
              prompt: {
                type: 'string',
                description: 'The prompt text to analyze for improvements',
              },
              date: {
                type: 'string',
                description:
                  'Optional date context (ISO format). Defaults to current date.',
              },
            },
            required: ['prompt'],
          },
        },
        {
          name: 'check-context',
          description:
            'Assess if a prompt has sufficient context for effective AI interaction',
          inputSchema: {
            type: 'object' as const,
            properties: {
              prompt: {
                type: 'string',
                description: 'The prompt text to check for context',
              },
              date: {
                type: 'string',
                description:
                  'Optional date context (ISO format). Defaults to current date.',
              },
            },
            required: ['prompt'],
          },
        },
      ],
    }));

    // Register tool call handler
    this.server.setRequestHandler(
      CallToolRequestSchema,
      async (request: {
        params: { name: string; arguments?: Record<string, unknown> };
      }) => {
        const { name, arguments: args = {} } = request.params;

        try {
          switch (name) {
            case 'analyze-prompt':
              return await this.handleAnalyzePrompt(args);
            case 'suggest-improvements':
              return await this.handleSuggestImprovements(args);
            case 'check-context':
              return await this.handleCheckContext(args);
            default:
              return {
                content: [
                  {
                    type: 'text',
                    text: `Unknown tool: ${name}`,
                  },
                ],
                isError: true,
              };
          }
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(`Tool call error (${name}): ${errorMessage}`, 'mcp');
          return {
            content: [
              {
                type: 'text',
                text: `Error executing ${name}: ${errorMessage}`,
              },
            ],
            isError: true,
          };
        }
      },
    );

    logger.debug(
      `MCP server initialized: ${options.name} v${options.version}`,
      'mcp',
    );
  }

  /**
   * Starts the MCP server and connects to stdio transport.
   *
   * This method sets up signal handlers for graceful shutdown and begins
   * listening for MCP requests via stdin/stdout.
   *
   * @throws Error if server is already running or if startup fails
   */
  async start(): Promise<void> {
    if (this.state !== 'stopped') {
      throw new Error(`Cannot start server: already ${this.state}`);
    }

    this.state = 'starting';
    logger.debug('Starting MCP server...', 'mcp');

    try {
      // Create stdio transport for JSON-RPC communication
      this.transport = new StdioServerTransport();

      // Set up signal handlers for graceful shutdown
      this.setupSignalHandlers();

      // Connect server to transport
      await this.server.connect(this.transport);

      this.state = 'running';
      logger.debug('MCP server started successfully', 'mcp');

      // CRITICAL: All logging must go to stderr in MCP mode
      // Writing to stdout corrupts the JSON-RPC protocol
      process.stderr.write('MCP server running on stdio\n');
    } catch (error) {
      this.state = 'stopped';
      this.removeSignalHandlers();
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Failed to start MCP server: ${errorMessage}`, 'mcp');
      throw error;
    }
  }

  /**
   * Stops the MCP server and cleans up resources.
   *
   * This method performs graceful shutdown, closing the transport and
   * removing signal handlers.
   *
   * @throws Error if server is not running
   */
  async stop(): Promise<void> {
    if (this.state !== 'running') {
      throw new Error(`Cannot stop server: not running (state: ${this.state})`);
    }

    this.state = 'stopping';
    logger.debug('Stopping MCP server...', 'mcp');

    try {
      // Remove signal handlers
      this.removeSignalHandlers();

      // Close transport
      if (this.transport) {
        await this.transport.close();
        this.transport = undefined;
      }

      this.state = 'stopped';
      logger.debug('MCP server stopped successfully', 'mcp');
    } catch (error) {
      this.state = 'stopped';
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error stopping MCP server: ${errorMessage}`, 'mcp');
      throw error;
    }
  }

  /**
   * Returns the current state of the server.
   *
   * @returns Current server state
   */
  getState(): McpServerState {
    return this.state;
  }

  /**
   * Returns the analysis provider used by this server.
   *
   * @returns The configured analysis provider
   */
  getProvider(): AnalysisProvider {
    return this.provider;
  }

  /**
   * Sets up signal handlers for graceful shutdown.
   *
   * Handles SIGINT (Ctrl+C) and SIGTERM for clean server termination.
   */
  private setupSignalHandlers(): void {
    this.shutdownHandler = (): void => {
      logger.debug('Received shutdown signal', 'mcp');
      void this.stop().then(
        () => {
          process.exit(0);
        },
        (error: unknown) => {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          logger.error(`Shutdown error: ${errorMessage}`, 'mcp');
          process.exit(1);
        },
      );
    };

    process.on('SIGINT', this.shutdownHandler);
    process.on('SIGTERM', this.shutdownHandler);
  }

  /**
   * Removes signal handlers during shutdown.
   */
  private removeSignalHandlers(): void {
    if (this.shutdownHandler) {
      process.off('SIGINT', this.shutdownHandler);
      process.off('SIGTERM', this.shutdownHandler);
      this.shutdownHandler = undefined;
    }
  }

  /**
   * Handles the analyze-prompt tool call.
   * Analyzes a single prompt and returns detected patterns with severity and suggestions.
   *
   * @param args - Tool arguments containing prompt and optional date
   * @returns Tool call result with analysis data or error
   */
  private async handleAnalyzePrompt(
    args: Record<string, unknown>,
  ): Promise<McpToolResponse> {
    try {
      // Validate input
      const validationError = validatePromptInput(args);
      if (validationError) {
        return validationError;
      }

      const prompt = args['prompt'] as string;
      const date = extractDate(args);

      logger.debug('Executing analyze-prompt tool', 'mcp');

      // Analyze the prompt
      const result = await analyzePrompts({
        provider: this.provider,
        prompts: [prompt],
        date,
        noCache: false,
      });

      // Format response as JSON
      const response = JSON.stringify(
        {
          patterns: result.patterns.map((p) => ({
            id: p.id,
            name: p.name,
            severity: p.severity,
            frequency: p.frequency,
            suggestion: p.suggestion,
            examples: p.examples,
          })),
          stats: result.stats,
          topSuggestion: result.topSuggestion,
          date: result.date,
        },
        null,
        2,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: response,
          },
        ],
      };
    } catch (error) {
      return formatToolError('analyze-prompt', error);
    }
  }

  /**
   * Handles the suggest-improvements tool call.
   * Provides before/after rewrites for improving the prompt.
   *
   * @param args - Tool arguments containing prompt and optional date
   * @returns Tool call result with improvement suggestions or error
   */
  private async handleSuggestImprovements(
    args: Record<string, unknown>,
  ): Promise<McpToolResponse> {
    try {
      // Validate input
      const validationError = validatePromptInput(args);
      if (validationError) {
        return validationError;
      }

      const prompt = args['prompt'] as string;
      const date = extractDate(args);

      logger.debug('Executing suggest-improvements tool', 'mcp');

      // Analyze the prompt
      const result = await analyzePrompts({
        provider: this.provider,
        prompts: [prompt],
        date,
        noCache: false,
      });

      // Extract before/after improvements from patterns
      const improvements = result.patterns.map((p) => ({
        issue: p.name,
        before: p.beforeAfter.before,
        after: p.beforeAfter.after,
        suggestion: p.suggestion,
      }));

      const response = JSON.stringify(
        {
          improvements,
          summary:
            improvements.length > 0
              ? `Found ${String(improvements.length)} improvement(s)`
              : 'No improvements needed',
          topSuggestion: result.topSuggestion,
        },
        null,
        2,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: response,
          },
        ],
      };
    } catch (error) {
      return formatToolError('suggest-improvements', error);
    }
  }

  /**
   * Handles the check-context tool call.
   * Assesses if prompt has sufficient context.
   *
   * @param args - Tool arguments containing prompt and optional date
   * @returns Tool call result with context assessment or error
   */
  private async handleCheckContext(
    args: Record<string, unknown>,
  ): Promise<McpToolResponse> {
    try {
      // Validate input
      const validationError = validatePromptInput(args);
      if (validationError) {
        return validationError;
      }

      const prompt = args['prompt'] as string;
      const date = extractDate(args);

      logger.debug('Executing check-context tool', 'mcp');

      // Analyze the prompt
      const result = await analyzePrompts({
        provider: this.provider,
        prompts: [prompt],
        date,
        noCache: false,
      });

      // Check for no-context pattern
      const noContextPattern = result.patterns.find(
        (p) =>
          p.id === 'no-context' || p.name.toLowerCase().includes('context'),
      );

      const hasContextIssue = !!noContextPattern;
      const hasSufficientContext = !hasContextIssue;

      // Collect all context-related issues using helper function
      const contextIssues = result.patterns
        .filter(isContextRelatedPattern)
        .map((p) => p.name);

      const response = JSON.stringify(
        {
          hasSufficientContext,
          score: result.stats.overallScore,
          issues: contextIssues,
          suggestion: noContextPattern?.suggestion ?? result.topSuggestion,
          details: hasContextIssue
            ? 'Prompt lacks sufficient context for effective AI interaction'
            : 'Prompt has adequate context',
        },
        null,
        2,
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: response,
          },
        ],
      };
    } catch (error) {
      return formatToolError('check-context', error);
    }
  }
}
