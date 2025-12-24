import OpenAI from 'openai';
import { PlanInput, ParsedInput } from '../utils/types';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

    const result = JSON.parse(
      completion.choices[0].message.content || '{}'
    ) as ParsedInput;

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
