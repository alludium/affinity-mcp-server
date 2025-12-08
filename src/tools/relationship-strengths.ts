/**
 * V1 Relationship Strengths Tool - Network Intelligence
 *
 * Provides GET /relationships-strengths endpoint for discovering team connections
 * to external contacts. Essential for warm introduction intelligence.
 *
 * **This is a V1 API endpoint - NOT available in V2.**
 *
 * @see https://api-docs.affinity.co/#get-relationship-strengths
 */

import { getClientV1 } from '../client-v1.js';
import { formatError } from '../utils/errors.js';
import { GetRelationshipStrengthsInput } from '../schemas/inputs.js';

interface RelationshipStrength {
  internal_id: number;
  external_id: number;
  strength: number; // 0.0 to 1.0
}

export const getRelationshipStrengthsToolDefinition = {
  name: 'affinity_get_relationship_strengths',
  title: 'Get Relationship Strengths',
  description: `Find who on your team has the strongest connections to an external contact.

**This is a V1 API endpoint - NOT available in V2.**

Essential for warm introductions - discover hidden network connections between your team and prospects.

**Use Case:** "Who should make the introduction to this prospect?"

**Required Parameter:**
- external_id: The external person you want to find connections to (REQUIRED)

**Optional Parameters:**
- internal_id: Filter to specific team member's connection
- page_size: Results per page (default 100, max 500)

**Returns:**
Array of relationships with strength scores (0.0-1.0):
- 0.8-1.0: Very Strong (ideal for warm intros)
- 0.6-0.8: Strong (good for introductions)
- 0.4-0.6: Moderate (may be useful)
- 0.0-0.4: Weak (limited connection)

**Important Limitations:**
- Can only query "who knows this person", not "who does this person know"
- Cannot query by organization to find team connections to a company
- Must query one external person at a time
- Relationship data may be sparse

**Example:**
Query: external_id=123456
Result: Shows Alice (92% strength), Bob (65% strength) know this person
Action: Ask Alice to make the warm introduction`,
  inputSchema: {
    type: 'object' as const,
    properties: {
      external_id: {
        type: 'number',
        description: 'External person ID to find connections to (REQUIRED)'
      },
      internal_id: {
        type: 'number',
        description: 'Optional: Filter to specific internal team member'
      },
      page_size: {
        type: 'number',
        minimum: 1,
        maximum: 500,
        description: 'Results per page (default 100, max 500)'
      },
      responseFormat: {
        type: 'string',
        enum: ['json', 'markdown'],
        description: 'Output format (default: json)'
      }
    },
    required: ['external_id']
  },
  annotations: {
    title: 'Get Relationship Strengths',
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true
  }
};

function getStrengthCategory(strength: number): string {
  if (strength >= 0.8) return 'Very Strong';
  if (strength >= 0.6) return 'Strong';
  if (strength >= 0.4) return 'Moderate';
  if (strength >= 0.2) return 'Weak';
  return 'Very Weak';
}

export async function executeGetRelationshipStrengths(input: GetRelationshipStrengthsInput): Promise<string> {
  try {
    const client = getClientV1();

    const params: Record<string, number | undefined> = {
      external_id: input.external_id
    };

    if (input.internal_id) params.internal_id = input.internal_id;
    if (input.page_size) params.page_size = input.page_size;

    const response = await client.get<RelationshipStrength[]>('/relationships-strengths', params);
    const relationships = response || [];

    if (input.responseFormat === 'markdown') {
      const lines: string[] = [];
      lines.push(`# Relationship Strengths for External Person ${input.external_id}`);
      lines.push('');
      lines.push(`Found **${relationships.length}** connection(s)`);
      lines.push('');

      if (relationships.length === 0) {
        lines.push('*No tracked relationships found for this person.*');
      } else {
        const sorted = [...relationships].sort((a, b) => b.strength - a.strength);

        sorted.forEach((rel, idx) => {
          const percentage = (rel.strength * 100).toFixed(0);
          const category = getStrengthCategory(rel.strength);
          lines.push(`${idx + 1}. **Team Member ID ${rel.internal_id}**: ${percentage}% (${category})`);
        });
      }

      return lines.join('\n');
    }

    const enriched = relationships.map(rel => ({
      ...rel,
      strength_percentage: Math.round(rel.strength * 100),
      strength_category: getStrengthCategory(rel.strength)
    })).sort((a, b) => b.strength - a.strength);

    return JSON.stringify({
      relationships: enriched,
      count: relationships.length,
      external_id: input.external_id,
      summary: relationships.length === 0
        ? `No relationships found for external person ${input.external_id}`
        : `Found ${relationships.length} connection(s). Strongest: ${Math.round(enriched[0].strength * 100)}%`
    }, null, 2);
  } catch (error) {
    return formatError(error);
  }
}
