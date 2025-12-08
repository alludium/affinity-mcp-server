/**
 * Enhanced Details Tools - Phase 4
 *
 * - affinity_get_company_lists: Get lists containing a company (V2)
 * - affinity_get_company_list_entries: Get list entries for a company (V2)
 * - affinity_list_person_notes: List notes for a person (V2 BETA)
 * - affinity_list_opportunity_notes: List notes for an opportunity (V2 BETA)
 *
 * These tools provide deeper inspection capabilities for companies, persons, and opportunities.
 *
 * @see https://api-docs.affinity.co/
 */

import { getClient, extractCursor } from '../client.js';
import { formatError } from '../utils/errors.js';
import {
  GetCompanyListsInput,
  GetCompanyListEntriesInput,
  ListPersonNotesInput,
  ListOpportunityNotesInput
} from '../schemas/inputs.js';

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
 * V2 paginated lists response
 */
interface V2ListsResponse {
  data: V2List[];
  pagination?: {
    nextPageToken?: string;
  };
}

/**
 * V2 Field value response
 */
interface V2FieldValue {
  id: string;
  name: string;
  type: 'list' | 'global' | 'enriched' | 'relationship-intelligence';
  enrichmentSource?: string | null;
  value: {
    type: string;
    data: any;
  };
}

/**
 * V2 List Entry response (with full field data)
 */
interface V2ListEntry {
  id: number;
  listId: number;
  creatorId: number;
  createdAt: string;
  fields: V2FieldValue[];
}

/**
 * V2 List Entries response
 */
interface V2ListEntriesResponse {
  data: V2ListEntry[];
  pagination?: {
    nextPageToken?: string;
  };
}

/**
 * V2 Note response type (BETA)
 */
interface V2Note {
  id: number;
  content: {
    html: string;
  };
  creator: {
    id: number;
    firstName: string;
    lastName: string;
    primaryEmailAddress: string;
    type: 'internal' | 'external';
  };
  createdAt: string;
  updatedAt: string | null;
  type: 'entities' | 'interaction';
  mentions: Array<{
    id: number;
    firstName: string;
    lastName: string;
  }>;
  interaction?: {
    id: number;
    type: string;
  };
}

/**
 * V2 List notes response (BETA)
 */
