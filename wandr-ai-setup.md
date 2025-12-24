# Wandr AI - Complete Project Setup

This document contains all the files needed to initialize the project. Follow the structure below.

## Step 1: Create Project Directory

```bash
mkdir wandr-ai
cd wandr-ai
```

## Step 2: Initialize Next.js Project

```bash
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
```

When prompted:
- ✔ Would you like to use ESLint? → Yes
- ✔ Would you like to use Turbopack? → No
- ✔ Would you like to customize the default import alias? → No

## Step 3: Install Dependencies

```bash
npm install @supabase/supabase-js openai @anthropic-ai/sdk @googlemaps/google-maps-services-js snoowrap framer-motion lucide-react recharts react-markdown mapbox-gl react-map-gl @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-slider @radix-ui/react-tabs @radix-ui/react-select @radix-ui/react-checkbox @radix-ui/react-label class-variance-authority clsx tailwind-merge jspdf html2canvas zod date-fns nanoid

npm install -D tailwindcss-animate
```

## Step 4: Project Structure

Create this directory structure:

```
wandr-ai/
├── app/
│   ├── layout.tsx (modify existing)
│   ├── page.tsx (modify existing)
│   ├── globals.css (modify existing)
│   ├── planner/
│   │   └── page.tsx
│   ├── plan/
│   │   └── [id]/
│   │       ├── page.tsx
│   │       └── generating/
│   │           └── page.tsx
│   └── api/
│       └── plan/
│           ├── generate/
│           │   └── route.ts
│           └── [id]/
│               ├── route.ts
│               └── refine/
│                   └── route.ts
├── lib/
│   ├── agents/
│   │   ├── agent1-parser.ts
│   │   ├── agent2-researcher.ts
│   │   ├── agent3-optimizer.ts
│   │   ├── agent4-storyteller.ts
│   │   └── orchestrator.ts
│   ├── mcp/
│   │   ├── reddit-client.ts
│   │   └── google-maps-client.ts
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils/
│       ├── types.ts
│       ├── constraints.ts
│       └── validation.ts
├── components/
│   ├── ui/ (shadcn components - install as needed)
│   ├── landing/
│   ├── planner/
│   └── results/
├── mcp-servers/
│   ├── reddit/
│   │   ├── package.json
│   │   └── src/
│   │       └── index.ts
│   └── google-maps/
│       ├── package.json
│       └── src/
│           └── index.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── public/
├── .env.local
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

## FILE CONTENTS

### Root Files

#### `.env.local`
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Anthropic (for Claude)
ANTHROPIC_API_KEY=sk-ant-...

# Google Maps
GOOGLE_MAPS_API_KEY=AIza...

# Reddit
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
REDDIT_USERNAME=...
REDDIT_PASSWORD=...

# Mapbox
NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

#### `next.config.js`
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: [
      'maps.googleapis.com',
      'lh3.googleusercontent.com',
      'external-content.duckduckgo.com',
    ],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
};

module.exports = nextConfig;
```

#### `tailwind.config.ts`
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#FF6B35",
          foreground: "#ffffff",
          50: "#FFF4F0",
          100: "#FFE9E0",
          200: "#FFD3C2",
          300: "#FFBCA3",
          400: "#FFA685",
          500: "#FF6B35",
          600: "#E65A2B",
          700: "#CC4A21",
          800: "#B33918",
          900: "#99290E",
        },
        secondary: {
          DEFAULT: "#004E89",
          foreground: "#ffffff",
          50: "#E6F2FF",
          100: "#CCE5FF",
          200: "#99CBFF",
          300: "#66B0FF",
          400: "#3396FF",
          500: "#004E89",
          600: "#003D6B",
          700: "#002C4D",
          800: "#001B2F",
          900: "#000A11",
        },
        accent: {
          DEFAULT: "#FFD23F",
          foreground: "#000000",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        destructive: {
          DEFAULT: "#EF4444",
          foreground: "#ffffff",
        },
        success: {
          DEFAULT: "#10B981",
          foreground: "#ffffff",
        },
        warning: {
          DEFAULT: "#F59E0B",
          foreground: "#000000",
        },
        info: {
          DEFAULT: "#3B82F6",
          foreground: "#ffffff",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        pulse: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-1000px 0" },
          "100%": { backgroundPosition: "1000px 0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
        pulse: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        shimmer: "shimmer 2s linear infinite",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        heading: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
```

---

### App Files

#### `app/layout.tsx`
```typescript
import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Wandr - AI Travel Planner That Solves Impossible Constraints",
  description:
    "Plan wheelchair-accessible vegan trips with AI that actually understands your constraints. Built with 4 specialized agents and Reddit-verified recommendations.",
  keywords: [
    "travel planner",
    "AI travel",
    "wheelchair accessible travel",
    "vegan travel",
    "constraint-based planning",
    "Reddit recommendations",
  ],
  authors: [{ name: "Wandr Team" }],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://wandr.ai",
    title: "Wandr - AI Travel Planner",
    description: "AI that solves impossible travel plans",
    siteName: "Wandr",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wandr - AI Travel Planner",
    description: "AI that solves impossible travel plans",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jakarta.variable}`}>
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
```

#### `app/globals.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96.1%;
    --secondary-foreground: 222.2 47.4% 11.2%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96.1%;
    --accent-foreground: 222.2 47.4% 11.2%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 210 40% 98%;
    --primary-foreground: 222.2 47.4% 11.2%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 212.7 26.8% 83.9%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  @apply bg-gray-100;
}

::-webkit-scrollbar-thumb {
  @apply bg-gray-300 rounded-full;
}

::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-400;
}

/* Animations */
@keyframes shimmer {
  0% {
    background-position: -1000px 0;
  }
  100% {
    background-position: 1000px 0;
  }
}

.animate-shimmer {
  animation: shimmer 2s linear infinite;
  background: linear-gradient(
    to right,
    #f6f7f8 0%,
    #edeef1 20%,
    #f6f7f8 40%,
    #f6f7f8 100%
  );
  background-size: 1000px 100%;
}

/* Map styles */
.mapboxgl-popup-content {
  @apply rounded-lg shadow-lg p-4;
}

.mapboxgl-popup-close-button {
  @apply text-gray-500 hover:text-gray-700;
}
```

---

### Lib Files

#### `lib/utils/types.ts`
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

#### `lib/supabase/client.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### `lib/supabase/server.ts`
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
```

---

### Database Files

#### `supabase/migrations/001_initial_schema.sql`
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

---

## Next Steps

1. **Set up Supabase:**
   - Go to https://supabase.com
   - Create new project
   - Copy connection details to `.env.local`
   - Run the migration SQL in SQL Editor

2. **Get API Keys:**
   - OpenAI: https://platform.openai.com/api-keys
   - Anthropic: https://console.anthropic.com
   - Google Maps: https://console.cloud.google.com
   - Reddit: https://www.reddit.com/prefs/apps
   - Mapbox: https://account.mapbox.com

3. **Run the project:**
   ```bash
   npm run dev
   ```

4. **Ready for next phase:**
   - MCP Server implementations
   - Agent implementations
   - UI components
   - API routes

---

This completes the initial project setup. All foundational files are ready!
