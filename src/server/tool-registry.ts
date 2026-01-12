/**
 * Tool Registry - Bridges existing tools to McpServer.registerTool API
 *
 * This adapter allows all 28 existing tools to work with the new MCP SDK
 * without modifying the original tool files.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// Import ALL tool definitions
import {
  whoamiToolDefinition,
  listCompaniesToolDefinition,
  getCompanyToolDefinition,
  searchCompaniesToolDefinition,
  createCompanyToolDefinition,
  listPersonsToolDefinition,
  getPersonToolDefinition,
  searchPersonsToolDefinition,
  createPersonToolDefinition,
  listListsToolDefinition,
  getListEntriesToolDefinition,
  listOpportunitiesToolDefinition,
  getOpportunityToolDefinition,
  listCompanyNotesToolDefinition,
  addNoteToolDefinition,
  getListToolDefinition,
  getListFieldsToolDefinition,
  getSwimlanesToolDefinition,
  getCompaniesInSwimlaneToolDefinition,
  getCompanyListsToolDefinition,
  getCompanyListEntriesToolDefinition,
  listPersonNotesToolDefinition,
  listOpportunityNotesToolDefinition,
  getFieldValuesToolDefinition,
  getFieldValueChangesToolDefinition,
  getPersonsFieldsToolDefinition,
  getOrganizationsFieldsToolDefinition,
  getRelationshipStrengthsToolDefinition
} from '../tools/index.js';

// Import ALL executors
import {
  executeWhoami,
  executeListCompanies,
  executeGetCompany,
  executeSearchCompanies,
  executeCreateCompany,
  executeListPersons,
  executeGetPerson,
  executeSearchPersons,
  executeCreatePerson,
  executeListLists,
  executeGetListEntries,
  executeListOpportunities,
  executeGetOpportunity,
  executeListCompanyNotes,
  executeAddNote,
  executeGetList,
  executeGetListFields,
  executeGetSwimlanes,
  executeGetCompaniesInSwimlane,
  executeGetCompanyLists,
  executeGetCompanyListEntries,
  executeListPersonNotes,
  executeListOpportunityNotes,
  executeGetFieldValues,
  executeGetFieldValueChanges,
  executeGetPersonsFields,
  executeGetOrganizationsFields,
  executeGetRelationshipStrengths
} from '../tools/index.js';

// Import ALL Zod schemas
import {
  ListCompaniesInputSchema,
  GetCompanyInputSchema,
  SearchCompaniesInputSchema,
  CreateCompanyInputSchema,
  ListPersonsInputSchema,
  GetPersonInputSchema,
  SearchPersonsInputSchema,
  CreatePersonInputSchema,
  ListListsInputSchema,
  GetListEntriesInputSchema,
  ListOpportunitiesInputSchema,
  GetOpportunityInputSchema,
  ListCompanyNotesInputSchema,
  AddNoteInputSchema,
  GetListInputSchema,
  GetListFieldsInputSchema,
  GetSwimlanesInputSchema,
  GetCompaniesInSwimlaneInputSchema,
  GetCompanyListsInputSchema,
  GetCompanyListEntriesInputSchema,
  ListPersonNotesInputSchema,
  ListOpportunityNotesInputSchema,
  GetFieldValuesInputSchema,
  GetFieldValueChangesInputSchema,
  GetPersonsFieldsInputSchema,
  GetOrganizationsFieldsInputSchema,
  GetRelationshipStrengthsInputSchema
} from '../schemas/inputs.js';

/**
 * Tool registration configuration
 */
interface ToolRegistration {
  definition: {
    name: string;
    description: string;
    inputSchema: object;
    annotations?: object;
  };
  schema: z.ZodSchema;
  executor: (args: unknown) => Promise<string>;
}

/**
 * All 28 tool registrations mapped to their schemas and executors
 */
