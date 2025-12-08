# Affinity MCP Server

An MCP (Model Context Protocol) server for the [Affinity CRM](https://www.affinity.co/) API. This server enables LLMs to interact with Affinity data including companies, persons, lists, opportunities, notes, pipeline management, field data inspection, change history, and network intelligence.

## What's New

**Latest Updates:**
- 🔍 **Field Data Access** - Get all custom field values for any entity
- 📊 **Audit Trail** - Track field change history (who changed what when)
- 📚 **Schema Discovery** - Discover all person and organization field definitions
- 🤝 **Network Intelligence** - Find team connections to prospects for warm introductions

## Features

- **28 Tools** for comprehensive Affinity access
- **Read-Only Focus** - All tools are read-only except note creation (safe for AI agents)
- **Dual API Support** - Uses both V1 and V2 Affinity APIs for full functionality
- **Field Data Access** - Complete field values, change history, and schema discovery
- **Network Intelligence** - Relationship strength mapping for warm introductions
- **Pagination** - Cursor-based pagination for large datasets
- **Response Formats** - JSON and Markdown output options
- **Rate Limiting** - Automatic handling of API rate limits with retry
- **Request Timeout** - 30-second timeout prevents hung requests
- **Error Handling** - Clear, actionable error messages
- **Character Limits** - Automatic truncation to prevent oversized responses

## Tools Overview

### Authentication
| Tool | Description |
|------|-------------|
| `affinity_whoami` | Verify authentication and get current user info, permissions |

### Companies (4 tools)
| Tool | Description |
|------|-------------|
| `affinity_list_companies` | List companies with optional field data (V2) |
| `affinity_get_company` | Get company details by ID (V2) |
| `affinity_search_companies` | Search companies by name or domain (V1) |
| `affinity_create_company` | Create a new company (V1) |

### Persons (4 tools)
| Tool | Description |
|------|-------------|
| `affinity_list_persons` | List persons with optional field data (V2) |
| `affinity_get_person` | Get person details by ID (V2) |
| `affinity_search_persons` | Search persons by email, name (V1) |
| `affinity_create_person` | Create a new person (V1) |

### Lists & Pipelines (6 tools)
| Tool | Description |
|------|-------------|
| `affinity_list_lists` | Discover available lists |
| `affinity_get_list` | Get single list metadata |
| `affinity_get_list_entries` | Get entries from any list |
| `affinity_get_list_fields` | Get field definitions for a list |
| `affinity_get_swimlanes` | Get pipeline stages (Status field values) |
| `affinity_get_companies_in_swimlane` | Get companies at a specific pipeline stage |

### Opportunities (2 tools)
| Tool | Description |
|------|-------------|
| `affinity_list_opportunities` | List opportunities |
| `affinity_get_opportunity` | Get opportunity details by ID |

### Notes (4 tools)
| Tool | Description |
|------|-------------|
| `affinity_list_company_notes` | List notes for a company (V2 BETA) |
| `affinity_list_person_notes` | List notes for a person (V2 BETA) |
| `affinity_list_opportunity_notes` | List notes for an opportunity (V2 BETA) |
| `affinity_add_note` | Create a note attached to entities (V1) |

### Enhanced Details (2 tools)
| Tool | Description |
|------|-------------|
| `affinity_get_company_lists` | Get lists containing a company |
| `affinity_get_company_list_entries` | Get list entry data for a company |

### Field Data & Audit (2 tools - V1 API)
| Tool | Description |
|------|-------------|
| `affinity_get_field_values` | Get all field values for an entity (person, organization, opportunity, or list entry) |
| `affinity_get_field_value_changes` | Get change history for a field (audit trail, who changed what when) |

### Schema Discovery (2 tools - V1 API)
| Tool | Description |
|------|-------------|
| `affinity_get_persons_fields` | Get all global person field definitions (schema discovery) |
| `affinity_get_organizations_fields` | Get all global organization field definitions (schema discovery) |

### Network Intelligence (1 tool - V1 API)
| Tool | Description |
|------|-------------|
| `affinity_get_relationship_strengths` | Find who on your team has the strongest connections to external contacts (warm intro intelligence) |

## Installation

No installation required when using `npx` (see Usage below).

### Optional: Global Install

```bash
npm install -g @alludium/affinity-mcp-server
```

### Optional: From Source

```bash
git clone https://github.com/alludium/affinity-mcp-server.git
cd affinity-mcp-server
npm install
npm run build
```

## Configuration

Set your Affinity API key as an environment variable:

```bash
export AFFINITY_API_KEY=your_api_key_here
```

When using with Claude Desktop or Claude Code, set the key in the MCP server configuration's `env` block (see Usage section below).

### Getting an API Key

1. Log into Affinity web app
2. Go to Settings
3. Generate an API key (requires "Generate an API key" permission)
4. Copy the key - it won't be shown again!

## Usage

### With Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "affinity": {
      "command": "npx",
      "args": ["-y", "@alludium/affinity-mcp-server"],
      "env": {
        "AFFINITY_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### With Claude Code

Add to your Claude Code MCP settings:

```json
{
  "mcpServers": {
    "affinity": {
      "command": "npx",
      "args": ["-y", "@alludium/affinity-mcp-server"],
      "env": {
        "AFFINITY_API_KEY": "your_api_key_here"
      }
    }
  }
}
```

### Development Mode

```bash
# Run with tsx for development
AFFINITY_API_KEY=your_key npm run dev
```

## Tools Reference

### affinity_whoami

Verify authentication and get current user info.

```
No parameters required
```

**Returns:** User info, organization details, API key permissions

---

### affinity_list_companies

List companies with optional field data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `ids` | number[] | Filter by specific company IDs |
| `fieldTypes` | string[] | Field types: "enriched", "global" |
| `fieldIds` | string[] | Specific field IDs to return |
| `limit` | number | Results per page (max 100) |
| `cursor` | string | Pagination cursor |
| `responseFormat` | string | "json" or "markdown" |

---

### affinity_get_company

Get detailed info about a single company.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `companyId` | string | Yes | Company ID (numeric) |
| `fieldTypes` | string[] | No | Field types: "enriched", "global" |
| `fieldIds` | string[] | No | Specific field IDs to return |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_search_companies

Search for companies by name or domain (V1 API).

| Parameter | Type | Description |
|-----------|------|-------------|
| `term` | string | Search term: company name or domain |
| `withInteractionDates` | boolean | Include first/last interaction timestamps |
| `withInteractionPersons` | boolean | Include persons involved in interactions |
| `withOpportunities` | boolean | Include opportunity IDs |
| `pageSize` | number | Items per page (max 500) |
| `pageToken` | string | Pagination token |
| `responseFormat` | string | "json" or "markdown" |

---

### affinity_create_company

Create a new company/organization (V1 API).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `name` | string | Yes | Company name |
| `domain` | string | No | Primary domain |
| `domains` | string[] | No | Additional domains |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_list_persons

List persons/contacts with optional field data.

| Parameter | Type | Description |
|-----------|------|-------------|
| `ids` | number[] | Filter by specific person IDs |
| `fieldTypes` | string[] | Field types: "enriched", "global", "relationship-intelligence" |
| `fieldIds` | string[] | Specific field IDs to return |
| `limit` | number | Results per page (max 100) |
| `cursor` | string | Pagination cursor |
| `responseFormat` | string | "json" or "markdown" |

---

### affinity_get_person

Get detailed info about a single person.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `personId` | string | Yes | Person ID (numeric) |
| `fieldTypes` | string[] | No | Field types to include |
| `fieldIds` | string[] | No | Specific field IDs to return |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_search_persons

Search for persons by email, first name, or last name (V1 API).

| Parameter | Type | Description |
|-----------|------|-------------|
| `term` | string | Search term: email, first name, or last name |
| `withInteractionDates` | boolean | Include first/last interaction timestamps |
| `withInteractionPersons` | boolean | Include persons involved in interactions |
| `withOpportunities` | boolean | Include opportunity IDs |
| `withCurrentOrganizations` | boolean | Include current organization IDs |
| `pageSize` | number | Items per page (max 500) |
| `pageToken` | string | Pagination token |
| `responseFormat` | string | "json" or "markdown" |

---

### affinity_create_person

Create a new person (V1 API).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `firstName` | string | Yes | First name |
| `lastName` | string | Yes | Last name |
| `emails` | string[] | No | Email addresses (first becomes primary) |
| `organizationIds` | number[] | No | Organization IDs to associate |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_list_lists

Get all lists in the workspace.

| Parameter | Type | Description |
|-----------|------|-------------|
| `limit` | number | Results per page (max 100) |
| `cursor` | string | Pagination cursor |
| `responseFormat` | string | "json" or "markdown" |

**Returns:** All lists with their IDs, names, types, and ownership info

---

### affinity_get_list

Get metadata for a single list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listId` | string | Yes | List ID (numeric) |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_get_list_entries

Get entries from a specific list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listId` | string | Yes | List ID (numeric) |
| `fieldTypes` | string[] | No | Field types: "enriched", "global", "list" |
| `fieldIds` | string[] | No | Specific field IDs to return |
| `limit` | number | No | Results per page (max 100) |
| `cursor` | string | No | Pagination cursor |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_get_list_fields

Get field definitions for a list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listId` | string | Yes | List ID (numeric) |
| `cursor` | string | No | Pagination cursor |
| `limit` | number | No | Items per page (max 100) |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_get_swimlanes

Get pipeline stages (swimlanes) for a list.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listId` | string | Yes | List ID (numeric) |
| `responseFormat` | string | No | "json" or "markdown" |

**Returns:** Status field ID and all swimlane stages with IDs, names, ranks, colors

---

### affinity_get_companies_in_swimlane

Get companies at a specific pipeline stage.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `listId` | string | Yes | List ID (numeric) |
| `swimlaneId` | string | Yes | Swimlane/stage ID (from affinity_get_swimlanes) |
| `cursor` | string | No | Pagination cursor |
| `limit` | number | No | Items per page (max 100) |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_list_opportunities

List opportunities from Affinity.

| Parameter | Type | Description |
|-----------|------|-------------|
| `ids` | number[] | Filter by specific opportunity IDs |
| `limit` | number | Results per page (max 100) |
| `cursor` | string | Pagination cursor |
| `responseFormat` | string | "json" or "markdown" |

---

### affinity_get_opportunity

Get details about a single opportunity.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `opportunityId` | string | Yes | Opportunity ID (numeric) |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_list_company_notes

List notes attached to a company (V2 BETA).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `companyId` | string | Yes | Company ID (numeric) |
| `cursor` | string | No | Pagination cursor |
| `limit` | number | No | Items per page (max 100) |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_list_person_notes

List notes attached to a person (V2 BETA).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `personId` | string | Yes | Person ID (numeric) |
| `cursor` | string | No | Pagination cursor |
| `limit` | number | No | Items per page (max 100) |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_list_opportunity_notes

List notes attached to an opportunity (V2 BETA).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `opportunityId` | string | Yes | Opportunity ID (numeric) |
| `cursor` | string | No | Pagination cursor |
| `limit` | number | No | Items per page (max 100) |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_add_note

Create a note attached to companies, persons, or opportunities (V1 API).

**Note:** Notes are add-only. Edit and delete are not supported.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `content` | string | Yes | Note content (plain text or HTML) |
| `companyIds` | number[] | No* | Company IDs to attach note to |
| `personIds` | number[] | No* | Person IDs to attach note to |
| `opportunityIds` | number[] | No* | Opportunity IDs to attach note to |
| `contentType` | string | No | "text" (default) or "html" |
| `responseFormat` | string | No | "json" or "markdown" |

*At least one of `companyIds`, `personIds`, or `opportunityIds` is required.

---

### affinity_get_company_lists

Get lists containing a specific company.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `companyId` | string | Yes | Company ID (numeric) |
| `cursor` | string | No | Pagination cursor |
| `limit` | number | No | Items per page (max 100) |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_get_company_list_entries

Get full list entry data for a company across all lists.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `companyId` | string | Yes | Company ID (numeric) |
| `cursor` | string | No | Pagination cursor |
| `limit` | number | No | Items per page (max 100) |
| `responseFormat` | string | No | "json" or "markdown" |

---

### affinity_get_field_values

Get all field values for a specific entity (V1 API).

**Use Case:** Complete entity inspection - see all custom field data.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `person_id` | number | One required* | Get field values for this person |
| `organization_id` | number | One required* | Get field values for this organization |
| `opportunity_id` | number | One required* | Get field values for this opportunity |
| `list_entry_id` | number | One required* | Get field values for this list entry (includes list-specific fields) |
| `responseFormat` | string | No | "json" or "markdown" |

*Exactly ONE entity parameter must be provided.

**Returns:** All field values including global fields and list-specific fields (pipeline data, deal amounts, stages, etc.)

---

### affinity_get_field_value_changes

Get change history for a specific field (V1 API).

**Use Case:** Audit trail, accountability, track deal progression.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `field_id` | number | Yes | Field to track changes for |
| `action_type` | number | No | Filter: 0=Create, 1=Update, 2=Delete |
| `person_id` | number | No | Filter to specific person |
| `organization_id` | number | No | Filter to specific organization |
| `list_entry_id` | number | No | Filter to specific list entry |
| `page_size` | number | No | Results per page (max 500) |
| `responseFormat` | string | No | "json" or "markdown" |

**Returns:** Change history showing who changed what and when, with timestamps and user details.

**Note:** Not all fields support change tracking. Status fields (Ranked Dropdown) typically support tracking.

---

### affinity_get_persons_fields

Get all global person field definitions (V1 API).

**Use Case:** Schema discovery - understand what person fields exist in the CRM.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `responseFormat` | string | No | "json" or "markdown" |

**Returns:** Complete schema including field IDs, names, types, dropdown options, enrichment sources.

---

### affinity_get_organizations_fields

Get all global organization field definitions (V1 API).

**Use Case:** Schema discovery - understand what organization fields exist in the CRM.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `responseFormat` | string | No | "json" or "markdown" |

**Returns:** Complete schema including field IDs, names, types, dropdown options, enrichment sources (Crunchbase, Dealroom, etc.).

---

### affinity_get_relationship_strengths

Find who on your team has the strongest connections to an external contact (V1 API).

**Use Case:** Warm introduction intelligence - "Who should make the intro to this prospect?"

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `external_id` | number | Yes | External person ID to find connections to |
| `internal_id` | number | No | Filter to specific internal team member |
| `page_size` | number | No | Results per page (max 500) |
| `responseFormat` | string | No | "json" or "markdown" |

**Returns:** Array of relationships with strength scores (0.0-1.0):
- 0.8-1.0: Very Strong (ideal for warm intros)
- 0.6-0.8: Strong (good for introductions)
- 0.4-0.6: Moderate (may be useful)
- 0.0-0.4: Weak (limited connection)

**Limitation:** Can only query "who knows this person", not "who does this person know" or "who knows this company".

## Rate Limits

- **900 requests per minute** per user
- Automatic retry with backoff on 429 responses
- Rate limit headers tracked for monitoring

## Error Handling

The server returns clear, actionable error messages:

- **401**: Check your API key
- **403**: Use `affinity_whoami` to check permissions
- **404**: Resource not found
- **429**: Rate limited, wait and retry

## Development

```bash
# Type check
npm run typecheck

# Build
npm run build

# Run in dev mode
npm run dev
```

## License

MIT
