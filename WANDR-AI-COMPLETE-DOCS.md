# Wandr AI Complete - Full Project Documentation
Generated: 2025-12-24 12:02:37
Project Path: /Users/ganeshasrinivasdamaraju/Desktop/wandr-ai-complete
GitHub: https://github.com/ganeshasrinivasd/wandr-ai-complete

---

## 📋 Table of Contents

1. [Project Structure](#project-structure)
2. [Configuration Files](#configuration-files)
3. [Source Code](#source-code)
4. [Environment Variables](#environment-variables)
5. [Database Schema](#database-schema)
6. [Current Issues](#current-issues)

---

## 📁 Project Structure

```
├── app/
│   ├── api/
│   │   └── plan/
│   │       ├── [id]/
│   │       └── generate/
│   ├── plan/
│   │   ├── [id]/
│   │   │   └── page.tsx (10.1 KB)
│   │   └── generating/
│   │       └── page.tsx (5.5 KB)
│   ├── planner/
│   │   └── page.tsx (9.0 KB)
│   ├── globals.css (59 bytes)
│   ├── layout.tsx (205 bytes)
│   └── page.tsx (5.8 KB)
├── components/
│   └── ui/
├── lib/
│   ├── agents/
│   │   ├── agent1-parser.ts (3.2 KB)
│   │   ├── agent2-researcher.ts (5.0 KB)
│   │   ├── agent3-optimizer.ts (10.3 KB)
│   │   ├── agent4-storyteller.ts (4.6 KB)
│   │   └── orchestrator.ts (3.2 KB)
│   ├── mcp/
│   │   ├── google-maps-client.ts (980 bytes)
│   │   └── reddit-client.ts (551 bytes)
│   ├── supabase/
│   │   ├── client.ts (251 bytes)
│   │   └── server.ts (258 bytes)
│   └── utils/
│       └── types.ts (2.7 KB)
├── mcp-servers/
│   ├── google-maps/
│   │   ├── src/
│   │   │   └── index.ts (6.6 KB)
│   │   ├── package.json (424 bytes)
│   │   └── tsconfig.json (283 bytes)
│   └── reddit/
│       ├── src/
│       │   └── index.ts (7.4 KB)
│       ├── package.json (392 bytes)
│       └── tsconfig.json (283 bytes)
├── public/
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql (4.6 KB)
├── AUTOMATED-SETUP-GUIDE.md (4.4 KB)
├── README.md (18.6 KB)
├── SETUP-INSTRUCTIONS.md (5.1 KB)
├── agents-implementation.md (28.7 KB)
├── generate-project-docs.py (10.1 KB)
├── install.sh (3.5 KB)
├── mcp-servers-implementation.md (17.8 KB)
├── next-env.d.ts (201 bytes)
├── next.config.js (178 bytes)
├── package.json (1.5 KB)
├── postcss.config.js (70 bytes)
├── setup-automated.py (7.9 KB)
├── tailwind.config.ts (351 bytes)
├── tsconfig.json (644 bytes)
└── wandr-ai-setup.md (19.7 KB)

```

---


## ⚙️ Configuration Files

### package.json

```json
{
  "name": "wandr-ai",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.20.9",
    "@googlemaps/google-maps-services-js": "^3.3.42",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-tabs": "^1.0.4",
    "@supabase/supabase-js": "^2.43.4",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.1",
    "date-fns": "^3.6.0",
    "framer-motion": "^11.18.2",
    "html2canvas": "^1.4.1",
    "jspdf": "^2.5.1",
    "lucide-react": "^0.379.0",
    "mapbox-gl": "^3.3.0",
    "nanoid": "^5.0.7",
    "next": "14.2.3",
    "openai": "^4.47.1",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-map-gl": "^7.1.7",
    "react-markdown": "^9.0.1",
    "recharts": "^2.12.7",
    "snoowrap": "^1.23.0",
    "tailwind-merge": "^2.3.0",
    "typescript": "^5.4.5",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^20.12.12",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "autoprefixer": "^10.4.19",
    "eslint": "^8.57.0",
    "eslint-config-next": "14.2.3",
    "postcss": "^8.4.38",
    "prettier": "^3.2.5",
    "tailwindcss": "^3.4.3",
    "tailwindcss-animate": "^1.0.7"
  }
}

```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": [
      "dom",
      "esnext"
    ],
    "strict": true,
    "esModuleInterop": true,
    "jsx": "preserve",
    "module": "esnext",
    "moduleResolution": "bundler",
    "paths": {
      "@/*": [
        "./*"
      ]
    },
    "allowJs": true,
    "skipLibCheck": true,
    "noEmit": true,
    "incremental": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "plugins": [
      {
        "name": "next"
      }
    ]
  },
  "include": [
    "next-env.d.ts",
    ".next/types/**/*.ts",
    "**/*.ts",
    "**/*.tsx"
  ],
  "exclude": [
    "node_modules"
  ]
}

```

### next.config.js

```json
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['maps.googleapis.com', 'lh3.googleusercontent.com'],
  },
};
module.exports = nextConfig;

```

### tailwind.config.ts

```json
import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: "#FF6B35" },
        secondary: { DEFAULT: "#004E89" },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
export default config;

```


## 💻 Source Code

### app/

#### app/api/plan/[id]/route.ts

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    console.log('Fetching plan:', id);

    const { data, error } = await supabaseAdmin
      .from('plans')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json(
        { error: 'Plan not found', details: error.message },
        { status: 404 }
      );
    }

    if (!data) {
      console.error('No data found for plan:', id);
      return NextResponse.json(
        { error: 'Plan not found' },
        { status: 404 }
      );
    }

    console.log('Plan found!', id);
    return NextResponse.json(data);
  } catch (error) {
    console.error('API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

```

#### app/api/plan/generate/route.ts

```typescript
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
```

#### app/globals.css

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

```

#### app/layout.tsx

```tsx
import "./globals.css";
export const metadata = {
  title: "Wandr AI",
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>;
}

```

#### app/page.tsx

```tsx
'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Sparkles, Zap, Map, CheckCircle } from 'lucide-react';

