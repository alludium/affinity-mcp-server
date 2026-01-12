/**
 * MCP Server Factory
 *
 * Creates and configures the McpServer instance with all tools registered.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerAllTools } from './tool-registry.js';

/**
 * Create a configured MCP server instance
 *
 * @returns Configured McpServer with all 28 Affinity tools registered
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: 'affinity-mcp-server',
    version: '1.0.0'
  });

  registerAllTools(server);

  return server;
}
