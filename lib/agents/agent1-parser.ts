import OpenAI from 'openai';
import { PlanInput, ParsedInput } from '../utils/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// =============================================================================
// V3 TYPES
// =============================================================================

export interface HardBlocker {
  field: string;
  message: string;
}

export interface SoftConflict {
  field: string;
  message: string;
  defaultUsed: unknown;
}

export interface Assumption {
  field: string;
  defaultValue: unknown;
  reason: string;
  humanReadable: string;
}

export interface ParsedInputV3 extends ParsedInput {
  hard_blockers: HardBlocker[];
  soft_conflicts: SoftConflict[];
  assumptions: Assumption[];
}

// =============================================================================
// PARSER PROMPTS
// =============================================================================

const AGENT1_SYSTEM_PROMPT = `You are an expert travel input validator.

Your job:
1. Parse user input into structured JSON
2. Validate dates, budget, constraints
3. Detect conflicts (e.g., "5-star hotels on $50/day")
4. Ask clarifying questions if needed

Output ONLY valid JSON with this exact schema:
{
  "valid": boolean,
  "parsed_data": {
    "destination": { "city": string, "country": string },
    "dates": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "duration_days": number },
    "travelers": {
      "count": number,
      "profiles": [{ "id": 1, "constraints": string[] }]
    },
    "budget": {
      "amount_per_day": number,
      "currency": "USD",
      "flexibility": "strict" | "flexible"
    },
    "constraints": {
      "accessibility": string[],
      "dietary": string[],
      "pace": "relaxed" | "moderate" | "packed",
      "other": string[]
    },
    "interests": string[],
    "special_requests": string
  },
  "conflicts": string[],
  "clarifications_needed": string[]
}

RULES:
- If destination is vague ("Asia"), set clarifications_needed
- If budget seems unrealistic, add to conflicts
- Parse dates strictly (handle "next week", "May 15-20")
- Extract constraints from natural language (wheelchair = accessibility: ["wheelchair_accessible"])
- Extract dietary needs (vegan/vegetarian/halal/kosher/gluten-free)
- Default pace is "moderate" if not specified
- Current date is ${new Date().toISOString().split('T')[0]}`;

const AGENT1_V3_SYSTEM_PROMPT = `You are an expert travel input validator with enhanced conflict detection.

Your job:
1. Parse user input into structured JSON
2. Validate dates, budget, constraints
3. Categorize issues into hard_blockers (cannot proceed) or soft_conflicts (can use defaults)
4. Document all assumptions made when using defaults

Output ONLY valid JSON with this exact schema:
{
  "valid": boolean,
  "parsed_data": {
    "destination": { "city": string, "country": string },
    "dates": { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "duration_days": number },
    "travelers": {
      "count": number,
      "profiles": [{ "id": 1, "constraints": string[] }]
    },
    "budget": {
      "amount_per_day": number,
      "currency": "USD",
      "flexibility": "strict" | "flexible"
    },
    "constraints": {
      "accessibility": string[],
      "dietary": string[],
      "pace": "relaxed" | "moderate" | "packed",
      "other": string[]
    },
    "interests": string[],
    "special_requests": string
  },
  "conflicts": string[],
  "clarifications_needed": string[],
  "hard_blockers": [
    { "field": string, "message": string }
  ],
  "soft_conflicts": [
    { "field": string, "message": string, "defaultUsed": any }
  ],
  "assumptions": [
    { "field": string, "defaultValue": any, "reason": string, "humanReadable": string }
  ]
}

HARD BLOCKERS (pipeline cannot proceed):
- Invalid or unrecognizable destination (e.g., "somewhere nice", "Asia" without city)
- Impossible dates (end before start, dates in the past)
- Zero or negative duration
- Missing critical information that cannot be defaulted

SOFT CONFLICTS (can proceed with defaults):
- Unrealistic budget (use moderate default)
- Missing pace preference (default to "moderate")
- Ambiguous dates like "next week" (interpret and document)
- Missing traveler count (default to 1)

ASSUMPTIONS (document all defaults used):
- For each soft conflict resolved, add an assumption entry
- Include human-readable explanation for the user

Current date is ${new Date().toISOString().split('T')[0]}`;

