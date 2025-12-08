import { parseErrorResponse, AffinityApiError } from './utils/errors.js';
import {
  API_BASE_URL,
  RATE_LIMIT_PER_MINUTE,
  MAX_RATE_LIMIT_RETRIES,
  CHARACTER_LIMIT,
  REQUEST_TIMEOUT_MS
} from './constants.js';
import type { ResponseFormat } from './schemas/inputs.js';

interface RateLimitInfo {
  remaining: number;
  resetAt: Date;
}

interface PaginatedResponse<T> {
  data: T[];
  pagination?: {
    nextPageToken?: string;
    hasMore?: boolean;
  };
}

interface FormattedResponse<T> {
  data: T[];
  count: number;
  hasMore: boolean;
  nextCursor: string | null;
  summary: string;
  truncated?: boolean;
  truncationMessage?: string;
}

/**
 * Affinity API client with authentication, rate limiting, and error handling
 */
export class AffinityClient {
  private apiKey: string;
  private rateLimitInfo: RateLimitInfo = {
    remaining: RATE_LIMIT_PER_MINUTE,
    resetAt: new Date()
  };

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('AFFINITY_API_KEY is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Make authenticated request to Affinity API with retry support and timeout
   */
  async fetch<T>(
    path: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    const url = `${API_BASE_URL}${path}`;

    // Create abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms. The Affinity API may be slow or unavailable.`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    // Update rate limit info from headers
    this.updateRateLimitInfo(response);

    if (!response.ok) {
      const error = await parseErrorResponse(response);

      // Handle rate limiting with retry (with max attempts)
      if (response.status === 429 && retryCount < MAX_RATE_LIMIT_RETRIES) {
        const waitMs = this.getRetryWaitTime();
        if (waitMs > 0 && waitMs < 60000) {
          await this.sleep(waitMs);
          return this.fetch<T>(path, options, retryCount + 1);
        }
      }

      throw error;
    }

    return response.json() as Promise<T>;
  }

  /**
   * GET request helper
   */
  async get<T>(path: string, params?: Record<string, string | string[] | number | number[] | undefined>): Promise<T> {
    // Build query string from params
    const searchParams = new URLSearchParams();

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;

        if (Array.isArray(value)) {
          value.forEach(v => searchParams.append(key, String(v)));
        } else {
          searchParams.set(key, String(value));
        }
      }
    }

    const queryString = searchParams.toString();
    const fullPath = queryString ? `${path}?${queryString}` : path;

    return this.fetch<T>(fullPath);
  }

  /**
   * PATCH request helper
   */
  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.fetch<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  /**
   * POST request helper
   */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.fetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * Update rate limit tracking from response headers
   */
  private updateRateLimitInfo(response: Response): void {
    // Headers are case-insensitive, try both formats
    const remaining = response.headers.get('X-Ratelimit-Limit-User-Remaining')
      || response.headers.get('x-ratelimit-limit-user-remaining');
    const reset = response.headers.get('X-Ratelimit-Limit-User-Reset')
      || response.headers.get('x-ratelimit-limit-user-reset');

    if (remaining) {
      this.rateLimitInfo.remaining = parseInt(remaining, 10);
    }
    if (reset) {
      this.rateLimitInfo.resetAt = new Date(Date.now() + parseInt(reset, 10) * 1000);
    }
  }

  /**
   * Calculate wait time for rate limit retry
   */
  private getRetryWaitTime(): number {
    const now = Date.now();
    const resetTime = this.rateLimitInfo.resetAt.getTime();
    return Math.max(0, resetTime - now);
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status (for debugging/monitoring)
   */
  getRateLimitStatus(): RateLimitInfo {
    return { ...this.rateLimitInfo };
  }
}

// Singleton client instance
let clientInstance: AffinityClient | null = null;

/**
 * Get or create the Affinity client instance
 */
export function getClient(): AffinityClient {
  if (!clientInstance) {
    const apiKey = process.env.AFFINITY_API_KEY;
    if (!apiKey) {
      throw new Error('AFFINITY_API_KEY environment variable is not set');
    }
    clientInstance = new AffinityClient(apiKey);
  }
  return clientInstance;
}

/**
 * Extract pagination cursor from response
 */
export function extractCursor<T>(response: PaginatedResponse<T>): string | null {
  return response.pagination?.nextPageToken || null;
}

/**
 * Format paginated response for tool output with truncation support
 */
export function formatPaginatedResponse<T>(
  data: T[],
  nextCursor: string | null,
  totalLabel: string = 'items'
): FormattedResponse<T> {
  const response: FormattedResponse<T> = {
    data,
    count: data.length,
    hasMore: !!nextCursor,
    nextCursor,
    summary: `Found ${data.length} ${totalLabel}${nextCursor ? ' (more available with cursor)' : ''}`
  };

  // Check if response exceeds character limit
  const serialized = JSON.stringify(response);
  if (serialized.length > CHARACTER_LIMIT) {
    // Truncate data array to fit within limit
    const truncatedData = data.slice(0, Math.max(1, Math.floor(data.length / 2)));
    response.data = truncatedData;
    response.count = truncatedData.length;
    response.truncated = true;
    response.truncationMessage = `Response truncated from ${data.length} to ${truncatedData.length} ${totalLabel}. Use 'cursor' parameter or add filters to see more results.`;
    response.summary = `Found ${truncatedData.length} ${totalLabel} (truncated from ${data.length})${nextCursor ? ' - more available with cursor' : ''}`;
  }

  return response;
}

/**
 * Format paginated response as markdown
 */
export function formatPaginatedMarkdown<T>(
  data: T[],
  nextCursor: string | null,
  entityName: string,
  formatItem: (item: T, index: number) => string
): string {
  const lines: string[] = [];

  lines.push(`# ${entityName}`);
  lines.push('');
  lines.push(`Found **${data.length}** ${entityName.toLowerCase()}${nextCursor ? ' (more available)' : ''}`);
  lines.push('');

  for (let i = 0; i < data.length; i++) {
    lines.push(formatItem(data[i], i));
    lines.push('');
  }

  if (nextCursor) {
    lines.push('---');
    lines.push(`*More results available. Use cursor: \`${nextCursor}\`*`);
  }

  let result = lines.join('\n');

  // Check character limit
  if (result.length > CHARACTER_LIMIT) {
    const halfData = data.slice(0, Math.max(1, Math.floor(data.length / 2)));
    const truncatedLines: string[] = [];
    truncatedLines.push(`# ${entityName}`);
    truncatedLines.push('');
    truncatedLines.push(`**Showing ${halfData.length} of ${data.length} ${entityName.toLowerCase()}** (truncated)`);
    truncatedLines.push('');

    for (let i = 0; i < halfData.length; i++) {
      truncatedLines.push(formatItem(halfData[i], i));
      truncatedLines.push('');
    }

    truncatedLines.push('---');
    truncatedLines.push(`*Response truncated. Use cursor or filters to see more results.*`);

    result = truncatedLines.join('\n');
  }

  return result;
}

/**
 * Format a single entity as markdown
 */
export function formatEntityMarkdown(
  title: string,
  sections: Array<{ heading?: string; content: string }>
): string {
  const lines: string[] = [];

  lines.push(`# ${title}`);
  lines.push('');

  for (const section of sections) {
    if (section.heading) {
      lines.push(`## ${section.heading}`);
      lines.push('');
    }
    lines.push(section.content);
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format response based on requested format
 */
export function formatResponse<T>(
  data: T,
  format: ResponseFormat
): string {
  if (format === 'markdown' && typeof data === 'string') {
    return data;
  }
  return JSON.stringify(data, null, 2);
}
