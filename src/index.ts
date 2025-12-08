#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

// Tool definitions and executors
import { whoamiToolDefinition, executeWhoami } from './tools/whoami.js';
import {
  listCompaniesToolDefinition,
  getCompanyToolDefinition,
  executeListCompanies,
  executeGetCompany
} from './tools/companies.js';
import {
  searchCompaniesToolDefinition,
  createCompanyToolDefinition,
  executeSearchCompanies,
  executeCreateCompany
} from './tools/companies-v1.js';
import {
  listPersonsToolDefinition,
  getPersonToolDefinition,
  executeListPersons,
  executeGetPerson
} from './tools/persons.js';
import {
  searchPersonsToolDefinition,
  createPersonToolDefinition,
  executeSearchPersons,
  executeCreatePerson
} from './tools/persons-v1.js';
import {
  listListsToolDefinition,
  getListEntriesToolDefinition,
  executeListLists,
  executeGetListEntries
} from './tools/lists.js';
import {
  listOpportunitiesToolDefinition,
  getOpportunityToolDefinition,
  executeListOpportunities,
  executeGetOpportunity
} from './tools/opportunities.js';
import {
  listCompanyNotesToolDefinition,
  addNoteToolDefinition,
  executeListCompanyNotes,
  executeAddNote
} from './tools/notes.js';
import {
  getListToolDefinition,
  getListFieldsToolDefinition,
  getSwimlanesToolDefinition,
  getCompaniesInSwimlaneToolDefinition,
  executeGetList,
  executeGetListFields,
  executeGetSwimlanes,
  executeGetCompaniesInSwimlane
} from './tools/lists-v2.js';
import {
  getCompanyListsToolDefinition,
  getCompanyListEntriesToolDefinition,
  listPersonNotesToolDefinition,
  listOpportunityNotesToolDefinition,
  executeGetCompanyLists,
  executeGetCompanyListEntries,
  executeListPersonNotes,
  executeListOpportunityNotes
} from './tools/enhanced-details.js';
import {
  getFieldValuesToolDefinition,
  getFieldValueChangesToolDefinition,
  executeGetFieldValues,
  executeGetFieldValueChanges
} from './tools/field-values.js';
import {
  getPersonsFieldsToolDefinition,
  getOrganizationsFieldsToolDefinition,
  executeGetPersonsFields,
  executeGetOrganizationsFields
} from './tools/schema-fields.js';
import {
  getRelationshipStrengthsToolDefinition,
  executeGetRelationshipStrengths
} from './tools/relationship-strengths.js';

// Input schemas for validation
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
} from './schemas/inputs.js';

/**
 * All tool definitions
 */
const TOOLS = [
  whoamiToolDefinition,
  // Companies (V2 list/get + V1 search/create)
  listCompaniesToolDefinition,
  getCompanyToolDefinition,
  searchCompaniesToolDefinition,
  createCompanyToolDefinition,
  // Persons (V2 list/get + V1 search/create)
  listPersonsToolDefinition,
  getPersonToolDefinition,
  searchPersonsToolDefinition,
  createPersonToolDefinition,
  // Lists
  listListsToolDefinition,
  getListEntriesToolDefinition,
  // Opportunities
  listOpportunitiesToolDefinition,
  getOpportunityToolDefinition,
  // Notes (add only - no edit/delete per requirements)
  listCompanyNotesToolDefinition,
  addNoteToolDefinition,
  // Lists V2 - Get list, fields, swimlanes
  getListToolDefinition,
  getListFieldsToolDefinition,
  getSwimlanesToolDefinition,
  getCompaniesInSwimlaneToolDefinition,
  // Enhanced Details - Phase 4
  getCompanyListsToolDefinition,
  getCompanyListEntriesToolDefinition,
  listPersonNotesToolDefinition,
  listOpportunityNotesToolDefinition,
  // Field Values - Phase 5 (V1)
  getFieldValuesToolDefinition,
  getFieldValueChangesToolDefinition,
  // Schema Discovery - Phase 6 (V1)
  getPersonsFieldsToolDefinition,
  getOrganizationsFieldsToolDefinition,
  // Network Intelligence - Phase 7 (V1)
  getRelationshipStrengthsToolDefinition
];

/**
 * Tool executor type
 */
type ToolExecutor = (args: unknown) => Promise<string>;

/**
 * Map of tool names to their executors
 * This replaces the switch statement for better scalability and maintainability
 */
