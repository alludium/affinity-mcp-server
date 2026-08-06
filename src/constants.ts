/**
 * Shared constants for the Affinity MCP server
 */

// API configuration
export const API_BASE_URL = 'https://api.affinity.co';
export const RATE_LIMIT_PER_MINUTE = 900;
export const MAX_RATE_LIMIT_RETRIES = 3;
export const REQUEST_TIMEOUT_MS = 30000; // 30 seconds
// Keep search below the platform's 30-second MCP tool deadline so callers receive
// a structured retry contract instead of a transport-level timeout.
export const SEARCH_REQUEST_TIMEOUT_MS = 20000;
export const TIMEOUT_RETRY_AFTER_MS = 2000;

// Response limits
export const CHARACTER_LIMIT = 25000;
export const DEFAULT_PAGE_LIMIT = 100;
export const MAX_PAGE_LIMIT = 100;
