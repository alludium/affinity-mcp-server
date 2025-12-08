/**
 * Notes Tools - List and Create
 *
 * - affinity_list_company_notes: List notes for a company (V2 BETA)
 * - affinity_add_note: Create a note attached to entities (V1)
 *
 * Important: Per requirements, only ADD is implemented - no edit or delete.
 *
 * @see https://api-docs.affinity.co/#notes
 */

import { getClient } from '../client.js';
import { getClientV1 } from '../client-v1.js';
import { formatError } from '../utils/errors.js';
import { ListCompanyNotesInput, AddNoteInput } from '../schemas/inputs.js';
import { CHARACTER_LIMIT } from '../constants.js';

/**
 * V2 Note response type (BETA)
 */
interface V2Note {
  /** Unique note ID */
  id: number;
  /** Note content */
  content: {
    html: string;
  };
  /** Note creator */
  creator: {
    id: number;
    firstName: string;
    lastName: string;
    primaryEmailAddress: string;
    type: 'internal' | 'external';
  };
  /** Creation timestamp (ISO 8601) */
  createdAt: string;
  /** Update timestamp (null if never updated) */
  updatedAt: string | null;
  /** Note type: "entities" or "interaction" */
  type: 'entities' | 'interaction';
  /** User mentions in the note */
  mentions: Array<{
    id: number;
    firstName: string;
    lastName: string;
  }>;
}

/**
 * V2 List notes response (BETA)
 * Note: Different pagination format than other V2 endpoints
 */
interface V2ListNotesResponse {
  data: V2Note[];
  pagination: {
    prevUrl: string | null;
    nextUrl: string | null;
  };
}

/**
 * V1 Note response type
 */
interface V1Note {
  id: number;
  creator_id: number;
  person_ids: number[];
  associated_person_ids: number[];
  interaction_person_ids: number[];
  interaction_id: number | null;
  interaction_type: string | null;
  is_meeting: boolean;
  mentioned_person_ids: number[];
  organization_ids: number[];
  opportunity_ids: number[];
  parent_id: number | null;
  content: string;
  type: number;
  created_at: string;
  updated_at: string | null;
}

/**
 * Tool definition for affinity_list_company_notes
 *
 * Validated against: GET /v2/companies/{companyId}/notes (BETA)
 */
export const listCompanyNotesToolDefinition = {
  name: 'affinity_list_company_notes',
  title: 'List Company Notes',
  description: `List all notes attached to a specific company in Affinity.

**This is a V2 BETA endpoint - API may change.**

Returns notes with HTML content, creator information, and timestamps.

**Parameters:**
- companyId: Company ID (required) - get from affinity_search_companies or affinity_get_company
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
- "entities": Note attached directly to company/person
- "interaction": Note attached to a meeting or email

**Example:**
Get notes for Sure Valley Ventures (ID: 223449211)`,
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
        description: 'Items per page (default 20, max 100)'
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
    title: 'List Company Notes',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_add_note
 *
 * Validated against: POST /notes (V1)
 */
export const addNoteToolDefinition = {
  name: 'affinity_add_note',
  title: 'Add Note',
  description: `Create a new note attached to companies, persons, or opportunities in Affinity.

**This is a V1 API endpoint.**

**IMPORTANT: Notes are add-only. Edit and delete are not supported by this MCP.**

**Required:**
- content: Note text (plain or HTML)
- At least ONE of: companyIds, personIds, or opportunityIds

**Optional:**
- contentType: "text" (default) or "html" for rich formatting

**HTML Content Examples:**
- Bold: <strong>important</strong>
- Italic: <em>emphasis</em>
- Links: <a href="https://drive.google.com/...">Pitch Deck</a>
- Lists: <ul><li>Item 1</li><li>Item 2</li></ul>

**Returns (JSON):**
{
  "success": true,
  "note": {
    "id": number,           // New note ID
    "content": string,
    "creator_id": number,
    "organization_ids": number[],
    "person_ids": number[],
    "opportunity_ids": number[],
    "created_at": string    // ISO 8601
  }
}

**Example - Add note with link to company:**
{
  "content": "Received pitch deck: <a href='https://drive.google.com/file/xyz'>View Deck</a>",
  "companyIds": [223449211],
  "contentType": "html"
}

**Use Cases:**
- Record meeting notes
- Add document links (Google Drive, Dropbox)
- Log call summaries
- Document investment decisions`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      content: {
        type: 'string',
        minLength: 1,
        description: 'Note content (required). Plain text or HTML depending on contentType.'
      },
      companyIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Company IDs to attach note to. Get IDs from affinity_search_companies.'
      },
      personIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Person IDs to attach note to. Get IDs from affinity_search_persons.'
      },
      opportunityIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Opportunity IDs to attach note to. Get IDs from affinity_list_opportunities.'
      },
      contentType: {
        type: 'string',
        enum: ['text', 'html'],
        description: 'Content type: "text" (default) or "html" for rich formatting with links, bold, etc.'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: ['content']
  },
  annotations: {
    title: 'Add Note',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,  // Creating same note twice creates duplicates
    openWorldHint: true
  }
};

/**
 * Format V2 note for markdown output
 */
function formatNoteMarkdown(note: V2Note, index: number): string {
  const lines: string[] = [];
  const creatorName = `${note.creator.firstName} ${note.creator.lastName}`.trim();
  const date = new Date(note.createdAt).toLocaleString();

  lines.push(`### Note ${index + 1} (ID: ${note.id})`);
  lines.push(`- **Created by:** ${creatorName}`);
  lines.push(`- **Date:** ${date}`);
  lines.push(`- **Type:** ${note.type}`);
  lines.push('');
  lines.push('**Content:**');
  // Strip HTML tags for markdown display
  const textContent = note.content.html
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  lines.push(`> ${textContent}`);

  return lines.join('\n');
}

