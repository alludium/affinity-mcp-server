import { z } from 'zod';

/**
 * Zod schemas for runtime input validation.
 *
 * IMPORTANT: These Zod schemas are the source of truth for input validation.
 * The JSON Schema definitions in src/tools/*.ts (inputSchema objects) must be
 * kept in sync with these Zod schemas. When modifying input parameters:
 * 1. Update the Zod schema here first
 * 2. Update the corresponding JSON Schema in the tool definition
 *
 * Future improvement: Use zod-to-json-schema to auto-generate JSON schemas.
 */

// Response format enum for all tools that return data
export const ResponseFormatEnum = z.enum(['json', 'markdown']);
export type ResponseFormat = z.infer<typeof ResponseFormatEnum>;

// Field types available for companies (enriched, global only - no relationship-intelligence)
export const CompanyFieldTypeEnum = z.enum(['enriched', 'global']);

// Field types available for persons (includes relationship-intelligence)
export const PersonFieldTypeEnum = z.enum(['enriched', 'global', 'relationship-intelligence']);

// Field types available for list entries (includes list-specific fields)
export const ListEntryFieldTypeEnum = z.enum(['enriched', 'global', 'list']);

// Legacy enum for backwards compatibility
export const FieldTypeEnum = z.enum([
  'enriched',
  'global',
  'list',
  'relationship-intelligence'
]);

export type FieldType = z.infer<typeof FieldTypeEnum>;

// Numeric ID validator - ensures string IDs are numeric
const NumericIdSchema = z.string()
  .regex(/^\d+$/, 'ID must be numeric (digits only)')
  .describe('Numeric ID');

// Common pagination schema (base for extension)
export const PaginationSchema = z.object({
  limit: z.number().min(1).max(100).optional().describe('Items per page (default 100, max 100)'),
  cursor: z.string().optional().describe('Pagination cursor from previous response')
});

// Common response format schema
export const ResponseFormatSchema = z.object({
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" for structured data or "markdown" for human-readable')
});

/**
 * List companies input schema
 * @see GET /v2/companies
 */
