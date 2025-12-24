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
