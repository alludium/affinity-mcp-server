/**
 * Tool exports for Affinity MCP Server
 *
 * Each tool module exports:
 * - Tool definition (for registration)
 * - Execute function (for invocation)
 */

// Whoami - Authentication verification
export { whoamiToolDefinition, executeWhoami } from './whoami.js';

// Companies - Organization management (V2)
export {
  listCompaniesToolDefinition,
  getCompanyToolDefinition,
  executeListCompanies,
  executeGetCompany
} from './companies.js';

// Companies - Search and Create (V1)
export {
  searchCompaniesToolDefinition,
  createCompanyToolDefinition,
  executeSearchCompanies,
  executeCreateCompany
} from './companies-v1.js';

// Persons - Contact management (V2)
export {
  listPersonsToolDefinition,
  getPersonToolDefinition,
  executeListPersons,
  executeGetPerson
} from './persons.js';

// Persons - Search and Create (V1)
export {
  searchPersonsToolDefinition,
  createPersonToolDefinition,
  executeSearchPersons,
  executeCreatePerson
} from './persons-v1.js';

// Lists - Collection management
export {
  listListsToolDefinition,
  getListEntriesToolDefinition,
  executeListLists,
  executeGetListEntries
} from './lists.js';

// Opportunities - Deal tracking
export {
  listOpportunitiesToolDefinition,
  getOpportunityToolDefinition,
  executeListOpportunities,
  executeGetOpportunity
} from './opportunities.js';

// Notes - List and Add (no edit/delete per requirements)
export {
  listCompanyNotesToolDefinition,
  addNoteToolDefinition,
  executeListCompanyNotes,
  executeAddNote
} from './notes.js';

// Lists V2 - Get list, fields, swimlanes, companies in swimlane
export {
  getListToolDefinition,
  getListFieldsToolDefinition,
  getSwimlanesToolDefinition,
  getCompaniesInSwimlaneToolDefinition,
  executeGetList,
  executeGetListFields,
  executeGetSwimlanes,
  executeGetCompaniesInSwimlane
} from './lists-v2.js';

// Enhanced Details - Phase 4 (Company lists, list entries, person/opportunity notes)
export {
  getCompanyListsToolDefinition,
  getCompanyListEntriesToolDefinition,
  listPersonNotesToolDefinition,
  listOpportunityNotesToolDefinition,
  executeGetCompanyLists,
  executeGetCompanyListEntries,
  executeListPersonNotes,
  executeListOpportunityNotes
} from './enhanced-details.js';

// Field Values - Phase 5 (V1)
export {
  getFieldValuesToolDefinition,
  getFieldValueChangesToolDefinition,
  executeGetFieldValues,
  executeGetFieldValueChanges
} from './field-values.js';

// Schema Discovery - Phase 6 (V1)
export {
  getPersonsFieldsToolDefinition,
  getOrganizationsFieldsToolDefinition,
  executeGetPersonsFields,
  executeGetOrganizationsFields
} from './schema-fields.js';

// Network Intelligence - Phase 7 (V1)
export {
  getRelationshipStrengthsToolDefinition,
  executeGetRelationshipStrengths
} from './relationship-strengths.js';
