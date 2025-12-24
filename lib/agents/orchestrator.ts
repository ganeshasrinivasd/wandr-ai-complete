import { runAgent1Parser } from './agent1-parser';
import { runAgent2Researcher } from './agent2-researcher';
import { runAgent3Optimizer } from './agent3-optimizer';
import { runAgent4Storyteller } from './agent4-storyteller';
import { PlanInput, StreamUpdate } from '../utils/types';

export async function* orchestratePlanGeneration(
  planInput: PlanInput
): AsyncGenerator<StreamUpdate, void, unknown> {
  const startTime = Date.now();

  try {
    // Agent 1: Parser & Validator
    yield { agent: 'parser', status: 'running', message: 'Validating your input...' };
    
    const parsedInput = await runAgent1Parser(planInput);
    
    // Check if validation failed - but continue if it's just clarifications
    if (!parsedInput.valid) {
      if (parsedInput.conflicts.length > 0) {
        yield {
          agent: 'parser',
          status: 'error',
          message: `Validation issues: ${parsedInput.conflicts.join(', ')}`,
        };
        return; // Stop here if there are actual conflicts
      }
    }

    // Show clarifications as warnings but continue
    if (parsedInput.clarifications_needed.length > 0) {
      yield {
        agent: 'parser',
        status: 'running',
        message: `Note: ${parsedInput.clarifications_needed.join(', ')}`,
      };
    }

    yield {
      agent: 'parser',
      status: 'complete',
      message: `✓ Validated: ${parsedInput.parsed_data.destination.city}, ${parsedInput.parsed_data.dates.duration_days} days`,
      data: { parsed: parsedInput },
    };

    // Agent 2: Researcher
    yield {
      agent: 'researcher',
      status: 'running',
      message: 'Searching Reddit and Google...',
    };

    const researchResult = await runAgent2Researcher(parsedInput);

    yield {
      agent: 'researcher',
      status: 'complete',
      message: `✓ Found ${researchResult.research_summary.total_candidates} candidates`,
      data: { candidates: researchResult },
    };

    // Agent 3: Optimizer
    yield {
      agent: 'optimizer',
      status: 'running',
      message: 'Building optimal itinerary...',
    };

    const itinerary = await runAgent3Optimizer(parsedInput, researchResult);

    yield {
      agent: 'optimizer',
      status: 'complete',
      message: `✓ Optimized ${parsedInput.parsed_data.dates.duration_days} days`,
      data: { itinerary },
    };

    // Agent 4: Storyteller
    yield {
      agent: 'storyteller',
      status: 'running',
      message: 'Writing your personalized plan...',
    };

    const formattedPlan = await runAgent4Storyteller(parsedInput, itinerary);

    yield {
      agent: 'storyteller',
      status: 'complete',
      message: '✓ Your itinerary is ready!',
      data: { formatted_plan: formattedPlan },
    };

    // Final result
    const endTime = Date.now();
    yield {
      status: 'complete',
      message: `Complete in ${((endTime - startTime) / 1000).toFixed(1)}s`,
      data: {
        parsed: parsedInput,
        candidates: researchResult,
        itinerary,
        formatted_plan: formattedPlan,
        processing_time_ms: endTime - startTime,
      },
    };
  } catch (error) {
    console.error('Orchestrator error:', error);
    yield {
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error occurred',
    };
  }
}