const toolExecutors: Record<string, ToolExecutor> = {
  // Auth
  'affinity_whoami': async () => executeWhoami(),
  // Companies - V2 (list, get)
  'affinity_list_companies': async (args: unknown) => executeListCompanies(ListCompaniesInputSchema.parse(args)),
  'affinity_get_company': async (args: unknown) => executeGetCompany(GetCompanyInputSchema.parse(args)),
  // Companies - V1 (search, create)
  'affinity_search_companies': async (args: unknown) => executeSearchCompanies(SearchCompaniesInputSchema.parse(args)),
  'affinity_create_company': async (args: unknown) => executeCreateCompany(CreateCompanyInputSchema.parse(args)),
  // Persons - V2 (list, get)
  'affinity_list_persons': async (args: unknown) => executeListPersons(ListPersonsInputSchema.parse(args)),
  'affinity_get_person': async (args: unknown) => executeGetPerson(GetPersonInputSchema.parse(args)),
  // Persons - V1 (search, create)
  'affinity_search_persons': async (args: unknown) => executeSearchPersons(SearchPersonsInputSchema.parse(args)),
  'affinity_create_person': async (args: unknown) => executeCreatePerson(CreatePersonInputSchema.parse(args)),
  // Lists
  'affinity_list_lists': async (args: unknown) => executeListLists(ListListsInputSchema.parse(args)),
  'affinity_get_list_entries': async (args: unknown) => executeGetListEntries(GetListEntriesInputSchema.parse(args)),
  // Opportunities
  'affinity_list_opportunities': async (args: unknown) => executeListOpportunities(ListOpportunitiesInputSchema.parse(args)),
  'affinity_get_opportunity': async (args: unknown) => executeGetOpportunity(GetOpportunityInputSchema.parse(args)),
  // Notes (add only - no edit/delete per requirements)
  'affinity_list_company_notes': async (args: unknown) => executeListCompanyNotes(ListCompanyNotesInputSchema.parse(args)),
  'affinity_add_note': async (args: unknown) => executeAddNote(AddNoteInputSchema.parse(args)),
  // Lists V2 - Get list, fields, swimlanes
  'affinity_get_list': async (args: unknown) => executeGetList(GetListInputSchema.parse(args)),
  'affinity_get_list_fields': async (args: unknown) => executeGetListFields(GetListFieldsInputSchema.parse(args)),
  'affinity_get_swimlanes': async (args: unknown) => executeGetSwimlanes(GetSwimlanesInputSchema.parse(args)),
  'affinity_get_companies_in_swimlane': async (args: unknown) => executeGetCompaniesInSwimlane(GetCompaniesInSwimlaneInputSchema.parse(args)),
  // Enhanced Details - Phase 4
  'affinity_get_company_lists': async (args: unknown) => executeGetCompanyLists(GetCompanyListsInputSchema.parse(args)),
  'affinity_get_company_list_entries': async (args: unknown) => executeGetCompanyListEntries(GetCompanyListEntriesInputSchema.parse(args)),
  'affinity_list_person_notes': async (args: unknown) => executeListPersonNotes(ListPersonNotesInputSchema.parse(args)),
  'affinity_list_opportunity_notes': async (args: unknown) => executeListOpportunityNotes(ListOpportunityNotesInputSchema.parse(args)),
  // Field Values - Phase 5 (V1)
  'affinity_get_field_values': async (args: unknown) => executeGetFieldValues(GetFieldValuesInputSchema.parse(args)),
  'affinity_get_field_value_changes': async (args: unknown) => executeGetFieldValueChanges(GetFieldValueChangesInputSchema.parse(args)),
  // Schema Discovery - Phase 6 (V1)
  'affinity_get_persons_fields': async (args: unknown) => executeGetPersonsFields(GetPersonsFieldsInputSchema.parse(args).responseFormat),
  'affinity_get_organizations_fields': async (args: unknown) => executeGetOrganizationsFields(GetOrganizationsFieldsInputSchema.parse(args).responseFormat),
  // Network Intelligence - Phase 7 (V1)
  'affinity_get_relationship_strengths': async (args: unknown) => executeGetRelationshipStrengths(GetRelationshipStrengthsInputSchema.parse(args))
};

/**
 * Create and configure the MCP server
 */
function createServer(): Server {
  const server = new Server(
    {
      name: 'affinity-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: TOOLS
    };
  });

  // Handle tool execution using map-based dispatch
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    const executor = toolExecutors[name];

    if (!executor) {
      return {
        content: [
          {
            type: 'text',
            text: `Unknown tool: ${name}. Available tools: ${TOOLS.map(t => t.name).join(', ')}`
          }
        ],
        isError: true
      };
    }

    try {
      const result = await executor(args || {});

      return {
        content: [
          {
            type: 'text',
            text: result
          }
        ]
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing ${name}: ${errorMessage}`
          }
        ],
        isError: true
      };
    }
  });

  return server;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  // Validate API key is present
  if (!process.env.AFFINITY_API_KEY) {
    console.error('Error: AFFINITY_API_KEY environment variable is required');
    console.error('Set it in your environment or .env file');
    process.exit(1);
  }

  const server = createServer();
  const transport = new StdioServerTransport();

  await server.connect(transport);

  // Log to stderr so it doesn't interfere with stdio transport
  console.error('Affinity MCP server started');
  console.error(`Available tools: ${TOOLS.map(t => t.name).join(', ')}`);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
