#!/bin/bash

# Wandr AI - Complete Project Generator
# This script creates the entire project structure with all files

set -e

PROJECT_NAME="wandr-ai"

echo "🚀 Creating Wandr AI Project..."
echo ""

# Create project directory
mkdir -p $PROJECT_NAME
cd $PROJECT_NAME

echo "📁 Creating directory structure..."

# Create all directories
mkdir -p app/{api/plan/{generate,\[id\]/refine},planner,plan/\[id\]/generating}
mkdir -p lib/{agents,mcp,supabase,utils}
mkdir -p components/ui
mkdir -p mcp-servers/{reddit/src,google-maps/src}
mkdir -p supabase/migrations
mkdir -p public

echo "✓ Directory structure created"
echo ""

echo "📝 Creating configuration files..."

# Create README
cat > README.md << 'EOF'
# Wandr AI - Multi-Agent Travel Planner

AI-powered travel planner with 4 specialized agents that solves complex constraints.

## Features
- 🤖 4 AI Agents (Parser, Researcher, Optimizer, Storyteller)
- 🔍 Reddit-verified recommendations
- ♿ Perfect constraint handling (wheelchair, dietary, budget)
- 🗺️ Interactive maps
- 📊 Real-time agent streaming

## Quick Start

1. **Install dependencies:**
```bash
npm install
cd mcp-servers/reddit && npm install && cd ../..
cd mcp-servers/google-maps && npm install && cd ../..
```

2. **Setup environment:**
```bash
cp .env.local.example .env.local
# Edit .env.local with your API keys
```

3. **Setup Supabase:**
- Create project at https://supabase.com
- Run SQL in `supabase/migrations/001_initial_schema.sql`
- Copy URL and keys to .env.local

4. **Run:**
```bash
npm run dev
```

5. **Open:** http://localhost:3000

## API Keys Needed
- OpenAI (https://platform.openai.com)
- Anthropic (https://console.anthropic.com)
- Google Maps (https://console.cloud.google.com)
- Reddit (https://www.reddit.com/prefs/apps)
- Mapbox (https://account.mapbox.com)
- Supabase (https://supabase.com)

## Project Structure
- `app/` - Next.js pages and API routes
- `lib/agents/` - 4 AI agents
- `lib/mcp/` - MCP client wrappers
- `mcp-servers/` - Reddit & Google Maps MCP servers
- `components/` - React components
- `supabase/` - Database migrations

## Tech Stack
- Next.js 14 (App Router)
- TypeScript
- Tailwind CSS
- OpenAI GPT-4
- Anthropic Claude
- Supabase (PostgreSQL)
- Google Maps API
- Reddit API

## License
MIT
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
node_modules/
/.next/
/out/
.env*.local
.DS_Store
*.pem
npm-debug.log*
yarn-debug.log*
yarn-error.log*
mcp-servers/**/node_modules
mcp-servers/**/dist
*.tsbuildinfo
next-env.d.ts
EOF

# Create .env.local.example
cat > .env.local.example << 'EOF'
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# OpenAI
OPENAI_API_KEY=sk-proj-...

# Anthropic
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

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF

echo "✓ Configuration files created"
echo ""

echo "📦 All files created successfully!"
echo ""
echo "📋 Next steps:"
echo "1. cd $PROJECT_NAME"
echo "2. Download the 3 implementation files (setup, mcp-servers, agents)"
echo "3. Copy code from those files into the appropriate locations"
echo "4. Run: npm install"
echo "5. Create .env.local with your API keys"
echo "6. Run: npm run dev"
echo ""
echo "🎉 Project structure is ready!"
EOF

chmod +x install.sh
echo "✓ Installation script created"
