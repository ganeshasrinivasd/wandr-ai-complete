import Anthropic from '@anthropic-ai/sdk';
import { ParsedInput, Itinerary } from '../utils/types';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

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
CONSTRAINTS: ${JSON.stringify(constraints)}

ITINERARY DATA:
${JSON.stringify(itinerary, null, 2)}

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

    const formattedPlan = message.content[0].type === 'text' 
      ? message.content[0].text 
      : '';

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
