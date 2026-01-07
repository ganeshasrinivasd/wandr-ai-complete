#!/usr/bin/env python3
"""
Wandr AI Complete Project Documentation Generator

This script scans your entire project and generates a comprehensive
markdown file that can be uploaded to Claude in a new chat session.
"""

import os
import json
from pathlib import Path
from datetime import datetime

# Files/folders to skip
SKIP_DIRS = {
    'node_modules', '.next', '.git', 'dist', 'build', 
    '__pycache__', '.turbo', 'coverage', '.vercel',
    'backups', 'storage'
}

SKIP_FILES = {
    '.DS_Store', 'package-lock.json', 'yarn.lock',
    '.env', '.env.local', '.env.production'
}

# File extensions to include
INCLUDE_EXTENSIONS = {
    '.ts', '.tsx', '.js', '.jsx', '.json', '.md', 
    '.css', '.sql', '.sh', '.py', '.yaml', '.yml'
}

def should_process_file(file_path):
    """Check if file should be processed"""
    if file_path.name in SKIP_FILES:
        return False
    
    if file_path.suffix not in INCLUDE_EXTENSIONS:
        return False
    
    # Skip files larger than 500KB
    try:
        if file_path.stat().st_size > 500000:
            return False
    except:
        return False
    
    return True

def should_process_dir(dir_name):
    """Check if directory should be processed"""
    return dir_name not in SKIP_DIRS and not dir_name.startswith('.')

def read_file_safe(file_path):
    """Safely read file contents"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read()
    except Exception as e:
        return f"[ERROR READING FILE: {str(e)}]"

def get_file_tree(root_path, prefix="", max_depth=4, current_depth=0):
    """Generate file tree structure"""
    if current_depth >= max_depth:
        return ""
    
    tree = ""
    try:
        items = sorted(Path(root_path).iterdir(), key=lambda x: (not x.is_dir(), x.name))
        
        for i, item in enumerate(items):
            is_last = i == len(items) - 1
            
            if item.is_dir():
                if not should_process_dir(item.name):
                    continue
                
                connector = "└── " if is_last else "├── "
                tree += f"{prefix}{connector}{item.name}/\n"
                
                extension = "    " if is_last else "│   "
                tree += get_file_tree(item, prefix + extension, max_depth, current_depth + 1)
            else:
                if should_process_file(item):
                    connector = "└── " if is_last else "├── "
                    size = item.stat().st_size
                    size_str = f"{size:,} bytes" if size < 1024 else f"{size/1024:.1f} KB"
                    tree += f"{prefix}{connector}{item.name} ({size_str})\n"
    except PermissionError:
        pass
    
    return tree

def generate_documentation(project_root):
    """Generate complete project documentation"""
    
    project_root = Path(project_root).resolve()
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    
    # Start building markdown
    md = f"""# Wandr AI Complete - Full Project Documentation
Generated: {timestamp}
Project Path: {project_root}
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
{get_file_tree(project_root)}
```

---

"""
    
    # Configuration files
    md += "\n## ⚙️ Configuration Files\n\n"
    
    config_files = [
        'package.json',
        'tsconfig.json',
        'next.config.js',
        'tailwind.config.ts',
        '.env.example'
    ]
    
    for config_file in config_files:
        file_path = project_root / config_file
        if file_path.exists():
            content = read_file_safe(file_path)
            md += f"### {config_file}\n\n```json\n{content}\n```\n\n"
    
    # Source code files
    md += "\n## 💻 Source Code\n\n"
    
    # Important directories to document
    important_dirs = [
        'app',
        'lib/agents',
        'lib/mcp',
        'lib/utils',
        'lib/rag'
    ]
    
    for dir_name in important_dirs:
        dir_path = project_root / dir_name
        if not dir_path.exists():
            md += f"### {dir_name}/ (Not found)\n\n"
            continue
        
        md += f"### {dir_name}/\n\n"
        
        # Get all files in directory (recursively)
        for file_path in sorted(dir_path.rglob('*')):
            if file_path.is_file() and should_process_file(file_path):
                relative_path = file_path.relative_to(project_root)
                content = read_file_safe(file_path)
                
                # Determine language for syntax highlighting
                ext_to_lang = {
                    '.ts': 'typescript',
                    '.tsx': 'tsx',
                    '.js': 'javascript',
                    '.jsx': 'jsx',
                    '.json': 'json',
                    '.css': 'css',
                    '.sql': 'sql',
                    '.sh': 'bash',
                    '.py': 'python',
                    '.md': 'markdown'
                }
                lang = ext_to_lang.get(file_path.suffix, 'text')
                
                md += f"#### {relative_path}\n\n"
                md += f"```{lang}\n{content}\n```\n\n"
    
    # Environment variables documentation
    md += "\n## 🔐 Environment Variables\n\n"
    md += """
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

"""
    
    # Database schema
    md += "\n## 🗄️ Database Schema\n\n"
    
    schema_file = project_root / 'supabase' / 'migrations' / '001_initial_schema.sql'
    if schema_file.exists():
        content = read_file_safe(schema_file)
        md += f"```sql\n{content}\n```\n\n"
    else:
        md += """
### Supabase Tables

**itineraries table:**
```sql
CREATE TABLE itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  user_input TEXT NOT NULL,
  status TEXT CHECK (status IN ('pending', 'generating', 'completed', 'error')),
  result JSONB,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

"""
    
    # Current issues section
    md += "\n## 🐛 Current Issues & Status\n\n"
    md += """
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

"""
    
    # Add package.json scripts
    package_json_path = project_root / 'package.json'
    if package_json_path.exists():
        try:
            with open(package_json_path) as f:
                pkg = json.load(f)
                
            md += "\n## 📜 Available Scripts\n\n"
            if 'scripts' in pkg:
                for script, command in pkg['scripts'].items():
                    md += f"- `npm run {script}`: {command}\n"
                md += "\n"
            
            md += "\n## 📦 Dependencies\n\n"
            if 'dependencies' in pkg:
                md += "### Production:\n"
                for dep, version in sorted(pkg['dependencies'].items()):
                    md += f"- {dep}: {version}\n"
                md += "\n"
            
            if 'devDependencies' in pkg:
                md += "### Development:\n"
                for dep, version in sorted(pkg['devDependencies'].items()):
                    md += f"- {dep}: {version}\n"
                md += "\n"
        except:
            pass
    
    # Footer
    md += """
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
"""
    
    return md

def main():
    """Main function"""
    import sys
    
    # Get project root (current directory or provided argument)
    if len(sys.argv) > 1:
        project_root = sys.argv[1]
    else:
        project_root = os.getcwd()
    
    print(f"🔍 Scanning project: {project_root}")
    print("⏳ Generating documentation...")
    
    # Generate documentation
    documentation = generate_documentation(project_root)
    
    # Save to file
    output_file = Path(project_root) / "WANDR-AI-COMPLETE-DOCS.md"
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(documentation)
    
    print(f"✅ Documentation generated: {output_file}")
    print(f"📄 File size: {output_file.stat().st_size / 1024:.1f} KB")
    print("\n🎯 Next steps:")
    print("1. Upload this file to a new Claude chat (Opus recommended)")
    print("2. Start your message with: 'I'm continuing from a previous chat. Please read the attached documentation.'")
    print("3. Continue your conversation!\n")

if __name__ == "__main__":
    main()
