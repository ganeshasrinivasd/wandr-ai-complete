# 🚀 Wandr AI - Setup Instructions

## What You Have

This folder contains the complete project structure with:
- ✅ All directories created
- ✅ Configuration files (package.json, tsconfig.json, etc.)
- ✅ Folder structure ready

## What You Need to Add

You downloaded 3 implementation files separately. Now copy the code from those files:

### 1. From `wandr-ai-setup.md`:
Copy these files:
- `app/layout.tsx` → (already has template code)
- `app/globals.css` → (already has template code)
- `lib/supabase/client.ts`
- `lib/supabase/server.ts`
- `lib/utils/types.ts`
- `supabase/migrations/001_initial_schema.sql`

### 2. From `mcp-servers-implementation.md`:
Copy these files:
- `mcp-servers/reddit/package.json`
- `mcp-servers/reddit/tsconfig.json`
- `mcp-servers/reddit/src/index.ts`
- `mcp-servers/google-maps/package.json`
- `mcp-servers/google-maps/tsconfig.json`
- `mcp-servers/google-maps/src/index.ts`
- `lib/mcp/reddit-client.ts`
- `lib/mcp/google-maps-client.ts`

### 3. From `agents-implementation.md`:
Copy these files:
- `lib/agents/agent1-parser.ts`
- `lib/agents/agent2-researcher.ts`
- `lib/agents/agent3-optimizer.ts`
- `lib/agents/agent4-storyteller.ts`
- `lib/agents/orchestrator.ts`

## Installation Steps

1. **Copy all code files** from the 3 markdown documents into the locations listed above

2. **Install root dependencies:**
```bash
npm install
```

3. **Install MCP server dependencies:**
```bash
cd mcp-servers/reddit && npm install && cd ../..
cd mcp-servers/google-maps && npm install && cd ../..
```

4. **Create .env.local:**
```bash
cp .env.local.example .env.local
# Edit with your API keys
```

5. **Setup Supabase:**
- Go to https://supabase.com
- Create new project
- Run SQL from `supabase/migrations/001_initial_schema.sql`
- Copy credentials to `.env.local`

6. **Run the project:**
```bash
npm run dev
```

7. **Open browser:**
```
http://localhost:3000
```

## Folder Structure

```
wandr-ai/
├── app/                    ← Next.js pages
│   ├── layout.tsx         ✅ Created
│   ├── page.tsx           ✅ Created
│   ├── globals.css        ✅ Created
│   ├── planner/           📁 Ready for code
│   ├── plan/[id]/         📁 Ready for code
│   └── api/plan/          📁 Ready for API routes
├── lib/                    
│   ├── agents/            📁 Copy agent files here
│   ├── mcp/               📁 Copy MCP wrappers here
│   ├── supabase/          📁 Copy Supabase clients here
│   └── utils/             📁 Copy types here
├── mcp-servers/
│   ├── reddit/            📁 Copy Reddit MCP here
│   └── google-maps/       📁 Copy Google Maps MCP here
├── supabase/
│   └── migrations/        📁 Copy SQL here
├── package.json           ✅ Created
├── next.config.js         ✅ Created
├── tailwind.config.ts     ✅ Created
├── tsconfig.json          ✅ Created
└── .env.local.example     ✅ Created
```

## Quick Copy Guide

Open the 3 markdown files and copy code blocks into these files:

**File 1: wandr-ai-setup.md**
- Section "app/layout.tsx" → `app/layout.tsx`
- Section "app/globals.css" → `app/globals.css`  
- Section "lib/utils/types.ts" → `lib/utils/types.ts`
- Section "lib/supabase/client.ts" → `lib/supabase/client.ts`
- Section "lib/supabase/server.ts" → `lib/supabase/server.ts`
- Section "001_initial_schema.sql" → `supabase/migrations/001_initial_schema.sql`

**File 2: mcp-servers-implementation.md**
- Section "mcp-servers/reddit/package.json" → `mcp-servers/reddit/package.json`
- Section "mcp-servers/reddit/src/index.ts" → `mcp-servers/reddit/src/index.ts`
- (same for google-maps)
- Section "lib/mcp/reddit-client.ts" → `lib/mcp/reddit-client.ts`
- Section "lib/mcp/google-maps-client.ts" → `lib/mcp/google-maps-client.ts`

**File 3: agents-implementation.md**
- Section "lib/agents/agent1-parser.ts" → `lib/agents/agent1-parser.ts`
- Section "lib/agents/agent2-researcher.ts" → `lib/agents/agent2-researcher.ts`
- Section "lib/agents/agent3-optimizer.ts" → `lib/agents/agent3-optimizer.ts`
- Section "lib/agents/agent4-storyteller.ts" → `lib/agents/agent4-storyteller.ts`
- Section "lib/agents/orchestrator.ts" → `lib/agents/orchestrator.ts`

## Troubleshooting

**"Module not found"**
- Make sure you copied ALL files from the markdown documents
- Run `npm install` in root and both MCP server directories

**"Cannot find module '@/lib/...'"**
- Check that files are in the correct locations
- Make sure file names match exactly (including .ts extension)

**"Invalid API key"**
- Check `.env.local` has all keys filled in
- Restart dev server after changing env vars

## Next Steps

Once setup is complete and `npm run dev` works:
1. ✅ Project runs
2. 🎨 We'll add API routes
3. 🌟 We'll build beautiful UI
4. 🚀 We'll add streaming & maps

## Need Help?

If stuck, check:
1. Are all files copied from the 3 markdown documents?
2. Did you run `npm install` in all 3 locations?
3. Is `.env.local` created with API keys?
4. Did you run the Supabase SQL migration?

Ready when you are! 🎉
