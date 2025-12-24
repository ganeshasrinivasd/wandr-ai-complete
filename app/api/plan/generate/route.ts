import { NextRequest } from 'next/server';
import { orchestratePlanGeneration } from '@/lib/agents/orchestrator';
import { supabaseAdmin } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const generator = orchestratePlanGeneration(body);
          
          let planData: any = {};
          
          for await (const update of generator) {
            const data = `data: ${JSON.stringify(update)}\n\n`;
            controller.enqueue(encoder.encode(data));
            
            if (update.status === 'complete' && update.data) {
              planData = update.data;
            }
          }
          
          // Save to database
          if (planData.parsed && planData.itinerary) {
            const planId = randomUUID();
            
            console.log('Saving plan to database...', planId);
            
            const { data: savedPlan, error } = await supabaseAdmin
              .from('plans')
              .insert({
                id: planId,
                destination_city: planData.parsed.parsed_data.destination.city,
                destination_country: planData.parsed.parsed_data.destination.country,
                start_date: planData.parsed.parsed_data.dates.start,
                end_date: planData.parsed.parsed_data.dates.end,
                duration_days: planData.parsed.parsed_data.dates.duration_days,
                budget_per_day: planData.parsed.parsed_data.budget.amount_per_day,
                constraints: planData.parsed.parsed_data.constraints,
                interests: planData.parsed.parsed_data.interests,
                parsed_input: planData.parsed,
                research_data: planData.candidates,
                itinerary: planData.itinerary,
                formatted_plan: planData.formatted_plan || '',
                status: 'completed',
                processing_time_ms: planData.processing_time_ms,
              })
              .select()
              .single();
            
            if (error) {
              console.error('Database error:', error);
              const errorMsg = `data: ${JSON.stringify({
                status: 'error',
                message: `Database error: ${error.message}`
              })}\n\n`;
              controller.enqueue(encoder.encode(errorMsg));
            } else {
              console.log('Plan saved successfully!', planId);
              const final = `data: ${JSON.stringify({
                status: 'complete',
                planId: planId,
                message: 'Plan saved successfully!'
              })}\n\n`;
              controller.enqueue(encoder.encode(final));
            }
          } else {
            console.error('No plan data to save');
          }
          
          controller.close();
        } catch (error) {
          console.error('Stream error:', error);
          const errorData = `data: ${JSON.stringify({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
          controller.close();
        }
      },
    });
    
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('API error:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}