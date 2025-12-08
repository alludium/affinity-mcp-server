/**
 * V1 Companies Tools - Search and Create
 *
 * These tools use the V1 API which supports operations not available in V2:
 * - Search companies/organizations by name or domain
 * - Create new companies/organizations
 *
 * Note: V1 API calls them "organizations", V2 calls them "companies".
 * IDs are compatible between both APIs.
 *
 * V1 API uses Basic Authentication and different response formats.
 *
 * @see https://api-docs.affinity.co/#organizations
 */

import { getClientV1 } from '../client-v1.js';
import { formatError } from '../utils/errors.js';
import { SearchCompaniesInput, CreateCompanyInput } from '../schemas/inputs.js';
import { CHARACTER_LIMIT } from '../constants.js';

/**
 * V1 Organization (Company) response type
 *
 * Note: V1 uses snake_case, V2 uses camelCase
 * V1 calls them "organizations", V2 calls them "companies"
 */
interface V1Organization {
  /** Unique organization identifier - compatible with V2 company IDs */
  id: number;
  /** Organization name */
  name: string;
  /** Primary domain (e.g., "acme.com") */
  domain: string | null;
  /** All associated domains */
  domains: string[];
  /**
   * Whether this is a global/shared record from Affinity's database.
   * - true: Shared record (cannot modify name/domain, cannot delete)
   * - false: Custom record you created (can modify and delete)
   */
  global: boolean;
  /** Interaction dates (if requested) */
  interaction_dates?: {
    first_email_date?: string | null;
    last_email_date?: string | null;
    first_event_date?: string | null;
    last_event_date?: string | null;
    last_interaction_date?: string | null;
  };
  /** Person IDs from interactions (if requested) */
  interaction_person_ids?: number[];
  /** Opportunity IDs (if requested) */
  opportunity_ids?: number[];
}

/**
 * V1 Search organizations response
 */
interface V1SearchOrganizationsResponse {
  organizations: V1Organization[];
  next_page_token?: string | null;
}

/**
 * Tool definition for affinity_search_companies
 *
 * Validated against: GET /organizations (V1 API)
 */
export const searchCompaniesToolDefinition = {
  name: 'affinity_search_companies',
  title: 'Search Companies',
  description: `Search for companies (organizations) in Affinity by name or domain.

**This is a V1 API endpoint - search is NOT available in V2.**

Use this tool to:
- Find a company by its domain (e.g., "acme.com")
- Search for companies by name
- List all companies (omit term parameter)

**Search Behavior:**
- Domain search: Exact and partial matching (e.g., "acme" matches "acme.com")
- Name search: Partial matching on organization name
- Empty term: Returns all organizations (paginated)

**Global vs Custom Organizations:**
- global=true: Shared record from Affinity's database (cannot modify/delete)
- global=false: Custom organization you created (can modify/delete)

**Parameters:**
- term: Company name or domain to search
- withInteractionDates: Include first/last email and event timestamps
- pageSize: Results per page (max 500)
- pageToken: Pagination token for next page

**Returns (JSON):**
{
  "organizations": [
    {
      "id": number,           // Use with V2 affinity_get_company
      "name": string,
      "domain": string | null,
      "domains": string[],
      "global": boolean,      // true=shared, false=custom
      "interaction_dates": {} // if requested
    }
  ],
  "next_page_token": string | null,
  "count": number,
  "hasMore": boolean
}

**Example use cases:**
- Look up company by domain: term="acme.com"
- Search by name: term="Acme Corporation"
- Find companies at a TLD: term=".io"`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      term: {
        type: 'string',
        description: 'Search term: company name or domain. Omit to list all companies.'
      },
      withInteractionDates: {
        type: 'boolean',
        description: 'Include first/last email and event timestamps'
      },
      withInteractionPersons: {
        type: 'boolean',
        description: 'Include person IDs from interactions'
      },
      withOpportunities: {
        type: 'boolean',
        description: 'Include opportunity IDs'
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
    title: 'Search Companies',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_create_company
 *
 * Validated against: POST /organizations (V1 API)
 */
export const createCompanyToolDefinition = {
  name: 'affinity_create_company',
  title: 'Create Company',
  description: `Create a new company (organization) in Affinity.

**This is a V1 API endpoint - creation is NOT available in V2.**

**Required fields:**
- name: Company name

**Optional fields:**
- domain: Primary domain (e.g., "acme.com")
- domains: Additional domains

**Important:**
- Created companies are always custom (global=false)
- Global companies from Affinity's shared database cannot be created this way
- Use affinity_search_companies first to check if company exists
- Created company can be retrieved via V2 affinity_get_company using returned ID

**Returns (JSON):**
{
  "id": number,              // Use this ID with other tools
  "name": string,
  "domain": string | null,
  "domains": string[],
  "global": false            // Always false for created companies
}

**Example workflow:**
1. Search: affinity_search_companies with term="acme.com"
2. If not found: affinity_create_company with name, domain
3. Get full details: affinity_get_company with the returned ID
4. Add note: affinity_add_note with the returned company ID`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      name: {
        type: 'string',
        minLength: 1,
        description: 'Company name (required)'
      },
      domain: {
        type: 'string',
        description: 'Primary domain (e.g., "acme.com")'
      },
      domains: {
        type: 'array',
        items: { type: 'string' },
        description: 'Additional domains'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" or "markdown". Default: "json"'
      }
    },
    required: ['name']
  },
  annotations: {
    title: 'Create Company',
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,  // Creating same company twice may create duplicates
    openWorldHint: true
  }
};

