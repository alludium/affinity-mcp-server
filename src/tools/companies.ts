import { getClient, extractCursor, formatPaginatedResponse, formatPaginatedMarkdown, formatEntityMarkdown } from '../client.js';
import { formatError } from '../utils/errors.js';
import { ListCompaniesInput, GetCompanyInput } from '../schemas/inputs.js';

/**
 * Company response type from Affinity API v2
 *
 * @see GET /v2/companies
 * @see GET /v2/companies/{companyId}
 */
interface Company {
  /** Unique company identifier */
  id: number;
  /** Company name */
  name: string;
  /** Primary domain (e.g., "zoho.com") */
  domain?: string;
  /** All associated domains */
  domains?: string[];
  /** Whether this is a global/shared company record */
  isGlobal?: boolean;
  /** Field data (only returned when fieldIds or fieldTypes specified) */
  fields?: Array<{
    id: string;
    type: 'enriched' | 'global';
    name: string;
    enrichmentSource?: string;
    value: {
      type: string;
      data: unknown;
    };
  }>;
}

interface PaginatedCompaniesResponse {
  data: Company[];
  pagination?: {
    nextPageToken?: string;
  };
}

/**
 * Tool definition for affinity_list_companies
 *
 * Validated against: GET /v2/companies
 */
export const listCompaniesToolDefinition = {
  name: 'affinity_list_companies',
  title: 'List Companies',
  description: `List companies (organizations) from Affinity CRM.

Returns company records with optional field data. Without fieldTypes parameter, returns only basic info (id, name, domain, domains, isGlobal).

**Field Types:**
- enriched: Data from Affinity Data and Dealroom (description, employees, funding, location, LinkedIn, industry, etc.)
- global: Your account's custom company fields

**Important Notes:**
- This endpoint does NOT support text/name filtering
- To find specific companies: use the 'ids' parameter with known company IDs
- To search/filter companies: use Saved Views via affinity_get_list_entries
- Returns max 100 companies per request; use cursor for pagination

**Returns (JSON):**
{
  "data": [
    {
      "id": number,           // Company ID
      "name": string,         // Company name
      "domain": string,       // Primary domain
      "domains": string[],    // All domains
      "isGlobal": boolean,    // Is shared record
      "fields": [...]         // Field data (if requested)
    }
  ],
  "count": number,            // Items in response
  "hasMore": boolean,         // More results available
  "nextCursor": string|null,  // Pagination cursor
  "summary": string           // Human-readable summary
}

**Example enriched fields returned:**
- affinity-data-description (company description)
- affinity-data-number-of-employees (employee count)
- affinity-data-location (city, state, country)
- affinity-data-total-funding-amount (USD)
- affinity-data-linkedin-url`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      ids: {
        type: 'array',
        items: { type: 'number' },
        description: 'Filter by specific company IDs. Example: [1514108, 279041073]'
      },
      fieldTypes: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['enriched', 'global']
        },
        description: 'Field categories to include. Options: "enriched" (Affinity Data, Dealroom), "global" (custom fields). Without this, no field data is returned.'
      },
      fieldIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific field IDs to return. Example: ["affinity-data-description", "affinity-data-location"]'
      },
      limit: {
        type: 'number',
        minimum: 1,
        maximum: 100,
        description: 'Number of companies to return per page. Default: 100, Max: 100'
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
    title: 'List Companies',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_get_company
 *
 * Validated against: GET /v2/companies/{companyId}
 */
export const getCompanyToolDefinition = {
  name: 'affinity_get_company',
  title: 'Get Company',
  description: `Get a single company by ID from Affinity CRM.

Returns company details with optional field data. Without fieldTypes/fieldIds, returns only basic info (id, name, domain, domains, isGlobal).

**Field Types:**
- enriched: Data from Affinity Data and Dealroom (description, employees, funding, location, LinkedIn, etc.)
- global: Your account's custom company fields

**Returns (JSON):**
{
  "id": number,           // Company ID
  "name": string,         // Company name
  "domain": string,       // Primary domain
  "domains": string[],    // All domains
  "isGlobal": boolean,    // Is shared record
  "fields": [             // Field data (if requested)
    {
      "id": string,       // Field ID
      "type": string,     // "enriched" or "global"
      "name": string,     // Field name
      "value": {
        "type": string,   // Value type
        "data": any       // Field value
      }
    }
  ]
}

**Example field IDs you can request:**
- affinity-data-description
- affinity-data-number-of-employees
- affinity-data-location
- affinity-data-total-funding-amount
- affinity-data-linkedin-url
- affinity-data-industry`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      companyId: {
        type: 'string',
        description: 'Company ID (numeric). Get IDs from affinity_list_companies or affinity_get_list_entries.'
      },
      fieldTypes: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['enriched', 'global']
        },
        description: 'Field categories to include. Options: "enriched" (Affinity Data, Dealroom), "global" (custom fields).'
      },
      fieldIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Specific field IDs to return. Example: ["affinity-data-description", "affinity-data-location"]'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" for structured data or "markdown" for human-readable. Default: "json"'
      }
    },
    required: ['companyId']
  },
  annotations: {
    title: 'Get Company',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Format a company for markdown output
 */
function formatCompanyMarkdown(company: Company): string {
  const lines: string[] = [];
  lines.push(`## ${company.name} (ID: ${company.id})`);
  if (company.domain) {
    lines.push(`- **Domain:** ${company.domain}`);
  }
  if (company.domains && company.domains.length > 0) {
    lines.push(`- **All Domains:** ${company.domains.join(', ')}`);
  }
  if (company.isGlobal !== undefined) {
    lines.push(`- **Global Record:** ${company.isGlobal ? 'Yes' : 'No'}`);
  }
  if (company.fields && company.fields.length > 0) {
    lines.push('');
    lines.push('### Fields');
    for (const field of company.fields) {
      const value = field.value?.data !== undefined ? JSON.stringify(field.value.data) : 'N/A';
      lines.push(`- **${field.name}:** ${value}`);
    }
  }
  return lines.join('\n');
}

/**
 * Execute list companies tool
 *
 * @see GET /v2/companies
 */
export async function executeListCompanies(input: ListCompaniesInput): Promise<string> {
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

    const response = await client.get<PaginatedCompaniesResponse>('/v2/companies', params);
    const nextCursor = extractCursor(response);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      return formatPaginatedMarkdown(
        response.data,
        nextCursor,
        'Companies',
        (item) => formatCompanyMarkdown(item)
      );
    }

    const result = formatPaginatedResponse(response.data, nextCursor, 'companies');
    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute get company tool
 *
 * @see GET /v2/companies/{companyId}
 */
export async function executeGetCompany(input: GetCompanyInput): Promise<string> {
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

    const response = await client.get<Company>(`/v2/companies/${input.companyId}`, params);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      return formatEntityMarkdown(response.name, [
        { content: formatCompanyMarkdown(response) }
      ]);
    }

    return JSON.stringify(response, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
