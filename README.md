# Wandr AI

AI-powered travel planning that satisfies every constraint. Wheelchair accessible, vegan, budget-friendly - we handle the impossible.

## Overview

Wandr uses a multi-agent AI system to create personalized travel itineraries. Provide your destination, dates, budget, and constraints - four specialized AI agents work together to build the perfect trip.

## How It Works

The system processes travel requests through a pipeline of specialized agents:

1. **Parser Agent** - Validates input, detects conflicts, and applies sensible defaults
2. **Researcher Agent** - Discovers venues via Google Maps with iconic scoring
3. **Optimizer Agent** - Builds constraint-satisfying itineraries using anchor-first scheduling
4. **Storyteller Agent** - Generates engaging day-by-day narratives

### Key Capabilities

- Full constraint satisfaction (accessibility, dietary, budget)
- Anchor-first scheduling prioritizes must-see attractions
- Geographic zone clustering minimizes travel time
- Duplicate detection via canonical place registry
- Real-time generation progress streaming
- Interactive day-by-day itinerary view with maps

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- API keys (see Environment Setup)

### Installation

```bash
git clone https://github.com/ganeshasrinivasd/wandr-ai-complete.git
cd wandr-ai-complete
npm install
```

### Environment Setup

Create `.env.local` in the project root:

```bash
# Anthropic (Optimizer and Storyteller agents)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (Parser agent)
OPENAI_API_KEY=sk-proj-...

# Google Maps (Researcher agent)
GOOGLE_MAPS_API_KEY=AIza...

# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Mapbox (Optional - for route visualization)
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ...
```

### Google Maps API Setup

Enable these APIs in Google Cloud Console:
- Places API
- Geocoding API
- Directions API

### Database Setup

1. Create a Supabase project at supabase.com
2. Run the migration in `supabase/migrations/001_initial_schema.sql`
3. Copy your project URL and keys to `.env.local`

### Run Development Server

```bash
npm run dev
```

Open http://localhost:3000

## Architecture

### Agent Pipeline

```
User Input -> Parser -> Researcher -> Optimizer -> Storyteller -> Itinerary
```

**Parser**: Extracts structured data from natural language input. Identifies hard blockers (impossible constraints) and soft conflicts (resolvable with defaults). Outputs validated trip parameters.

**Researcher**: Queries Google Maps for attractions, restaurants, and points of interest. Computes iconic scores based on review count, rating, and category. Identifies anchor attractions (high-value must-see venues).

**Optimizer**: Builds daily schedules using anchor-first selection. Groups venues into geographic zones to minimize travel. Validates feasibility and repairs constraint violations. Ensures no duplicate venues across days.

**Storyteller**: Transforms optimized schedules into readable narratives with descriptions, tips, and context for each activity.

### Core Components

| Component | Purpose |
|-----------|---------|
| Canonical Registry | Deduplicates venues across sources using normalized names and geohash |
| Zone Builder | Clusters venues geographically using K-means with DBSCAN fallback |
| Travel Cache | Two-tier travel time estimation (heuristic + real API validation) |
| Repair Engine | Fixes constraint violations with priority-ordered repair actions |
| Feasibility Checker | Validates time budgets, travel feasibility, and constraint satisfaction |

## Project Structure

```
wandr-ai-complete/
├── app/                    # Next.js pages and API routes
│   ├── api/plan/          # Plan generation and retrieval endpoints
│   ├── plan/              # Itinerary display pages
│   └── planner/           # Trip input form
├── lib/
│   ├── agents/            # AI agent implementations
│   ├── planning/          # Zone building, routing, scheduling
│   ├── validation/        # Feasibility checks and repairs
│   ├── config/            # Feature flags and optimizer config
│   └── observability/     # PlanTrace logging
├── components/            # React components
└── supabase/migrations/   # Database schema
```

## Tech Stack

- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- Framer Motion
- Supabase (PostgreSQL)
- OpenAI API
- Anthropic API
- Google Maps API
- Mapbox GL

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
npm test         # Run test suite
```

## Deployment

### Vercel (Recommended)

1. Push to GitHub
2. Import project in Vercel
3. Add environment variables
4. Deploy

### Manual

```bash
npm run build
npm run start
```

## Configuration

Feature flags in `lib/config/feature-flags.ts`:

| Flag | Default | Description |
|------|---------|-------------|
| ENABLE_MEALS | false | Include restaurant recommendations |
| ENABLE_REAL_TRAVEL_VALIDATION | true | Validate travel times via API |
| ENABLE_DBSCAN_FALLBACK | true | Use DBSCAN when K-means fails validation |

Optimizer parameters in `lib/config/optimizer-config.ts` control anchor selection thresholds, zone diameter limits, and scheduling constraints.

## Known Limitations

- Reddit integration currently disabled
- Opening hours validation not yet implemented
- Limited to Google Maps coverage areas
- Meal scheduling is feature-flagged off by default

## License

MIT

## Contributing

Pull requests welcome. For major changes, open an issue first.

## Support

GitHub Issues: https://github.com/ganeshasrinivasd/wandr-ai-complete/issues
