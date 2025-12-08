import { getClient, extractCursor, formatPaginatedResponse, formatPaginatedMarkdown, formatEntityMarkdown } from '../client.js';
import { formatError } from '../utils/errors.js';
import { ListOpportunitiesInput, GetOpportunityInput } from '../schemas/inputs.js';

/**
 * Opportunity response type from Affinity API v2
 *
 * @see GET /v2/opportunities
 * @see GET /v2/opportunities/{opportunityId}
 */
interface Opportunity {
  /** Unique opportunity identifier */
  id: number;
  /** Opportunity name */
  name: string;
  /** List ID this opportunity belongs to */
  listId: number;
}

interface PaginatedOpportunitiesResponse {
  data: Opportunity[];
  pagination?: {
    nextPageToken?: string;
  };
}

/**
 * Tool definition for affinity_list_opportunities
 *
 * Validated against: GET /v2/opportunities
 */
export const listOpportunitiesToolDefinition = {
  name: 'affinity_list_opportunities',
  title: 'List Opportunities',
  description: `List opportunities from Affinity CRM.

Opportunities represent deals, fundraising leads, or other tracked items that belong to opportunity-type lists.

**Returns (JSON):**
{
  "data": [
    {
      "id": number,       // Opportunity ID
      "name": string,     // Opportunity name
      "listId": number    // The list this opportunity belongs to
    }
  ],
  "count": number,        // Items in response
  "hasMore": boolean,     // More results available
  "nextCursor": string|null, // Pagination cursor
  "summary": string       // Human-readable summary
}

**Important Notes:**
- Opportunities only return basic info (id, name, listId)
- To get field data (Status, Amount, etc.), use affinity_get_list_entries with the listId

**Example workflow:**
1. Call affinity_list_opportunities to find opportunities
2. Use the listId to call affinity_get_list_entries with fieldTypes: ["list"] to get field values`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'Filter by specific opportunity IDs. Example: [87195214]'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Number of opportunities to return per page. Default: 100, Max: 100'
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor from previous response (pagination.nextPageToken)'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" for structured data or "markdown" for human-readable. Default: "json"'
      }
    },
    required: []
  },
  annotations: {
    title: 'List Opportunities',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_get_opportunity
 *
 * Validated against: GET /v2/opportunities/{opportunityId}
 */
export const getOpportunityToolDefinition = {
  name: 'affinity_get_opportunity',
  title: 'Get Opportunity',
  description: `Get a single opportunity by ID from Affinity CRM.

Returns basic opportunity info only (id, name, listId).

**Returns (JSON):**
{
  "id": number,       // Opportunity ID
  "name": string,     // Opportunity name
  "listId": number    // The list this opportunity belongs to
}

**Important:** To get field data (Status, Amount, Owners, etc.), use affinity_get_list_entries with the opportunity's listId and fieldTypes: ["list"].`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      opportunityId: {
        type: 'string',
        description: 'Opportunity ID (numeric). Get IDs from affinity_list_opportunities.'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" for structured data or "markdown" for human-readable. Default: "json"'
      }
    },
    required: ['opportunityId']
  },
  annotations: {
    title: 'Get Opportunity',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Format an opportunity for markdown output
 */
function formatOpportunityMarkdown(opportunity: Opportunity): string {
  const lines: string[] = [];
  lines.push(`## ${opportunity.name} (ID: ${opportunity.id})`);
  lines.push(`- **List ID:** ${opportunity.listId}`);
  return lines.join('\n');
}

/**
 * Execute list opportunities tool
 *
 * @see GET /v2/opportunities
 */
export async function executeListOpportunities(input: ListOpportunitiesInput): Promise<string> {
  try {
    const client = getClient();

    // Build params - only include what's provided (API has sensible defaults)
    const params: Record<string, string | number | number[] | undefined> = {};

    if (input.ids && input.ids.length > 0) {
      params.ids = input.ids;
    }
    if (input.limit !== undefined) {
      params.limit = input.limit;
    }
    if (input.cursor) {
      params.cursor = input.cursor;
    }

    const response = await client.get<PaginatedOpportunitiesResponse>('/v2/opportunities', params);
    const nextCursor = extractCursor(response);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      return formatPaginatedMarkdown(
        response.data,
        nextCursor,
        'Opportunities',
        (item) => formatOpportunityMarkdown(item)
      );
    }

    const result = formatPaginatedResponse(response.data, nextCursor, 'opportunities');
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute get opportunity tool
 *
 * @see GET /v2/opportunities/{opportunityId}
 */
export async function executeGetOpportunity(input: GetOpportunityInput): Promise<string> {
  try {
    const client = getClient();

    const response = await client.get<Opportunity>(`/v2/opportunities/${input.opportunityId}`);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      return formatEntityMarkdown(response.name, [
        { content: formatOpportunityMarkdown(response) }
      ]);
    }

    return JSON.stringify(response, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
