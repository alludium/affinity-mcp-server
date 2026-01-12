/**
 * Stdio Transport
 *
 * Standard input/output transport for local MCP communication.
 * This is the default transport for backward compatibility.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

/**
 * Start the MCP server with stdio transport
 *
 * @param server - Configured McpServer instance
 */
export async function startStdioTransport(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio transport
  console.error('Affinity MCP server started (stdio transport)');
}
