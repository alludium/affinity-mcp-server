import { getClient, extractCursor, formatPaginatedResponse, formatPaginatedMarkdown, formatEntityMarkdown } from '../client.js';
import { formatError } from '../utils/errors.js';
import { ListListsInput, GetListEntriesInput } from '../schemas/inputs.js';

/**
 * List response type from Affinity API v2
 *
 * @see GET /v2/lists
 */
interface AffinityList {
  /** Unique list identifier */
  id: number;
  /** List display name */
  name: string;
  /** What entities the list contains */
  type: 'person' | 'company' | 'opportunity';
  /** User ID who created the list */
  creatorId: number;
  /** User ID who owns the list */
  ownerId: number;
  /** Whether list is visible to all users */
  isPublic: boolean;
}

interface PaginatedListsResponse {
  data: AffinityList[];
  pagination?: {
    nextPageToken?: string;
  };
}

/**
 * List entry response type from Affinity API v2
 *
 * @see GET /v2/lists/{listId}/list-entries
 */
interface ListEntry {
  /** Unique entry identifier within this list */
  id: number;
  /** List this entry belongs to */
  listId: number;
  /** User ID who created the entry */
  creatorId?: number;
  /** Entity type: company, person, or opportunity */
  type: 'company' | 'person' | 'opportunity';
  /** When entry was added to the list */
  createdAt: string;
  /** The entity data (company/person/opportunity with fields) */
  entity: {
    id: number;
    name: string;
    domain?: string;
    isGlobal?: boolean;
    fields?: Array<{
      id: string;
      type: 'enriched' | 'global' | 'list';
      name: string;
      value: {
        type: string;
        data: unknown;
      };
    }>;
  };
}

interface PaginatedListEntriesResponse {
  data: ListEntry[];
  pagination?: {
    nextPageToken?: string;
  };
}

/**
 * Tool definition for affinity_list_lists
 *
 * Validated against: GET /v2/lists
 */
