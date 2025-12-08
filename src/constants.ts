/**
 * Shared constants for the Affinity MCP server
 */

// API configuration
export const API_BASE_URL = 'https://api.affinity.co';
export const RATE_LIMIT_PER_MINUTE = 900;
export const MAX_RATE_LIMIT_RETRIES = 3;
export const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

// Response limits
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_PAGE_LIMIT = 100;
export const MAX_PAGE_LIMIT = 100;
