#!/usr/bin/env node
/**
 * Affinity MCP Server Entry Point
 *
 * Supports two transport modes:
 * - stdio (default): Standard input/output for local MCP communication
 * - http: Streamable HTTP transport for remote access
 *
 * Environment Variables:
 * - AFFINITY_API_KEY: Required. Affinity API key.
 * - TRANSPORT: Optional. 'stdio' (default) or 'http'.
 * - PORT: Optional. HTTP port when TRANSPORT=http (default: 3000).
 * - MCP_AUTH_TOKEN: Optional. Bearer token for HTTP authentication.
 */

import 'dotenv/config';
import { createMcpServer } from './server/create-server.js';
import { startStdioTransport } from './server/transports/stdio.js';
import { startHttpTransport } from './server/transports/http.js';

async function main(): Promise<void> {
  // Validate required environment
  if (!process.env.AFFINITY_API_KEY) {
    console.error('Error: AFFINITY_API_KEY environment variable is required');
    console.error('Set it in your environment or .env file');
    process.exit(1);
  }

  // Get transport mode (default: stdio for backward compatibility)
  const transportMode = process.env.TRANSPORT || 'stdio';

  switch (transportMode) {
    case 'stdio': {
      const server = createMcpServer();
      await startStdioTransport(server);
      break;
    }

    case 'http': {
      const port = parseInt(process.env.PORT || '3000', 10);
      const authToken = process.env.MCP_AUTH_TOKEN;
      await startHttpTransport({ port, authToken });
      break;
    }

    default:
      console.error(`Unknown transport: ${transportMode}`);
      console.error('Valid options: stdio, http');
      process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