export const listListsToolDefinition = {
  name: 'affinity_list_lists',
  title: 'List Lists',
  description: `Get all lists in Affinity CRM.

Lists are spreadsheet-like collections containing companies, persons, or opportunities. Each list has custom fields for tracking deals, contacts, etc.

**Returns (JSON):**
{
  "data": [
    {
      "id": number,         // List ID (use for affinity_get_list_entries)
      "name": string,       // List display name
      "type": string,       // "company", "person", or "opportunity"
      "creatorId": number,  // User who created the list
      "ownerId": number,    // User who owns the list
      "isPublic": boolean   // Whether visible to all users
    }
  ],
  "count": number,          // Items in response
  "hasMore": boolean,       // More results available
  "nextCursor": string|null, // Pagination cursor
  "summary": string         // Human-readable summary
}

**Note:** To get list fields/columns, use GET /v2/lists/{listId}/fields (not yet implemented).
To get list entries (rows), use affinity_get_list_entries with the list ID.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Number of lists to return per page. Default: 100, Max: 100'
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
    title: 'List Lists',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_get_list_entries
 *
 * Validated against: GET /v2/lists/{listId}/list-entries
 */
export const getListEntriesToolDefinition = {
  name: 'affinity_get_list_entries',
  title: 'Get List Entries',
  description: `Get entries (rows) from a specific Affinity list.

Each entry represents a company, person, or opportunity on the list with its field values.

**Returns (JSON):**
{
  "data": [
    {
      "id": number,           // Entry ID (unique within this list)
      "listId": number,       // The list this entry belongs to
      "creatorId": number,    // User who added the entry
      "type": string,         // "company", "person", or "opportunity"
      "createdAt": string,    // When entry was added (ISO timestamp)
      "entity": {
        "id": number,         // Company/Person/Opportunity ID
        "name": string,       // Entity name
        "domain": string,     // Domain (for companies)
        "isGlobal": boolean,  // Is shared record
        "fields": [           // Field values (if requested)
          {
            "id": string,
            "type": string,
            "name": string,
            "value": { "type": string, "data": any }
          }
        ]
      }
    }
  ],
  "count": number,            // Items in response
  "hasMore": boolean,         // More results available
  "nextCursor": string|null,  // Pagination cursor
  "summary": string           // Human-readable summary
}

**Field Types:**
- enriched: Affinity Data fields (description, employees, funding, etc.)
- global: Account-wide custom fields
- list: List-specific fields (Status, Amount, Owners, Priority, etc.)

**Important:** Fields are nested inside entity.fields, not at the entry level.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      listId: {
        type: 'string',
        description: 'List ID (numeric). Get from affinity_list_lists. Example: "95303"'
      },
      fieldTypes: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['enriched', 'global', 'list']
        },
        description: 'Field categories to include. Options: "enriched", "global", "list" (list-specific fields like Status, Amount). Without this, no field data is returned.'
      },
      fieldIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific field IDs to return. Example: ["field-1022243", "affinity-data-description"]'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Number of entries to return per page. Default: 100, Max: 100'
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
    required: ['listId']
  },
  annotations: {
    title: 'Get List Entries',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Format a list for markdown output
 */
function formatListMarkdown(list: AffinityList): string {
  const lines: string[] = [];
  lines.push(`## ${list.name} (ID: ${list.id})`);
  lines.push(`- **Type:** ${list.type}`);
  lines.push(`- **Public:** ${list.isPublic ? 'Yes' : 'No'}`);
  lines.push(`- **Creator ID:** ${list.creatorId}`);
  lines.push(`- **Owner ID:** ${list.ownerId}`);
  return lines.join('\n');
}

/**
 * Format a list entry for markdown output
 */
function formatListEntryMarkdown(entry: ListEntry): string {
  const lines: string[] = [];
  lines.push(`## ${entry.entity.name} (Entry ID: ${entry.id})`);
  lines.push(`- **Entity ID:** ${entry.entity.id}`);
  lines.push(`- **Type:** ${entry.type}`);
  lines.push(`- **Added:** ${entry.createdAt}`);
  if (entry.entity.domain) {
    lines.push(`- **Domain:** ${entry.entity.domain}`);
  }
  if (entry.entity.fields && entry.entity.fields.length > 0) {
    lines.push('');
    lines.push('### Fields');
    for (const field of entry.entity.fields) {
      const value = field.value?.data !== undefined ? JSON.stringify(field.value.data) : 'N/A';
      lines.push(`- **${field.name}:** ${value}`);
    }
  }
  return lines.join('\n');
}

/**
 * Execute list lists tool
 *
 * @see GET /v2/lists
 */
export async function executeListLists(input: ListListsInput): Promise<string> {
  try {
    const client = getClient();

    // Build params - only include what's provided
    const params: Record<string, string | number | undefined> = {};

    if (input.limit !== undefined) {
      params.limit = input.limit;
    }
    if (input.cursor) {
      params.cursor = input.cursor;
    }

    const response = await client.get<PaginatedListsResponse>('/v2/lists', params);
    const nextCursor = extractCursor(response);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      return formatPaginatedMarkdown(
        response.data,
        nextCursor,
        'Lists',
        (item) => formatListMarkdown(item)
      );
    }

    const result = formatPaginatedResponse(response.data, nextCursor, 'lists');
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute get list entries tool
 *
 * @see GET /v2/lists/{listId}/list-entries
 */
export async function executeGetListEntries(input: GetListEntriesInput): Promise<string> {
  try {
    const client = getClient();

    // Build params - only include what's provided (API has sensible defaults)
    const params: Record<string, string | string[] | number | undefined> = {};

    if (input.fieldTypes && input.fieldTypes.length > 0) {
      params.fieldTypes = input.fieldTypes;
    }
    if (input.fieldIds && input.fieldIds.length > 0) {
      params.fieldIds = input.fieldIds;
    }
    if (input.limit !== undefined) {
      params.limit = input.limit;
    }
    if (input.cursor) {
      params.cursor = input.cursor;
    }

    const response = await client.get<PaginatedListEntriesResponse>(
      `/v2/lists/${input.listId}/list-entries`,
      params
    );
    const nextCursor = extractCursor(response);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      return formatPaginatedMarkdown(
        response.data,
        nextCursor,
        'List Entries',
        (item) => formatListEntryMarkdown(item)
      );
    }

    const result = formatPaginatedResponse(response.data, nextCursor, 'list entries');
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
