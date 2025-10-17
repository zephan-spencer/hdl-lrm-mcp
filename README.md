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
- **5,266 Sections** extracted with 100% page accuracy
- **8,410 Code Examples** and 1,388 tables from official LRMs
- **Fast Full-Text Search** with SQLite FTS5

### Database Contents

| Language       | Sections | Code Examples | Tables |
|----------------|----------|---------------|--------|
| SystemVerilog  | 2,821    | ~5,000        | ~800   |
| Verilog        | 1,198    | ~2,000        | ~300   |
| VHDL           | 1,247    | ~1,400        | ~288   |

---

## Installation

### Prerequisites

- **Node.js** >= 18.0.0
- **Python** >= 3.9
- **uv** (Python package manager) - [Install uv](https://github.com/astral-sh/uv)

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd hdl-lrm-mcp

# Install Node.js dependencies
npm install

# Install Python dependencies
uv venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
uv pip install -r requirements.txt
```

### 2. Build TypeScript

```bash
npm run build
```

### 3. Generate Embeddings (Required for Semantic Search)

The database is included, but you need to generate embeddings for semantic search:

```bash
# Activate virtual environment
source .venv/bin/activate

# Generate embeddings for all languages (~2-3 hours)
python src/embeddings/generate_embeddings.py --language verilog
python src/embeddings/generate_embeddings.py --language systemverilog
python src/embeddings/generate_embeddings.py --language vhdl

# Or generate for all at once
python src/embeddings/generate_embeddings.py
```

**Note:** This downloads the Qwen3-Embedding-0.6B model (~2GB) and processes 5,266 sections. Progress is shown during generation.

---

## MCP Setup

### Claude Desktop Configuration

Add to your Claude Desktop config file:

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

### Verifying Installation

1. Restart Claude Desktop
2. Look for the 🔌 icon in Claude's interface
3. Click it to see available tools - you should see 5 HDL tools

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
│   ├── embeddings/           # Semantic search
│   │   ├── generate_embeddings.py
│   │   └── encode_query.py
│   ├── summarization/        # AI summaries
│   │   ├── summarizer.py
│   │   └── summarize.py
│   └── parser/               # PDF parsing
│       ├── parse_lrm.py      # Main parser
│       ├── docling_utils.py
│       ├── tests/
│       └── scripts/          # Debug utilities
├── data/
│   ├── hdl-lrm.db           # SQLite database (79MB)
│   └── lrms/                # Source PDFs
├── tests/                   # TypeScript tests
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

1. Check config path is absolute
2. Restart Claude Desktop
3. Check Claude logs: `Help` → `Show Logs`
4. Verify build: `node dist/index.js` (should print "Server running")

---

## Performance

| Operation | Target | Typical |
|-----------|--------|---------|
| Keyword search (FTS5) | < 50ms | 20-30ms |
| Semantic search | < 2s | 1-3s* |
| Section retrieval | < 50ms | 10-20ms |
| Code search | < 100ms | 40-60ms |

\* *Includes Python subprocess startup and model inference*

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
