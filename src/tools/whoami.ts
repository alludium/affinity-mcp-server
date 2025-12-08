import { getClient } from '../client.js';
import { formatError } from '../utils/errors.js';

/**
 * Response type for whoami endpoint
 * Based on Affinity API v2 response structure
 */
interface WhoamiResponse {
  type: string;
  id: number;
  firstName: string;
  lastName: string;
  emailAddress: string;
  tenant: {
    id: number;
    name: string;
    subdomain: string;
  };
  grant: {
    type: string;
    permissions: string[];
  };
}

/**
 * Tool definition for affinity_whoami
 */
export const whoamiToolDefinition = {
  name: 'affinity_whoami',
  title: 'Verify Authentication',
  description: `Verify authentication and get current user info, organization details, and API key permissions.

Use this to confirm your API key is working and see what you have access to.

**Returns (JSON):**
{
  "user": {
    "id": number,          // User ID
    "email": string,       // Email address
    "name": string         // Full name
  },
  "tenant": {
    "id": number,          // Organization ID
    "name": string,        // Organization name
    "subdomain": string    // Affinity subdomain
  },
  "permissions": string[], // API permissions granted
  "summary": string        // Human-readable summary
}

**Example usage:**
- Verify API key is valid and working
- Check which organization you're connected to
- See what permissions are available`,
  inputSchema: {
    type: 'object' as const,
    properties: {},
    required: []
  },
  annotations: {
    title: 'Verify Authentication',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

/**
 * Execute whoami tool
 */
export async function executeWhoami(): Promise<string> {
  try {
    const client = getClient();
    const response = await client.get<WhoamiResponse>('/v2/auth/whoami');

    const name = `${response.firstName || ''} ${response.lastName || ''}`.trim() || '(API key user)';
    const email = response.emailAddress || '(not available)';

    const result = {
      user: {
        id: response.id,
        email: email,
        name: name
      },
      tenant: {
        id: response.tenant.id,
        name: response.tenant.name,
        subdomain: response.tenant.subdomain
      },
      permissions: response.grant?.permissions || [],
      summary: `Authenticated as ${name} (${email}) at ${response.tenant.name}`
    };

    return JSON.stringify(result, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
