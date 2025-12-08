/**
 * V1 Persons Tools - Search and Create
 *
 * These tools use the V1 API which supports operations not available in V2:
 * - Search persons by email, first name, or last name
 * - Create new persons
 *
 * V1 API uses Basic Authentication and different response formats.
 *
 * @see https://api-docs.affinity.co/#persons
 */

import { getClientV1 } from '../client-v1.js';
import { formatError } from '../utils/errors.js';
import { SearchPersonsInput, CreatePersonInput } from '../schemas/inputs.js';
import { CHARACTER_LIMIT } from '../constants.js';

/**
 * V1 Person response type
 *
 * Note: V1 uses snake_case, V2 uses camelCase
 */
interface V1Person {
  /** Unique person identifier */
  id: number;
  /** Person type: 0 = external, 1 = internal */
  type: number;
  /** First name */
  first_name: string;
  /** Last name */
  last_name: string;
  /** Primary email address */
  primary_email: string | null;
  /** All email addresses */
  emails: string[];
  /** Interaction dates (if requested) */
  interaction_dates?: {
    first_email_date?: string | null;
    last_email_date?: string | null;
    first_event_date?: string | null;
    last_event_date?: string | null;
    last_interaction_date?: string | null;
  };
  /** Current organization IDs (if requested) */
  current_organization_ids?: number[];
  /** Opportunity IDs (if requested) */
  opportunity_ids?: number[];
}

/**
 * V1 Search persons response
 */
interface V1SearchPersonsResponse {
  persons: V1Person[];
  next_page_token?: string | null;
}

/**
 * Tool definition for affinity_search_persons
 *
 * Validated against: GET /persons (V1 API)
 */