/**
 * Format V1 organization for markdown output
 */
function formatOrganizationMarkdown(org: V1Organization): string {
  const lines: string[] = [];

  lines.push(`## ${org.name} (ID: ${org.id})`);
  lines.push(`- **Type:** ${org.global ? 'Global (shared)' : 'Custom'}`);

  if (org.domain) {
    lines.push(`- **Domain:** ${org.domain}`);
  }

  if (org.domains && org.domains.length > 0) {
    lines.push(`- **All Domains:** ${org.domains.join(', ')}`);
  }

  if (org.interaction_dates) {
    const dates = org.interaction_dates;
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
 * Execute search companies tool
 *
 * @see GET /organizations (V1 API)
 */
export async function executeSearchCompanies(input: SearchCompaniesInput): Promise<string> {
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
    if (input.pageSize !== undefined) {
      params.page_size = input.pageSize;
    }
    if (input.pageToken !== undefined) {
      params.page_token = input.pageToken;
    }

    const response = await client.get<V1SearchOrganizationsResponse>('/organizations', params);

    const organizations = response.organizations || [];
    const nextPageToken = response.next_page_token || null;
    const hasMore = !!nextPageToken;

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push('# Search Results: Companies');
      lines.push('');
      lines.push(`Found **${organizations.length}** company/companies${hasMore ? ' (more available)' : ''}`);
      lines.push('');

      for (const org of organizations) {
        lines.push(formatOrganizationMarkdown(org));
        lines.push('');
      }

      if (nextPageToken) {
        lines.push('---');
        lines.push(`*More results available. Use pageToken: \`${nextPageToken}\`*`);
      }

      let result = lines.join('\n');

      // Truncate if needed
      if (result.length > CHARACTER_LIMIT) {
        const halfCount = Math.max(1, Math.floor(organizations.length / 2));
        const truncatedLines: string[] = [];
        truncatedLines.push('# Search Results: Companies');
        truncatedLines.push('');
        truncatedLines.push(`**Showing ${halfCount} of ${organizations.length} companies** (truncated)`);
        truncatedLines.push('');

        for (let i = 0; i < halfCount; i++) {
          truncatedLines.push(formatOrganizationMarkdown(organizations[i]));
          truncatedLines.push('');
        }

        truncatedLines.push('---');
        truncatedLines.push('*Response truncated. Use pageToken or more specific search term.*');
        result = truncatedLines.join('\n');
      }

      return result;
    }

    // JSON response - use "companies" for consistency with V2 naming
    const result = {
      companies: organizations,
      count: organizations.length,
      hasMore,
      nextPageToken,
      summary: `Found ${organizations.length} company/companies${hasMore ? ' (more available with pageToken)' : ''}`
    };

    let jsonResult = JSON.stringify(result, null, 2);

    // Truncate if needed
    if (jsonResult.length > CHARACTER_LIMIT) {
      const halfCount = Math.max(1, Math.floor(organizations.length / 2));
      const truncatedResult = {
        companies: organizations.slice(0, halfCount),
        count: halfCount,
        hasMore: true,
        nextPageToken,
        truncated: true,
        truncatedFrom: organizations.length,
        summary: `Showing ${halfCount} of ${organizations.length} companies (truncated). Use pageToken or more specific search.`
      };
      jsonResult = JSON.stringify(truncatedResult, null, 2);
    }

    return jsonResult;
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute create company tool
 *
 * @see POST /organizations (V1 API)
 */
export async function executeCreateCompany(input: CreateCompanyInput): Promise<string> {
  try {
    const client = getClientV1();

    // Build V1 API request body
    const body: Record<string, unknown> = {
      name: input.name
    };

    if (input.domain) {
      body.domain = input.domain;
    }

    if (input.domains && input.domains.length > 0) {
      body.domains = input.domains;
    }

    const response = await client.post<V1Organization>('/organizations', body);

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push('# Company Created Successfully');
      lines.push('');
      lines.push(formatOrganizationMarkdown(response));
      lines.push('');
      lines.push('---');
      lines.push(`*Use ID \`${response.id}\` with other Affinity tools (e.g., affinity_get_company, affinity_add_note)*`);
      return lines.join('\n');
    }

    // JSON response with helpful metadata
    const result = {
      success: true,
      message: 'Company created successfully',
      company: response,
      id: response.id,
      hint: 'Use this ID with affinity_get_company (V2) for full details with fields or affinity_add_note to add notes'
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
