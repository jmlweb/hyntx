/**
 * Hyntx MCP Server
 *
 * Implements the Model Context Protocol server for hyntx, enabling
 * integration with MCP-compatible clients for prompt analysis.
 */

import { Server as McpServerInternal } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { AnalysisProvider } from '../types/index.js';
import { logger } from '../utils/logger-base.js';
import type { McpServerOptions, McpServerState } from './types.js';

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
          tools: {}, // No tools yet - deferred to issue #43
        },
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
}
