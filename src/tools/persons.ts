import { getClient, extractCursor, formatPaginatedResponse, formatPaginatedMarkdown, formatEntityMarkdown } from '../client.js';
import { formatError } from '../utils/errors.js';
import { ListPersonsInput, GetPersonInput } from '../schemas/inputs.js';

/**
 * Person response type from Affinity API v2
 *
 * @see GET /v2/persons
 * @see GET /v2/persons/{personId}
 */
interface Person {
  /** Unique person identifier */
  id: number;
  /** First name */
  firstName?: string;
  /** Last name */
  lastName?: string;
  /** Primary email address */
  primaryEmailAddress?: string;
  /** All email addresses */
  emailAddresses?: string[];
  /** Person type: "internal" (in your org) or "external" */
  type?: 'internal' | 'external';
  /** Field data (only returned when fieldIds or fieldTypes specified) */
  fields?: Array<{
    id: string;
    type: 'enriched' | 'global' | 'relationship-intelligence';
    name: string;
    enrichmentSource?: string | null;
    value: {
      type: string;
      data: unknown;
    };
  }>;
}

interface PaginatedPersonsResponse {
  data: Person[];
  pagination?: {
    nextPageToken?: string;
  };
}

/**
 * Tool definition for affinity_list_persons
 *
 * Validated against: GET /v2/persons
 */
export const listPersonsToolDefinition = {
  name: 'affinity_list_persons',
  title: 'List Persons',
  description: `List persons (contacts) from Affinity CRM.

Returns person records with optional field data. Without fieldTypes parameter, returns only basic info (id, firstName, lastName, primaryEmailAddress, emailAddresses, type).

**Field Types:**
- enriched: Data from Affinity Data (8 fields: job title, organization, location, phone, LinkedIn, etc.)
- global: Your account's custom person fields
- relationship-intelligence: Email/calendar derived data (9 fields: first/last email, events, etc.)

**Important Notes:**
- This endpoint does NOT support text/name filtering
- To find specific persons: use the 'ids' parameter with known person IDs
- To search/filter persons: use Saved Views via affinity_get_list_entries
- Returns max 100 persons per request; use cursor for pagination
- type="internal" means person is in your organization

**Returns (JSON):**
{
  "data": [
    {
      "id": number,                // Person ID
      "firstName": string,         // First name
      "lastName": string,          // Last name
      "primaryEmailAddress": string, // Main email
      "emailAddresses": string[],  // All emails
      "type": string,              // "internal" or "external"
      "fields": [...]              // Field data (if requested)
    }
  ],
  "count": number,                 // Items in response
  "hasMore": boolean,              // More results available
  "nextCursor": string|null,       // Pagination cursor
  "summary": string                // Human-readable summary
}

**Enriched fields (8):**
- affinity-data-current-job-title, affinity-data-current-organization
- affinity-data-job-titles, affinity-data-industry
- affinity-data-location, affinity-data-phone-number
- affinity-data-linkedin-url, companies (Organizations)

**Relationship Intelligence fields (9):**
- first-email, last-email, last-contact
- first-event, last-event, next-event
- first-chat-message, last-chat-message
- source-of-introduction`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'Filter by specific person IDs. Example: [66880587, 142768223]'
      },
      fieldTypes: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['enriched', 'global', 'relationship-intelligence']
        },
        description: 'Field categories to include. Options: "enriched" (Affinity Data), "global" (custom fields), "relationship-intelligence" (email/calendar data). Without this, no field data is returned.'
      },
      fieldIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific field IDs to return. Example: ["affinity-data-current-job-title", "last-email"]'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Number of persons to return per page. Default: 100, Max: 100'
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
    title: 'List Persons',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_get_person
 *
 * Validated against: GET /v2/persons/{personId}
 */
