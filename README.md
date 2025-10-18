# HDL LRM MCP Server

> Model Context Protocol (MCP) server providing AI agents with efficient access to HDL Language Reference Manuals (Verilog, SystemVerilog, VHDL)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E=18.0.0-brightgreen)](package.json)
[![Python](https://img.shields.io/badge/python-3.9+-blue)](requirements.txt)

---

## 🤖 Quick Start for AI Agents

**Efficient HDL documentation queries in 2 steps:**

```javascript
// 1. DISCOVERY - Find relevant sections (minimal tokens)
search_lrm({
  query: "your query here",
  language: "verilog",  // or systemverilog, vhdl
  detail_level: "minimal"  // Returns only: section_number, title, page, similarity
});

// 2. RETRIEVAL - Get full content for selected sections
get_section({
  section_number: "9.2.1",
  language: "verilog",
  include_code: true
});
```

**Token Efficiency:** Discovery mode uses 90% fewer tokens than full-content search.

**Available Languages:** `verilog` | `systemverilog` | `vhdl`

**Detail Levels:** `minimal` (default) | `preview` | `full`

[→ Full Agent Documentation](#usage-for-ai-agents)

---

## Overview

Athens HDL MCP is a token-optimized documentation server that makes HDL language reference manuals queryable through semantic search. It combines PDF parsing and AI embeddings to help agents efficiently discover and retrieve HDL syntax, semantics, and code examples.

### Key Features

- **5 MCP Tools** optimized for agentic workflows (discovery → retrieval pattern)
- **Semantic Search** using Qwen3-Embedding-0.6B (finds conceptually similar content)
- **Token-Efficient Responses** with 3 detail levels (minimal/preview/full)
- **5,266 Sections** extracted with 100% page accuracy and embeddings
- **3,795 Code Examples** and 569 tables from official LRMs
- **Persistent Embedding Server** for fast queries (~100x faster than reload per query)
- **Pre-built Database** available - ready to use in minutes

### What's Included

| Language       | Sections | Code Examples | Tables | Embeddings |
|----------------|----------|---------------|--------|------------|
| SystemVerilog  | 2,821    | 2,335         | 249    | ✓          |
| Verilog        | 1,198    | 820           | 215    | ✓          |
| VHDL           | 1,247    | 640           | 105    | ✓          |
| **Total**      | **5,266**| **3,795**     | **569**| **100%**   |

---

## Quick Start (Recommended)

**Get up and running in 5 minutes with the pre-built database!**

### 1. Download Pre-built Database

The database includes all parsed LRM content with pre-generated embeddings (139MB):

```bash
# Download from releases (replace with your actual release URL)
wget https://github.com/your-org/athens-hdl-mcp/releases/download/v2.0.0/hdl-lrm.tar.gz -O data/hdl-lrm.tar.gz

# Or if you already have the tarball, extract it:
cd data
tar -xzf hdl-lrm.tar.gz
cd ..
```

**What's included:**
- ✅ All 5,266 sections from Verilog, SystemVerilog, and VHDL LRMs
- ✅ 3,795 code examples with accurate page numbers
- ✅ 569 tables in markdown format
- ✅ 100% embedding coverage for semantic search (Qwen3-Embedding-0.6B)
- ✅ Ready for immediate use - no parsing or embedding generation needed

### 2. Install Dependencies

```bash
# Clone repository
git clone https://github.com/zephan-spencer/hdl-lrm-mcp.git
cd hdl-lrm-mcp

# Install Node.js dependencies
npm install

# Create Python virtual environment (for AI summaries)
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -r requirements.txt
```

### 3. Build TypeScript

```bash
npm run build
```

### 4. Configure Your Claude Client

#### Option A: Claude Desktop

Add to your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "hdl-lrm": {
      "command": "node",
      "args": ["/absolute/path/to/hdl-lrm-mcp/dist/index.js"]
    }
  }
}
```

**Important:** Use the absolute path to `dist/index.js`.

Restart Claude Desktop and look for the 🔌 icon to see 5 HDL tools.

#### Option B: Claude Code (CLI)

Add to your Claude Code config:

**macOS/Linux:** `~/.config/claude-code/config.json`
**Windows:** `%APPDATA%\claude-code\config.json`

```json
{
  "mcpServers": {
    "hdl-lrm": {
      "command": "node",
      "args": ["/absolute/path/to/hdl-lrm-mcp/dist/index.js"]
    }
  }
}
```

**Important:** Use the absolute path to `dist/index.js`.

Restart your terminal and run `claude-code` - the 5 HDL tools will be available automatically.

**That's it!** 🚀

---

## Advanced: Build from Source

**Only needed if you want to parse your own LRM PDFs or regenerate embeddings.**

<details>
<summary>Click to expand build-from-source instructions</summary>

## Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **Python** >= 3.9
- **uv** (Python package manager) - [Install uv](https://github.com/astral-sh/uv)
- **LRM PDFs** - You need the official Language Reference Manual PDFs:
  - IEEE Std 1364-2005 (Verilog)
  - IEEE Std 1800-2017 (SystemVerilog)
  - IEEE Std 1076-2008 (VHDL)

  Place them in `data/lrms/` with these exact names:
  - `LRM_V_2005.pdf`
  - `LRM_SYSV_2017.pdf`
  - `LRM_VHDL_2008.pdf`

### GPU Acceleration (Optional - For Building from Source)

**Only needed if you're parsing PDFs and generating embeddings from scratch.**

If using the pre-built database, GPU support is not required for normal operation. It's only beneficial if you want to regenerate embeddings or parse updated LRM PDFs.

**Benefits:**
- **AMD GPUs** (RX 9070 XT, RX 7000 series, etc.): Requires ROCm 6.4+
- **NVIDIA GPUs**: Requires CUDA 11.8+
- **Performance**: ~15x faster embedding generation (2-3 hours → 8-15 minutes)

**Quick Setup:**
```bash
# Activate virtual environment first
source .venv/bin/activate

# Automated GPU setup (detects AMD/NVIDIA and installs PyTorch)
npm run setup:gpu

# Verify GPU detection
npm run test:gpu:quick
```

**Manual Setup for AMD GPUs (ROCm 6.4):**
```bash
source .venv/bin/activate
uv pip install -r requirements-rocm.txt
```

GPU support is auto-detected - all Python scripts will use GPU if available.

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/zephan-spencer/hdl-lrm-mcp.git
cd hdl-lrm-mcp

# Install Node.js dependencies
npm install

# Create Python virtual environment and install dependencies
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -r requirements.txt
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Parse LRM PDFs (One-Time Setup)

**Important:** You must parse the PDFs before the server will work. This creates the database.

```bash
# Ensure PDFs are in data/lrms/
ls data/lrms/  # Should show: LRM_V_2005.pdf, LRM_SYSV_2017.pdf, LRM_VHDL_2008.pdf

# Activate virtual environment
source .venv/bin/activate

# Parse all languages at once (~20-45 minutes total)
npm run parse

# Or parse each language individually (takes 5-15 minutes per PDF)
npm run parse:verilog       # Creates database with Verilog sections
npm run parse:systemverilog # Adds SystemVerilog sections
npm run parse:vhdl          # Adds VHDL sections

# Or parse with custom PDFs:
python src/parser/parse_lrm.py \
  --pdf data/lrms/LRM_V_2005.pdf \
  --language verilog \
  --output data/hdl-lrm.db
```

**What this does:**
- Uses Docling to extract sections, code examples, and tables
- Creates `data/hdl-lrm.db` (SQLite database, ~79MB)
- Achieves 100% page number accuracy
- Shows progress: "✓ Parsed in X.Xs", "✓ Found N sections"

### 4. Generate Embeddings (Required for Semantic Search)

After parsing, generate embeddings for semantic search:

```bash
# Still in virtual environment
source .venv/bin/activate

# Generate embeddings for all languages (~2-3 hours total)
python src/embeddings/generate_embeddings.py --language verilog
python src/embeddings/generate_embeddings.py --language systemverilog
python src/embeddings/generate_embeddings.py --language vhdl

# Or generate for all at once
python src/embeddings/generate_embeddings.py
```

**What this does:**
- Downloads Qwen3-Embedding-0.6B model (~2GB, first time only)
- Processes 5,266 sections in batches
- Shows progress: "Progress: X/Y (Z%) | Batch: N sections/s | ETA: Ts"
- Grows database to ~120-150MB
- **Auto-detects GPU** and uses bfloat16 precision for 15x speedup

**Performance:**
| Hardware | Batch Size | Time (all languages) | Speedup |
|----------|------------|----------------------|---------|
| CPU | 32 | 2-3 hours | 1x (baseline) |
| AMD RX 9070 XT | 128 | 8-15 minutes | ~15x |
| NVIDIA RTX 4090 | 128 | 6-12 minutes | ~18x |

---

</details>

## Verifying Installation

After setup (Quick Start or Build from Source):

### For Claude Desktop:

1. **Restart Claude Desktop**
2. **Look for the 🔌 icon** in Claude's interface
3. **Click it** to see available tools - you should see 5 HDL tools:
   - `search_lrm` - Semantic search
   - `get_section` - Retrieve specific sections
   - `list_sections` - Browse table of contents
   - `search_code` - Find code examples
   - `get_table` - Retrieve tables

### For Claude Code (CLI):

1. **Restart your terminal**
2. **Run `claude-code`** to start a new session
3. The 5 HDL tools are automatically available - no need to check manually

### Test Your Setup

Try asking Claude (in either Desktop or CLI):
```
"Search for blocking vs non-blocking assignments in Verilog"
"Show me SystemVerilog assertion examples"
"What does VHDL say about signal resolution?"
```

---

## Usage for AI Agents

### Agent-Optimized Workflow: Discovery → Retrieval

Athens HDL MCP is designed for **token efficiency**. The recommended workflow:

**Step 1: Discovery** (Minimal tokens)
```javascript
// Find relevant sections with minimal token cost
search_lrm({
  query: "blocking vs non-blocking assignments",
  language: "verilog",
  detail_level: "minimal",  // DEFAULT - only section_number, title, page, similarity
  max_results: 10  // Cast wide net at low cost (~800 bytes total)
});
```

**Step 2: Retrieval** (Full details for selected sections)
```javascript
// Get complete content for the most relevant section
get_section({
  section_number: "9.2.2",
  language: "verilog",
  include_code: true
});
```

### Available Tools

#### 1. **search_lrm** - Semantic Search (Discovery)

Find sections by concept using AI embeddings.

**Recommended Parameters:**
```javascript
{
  query: "blocking vs non-blocking assignments",
  language: "verilog",  // verilog | systemverilog | vhdl
  detail_level: "minimal",  // minimal (default) | preview | full
  max_results: 10  // 1-20, use higher with minimal mode
}
```

**Detail Levels:**
- `minimal` (default): Returns section_number, title, page, similarity only (~80 bytes/result)
- `preview`: Adds 200-char content preview (~280 bytes/result)
- `full`: Returns complete content (~1000-3000 bytes/result)

**Token Efficiency:**
- Minimal mode: **90% token reduction** vs full content
- Discovery workflow: **54% reduction** vs old approach

#### 2. **get_section** - Retrieve Full Content

Get complete section with metadata and navigation.

**Parameters:**
```javascript
{
  section_number: "9.2.1",  // e.g., "3.2.1"
  language: "verilog",
  include_code: true  // Include code examples (default: false)
}
```

**Returns:** Full section content, parent/sibling/subsection navigation, optional code examples

#### 3. **list_sections** - Table of Contents

Browse hierarchical structure.

**Parameters:**
```javascript
{
  language: "verilog",
  parent: "9",  // Optional: filter to subsections
  max_depth: 2,  // Hierarchy depth (default: 2)
  search_filter: "assignment"  // Optional: filter by keyword
}
```

#### 4. **search_code** - Find Code Examples

Search for code patterns or keywords.

**Parameters:**
```javascript
{
  query: "always @",
  language: "verilog",
  max_results: 10,
  include_context: false  // DEFAULT - omit 200-char preview to save tokens
}
```

**Token Optimization:** Context is opt-in to save ~200 bytes per result.

#### 5. **get_table** - Retrieve Tables

Get tables from a specific section.

**Parameters:**
```javascript
{
  section_number: "3.1",
  language: "verilog"
}
```

### Example Usage

```javascript
// EFFICIENT: Discovery → Retrieval workflow
// 1. Find relevant sections (minimal)
const discovery = await search_lrm({
  query: "clock domain crossing",
  language: "systemverilog",
  detail_level: "minimal",
  max_results: 15
});

// 2. Retrieve top 2 matches fully
const section1 = await get_section({
  section_number: discovery.results[0].section_number,
  language: "systemverilog",
  include_code: true
});

const section2 = await get_section({
  section_number: discovery.results[1].section_number,
  language: "systemverilog"
});

// Total tokens: ~1200 bytes (vs ~18KB with old full-content search)
```

### Response Format

**JSON (default)** - Structured, parseable responses
```json
{
  "query": "...",
  "language": "verilog",
  "results": [...]
}
```

**Markdown** - Human-readable (use `format: "markdown"` parameter)
- Available for debugging
- Optimized formatting (no emojis)

---

## Development

### Project Structure

```
hdl-lrm-mcp/
├── src/
│   ├── index.ts              # Entry point (40 lines)
│   ├── server/               # MCP server modules
│   │   ├── mcp-server.ts     # Main server class
│   │   └── tool-definitions.ts
│   ├── handlers/             # Tool implementations
│   │   ├── search-handler.ts
│   │   ├── section-handler.ts
│   │   ├── code-handler.ts
│   │   └── table-handler.ts
│   ├── storage/              # Database layer
│   │   ├── database.ts
│   │   ├── schema.sql
│   │   └── init-db.ts
│   ├── utils/                # Shared utilities
│   │   └── gpu_utils.py      # GPU detection and optimization
│   ├── embeddings/           # Semantic search (GPU accelerated)
│   │   ├── generate_embeddings.py
│   │   ├── embedding_server.py  # Persistent embedding server
│   │   └── encode_query.py
│   └── parser/               # PDF parsing
│       ├── parse_lrm.py      # Main parser
│       ├── docling_utils.py
│       ├── tests/
│       └── scripts/          # Debug utilities
├── scripts/
│   └── setup_pytorch.sh      # Automated GPU setup
├── data/
│   ├── hdl-lrm.db           # SQLite database (139MB with embeddings)
│   └── lrms/                # Source PDFs (only needed for parsing)
├── tests/
│   ├── gpu_test.py          # GPU verification tests
│   └── ...                  # TypeScript tests
├── requirements.txt          # CPU dependencies
├── requirements-rocm.txt     # AMD GPU (ROCm 6.4) dependencies
└── docs/                    # Documentation
```

### Running Tests

```bash
# TypeScript tests
npm test                  # All tests
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests
npm run test:coverage     # With coverage

# Python tests
npm run test:python
# or
pytest src/parser/tests/
```

### Parsing New LRMs

To parse additional or updated LRM PDFs:

```bash
npm run parse:verilog          # Parse Verilog LRM
npm run parse:systemverilog    # Parse SystemVerilog LRM
npm run parse:vhdl             # Parse VHDL LRM

# Or directly with custom PDF:
python src/parser/parse_lrm.py \
  --pdf path/to/lrm.pdf \
  --language verilog \
  --output data/hdl-lrm.db
```

---

## Architecture

### Two-Language Design

- **TypeScript** (Node.js): MCP server, database access, tool routing
- **Python**: PDF parsing (Docling), embeddings (sentence-transformers)
- **Communication**: TypeScript → Persistent Python embedding server (HTTP)

### Search Pipeline

1. **User Query** → `search_lrm` tool with `detail_level` parameter
2. **Encode Query** → Python embedding server (pre-loaded model, fast)
3. **Similarity Search** → TypeScript computes cosine similarity
4. **Filter by Detail Level** → Return minimal/preview/full based on parameter
5. **Format Response** → JSON or markdown

### Database Schema

- **sections**: Hierarchical LRM sections with full content
- **code_examples**: Extracted code snippets
- **tables**: Extracted tables (JSON + markdown)
- **section_embeddings**: 1024-dim embedding vectors (Qwen3-Embedding-0.6B)
- **sections_fts**: FTS5 virtual table for keyword search
- **parse_metadata**: Parsing history and stats

---

## Troubleshooting

### "No embeddings found"

```bash
# Generate embeddings for the language you're searching
source .venv/bin/activate
python src/embeddings/generate_embeddings.py --language verilog
```

### Python module errors

```bash
# Reinstall dependencies
source .venv/bin/activate
uv pip install -r requirements.txt
```

### TypeScript build errors

```bash
# Clean and rebuild
rm -rf dist/
npm run build
```

### MCP server not appearing in Claude

**Claude Desktop:**
1. Check config path is absolute in `claude_desktop_config.json`
2. Restart Claude Desktop completely
3. Check Claude logs: `Help` → `Show Logs`
4. Verify build: `node dist/index.js` (should print "Server running")

**Claude Code (CLI):**
1. Check config path is absolute in `~/.config/claude-code/config.json`
2. Restart your terminal session
3. Run `claude-code --version` to verify installation
4. Check MCP logs in `~/.config/claude-code/logs/` if available
5. Verify build: `node dist/index.js` (should print "Server running")

### GPU not detected

```bash
# Verify ROCm installation (AMD GPUs)
rocm-smi

# If ROCm not installed, see: https://rocm.docs.amd.com/

# Re-run GPU setup
source .venv/bin/activate
npm run setup:gpu

# Test GPU detection
npm run test:gpu:quick
```

### GPU out of memory errors

```bash
# Reduce batch size for embedding generation
python src/embeddings/generate_embeddings.py --batch-size 64  # Default is 128 on GPU

# Or force CPU mode
python src/embeddings/generate_embeddings.py --device cpu
```

### bfloat16 not supported warning

Some older GPUs don't support bfloat16. The code automatically falls back to float16, which works fine. If you see issues, force float32:

```python
# Edit src/utils/gpu_utils.py, line 92, change to:
return torch.float32  # Force float32 instead of bfloat16
```

---

## Performance

### MCP Tool Response Times

| Operation | First Query | Subsequent | Notes |
|-----------|-------------|------------|-------|
| Semantic search | 2-3s | 200-500ms | First query starts embedding server |
| Section retrieval | < 50ms | < 50ms | Direct SQLite lookup |
| Code search | < 100ms | < 100ms | FTS5 full-text search |
| List sections | < 50ms | < 50ms | Database query only |

**Persistent Embedding Server:** After the first query, the embedding model stays loaded in memory for ~100x faster subsequent queries.

### GPU Acceleration Impact (Build from Source Only)

| Task | CPU Time | GPU Time (RX 9070 XT) | Speedup |
|------|----------|----------------------|---------|
| Generate all embeddings | 2-3 hours | 8-15 minutes | ~15x |
| Embedding server startup | 80-120s | 8-15s | ~10x |
| Query encoding (after startup) | 1-3s | 50-200ms | ~10x |

**Note:** GPU is only beneficial when building from source (parsing PDFs, generating embeddings). The pre-built database works great on CPU.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidelines.

---

## License

MIT License - see [LICENSE](LICENSE) file

---

## Acknowledgments

- **Docling** - PDF parsing with accurate page tracking
- **Qwen Team** - Embedding and LLM models
- **Model Context Protocol** - Anthropic's MCP specification

---

**Built for AI-assisted HDL development** 🚀