const TOOLS: ToolRegistration[] = [
  // 1. Whoami - no input required
  {
    definition: whoamiToolDefinition,
    schema: z.object({}),
    executor: async () => executeWhoami()
  },

  // 2-5. Companies (V2 list/get + V1 search/create)
  {
    definition: listCompaniesToolDefinition,
    schema: ListCompaniesInputSchema,
    executor: async (args) => executeListCompanies(ListCompaniesInputSchema.parse(args))
  },
  {
    definition: getCompanyToolDefinition,
    schema: GetCompanyInputSchema,
    executor: async (args) => executeGetCompany(GetCompanyInputSchema.parse(args))
  },
  {
    definition: searchCompaniesToolDefinition,
    schema: SearchCompaniesInputSchema,
    executor: async (args) => executeSearchCompanies(SearchCompaniesInputSchema.parse(args))
  },
  {
    definition: createCompanyToolDefinition,
    schema: CreateCompanyInputSchema,
    executor: async (args) => executeCreateCompany(CreateCompanyInputSchema.parse(args))
  },

  // 6-9. Persons (V2 list/get + V1 search/create)
  {
    definition: listPersonsToolDefinition,
    schema: ListPersonsInputSchema,
    executor: async (args) => executeListPersons(ListPersonsInputSchema.parse(args))
  },
  {
    definition: getPersonToolDefinition,
    schema: GetPersonInputSchema,
    executor: async (args) => executeGetPerson(GetPersonInputSchema.parse(args))
  },
  {
    definition: searchPersonsToolDefinition,
    schema: SearchPersonsInputSchema,
    executor: async (args) => executeSearchPersons(SearchPersonsInputSchema.parse(args))
  },
  {
    definition: createPersonToolDefinition,
    schema: CreatePersonInputSchema,
    executor: async (args) => executeCreatePerson(CreatePersonInputSchema.parse(args))
  },

  // 10-11. Lists
  {
    definition: listListsToolDefinition,
    schema: ListListsInputSchema,
    executor: async (args) => executeListLists(ListListsInputSchema.parse(args))
  },
  {
    definition: getListEntriesToolDefinition,
    schema: GetListEntriesInputSchema,
    executor: async (args) => executeGetListEntries(GetListEntriesInputSchema.parse(args))
  },

  // 12-13. Opportunities
  {
    definition: listOpportunitiesToolDefinition,
    schema: ListOpportunitiesInputSchema,
    executor: async (args) => executeListOpportunities(ListOpportunitiesInputSchema.parse(args))
  },
  {
    definition: getOpportunityToolDefinition,
    schema: GetOpportunityInputSchema,
    executor: async (args) => executeGetOpportunity(GetOpportunityInputSchema.parse(args))
  },

  // 14-15. Notes (list + add)
  {
    definition: listCompanyNotesToolDefinition,
    schema: ListCompanyNotesInputSchema,
    executor: async (args) => executeListCompanyNotes(ListCompanyNotesInputSchema.parse(args))
  },
  {
    definition: addNoteToolDefinition,
    schema: AddNoteInputSchema,
    executor: async (args) => executeAddNote(AddNoteInputSchema.parse(args))
  },

  // 16-19. Lists V2 (get list, fields, swimlanes, companies in swimlane)
  {
    definition: getListToolDefinition,
    schema: GetListInputSchema,
    executor: async (args) => executeGetList(GetListInputSchema.parse(args))
  },
  {
    definition: getListFieldsToolDefinition,
    schema: GetListFieldsInputSchema,
    executor: async (args) => executeGetListFields(GetListFieldsInputSchema.parse(args))
  },
  {
    definition: getSwimlanesToolDefinition,
    schema: GetSwimlanesInputSchema,
    executor: async (args) => executeGetSwimlanes(GetSwimlanesInputSchema.parse(args))
  },
  {
    definition: getCompaniesInSwimlaneToolDefinition,
    schema: GetCompaniesInSwimlaneInputSchema,
    executor: async (args) => executeGetCompaniesInSwimlane(GetCompaniesInSwimlaneInputSchema.parse(args))
  },

  // 20-23. Enhanced Details (company lists, list entries, person/opportunity notes)
  {
    definition: getCompanyListsToolDefinition,
    schema: GetCompanyListsInputSchema,
    executor: async (args) => executeGetCompanyLists(GetCompanyListsInputSchema.parse(args))
  },
  {
    definition: getCompanyListEntriesToolDefinition,
    schema: GetCompanyListEntriesInputSchema,
    executor: async (args) => executeGetCompanyListEntries(GetCompanyListEntriesInputSchema.parse(args))
  },
  {
    definition: listPersonNotesToolDefinition,
    schema: ListPersonNotesInputSchema,
    executor: async (args) => executeListPersonNotes(ListPersonNotesInputSchema.parse(args))
  },
  {
    definition: listOpportunityNotesToolDefinition,
    schema: ListOpportunityNotesInputSchema,
    executor: async (args) => executeListOpportunityNotes(ListOpportunityNotesInputSchema.parse(args))
  },

  // 24-25. Field Values (V1)
  {
    definition: getFieldValuesToolDefinition,
    schema: GetFieldValuesInputSchema,
    executor: async (args) => executeGetFieldValues(GetFieldValuesInputSchema.parse(args))
  },
  {
    definition: getFieldValueChangesToolDefinition,
    schema: GetFieldValueChangesInputSchema,
    executor: async (args) => executeGetFieldValueChanges(GetFieldValueChangesInputSchema.parse(args))
  },

  // 26-27. Schema Discovery (V1) - these take just responseFormat, not full args
  {
    definition: getPersonsFieldsToolDefinition,
    schema: GetPersonsFieldsInputSchema,
    executor: async (args) => executeGetPersonsFields(GetPersonsFieldsInputSchema.parse(args).responseFormat)
  },
  {
    definition: getOrganizationsFieldsToolDefinition,
    schema: GetOrganizationsFieldsInputSchema,
    executor: async (args) => executeGetOrganizationsFields(GetOrganizationsFieldsInputSchema.parse(args).responseFormat)
  },

  // 28. Network Intelligence (V1)
  {
    definition: getRelationshipStrengthsToolDefinition,
    schema: GetRelationshipStrengthsInputSchema,
    executor: async (args) => executeGetRelationshipStrengths(GetRelationshipStrengthsInputSchema.parse(args))
  }
];

/**
 * Register all tools with the McpServer instance
 */
export function registerAllTools(server: McpServer): void {
  for (const tool of TOOLS) {
    server.registerTool(
      tool.definition.name,
      {
        description: tool.definition.description,
        inputSchema: tool.schema,
        annotations: tool.definition.annotations
      },
      async (args) => {
        try {
          const result = await tool.executor(args);
          return {
            content: [{ type: 'text', text: result }]
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          return {
            content: [{ type: 'text', text: `Error: ${errorMessage}` }],
            isError: true
          };
        }
      }
    );
  }
}
