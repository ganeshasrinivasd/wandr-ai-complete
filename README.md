# Wandr AI

AI-powered travel planning that satisfies every constraint. Wheelchair accessible, vegan, budget-friendly - we handle the impossible.

## Overview

Wandr uses a multi-agent AI system to create personalized travel itineraries. Tell us your destination, dates, budget, and constraints - our 4 specialized AI agents work together to build the perfect trip.

### How It Works

1. **Parser Agent** - Validates and structures your input (OpenAI GPT-4o-mini)
2. **Researcher Agent** - Finds venues via Google Maps API
3. **Optimizer Agent** - Builds constraint-satisfying itineraries (Claude)
4. **Storyteller Agent** - Writes engaging narratives (Claude)

## Features

- 100% constraint satisfaction (accessibility, dietary, budget)
- Route optimization by neighborhood clustering
- Real-time generation progress
- Day-by-day interactive itinerary view

## Quick Start

### Prerequisites

- Node.js 18+
- npm or yarn
- API keys (see below)

### Installation

```bash
git clone https://github.com/ganeshasrinivasd/wandr-ai-complete.git
cd wandr-ai-complete
npm install
```

### Environment Setup

Create `.env.local` in the project root:

```bash
# Anthropic (Agent 4 - Storyteller)
ANTHROPIC_API_KEY=sk-ant-...

# OpenAI (Agent 1 - Parser)
OPENAI_API_KEY=sk-proj-...

# Google Maps (Agent 2 - Researcher)
GOOGLE_MAPS_API_KEY=AIza...

# Supabase (Database)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
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

## Project Structure

```
wandr-ai-complete/
├── app/
│   ├── api/
│   │   └── plan/
│   │       ├── [id]/route.ts      # GET plan by ID
│   │       └── generate/route.ts   # POST generate plan
│   ├── plan/
│   │   ├── [id]/page.tsx          # Results view
│   │   └── generating/page.tsx     # Generation progress
│   ├── planner/page.tsx           # Input form
│   └── page.tsx                   # Landing page
├── lib/
│   ├── agents/
│   │   ├── agent1-parser.ts
│   │   ├── agent2-researcher.ts
│   │   ├── agent3-optimizer.ts
│   │   ├── agent4-storyteller.ts
│   │   └── orchestrator.ts
│   ├── mcp/
│   │   ├── google-maps-client.ts
│   │   └── reddit-client.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils/
│       └── types.ts
├── mcp-servers/
│   ├── google-maps/
│   └── reddit/
└── supabase/
    └── migrations/
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

## Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
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

## Known Limitations

- Reddit integration is currently disabled (simplified researcher)
- Opening hours validation not yet implemented
- Limited to Google Maps coverage areas

## License

MIT

## Contributing

Pull requests welcome. For major changes, open an issue first.

## Support

- GitHub Issues: https://github.com/ganeshasrinivasd/wandr-ai-complete/issues
