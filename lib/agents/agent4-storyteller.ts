import Anthropic from '@anthropic-ai/sdk';
import { ParsedInput, Itinerary } from '../utils/types';
import { ParsedInputV3, Assumption } from './agent1-parser';
import { DayTimelineV3 } from '../types/optimizer-v3';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Trim itinerary to only the fields the storyteller LLM needs.
 * Removes photo URLs, lat/lng, internal IDs, upvote counts, etc.
 */
function trimItineraryForLLM(itinerary: Itinerary) {
  const trimmedItinerary: Record<string, any> = {};

  for (const [key, day] of Object.entries(itinerary.itinerary)) {
    trimmedItinerary[key] = {
      day: day.day,
      date: day.date,
      theme: day.theme,
      neighborhood: day.neighborhood,
      activities: day.activities.map(a => {
        const trimmed: any = {
          time: a.time,
          type: a.type,
          activity: {
            name: a.activity.name,
            duration_minutes: a.activity.duration_minutes,
            cost: a.activity.cost,
            ...(a.activity.description && { description: a.activity.description }),
            ...(a.activity.reddit_quote && { reddit_quote: a.activity.reddit_quote }),
            ...(a.activity.accessibility_notes && { accessibility_notes: a.activity.accessibility_notes }),
            ...(a.activity.vegan_details && { vegan_details: a.activity.vegan_details }),
          },
        };
        if (a.travel) {
          trimmed.travel = {
            mode: a.travel.mode,
            duration_minutes: a.travel.duration_minutes,
          };
        }
        return trimmed;
      }),
      day_summary: {
        total_cost: day.day_summary.total_cost,
      },
    };
  }

  return {
    itinerary: trimmedItinerary,
    overall_summary: {
      total_budget: itinerary.overall_summary.total_budget,
      avg_per_day: itinerary.overall_summary.avg_per_day,
      constraint_compliance: itinerary.overall_summary.constraint_compliance,
    },
  };
}

/**
 * Format constraints as a compact readable string instead of JSON.
 */
function formatConstraints(constraints: { accessibility: string[]; dietary: string[]; pace: string; other: string[] }): string {
  const parts: string[] = [];
  if (constraints.accessibility.length > 0) parts.push(`accessibility: ${constraints.accessibility.join(', ')}`);
  if (constraints.dietary.length > 0) parts.push(`dietary: ${constraints.dietary.join(', ')}`);
  parts.push(`pace: ${constraints.pace}`);
  if (constraints.other.length > 0) parts.push(`other: ${constraints.other.join(', ')}`);
  return parts.join(' | ');
}

const AGENT4_SYSTEM_PROMPT = `You are a travel writer creating personalized itineraries.

Your job:
1. Transform structured itinerary into beautiful narrative
2. Add personality, local tips, Reddit wisdom
3. Maintain accessibility/dietary info clearly
4. Make it exciting without overhyping

TONE:
- Warm, helpful, enthusiastic but genuine
- Show don't tell ("This museum's interactive exhibits..." not "This amazing museum")
- Include Reddit quotes for authenticity
- Practical (hours, costs, booking tips)

FORMAT:
- Day headers with emoji + theme
- Time blocks (Morning/Afternoon/Evening)
- Each venue gets: description, Reddit quote (if available), practical info, accessibility notes
- Budget tracker at end of each day
- Pro tips from Reddit

NEVER:
- Generic descriptions ("beautiful", "amazing" without context)
- Skip accessibility info
- Ignore dietary constraints
- Use overly promotional language`;