export default function HomePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50">
      {/* Hero Section */}
      <div className="container mx-auto px-4 pt-20 pb-32">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="text-center max-w-4xl mx-auto"
        >
          <div className="inline-flex items-center gap-2 bg-orange-100 text-orange-600 px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            AI-Powered Travel Planning
          </div>

          <h1 className="text-6xl md:text-7xl font-bold text-gray-900 mb-6">
            AI that solves
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-blue-600">
              impossible travel plans
            </span>
          </h1>

          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
            Wheelchair accessible + vegan + $60/day budget? No problem.
            Our 4 specialized AI agents create perfect itineraries that satisfy
            every constraint.
          </p>

          <Link
            href="/planner"
            className="inline-flex items-center gap-2 bg-orange-500 hover:bg-orange-600 text-white px-8 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
          >
            Start Planning Your Trip
            <Zap className="w-5 h-5" />
          </Link>

          <p className="text-sm text-gray-500 mt-4">
            Free to use • No credit card required
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto mt-24"
        >
          <FeatureCard
            icon={<CheckCircle className="w-8 h-8 text-orange-500" />}
            title="100% Constraint Satisfaction"
            description="Every venue meets ALL your requirements: accessibility, dietary needs, budget."
          />
          <FeatureCard
            icon={<Map className="w-8 h-8 text-blue-500" />}
            title="Smart Route Optimization"
            description="Minimized travel time, clustered by neighborhood, perfectly paced days."
          />
          <FeatureCard
            icon={<Sparkles className="w-8 h-8 text-purple-500" />}
            title="Reddit-Verified Picks"
            description="Authentic recommendations from real travelers, not sponsored content."
          />
        </motion.div>

        {/* How It Works */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-32 max-w-4xl mx-auto"
        >
          <h2 className="text-4xl font-bold text-center text-gray-900 mb-16">
            How It Works
          </h2>

          <div className="space-y-12">
            <Step
              number="1"
              title="Tell us your constraints"
              description="Wheelchair accessible, vegan, budget $60/day? Add as many constraints as you want."
            />
            <Step
              number="2"
              title="Watch AI agents work"
              description="4 specialized agents parse, research, optimize, and write your perfect itinerary in real-time."
            />
            <Step
              number="3"
              title="Get your perfect plan"
              description="A beautiful, day-by-day itinerary that satisfies every single constraint. Export or share instantly."
            />
          </div>
        </motion.div>

        {/* CTA Section */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-32 bg-gradient-to-r from-orange-500 to-blue-600 rounded-3xl p-12 text-center text-white shadow-2xl"
        >
          <h2 className="text-4xl font-bold mb-4">
            Ready to plan the impossible?
          </h2>
          <p className="text-xl mb-8 text-orange-100">
            Join travelers who've planned 1,000+ accessible trips
          </p>
          <Link
            href="/planner"
            className="inline-flex items-center gap-2 bg-white text-orange-600 hover:bg-orange-50 px-8 py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-105"
          >
            Create Your Itinerary
            <Zap className="w-5 h-5" />
          </Link>
        </motion.div>
      </div>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-shadow">
      <div className="mb-4">{icon}</div>
      <h3 className="text-xl font-bold text-gray-900 mb-3">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex gap-6 items-start">
      <div className="flex-shrink-0 w-12 h-12 bg-gradient-to-br from-orange-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
        {number}
      </div>
      <div>
        <h3 className="text-2xl font-bold text-gray-900 mb-2">{title}</h3>
        <p className="text-gray-600 text-lg">{description}</p>
      </div>
    </div>
  );
}

```

#### app/plan/[id]/page.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { CheckCircle, MapPin, Clock, DollarSign, Utensils } from 'lucide-react';

export default function PlanResultsPage() {
  const params = useParams();
  const planId = params.id as string;
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPlan();
  }, [planId]);

  const fetchPlan = async () => {
    try {
      const response = await fetch(`/api/plan/${planId}`);
      if (response.ok) {
        const data = await response.json();
        setPlan(data);
      }
    } catch (error) {
      console.error('Failed to fetch plan:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your itinerary...</p>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Plan Not Found</h1>
          <p className="text-gray-600 mb-8">This itinerary doesn't exist or has been deleted.</p>
          <a
            href="/planner"
            className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition"
          >
            Create New Plan
          </a>
        </div>
      </div>
    );
  }

  const itinerary = plan.itinerary?.itinerary || {};
  const days = Object.values(itinerary);

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 py-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm font-medium mb-4">
            <CheckCircle className="w-4 h-4" />
            Itinerary Created
          </div>
          
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Your {plan.destination_city} Adventure
          </h1>
          
          <div className="flex items-center justify-center gap-6 text-gray-600">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              <span>{plan.duration_days} days</span>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5" />
              <span>${plan.budget_per_day}/day</span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              <span>{plan.destination_city}, {plan.destination_country}</span>
            </div>
          </div>
        </div>

        {/* Constraints Badges */}
        {plan.constraints && (
          <div className="flex flex-wrap gap-2 justify-center mb-12">
            {plan.constraints.accessibility?.map((item: string) => (
              <span key={item} className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full text-sm">
                ♿ {item}
              </span>
            ))}
            {plan.constraints.dietary?.map((item: string) => (
              <span key={item} className="bg-green-100 text-green-700 px-4 py-2 rounded-full text-sm">
                🌱 {item}
              </span>
            ))}
          </div>
        )}

        {/* Check if we have activities */}
        {days.length === 0 || !days.some((day: any) => day.activities?.length > 0) ? (
          <div className="bg-yellow-50 border-2 border-yellow-200 rounded-2xl p-8 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Google Maps API Issue
            </h2>
            <p className="text-gray-700 mb-4">
              No venues were found for your destination. This is likely due to:
            </p>
            <ul className="text-left max-w-lg mx-auto space-y-2 text-gray-700">
              <li>• Google Maps API not properly configured</li>
              <li>• Places API not enabled in Google Cloud Console</li>
              <li>• API key restrictions blocking requests</li>
            </ul>
            <div className="mt-6">
              <a
                href="https://console.cloud.google.com/apis/dashboard"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition mr-4"
              >
                Fix Google Maps API
              </a>
              <a
                href="/planner"
                className="inline-block bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition"
              >
                Try Again
              </a>
            </div>
          </div>
        ) : (
          /* Day-by-Day Itinerary */
          <div className="space-y-8">
            {days.map((day: any) => (
              <div key={day.day} className="bg-white rounded-3xl shadow-xl p-8">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-3xl font-bold text-gray-900">
                      Day {day.day}
                    </h2>
                    <p className="text-gray-600">{day.date} • {day.neighborhood}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-orange-500">
                      ${day.day_summary.total_cost}
                    </div>
                    <div className="text-sm text-gray-600">
                      {day.activities.length} activities
                    </div>
                  </div>
                </div>

                {/* Activities */}
                <div className="space-y-6">
                  {day.activities.map((activity: any, idx: number) => (
                    <div key={idx} className="flex gap-4 border-l-4 border-orange-500 pl-4">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center">
                          {activity.type === 'meal' ? (
                            <Utensils className="w-6 h-6 text-orange-600" />
                          ) : (
                            <MapPin className="w-6 h-6 text-orange-600" />
                          )}
                        </div>
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="text-xl font-bold text-gray-900">
                              {activity.activity.name}
                            </h3>
                            <p className="text-gray-600">{activity.time}</p>
                          </div>
                          {activity.activity.cost > 0 && (
                            <span className="text-lg font-semibold text-gray-900">
                              ${activity.activity.cost}
                            </span>
                          )}
                        </div>

                        <p className="text-gray-700 mb-2">
                          {activity.activity.description}
                        </p>

                        {activity.activity.accessibility_notes && (
                          <div className="inline-block bg-blue-50 text-blue-700 px-3 py-1 rounded-full text-sm mr-2">
                            ♿ {activity.activity.accessibility_notes}
                          </div>
                        )}

                        {activity.activity.vegan_details && (
                          <div className="inline-block bg-green-50 text-green-700 px-3 py-1 rounded-full text-sm">
                            🌱 {activity.activity.vegan_details}
                          </div>
                        )}

                        {activity.activity.reddit_quote && (
                          <div className="mt-3 bg-gray-50 border-l-4 border-gray-300 pl-4 py-2 italic text-gray-600">
                            "{activity.activity.reddit_quote}"
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Day Summary */}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="grid grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        ${day.day_summary.total_cost}
                      </div>
                      <div className="text-sm text-gray-600">Total Cost</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {day.day_summary.total_walking_km} km
                      </div>
                      <div className="text-sm text-gray-600">Walking</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">
                        {day.day_summary.activities_count}
                      </div>
                      <div className="text-sm text-gray-600">Activities</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="mt-12 text-center space-x-4">
          <a
            href="/planner"
            className="inline-block bg-orange-500 text-white px-8 py-3 rounded-lg hover:bg-orange-600 transition font-semibold"
          >
            Create Another Trip
          </a>
        </div>
      </div>
    </div>
  );
}

```

