/**
 * Affinity API V1 Client
 *
 * V1 API uses Basic Authentication and has different response formats than V2.
 * Used for: Search, Create, Delete operations (not available in V2)
 *
 * Key differences from V2:
 * - Authentication: Basic Auth with empty username (`:apiKey` base64 encoded)
 * - No API version header required
 * - Pagination: `next_page_token` field (not `nextPageToken`)
 * - Response arrays: `persons`, `organizations` (not `data`)
 * - Max page_size: 500 (V2 max is 100)
 *
 * @see https://api-docs.affinity.co/
 */

import { parseErrorResponse, AffinityApiError } from './utils/errors.js';
import {
  API_BASE_URL,
  RATE_LIMIT_PER_MINUTE,
  MAX_RATE_LIMIT_RETRIES,
  REQUEST_TIMEOUT_MS
} from './constants.js';

interface RateLimitInfo {
  remaining: number;
  resetAt: Date;
}

/**
 * Affinity API V1 client with Basic Authentication
 */
export class AffinityClientV1 {
  private apiKey: string;
  private authHeader: string;
  private rateLimitInfo: RateLimitInfo = {
    remaining: RATE_LIMIT_PER_MINUTE,
    resetAt: new Date()
  };

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('AFFINITY_API_KEY is required');
    }
    this.apiKey = apiKey;
    // V1 uses Basic Auth with format `:apiKey` (empty username, apiKey as password)
    // The colon prefix is critical - it represents empty username
    this.authHeader = `Basic ${Buffer.from(`:${apiKey}`).toString('base64')}`;
  }

  /**
   * Make authenticated request to Affinity V1 API with retry support and timeout
   */
  async fetch<T>(
    path: string,
    options: RequestInit = {},
    retryCount: number = 0
  ): Promise<T> {
    // V1 endpoints do NOT have /v2 prefix - they use the root path
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
          'Authorization': this.authHeader,
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
      const error = await this.parseV1ErrorResponse(response);

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
   * GET request helper for V1 API
   *
   * @param path - API path (without /v2 prefix, e.g., '/persons')
   * @param params - Query parameters
   */
  async get<T>(path: string, params?: Record<string, string | string[] | number | boolean | undefined>): Promise<T> {
    const searchParams = new URLSearchParams();

    if (params) {
      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;

        if (Array.isArray(value)) {
          // V1 API uses repeated params for arrays
          value.forEach(v => searchParams.append(key, String(v)));
        } else if (typeof value === 'boolean') {
          // V1 API expects 'true'/'false' strings for booleans
          searchParams.set(key, value ? 'true' : 'false');
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
   * POST request helper for V1 API
   *
   * @param path - API path (without /v2 prefix, e.g., '/persons')
   * @param body - Request body
   */
  async post<T>(path: string, body: unknown): Promise<T> {
    return this.fetch<T>(path, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  /**
   * DELETE request helper for V1 API
   *
   * @param path - API path (without /v2 prefix, e.g., '/persons/123')
   */
  async delete<T>(path: string): Promise<T> {
    return this.fetch<T>(path, {
      method: 'DELETE'
    });
  }

  /**
   * Parse V1 API error response
   *
   * V1 errors can have different formats:
   * - { message: "..." } - Standard error
   * - ["Error message"] - Array of error strings (e.g., duplicate email)
   * - Plain text
   */
  private async parseV1ErrorResponse(response: Response): Promise<AffinityApiError> {
    try {
      const text = await response.text();

      // Try to parse as JSON
      try {
        const data = JSON.parse(text);

        // Handle array format (e.g., duplicate email error returns ["There exists a contact..."])
        if (Array.isArray(data)) {
          return new AffinityApiError(response.status, {
            message: data.join('; ')
          });
        }

        // Handle object format
        if (typeof data === 'object' && data !== null) {
          return new AffinityApiError(response.status, {
            message: data.message || data.error || JSON.stringify(data),
            code: data.code,
            errorId: data.errorId
          });
        }

        // Fallback for other JSON types
        return new AffinityApiError(response.status, {
          message: String(data)
        });
      } catch {
        // Not JSON, use text as message
        return new AffinityApiError(response.status, {
          message: text || `HTTP ${response.status}: ${response.statusText}`
        });
      }
    } catch {
      return new AffinityApiError(response.status, {
        message: `HTTP ${response.status}: ${response.statusText}`
      });
    }
  }

  /**
   * Update rate limit tracking from response headers
   */
  private updateRateLimitInfo(response: Response): void {
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
let clientV1Instance: AffinityClientV1 | null = null;

/**
 * Get or create the Affinity V1 client instance
 */
export function getClientV1(): AffinityClientV1 {
  if (!clientV1Instance) {
    const apiKey = process.env.AFFINITY_API_KEY;
    if (!apiKey) {
      throw new Error('AFFINITY_API_KEY environment variable is not set');
    }
    clientV1Instance = new AffinityClientV1(apiKey);
  }
  return clientV1Instance;
}

/**
 * V1 API constants
 */
export const V1_MAX_PAGE_SIZE = 500;
export const V1_DEFAULT_PAGE_SIZE = 100;
