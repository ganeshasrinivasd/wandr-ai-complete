#!/usr/bin/env python3

"""
Wandr AI - Automated Setup Script
Extracts code from markdown files and creates all project files automatically
"""

import os
import re
import sys

def extract_code_blocks(markdown_content, language=None):
    """Extract code blocks from markdown content"""
    # Pattern to match code blocks with optional language
    if language:
        pattern = rf'```{language}\n(.*?)```'
    else:
        pattern = r'```[\w]*\n(.*?)```'
    
    blocks = re.findall(pattern, markdown_content, re.DOTALL)
    return blocks

def extract_labeled_code_blocks(markdown_content):
    """Extract code blocks with their file labels"""
    blocks = {}
    
    # Pattern: #### `filename` or ### `filename`
    pattern = r'####?\s+`([^`]+)`\s*\n```[\w]*\n(.*?)```'
    matches = re.findall(pattern, markdown_content, re.DOTALL)
    
    for filename, code in matches:
        blocks[filename] = code
    
    return blocks

def create_file(filepath, content):
    """Create a file with the given content"""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)
    with open(filepath, 'w') as f:
        f.write(content)
    print(f"✓ Created: {filepath}")

def setup_from_markdowns():
    """Main setup function"""
    
    print("🚀 Wandr AI - Automated Setup\n")
    
    # Check if markdown files exist
    md_files = {
        'setup': 'wandr-ai-setup.md',
        'mcp': 'mcp-servers-implementation.md',
        'agents': 'agents-implementation.md'
    }
    
    missing = []
    for name, filename in md_files.items():
        if not os.path.exists(filename):
            missing.append(filename)
    
    if missing:
        print("❌ Missing markdown files:")
        for f in missing:
            print(f"   - {f}")
        print("\n📥 Please place the 3 markdown files in this directory:")
        print(f"   {os.getcwd()}\n")
        sys.exit(1)
    
    print("✓ All markdown files found\n")
    
    # Read all markdown files
    print("📖 Reading markdown files...")
    with open('wandr-ai-setup.md', 'r') as f:
        setup_md = f.read()
    with open('mcp-servers-implementation.md', 'r') as f:
        mcp_md = f.read()
    with open('agents-implementation.md', 'r') as f:
        agents_md = f.read()
    
    print("✓ Files read\n")
    
    # Extract and create files
    print("📝 Creating project files...\n")
    
    # ==================== lib/utils/types.ts ====================
    types_match = re.search(r'#### `lib/utils/types\.ts`\s*\n```typescript\n(.*?)```', setup_md, re.DOTALL)
    if types_match:
        create_file('lib/utils/types.ts', types_match.group(1))
    
    # ==================== lib/supabase files ====================
    supabase_client = re.search(r'#### `lib/supabase/client\.ts`\s*\n```typescript\n(.*?)```', setup_md, re.DOTALL)
    if supabase_client:
        create_file('lib/supabase/client.ts', supabase_client.group(1))
    
    supabase_server = re.search(r'#### `lib/supabase/server\.ts`\s*\n```typescript\n(.*?)```', setup_md, re.DOTALL)
    if supabase_server:
        create_file('lib/supabase/server.ts', supabase_server.group(1))
    
    # ==================== Database migration ====================
    sql_match = re.search(r'#### `supabase/migrations/001_initial_schema\.sql`\s*\n```sql\n(.*?)```', setup_md, re.DOTALL)
    if sql_match:
        create_file('supabase/migrations/001_initial_schema.sql', sql_match.group(1))
    
    # ==================== MCP Servers ====================
    print("\n📦 Creating MCP servers...\n")
    
    # Reddit MCP - package.json
    reddit_pkg = re.search(r'#### `package\.json`\s*\n```json\n(.*?)```', mcp_md, re.DOTALL)
    if reddit_pkg:
        create_file('mcp-servers/reddit/package.json', reddit_pkg.group(1))
    
    # Reddit MCP - tsconfig.json
    reddit_ts = re.search(r'#### `tsconfig\.json`\s*\n```json\n(.*?)```', mcp_md, re.DOTALL)
    if reddit_ts:
        create_file('mcp-servers/reddit/tsconfig.json', reddit_ts.group(1))
    
    # Reddit MCP - src/index.ts
    reddit_src = re.search(r'#### `src/index\.ts`\s*\n```typescript\n(.*?)```', mcp_md, re.DOTALL)
    if reddit_src:
        create_file('mcp-servers/reddit/src/index.ts', reddit_src.group(1))
    
    # Google Maps MCP - use same patterns
    # Find the second occurrence for google-maps
    all_pkg = re.findall(r'#### `package\.json`\s*\n```json\n(.*?)```', mcp_md, re.DOTALL)
    if len(all_pkg) > 1:
        create_file('mcp-servers/google-maps/package.json', all_pkg[1])
    
    all_tsconfig = re.findall(r'#### `tsconfig\.json`\s*\n```json\n(.*?)```', mcp_md, re.DOTALL)
    if len(all_tsconfig) > 1:
        create_file('mcp-servers/google-maps/tsconfig.json', all_tsconfig[1])
    
    gmaps_src = re.search(r'### `lib/mcp/google-maps-client\.ts`.*?```typescript\n(.*?)```', mcp_md, re.DOTALL)
    # Actually, let me find Google Maps src/index.ts properly
    sections = mcp_md.split('## Google Maps MCP Server')
    if len(sections) > 1:
        gmaps_section = sections[1]
        gmaps_index = re.search(r'#### `src/index\.ts`\s*\n```typescript\n(.*?)```', gmaps_section, re.DOTALL)
        if gmaps_index:
            create_file('mcp-servers/google-maps/src/index.ts', gmaps_index.group(1))
    
    # MCP client wrappers
    reddit_client = re.search(r'### `lib/mcp/reddit-client\.ts`\s*\n```typescript\n(.*?)```', mcp_md, re.DOTALL)
    if reddit_client:
        create_file('lib/mcp/reddit-client.ts', reddit_client.group(1))
    
    gmaps_client = re.search(r'### `lib/mcp/google-maps-client\.ts`\s*\n```typescript\n(.*?)```', mcp_md, re.DOTALL)
    if gmaps_client:
        create_file('lib/mcp/google-maps-client.ts', gmaps_client.group(1))
    
    # ==================== AI Agents ====================
    print("\n🤖 Creating AI agents...\n")
    
    # Agent 1
    agent1 = re.search(r'### `lib/agents/agent1-parser\.ts`\s*\n```typescript\n(.*?)```', agents_md, re.DOTALL)
    if agent1:
        create_file('lib/agents/agent1-parser.ts', agent1.group(1))
    
    # Agent 2
    agent2 = re.search(r'### `lib/agents/agent2-researcher\.ts`\s*\n```typescript\n(.*?)```', agents_md, re.DOTALL)
    if agent2:
        create_file('lib/agents/agent2-researcher.ts', agent2.group(1))
    
    # Agent 3
    agent3 = re.search(r'### `lib/agents/agent3-optimizer\.ts`\s*\n```typescript\n(.*?)```', agents_md, re.DOTALL)
    if agent3:
        create_file('lib/agents/agent3-optimizer.ts', agent3.group(1))
    
    # Agent 4
    agent4 = re.search(r'### `lib/agents/agent4-storyteller\.ts`\s*\n```typescript\n(.*?)```', agents_md, re.DOTALL)
    if agent4:
        create_file('lib/agents/agent4-storyteller.ts', agent4.group(1))
    
    # Orchestrator
    orchestrator = re.search(r'### `lib/agents/orchestrator\.ts`\s*\n```typescript\n(.*?)```', agents_md, re.DOTALL)
    if orchestrator:
        create_file('lib/agents/orchestrator.ts', orchestrator.group(1))
    
    print("\n" + "="*60)
    print("🎉 Setup Complete!")
    print("="*60)
    print("\n📋 Next steps:\n")
    print("1. Install dependencies:")
    print("   npm install")
    print("   cd mcp-servers/reddit && npm install && cd ../..")
    print("   cd mcp-servers/google-maps && npm install && cd ../..")
    print("\n2. Create .env.local:")
    print("   cp .env.local.example .env.local")
    print("   # Edit with your API keys")
    print("\n3. Setup Supabase:")
    print("   - Create project at https://supabase.com")
    print("   - Run SQL from supabase/migrations/001_initial_schema.sql")
    print("   - Copy credentials to .env.local")
    print("\n4. Run the project:")
    print("   npm run dev")
    print("\n5. Open: http://localhost:3000")
    print("\n✨ You're all set! Let's build something amazing! 🚀\n")

if __name__ == '__main__':
    try:
        setup_from_markdowns()
    except KeyboardInterrupt:
        print("\n\n❌ Setup cancelled by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