export const searchPersonsToolDefinition = {
  name: 'affinity_search_persons',
  title: 'Search Persons',
  description: `Search for persons (contacts) in Affinity by email, first name, or last name.

**This is a V1 API endpoint - search is NOT available in V2.**

Use this tool to:
- Find a person by their email address
- Search for persons by first or last name
- List all persons (omit term parameter)

**Search Behavior:**
- Email search: Partial domain matching works (e.g., "@company.com" finds all at that domain)
- Name search: Partial matching on first_name or last_name
- Empty term: Returns all persons (paginated)

**Parameters:**
- term: Email, first name, or last name to search
- withInteractionDates: Include first/last email and event timestamps
- withCurrentOrganizations: Include organization IDs the person belongs to
- pageSize: Results per page (max 500)
- pageToken: Pagination token for next page

**Returns (JSON):**
{
  "persons": [
    {
      "id": number,
      "first_name": string,
      "last_name": string,
      "primary_email": string | null,
      "emails": string[],
      "type": number,           // 0=external, 1=internal
      "interaction_dates": {},  // if requested
      "current_organization_ids": []  // if requested
    }
  ],
  "next_page_token": string | null,
  "count": number,
  "hasMore": boolean
}

**Example use cases:**
- Look up person by email before creating: term="john@example.com"
- Find all persons at a company: term="@acme.com"
- Search by name: term="John"`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      term: {
        type: 'string',
        description: 'Search term: email address, first name, or last name. Omit to list all persons.'
      },
      withInteractionDates: {
        type: 'boolean',
        description: 'Include first/last email and event timestamps'
      },
      withInteractionPersons: {
        type: 'boolean',
        description: 'Include persons involved in interactions'
      },
      withOpportunities: {
        type: 'boolean',
        description: 'Include opportunity IDs associated with person'
      },
      withCurrentOrganizations: {
        type: 'boolean',
        description: 'Include current organization IDs'
      },
      pageSize: {
        type: 'number',
        minimum: 1,
        maximum: 500,
        description: 'Items per page (default 100, max 500)'
      },
      pageToken: {
        type: 'string',
        description: 'Pagination token from previous response (next_page_token)'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: []
  },
  annotations: {
    title: 'Search Persons',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_create_person
 *
 * Validated against: POST /persons (V1 API)
 */
export const createPersonToolDefinition = {
  name: 'affinity_create_person',
  title: 'Create Person',
  description: `Create a new person (contact) in Affinity.

**This is a V1 API endpoint - creation is NOT available in V2.**

**Required fields:**
- firstName: Person's first name
- lastName: Person's last name

**Optional fields:**
- emails: Array of email addresses (first becomes primary)
- organizationIds: Array of organization IDs to associate

**Important:**
- Duplicate email addresses will return a 422 error
- Use affinity_search_persons first to check if person exists
- Created person can be retrieved via V2 affinity_get_person using returned ID

**Returns (JSON):**
{
  "id": number,              // Use this ID with other tools
  "first_name": string,
  "last_name": string,
  "primary_email": string | null,
  "emails": string[],
  "type": 0                  // 0 = external contact
}

**Example workflow:**
1. Search: affinity_search_persons with term="john@example.com"
2. If not found: affinity_create_person with firstName, lastName, emails
3. Add note: affinity_add_note with the returned person ID`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      firstName: {
        type: 'string',
        minLength: 1,
        description: 'First name (required)'
      },
      lastName: {
        type: 'string',
        minLength: 1,
        description: 'Last name (required)'
      },
      emails: {
        type: 'array',
        items: { type: 'string', format: 'email' },
        description: 'Email addresses. First email becomes primary_email. Can be empty array.'
      },
      organizationIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Organization IDs to associate with this person'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: ['firstName', 'lastName']
  },
  annotations: {
    title: 'Create Person',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,  // Creating same person twice will fail (duplicate email)
    openWorldHint: true
  }
};

/**
 * Format V1 person for markdown output
 */
function formatPersonMarkdown(person: V1Person): string {
  const lines: string[] = [];
  const fullName = `${person.first_name} ${person.last_name}`.trim() || 'Unknown';

  lines.push(`## ${fullName} (ID: ${person.id})`);
  lines.push(`- **Type:** ${person.type === 1 ? 'Internal' : 'External'}`);

  if (person.primary_email) {
    lines.push(`- **Primary Email:** ${person.primary_email}`);
  }

  if (person.emails && person.emails.length > 0) {
    lines.push(`- **All Emails:** ${person.emails.join(', ')}`);
  }

  if (person.current_organization_ids && person.current_organization_ids.length > 0) {
    lines.push(`- **Organization IDs:** ${person.current_organization_ids.join(', ')}`);
  }

  if (person.interaction_dates) {
    const dates = person.interaction_dates;
    if (dates.last_email_date) {
      lines.push(`- **Last Email:** ${dates.last_email_date}`);
    }
    if (dates.last_interaction_date) {
      lines.push(`- **Last Interaction:** ${dates.last_interaction_date}`);
    }
  }

  return lines.join('\n');
}

/**
 * Execute search persons tool
 *
 * @see GET /persons (V1 API)
 */
export async function executeSearchPersons(input: SearchPersonsInput): Promise<string> {
  try {
    const client = getClientV1();

    // Build V1 API params (snake_case)
    const params: Record<string, string | number | boolean | undefined> = {};

    if (input.term !== undefined) {
      params.term = input.term;
    }
    if (input.withInteractionDates !== undefined) {
      params.with_interaction_dates = input.withInteractionDates;
    }
    if (input.withInteractionPersons !== undefined) {
      params.with_interaction_persons = input.withInteractionPersons;
    }
    if (input.withOpportunities !== undefined) {
      params.with_opportunities = input.withOpportunities;
    }
    if (input.withCurrentOrganizations !== undefined) {
      params.with_current_organizations = input.withCurrentOrganizations;
    }
    if (input.pageSize !== undefined) {
      params.page_size = input.pageSize;
    }
    if (input.pageToken !== undefined) {
      params.page_token = input.pageToken;
    }

    const response = await client.get<V1SearchPersonsResponse>('/persons', params);

    const persons = response.persons || [];
    const nextPageToken = response.next_page_token || null;
    const hasMore = !!nextPageToken;

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push('# Search Results: Persons');
      lines.push('');
      lines.push(`Found **${persons.length}** person(s)${hasMore ? ' (more available)' : ''}`);
      lines.push('');

      for (const person of persons) {
        lines.push(formatPersonMarkdown(person));
        lines.push('');
      }

      if (nextPageToken) {
        lines.push('---');
        lines.push(`*More results available. Use pageToken: \`${nextPageToken}\`*`);
      }

      let result = lines.join('\n');

      // Truncate if needed
      if (result.length > CHARACTER_LIMIT) {
        const halfCount = Math.max(1, Math.floor(persons.length / 2));
        const truncatedLines: string[] = [];
        truncatedLines.push('# Search Results: Persons');
        truncatedLines.push('');
        truncatedLines.push(`**Showing ${halfCount} of ${persons.length} persons** (truncated)`);
        truncatedLines.push('');

        for (let i = 0; i < halfCount; i++) {
          truncatedLines.push(formatPersonMarkdown(persons[i]));
          truncatedLines.push('');
        }

        truncatedLines.push('---');
        truncatedLines.push('*Response truncated. Use pageToken or more specific search term.*');
        result = truncatedLines.join('\n');
      }

      return result;
    }

    // JSON response
    const result = {
      persons,
      count: persons.length,
      hasMore,
      nextPageToken,
      summary: `Found ${persons.length} person(s)${hasMore ? ' (more available with pageToken)' : ''}`
    };

    let jsonResult = JSON.stringify(result, null, 2);

    // Truncate if needed
    if (jsonResult.length > CHARACTER_LIMIT) {
      const halfCount = Math.max(1, Math.floor(persons.length / 2));
      const truncatedResult = {
        persons: persons.slice(0, halfCount),
        count: halfCount,
        hasMore: true,
        nextPageToken,
        truncated: true,
        truncatedFrom: persons.length,
        summary: `Showing ${halfCount} of ${persons.length} persons (truncated). Use pageToken or more specific search.`
      };
      jsonResult = JSON.stringify(truncatedResult, null, 2);
    }

    return jsonResult;
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute create person tool
 *
 * @see POST /persons (V1 API)
 */
export async function executeCreatePerson(input: CreatePersonInput): Promise<string> {
  try {
    const client = getClientV1();

    // Build V1 API request body (snake_case)
    const body: Record<string, unknown> = {
      first_name: input.firstName,
      last_name: input.lastName,
      emails: input.emails || []
    };

    if (input.organizationIds && input.organizationIds.length > 0) {
      body.organization_ids = input.organizationIds;
    }

    const response = await client.post<V1Person>('/persons', body);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push('# Person Created Successfully');
      lines.push('');
      lines.push(formatPersonMarkdown(response));
      lines.push('');
      lines.push('---');
      lines.push(`*Use ID \`${response.id}\` with other Affinity tools (e.g., affinity_get_person, affinity_add_note)*`);
      return lines.join('\n');
    }

    // JSON response with helpful metadata
    const result = {
      success: true,
      message: 'Person created successfully',
      person: response,
      id: response.id,
      hint: 'Use this ID with affinity_get_person (V2) for full details or affinity_add_note to add notes'
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