export async function runAgent1Parser(input: PlanInput): Promise<ParsedInput> {
  console.log('🤖 Agent 1 (Parser): Starting validation...');

  const userPrompt = `Parse this travel request:

Destination: ${input.destination}
Dates: ${input.dates}
Budget: ${input.budget}
Travelers: ${input.travelers}
Constraints: ${input.constraints}
Interests: ${input.interests}
Additional: ${input.special_requests}

Return ONLY the JSON object, no markdown formatting.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: AGENT1_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    // Validate response structure
    if (!completion.choices || completion.choices.length === 0) {
      throw new Error('Empty response from OpenAI - no choices returned');
    }

    const content = completion.choices[0].message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const result = JSON.parse(content) as ParsedInput;

    console.log('✓ Agent 1: Validation complete');
    console.log(
      `  → Destination: ${result.parsed_data.destination.city}, ${result.parsed_data.destination.country}`
    );
    console.log(`  → Duration: ${result.parsed_data.dates.duration_days} days`);
    console.log(
      `  → Budget: $${result.parsed_data.budget.amount_per_day}/day`
    );
    console.log(
      `  → Constraints: ${Object.values(result.parsed_data.constraints).flat().length} total`
    );

    if (result.conflicts.length > 0) {
      console.log(`  ⚠️  Conflicts detected: ${result.conflicts.length}`);
    }

    return result;
  } catch (error) {
    console.error('❌ Agent 1 Error:', error);
    throw new Error('Failed to parse input');
  }
}


// =============================================================================
// V3 PARSER
// =============================================================================

/**
 * V3 Parser with enhanced conflict categorization.
 *
 * Key features:
 * - Categorizes issues into hard_blockers vs soft_conflicts
 * - Documents all assumptions when using defaults
 * - Halts pipeline on hard_blockers
 * - Continues with defaults on soft_conflicts
 */
export async function runAgent1ParserV3(input: PlanInput): Promise<ParsedInputV3> {
  console.log('🤖 Agent 1 (Parser v3): Starting validation with conflict categorization...');

  const userPrompt = `Parse this travel request:

Destination: ${input.destination}
Dates: ${input.dates}
Budget: ${input.budget}
Travelers: ${input.travelers}
Constraints: ${input.constraints}
Interests: ${input.interests}
Additional: ${input.special_requests}

Return ONLY the JSON object, no markdown formatting.
Categorize any issues into hard_blockers or soft_conflicts.
Document all assumptions made when using defaults.`;

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: AGENT1_V3_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    });

    // Validate response structure
    if (!completion.choices || completion.choices.length === 0) {
      throw new Error('Empty response from OpenAI - no choices returned');
    }

    const content = completion.choices[0].message?.content;
    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    const rawResult = JSON.parse(content);

    // Ensure v3 fields exist with defaults
    const result: ParsedInputV3 = {
      ...rawResult,
      hard_blockers: rawResult.hard_blockers || [],
      soft_conflicts: rawResult.soft_conflicts || [],
      assumptions: rawResult.assumptions || [],
    };

    console.log('✓ Agent 1 v3: Validation complete');
    console.log(
      `  → Destination: ${result.parsed_data.destination.city}, ${result.parsed_data.destination.country}`
    );
    console.log(`  → Duration: ${result.parsed_data.dates.duration_days} days`);
    console.log(
      `  → Budget: ${result.parsed_data.budget.amount_per_day}/day`
    );

    // Log hard blockers
    if (result.hard_blockers.length > 0) {
      console.log(`  ❌ Hard blockers: ${result.hard_blockers.length}`);
      for (const blocker of result.hard_blockers) {
        console.log(`     - ${blocker.field}: ${blocker.message}`);
      }
    }

    // Log soft conflicts
    if (result.soft_conflicts.length > 0) {
      console.log(`  ⚠️  Soft conflicts: ${result.soft_conflicts.length}`);
      for (const conflict of result.soft_conflicts) {
        console.log(`     - ${conflict.field}: ${conflict.message} (default: ${JSON.stringify(conflict.defaultUsed)})`);
      }
    }

    // Log assumptions
    if (result.assumptions.length > 0) {
      console.log(`  📝 Assumptions: ${result.assumptions.length}`);
      for (const assumption of result.assumptions) {
        console.log(`     - ${assumption.humanReadable}`);
      }
    }

    return result;
  } catch (error) {
    console.error('❌ Agent 1 v3 Error:', error);
    throw new Error('Failed to parse input');
  }
}

/**
 * Check if parser result has hard blockers that should halt the pipeline.
 */
export function hasHardBlockers(result: ParsedInputV3): boolean {
  return result.hard_blockers.length > 0;
}

/**
 * Get human-readable summary of assumptions for display.
 */
export function getAssumptionsSummary(result: ParsedInputV3): string[] {
  return result.assumptions.map(a => a.humanReadable);
}
