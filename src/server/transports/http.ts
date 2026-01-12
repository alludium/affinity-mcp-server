/**
 * Streamable HTTP Transport
 *
 * HTTP transport for remote MCP communication with optional Bearer token authentication.
 * Uses the modern Streamable HTTP transport (recommended over SSE).
 */

import express, { Request, Response, NextFunction } from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpServer } from '../create-server.js';

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig {
  /** Port to listen on */
  port: number;
  /** Optional Bearer token for authentication */
  authToken?: string;
}

/**
 * Start the MCP server with Streamable HTTP transport
 *
 * @param config - HTTP transport configuration
 */
export async function startHttpTransport(config: HttpTransportConfig): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  // Optional Bearer token authentication
  if (config.authToken) {
    app.use('/mcp', (req: Request, res: Response, next: NextFunction) => {
      const auth = req.headers.authorization;
      if (!auth || auth !== `Bearer ${config.authToken}`) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }
      next();
    });
  }

  // Health check endpoint
  app.get('/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', transport: 'streamable-http' });
  });

  // MCP endpoint - handles all requests (stateless mode)
  app.post('/mcp', async (req: Request, res: Response) => {
    // Create fresh server and transport for each request (stateless)
    const server = createMcpServer();
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // Stateless mode
      enableJsonResponse: true
    });

    res.on('close', () => {
      transport.close();
    });

    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error('MCP request error:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null
        });
      }
    }
  });

  // Handle GET and DELETE for session management (return 405 in stateless mode)
  app.get('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({
      error: 'Method not allowed',
      message: 'This server runs in stateless mode. Use POST for MCP requests.'
    });
  });

  app.delete('/mcp', (_req: Request, res: Response) => {
    res.status(405).json({
      error: 'Method not allowed',
      message: 'This server runs in stateless mode. Session management is not supported.'
    });
  });

  app.listen(config.port, () => {
    console.error(`Affinity MCP server started (HTTP transport) on port ${config.port}`);
    console.error(`Endpoint: http://localhost:${config.port}/mcp`);
    console.error(`Health check: http://localhost:${config.port}/health`);
    if (config.authToken) {
      console.error('Authentication: Bearer token required');
    }
  });
}
