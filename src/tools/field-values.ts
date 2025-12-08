/**
 * V1 Field Values Tools - Read Field Values and Change History
 *
 * This module provides two related V1 API tools:
 * 1. GET /field-values - Retrieve all field values for entities
 * 2. GET /field-value-changes - Retrieve change history for fields
 *
 * These tools enable complete entity inspection and audit trails.
 *
 * **These are V1 API endpoints - NOT available in V2.**
 *
 * V1 API uses Basic Authentication and snake_case naming.
 *
 * @see https://api-docs.affinity.co/#field-values
 * @see https://api-docs.affinity.co/#field-value-changes
 */

import { getClientV1 } from '../client-v1.js';
import { formatError } from '../utils/errors.js';
import { GetFieldValuesInput, GetFieldValueChangesInput } from '../schemas/inputs.js';
import { CHARACTER_LIMIT } from '../constants.js';

/**
 * V1 Field Value response type
 *
 * Note: V1 uses snake_case
 */
interface V1FieldValue {
  /** Unique field value identifier */
  id: number;
  /** Reference to field definition (use with GET /fields) */
  field_id: number;
  /** Entity this value belongs to */
  entity_id: number;
  /**
   * Entity type
   * 0 = Person
   * 1 = Organization/Company
   * 2 = Opportunity
   */
  entity_type: number;
  /**
   * List entry ID if this is a list-specific field
   * null for global fields
   */
  list_entry_id: number | null;
  /**
   * The actual field value - type varies by value_type
   * - Person/Organization (0,1): entity ID number
   * - Dropdown (2): text string
   * - Number (3): numeric value
   * - Date (4): ISO timestamp string
   * - Location (5): object with city, state, country
   * - Text (6): string
   * - Ranked Dropdown (7): object with id, text, rank, color
   */
  value: unknown;
  /**
   * Value type enum
   * 0 = Person
   * 1 = Organization
   * 2 = Dropdown
   * 3 = Number
   * 4 = Date
   * 5 = Location
   * 6 = Text
   * 7 = Ranked Dropdown (e.g., pipeline stages)
   * 8 = Formula
   * 9 = Interaction
   */
  value_type: number;
  /** When field value was created */
  created_at: string;
  /** When field value was last updated (null if never updated) */
  updated_at: string | null;
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
 * Map entity type enum to human-readable name
 */
function getEntityTypeName(entityType: number): string {
  const types: Record<number, string> = {
    0: 'Person',
    1: 'Organization',
    2: 'Opportunity',
  };
  return types[entityType] || `Unknown (${entityType})`;
}

/**
 * Format value for display based on value type
 */
function formatValue(value: unknown, valueType: number): string {
  if (value === null || value === undefined) {
    return 'null';
  }

  switch (valueType) {
    case 2: // Dropdown
    case 7: // Ranked Dropdown
      return typeof value === 'object' ? JSON.stringify(value) : String(value);
    case 3: // Number
      return String(value);
    case 4: // Date
      return String(value);
    case 5: // Location
      return JSON.stringify(value);
    case 6: // Text
      return String(value);
    default:
      return JSON.stringify(value);
  }
}

/**
 * Tool definition for affinity_get_field_values
 *
 * Validated against: GET /field-values (V1 API)
 */
export const getFieldValuesToolDefinition = {
  name: 'affinity_get_field_values',
  title: 'Get Field Values',
  description: `Retrieve all field values for a specific entity (person, organization, opportunity, or list entry).

**This is a V1 API endpoint - field values GET is NOT available in V2.**

Returns complete custom field data for an entity including:
- Global fields (account-wide custom fields)
- List-specific fields (pipeline stages, deal amounts, etc.)
- Field metadata (types, creation/update timestamps)

**Use Cases:**
- Get all custom fields for a company: "What data is populated for this company?"
- Inspect deal pipeline data: "Show me all fields for this list entry"
- Data quality assessment: "Which companies are missing funding amount?"
- Field comparison: "Compare field data between two opportunities"

**Important: Exactly ONE Entity Parameter Required**
The API enforces that you must specify exactly one of:
- person_id: Get field values for a person
- organization_id: Get field values for an organization/company
- opportunity_id: Get field values for an opportunity
- list_entry_id: Get field values for a specific list entry

Providing zero parameters or multiple parameters will result in a 422 error.

**Field Types:**
Field values include a value_type that indicates the data type:
- 0 = Person (references person ID)
- 1 = Organization (references organization ID)
- 2 = Dropdown (single-select text)
- 3 = Number (numeric value)
- 4 = Date (ISO timestamp)
- 5 = Location (city, state, country object)
- 6 = Text (free-form text)
- 7 = Ranked Dropdown (pipeline stages with id, text, rank, color)
- 8 = Formula (computed value)
- 9 = Interaction (email/meeting reference)

**Global vs List-Specific Fields:**
- list_entry_id = null: Global field (applies across all lists)
- list_entry_id = number: List-specific field (only for that list entry)

**Field Name Resolution:**
Field values only contain field_id. To get field names:
1. Call GET /fields or GET /fields?list_id={id}
2. Map field_id to field name
3. Use the mapping to display human-readable field names

**Parameters:**
Choose exactly ONE:
- person_id: Person identifier (number)
- organization_id: Organization/Company identifier (number)
- opportunity_id: Opportunity identifier (number)
- list_entry_id: List entry identifier (number)

**Returns (JSON):**
{
  "fieldValues": [
    {
      "id": number,                    // Field value ID
      "field_id": number,              // Field definition ID (resolve with GET /fields)
      "entity_id": number,             // Entity this value belongs to
      "entity_type": number,           // 0=person, 1=organization, 2=opportunity
      "list_entry_id": number | null,  // null=global, number=list-specific
      "value": any,                    // The actual value (type varies)
      "value_type": number,            // 0-9 (see types above)
      "value_type_name": string,       // Human-readable type name
      "created_at": string,            // ISO timestamp
      "updated_at": string | null      // ISO timestamp or null
    }
  ],
  "count": number,
  "entity_type": string,               // "Person", "Organization", "Opportunity"
  "summary": string
}

**Example Use Cases:**

1. Get company custom fields:
   { "organization_id": 303073231 }
   Returns: Description, Tech tags, LinkedIn URL, Location, Employee count, etc.

2. Get deal pipeline fields:
   { "list_entry_id": 227497865 }
   Returns: Status (Ranked Dropdown), Owners, Raise Amount, Stage, Female Founders, etc.

3. Get person fields:
   { "person_id": 250862100 }
   Returns: Source of Introduction, custom contact fields, etc.

**Error Handling:**
- 422: Must specify exactly one entity parameter
- 422: Invalid entity ID (entity does not exist)
- Empty array: Entity exists but has no field values`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      person_id: {
        type: 'number',
        description: 'Person ID - Get field values for this person (exactly one entity ID required)'
      },
      organization_id: {
        type: 'number',
        description: 'Organization/Company ID - Get field values for this organization (exactly one entity ID required)'
      },
      opportunity_id: {
        type: 'number',
        description: 'Opportunity ID - Get field values for this opportunity (exactly one entity ID required)'
      },
      list_entry_id: {
        type: 'number',
        description: 'List Entry ID - Get field values for this list entry, including list-specific fields (exactly one entity ID required)'
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
    title: 'Get Field Values',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Format field value for markdown output
 */
function formatFieldValueMarkdown(fv: V1FieldValue): string {
  const lines: string[] = [];

  lines.push(`### Field ID ${fv.field_id}`);
  lines.push(`- **Value Type:** ${getValueTypeName(fv.value_type)}`);
  lines.push(`- **Value:** ${formatValue(fv.value, fv.value_type)}`);
  lines.push(`- **Scope:** ${fv.list_entry_id ? `List Entry ${fv.list_entry_id}` : 'Global'}`);
  lines.push(`- **Created:** ${fv.created_at}`);

  if (fv.updated_at) {
    lines.push(`- **Updated:** ${fv.updated_at}`);
  }

  return lines.join('\n');
}

/**
 * Execute get field values tool
 *
 * @see GET /field-values (V1 API)
 */
export async function executeGetFieldValues(input: GetFieldValuesInput): Promise<string> {
  try {
    // Validate that exactly one entity parameter is provided
    const entityParams = [
      input.person_id,
      input.organization_id,
      input.opportunity_id,
      input.list_entry_id
    ].filter(param => param !== undefined);

    if (entityParams.length === 0) {
      return formatError(new Error(
        'Must specify exactly one entity parameter: person_id, organization_id, opportunity_id, or list_entry_id'
      ));
    }

    if (entityParams.length > 1) {
      return formatError(new Error(
        'Must specify exactly ONE entity parameter. Received multiple: ' +
        Object.entries(input)
          .filter(([key, value]) => value !== undefined && key.endsWith('_id'))
          .map(([key]) => key)
          .join(', ')
      ));
    }

    const client = getClientV1();

    // Build V1 API params (snake_case)
    const params: Record<string, number | undefined> = {};

    if (input.person_id !== undefined) {
      params.person_id = input.person_id;
    }
    if (input.organization_id !== undefined) {
      params.organization_id = input.organization_id;
    }
    if (input.opportunity_id !== undefined) {
      params.opportunity_id = input.opportunity_id;
    }
    if (input.list_entry_id !== undefined) {
      params.list_entry_id = input.list_entry_id;
    }

    const response = await client.get<V1FieldValue[]>('/field-values', params);

    const fieldValues = response || [];

    // Determine entity type for summary
    let entityType = 'Entity';
    let entityId = 0;

    if (input.person_id !== undefined) {
      entityType = 'Person';
      entityId = input.person_id;
    } else if (input.organization_id !== undefined) {
      entityType = 'Organization';
      entityId = input.organization_id;
    } else if (input.opportunity_id !== undefined) {
      entityType = 'Opportunity';
      entityId = input.opportunity_id;
    } else if (input.list_entry_id !== undefined) {
      entityType = 'List Entry';
      entityId = input.list_entry_id;
    }

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Field Values: ${entityType} ${entityId}`);
      lines.push('');
      lines.push(`Found **${fieldValues.length}** field value(s)`);
      lines.push('');

      if (fieldValues.length === 0) {
        lines.push('*No field values found for this entity.*');
        lines.push('');
        lines.push('This could mean:');
        lines.push('- Entity has no custom fields populated');
        lines.push('- Entity ID is invalid');
        lines.push('- Entity exists but no data has been entered');
      } else {
        // Count global vs list-specific
        const globalCount = fieldValues.filter(fv => fv.list_entry_id === null).length;
        const listSpecificCount = fieldValues.length - globalCount;

        lines.push(`- **Global fields:** ${globalCount}`);
        lines.push(`- **List-specific fields:** ${listSpecificCount}`);
        lines.push('');

        // Group by scope
        if (globalCount > 0) {
          lines.push('## Global Fields');
          lines.push('');
          fieldValues
            .filter(fv => fv.list_entry_id === null)
            .forEach(fv => {
              lines.push(formatFieldValueMarkdown(fv));
              lines.push('');
            });
        }

        if (listSpecificCount > 0) {
          lines.push('## List-Specific Fields');
          lines.push('');
          fieldValues
            .filter(fv => fv.list_entry_id !== null)
            .forEach(fv => {
              lines.push(formatFieldValueMarkdown(fv));
              lines.push('');
            });
        }

        lines.push('---');
        lines.push('**Next Steps:**');
        lines.push('- Use `affinity_get_list_fields` with list_id to get field names');
        lines.push('- Use `GET /fields` to get global field definitions');
        lines.push('- Match `field_id` from these results to field names');
      }

      let result = lines.join('\n');

      // Truncate if needed
      if (result.length > CHARACTER_LIMIT) {
        const halfCount = Math.max(1, Math.floor(fieldValues.length / 2));
        const truncatedLines: string[] = [];
        truncatedLines.push(`# Field Values: ${entityType} ${entityId}`);
        truncatedLines.push('');
        truncatedLines.push(`**Showing ${halfCount} of ${fieldValues.length} field values** (truncated)`);
        truncatedLines.push('');

        for (let i = 0; i < halfCount; i++) {
          truncatedLines.push(formatFieldValueMarkdown(fieldValues[i]));
          truncatedLines.push('');
        }

        truncatedLines.push('---');
        truncatedLines.push('*Response truncated due to size. Consider using JSON format for complete data.*');
        result = truncatedLines.join('\n');
      }

      return result;
    }

    // JSON response - enrich with type names for readability
    const enrichedFieldValues = fieldValues.map(fv => ({
      ...fv,
      value_type_name: getValueTypeName(fv.value_type),
      entity_type_name: getEntityTypeName(fv.entity_type)
    }));

    const result = {
      fieldValues: enrichedFieldValues,
      count: fieldValues.length,
      entity_type: entityType,
      entity_id: entityId,
      summary: fieldValues.length === 0
        ? `No field values found for ${entityType} ${entityId}`
        : `Found ${fieldValues.length} field value(s) for ${entityType} ${entityId}`,
      hint: fieldValues.length > 0
        ? 'Use affinity_get_list_fields or GET /fields to resolve field_id to field names'
        : undefined
    };

    let jsonResult = JSON.stringify(result, null, 2);

    // Truncate if needed
    if (jsonResult.length > CHARACTER_LIMIT) {
      const halfCount = Math.max(1, Math.floor(fieldValues.length / 2));
      const truncatedResult = {
        fieldValues: enrichedFieldValues.slice(0, halfCount),
        count: halfCount,
        entity_type: entityType,
        entity_id: entityId,
        truncated: true,
        truncatedFrom: fieldValues.length,
        summary: `Showing ${halfCount} of ${fieldValues.length} field values (truncated due to size)`
      };
      jsonResult = JSON.stringify(truncatedResult, null, 2);
    }

    return jsonResult;
  } catch (error) {
    return formatError(error);
  }
}

// ============================================================================
// Field Value Changes - Change History and Audit Trail
// ============================================================================

/**
 * V1 Field Value Change response type
 *
 * Note: V1 uses snake_case
 */
interface V1FieldValueChange {
  /** Unique change record identifier */
  id: number;
  /** Field that was changed */
  field_id: number;
  /** Field value record ID (may be null) */
  field_value_id: number | null;
  /** User who made the change */
  changer: {
    id: number;
    type: number; // User type (0 = person in your account)
    first_name: string;
    last_name: string;
    primary_email: string | null;
  };
  /** When the change occurred */
  changed_at: string;
  /**
   * Action type enum (INTEGER, not string!)
   * 0 = Create
   * 1 = Update
   * 2 = Delete
   */
  action_type: number;
  /** The value after the change */
  value: unknown;
  /** The value before the change (present for some action types) */
  previous_value?: unknown;
}

/**
 * Map action_type enum to human-readable name
 */
function getActionTypeName(actionType: number): string {
  const types: Record<number, string> = {
    0: 'Create',
    1: 'Update',
    2: 'Delete',
  };
  return types[actionType] || `Unknown (${actionType})`;
}

/**
 * Map action_type enum to emoji for display
 */
function getActionTypeEmoji(actionType: number): string {
  const emojis: Record<number, string> = {
    0: '➕',
    1: '✏️',
    2: '🗑️',
  };
  return emojis[actionType] || '❓';
}

/**
 * Tool definition for affinity_get_field_value_changes
 *
 * Validated against: GET /field-value-changes (V1 API)
 */
export const getFieldValueChangesToolDefinition = {
  name: 'affinity_get_field_value_changes',
  title: 'Get Field Value Changes',
  description: `Retrieve change history for a specific field, showing who changed what and when.

**This is a V1 API endpoint - field value changes GET is NOT available in V2.**

Returns complete audit trail for field modifications including:
- Who made the change (name, email)
- When the change occurred (timestamp)
- What changed (new value, previous value for updates)
- Type of change (create, update, delete)

**CRITICAL: Not All Fields Support Change Tracking**

The API only supports change tracking for SOME fields. Common patterns:
- ✅ Status fields (Ranked Dropdown - type 7): SUPPORTED
- ✅ Owners fields (Person - type 0): SUPPORTED
- ✅ Number fields (type 3): SUPPORTED
- ❌ Some Text fields (type 6): NOT SUPPORTED
- ❌ Some Dropdown fields (type 2): NOT SUPPORTED

If a field doesn't support tracking, the API returns 422 error:
"Tracking changes for this entity attribute is not yet supported"

**Use Cases:**
- Track deal progression: "Show me how this deal moved through pipeline stages"
- Accountability: "Who changed the deal amount and when?"
- Audit trail: "What changes were made to this field in the last week?"
- Team activity: "Which team members are most active in updating deals?"
- Data quality: "What values were deleted and when?"

**Required Parameter:**
- field_id: The specific field to track changes for (REQUIRED)

**Optional Filters:**
- action_type: Filter by change type (0=Create, 1=Update, 2=Delete)
- person_id: Show changes only for this person
- organization_id: Show changes only for this organization
- list_entry_id: Show changes only for this list entry
- page_size: Number of results (default 100, max 500)

**Action Type Enum (INTEGER values):**
- 0 = Create: Field value was created/added
- 1 = Update: Field value was modified in place
- 2 = Delete: Field value was removed/deleted

**Returns (JSON):**
{
  "changes": [
    {
      "id": number,                  // Change record ID
      "field_id": number,            // Field that changed
      "field_value_id": number|null, // Field value record
      "changer": {
        "id": number,
        "first_name": string,
        "last_name": string,
        "primary_email": string|null
      },
      "changed_at": string,          // ISO timestamp
      "action_type": number,         // 0, 1, or 2
      "action_type_name": string,    // "Create", "Update", "Delete"
      "value": any,                  // New value
      "previous_value": any          // Old value (if update)
    }
  ],
  "count": number,
  "field_id": number,
  "action_type_distribution": {      // Summary stats
    "create": number,
    "update": number,
    "delete": number
  },
  "unique_changers": number,
  "summary": string
}

**Example Use Cases:**

1. Track Status field changes:
   { "field_id": 4494246 }
   Returns: Complete history of stage movements

2. Filter by action type (deletes only):
   { "field_id": 4494246, "action_type": 2 }
   Returns: Only deleted/removed values

3. Track who changed Owners field:
   { "field_id": 4494247 }
   Returns: History of ownership changes with user details

**Important Notes:**
- field_id is REQUIRED
- action_type must be integer (0, 1, or 2), not string
- API may return ALL results regardless of page_size
- Use affinity_get_list_fields to find field IDs for a list
- Try Status fields first (most likely to have change tracking)

**Error Handling:**
- 422 + "not yet supported": Field doesn't support change tracking
- 422 + "valid id for model": Invalid field_id
- Empty array: Field exists and supports tracking, but no changes yet`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      field_id: {
        type: 'number',
        description: 'Field ID to track changes for (REQUIRED). Use affinity_get_list_fields to discover field IDs.'
      },
      action_type: {
        type: 'number',
        enum: [0, 1, 2],
        description: 'Filter by action type: 0=Create, 1=Update, 2=Delete (optional)'
      },
      person_id: {
        type: 'number',
        description: 'Filter changes for specific person (optional)'
      },
      organization_id: {
        type: 'number',
        description: 'Filter changes for specific organization (optional)'
      },
      list_entry_id: {
        type: 'number',
        description: 'Filter changes for specific list entry (optional)'
      },
      page_size: {
        type: 'number',
        minimum: 1,
        maximum: 500,
        description: 'Number of results to return (default 100, max 500). Note: API may ignore this and return all results.'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format: "json" for structured data or "markdown" for human-readable. Default: "json"'
      }
    },
    required: ['field_id']
  },
  annotations: {
    title: 'Get Field Value Changes',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Format field value change for markdown output
 */
function formatFieldValueChangeMarkdown(change: V1FieldValueChange): string {
  const lines: string[] = [];

  const actionEmoji = getActionTypeEmoji(change.action_type);
  const actionName = getActionTypeName(change.action_type);

  lines.push(`### ${actionEmoji} ${actionName} by ${change.changer.first_name} ${change.changer.last_name}`);
  lines.push(`- **When:** ${change.changed_at}`);
  lines.push(`- **Email:** ${change.changer.primary_email || 'N/A'}`);

  // Format value as JSON string (we don't know value_type in change records)
  const valueStr = typeof change.value === 'object' && change.value !== null
    ? JSON.stringify(change.value)
    : String(change.value ?? 'null');
  lines.push(`- **New Value:** ${valueStr}`);

  if (change.previous_value !== undefined) {
    const prevValueStr = typeof change.previous_value === 'object' && change.previous_value !== null
      ? JSON.stringify(change.previous_value)
      : String(change.previous_value ?? 'null');
    lines.push(`- **Previous Value:** ${prevValueStr}`);
  }

  if (change.field_value_id) {
    lines.push(`- **Field Value ID:** ${change.field_value_id}`);
  }

  return lines.join('\n');
}

/**
 * Execute get field value changes tool
 *
 * @see GET /field-value-changes (V1 API)
 */
export async function executeGetFieldValueChanges(input: GetFieldValueChangesInput): Promise<string> {
  try {
    const client = getClientV1();

    // Build V1 API params (snake_case)
    const params: Record<string, number | undefined> = {
      field_id: input.field_id
    };

    if (input.action_type !== undefined) {
      params.action_type = input.action_type;
    }
    if (input.person_id !== undefined) {
      params.person_id = input.person_id;
    }
    if (input.organization_id !== undefined) {
      params.organization_id = input.organization_id;
    }
    if (input.list_entry_id !== undefined) {
      params.list_entry_id = input.list_entry_id;
    }
    if (input.page_size !== undefined) {
      params.page_size = input.page_size;
    }

    const response = await client.get<V1FieldValueChange[]>('/field-value-changes', params);

    const changes = response || [];

    // Calculate distribution stats
    const distribution = {
      create: changes.filter(c => c.action_type === 0).length,
      update: changes.filter(c => c.action_type === 1).length,
      delete: changes.filter(c => c.action_type === 2).length
    };

    // Count unique changers
    const uniqueChangers = new Set(changes.map(c => c.changer.id)).size;

    // Format based on requested format
    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Field Value Changes: Field ${input.field_id}`);
      lines.push('');

      if (input.action_type !== undefined) {
        lines.push(`**Filter:** Action Type = ${getActionTypeName(input.action_type)}`);
        lines.push('');
      }

      lines.push(`Found **${changes.length}** change(s)`);
      lines.push('');

      if (changes.length === 0) {
        lines.push('*No changes found for this field.*');
        lines.push('');
        lines.push('This could mean:');
        lines.push('- Field is new and hasn\'t been modified yet');
        lines.push('- Field doesn\'t support change tracking (try Status fields)');
        lines.push('- Filters are too restrictive');
        lines.push('');
        lines.push('**Tip:** Status fields (Ranked Dropdown) typically support tracking.');
      } else {
        // Show distribution
        lines.push('## Change Distribution');
        lines.push('');
        lines.push(`- ➕ **Creates:** ${distribution.create} (${((distribution.create / changes.length) * 100).toFixed(1)}%)`);
        lines.push(`- ✏️ **Updates:** ${distribution.update} (${((distribution.update / changes.length) * 100).toFixed(1)}%)`);
        lines.push(`- 🗑️ **Deletes:** ${distribution.delete} (${((distribution.delete / changes.length) * 100).toFixed(1)}%)`);
        lines.push('');
        lines.push(`**Unique Contributors:** ${uniqueChangers} people`);
        lines.push('');

        // Show recent changes
        lines.push('## Recent Changes');
        lines.push('');

        const displayCount = Math.min(20, changes.length);
        for (let i = 0; i < displayCount; i++) {
          lines.push(formatFieldValueChangeMarkdown(changes[i]));
          lines.push('');
        }

        if (changes.length > displayCount) {
          lines.push('---');
          lines.push(`*Showing ${displayCount} of ${changes.length} changes. Use JSON format for complete data.*`);
        }
      }

      let result = lines.join('\n');

      // Truncate if needed
      if (result.length > CHARACTER_LIMIT) {
        const halfCount = Math.max(1, Math.floor(changes.length / 2));
        const truncatedLines: string[] = [];
        truncatedLines.push(`# Field Value Changes: Field ${input.field_id}`);
        truncatedLines.push('');
        truncatedLines.push(`**Showing ${halfCount} of ${changes.length} changes** (truncated)`);
        truncatedLines.push('');

        for (let i = 0; i < halfCount; i++) {
          truncatedLines.push(formatFieldValueChangeMarkdown(changes[i]));
          truncatedLines.push('');
        }

        truncatedLines.push('---');
        truncatedLines.push('*Response truncated due to size. Use JSON format with filters for targeted queries.*');
        result = truncatedLines.join('\n');
      }

      return result;
    }

    // JSON response - enrich with type names for readability
    const enrichedChanges = changes.map(change => ({
      ...change,
      action_type_name: getActionTypeName(change.action_type)
    }));

    const result = {
      changes: enrichedChanges,
      count: changes.length,
      field_id: input.field_id,
      action_type_filter: input.action_type !== undefined
        ? getActionTypeName(input.action_type)
        : undefined,
      action_type_distribution: distribution,
      unique_changers: uniqueChangers,
      summary: changes.length === 0
        ? `No changes found for field ${input.field_id}${input.action_type !== undefined ? ` with action_type=${getActionTypeName(input.action_type)}` : ''}`
        : `Found ${changes.length} change(s) for field ${input.field_id}. ${uniqueChangers} unique contributor(s).`,
      hint: changes.length > 0
        ? 'Use affinity_get_list_fields to resolve field_id to field name'
        : changes.length === 0 && input.action_type === undefined
        ? 'Field may not support change tracking. Try Status fields (Ranked Dropdown) which typically support tracking.'
        : undefined
    };

    let jsonResult = JSON.stringify(result, null, 2);

    // Truncate if needed
    if (jsonResult.length > CHARACTER_LIMIT) {
      const halfCount = Math.max(1, Math.floor(changes.length / 2));
      const truncatedResult = {
        changes: enrichedChanges.slice(0, halfCount),
        count: halfCount,
        field_id: input.field_id,
        action_type_distribution: distribution,
        unique_changers: uniqueChangers,
        truncated: true,
        truncatedFrom: changes.length,
        summary: `Showing ${halfCount} of ${changes.length} changes (truncated due to size). Use filters to narrow results.`
      };
      jsonResult = JSON.stringify(truncatedResult, null, 2);
    }

    return jsonResult;
  } catch (error) {
    // Enhance error message for common cases
    if (error instanceof Error && error.message.includes('not yet supported')) {
      return formatError(new Error(
        `Field ${input.field_id} does not support change tracking. ` +
        `Try Status fields (Ranked Dropdown type) which typically support tracking. ` +
        `Use affinity_get_list_fields to find trackable fields.`
      ));
    }

    return formatError(error);
  }
}
