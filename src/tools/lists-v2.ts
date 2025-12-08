/**
 * Lists V2 Tools - Get List, Get Fields, Get Swimlanes
 *
 * These tools enable pipeline navigation:
 * - affinity_get_list: Get single list metadata
 * - affinity_get_list_fields: Get field definitions for a list
 * - affinity_get_swimlanes: Get pipeline stages (Status field values)
 *
 * @see https://api-docs.affinity.co/
 */

import { getClient, extractCursor } from '../client.js';
import { formatError } from '../utils/errors.js';
import { GetListInput, GetListFieldsInput, GetSwimlanesInput, GetCompaniesInSwimlaneInput } from '../schemas/inputs.js';
import { CHARACTER_LIMIT } from '../constants.js';

/**
 * V2 List response type
 */
interface V2List {
  id: number;
  name: string;
  type: 'company' | 'person' | 'opportunity';
  isPublic: boolean;
  creatorId: number;
  ownerId: number;
}

/**
 * V2 Field response type
 */
interface V2Field {
  id: string;
  name: string;
  type: 'list' | 'global' | 'enriched';
  valueType: string;
  enrichmentSource?: string | null;
  allowedValues?: Array<{
    id?: number;
    dropdownOptionId?: number;
    text: string;
    rank: number;
    color: string;
  }>;
}

/**
 * V2 paginated fields response
 */
interface V2FieldsResponse {
  data: V2Field[];
  pagination?: {
    nextPageToken?: string;
  };
}

/**
 * Swimlane (pipeline stage) type
 */
