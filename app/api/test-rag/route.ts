import { NextResponse } from 'next/server';
import { vectorStore } from '@/lib/rag/faiss-store';
import { getVenueContextAgentic } from '@/lib/rag/agentic';

export async function GET() {
  try {
    console.log('🧪 Testing RAG System...\n');
    
    // Test 1: Vector Store
    await vectorStore.load();
    const stats = vectorStore.getStats();
    
    const searchResults = await vectorStore.search(
      'Best time to visit Golconda Fort',
      3
    );
    
    // Test 2: Agentic RAG
    const context = await getVenueContextAgentic(
      'Golconda Fort',
      'Hyderabad',
      { lat: 17.3833, lng: 78.4011 }
    );
    
    return NextResponse.json({
      success: true,
      tests: {
        vectorStore: {
          passed: searchResults.length > 0,
          stats,
          results: searchResults.map(r => ({
            venue: r.venue_name,
            score: r.score,
            source: r.source,
            preview: r.content.substring(0, 100)
          }))
        },
        agenticRAG: {
          passed: true,
          context: {
            best_time: context.best_time,
            duration: context.duration_hours,
            nearby_food: context.nearby_food,
            next_attraction: context.next_attraction,
            pro_tips: context.pro_tips,
            sources_used: context.sources_used
          }
        }
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}