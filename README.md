# HDL LRM MCP Server

> Model Context Protocol (MCP) server providing AI agents with efficient access to HDL Language Reference Manuals (Verilog, SystemVerilog, VHDL)

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E=18.0.0-brightgreen)](package.json)
[![Python](https://img.shields.io/badge/python-3.9+-blue)](requirements.txt)

## Overview

Athens HDL MCP is an intelligent documentation server that makes HDL language reference manuals queryable through natural language. It combines PDF parsing, semantic search with AI embeddings, and local LLM summarization to help AI agents and developers quickly find relevant HDL syntax, semantics, and code examples.

### Key Features

- **5 MCP Tools** for querying Verilog, SystemVerilog, and VHDL documentation
- **Semantic Search** using Qwen3-Embedding-0.6B (finds conceptually similar content)
- **AI Summaries** using local Qwen3-0.6B model (reduces token usage)
- **5,266 Sections** extracted with 100% page accuracy and embeddings
- **3,795 Code Examples** and 569 tables from official LRMs
- **Fast Full-Text Search** with SQLite FTS5
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

## Usage

### Available Tools

#### 1. **search_lrm** - Semantic Search

Find sections by concept, even without exact keywords.

```typescript
// Example prompts to Claude:
"Search for blocking vs non-blocking assignments in Verilog"
"Find information about SystemVerilog assertions"
"What does VHDL say about signal resolution?"
```

**Parameters:**
- `query` (string): Search query or concept
- `language` (string): `verilog` | `systemverilog` | `vhdl`
- `max_results` (number): Maximum results (default: 5, max: 20)
- `include_summary` (boolean): Include AI summaries (default: true)

#### 2. **get_section** - Retrieve Section Content

Get complete content from a specific section.

```typescript
// Example:
"Get Verilog section 9.2.1 about procedural assignments"
```

**Parameters:**
- `section_number` (string): e.g., "9.2.1"
- `language` (string): `verilog` | `systemverilog` | `vhdl`
- `include_code` (boolean): Include code examples (default: false)

#### 3. **list_sections** - Table of Contents

Browse the hierarchical structure of the LRM.

```typescript
// Example:
"Show me the table of contents for SystemVerilog"
"List subsections under Verilog section 9"
```

**Parameters:**
- `language` (string): `verilog` | `systemverilog` | `vhdl`
- `parent` (string, optional): Parent section to filter by
- `max_depth` (number): Maximum depth (default: 2)

#### 4. **search_code** - Find Code Examples

Search for specific code patterns or keywords.

```typescript
// Example:
"Find Verilog code examples for always blocks"
"Show SystemVerilog class examples"
```

**Parameters:**
- `query` (string): Code pattern or keyword
- `language` (string): `verilog` | `systemverilog` | `vhdl`
- `max_results` (number): Maximum results (default: 10)
- `explain` (boolean): Add AI explanations (default: false)

#### 5. **get_table** - Retrieve Tables

Get tables from a specific section.

```typescript
// Example:
"Get tables from Verilog section 3.1"
```

**Parameters:**
- `section_number` (string): e.g., "3.1"
- `language` (string): `verilog` | `systemverilog` | `vhdl`

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
│   │   └── encode_query.py
│   ├── summarization/        # AI summaries (GPU accelerated)
│   │   ├── summarizer.py
│   │   └── summarize.py
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
- **Python**: PDF parsing (Docling), embeddings (sentence-transformers), AI (transformers)
- **Communication**: TypeScript spawns Python subprocesses for ML tasks

### Search Pipeline

1. **User Query** → `search_lrm` tool
2. **Encode Query** → Python generates embedding vector
3. **Similarity Search** → Cosine similarity against section embeddings
4. **Summarize** → Optional AI summary generation
5. **Format Response** → Markdown with sections, summaries, key points

### Database Schema

- **sections**: Hierarchical LRM sections with full content
- **code_examples**: Extracted code snippets
- **tables**: Extracted tables (JSON + markdown)
- **section_embeddings**: 768-dim embedding vectors
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

### MCP Tool Response Times (CPU)

| Operation | Target | Typical |
|-----------|--------|---------|
| Keyword search (FTS5) | < 50ms | 20-30ms |
| Semantic search | < 2s | 1-3s* |
| Section retrieval | < 50ms | 10-20ms |
| Code search | < 100ms | 40-60ms |

\* *Includes Python subprocess startup and model inference*

### GPU Acceleration Impact

| Task | CPU Time | GPU Time (RX 9070 XT) | Speedup |
|------|----------|----------------------|---------|
| Generate all embeddings | 2-3 hours | 8-15 minutes | ~15x |
| Single query encoding | 1-3s | 50-200ms | ~10x |
| Section summarization | 5-10s | 0.5-1s | ~8x |

GPU support auto-detected. Use `--device cpu` to force CPU mode if needed.

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