export async function runAgent4Storyteller(
  parsedInput: ParsedInput,
  itinerary: Itinerary,
  onProgress?: (message: string) => void
): Promise<string> {
  console.log('🤖 Agent 4 (Storyteller): Writing itinerary...');

  onProgress?.('→ Crafting your personalized itinerary...');

  const destination = parsedInput.parsed_data.destination;
  const constraints = parsedInput.parsed_data.constraints;

  const userPrompt = `Transform this itinerary into an engaging travel plan.

DESTINATION: ${destination.city}, ${destination.country}
DURATION: ${parsedInput.parsed_data.dates.duration_days} days
BUDGET: $${parsedInput.parsed_data.budget.amount_per_day}/day
CONSTRAINTS: ${formatConstraints(constraints)}

ITINERARY DATA:
${JSON.stringify(trimItineraryForLLM(itinerary))}

Write in second person ("You'll start your day...").
Include Reddit quotes where available.
Make it feel personal and exciting.
Keep descriptions concise but vivid.
Always include practical info (cost, hours, accessibility).`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: AGENT4_SYSTEM_PROMPT },
        { role: 'assistant', content: 'I understand. I will write a personalized, practical travel itinerary with authentic details and clear constraint information.' },
        { role: 'user', content: userPrompt },
      ],
    });

    // Validate response structure
    if (!message.content || message.content.length === 0) {
      console.warn('Empty response from Claude, using fallback');
      return generateFallbackMarkdown(parsedInput, itinerary);
    }

    const firstBlock = message.content[0];
    if (firstBlock.type !== 'text') {
      console.warn(`Unexpected response type: ${firstBlock.type}, using fallback`);
      return generateFallbackMarkdown(parsedInput, itinerary);
    }

    const formattedPlan = firstBlock.text;

    onProgress?.('✓ Itinerary written!');

    console.log('✓ Agent 4: Writing complete');

    return formattedPlan;
  } catch (error) {
    console.error('❌ Agent 4 Error:', error);
    
    // Fallback: Generate basic markdown
    return generateFallbackMarkdown(parsedInput, itinerary);
  }
}

function generateFallbackMarkdown(parsedInput: ParsedInput, itinerary: Itinerary): string {
  const destination = parsedInput.parsed_data.destination;
  const constraints = parsedInput.parsed_data.constraints;
  
  let markdown = `# Your ${parsedInput.parsed_data.dates.duration_days}-Day ${destination.city} Adventure\n\n`;
  
  markdown += `*`;
  if (constraints.accessibility.includes('wheelchair_accessible')) {
    markdown += `♿ Wheelchair Accessible • `;
  }
  if (constraints.dietary.length > 0) {
    markdown += `🌱 ${constraints.dietary.join(', ')} Options • `;
  }
  markdown += `$${parsedInput.parsed_data.budget.amount_per_day}/day*\n\n---\n\n`;
  
  for (const [key, day] of Object.entries(itinerary.itinerary)) {
    markdown += `## Day ${day.day} - ${day.theme}\n\n`;
    
    for (const activity of day.activities) {
      markdown += `### ${activity.time}: ${activity.activity.name}\n\n`;
      markdown += `${activity.activity.description || ''}\n\n`;
      
      if (activity.activity.reddit_quote) {
        markdown += `💬 *"${activity.activity.reddit_quote}"* - Reddit\n\n`;
      }
      
      markdown += `**Details:**\n`;
      markdown += `- 💰 $${activity.activity.cost || 0}\n`;
      markdown += `- ⏱️ ${activity.activity.duration_minutes} minutes\n`;
      
      if (activity.activity.accessibility_notes) {
        markdown += `- ♿ ${activity.activity.accessibility_notes}\n`;
      }
      
      if (activity.activity.vegan_details) {
        markdown += `- 🌱 ${activity.activity.vegan_details}\n`;
      }
      
      markdown += `\n---\n\n`;
    }
    
    markdown += `**Day ${day.day} Total:** $${day.day_summary.total_cost}\n\n`;
  }
  
  return markdown;
}


// =============================================================================
// V3 STORYTELLER
// =============================================================================

