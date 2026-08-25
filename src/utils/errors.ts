/**
 * Affinity API error response format
 */
export interface AffinityErrorResponse {
  errorId?: string;
  code?: string;
  message: string;
}

export class AffinityTimeoutError extends Error {
  public readonly code = 'AFFINITY_TIMEOUT';
  public readonly retryable = true;

  constructor(
    public readonly operation: string,
    public readonly timeoutMs: number,
    public readonly retryAfterMs: number
  ) {
    super(`Affinity ${operation} timed out after ${timeoutMs}ms`);
    this.name = 'AffinityTimeoutError';
  }
}

/**
 * Custom error class for Affinity API errors
 */
export class AffinityApiError extends Error {
  public readonly statusCode: number;
  public readonly errorId?: string;
  public readonly code?: string;

  constructor(statusCode: number, response: AffinityErrorResponse) {
    super(response.message);
    this.name = 'AffinityApiError';
    this.statusCode = statusCode;
    this.errorId = response.errorId;
    this.code = response.code;
  }

  /**
   * Format error for LLM-friendly output
   */
  toUserMessage(): string {
    const parts: string[] = [];

    switch (this.statusCode) {
      case 400:
        parts.push('Bad Request: The request parameters are invalid.');
        break;
      case 401:
        parts.push('Authentication Failed: The API key is invalid or missing.');
        parts.push('Action: Check that AFFINITY_API_KEY is set correctly.');
        break;
      case 403:
        parts.push('Permission Denied: You do not have access to this resource.');
        parts.push('Action: Use affinity_whoami to check your permissions.');
        break;
      case 404:
        parts.push('Not Found: The requested resource does not exist.');
        break;
      case 429:
        parts.push('Rate Limited: Too many requests. Please wait before retrying.');
        break;
      case 500:
      case 503:
        parts.push('Server Error: Affinity API is temporarily unavailable.');
        parts.push('Action: Wait a moment and try again.');
        break;
      default:
        parts.push(`Error (${this.statusCode}): ${this.message}`);
    }

    if (this.message && !parts[0].includes(this.message)) {
      parts.push(`Details: ${this.message}`);
    }

    return parts.join('\n');
  }
}

/**
 * Parse error response from Affinity API
 */
export async function parseErrorResponse(response: Response): Promise<AffinityApiError> {
  try {
    const data = await response.json() as AffinityErrorResponse;
    return new AffinityApiError(response.status, data);
  } catch {
    return new AffinityApiError(response.status, {
      message: `HTTP ${response.status}: ${response.statusText}`
    });
  }
}

/**
 * Format any error for tool output
 */
export function formatError(error: unknown): string {
  if (error instanceof AffinityTimeoutError) {
    return JSON.stringify({
      error: {
        code: error.code,
        message: error.message,
        retryable: error.retryable,
        retryAfterMs: error.retryAfterMs,
        guidance: 'Retry after the suggested delay. If the timeout repeats, narrow the search term.'
      }
    }, null, 2);
  }
  if (error instanceof AffinityApiError) {
    return error.toUserMessage();
  }
  if (error instanceof Error) {
    return `Error: ${error.message}`;
  }
  return `Unknown error: ${String(error)}`;
}