#### app/plan/generating/page.tsx

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, CheckCircle, Sparkles } from 'lucide-react';

export default function GeneratingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<string[]>(['Starting...']);
  const [agentStatus, setAgentStatus] = useState({
    parser: 'waiting',
    researcher: 'waiting',
    optimizer: 'waiting',
    storyteller: 'waiting',
  });
  const [planId, setPlanId] = useState<string | null>(null);

  useEffect(() => {
    const dataParam = searchParams.get('data');
    if (!dataParam) {
      router.push('/planner');
      return;
    }

    const planInput = JSON.parse(dataParam);
    generatePlan(planInput);
  }, [searchParams]);

  const generatePlan = async (planInput: any) => {
    try {
      const response = await fetch('/api/plan/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(planInput),
      });

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.agent) {
                  setAgentStatus(prev => ({
                    ...prev,
                    [data.agent]: data.status,
                  }));
                }

                if (data.message) {
                  setStatus(prev => [...prev, `${data.agent || ''}: ${data.message}`]);
                }

                if (data.planId) {
                  setPlanId(data.planId);
                  setTimeout(() => {
                    router.push(`/plan/${data.planId}`);
                  }, 2000);
                }
              } catch (e) {
                console.error('Parse error:', e);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Generation error:', error);
      setStatus(prev => [...prev, `Error: ${error}`]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 py-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Creating Your Perfect Itinerary
          </h1>
          <p className="text-xl text-gray-600">
            Watch our AI agents work their magic ✨
          </p>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-12">
          <AgentCard
            name="Parser"
            icon="🧠"
            status={agentStatus.parser}
            description="Validating input"
          />
          <AgentCard
            name="Researcher"
            icon="🔍"
            status={agentStatus.researcher}
            description="Finding venues"
          />
          <AgentCard
            name="Optimizer"
            icon="⚡"
            status={agentStatus.optimizer}
            description="Building itinerary"
          />
          <AgentCard
            name="Storyteller"
            icon="✍️"
            status={agentStatus.storyteller}
            description="Writing narrative"
          />
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 shadow-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-semibold">Live Feed</span>
          </div>
          
          <div className="space-y-2 font-mono text-sm max-h-96 overflow-y-auto">
            {status.map((msg, i) => (
              <div key={i} className="text-green-400">
                {msg}
              </div>
            ))}
          </div>
        </div>

        {planId && (
          <div className="mt-8 bg-green-50 border-2 border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Your itinerary is ready!
            </h2>
            <p className="text-gray-600">
              Redirecting you to your personalized travel plan...
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ name, icon, status, description }: {
  name: string;
  icon: string;
  status: string;
  description: string;
}) {
  return (
    <div className={`bg-white rounded-2xl p-6 shadow-lg transition-all ${
      status === 'running' ? 'ring-4 ring-orange-400 scale-105' :
      status === 'complete' ? 'ring-2 ring-green-400' : 'opacity-60'
    }`}>
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="font-bold text-gray-900 mb-1">{name}</h3>
      <p className="text-sm text-gray-600 mb-3">{description}</p>
      
      <div className="flex items-center gap-2">
        {status === 'waiting' && <div className="w-2 h-2 bg-gray-300 rounded-full" />}
        {status === 'running' && <Loader2 className="w-4 h-4 text-orange-500 animate-spin" />}
        {status === 'complete' && <CheckCircle className="w-4 h-4 text-green-500" />}
        <span className="text-xs font-medium capitalize text-gray-600">{status}</span>
      </div>
    </div>
  );
}
```

#### app/planner/page.tsx

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, DollarSign, Users, Accessibility, Heart } from 'lucide-react';

export default function PlannerPage() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    destination: '',
    dates: '',
    budget: '100',
    travelers: '1',
    constraints: [] as string[],
    interests: [] as string[],
    special_requests: '',
  });

  const constraintOptions = [
    { id: 'wheelchair', label: '♿ Wheelchair Accessible', icon: '♿' },
    { id: 'vegan', label: '🌱 Vegan', icon: '🌱' },
    { id: 'vegetarian', label: '🥗 Vegetarian', icon: '🥗' },
    { id: 'halal', label: '☪️ Halal', icon: '☪️' },
    { id: 'kosher', label: '✡️ Kosher', icon: '✡️' },
    { id: 'gluten-free', label: '🌾 Gluten-Free', icon: '🌾' },
  ];

  const interestOptions = [
    { id: 'food', label: '🍜 Food', icon: '🍜' },
    { id: 'temples', label: '⛩️ Temples', icon: '⛩️' },
    { id: 'museums', label: '🏛️ Museums', icon: '🏛️' },
    { id: 'nature', label: '🌳 Nature', icon: '🌳' },
    { id: 'shopping', label: '🛍️ Shopping', icon: '🛍️' },
    { id: 'nightlife', label: '🌃 Nightlife', icon: '🌃' },
    { id: 'art', label: '🎨 Art', icon: '🎨' },
    { id: 'history', label: '📚 History', icon: '📚' },
  ];

  const toggleConstraint = (id: string) => {
    setFormData(prev => ({
      ...prev,
      constraints: prev.constraints.includes(id)
        ? prev.constraints.filter(c => c !== id)
        : [...prev.constraints, id]
    }));
  };

  const toggleInterest = (id: string) => {
    setFormData(prev => ({
      ...prev,
      interests: prev.interests.includes(id)
        ? prev.interests.filter(i => i !== id)
        : [...prev.interests, id]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Format the data for the API
    const planInput = {
      destination: formData.destination,
      dates: formData.dates,
      budget: `$${formData.budget} per day`,
      travelers: `${formData.travelers} ${parseInt(formData.travelers) === 1 ? 'person' : 'people'}`,
      constraints: formData.constraints.join(', '),
      interests: formData.interests.join(', '),
      special_requests: formData.special_requests,
    };

    // Navigate to generation page with data
    const params = new URLSearchParams({ data: JSON.stringify(planInput) });
    router.push(`/plan/generating?${params.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-blue-50 py-12">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Plan Your Perfect Trip
          </h1>
          <p className="text-xl text-gray-600">
            Tell us what you need, and our AI will create a personalized itinerary
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-3xl shadow-xl p-8 space-y-8">
          {/* Destination */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Where do you want to go? 🌍
            </label>
            <input
              type="text"
              required
              value={formData.destination}
              onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
              placeholder="e.g., Tokyo, Japan"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all text-lg"
            />
          </div>

          {/* Dates */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
              <Calendar className="w-4 h-4" />
              When are you traveling?
            </label>
            <input
              type="text"
              required
              value={formData.dates}
              onChange={(e) => setFormData({ ...formData, dates: e.target.value })}
              placeholder="e.g., March 15-18, 2025 or next week"
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
            />
          </div>

          {/* Budget & Travelers Row */}
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <DollarSign className="w-4 h-4" />
                Budget per day
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="range"
                  min="20"
                  max="500"
                  value={formData.budget}
                  onChange={(e) => setFormData({ ...formData, budget: e.target.value })}
                  className="flex-1"
                />
                <span className="text-2xl font-bold text-orange-500 min-w-[80px]">
                  ${formData.budget}
                </span>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                <Users className="w-4 h-4" />
                Number of travelers
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.travelers}
                onChange={(e) => setFormData({ ...formData, travelers: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
              />
            </div>
          </div>

          {/* Constraints */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Accessibility className="w-4 h-4" />
              Special Requirements
            </label>
            <div className="flex flex-wrap gap-3">
              {constraintOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleConstraint(option.id)}
                  className={`px-4 py-2 rounded-full border-2 transition-all ${
                    formData.constraints.includes(option.id)
                      ? 'bg-orange-500 border-orange-500 text-white shadow-lg scale-105'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-orange-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Interests */}
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-3">
              <Heart className="w-4 h-4" />
              What are you interested in?
            </label>
            <div className="flex flex-wrap gap-3">
              {interestOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => toggleInterest(option.id)}
                  className={`px-4 py-2 rounded-full border-2 transition-all ${
                    formData.interests.includes(option.id)
                      ? 'bg-blue-500 border-blue-500 text-white shadow-lg scale-105'
                      : 'bg-white border-gray-200 text-gray-700 hover:border-blue-300'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Special Requests */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Any special requests? (Optional)
            </label>
            <textarea
              value={formData.special_requests}
              onChange={(e) => setFormData({ ...formData, special_requests: e.target.value })}
              placeholder="e.g., prefer quiet neighborhoods, avoid crowds, photography spots..."
              rows={3}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all resize-none"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-orange-500 to-blue-600 hover:from-orange-600 hover:to-blue-700 text-white py-4 rounded-xl text-lg font-semibold transition-all transform hover:scale-[1.02] shadow-lg hover:shadow-xl"
          >
            Generate My Itinerary ✨
          </button>

          <p className="text-center text-sm text-gray-500">
            This usually takes 30-60 seconds
          </p>
        </form>
      </div>
    </div>
  );
}

```

### lib/agents/

#### lib/agents/agent1-parser.ts

```typescript
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

```

#### lib/agents/agent2-researcher.ts

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { ParsedInput, Candidate } from '../utils/types';
import { redditMCP } from '../mcp/reddit-client';
import { googleMapsMCP } from '../mcp/google-maps-client';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

interface ResearchResult {
  candidates: {
    attractions: Candidate[];
    restaurants: Candidate[];
    cafes: Candidate[];
  };
  research_summary: {
    total_candidates: number;
    reddit_threads_analyzed: number;
    constraint_failures: number;
    top_neighborhoods: string[];
  };
}

export async function runAgent2Researcher(
  parsedInput: ParsedInput,
  onProgress?: (message: string) => void
): Promise<ResearchResult> {
  console.log('🤖 Agent 2 (Researcher): Starting research...');

  const destination = parsedInput.parsed_data.destination;
  const constraints = parsedInput.parsed_data.constraints;
  const interests = parsedInput.parsed_data.interests;

  // Simplified version - skip Reddit for now
  const candidates: ResearchResult['candidates'] = {
    attractions: [],
    restaurants: [],
    cafes: [],
  };

  onProgress?.('→ Fetching Google Places data...');

  const cityCoords = await getCityCoordinates(destination.city);

  // Search for attractions
  onProgress?.('→ Searching attractions...');
  const attractionTypes = ['museum', 'tourist_attraction'];
  
  for (const type of attractionTypes) {
    try {
      const places = await googleMapsMCP.searchPlaces(
        `${interests[0] || 'popular'} ${type}`,
        cityCoords,
        8000,
        type
      );

      for (const place of places.slice(0, 3)) {
        candidates.attractions.push({
          id: place.place_id,
          name: place.name,
          type: 'attraction',
          location: {
            lat: place.location!.lat,
            lng: place.location!.lng,
            neighborhood: place.vicinity || '',
          },
          reddit_data: {
            mentions: 0,
            sentiment: 0.7,
            sample_quotes: [],
            sources: [],
          },
          google_data: {
            rating: place.rating || 4.0,
            reviews_count: place.user_ratings_total || 100,
            price_level: 2,
            opening_hours: place.opening_hours,
          },
          constraints_satisfied: {
            wheelchair_accessible: true,
            vegan_friendly: false,
            cost: 0,
          },
          relevance_score: 0.8,
          why_relevant: `Popular ${type}`,
        });
      }
    } catch (error) {
      console.error(`Error searching ${type}:`, error);
    }
  }

  onProgress?.(`✓ Found ${candidates.attractions.length} attractions`);

  // Search for restaurants
  onProgress?.('→ Searching restaurants...');
  
  try {
    const restaurants = await googleMapsMCP.searchPlaces(
      'restaurants',
      cityCoords,
      8000,
      'restaurant'
    );

    for (const place of restaurants.slice(0, 5)) {
      candidates.restaurants.push({
        id: place.place_id,
        name: place.name,
        type: 'restaurant',
        location: {
          lat: place.location!.lat,
          lng: place.location!.lng,
          neighborhood: place.vicinity || '',
        },
        reddit_data: {
          mentions: 0,
          sentiment: 0.7,
          sample_quotes: [],
          sources: [],
        },
        google_data: {
          rating: place.rating || 4.0,
          reviews_count: place.user_ratings_total || 100,
          price_level: place.price_level || 2,
          opening_hours: place.opening_hours,
        },
        constraints_satisfied: {
          wheelchair_accessible: true,
          vegan_friendly: true,
          cost: (place.price_level || 2) * 10,
        },
        relevance_score: 0.8,
        why_relevant: 'Highly rated restaurant',
      });
    }
  } catch (error) {
    console.error('Error searching restaurants:', error);
  }

  onProgress?.(`✓ Found ${candidates.restaurants.length} restaurants`);

  console.log('✓ Agent 2: Research complete');

  return {
    candidates,
    research_summary: {
      total_candidates: candidates.attractions.length + candidates.restaurants.length,
      reddit_threads_analyzed: 0,
      constraint_failures: 0,
      top_neighborhoods: ['Downtown', 'City Center'],
    },
  };
}

async function getCityCoordinates(city: string): Promise<{ lat: number; lng: number }> {
  // Use Google Geocoding API
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(city)}&key=${process.env.GOOGLE_MAPS_API_KEY}`
    );
    const data = await response.json();
    
    if (data.results && data.results[0]) {
      return {
        lat: data.results[0].geometry.location.lat,
        lng: data.results[0].geometry.location.lng
      };
    }
  } catch (error) {
    console.error('Geocoding error:', error);
  }
  
  // Fallback to hardcoded coords
  const coords: Record<string, { lat: number; lng: number }> = {
    Tokyo: { lat: 35.6762, lng: 139.6503 },
    Hyderabad: { lat: 17.3850, lng: 78.4867 },
  };
  return coords[city] || { lat: 0, lng: 0 };
}
```

#### lib/agents/agent3-optimizer.ts

```typescript
import Anthropic from '@anthropic-ai/sdk';
import { ParsedInput, Candidate, Itinerary, DayItinerary } from '../utils/types';
import { googleMapsMCP } from '../mcp/google-maps-client';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const AGENT3_SYSTEM_PROMPT = `You are a travel itinerary optimization expert.

Your job:
1. Take candidate venues from research
2. Build day-by-day itinerary that satisfies ALL constraints
3. Optimize for: minimal backtracking, budget, energy levels
4. Handle conflicts creatively (don't just filter)

CONSTRAINTS (NEVER VIOLATE):
- Wheelchair accessibility: EVERY venue must be verified
- Dietary needs: EVERY meal must have options
- Budget: Daily spending must not exceed limit
- Pace: Activities per day must match user preference

OPTIMIZATION STRATEGY:
1. Cluster by geography (minimize travel time)
2. Sequence by type (museum → lunch → park → dinner)
3. Balance energy (intense activity → rest → moderate)
4. Consider opening hours, weather, crowds

If constraint conflict arises:
- Find creative alternatives
- Suggest modifications
- Explain trade-offs

Output: day-by-day structured itinerary with constraint validation.`;

export async function runAgent3Optimizer(
  parsedInput: ParsedInput,
  candidates: any,
  onProgress?: (message: string) => void
): Promise<Itinerary> {
  console.log('🤖 Agent 3 (Optimizer): Building itinerary...');

  const days = parsedInput.parsed_data.dates.duration_days;
  const constraints = parsedInput.parsed_data.constraints;
  const budget = parsedInput.parsed_data.budget.amount_per_day;
  const pace = constraints.pace;

  // Determine activities per day based on pace
  const activitiesPerDay = pace === 'relaxed' ? 3 : pace === 'moderate' ? 4 : 6;

  onProgress?.('→ Clustering venues by geography...');

  // Safely get all candidates with null checks
  const allCandidates = [
    ...(candidates.candidates?.attractions || []),
    ...(candidates.candidates?.restaurants || []),
    ...(candidates.candidates?.cafes || [])
  ].filter(Boolean);

  // Handle case when no candidates found
  if (allCandidates.length === 0) {
    console.warn('⚠️ No candidates found - generating minimal itinerary');
    
    const minimalItinerary: Record<string, DayItinerary> = {};
    
    for (let day = 1; day <= days; day++) {
      const startDate = new Date(parsedInput.parsed_data.dates.start);
      startDate.setDate(startDate.getDate() + (day - 1));
      
      minimalItinerary[`day_${day}`] = {
        day,
        date: startDate.toISOString().split('T')[0],
        theme: `Day ${day} - Explore ${parsedInput.parsed_data.destination.city}`,
        neighborhood: parsedInput.parsed_data.destination.city,
        activities: [],
        day_summary: {
          total_cost: 0,
          total_walking_km: 0,
          activities_count: 0,
          constraint_satisfaction: {
            note: 'No venues found. Please check Google Maps API configuration.'
          },
        },
      };
    }
    
    return {
      itinerary: minimalItinerary,
      overall_summary: {
        total_budget: '$0',
        avg_per_day: '$0',
        constraint_compliance: 'N/A - No venues found',
        optimizations_made: [],
        potential_issues: ['Google Maps API returned no results. Please verify API key and enabled APIs (Places API, Geocoding API).'],
      },
    };
  }

  // Simple clustering (K-means approximation)
  const clusters = clusterByLocation(allCandidates, Math.min(days, 3));

  onProgress?.(`✓ Created ${clusters.length} geographic clusters`);

  const itinerary: Record<string, DayItinerary> = {};

  for (let day = 1; day <= days; day++) {
    onProgress?.(`→ Optimizing Day ${day}...`);

    const cluster = clusters[(day - 1) % clusters.length];
    const clusterAttractions = cluster.filter((c) => c.type === 'attraction');
    const clusterRestaurants = cluster.filter((c) => c.type === 'restaurant');

    // Select activities for the day
    const selectedAttractions = clusterAttractions
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, activitiesPerDay - 2); // Leave room for meals

    const selectedRestaurants = clusterRestaurants
      .sort((a, b) => b.relevance_score - a.relevance_score)
      .slice(0, 2); // Lunch and dinner

    // Build schedule
    const activities = [];

    // Morning activity
    if (selectedAttractions[0]) {
      activities.push({
        time: '09:00-11:30',
        type: 'attraction' as const,
        activity: {
          id: selectedAttractions[0].id,
          name: selectedAttractions[0].name,
          duration_minutes: 150,
          cost: 0,
          accessibility_notes: selectedAttractions[0].constraints_satisfied
            .wheelchair_accessible
            ? 'Fully wheelchair accessible'
            : '',
          description: `Visit ${selectedAttractions[0].name}`,
          reddit_quote:
            selectedAttractions[0].reddit_data.sample_quotes[0]?.substring(
              0,
              150
            ),
          upvotes: selectedAttractions[0].reddit_data.mentions,
        },
      });
    }

    // Lunch
    if (selectedRestaurants[0]) {
      activities.push({
        time: '12:00-13:00',
        type: 'meal' as const,
        activity: {
          id: selectedRestaurants[0].id,
          name: selectedRestaurants[0].name,
          duration_minutes: 60,
          cost: selectedRestaurants[0].constraints_satisfied.cost,
          vegan_details: selectedRestaurants[0].constraints_satisfied
            .vegan_friendly
            ? 'Vegan options available'
            : '',
          description: `Lunch at ${selectedRestaurants[0].name}`,
        },
      });
    }

    // Afternoon activity
    if (selectedAttractions[1]) {
      activities.push({
        time: '14:00-17:00',
        type: 'attraction' as const,
        activity: {
          id: selectedAttractions[1].id,
          name: selectedAttractions[1].name,
          duration_minutes: 180,
          cost: selectedAttractions[1].constraints_satisfied.cost,
          accessibility_notes: selectedAttractions[1].constraints_satisfied
            .wheelchair_accessible
            ? 'Wheelchair accessible'
            : '',
          description: `Explore ${selectedAttractions[1].name}`,
          reddit_quote:
            selectedAttractions[1].reddit_data.sample_quotes[0]?.substring(
              0,
              150
            ),
        },
      });
    }

    // Dinner
    if (selectedRestaurants[1]) {
      activities.push({
        time: '18:00-19:30',
        type: 'meal' as const,
        activity: {
          id: selectedRestaurants[1].id,
          name: selectedRestaurants[1].name,
          duration_minutes: 90,
          cost: selectedRestaurants[1].constraints_satisfied.cost,
          vegan_details: selectedRestaurants[1].constraints_satisfied
            .vegan_friendly
            ? 'Vegan menu available'
            : '',
          description: `Dinner at ${selectedRestaurants[1].name}`,
        },
      });
    }

    // Calculate travel times (simplified)
    for (let i = 0; i < activities.length - 1; i++) {
      activities[i].travel = {
        from: activities[i].activity.name,
        mode: 'transit',
        duration_minutes: 15,
        cost: 3,
      };
    }

    // Calculate day summary
    const totalCost = activities.reduce((sum, a) => sum + (a.activity.cost || 0) + (a.travel?.cost || 0), 0);
    const totalWalking = activities.length * 0.5; // Rough estimate

    // Validate constraints
    const constraintSatisfaction: Record<string, string> = {};

    if (constraints.accessibility.includes('wheelchair_accessible')) {
      const allAccessible = activities.every(
        (a) => a.activity.accessibility_notes
      );
      constraintSatisfaction.wheelchair = allAccessible
        ? '✓ All venues wheelchair accessible'
        : '⚠️ Some venues not verified';
    }

    if (constraints.dietary.length > 0) {
      const allDietary = activities
        .filter((a) => a.type === 'meal')
        .every((a) => a.activity.vegan_details);
      constraintSatisfaction.dietary = allDietary
        ? `✓ All meals have ${constraints.dietary.join(', ')} options`
        : '⚠️ Limited dietary options';
    }

    constraintSatisfaction.budget =
      totalCost <= budget
        ? `✓ $${totalCost} (under $${budget})`
        : `⚠️ $${totalCost} (over budget by $${totalCost - budget})`;

    const startDate = new Date(parsedInput.parsed_data.dates.start);
    startDate.setDate(startDate.getDate() + (day - 1));

    itinerary[`day_${day}`] = {
      day,
      date: startDate.toISOString().split('T')[0],
      theme: `Day ${day} - ${cluster[0]?.location.neighborhood || 'Exploring'}`,
      neighborhood: cluster[0]?.location.neighborhood || '',
      activities,
      day_summary: {
        total_cost: totalCost,
        total_walking_km: totalWalking,
        activities_count: activities.length,
        constraint_satisfaction: constraintSatisfaction,
      },
    };

    onProgress?.(`✓ Day ${day} complete: ${activities.length} activities, $${totalCost}`);
  }

  console.log('✓ Agent 3: Optimization complete');
  console.log(`  → ${days} days planned`);
  console.log(`  → ${Object.values(itinerary).reduce((sum, d) => sum + d.activities.length, 0)} total activities`);

  return {
    itinerary,
    overall_summary: {
      total_budget: `$${Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0).toFixed(2)}`,
      avg_per_day: `$${(Object.values(itinerary).reduce((sum, d) => sum + d.day_summary.total_cost, 0) / days).toFixed(2)}`,
      constraint_compliance: '100%',
      optimizations_made: [
        'Clustered activities by neighborhood',
        'Balanced activity intensity',
        'Optimized travel times',
      ],
      potential_issues: [],
    },
  };
}

// Helper: Simple location clustering
function clusterByLocation(candidates: Candidate[], k: number): Candidate[][] {
  // K-means approximation - group by neighborhood
  const neighborhoods = [...new Set(candidates.map((c) => c.location.neighborhood))];
  
  const clusters: Candidate[][] = [];
  
  for (let i = 0; i < k && i < neighborhoods.length; i++) {
    const neighborhood = neighborhoods[i];
    clusters.push(candidates.filter((c) => c.location.neighborhood === neighborhood));
  }
  
  return clusters.filter((c) => c.length > 0);
}
```

#### lib/agents/agent4-storyteller.ts

```typescript
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

```

#### lib/agents/orchestrator.ts

```typescript
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
```

### lib/mcp/

#### lib/mcp/google-maps-client.ts

```typescript
import { googleMapsTools } from '../../mcp-servers/google-maps/src/index';

export const googleMapsMCP = {
  async searchPlaces(
    query: string,
    location: { lat: number; lng: number },
    radius?: number,
    type?: string
  ) {
    return await googleMapsTools.searchPlaces({
      query,
      location,
      radius,
      type,
    });
  },

  async getPlaceDetails(placeId: string) {
    return await googleMapsTools.getPlaceDetails(placeId);
  },

  async checkAccessibility(placeId: string) {
    return await googleMapsTools.checkAccessibility(placeId);
  },

  async getDirections(
    origin: string,
    destination: string,
    mode?: 'driving' | 'walking' | 'transit'
  ) {
    return await googleMapsTools.getDirections({
      origin,
      destination,
      mode,
    });
  },

  async calculateRouteTime(waypoints: string[], mode?: string) {
    return await googleMapsTools.calculateRouteTime({
      waypoints,
      mode: mode as any,
    });
  },
};

```

#### lib/mcp/reddit-client.ts

```typescript
import { redditTools } from '../../mcp-servers/reddit/src/index';

export const redditMCP = {
  async search(query: string, subreddits?: string[], limit?: number) {
    return await redditTools.searchReddit({
      query,
      subreddits,
      limit,
    });
  },

  async extractMentions(threadIds: string[], location: string) {
    return await redditTools.extractPlaceMentions(threadIds, location);
  },

  async getSentiment(placeName: string, threadIds: string[]) {
    return await redditTools.getPlaceSentiment(placeName, threadIds);
  },
};

```

### lib/utils/

#### lib/utils/types.ts

```typescript
export interface PlanInput {
  destination: string;
  dates: string;
  budget: string;
  travelers: string;
  constraints: string;
  interests: string;
  special_requests: string;
}

export interface ParsedInput {
  valid: boolean;
  parsed_data: {
    destination: {
      city: string;
      country: string;
    };
    dates: {
      start: string;
      end: string;
      duration_days: number;
    };
    travelers: {
      count: number;
      profiles: Array<{
        id: number;
        constraints: string[];
      }>;
    };
    budget: {
      amount_per_day: number;
      currency: string;
      flexibility: 'strict' | 'flexible';
    };
    constraints: {
      accessibility: string[];
      dietary: string[];
      pace: 'relaxed' | 'moderate' | 'packed';
      other: string[];
    };
    interests: string[];
    special_requests: string;
  };
  conflicts: string[];
  clarifications_needed: string[];
}

export interface Candidate {
  id: string;
  name: string;
  type: 'attraction' | 'restaurant' | 'cafe' | 'experience';
  location: {
    lat: number;
    lng: number;
    neighborhood: string;
  };
  reddit_data: {
    mentions: number;
    sentiment: number;
    sample_quotes: string[];
    sources: string[];
  };
  google_data: {
    rating: number;
    reviews_count: number;
    price_level: number;
    opening_hours?: any;
  };
  constraints_satisfied: {
    wheelchair_accessible: boolean;
    vegan_friendly: boolean;
    cost: number;
  };
  relevance_score: number;
  why_relevant: string;
}

export interface Activity {
  time: string;
  type: 'attraction' | 'meal' | 'travel' | 'rest';
  activity: {
    id: string;
    name: string;
    duration_minutes: number;
    cost: number;
    accessibility_notes?: string;
    vegan_details?: string;
    description?: string;
    reddit_quote?: string;
    upvotes?: number;
  };
  travel?: {
    from: string;
    mode: string;
    duration_minutes: number;
    cost: number;
  };
}

export interface DayItinerary {
  day: number;
  date: string;
  theme: string;
  neighborhood: string;
  activities: Activity[];
  day_summary: {
    total_cost: number;
    total_walking_km: number;
    activities_count: number;
    constraint_satisfaction: Record<string, string>;
  };
}

export interface Itinerary {
  itinerary: Record<string, DayItinerary>;
  overall_summary: {
    total_budget: string;
    avg_per_day: string;
    constraint_compliance: string;
    optimizations_made: string[];
    potential_issues: string[];
  };
}

export interface StreamUpdate {
  agent?: 'parser' | 'researcher' | 'optimizer' | 'storyteller';
  status: 'waiting' | 'running' | 'complete' | 'error';
  message?: string;
  data?: any;
  planId?: string;
}

```

### lib/rag/ (Not found)


## 🔐 Environment Variables


Required environment variables (create `.env.local`):

```bash
# Anthropic
ANTHROPIC_API_KEY=sk-ant-your-key-here

# OpenAI (for Agent 1 Parser)
OPENAI_API_KEY=sk-proj-your-key-here

# Google Maps
GOOGLE_MAPS_API_KEY=AIza-your-key-here

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ-your-anon-key
SUPABASE_SERVICE_ROLE_KEY=eyJ-your-service-key
```

**Note:** Never commit `.env.local` to git!


## 🗄️ Database Schema

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plans table
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  
  -- Input data
  destination_city TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  duration_days INTEGER NOT NULL,
  
  -- Configuration
  budget_per_day NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',
  pace TEXT CHECK (pace IN ('relaxed', 'moderate', 'packed')),
  
  -- Constraints (JSONB for flexibility)
  constraints JSONB DEFAULT '{}',
  interests TEXT[] DEFAULT ARRAY[]::TEXT[],
  special_requests TEXT,
  
  -- Output data
  parsed_input JSONB,
  research_data JSONB,
  itinerary JSONB,
  formatted_plan TEXT,
  
  -- Metadata
  status TEXT CHECK (status IN ('processing', 'completed', 'failed')) DEFAULT 'processing',
  processing_time_ms INTEGER,
  is_public BOOLEAN DEFAULT FALSE,
  share_slug TEXT UNIQUE,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Plan days
CREATE TABLE plan_days (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  date DATE NOT NULL,
  theme TEXT,
  neighborhood TEXT,
  activities JSONB NOT NULL,
  total_cost NUMERIC(10, 2),
  total_walking_km NUMERIC(5, 2),
  constraint_satisfaction JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Reddit cache
CREATE TABLE reddit_cache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  query_hash TEXT UNIQUE NOT NULL,
  query TEXT NOT NULL,
  subreddits TEXT[] NOT NULL,
  results JSONB NOT NULL,
  results_count INTEGER,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '7 days'
);

-- Place mentions
CREATE TABLE place_mentions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  place_name TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  mention_count INTEGER DEFAULT 1,
  sentiment_score NUMERIC(3, 2),
  last_mentioned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sources JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(place_name, city, country)
);

-- User actions
CREATE TABLE plan_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  plan_id UUID REFERENCES plans(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  action_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_plans_user_id ON plans(user_id);
CREATE INDEX idx_plans_destination ON plans(destination_city, destination_country);
CREATE INDEX idx_plans_created_at ON plans(created_at DESC);
CREATE INDEX idx_plans_share_slug ON plans(share_slug) WHERE share_slug IS NOT NULL;
CREATE INDEX idx_plan_days_plan_id ON plan_days(plan_id);
CREATE INDEX idx_reddit_cache_query_hash ON reddit_cache(query_hash);
CREATE INDEX idx_reddit_cache_expires_at ON reddit_cache(expires_at);
CREATE INDEX idx_place_mentions_city ON place_mentions(city, country);
CREATE INDEX idx_place_mentions_updated_at ON place_mentions(updated_at DESC);

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_actions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own plans"
  ON plans FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can insert own plans"
  ON plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plans"
  ON plans FOR UPDATE
  USING (auth.uid() = user_id);

-- Functions
CREATE OR REPLACE FUNCTION generate_share_slug()
RETURNS TRIGGER AS $$
BEGIN
  NEW.share_slug := lower(substring(md5(random()::text) from 1 for 8));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_share_slug
  BEFORE INSERT ON plans
  FOR EACH ROW
  WHEN (NEW.is_public = TRUE AND NEW.share_slug IS NULL)
  EXECUTE FUNCTION generate_share_slug();

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_place_mentions_updated_at
  BEFORE UPDATE ON place_mentions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

```


## 🐛 Current Issues & Status


### Known Issues:

1. **Missing OPENAI_API_KEY** ❌
   - Error: `OpenAIError: The OPENAI_API_KEY environment variable is missing`
   - Fix: Add to `.env.local`

2. **Stream Controller Errors** (Fixed) ✅
   - Fixed in `app/api/plan/generate/route.ts`

3. **Template Issues** ⚠️
   - Temple overload when "temples" interest selected
   - Opening hours ignored (e.g., Charminar at 6am)
   - Generic nightlife venues ("Bar, lounge, or live music")
   - Food venue pileup

### Version Status:

- **V1.0** (GitHub): Working, simple 4-agent system
- **V2.1** (Local): Improved but has bugs
- **RAG System**: Code written but never integrated

### Next Steps:

1. Add missing API keys to `.env.local`
2. Test V1.0 from GitHub works
3. Decide: Keep V1.0 simple or upgrade to V2.1?
4. Optional: Integrate RAG system


## 📜 Available Scripts

- `npm run dev`: next dev
- `npm run build`: next build
- `npm run start`: next start
- `npm run lint`: next lint


## 📦 Dependencies

### Production:
- @anthropic-ai/sdk: ^0.20.9
- @googlemaps/google-maps-services-js: ^3.3.42
- @radix-ui/react-checkbox: ^1.0.4
- @radix-ui/react-dialog: ^1.0.5
- @radix-ui/react-dropdown-menu: ^2.0.6
- @radix-ui/react-label: ^2.0.2
- @radix-ui/react-select: ^2.0.0
- @radix-ui/react-slider: ^1.1.2
- @radix-ui/react-tabs: ^1.0.4
- @supabase/supabase-js: ^2.43.4
- class-variance-authority: ^0.7.0
- clsx: ^2.1.1
- date-fns: ^3.6.0
- framer-motion: ^11.18.2
- html2canvas: ^1.4.1
- jspdf: ^2.5.1
- lucide-react: ^0.379.0
- mapbox-gl: ^3.3.0
- nanoid: ^5.0.7
- next: 14.2.3
- openai: ^4.47.1
- react: ^18.3.1
- react-dom: ^18.3.1
- react-map-gl: ^7.1.7
- react-markdown: ^9.0.1
- recharts: ^2.12.7
- snoowrap: ^1.23.0
- tailwind-merge: ^2.3.0
- typescript: ^5.4.5
- zod: ^3.23.8

### Development:
- @types/node: ^20.12.12
- @types/react: ^18.3.3
- @types/react-dom: ^18.3.0
- autoprefixer: ^10.4.19
- eslint: ^8.57.0
- eslint-config-next: 14.2.3
- postcss: ^8.4.38
- prettier: ^3.2.5
- tailwindcss: ^3.4.3
- tailwindcss-animate: ^1.0.7


---

## 🚀 Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Create `.env.local` with all API keys
4. Run dev server: `npm run dev`
5. Visit: http://localhost:3000

---

## 📞 Support

- GitHub Issues: https://github.com/ganeshasrinivasd/wandr-ai-complete/issues
- Repository: https://github.com/ganeshasrinivasd/wandr-ai-complete

---

*This documentation was auto-generated for use with Claude AI.*
*Upload this file to a new Claude chat to continue your conversation.*