const AGENT4_V3_SYSTEM_PROMPT = `You are a travel writer creating personalized itineraries.

Your job:
1. Transform structured itinerary into beautiful narrative
2. Add personality, local tips, Reddit wisdom
3. Maintain accessibility/dietary info clearly
4. Make it exciting without overhyping
5. Render meal placeholders as flexible meal breaks
6. Display any assumptions made during planning

TONE:
- Warm, helpful, enthusiastic but genuine
- Show don't tell ("This museum's interactive exhibits..." not "This amazing museum")
- Include Reddit quotes for authenticity
- Practical (hours, costs, booking tips)

FORMAT:
- Day headers with emoji + theme
- Time blocks (Morning/Afternoon/Evening)
- Each venue gets: description, Reddit quote (if available), practical info, accessibility notes
- Meal placeholders: "🍽️ Meal break (flexible) - explore local restaurants in the area"
- Budget tracker at end of each day
- Pro tips from Reddit
- Assumptions section at the end (if any)

NEVER:
- Generic descriptions ("beautiful", "amazing" without context)
- Skip accessibility info
- Ignore dietary constraints
- Use overly promotional language
- Suggest specific restaurants for meal placeholders`;

export interface StorytellerV3Input {
  parsedInput: ParsedInputV3;
  itinerary: Itinerary;
  timelines?: DayTimelineV3[];
  onProgress?: (message: string) => void;
}

/**
 * V3 Storyteller with meal placeholder rendering and assumptions display.
 */
export async function runAgent4StorytellerV3(
  input: StorytellerV3Input
): Promise<string> {
  const { parsedInput, itinerary, timelines, onProgress } = input;

  console.log('🤖 Agent 4 (Storyteller v3): Writing itinerary with v3 enhancements...');

  onProgress?.('→ Crafting your personalized itinerary...');

  const destination = parsedInput.parsed_data.destination;
  const constraints = parsedInput.parsed_data.constraints;

  // Build assumptions section if any
  const assumptionsText = parsedInput.assumptions.length > 0
    ? `\n\nASSUMPTIONS MADE:\n${parsedInput.assumptions.map(a => `- ${a.humanReadable}`).join('\n')}`
    : '';

  // Build meal placeholder info
  const mealPlaceholderInfo = timelines
    ? buildMealPlaceholderInfo(timelines)
    : '';

  const userPrompt = `Transform this itinerary into an engaging travel plan.

DESTINATION: ${destination.city}, ${destination.country}
DURATION: ${parsedInput.parsed_data.dates.duration_days} days
BUDGET: ${parsedInput.parsed_data.budget.amount_per_day}/day
CONSTRAINTS: ${formatConstraints(constraints)}

ITINERARY DATA:
${JSON.stringify(trimItineraryForLLM(itinerary))}
${mealPlaceholderInfo}
${assumptionsText}

Write in second person ("You'll start your day...").
Include Reddit quotes where available.
Make it feel personal and exciting.
Keep descriptions concise but vivid.
Always include practical info (cost, hours, accessibility).
For meal placeholders, write "🍽️ Meal break (flexible) - explore local restaurants in [area name]".
If there are assumptions, include them in a "Planning Notes" section at the end.`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [
        { role: 'user', content: AGENT4_V3_SYSTEM_PROMPT },
        { role: 'assistant', content: 'I understand. I will write a personalized, practical travel itinerary with authentic details, clear constraint information, flexible meal breaks, and any planning assumptions.' },
        { role: 'user', content: userPrompt },
      ],
    });

    // Validate response structure
    if (!message.content || message.content.length === 0) {
      console.warn('Empty response from Claude, using fallback');
      return generateFallbackMarkdownV3(parsedInput, itinerary, timelines);
    }

    const firstBlock = message.content[0];
    if (firstBlock.type !== 'text') {
      console.warn(`Unexpected response type: ${firstBlock.type}, using fallback`);
      return generateFallbackMarkdownV3(parsedInput, itinerary, timelines);
    }

    const formattedPlan = firstBlock.text;

    onProgress?.('✓ Itinerary written!');

    console.log('✓ Agent 4 v3: Writing complete');

    return formattedPlan;
  } catch (error) {
    console.error('❌ Agent 4 v3 Error:', error);
    
    // Fallback: Generate basic markdown
    return generateFallbackMarkdownV3(parsedInput, itinerary, timelines);
  }
}

