/**
 * V1 Schema Discovery Tools - Get Field Definitions
 *
 * This module provides V1 API tools for discovering global field schemas:
 * 1. GET /persons/fields - All person field definitions
 * 2. GET /organizations/fields - All organization field definitions
 *
 * These tools enable schema discovery, form generation, and field validation.
 *
 * **These are V1 API endpoints - NOT available in V2.**
 *
 * V1 API uses Basic Authentication and snake_case naming.
 *
 * @see https://api-docs.affinity.co/#get-global-person-fields
 * @see https://api-docs.affinity.co/#get-global-organization-fields
 */

import { getClientV1 } from '../client-v1.js';
import { formatError } from '../utils/errors.js';
import { CHARACTER_LIMIT } from '../constants.js';

/**
 * V1 Field response type
 *
 * Note: V1 uses snake_case
 */
interface V1Field {
  /** Unique field identifier */
  id: number;
  /** Human-readable field name */
  name: string;
  /**
   * Field value type enum
   * 0 = Person
   * 1 = Organization
   * 2 = Dropdown
   * 3 = Number
   * 4 = Date
   * 5 = Location
   * 6 = Text
   * 7 = Ranked Dropdown
   * 8 = Formula
   * 9 = Interaction
   */
  value_type: number;
  /** Whether this field can have multiple values */
  allows_multiple: boolean;
  /** Dropdown options (if field is dropdown type) */
  dropdown_options?: Array<{
    id: number;
    text: string;
    rank: number;
    color: number;
  }>;
  /** External enrichment source (e.g., 'affinity-data', 'crunchbase', 'dealroom') */
  enrichment_source?: string;
  /** Whether field supports change tracking */
  track_changes?: boolean;
}

/**
 * Map value type enum to human-readable name
 */
function getValueTypeName(valueType: number): string {
  const types: Record<number, string> = {
    0: 'Person',
    1: 'Organization',
    2: 'Dropdown',
    3: 'Number',
    4: 'Date',
    5: 'Location',
    6: 'Text',
    7: 'Ranked Dropdown',
    8: 'Formula',
    9: 'Interaction',
  };
  return types[valueType] || `Unknown (${valueType})`;
}

/**
 * Tool definition for affinity_get_persons_fields
 *
 * Validated against: GET /persons/fields (V1 API)
 */
