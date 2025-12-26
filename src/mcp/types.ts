/**
 * MCP Server Types
 *
 * Type definitions specific to the MCP (Model Context Protocol) server implementation.
 */

/**
 * Options for initializing the MCP server.
 */
export type McpServerOptions = {
  readonly name: string;
  readonly version: string;
};

/**
 * MCP server lifecycle state.
 */
export type McpServerState = 'stopped' | 'starting' | 'running' | 'stopping';