/**
 * Extract cursor from nextUrl
 * V2 BETA uses URL-based pagination, we extract the cursor param
 */
function extractCursorFromUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('cursor');
  } catch {
    return null;
  }
}

/**
 * Execute list company notes tool
 *
 * @see GET /v2/companies/{companyId}/notes (BETA)
 */
export async function executeListCompanyNotes(input: ListCompanyNotesInput): Promise<string> {
  try {
    const client = getClient();

    // Build params
    const params: Record<string, string | number | undefined> = {};

    if (input.cursor) {
      params.cursor = input.cursor;
    }
    if (input.limit !== undefined) {
      params.limit = input.limit;
    }

    const response = await client.get<V2ListNotesResponse>(
      `/v2/companies/${input.companyId}/notes`,
      params
    );

    const notes = response.data || [];
    const nextCursor = extractCursorFromUrl(response.pagination?.nextUrl);
    const hasMore = !!nextCursor;

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Notes for Company ${input.companyId}`);
      lines.push('');

      if (notes.length === 0) {
        lines.push('*No notes found for this company.*');
      } else {
        lines.push(`Found **${notes.length}** note(s)${hasMore ? ' (more available)' : ''}`);
        lines.push('');

        for (let i = 0; i < notes.length; i++) {
          lines.push(formatNoteMarkdown(notes[i], i));
          lines.push('');
        }
      }

      if (nextCursor) {
        lines.push('---');
        lines.push(`*More notes available. Use cursor: \`${nextCursor}\`*`);
      }

      let result = lines.join('\n');

      // Truncate if needed
      if (result.length > CHARACTER_LIMIT) {
        const halfCount = Math.max(1, Math.floor(notes.length / 2));
        const truncatedLines: string[] = [];
        truncatedLines.push(`# Notes for Company ${input.companyId}`);
        truncatedLines.push('');
        truncatedLines.push(`**Showing ${halfCount} of ${notes.length} notes** (truncated)`);
        truncatedLines.push('');

        for (let i = 0; i < halfCount; i++) {
          truncatedLines.push(formatNoteMarkdown(notes[i], i));
          truncatedLines.push('');
        }

        truncatedLines.push('---');
        truncatedLines.push('*Response truncated. Use cursor to see more notes.*');
        result = truncatedLines.join('\n');
      }

      return result;
    }

    // JSON response
    const result = {
      notes,
      count: notes.length,
      hasMore,
      nextCursor,
      summary: notes.length === 0
        ? 'No notes found for this company'
        : `Found ${notes.length} note(s)${hasMore ? ' (more available with cursor)' : ''}`
    };

    let jsonResult = JSON.stringify(result, null, 2);

    // Truncate if needed
    if (jsonResult.length > CHARACTER_LIMIT) {
      const halfCount = Math.max(1, Math.floor(notes.length / 2));
      const truncatedResult = {
        notes: notes.slice(0, halfCount),
        count: halfCount,
        hasMore: true,
        nextCursor,
        truncated: true,
        truncatedFrom: notes.length,
        summary: `Showing ${halfCount} of ${notes.length} notes (truncated)`
      };
      jsonResult = JSON.stringify(truncatedResult, null, 2);
    }

    return jsonResult;
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute add note tool
 *
 * @see POST /notes (V1)
 */
export async function executeAddNote(input: AddNoteInput): Promise<string> {
  try {
    const client = getClientV1();

    // Build V1 API request body (snake_case)
    const body: Record<string, unknown> = {
      content: input.content,
      // Map contentType to V1 type field: 'text' -> 0, 'html' -> 2
      type: input.contentType === 'html' ? 2 : 0
    };

    // Map companyIds to organization_ids (V1 naming)
    if (input.companyIds && input.companyIds.length > 0) {
      body.organization_ids = input.companyIds;
    }

    if (input.personIds && input.personIds.length > 0) {
      body.person_ids = input.personIds;
    }

    if (input.opportunityIds && input.opportunityIds.length > 0) {
      body.opportunity_ids = input.opportunityIds;
    }

    const response = await client.post<V1Note>('/notes', body);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push('# Note Created Successfully');
      lines.push('');
      lines.push(`- **Note ID:** ${response.id}`);
      lines.push(`- **Created:** ${response.created_at}`);
      lines.push(`- **Type:** ${response.type === 2 ? 'HTML' : 'Plain Text'}`);

      if (response.organization_ids.length > 0) {
        lines.push(`- **Attached to Companies:** ${response.organization_ids.join(', ')}`);
      }
      if (response.person_ids.length > 0) {
        lines.push(`- **Attached to Persons:** ${response.person_ids.join(', ')}`);
      }
      if (response.opportunity_ids.length > 0) {
        lines.push(`- **Attached to Opportunities:** ${response.opportunity_ids.join(', ')}`);
      }

      lines.push('');
      lines.push('**Content:**');
      lines.push(`> ${response.content.substring(0, 500)}${response.content.length > 500 ? '...' : ''}`);
      lines.push('');
      lines.push('---');
      lines.push('*Note created successfully. Use affinity_list_company_notes to verify.*');

      return lines.join('\n');
    }

    // JSON response with helpful metadata
    const result = {
      success: true,
      message: 'Note created successfully',
      note: {
        id: response.id,
        content: response.content,
        type: response.type,
        typeLabel: response.type === 2 ? 'html' : 'text',
        creatorId: response.creator_id,
        organizationIds: response.organization_ids,
        personIds: response.person_ids,
        opportunityIds: response.opportunity_ids,
        createdAt: response.created_at
      },
      hint: 'Use affinity_list_company_notes to verify the note was added'
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