export const getPersonsFieldsToolDefinition = {
  name: 'affinity_get_persons_fields',
  title: 'Get Persons Fields',
  description: `Retrieve all global (account-wide) field definitions for persons.

**This is a V1 API endpoint - persons fields GET is NOT available in V2.**

Returns complete schema information for person fields including:
- Field names and IDs
- Field types (text, number, dropdown, etc.)
- Dropdown options (available choices)
- Multiple value support
- Enrichment sources (external data providers)

**Use Cases:**
- Schema discovery: "What person fields exist in our CRM?"
- Form generation: Build dynamic forms based on available fields
- Field validation: Check if input values are valid for dropdown fields
- Field resolution: Map field IDs to human-readable names
- Data source tracking: Identify which fields come from enrichment providers

**No Parameters Required:**
This is a simple GET request with no parameters. Returns all global person fields.

**Returns (JSON):**
{
  "fields": [
    {
      "id": number,                    // Field identifier
      "name": string,                  // Field display name
      "value_type": number,            // 0-9 enum (see types below)
      "value_type_name": string,       // Human-readable type
      "allows_multiple": boolean,      // Can have multiple values
      "dropdown_options": [...],       // Available choices (if dropdown)
      "enrichment_source": string      // e.g., "affinity-data", "crunchbase"
    }
  ],
  "count": number,
  "by_type": {                         // Distribution by field type
    "Dropdown": number,
    "Text": number,
    ...
  },
  "by_source": {                       // Distribution by data source
    "affinity-data": number,
    "none": number,
    ...
  },
  "summary": string
}

**Field Value Types:**
- 0 = Person: References another person
- 1 = Organization: References an organization
- 2 = Dropdown: Single/multi-select from predefined options
- 3 = Number: Numeric value
- 4 = Date: Date/timestamp
- 5 = Location: Geographic location (city, state, country)
- 6 = Text: Free-form text
- 7 = Ranked Dropdown: Ordered dropdown (e.g., pipeline stages)
- 8 = Formula: Computed/calculated value
- 9 = Interaction: Email/meeting reference

**Enrichment Sources:**
- "affinity-data": Affinity's proprietary data
- "crunchbase": Crunchbase data
- "dealroom": Dealroom data
- "none" or null: Custom fields created by your team

**Example Use Cases:**

1. Discover all person fields:
   No parameters needed
   Returns: Complete list of person field schemas

2. Find dropdown fields:
   Filter response by fields that have dropdown_options

3. Identify enriched fields:
   Filter by enrichment_source to see external data

4. Build dynamic forms:
   Use field definitions to generate input forms programmatically

**Response Format:**
Use responseFormat parameter to get either:
- "json": Structured data with statistics (default)
- "markdown": Human-readable formatted output`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" for structured data or "markdown" for human-readable. Default: "json"'
      }
    },
    required: []
  },
  annotations: {
    title: 'Get Persons Fields',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Tool definition for affinity_get_organizations_fields
 *
 * Validated against: GET /organizations/fields (V1 API)
 */
export const getOrganizationsFieldsToolDefinition = {
  name: 'affinity_get_organizations_fields',
  title: 'Get Organizations Fields',
  description: `Retrieve all global (account-wide) field definitions for organizations/companies.

**This is a V1 API endpoint - organizations fields GET is NOT available in V2.**

Returns complete schema information for organization fields including:
- Field names and IDs
- Field types (text, number, dropdown, etc.)
- Dropdown options (available choices)
- Multiple value support
- Enrichment sources (external data providers like Crunchbase, Dealroom)

**Use Cases:**
- Schema discovery: "What company fields exist in our CRM?"
- Form generation: Build dynamic forms based on available fields
- Field validation: Check if input values are valid for dropdown fields
- Field resolution: Map field IDs to human-readable names
- Data source tracking: Identify which fields come from enrichment providers
- Integration planning: Understand what data is available for export/sync

**No Parameters Required:**
This is a simple GET request with no parameters. Returns all global organization fields.

**Returns (JSON):**
{
  "fields": [
    {
      "id": number,                    // Field identifier
      "name": string,                  // Field display name
      "value_type": number,            // 0-9 enum (see types below)
      "value_type_name": string,       // Human-readable type
      "allows_multiple": boolean,      // Can have multiple values
      "dropdown_options": [...],       // Available choices (if dropdown)
      "enrichment_source": string      // e.g., "crunchbase", "dealroom"
    }
  ],
  "count": number,
  "by_type": {                         // Distribution by field type
    "Dropdown": number,
    "Text": number,
    "Number": number,
    ...
  },
  "by_source": {                       // Distribution by data source
    "crunchbase": number,
    "dealroom": number,
    "affinity-data": number,
    "none": number
  },
  "custom_fields": number,             // Count of non-enriched fields
  "enriched_fields": number,           // Count of enriched fields
  "summary": string
}

**Field Value Types:**
- 0 = Person: References a person
- 1 = Organization: References another organization
- 2 = Dropdown: Single/multi-select from predefined options
- 3 = Number: Numeric value (funding, employees, revenue, etc.)
- 4 = Date: Date/timestamp (founding date, last contact, etc.)
- 5 = Location: Geographic location (HQ, offices)
- 6 = Text: Free-form text (description, notes)
- 7 = Ranked Dropdown: Ordered dropdown (stages, priorities)
- 8 = Formula: Computed/calculated value
- 9 = Interaction: Email/meeting reference

**Enrichment Sources:**
- "crunchbase": Company data from Crunchbase (funding, employees, investors)
- "dealroom": European startup data from Dealroom
- "affinity-data": Affinity's proprietary enrichment data
- "none" or null: Custom fields created by your team

**Example Use Cases:**

1. Discover all organization fields:
   No parameters needed
   Returns: Complete list of organization field schemas

2. Find enriched fields:
   Filter response by enrichment_source to see external data

3. Identify custom fields:
   Filter by enrichment_source = "none" to see team-created fields

4. Get dropdown options:
   Filter by fields with dropdown_options to see valid choices

5. Plan data exports:
   Understand complete schema before building integrations

**Response Format:**
Use responseFormat parameter to get either:
- "json": Structured data with statistics (default)
- "markdown": Human-readable formatted output`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" for structured data or "markdown" for human-readable. Default: "json"'
      }
    },
    required: []
  },
  annotations: {
    title: 'Get Organizations Fields',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Format field for markdown output
 */
function formatFieldMarkdown(field: V1Field): string {
  const lines: string[] = [];

  lines.push(`### ${field.name} (ID: ${field.id})`);
  lines.push(`- **Type:** ${getValueTypeName(field.value_type)}`);
  lines.push(`- **Multiple Values:** ${field.allows_multiple ? 'Yes' : 'No'}`);

  if (field.enrichment_source) {
    lines.push(`- **Source:** ${field.enrichment_source}`);
  }

  if (field.dropdown_options && field.dropdown_options.length > 0) {
    lines.push(`- **Options:** ${field.dropdown_options.length} choices`);
    if (field.dropdown_options.length <= 10) {
      const options = field.dropdown_options.map(o => o.text).join(', ');
      lines.push(`  - ${options}`);
    }
  }

  return lines.join('\n');
}

/**
 * Execute get persons fields tool
 *
 * @see GET /persons/fields (V1 API)
 */
export async function executeGetPersonsFields(responseFormat: 'json' | 'markdown' = 'json'): Promise<string> {
  try {
    const client = getClientV1();
    const response = await client.get<V1Field[]>('/persons/fields');

    const fields = response || [];

    // Calculate statistics
    const byType = new Map<string, number>();
    const bySource = new Map<string, number>();

    fields.forEach(field => {
      const typeName = getValueTypeName(field.value_type);
      byType.set(typeName, (byType.get(typeName) || 0) + 1);

      const source = field.enrichment_source || 'none';
      bySource.set(source, (bySource.get(source) || 0) + 1);
    });

    const multipleFields = fields.filter(f => f.allows_multiple).length;
    const dropdownFields = fields.filter(f => f.dropdown_options && f.dropdown_options.length > 0).length;

    // Format based on requested format
    if (responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push('# Person Fields Schema');
      lines.push('');
      lines.push(`Found **${fields.length}** person field(s)`);
      lines.push('');

      // Statistics
      lines.push('## Statistics');
      lines.push('');
      lines.push(`- **Total Fields:** ${fields.length}`);
      lines.push(`- **Allow Multiple Values:** ${multipleFields}`);
      lines.push(`- **Dropdown Fields:** ${dropdownFields}`);
      lines.push('');

      // By type
      lines.push('### By Field Type');
      lines.push('');
      Array.from(byType.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          const percentage = ((count / fields.length) * 100).toFixed(1);
          lines.push(`- **${type}:** ${count} (${percentage}%)`);
        });
      lines.push('');

      // By source
      lines.push('### By Data Source');
      lines.push('');
      Array.from(bySource.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
          lines.push(`- **${source}:** ${count} field(s)`);
        });
      lines.push('');

      // Field list
      lines.push('## All Fields');
      lines.push('');

      fields.forEach(field => {
        lines.push(formatFieldMarkdown(field));
        lines.push('');
      });

      return lines.join('\n');
    }

    // JSON response with enriched data
    const enrichedFields = fields.map(field => ({
      ...field,
      value_type_name: getValueTypeName(field.value_type)
    }));

    const result = {
      fields: enrichedFields,
      count: fields.length,
      by_type: Object.fromEntries(byType),
      by_source: Object.fromEntries(bySource),
      statistics: {
        total: fields.length,
        allows_multiple: multipleFields,
        has_dropdowns: dropdownFields
      },
      summary: `Found ${fields.length} person field(s). ${multipleFields} allow multiple values.`
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}

/**
 * Execute get organizations fields tool
 *
 * @see GET /organizations/fields (V1 API)
 */
export async function executeGetOrganizationsFields(responseFormat: 'json' | 'markdown' = 'json'): Promise<string> {
  try {
    const client = getClientV1();
    const response = await client.get<V1Field[]>('/organizations/fields');

    const fields = response || [];

    // Calculate statistics
    const byType = new Map<string, number>();
    const bySource = new Map<string, number>();

    fields.forEach(field => {
      const typeName = getValueTypeName(field.value_type);
      byType.set(typeName, (byType.get(typeName) || 0) + 1);

      const source = field.enrichment_source || 'none';
      bySource.set(source, (bySource.get(source) || 0) + 1);
    });

    const multipleFields = fields.filter(f => f.allows_multiple).length;
    const dropdownFields = fields.filter(f => f.dropdown_options && f.dropdown_options.length > 0).length;
    const customFields = fields.filter(f => !f.enrichment_source || f.enrichment_source === 'none').length;
    const enrichedFields = fields.length - customFields;

    // Format based on requested format
    if (responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push('# Organization Fields Schema');
      lines.push('');
      lines.push(`Found **${fields.length}** organization field(s)`);
      lines.push('');

      // Statistics
      lines.push('## Statistics');
      lines.push('');
      lines.push(`- **Total Fields:** ${fields.length}`);
      lines.push(`- **Custom Fields:** ${customFields} (created by your team)`);
      lines.push(`- **Enriched Fields:** ${enrichedFields} (from external sources)`);
      lines.push(`- **Allow Multiple Values:** ${multipleFields}`);
      lines.push(`- **Dropdown Fields:** ${dropdownFields}`);
      lines.push('');

      // By type
      lines.push('### By Field Type');
      lines.push('');
      Array.from(byType.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([type, count]) => {
          const percentage = ((count / fields.length) * 100).toFixed(1);
          lines.push(`- **${type}:** ${count} (${percentage}%)`);
        });
      lines.push('');

      // By source
      lines.push('### By Data Source');
      lines.push('');
      Array.from(bySource.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([source, count]) => {
          lines.push(`- **${source}:** ${count} field(s)`);
        });
      lines.push('');

      // Show limited fields in markdown to avoid truncation
      const displayCount = Math.min(20, fields.length);
      lines.push(`## Sample Fields (showing ${displayCount} of ${fields.length})`);
      lines.push('');

      fields.slice(0, displayCount).forEach(field => {
        lines.push(formatFieldMarkdown(field));
        lines.push('');
      });

      if (fields.length > displayCount) {
        lines.push('---');
        lines.push(`*Showing ${displayCount} of ${fields.length} fields. Use JSON format for complete list.*`);
      }

      return lines.join('\n');
    }

    // JSON response with enriched data
    const enrichedFieldsData = fields.map(field => ({
      ...field,
      value_type_name: getValueTypeName(field.value_type)
    }));

    const result = {
      fields: enrichedFieldsData,
      count: fields.length,
      by_type: Object.fromEntries(byType),
      by_source: Object.fromEntries(bySource),
      statistics: {
        total: fields.length,
        custom: customFields,
        enriched: enrichedFields,
        allows_multiple: multipleFields,
        has_dropdowns: dropdownFields
      },
      summary: `Found ${fields.length} organization field(s). ${customFields} custom, ${enrichedFields} enriched.`
    };

    let jsonResult = JSON.stringify(result, null, 2);

    // Truncate if needed (unlikely but possible with very large schemas)
    if (jsonResult.length > CHARACTER_LIMIT) {
      const halfCount = Math.max(1, Math.floor(fields.length / 2));
      const truncatedResult = {
        ...result,
        fields: enrichedFieldsData.slice(0, halfCount),
        truncated: true,
        truncatedFrom: fields.length,
        summary: `Showing ${halfCount} of ${fields.length} fields (truncated due to size)`
      };
      jsonResult = JSON.stringify(truncatedResult, null, 2);
    }

    return jsonResult;
  } catch (error) {
    return formatError(error);
  }
}
