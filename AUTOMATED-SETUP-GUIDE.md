# 🚀 Automated Setup Instructions

## 📍 Where to Place the Markdown Files

Place these 3 files in the **same directory** as your `package.json`:

```
wandr-ai-complete/                    ← You are here
├── package.json                      ← Already here
├── setup-automated.py                ← Download this
├── wandr-ai-setup.md                 ← Place here ⬅️
├── mcp-servers-implementation.md     ← Place here ⬅️
├── agents-implementation.md          ← Place here ⬅️
├── app/
├── lib/
└── ...
```

---

## 📥 Step-by-Step Instructions

### Step 1: Download Files
Download these 4 files:
1. **setup-automated.py** (the automation script)
2. **wandr-ai-setup.md**
3. **mcp-servers-implementation.md**
4. **agents-implementation.md**

### Step 2: Move Files to Project Root
```bash
# You should be in: wandr-ai-complete/
pwd  # Should show: /path/to/wandr-ai-complete

# Move the downloaded files here
mv ~/Downloads/setup-automated.py .
mv ~/Downloads/wandr-ai-setup.md .
mv ~/Downloads/mcp-servers-implementation.md .
mv ~/Downloads/agents-implementation.md .

# Verify files are here
ls *.md *.py
```

You should see:
```
setup-automated.py
wandr-ai-setup.md
mcp-servers-implementation.md
agents-implementation.md
```

### Step 3: Run the Automation Script
```bash
# Make it executable
chmod +x setup-automated.py

# Run it
python3 setup-automated.py
```

The script will:
- ✅ Check all 3 markdown files are present
- ✅ Extract all code blocks
- ✅ Create all files in correct locations
- ✅ Show you next steps

### Step 4: Install Dependencies
```bash
# Install root dependencies
npm install

# Install MCP server dependencies
cd mcp-servers/reddit
npm install
cd ../..

cd mcp-servers/google-maps
npm install
cd ../..
```

### Step 5: Setup Environment
```bash
# Create .env.local
cp .env.local.example .env.local

# Edit with your API keys
nano .env.local
# or
code .env.local
```

### Step 6: Setup Supabase Database
1. Go to https://supabase.com
2. Create new project
3. Go to SQL Editor
4. Open `supabase/migrations/001_initial_schema.sql`
5. Copy the SQL and run it
6. Go to Settings → API
7. Copy URL and keys to `.env.local`

### Step 7: Run!
```bash
npm run dev
```

Open http://localhost:3000

---

## 🎯 Quick Visual Guide

```
Your Downloads folder:
├── setup-automated.py
├── wandr-ai-setup.md
├── mcp-servers-implementation.md
└── agents-implementation.md

                ↓ MOVE TO ↓

wandr-ai-complete/ (project root):
├── setup-automated.py          ← HERE
├── wandr-ai-setup.md          ← HERE
├── mcp-servers-implementation.md  ← HERE
├── agents-implementation.md    ← HERE
├── package.json
├── app/
├── lib/
└── mcp-servers/
```

Then run: `python3 setup-automated.py`

---

## 🔍 Troubleshooting

### "No such file or directory: wandr-ai-setup.md"
**Solution:** The markdown files are not in the same directory as the script.
```bash
# Check where you are
pwd

# List files
ls *.md

# Should see all 3 markdown files
```

### "python3: command not found"
**Solution:** Use `python` instead:
```bash
python setup-automated.py
```

### Script runs but some files not created
**Solution:** Check the markdown files have the code blocks. The script looks for specific patterns like:
```
### `filename.ts`
```typescript
code here
```
```

---

## ✅ Success Checklist

After running the script, verify these files exist:

```bash
# Check core files
ls lib/utils/types.ts
ls lib/supabase/client.ts
ls lib/supabase/server.ts

# Check agents
ls lib/agents/agent1-parser.ts
ls lib/agents/agent2-researcher.ts
ls lib/agents/agent3-optimizer.ts
ls lib/agents/agent4-storyteller.ts
ls lib/agents/orchestrator.ts

# Check MCP servers
ls mcp-servers/reddit/src/index.ts
ls mcp-servers/google-maps/src/index.ts
ls lib/mcp/reddit-client.ts
ls lib/mcp/google-maps-client.ts

# Check database
ls supabase/migrations/001_initial_schema.sql
```

If all files exist: ✅ **You're ready to go!**

---

## 🚀 Final Steps Summary

1. ✅ Download 4 files (script + 3 markdown files)
2. ✅ Move them to `wandr-ai-complete/` directory
3. ✅ Run: `python3 setup-automated.py`
4. ✅ Run: `npm install` (3 times: root + 2 MCP servers)
5. ✅ Create `.env.local` with API keys
6. ✅ Setup Supabase and run SQL migration
7. ✅ Run: `npm run dev`
8. 🎉 Open http://localhost:3000

You're done! 🎊