export const ListCompaniesInputSchema = PaginationSchema.extend({
  ids: z.array(z.number()).optional().describe('Filter by specific company IDs'),
  fieldTypes: z.array(CompanyFieldTypeEnum).optional().describe('Field categories: enriched, global'),
  fieldIds: z.array(z.string()).optional().describe('Specific field IDs to return'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();

export type ListCompaniesInput = z.infer<typeof ListCompaniesInputSchema>;

/**
 * Get company input schema
 * @see GET /v2/companies/{companyId}
 */
export const GetCompanyInputSchema = z.object({
  companyId: NumericIdSchema.describe('Company ID (numeric)'),
  fieldTypes: z.array(CompanyFieldTypeEnum).optional().describe('Field categories: enriched, global'),
  fieldIds: z.array(z.string()).optional().describe('Specific field IDs to return'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();

export type GetCompanyInput = z.infer<typeof GetCompanyInputSchema>;

/**
 * List persons input schema
 * @see GET /v2/persons
 */
export const ListPersonsInputSchema = PaginationSchema.extend({
  ids: z.array(z.number()).optional().describe('Filter by specific person IDs'),
  fieldTypes: z.array(PersonFieldTypeEnum).optional().describe('Field categories: enriched, global, relationship-intelligence'),
  fieldIds: z.array(z.string()).optional().describe('Specific field IDs to return'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();

export type ListPersonsInput = z.infer<typeof ListPersonsInputSchema>;

/**
 * Get person input schema
 * @see GET /v2/persons/{personId}
 */
export const GetPersonInputSchema = z.object({
  personId: NumericIdSchema.describe('Person ID (numeric)'),
  fieldTypes: z.array(PersonFieldTypeEnum).optional().describe('Field categories: enriched, global, relationship-intelligence'),
  fieldIds: z.array(z.string()).optional().describe('Specific field IDs to return'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();

export type GetPersonInput = z.infer<typeof GetPersonInputSchema>;

/**
 * List lists input schema
 * @see GET /v2/lists
 */
export const ListListsInputSchema = PaginationSchema.extend({
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();

export type ListListsInput = z.infer<typeof ListListsInputSchema>;

/**
 * Get list entries input schema
 * @see GET /v2/lists/{listId}/list-entries
 */
export const GetListEntriesInputSchema = PaginationSchema.extend({
  listId: NumericIdSchema.describe('List ID (numeric)'),
  fieldTypes: z.array(ListEntryFieldTypeEnum).optional().describe('Field categories: enriched, global, list'),
  fieldIds: z.array(z.string()).optional().describe('Specific field IDs to return'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();

export type GetListEntriesInput = z.infer<typeof GetListEntriesInputSchema>;

/**
 * List opportunities input schema
 * @see GET /v2/opportunities
 */
export const ListOpportunitiesInputSchema = PaginationSchema.extend({
  ids: z.array(z.number()).optional().describe('Filter by specific opportunity IDs'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();

export type ListOpportunitiesInput = z.infer<typeof ListOpportunitiesInputSchema>;

/**
 * Get opportunity input schema
 * @see GET /v2/opportunities/{opportunityId}
 */
export const GetOpportunityInputSchema = z.object({
  opportunityId: NumericIdSchema.describe('Opportunity ID (numeric)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" for structured data or "markdown" for human-readable')
}).strict();

export type GetOpportunityInput = z.infer<typeof GetOpportunityInputSchema>;

// ============================================================================
// V1 API Schemas
// ============================================================================
// V1 API has different pagination (page_size/page_token) and max limits (500)

/**
 * V1 Pagination schema
 * Different from V2: uses page_size/page_token, max 500
 */
export const V1PaginationSchema = z.object({
  pageSize: z.number().min(1).max(500).optional().describe('Items per page (default 100, max 500)'),
  pageToken: z.string().optional().describe('Pagination token from previous response (next_page_token)')
});

/**
 * Search persons input schema (V1 API)
 * @see GET /persons
 *
 * V1 API supports searching by email, first name, or last name.
 * This is NOT available in V2 API.
 */
export const SearchPersonsInputSchema = z.object({
  term: z.string().optional().describe('Search term: email address, first name, or last name. Partial matches supported.'),
  withInteractionDates: z.boolean().optional().describe('Include first/last interaction timestamps'),
  withInteractionPersons: z.boolean().optional().describe('Include persons involved in interactions'),
  withOpportunities: z.boolean().optional().describe('Include opportunity IDs associated with person'),
  withCurrentOrganizations: z.boolean().optional().describe('Include current organization IDs'),
  pageSize: z.number().min(1).max(500).optional().describe('Items per page (default 100, max 500)'),
  pageToken: z.string().optional().describe('Pagination token from previous response'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type SearchPersonsInput = z.infer<typeof SearchPersonsInputSchema>;

/**
 * Create person input schema (V1 API)
 * @see POST /persons
 *
 * Creates a new person in Affinity.
 * Note: Duplicate emails will return a 422 error.
 */
export const CreatePersonInputSchema = z.object({
  firstName: z.string().min(1).describe('First name (required)'),
  lastName: z.string().min(1).describe('Last name (required)'),
  emails: z.array(z.string().email()).default([]).describe('Email addresses. First email becomes primary. Empty array allowed.'),
  organizationIds: z.array(z.number()).optional().describe('Organization IDs to associate with this person'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type CreatePersonInput = z.infer<typeof CreatePersonInputSchema>;

/**
 * Search companies/organizations input schema (V1 API)
 * @see GET /organizations
 *
 * V1 API supports searching by name or domain.
 * This is NOT available in V2 API.
 *
 * Note: V1 calls them "organizations", V2 calls them "companies".
 * IDs are compatible between both APIs.
 */
export const SearchCompaniesInputSchema = z.object({
  term: z.string().optional().describe('Search term: company name or domain. Partial matches supported.'),
  withInteractionDates: z.boolean().optional().describe('Include first/last interaction timestamps'),
  withInteractionPersons: z.boolean().optional().describe('Include persons involved in interactions'),
  withOpportunities: z.boolean().optional().describe('Include opportunity IDs'),
  pageSize: z.number().min(1).max(500).optional().describe('Items per page (default 100, max 500)'),
  pageToken: z.string().optional().describe('Pagination token from previous response'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type SearchCompaniesInput = z.infer<typeof SearchCompaniesInputSchema>;

/**
 * Create company/organization input schema (V1 API)
 * @see POST /organizations
 *
 * Creates a new custom organization in Affinity.
 * Created organizations have global=false (custom, not shared).
 *
 * Note: V1 calls them "organizations", V2 calls them "companies".
 */
export const CreateCompanyInputSchema = z.object({
  name: z.string().min(1).describe('Company name (required)'),
  domain: z.string().optional().describe('Primary domain (e.g., "acme.com")'),
  domains: z.array(z.string()).optional().describe('Additional domains'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type CreateCompanyInput = z.infer<typeof CreateCompanyInputSchema>;

// ============================================================================
// Notes Schemas (V1 create, V2 list)
// ============================================================================

/**
 * List company notes input schema (V2 BETA API)
 * @see GET /v2/companies/{companyId}/notes
 *
 * Returns notes attached to a specific company.
 * Note: This is a BETA endpoint - API may change.
 */
export const ListCompanyNotesInputSchema = z.object({
  companyId: z.string().regex(/^\d+$/, 'Company ID must be numeric').describe('Company ID (numeric)'),
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().min(1).max(100).optional().describe('Items per page (default 20, max 100)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type ListCompanyNotesInput = z.infer<typeof ListCompanyNotesInputSchema>;

/**
 * Note content type enum
 * 0 = plain text (default)
 * 2 = HTML content
 */
export const NoteTypeEnum = z.enum(['0', '2']).transform(val => parseInt(val, 10));

/**
 * Add note input schema (V1 API)
 * @see POST /notes
 *
 * Creates a new note attached to persons, organizations, or opportunities.
 * At least ONE of personIds, companyIds, or opportunityIds must be provided.
 *
 * Note: V1 API calls companies "organizations" - we use companyIds for consistency.
 */
export const AddNoteInputSchema = z.object({
  content: z.string().min(1).describe('Note content (required). Plain text or HTML depending on contentType.'),
  companyIds: z.array(z.number()).optional().describe('Company/Organization IDs to attach note to'),
  personIds: z.array(z.number()).optional().describe('Person IDs to attach note to'),
  opportunityIds: z.array(z.number()).optional().describe('Opportunity IDs to attach note to'),
  contentType: z.enum(['text', 'html']).default('text').describe('Content type: "text" (default) or "html" for rich formatting'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict().refine(
  (data) => {
    // At least one ID array must be provided and non-empty
    const hasCompanyIds = data.companyIds && data.companyIds.length > 0;
    const hasPersonIds = data.personIds && data.personIds.length > 0;
    const hasOpportunityIds = data.opportunityIds && data.opportunityIds.length > 0;
    return hasCompanyIds || hasPersonIds || hasOpportunityIds;
  },
  {
    message: 'At least one of companyIds, personIds, or opportunityIds must be provided with at least one ID'
  }
);

export type AddNoteInput = z.infer<typeof AddNoteInputSchema>;

// ============================================================================
// Phase 3: Lists & Swimlanes Schemas (V2)
// ============================================================================

/**
 * Get single list input schema (V2 API)
 * @see GET /v2/lists/{listId}
 */
export const GetListInputSchema = z.object({
  listId: z.string().regex(/^\d+$/, 'List ID must be numeric').describe('List ID (numeric)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetListInput = z.infer<typeof GetListInputSchema>;

/**
 * Get list fields input schema (V2 API)
 * @see GET /v2/lists/{listId}/fields
 *
 * Returns field definitions including Status (swimlane) field with allowedValues.
 */
export const GetListFieldsInputSchema = z.object({
  listId: z.string().regex(/^\d+$/, 'List ID must be numeric').describe('List ID (numeric)'),
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().min(1).max(100).optional().describe('Items per page (default 100, max 100)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetListFieldsInput = z.infer<typeof GetListFieldsInputSchema>;

/**
 * Get swimlanes input schema (V2 API)
 * @see GET /v2/lists/{listId}/fields (filters for ranked-dropdown Status field)
 *
 * Returns pipeline stages (swimlanes) for a list.
 */
export const GetSwimlanesInputSchema = z.object({
  listId: z.string().regex(/^\d+$/, 'List ID must be numeric').describe('List ID (numeric)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetSwimlanesInput = z.infer<typeof GetSwimlanesInputSchema>;

/**
 * Get companies in swimlane input schema (V2 API)
 * @see GET /v2/lists/{listId}/list-entries (with client-side filtering by Status)
 *
 * Returns companies filtered by their swimlane/stage (Status field value).
 * Note: Filtering is done client-side as API doesn't support server-side filtering.
 */
export const GetCompaniesInSwimlaneInputSchema = z.object({
  listId: z.string().regex(/^\d+$/, 'List ID must be numeric').describe('List ID (numeric)'),
  swimlaneId: z.string().regex(/^\d+$/, 'Swimlane ID must be numeric').describe('Swimlane/stage ID (numeric dropdownOptionId from affinity_get_swimlanes)'),
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().min(1).max(100).optional().describe('Items per page (default 100, max 100)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetCompaniesInSwimlaneInput = z.infer<typeof GetCompaniesInSwimlaneInputSchema>;

// ============================================================================
// Phase 4: Enhanced Details Schemas (V2)
// ============================================================================

/**
 * Get company lists input schema (V2 API)
 * @see GET /v2/companies/{companyId}/lists
 *
 * Returns lists containing this company.
 */
export const GetCompanyListsInputSchema = z.object({
  companyId: z.string().regex(/^\d+$/, 'Company ID must be numeric').describe('Company ID (numeric)'),
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().min(1).max(100).optional().describe('Items per page (default 100, max 100)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetCompanyListsInput = z.infer<typeof GetCompanyListsInputSchema>;

/**
 * Get company list entries input schema (V2 API)
 * @see GET /v2/companies/{companyId}/list-entries
 *
 * Returns full list entry data for a company across all lists.
 */
export const GetCompanyListEntriesInputSchema = z.object({
  companyId: z.string().regex(/^\d+$/, 'Company ID must be numeric').describe('Company ID (numeric)'),
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().min(1).max(100).optional().describe('Items per page (default 100, max 100)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetCompanyListEntriesInput = z.infer<typeof GetCompanyListEntriesInputSchema>;

/**
 * List person notes input schema (V2 BETA API)
 * @see GET /v2/persons/{personId}/notes
 *
 * Returns notes attached to a specific person.
 * Note: This is a BETA endpoint - API may change.
 */
export const ListPersonNotesInputSchema = z.object({
  personId: z.string().regex(/^\d+$/, 'Person ID must be numeric').describe('Person ID (numeric)'),
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().min(1).max(100).optional().describe('Items per page (default 20, max 100)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type ListPersonNotesInput = z.infer<typeof ListPersonNotesInputSchema>;

/**
 * List opportunity notes input schema (V2 BETA API)
 * @see GET /v2/opportunities/{opportunityId}/notes
 *
 * Returns notes attached to a specific opportunity.
 * Note: This is a BETA endpoint - API may change.
 */
export const ListOpportunityNotesInputSchema = z.object({
  opportunityId: z.string().regex(/^\d+$/, 'Opportunity ID must be numeric').describe('Opportunity ID (numeric)'),
  cursor: z.string().optional().describe('Pagination cursor from previous response'),
  limit: z.number().min(1).max(100).optional().describe('Items per page (default 20, max 100)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type ListOpportunityNotesInput = z.infer<typeof ListOpportunityNotesInputSchema>;

// ============================================================================
// Phase 5: Field Values Schema (V1)
// ============================================================================

/**
 * Get field values input schema (V1 API)
 * @see GET /field-values
 *
 * Retrieves all field values for a specific entity.
 * IMPORTANT: Must specify EXACTLY ONE of the entity ID parameters.
 * The API will return 422 error if zero or multiple parameters are provided.
 */
export const GetFieldValuesInputSchema = z.object({
  person_id: z.number().optional().describe('Person ID - Get field values for this person (exactly one entity ID required)'),
  organization_id: z.number().optional().describe('Organization/Company ID - Get field values for this organization (exactly one entity ID required)'),
  opportunity_id: z.number().optional().describe('Opportunity ID - Get field values for this opportunity (exactly one entity ID required)'),
  list_entry_id: z.number().optional().describe('List Entry ID - Get field values for this list entry, including list-specific fields (exactly one entity ID required)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetFieldValuesInput = z.infer<typeof GetFieldValuesInputSchema>;

/**
 * Get field value changes input schema (V1 API)
 * @see GET /field-value-changes
 *
 * Retrieves change history for a specific field.
 * IMPORTANT: action_type is INTEGER enum (0, 1, 2), not string!
 * IMPORTANT: Not all fields support change tracking.
 */
export const GetFieldValueChangesInputSchema = z.object({
  field_id: z.number().describe('Field ID to track changes for (REQUIRED). Use affinity_get_list_fields to discover field IDs.'),
  action_type: z.number().min(0).max(2).optional().describe('Filter by action type: 0=Create, 1=Update, 2=Delete (optional)'),
  person_id: z.number().optional().describe('Filter changes for specific person (optional)'),
  organization_id: z.number().optional().describe('Filter changes for specific organization (optional)'),
  list_entry_id: z.number().optional().describe('Filter changes for specific list entry (optional)'),
  page_size: z.number().min(1).max(500).optional().describe('Number of results (default 100, max 500). Note: API may ignore this.'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetFieldValueChangesInput = z.infer<typeof GetFieldValueChangesInputSchema>;

// ============================================================================
// Phase 6: Schema Discovery (V1)
// ============================================================================

/**
 * Get persons fields input schema (V1 API)
 * @see GET /persons/fields
 *
 * Retrieves all global person field definitions.
 * No parameters required.
 */
export const GetPersonsFieldsInputSchema = z.object({
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetPersonsFieldsInput = z.infer<typeof GetPersonsFieldsInputSchema>;

/**
 * Get organizations fields input schema (V1 API)
 * @see GET /organizations/fields
 *
 * Retrieves all global organization field definitions.
 * No parameters required.
 */
export const GetOrganizationsFieldsInputSchema = z.object({
  responseFormat: ResponseFormatEnum.default('json').describe('Output format: "json" or "markdown"')
}).strict();

export type GetOrganizationsFieldsInput = z.infer<typeof GetOrganizationsFieldsInputSchema>;

/**
 * Get relationship strengths input schema (V1 API)
 * @see GET /relationships-strengths
 */
export const GetRelationshipStrengthsInputSchema = z.object({
  external_id: z.number().describe('External person ID (REQUIRED)'),
  internal_id: z.number().optional().describe('Filter to specific internal team member'),
  page_size: z.number().min(1).max(500).optional().describe('Results per page (default 100, max 500)'),
  responseFormat: ResponseFormatEnum.default('json').describe('Output format')
}).strict();

export type GetRelationshipStrengthsInput = z.infer<typeof GetRelationshipStrengthsInputSchema>;