interface V2ListNotesResponse {
  data: V2Note[];
  pagination: {
    prevUrl: string | null;
    nextUrl: string | null;
  };
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Tool definition for affinity_get_company_lists
 */
export const getCompanyListsToolDefinition = {
  name: 'affinity_get_company_lists',
  title: 'Get Company Lists',
  description: `Get all lists where a specific company appears.

Returns list metadata for each list containing this company.
Useful for discovering which deal pipelines track a specific company.

**Parameters:**
- companyId: Company ID (required) - get from affinity_search_companies or affinity_get_company
- cursor: Pagination cursor (optional)
- limit: Items per page (default 100, max 100)

**Returns (JSON):**
{
  "lists": [
    {
      "id": number,
      "name": string,           // e.g., "SVV Deal Funnel"
      "type": string,           // "company", "person", or "opportunity"
      "isPublic": boolean,
      "creatorId": number,
      "ownerId": number
    }
  ],
  "count": number,
  "hasMore": boolean,
  "nextCursor": string | null
}

**Note:** Returns empty array if company not on any lists (very common).

**Use Cases:**
- "Which deal pipelines is this company in?"
- "Find all lists tracking this portfolio company"
- "Check if company is already being tracked"

**Next Steps:**
- Use affinity_get_company_list_entries to see full field data for each list`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      companyId: {
        type: 'string',
        description: 'Company ID (numeric). Get from affinity_search_companies or affinity_get_company.'
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
    required: ['companyId']
  },
  annotations: {
    title: 'Get Company Lists',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_get_company_list_entries
 */
export const getCompanyListEntriesToolDefinition = {
  name: 'affinity_get_company_list_entries',
  title: 'Get Company List Entries',
  description: `Get all list entries for a company across ALL lists with full field data.

Returns complete list entry data including:
- List-specific fields (Status, Amount, Owners, etc.)
- Global fields (account-wide custom fields)
- Enriched fields (auto-populated enrichment data)
- Relationship-intelligence fields (email/calendar derived)

**Parameters:**
- companyId: Company ID (required) - get from affinity_search_companies or affinity_get_company
- cursor: Pagination cursor (optional)
- limit: Items per page (default 100, max 100)

**Returns (JSON):**
{
  "entries": [
    {
      "id": number,             // List entry ID
      "listId": number,         // Which list this entry is on
      "creatorId": number,
      "createdAt": string,      // ISO 8601
      "fields": [
        {
          "id": "field-1022243",
          "name": "Status",
          "type": "list",       // "list", "global", "enriched", "relationship-intelligence"
          "value": {
            "type": "ranked-dropdown",
            "data": { "text": "Portfolio", "rank": 7, "color": "purple" }
          }
        }
      ]
    }
  ],
  "count": number,
  "hasMore": boolean,
  "nextCursor": string | null,
  "summary": {
    "totalEntries": number,
    "listsWithEntries": number,
    "fieldsPerEntry": number
  }
}

**Note:** Returns empty array if company not on any lists (very common).

**Use Cases:**
- "Get all deal data for this company across pipelines"
- "Export company's complete list information"
- "See Status, Amount, Owners fields for this portfolio company"

**Field Types Included:**
- list: List-specific fields (Status, Amount, Owners, etc.)
- global: Account-wide custom fields
- enriched: Auto-populated enrichment data
- relationship-intelligence: Email/calendar derived data`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      companyId: {
        type: 'string',
        description: 'Company ID (numeric). Get from affinity_search_companies or affinity_get_company.'
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
    required: ['companyId']
  },
  annotations: {
    title: 'Get Company List Entries',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_list_person_notes
 */
export const listPersonNotesToolDefinition = {
  name: 'affinity_list_person_notes',
  title: 'List Person Notes',
  description: `List all notes attached to a specific person in Affinity.

**This is a V2 BETA endpoint - API may change.**

Returns notes with HTML content, creator information, and timestamps.
Includes notes attached to meetings/emails if interaction info is present.

**Parameters:**
- personId: Person ID (required) - get from affinity_search_persons or affinity_get_person
- cursor: Pagination cursor from previous response
- limit: Items per page (default 20, max 100)

**Returns (JSON):**
{
  "notes": [
    {
      "id": number,
      "content": { "html": string },
      "creator": {
        "id": number,
        "firstName": string,
        "lastName": string,
        "primaryEmailAddress": string
      },
      "createdAt": string,      // ISO 8601
      "type": "entities" | "interaction",
      "interaction": {          // Only if type === "interaction"
        "id": number,
        "type": "meeting" | "email"
      }
    }
  ],
  "count": number,
  "hasMore": boolean,
  "nextCursor": string | null
}

**Note Types:**
- "entities": Note attached directly to person
- "interaction": Note attached to a meeting or email with this person

**Example:**
Get notes for Barry Downes (ID: 66880587)`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      personId: {
        type: 'string',
        description: 'Person ID (numeric). Get from affinity_search_persons or affinity_get_person.'
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor from previous response'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Items per page (default 20, max 100)'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: ['personId']
  },
  annotations: {
    title: 'List Person Notes',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_list_opportunity_notes
 */
export const listOpportunityNotesToolDefinition = {
  name: 'affinity_list_opportunity_notes',
  title: 'List Opportunity Notes',
  description: `List all notes attached to a specific opportunity in Affinity.

**This is a V2 BETA endpoint - API may change.**

Returns notes with HTML content, creator information, and timestamps.

**Parameters:**
- opportunityId: Opportunity ID (required) - get from affinity_list_opportunities or affinity_get_opportunity
- cursor: Pagination cursor from previous response
- limit: Items per page (default 20, max 100)

**Returns (JSON):**
{
  "notes": [
    {
      "id": number,
      "content": { "html": string },
      "creator": {
        "id": number,
        "firstName": string,
        "lastName": string,
        "primaryEmailAddress": string
      },
      "createdAt": string,      // ISO 8601
      "type": "entities" | "interaction"
    }
  ],
  "count": number,
  "hasMore": boolean,
  "nextCursor": string | null
}

**Note Types:**
- "entities": Note attached directly to opportunity
- "interaction": Note attached to a meeting or email about this opportunity

**Use Cases:**
- View deal progress notes
- Export opportunity documentation
- Review fundraising lead history`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      opportunityId: {
        type: 'string',
        description: 'Opportunity ID (numeric). Get from affinity_list_opportunities or affinity_get_opportunity.'
      },
      cursor: {
        type: 'string',
        description: 'Pagination cursor from previous response'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Items per page (default 20, max 100)'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: ['opportunityId']
  },
  annotations: {
    title: 'List Opportunity Notes',
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
 * Execute get company lists tool
 * @see GET /v2/companies/{companyId}/lists
 */
export async function executeGetCompanyLists(input: GetCompanyListsInput): Promise<string> {
  try {
    const client = getClient();

    const params: Record<string, string | number | undefined> = {};
    if (input.cursor) params.cursor = input.cursor;
    if (input.limit !== undefined) params.limit = input.limit;

    const response = await client.get<V2ListsResponse>(
      `/v2/companies/${input.companyId}/lists`,
      params
    );

    const lists = response.data || [];
    const nextCursor = extractCursor(response);
    const hasMore = !!nextCursor;

    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Lists for Company ${input.companyId}`);
      lines.push('');

      if (lists.length === 0) {
        lines.push('⚠️ **No lists found** - This company is not on any lists.');
        lines.push('');
        lines.push('*Most companies in Affinity are not actively tracked on lists.*');
        return lines.join('\n');
      }

      lines.push(`Found **${lists.length}** list(s)${hasMore ? ' (more available)' : ''}`);
      lines.push('');

      for (const list of lists) {
        lines.push(`## ${list.name}`);
        lines.push(`- **ID:** ${list.id}`);
        lines.push(`- **Type:** ${list.type}`);
        lines.push(`- **Public:** ${list.isPublic ? 'Yes' : 'No'}`);
        lines.push('');
      }

      if (nextCursor) {
        lines.push('---');
        lines.push(`*More lists available. Use cursor: \`${nextCursor}\`*`);
      }

      lines.push('');
      lines.push('**Next Steps:**');
      lines.push(`- Use \`affinity_get_company_list_entries\` with companyId="${input.companyId}" to see full field data`);

      return lines.join('\n');
    }

    return JSON.stringify({
      lists,
      count: lists.length,
      hasMore,
      nextCursor,
      hint: lists.length === 0
        ? 'This company is not on any lists. Most companies are not actively tracked.'
        : 'Use affinity_get_company_list_entries to see full field data for each list entry.'
    }, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute get company list entries tool
 * @see GET /v2/companies/{companyId}/list-entries
 */
export async function executeGetCompanyListEntries(input: GetCompanyListEntriesInput): Promise<string> {
  try {
    const client = getClient();

    const params: Record<string, string | number | undefined> = {};
    if (input.cursor) params.cursor = input.cursor;
    if (input.limit !== undefined) params.limit = input.limit;

    const response = await client.get<V2ListEntriesResponse>(
      `/v2/companies/${input.companyId}/list-entries`,
      params
    );

    const entries = response.data || [];
    const nextCursor = extractCursor(response);
    const hasMore = !!nextCursor;

    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# List Entries for Company ${input.companyId}`);
      lines.push('');

      if (entries.length === 0) {
        lines.push('⚠️ **No list entries found** - This company is not on any lists.');
        lines.push('');
        lines.push('*Most companies in Affinity are not actively tracked on lists.*');
        return lines.join('\n');
      }

      lines.push(`Found **${entries.length}** list entr${entries.length === 1 ? 'y' : 'ies'}${hasMore ? ' (more available)' : ''}`);
      lines.push('');

      // Calculate summary stats
      const uniqueLists = new Set(entries.map(e => e.listId));
      const totalFields = entries.reduce((sum, e) => sum + e.fields.length, 0);
      const avgFields = entries.length > 0 ? Math.round(totalFields / entries.length) : 0;

      lines.push('**Summary:**');
      lines.push(`- Lists with entries: ${uniqueLists.size}`);
      lines.push(`- Total fields returned: ${totalFields}`);
      lines.push(`- Average fields per entry: ${avgFields}`);
      lines.push('');

      for (const entry of entries) {
        lines.push(`## List Entry ${entry.id}`);
        lines.push(`- **List ID:** ${entry.listId}`);
        lines.push(`- **Created:** ${entry.createdAt}`);
        lines.push(`- **Fields:** ${entry.fields.length}`);
        lines.push('');

        // Show key fields (Status, Amount, etc.)
        const statusField = entry.fields.find(f => f.name === 'Status' && f.type === 'list');
        if (statusField && statusField.value.data) {
          lines.push(`  - **Status:** ${statusField.value.data.text || 'N/A'}`);
        }

        const amountField = entry.fields.find(f => f.name === 'Amount' && f.type === 'list');
        if (amountField && amountField.value.data !== null) {
          lines.push(`  - **Amount:** ${amountField.value.data}`);
        }

        lines.push('');
      }

      if (nextCursor) {
        lines.push('---');
        lines.push(`*More entries available. Use cursor: \`${nextCursor}\`*`);
      }

      return lines.join('\n');
    }

    // Calculate summary
    const uniqueLists = new Set(entries.map(e => e.listId));
    const totalFields = entries.reduce((sum, e) => sum + e.fields.length, 0);

    return JSON.stringify({
      entries,
      count: entries.length,
      hasMore,
      nextCursor,
      summary: {
        totalEntries: entries.length,
        listsWithEntries: uniqueLists.size,
        totalFields,
        avgFieldsPerEntry: entries.length > 0 ? Math.round(totalFields / entries.length) : 0
      },
      hint: entries.length === 0
        ? 'This company is not on any lists.'
        : 'Each entry represents the company on one specific list with full field data.'
    }, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute list person notes tool
 * @see GET /v2/persons/{personId}/notes (BETA)
 */
export async function executeListPersonNotes(input: ListPersonNotesInput): Promise<string> {
  try {
    const client = getClient();

    const params: Record<string, string | number | undefined> = {};
    if (input.cursor) params.cursor = input.cursor;
    if (input.limit !== undefined) params.limit = input.limit;

    const response = await client.get<V2ListNotesResponse>(
      `/v2/persons/${input.personId}/notes`,
      params
    );

    const notes = response.data || [];
    const nextUrl = response.pagination?.nextUrl;
    const hasMore = !!nextUrl;
    // Extract cursor from nextUrl if present
    const nextCursor = nextUrl ? new URL(nextUrl).searchParams.get('cursor') : null;

    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Notes for Person ${input.personId}`);
      lines.push('');

      if (notes.length === 0) {
        lines.push('ℹ️ **No notes found** for this person.');
        return lines.join('\n');
      }

      lines.push(`Found **${notes.length}** note(s)${hasMore ? ' (more available)' : ''}`);
      lines.push('');

      for (const note of notes) {
        const creatorName = `${note.creator.firstName} ${note.creator.lastName}`;
        const date = new Date(note.createdAt).toLocaleDateString();

        lines.push(`## Note ${note.id}`);
        lines.push(`- **Creator:** ${creatorName}`);
        lines.push(`- **Date:** ${date}`);
        lines.push(`- **Type:** ${note.type}`);

        if (note.interaction) {
          lines.push(`- **Interaction:** ${note.interaction.type} (ID: ${note.interaction.id})`);
        }

        lines.push('');
        lines.push('**Content:**');
        // Strip HTML tags for markdown display
        const textContent = note.content.html.replace(/<[^>]*>/g, '');
        lines.push(textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''));
        lines.push('');
      }

      if (nextCursor) {
        lines.push('---');
        lines.push(`*More notes available. Use cursor: \`${nextCursor}\`*`);
      }

      return lines.join('\n');
    }

    return JSON.stringify({
      notes,
      count: notes.length,
      hasMore,
      nextCursor,
      hint: notes.length === 0
        ? 'No notes found for this person.'
        : 'Notes include both direct notes and notes from meetings/emails.'
    }, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute list opportunity notes tool
 * @see GET /v2/opportunities/{opportunityId}/notes (BETA)
 */
export async function executeListOpportunityNotes(input: ListOpportunityNotesInput): Promise<string> {
  try {
    const client = getClient();

    const params: Record<string, string | number | undefined> = {};
    if (input.cursor) params.cursor = input.cursor;
    if (input.limit !== undefined) params.limit = input.limit;

    const response = await client.get<V2ListNotesResponse>(
      `/v2/opportunities/${input.opportunityId}/notes`,
      params
    );

    const notes = response.data || [];
    const nextUrl = response.pagination?.nextUrl;
    const hasMore = !!nextUrl;
    // Extract cursor from nextUrl if present
    const nextCursor = nextUrl ? new URL(nextUrl).searchParams.get('cursor') : null;

    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Notes for Opportunity ${input.opportunityId}`);
      lines.push('');

      if (notes.length === 0) {
        lines.push('ℹ️ **No notes found** for this opportunity.');
        return lines.join('\n');
      }

      lines.push(`Found **${notes.length}** note(s)${hasMore ? ' (more available)' : ''}`);
      lines.push('');

      for (const note of notes) {
        const creatorName = `${note.creator.firstName} ${note.creator.lastName}`;
        const date = new Date(note.createdAt).toLocaleDateString();

        lines.push(`## Note ${note.id}`);
        lines.push(`- **Creator:** ${creatorName}`);
        lines.push(`- **Date:** ${date}`);
        lines.push(`- **Type:** ${note.type}`);
        lines.push('');
        lines.push('**Content:**');
        // Strip HTML tags for markdown display
        const textContent = note.content.html.replace(/<[^>]*>/g, '');
        lines.push(textContent.substring(0, 200) + (textContent.length > 200 ? '...' : ''));
        lines.push('');
      }

      if (nextCursor) {
        lines.push('---');
        lines.push(`*More notes available. Use cursor: \`${nextCursor}\`*`);
      }

      return lines.join('\n');
    }

    return JSON.stringify({
      notes,
      count: notes.length,
      hasMore,
      nextCursor,
      hint: notes.length === 0
        ? 'No notes found for this opportunity.'
        : 'Notes document the opportunity progress and interactions.'
    }, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