export const getPersonToolDefinition = {
  name: 'affinity_get_person',
  title: 'Get Person',
  description: `Get a single person by ID from Affinity CRM.

Returns person details with optional field data. Without fieldTypes/fieldIds, returns only basic info (id, firstName, lastName, primaryEmailAddress, emailAddresses, type).

**Field Types:**
- enriched: Data from Affinity Data (job title, organization, location, phone, LinkedIn)
- global: Your account's custom person fields
- relationship-intelligence: Email/calendar derived data (first/last email, events, etc.)

**Returns (JSON):**
{
  "id": number,                 // Person ID
  "firstName": string,          // First name
  "lastName": string,           // Last name
  "primaryEmailAddress": string, // Main email
  "emailAddresses": string[],   // All emails
  "type": string,               // "internal" or "external"
  "fields": [                   // Field data (if requested)
    {
      "id": string,             // Field ID
      "type": string,           // "enriched", "global", or "relationship-intelligence"
      "name": string,           // Field name
      "value": {
        "type": string,         // Value type
        "data": any             // Field value
      }
    }
  ]
}

**Example field IDs you can request:**
- affinity-data-current-job-title
- affinity-data-current-organization
- affinity-data-location
- last-email, first-email
- source-of-introduction`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      personId: {
        type: 'string',
        description: 'Person ID (numeric). Get IDs from affinity_list_persons or affinity_get_list_entries.'
      },
      fieldTypes: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['enriched', 'global', 'relationship-intelligence']
        },
        description: 'Field categories to include. Options: "enriched", "global", "relationship-intelligence".'
      },
      fieldIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific field IDs to return. Example: ["affinity-data-current-job-title", "last-email"]'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" for structured data or "markdown" for human-readable. Default: "json"'
      }
    },
    required: ['personId']
  },
  annotations: {
    title: 'Get Person',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Format a person for markdown output
 */
function formatPersonMarkdown(person: Person): string {
  const lines: string[] = [];
  const name = [person.firstName, person.lastName].filter(Boolean).join(' ') || 'Unknown';
  lines.push(`## ${name} (ID: ${person.id})`);
  if (person.primaryEmailAddress) {
    lines.push(`- **Email:** ${person.primaryEmailAddress}`);
  }
  if (person.emailAddresses && person.emailAddresses.length > 1) {
    lines.push(`- **All Emails:** ${person.emailAddresses.join(', ')}`);
  }
  if (person.type) {
    lines.push(`- **Type:** ${person.type}`);
  }
  if (person.fields && person.fields.length > 0) {
    lines.push('');
    lines.push('### Fields');
    for (const field of person.fields) {
      const value = field.value?.data !== undefined ? JSON.stringify(field.value.data) : 'N/A';
      lines.push(`- **${field.name}:** ${value}`);
    }
  }
  return lines.join('\n');
}

/**
 * Execute list persons tool
 *
 * @see GET /v2/persons
 */
export async function executeListPersons(input: ListPersonsInput): Promise<string> {
  try {
    const client = getClient();

    // Build params - only include what's provided (API has sensible defaults)
    const params: Record<string, string | string[] | number | number[] | undefined> = {};

    if (input.ids && input.ids.length > 0) {
      params.ids = input.ids;
    }
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

    const response = await client.get<PaginatedPersonsResponse>('/v2/persons', params);
    const nextCursor = extractCursor(response);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      return formatPaginatedMarkdown(
        response.data,
        nextCursor,
        'Persons',
        (item) => formatPersonMarkdown(item)
      );
    }

    const result = formatPaginatedResponse(response.data, nextCursor, 'persons');
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute get person tool
 *
 * @see GET /v2/persons/{personId}
 */
export async function executeGetPerson(input: GetPersonInput): Promise<string> {
  try {
    const client = getClient();

    // Build params - only include what's provided
    const params: Record<string, string | string[] | undefined> = {};

    if (input.fieldTypes && input.fieldTypes.length > 0) {
      params.fieldTypes = input.fieldTypes;
    }
    if (input.fieldIds && input.fieldIds.length > 0) {
      params.fieldIds = input.fieldIds;
    }

    const response = await client.get<Person>(`/v2/persons/${input.personId}`, params);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      const name = [response.firstName, response.lastName].filter(Boolean).join(' ') || 'Person';
      return formatEntityMarkdown(name, [
        { content: formatPersonMarkdown(response) }
      ]);
    }

    return JSON.stringify(response, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