interface Swimlane {
  id: number | string;
  text: string;
  rank: number;
  color: string;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Tool definition for affinity_get_list
 */
export const getListToolDefinition = {
  name: 'affinity_get_list',
  title: 'Get List',
  description: `Get metadata for a single Affinity list (deal pipeline).

Returns basic list information: name, type, visibility, owner.

**Parameters:**
- listId: List ID (required) - get from affinity_list_lists

**Returns (JSON):**
{
  "id": number,
  "name": string,           // e.g., "SVV Deal Funnel"
  "type": string,           // "company", "person", or "opportunity"
  "isPublic": boolean,
  "creatorId": number,
  "ownerId": number
}

**List Types:**
- company: Organization tracking lists
- person: Contact tracking lists
- opportunity: Deal/fundraising lists

**Next Steps:**
- Use affinity_get_list_fields to see available fields
- Use affinity_get_swimlanes to see pipeline stages
- Use affinity_get_list_entries to see entries`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      listId: {
        type: 'string',
        description: 'List ID (numeric). Get from affinity_list_lists.'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: ['listId']
  },
  annotations: {
    title: 'Get List',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_get_list_fields
 */
export const getListFieldsToolDefinition = {
  name: 'affinity_get_list_fields',
  title: 'Get List Fields',
  description: `Get field definitions for an Affinity list.

Returns all fields available on a list, including:
- List-specific fields (Status, Amount, Owners, etc.)
- Global fields (account-wide custom fields)
- Enriched fields (auto-populated data for company/person lists)

**Parameters:**
- listId: List ID (required)
- cursor: Pagination cursor (optional)
- limit: Items per page (default 100, max 100)

**Returns (JSON):**
{
  "fields": [
    {
      "id": "field-1022243",
      "name": "Status",
      "type": "list",              // "list", "global", or "enriched"
      "valueType": "ranked-dropdown",
      "allowedValues": [           // Only for dropdown fields
        { "text": "Lead", "rank": 0, "color": "none" },
        { "text": "Portfolio", "rank": 7, "color": "purple" }
      ]
    }
  ],
  "count": number,
  "hasMore": boolean
}

**Field Types:**
- list: List-specific fields (deal data)
- global: Account-wide custom fields
- enriched: Auto-populated enrichment data

**Value Types:**
- ranked-dropdown: Pipeline stages (Status)
- dropdown: Single-select
- dropdown-multi: Multi-select
- person-multi: Person references
- number: Numeric values
- text: Plain text
- datetime: Date/time`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      listId: {
        type: 'string',
        description: 'List ID (numeric). Get from affinity_list_lists.'
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor from previous response'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Items per page (default 100, max 100)'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: ['listId']
  },
  annotations: {
    title: 'Get List Fields',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_get_swimlanes
 */
export const getSwimlanesToolDefinition = {
  name: 'affinity_get_swimlanes',
  title: 'Get Swimlanes',
  description: `Get pipeline stages (swimlanes) for an Affinity list.

Swimlanes are the columns in a deal pipeline view (e.g., Lead, Meeting, Portfolio).
They come from the Status field which is a ranked-dropdown.

**Parameters:**
- listId: List ID (required) - get from affinity_list_lists

**Returns (JSON):**
{
  "listId": number,
  "listName": string,
  "statusFieldId": string,      // Use this to filter entries
  "swimlanes": [
    {
      "id": number,             // dropdownOptionId - use for filtering
      "text": "Lead",           // Display name
      "rank": 0,                // Sort order (0 = first)
      "color": "none"           // Visual indicator
    },
    {
      "id": number,
      "text": "Portfolio",
      "rank": 7,
      "color": "purple"
    }
  ],
  "count": number
}

**Use Cases:**
- Display pipeline columns in UI
- Get stage IDs for filtering list entries
- Understand deal flow progression

**Note:** If no Status field exists, returns error. Not all lists have swimlanes.`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      listId: {
        type: 'string',
        description: 'List ID (numeric). Get from affinity_list_lists.'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: ['listId']
  },
  annotations: {
    title: 'Get Swimlanes',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

// ============================================================================
// Execute Functions
// ============================================================================

/**
 * Execute get list tool
 * @see GET /v2/lists/{listId}
 */
export async function executeGetList(input: GetListInput): Promise<string> {
  try {
    const client = getClient();
    const response = await client.get<V2List>(`/v2/lists/${input.listId}`);

    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# ${response.name}`);
      lines.push('');
      lines.push(`- **ID:** ${response.id}`);
      lines.push(`- **Type:** ${response.type}`);
      lines.push(`- **Public:** ${response.isPublic ? 'Yes' : 'No'}`);
      lines.push(`- **Creator ID:** ${response.creatorId}`);
      lines.push(`- **Owner ID:** ${response.ownerId}`);
      lines.push('');
      lines.push('**Next Steps:**');
      lines.push(`- \`affinity_get_list_fields\` with listId="${response.id}" to see available fields`);
      lines.push(`- \`affinity_get_swimlanes\` with listId="${response.id}" to see pipeline stages`);
      return lines.join('\n');
    }

    return JSON.stringify(response, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute get list fields tool
 * @see GET /v2/lists/{listId}/fields
 */
export async function executeGetListFields(input: GetListFieldsInput): Promise<string> {
  try {
    const client = getClient();

    const params: Record<string, string | number | undefined> = {};
    if (input.cursor) params.cursor = input.cursor;
    if (input.limit !== undefined) params.limit = input.limit;

    const response = await client.get<V2FieldsResponse>(
      `/v2/lists/${input.listId}/fields`,
      params
    );

    const fields = response.data || [];
    const nextCursor = extractCursor(response);
    const hasMore = !!nextCursor;

    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Fields for List ${input.listId}`);
      lines.push('');
      lines.push(`Found **${fields.length}** field(s)${hasMore ? ' (more available)' : ''}`);
      lines.push('');

      // Group by type
      const listFields = fields.filter(f => f.type === 'list');
      const globalFields = fields.filter(f => f.type === 'global');
      const enrichedFields = fields.filter(f => f.type === 'enriched');

      if (listFields.length > 0) {
        lines.push('## List-Specific Fields');
        for (const f of listFields) {
          lines.push(`- **${f.name}** (${f.id}): ${f.valueType}`);
          if (f.allowedValues && f.allowedValues.length > 0) {
            const values = f.allowedValues.map(v => v.text).join(', ');
            lines.push(`  - Values: ${values}`);
          }
        }
        lines.push('');
      }

      if (globalFields.length > 0) {
        lines.push(`## Global Fields (${globalFields.length})`);
        lines.push('*Account-wide custom fields*');
        lines.push('');
      }

      if (enrichedFields.length > 0) {
        lines.push(`## Enriched Fields (${enrichedFields.length})`);
        lines.push('*Auto-populated data*');
        lines.push('');
      }

      if (nextCursor) {
        lines.push('---');
        lines.push(`*More fields available. Use cursor: \`${nextCursor}\`*`);
      }

      return lines.join('\n');
    }

    const result = {
      fields,
      count: fields.length,
      hasMore,
      nextCursor,
      summary: {
        total: fields.length,
        listFields: fields.filter(f => f.type === 'list').length,
        globalFields: fields.filter(f => f.type === 'global').length,
        enrichedFields: fields.filter(f => f.type === 'enriched').length
      }
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute get swimlanes tool
 * @see GET /v2/lists/{listId}/fields (filters for Status field)
 */
export async function executeGetSwimlanes(input: GetSwimlanesInput): Promise<string> {
  try {
    const client = getClient();

    // First get the list metadata
    const listResponse = await client.get<V2List>(`/v2/lists/${input.listId}`);

    // Get fields to find the Status field
    const fieldsResponse = await client.get<V2FieldsResponse>(
      `/v2/lists/${input.listId}/fields`,
      { limit: 100 }
    );

    // Find the Status field (ranked-dropdown with name "Status")
    const statusField = fieldsResponse.data.find(
      f => f.valueType === 'ranked-dropdown' && f.name.toLowerCase() === 'status'
    );

    if (!statusField) {
      return JSON.stringify({
        error: 'No Status field found',
        message: `List "${listResponse.name}" (ID: ${input.listId}) does not have a Status field with pipeline stages.`,
        hint: 'Not all lists have swimlanes. Use affinity_get_list_fields to see available fields.'
      }, null, 2);
    }

    // Fallback: If allowedValues not in field definition, sample from list entries
    // Note: API changed - allowedValues no longer returned in field definitions
    if (!statusField.allowedValues || statusField.allowedValues.length === 0) {
      const entriesResponse = await client.get<any>(
        `/v2/lists/${input.listId}/list-entries`,
        { limit: 100, fieldTypes: ['list'] }
      );

      const statusValuesMap = new Map<number, Swimlane>();

      for (const entry of entriesResponse.data || []) {
        const statusFieldValue = entry.entity?.fields?.find((f: any) => f.id === statusField.id);
        if (statusFieldValue?.value?.data) {
          const data = statusFieldValue.value.data;
          if (data.dropdownOptionId) {
            statusValuesMap.set(data.dropdownOptionId, {
              id: data.dropdownOptionId,
              text: data.text || 'Unknown',
              rank: data.rank ?? 0,
              color: data.color || 'none'
            });
          }
        }
      }

      if (statusValuesMap.size === 0) {
        return JSON.stringify({
          error: 'No status values found',
          message: `List "${listResponse.name}" has a Status field but no entries with status values. The list may be empty.`,
          statusFieldId: statusField.id,
          hint: 'Add entries to the list first, or check the list in Affinity UI.'
        }, null, 2);
      }

      const swimlanes = Array.from(statusValuesMap.values()).sort((a, b) => a.rank - b.rank);

      if (input.responseFormat === 'markdown') {
        const lines: string[] = [];
        lines.push(`# Swimlanes for ${listResponse.name}`);
        lines.push('');
        lines.push(`**List ID:** ${input.listId}`);
        lines.push(`**Status Field ID:** ${statusField.id}`);
        lines.push(`**Total Stages:** ${swimlanes.length}`);
        lines.push('');
        lines.push('⚠️ *Stages discovered from list entries (API limitation - allowedValues not in field definition)*');
        lines.push('');
        lines.push('## Pipeline Stages');
        lines.push('');

        for (const s of swimlanes) {
          const colorBadge = s.color !== 'none' ? ` [${s.color}]` : '';
          lines.push(`${s.rank}. **${s.text}**${colorBadge} (ID: ${s.id})`);
        }

        lines.push('');
        lines.push('---');
        lines.push('*Use swimlane IDs to filter list entries by stage*');

        return lines.join('\n');
      }

      return JSON.stringify({
        listId: listResponse.id,
        listName: listResponse.name,
        statusFieldId: statusField.id,
        swimlanes,
        count: swimlanes.length,
        note: 'Stages discovered from list entries (API no longer includes allowedValues in field definitions)',
        hint: 'Use swimlane id values to filter list entries by stage'
      }, null, 2);
    }

    // If allowedValues IS present (unlikely based on current API), use it
    const swimlanes: Swimlane[] = statusField.allowedValues.map(v => ({
      id: v.dropdownOptionId || v.id || 0,
      text: v.text,
      rank: v.rank,
      color: v.color
    })).sort((a, b) => a.rank - b.rank);

    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Swimlanes for ${listResponse.name}`);
      lines.push('');
      lines.push(`**List ID:** ${input.listId}`);
      lines.push(`**Status Field ID:** ${statusField.id}`);
      lines.push(`**Total Stages:** ${swimlanes.length}`);
      lines.push('');
      lines.push('## Pipeline Stages');
      lines.push('');

      for (const s of swimlanes) {
        const colorBadge = s.color !== 'none' ? ` [${s.color}]` : '';
        lines.push(`${s.rank}. **${s.text}**${colorBadge} (ID: ${s.id})`);
      }

      lines.push('');
      lines.push('---');
      lines.push('*Use swimlane IDs to filter list entries by stage*');

      return lines.join('\n');
    }

    const result = {
      listId: listResponse.id,
      listName: listResponse.name,
      statusFieldId: statusField.id,
      swimlanes,
      count: swimlanes.length,
      hint: 'Use swimlane id values to filter list entries by stage'
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Get Companies in Swimlane
// ============================================================================

/**
 * Tool definition for affinity_get_companies_in_swimlane
 */
export const getCompaniesInSwimlaneToolDefinition = {
  name: 'affinity_get_companies_in_swimlane',
  title: 'Get Companies in Swimlane',
  description: `Get all companies at a specific pipeline stage (swimlane).

Returns companies filtered by their Status field value in a list.

**Important:** This tool performs client-side filtering since the Affinity API
doesn't support server-side filtering by status. For large lists (>100 entries),
use pagination parameters.

**Parameters:**
- listId: List ID (required) - get from affinity_list_lists
- swimlaneId: Swimlane/stage ID (required) - get from affinity_get_swimlanes (this is the dropdownOptionId)
- cursor: Pagination cursor (optional)
- limit: Items per page (default 100, max 100)

**Returns (JSON):**
{
  "companies": [
    {
      "id": number,
      "name": string,
      "domain": string,
      "isGlobal": boolean,
      "status": {
        "text": "Portfolio",
        "rank": 7,
        "color": "purple",
        "dropdownOptionId": number
      },
      "listEntryId": number,
      "createdAt": string
    }
  ],
  "count": number,
  "swimlaneText": string,
  "listName": string,
  "hasMore": boolean
}

**Workflow:**
1. Use affinity_list_lists to find lists
2. Use affinity_get_swimlanes to see available stages
3. Use this tool to get companies in a specific stage

**Use Cases:**
- "Get all companies in the Lead stage"
- "Show me portfolio companies"
- "List companies in Meeting Scheduled stage"`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      listId: {
        type: 'string',
        description: 'List ID (numeric). Get from affinity_list_lists.'
      },
      swimlaneId: {
        type: 'string',
        description: 'Swimlane/stage ID (numeric dropdownOptionId). Get from affinity_get_swimlanes.'
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor from previous response'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Items per page (default 100, max 100)'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: ['listId', 'swimlaneId']
  },
  annotations: {
    title: 'Get Companies in Swimlane',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * List entry response from V2 API
 */
interface V2ListEntryResponse {
  id: number;
  listId: number;
  creatorId: number;
  createdAt: string;
  type: string;
  entity: {
    id: number;
    name: string;
    domain?: string;
    isGlobal?: boolean;
    fields: Array<{
      id: string;
      name: string;
      type: string;
      value: {
        type: string;
        data: any;
      };
    }>;
  };
}

/**
 * Paginated list entries response
 */
interface V2ListEntriesResponse {
  data: V2ListEntryResponse[];
  pagination?: {
    nextPageToken?: string;
  };
}

/**
 * Execute get companies in swimlane tool
 * @see GET /v2/lists/{listId}/list-entries (with client-side filtering)
 */
export async function executeGetCompaniesInSwimlane(input: GetCompaniesInSwimlaneInput): Promise<string> {
  try {
    const client = getClient();

    // Convert swimlaneId to number for comparison
    const targetSwimlaneId = parseInt(input.swimlaneId, 10);
    if (isNaN(targetSwimlaneId)) {
      return JSON.stringify({
        error: 'Invalid swimlaneId',
        message: 'swimlaneId must be a numeric dropdownOptionId'
      }, null, 2);
    }

    // First, get the list metadata and swimlanes to validate input and get swimlane name
    const listResponse = await client.get<V2List>(`/v2/lists/${input.listId}`);

    // Get fields to find the Status field
    const fieldsResponse = await client.get<V2FieldsResponse>(
      `/v2/lists/${input.listId}/fields`,
      { limit: 100 }
    );

    const statusField = fieldsResponse.data.find(
      f => f.valueType === 'ranked-dropdown' && f.name.toLowerCase() === 'status'
    );

    if (!statusField) {
      return JSON.stringify({
        error: 'No Status field found',
        message: `List "${listResponse.name}" does not have a Status field. Cannot filter by swimlane.`,
        hint: 'Use affinity_get_list_fields to see available fields.'
      }, null, 2);
    }

    // Get list entries with Status field values
    const params: Record<string, string | number | string[] | undefined> = {
      fieldTypes: ['list']
    };
    if (input.cursor) params.cursor = input.cursor;
    if (input.limit !== undefined) params.limit = input.limit;

    const entriesResponse = await client.get<V2ListEntriesResponse>(
      `/v2/lists/${input.listId}/list-entries`,
      params
    );

    // Filter entries by swimlane (client-side)
    const filteredCompanies: Array<{
      id: number;
      name: string;
      domain: string | null;
      isGlobal: boolean;
      status: {
        text: string;
        rank: number;
        color: string;
        dropdownOptionId: number;
      };
      listEntryId: number;
      createdAt: string;
    }> = [];

    let swimlaneText = 'Unknown';

    for (const entry of entriesResponse.data || []) {
      // Only process company entries
      if (entry.type !== 'company') continue;

      // Find the Status field in the entry's fields
      const statusFieldValue = entry.entity?.fields?.find(f => f.id === statusField.id);

      if (statusFieldValue?.value?.data) {
        const statusData = statusFieldValue.value.data;

        // Check if this entry matches the target swimlane
        if (statusData.dropdownOptionId === targetSwimlaneId) {
          swimlaneText = statusData.text || swimlaneText;

          filteredCompanies.push({
            id: entry.entity.id,
            name: entry.entity.name,
            domain: entry.entity.domain || null,
            isGlobal: entry.entity.isGlobal || false,
            status: {
              text: statusData.text || 'Unknown',
              rank: statusData.rank ?? 0,
              color: statusData.color || 'none',
              dropdownOptionId: statusData.dropdownOptionId
            },
            listEntryId: entry.id,
            createdAt: entry.createdAt
          });
        }
      }
    }

    const nextCursor = extractCursor(entriesResponse);
    const hasMore = !!nextCursor;

    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Companies in "${swimlaneText}" Stage`);
      lines.push('');
      lines.push(`**List:** ${listResponse.name} (ID: ${input.listId})`);
      lines.push(`**Stage:** ${swimlaneText} (ID: ${targetSwimlaneId})`);
      lines.push(`**Companies Found:** ${filteredCompanies.length}${hasMore ? ' (more available)' : ''}`);
      lines.push('');

      if (filteredCompanies.length === 0) {
        lines.push('ℹ️ **No companies found** in this stage.');
        lines.push('');
        lines.push('*The stage may be empty, or all entries may have been filtered out by pagination.*');
      } else {
        lines.push('## Companies');
        lines.push('');

        for (const company of filteredCompanies) {
          lines.push(`### ${company.name}`);
          if (company.domain) {
            lines.push(`- **Domain:** ${company.domain}`);
          }
          lines.push(`- **Company ID:** ${company.id}`);
          lines.push(`- **Entry ID:** ${company.listEntryId}`);
          lines.push(`- **Added:** ${new Date(company.createdAt).toLocaleDateString()}`);
          lines.push(`- **Global:** ${company.isGlobal ? 'Yes' : 'No'}`);
          lines.push('');
        }
      }

      if (nextCursor) {
        lines.push('---');
        lines.push(`*More companies available. Use cursor: \`${nextCursor}\`*`);
      }

      return lines.join('\n');
    }

    return JSON.stringify({
      companies: filteredCompanies,
      count: filteredCompanies.length,
      swimlaneText,
      listName: listResponse.name,
      listId: parseInt(input.listId, 10),
      swimlaneId: targetSwimlaneId,
      hasMore,
      nextCursor,
      hint: filteredCompanies.length === 0
        ? 'No companies found in this swimlane stage. The stage may be empty.'
        : `Found ${filteredCompanies.length} compan${filteredCompanies.length === 1 ? 'y' : 'ies'} in the "${swimlaneText}" stage.`
    }, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
