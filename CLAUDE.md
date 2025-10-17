# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Athens HDL MCP is a Model Context Protocol (MCP) server that provides AI agents with efficient access to HDL Language Reference Manuals (Verilog, SystemVerilog, VHDL). It combines PDF parsing, semantic search, and AI summarization to make hardware description language documentation easily queryable.

## Architecture

### Two-Language Stack
- **TypeScript (Node.js)**: MCP server implementation, database access layer, tool handlers
- **Python**: PDF parsing (Docling), semantic search embeddings (sentence-transformers), AI summarization (transformers)
- **Communication**: TypeScript calls Python scripts via child_process for heavy lifting

### Core Components

**MCP Server (`src/index.ts`)**
- Entry point that implements the Model Context Protocol
- Exposes 5 tools: `search_lrm`, `get_section`, `list_sections`, `search_code`, `get_table`
- Routes requests to database layer
- Formats responses as markdown for AI consumption

**Database Layer (`src/storage/database.ts`)**
- Typed interface for SQLite operations
- Handles FTS5 full-text search and semantic search with embeddings
- Calls Python scripts for embedding generation and summarization
- Uses cosine similarity for semantic search ranking

**PDF Parser (`src/parser/parse_lrm.py`)**
- Uses Docling (v2 native API) to parse LRM PDFs
- Extracts sections, code examples, and tables with accurate page numbers
- Stores structured data in SQLite with hierarchical section relationships
- Critical: Uses `item.prov[0].page_no` for 100% page accuracy

**Embeddings (`src/embeddings/generate_embeddings.py`)**
- Generates semantic embeddings using Qwen/Qwen3-Embedding-0.6B model
- Batch processing for efficiency (default: 32 sections per batch)
- Supports incremental updates (only processes sections without embeddings)

**Summarization (`src/summarization/summarizer.py`)**
- On-demand AI summarization using local LLM (Qwen3)
- Three modes: summary, keypoints, explain
- Called from TypeScript via CLI interface (`summarize.py`)

### Database Schema
- `sections`: Hierarchical section storage with parent/child relationships
- `code_examples`: Code snippets linked to sections
- `tables`: Extracted tables in JSON and markdown formats
- `section_embeddings`: Semantic embeddings (JSON arrays) for search
- `sections_fts`: FTS5 virtual table for full-text search
- `parse_metadata`: Tracking parse runs and PDF hashes

## Development Commands

### Building and Running
```bash
npm run build              # Compile TypeScript to dist/
npm run dev                # Watch mode for development
npm start                  # Run MCP server (after build)
```

### Database Setup
```bash
npm run init-db            # Create fresh database with schema
```

### Parsing LRMs
```bash
# Parse individual languages (runs Python parser)
npm run parse:verilog
npm run parse:systemverilog
npm run parse:vhdl

# Or run Python parser directly with custom PDFs
python src/parser/parse_lrm.py --pdf data/lrms/LRM_V_2005.pdf --language verilog --output data/hdl-lrm.db
```

### Generating Embeddings
```bash
# After parsing, generate embeddings for semantic search
python src/embeddings/generate_embeddings.py --language verilog
python src/embeddings/generate_embeddings.py --language systemverilog
python src/embeddings/generate_embeddings.py  # All languages
```

### Testing

**TypeScript Tests (Jest)**
```bash
npm test                   # Run all tests
npm run test:unit          # Unit tests only
npm run test:integration   # Integration tests only
npm run test:performance   # Performance tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

**Python Tests (pytest)**
```bash
npm run test:python        # Run Python parser tests
pytest src/parser/tests/   # Direct pytest
```

## Key Implementation Details

### Python Script Invocation Pattern
TypeScript calls Python scripts using `child_process.exec` with JSON output:
```typescript
const { stdout } = await execPromise(
    `python "${scriptPath}" "${text.replace(/"/g, '\\"')}" --mode ${mode}`
);
const result = JSON.parse(stdout);
```

### Semantic Search Flow
1. User query → `search_lrm` tool
2. TypeScript encodes query via `encode_query.py`
3. Retrieve all section embeddings from database
4. Compute cosine similarity in TypeScript
5. Optionally call summarizer for results
6. Return ranked results with AI summaries

### Section Hierarchy
Sections use dotted notation (e.g., "3.2.1"):
- `depth` = number of dots (3.2.1 has depth=2)
- `parent_section` = parent number (3.2.1's parent is "3.2")
- Parser may not create parent sections, database queries handle this

### Model Defaults
- Embeddings: `Qwen/Qwen3-Embedding-0.6B` (8192 token context, supports up to 6000 chars)
- Summarization: Local Qwen3 model loaded via transformers
- Embedding dimension: Check with model.get_sentence_embedding_dimension()

## Important File Locations

- Database: `data/hdl-lrm.db`
- LRM PDFs: `data/lrms/LRM_V_2005.pdf`, `LRM_SYSV_2017.pdf`, `LRM_VHDL_2008.pdf`
- Database schema: `src/storage/schema.sql`
- Docling utilities: `src/parser/docling_utils.py`
- Test fixtures: `tests/fixtures/`

## Common Tasks

### Adding a New MCP Tool
1. Add tool definition in `getToolDefinitions()` in `src/index.ts`
2. Add handler case in `setupToolHandlers()` switch statement
3. Implement handler method (e.g., `handleNewTool()`)
4. Add database method in `src/storage/database.ts` if needed
5. Update types and interfaces

### Debugging Parser Issues
- Use `src/parser/inspect_docling_structure.py` to examine PDF structure
- Check page accuracy with `src/parser/debug_page_numbers.py`
- Validate extraction with `src/parser/validate_extraction.py`
- Create test snippets with `src/parser/create_test_snippet.py`

### Updating Embedding Model
1. Change model name in `src/embeddings/generate_embeddings.py`
2. Re-generate all embeddings (existing ones won't auto-update)
3. Update default in `src/storage/database.ts` (semanticSearch methods)
4. Note: Different models have different dimensions, embeddings aren't interchangeable

## Dependencies

**TypeScript**
- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `sqlite3`: Database access
- `ts-jest`: Testing framework

**Python**
- `docling>=2.54.0`: PDF parsing
- `sentence-transformers>=2.2.0`: Embedding generation
- `transformers>=4.35.0`: LLM summarization
- `torch>=2.0.0`: ML framework

## Database Constraints

- Foreign keys enabled via PRAGMA
- Cascading deletes: removing a section deletes its code/tables/embeddings
- Language field must be: verilog, systemverilog, or vhdl
- Section numbers are strings (can be "3.2.1" or "unnumbered_X")
- Page numbers stored as integers (page_start, page_end)