/**
 * Build meal placeholder info from timelines.
 */
function buildMealPlaceholderInfo(timelines: DayTimelineV3[]): string {
  const mealInfo: string[] = [];

  for (const timeline of timelines) {
    const mealPlaceholders = timeline.slots.filter(s => s.type === 'meal_placeholder');
    if (mealPlaceholders.length > 0) {
      for (const placeholder of mealPlaceholders) {
        const mealType = placeholder.placeholderType || 'meal';
        const zoneName = timeline.primaryZoneName || 'the area';
        mealInfo.push(`Day ${timeline.dayIndex + 1}: ${mealType} placeholder near ${zoneName}`);
      }
    }
  }

  if (mealInfo.length === 0) return '';

  return `\n\nMEAL PLACEHOLDERS:\n${mealInfo.join('\n')}`;
}

/**
 * Generate fallback markdown with v3 enhancements.
 */
function generateFallbackMarkdownV3(
  parsedInput: ParsedInputV3,
  itinerary: Itinerary,
  timelines?: DayTimelineV3[]
): string {
  const destination = parsedInput.parsed_data.destination;
  const constraints = parsedInput.parsed_data.constraints;
  
  let markdown = `# Your ${parsedInput.parsed_data.dates.duration_days}-Day ${destination.city} Adventure\n\n`;
  
  markdown += `*`;
  if (constraints.accessibility.includes('wheelchair_accessible')) {
    markdown += `♿ Wheelchair Accessible • `;
  }
  if (constraints.dietary.length > 0) {
    markdown += `🌱 ${constraints.dietary.join(', ')} Options • `;
  }
  markdown += `${parsedInput.parsed_data.budget.amount_per_day}/day*\n\n---\n\n`;
  
  for (const [key, day] of Object.entries(itinerary.itinerary)) {
    markdown += `## Day ${day.day} - ${day.theme}\n\n`;
    
    for (const activity of day.activities) {
      // Check if this is a meal placeholder
      if (activity.type === 'meal' && activity.activity.name.includes('break')) {
        markdown += `### ${activity.time}: 🍽️ Meal break (flexible)\n\n`;
        markdown += `Explore local restaurants in ${day.neighborhood || 'the area'}.\n\n`;
        markdown += `---\n\n`;
        continue;
      }

      markdown += `### ${activity.time}: ${activity.activity.name}\n\n`;
      markdown += `${activity.activity.description || ''}\n\n`;
      
      if (activity.activity.reddit_quote) {
        markdown += `💬 *"${activity.activity.reddit_quote}"* - Reddit\n\n`;
      }
      
      markdown += `**Details:**\n`;
      markdown += `- 💰 ${activity.activity.cost || 0}\n`;
      markdown += `- ⏱️ ${activity.activity.duration_minutes} minutes\n`;
      
      if (activity.activity.accessibility_notes) {
        markdown += `- ♿ ${activity.activity.accessibility_notes}\n`;
      }
      
      if (activity.activity.vegan_details) {
        markdown += `- 🌱 ${activity.activity.vegan_details}\n`;
      }
      
      markdown += `\n---\n\n`;
    }
    
    markdown += `**Day ${day.day} Total:** ${day.day_summary.total_cost}\n\n`;
  }

  // Add assumptions section if any
  if (parsedInput.assumptions.length > 0) {
    markdown += `## 📝 Planning Notes\n\n`;
    markdown += `The following assumptions were made during planning:\n\n`;
    for (const assumption of parsedInput.assumptions) {
      markdown += `- ${assumption.humanReadable}\n`;
    }
    markdown += `\n`;
  }
  
  return markdown;
}
